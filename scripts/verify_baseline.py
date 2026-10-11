#!/usr/bin/env python3
"""Read-only, fail-closed verification of CP-017 research containers.

Archive integrity NEVER establishes historical truth, rights clearance,
complete recovery, or authorization to publish or migrate.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import zipfile

COMPONENTS = ("CORE", "EXPORTS", "SOURCES", "RECOVERY")

def validate_manifest(manifest):
    if manifest.get("checkpoint") != "CP-017" or manifest.get("corpus_version") != "1.17":
        raise ValueError("stale or incorrect baseline")
    rows = manifest.get("components")
    if not isinstance(rows, list) or len(rows) != 4:
        raise ValueError("exactly four components required")
    names = []
    for row in rows:
        name = row.get("artifact_id")
        if name not in COMPONENTS:
            raise ValueError("unknown component")
        names.append(name)
        filename = row.get("filename")
        if not isinstance(filename, str) or Path(filename).name != filename or not filename.endswith(".zip"):
            raise ValueError("unsafe archive filename")
        digest = row.get("sha256")
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise ValueError("invalid sha256")
        if type(row.get("size_bytes")) is not int or row["size_bytes"] < 1:
            raise ValueError("invalid length")
    if set(names) != set(COMPONENTS) or len(set(names)) != 4:
        raise ValueError("missing or duplicate components")
    if manifest.get("research_claims_verified") is not False:
        raise ValueError("historical claims must not be certified by archive check")
    return rows

def verify_zip(row, folder, crc=True):
    path = folder / row["filename"]
    if not path.is_file() or path.is_symlink():
        raise ValueError("component missing or symlink: " + row["artifact_id"])
    if path.stat().st_size != row["size_bytes"]:
        raise ValueError("size mismatch: " + row["artifact_id"])
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            h.update(part)
    if h.hexdigest() != row["sha256"]:
        raise ValueError("digest mismatch: " + row["artifact_id"])
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        names = [x.filename for x in infos]
        if not infos or len(infos) > 50000 or len(set(names)) != len(names):
            raise ValueError("invalid ZIP member inventory")
        if any(x.startswith("/") or "\\" in x or ".." in Path(x).parts for x in names):
            raise ValueError("unsafe ZIP member path")
        if crc and z.testzip() is not None:
            raise ValueError("ZIP member CRC failure: " + row["artifact_id"])
    return {"artifact_id": row["artifact_id"], "sha256": h.hexdigest(), "member_count": len(infos), "crc_checked": crc}

def inspect_core_database(archive_path):
    member = "corpus_v1_17/research.sqlite"
    with zipfile.ZipFile(archive_path) as z:
        if z.namelist().count(member) != 1 or z.getinfo(member).file_size > 2 * 1024**3:
            raise ValueError("canonical SQLite missing, duplicate, or too large")
        with tempfile.TemporaryDirectory(prefix="garden-baseline-") as d:
            target = Path(d) / "research.sqlite"
            with z.open(member) as src, target.open("wb") as dst:
                from shutil import copyfileobj
                copyfileobj(src, dst, length=4 * 1024 * 1024)
            con = sqlite3.connect("file:" + target.as_posix() + "?mode=ro&immutable=1", uri=True)
            try:
                integrity = con.execute("PRAGMA integrity_check").fetchone()[0]
                fk = len(con.execute("PRAGMA foreign_key_check").fetchall())
                table_count = con.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
                if integrity != "ok" or fk:
                    raise ValueError("SQLite integrity failure")
                return {"sqlite_integrity": integrity, "foreign_key_violations": fk, "tables_including_internal": table_count}
            finally:
                con.close()

def verify(manifest, folder, crc=True, sqlite=True):
    rows = validate_manifest(manifest)
    results = [verify_zip(row, folder, crc=crc) for row in rows]
    core = next(row for row in rows if row["artifact_id"] == "CORE")
    database = inspect_core_database(folder / core["filename"]) if sqlite else None
    return {"checkpoint": "CP-017", "components": results, "database": database,
            "historical_claims_verified": False, "rights_cleared": False,
            "production_migration_authorized": False,
            "partial_check": not crc or not sqlite}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path(__file__).resolve().parents[1] / "docs/sources/baseline-artifacts.json")
    parser.add_argument("--archive-directory", type=Path, required=True)
    parser.add_argument("--skip-crc", action="store_true", help="report partial verification")
    parser.add_argument("--skip-sqlite", action="store_true", help="report partial verification")
    args = parser.parse_args()
    try:
        report = verify(json.loads(args.manifest.read_text()), args.archive_directory,
                        crc=not args.skip_crc, sqlite=not args.skip_sqlite)
    except (OSError, ValueError, zipfile.BadZipFile, sqlite3.DatabaseError) as exc:
        print("BASELINE VERIFICATION FAILED: " + str(exc), file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
