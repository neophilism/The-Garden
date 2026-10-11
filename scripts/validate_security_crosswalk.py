#!/usr/bin/env python3
"""Validate the exact-source crosswalk without implying security conformance."""
import json
from pathlib import Path
import re

REPO = "neophilism/End-To-End-Everywhere-Security-Architecture-Standard"
EXPECTED = {"SEC-" + str(i).zfill(2) for i in range(1, 13)}

def validate(data):
    if data.get("canonical_source") != "https://github.com/" + REPO:
        raise ValueError("canonical repository mismatch")
    revision = data.get("canonical_revision", "")
    if not isinstance(revision, str) or not re.fullmatch("[0-9a-f]{40}", revision):
        raise ValueError("canonical revision must be exact Git commit SHA")
    if data.get("certification_claim") is not False:
        raise ValueError("no certification without assessment")
    if data.get("mapping_kind") != "document_subject_area_not_requirement_level_or_conformance":
        raise ValueError("document mapping must not be treated as requirement-level evidence")
    rows = data.get("controls")
    if not isinstance(rows, list) or {x.get("id") for x in rows} != EXPECTED or len(rows) != 12:
        raise ValueError("12 unique proposed controls required")
    for row in rows:
        if row.get("assessed") is not False or row.get("canonical_requirement_id") is not None:
            raise ValueError("unreviewed crosswalk may not claim assessed control")
        if row.get("status") != "document_mapped_requirement_and_implementation_unverified":
            raise ValueError("invalid control assessment status")
        refs = row.get("canonical_documents")
        if not isinstance(refs, list) or not refs:
            raise ValueError("each proposed control must map to a pinned canonical document")
        for ref in refs:
            path = ref.get("path", "")
            if not re.fullmatch(r"spec/[a-z0-9-]+\.md", path):
                raise ValueError("unrecognized canonical source path")
            expected = "https://github.com/" + REPO + "/blob/" + revision + "/" + path
            if ref.get("source_url") != expected or ref.get("relationship") != "subject_area_only_not_verified_implementation":
                raise ValueError("floating or misleading standard reference")
    gates = data.get("release_gates", {})
    if not isinstance(gates, dict) or gates.get("sealed_e2ee", "").startswith("permitted") or gates.get("sensitive_research_processing", "").startswith("permitted") or gates.get("governmental_operations", "").startswith("permitted"):
        raise ValueError("sensitive release gates must fail closed")
    if not data.get("gaps"):
        raise ValueError("security assessment gaps must be explicit")
    return True

def main():
    path = Path(__file__).resolve().parents[1] / "docs/security/standard-crosswalk.json"
    validate(json.loads(path.read_text()))
    print("12 proposal-to-standard document links pinned; requirement mapping/assessment NOT complete")

if __name__ == "__main__":
    main()
