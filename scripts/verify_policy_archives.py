#!/usr/bin/env python3
"""Verify archived source bytes against a pinned manifest.

Read-only, standard-library verification. This does not establish scholarly
accuracy, consent, licensing or permission to publish the source material.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "policy" / "SOURCE_MANIFEST.json"
CHUNK_SIZE = 4 * 1024 * 1024


def _safe_basename(name: object) -> bool:
    return (
        isinstance(name, str)
        and bool(name)
        and name not in {".", ".."}
        and name == Path(name).name
        and not any(char in name for char in ("/", "\\", "\x00"))
    )


def verify_external_sources(manifest: dict[str, Any], source_dir: Path,
                            *, require_all: bool = False) -> dict[str, Any]:
    """Verify declared basenames in source_dir, without following symlinks."""
    entries = manifest.get("external_materials", [])
    if not isinstance(entries, list):
        raise ValueError("external_materials must be an array")
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in entries:
        name = item.get("filename") if isinstance(item, dict) else None
        if not _safe_basename(name) or name in seen:
            records.append({"filename": str(name), "status": "invalid_manifest_filename"})
            continue
        seen.add(name)
        path = source_dir / name
        if path.is_symlink():
            records.append({"filename": name, "status": "symlink_rejected"})
            continue
        if not path.exists():
            records.append({"filename": name, "status": "missing"})
            continue
        if not path.is_file():
            records.append({"filename": name, "status": "not_regular_file"})
            continue
        expected_bytes, expected_sha = item.get("bytes"), item.get("sha256")
        if (not isinstance(expected_bytes, int) or isinstance(expected_bytes, bool)
                or expected_bytes < 0 or not isinstance(expected_sha, str)
                or len(expected_sha) != 64
                or any(c not in "0123456789abcdef" for c in expected_sha)):
            records.append({"filename": name, "status": "unverifiable_manifest_metadata"})
            continue
        digest = hashlib.sha256()
        actual_bytes = 0
        with path.open("rb") as stream:
            while chunk := stream.read(CHUNK_SIZE):
                digest.update(chunk)
                actual_bytes += len(chunk)
        actual_sha = digest.hexdigest()
        status = "verified" if actual_bytes == expected_bytes and actual_sha == expected_sha else "mismatch"
        records.append({"filename": name, "status": status,
                        "bytes": actual_bytes, "sha256": actual_sha})
    counts = {status: sum(row["status"] == status for row in records)
              for status in sorted({row["status"] for row in records})}
    failures = sum(row["status"] not in {"verified", "missing"} for row in records)
    if require_all:
        failures += counts.get("missing", 0)
    return {"expected": len(entries), "counts": counts, "failures": failures,
            "all_verified": len(entries) > 0 and counts.get("verified", 0) == len(entries),
            "originals": records,
            "limitations": ["Byte integrity only, not historical or rights review.",
                            "No files imported, copied, decompressed or published."]}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True,
                        help="directory containing the unchanged originals")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--require-all", action="store_true",
                        help="also fail if any declared original is missing")
    parser.add_argument("--output", type=Path,
                        help="optional JSON report (never contains file content)")
    args = parser.parse_args(argv)
    if not args.source_dir.is_dir():
        parser.error("--source-dir must be an existing directory")
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        report = verify_external_sources(manifest, args.source_dir,
                                         require_all=args.require_all)
    except (OSError, ValueError, TypeError) as exc:
        print(json.dumps({"result": "error", "error": str(exc)}))
        return 2
    report["result"] = "pass" if not report["failures"] else "fail"
    result_text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    print(result_text, end="")
    if args.output:
        args.output.write_text(result_text, encoding="utf-8")
    return 0 if not report["failures"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
