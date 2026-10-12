#!/usr/bin/env python3
"""Reject accidental source modification or undeclared policy files. Stdlib only."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "policy" / "SOURCE_MANIFEST.json"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate repository source manifest")
    args = parser.parse_args()
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = {}
    errors = []
    for entry in data["source_files"]:
        rel = entry["path"]
        if not rel.startswith("policy/") or ".." in Path(rel).parts or rel in expected:
            errors.append("invalid or duplicate path: " + rel)
            continue
        expected[rel] = entry
        file = ROOT / rel
        if not file.is_file():
            errors.append("missing: " + rel)
            continue
        raw = file.read_bytes()
        if len(raw) != entry["bytes"] or hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            errors.append("size or hash mismatch: " + rel)
    if not args.check:
        errors.append("run with --check; verification does not authorize publication")
    if errors:
        print("\n".join(errors))
        return 1
    print(f"Policy manifest OK: {len(expected)} source files; archive publication not approved")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
