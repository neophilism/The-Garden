"""Integrity guard for owner-authored policy and working research originals."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import verify_policy_sources as verifier


class PolicySourceTests(unittest.TestCase):
    def test_repository_originals_have_exact_bytes(self):
        with patch("sys.argv", ["verify_policy_sources.py", "--check"]):
            self.assertEqual(verifier.main(), 0)

    def test_public_policy_and_research_are_distinguished(self):
        manifest = json.loads(verifier.MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["manifest_version"], 4)
        self.assertEqual(manifest["repository_visibility_verified"], "public")
        self.assertTrue(manifest["publication"]["owner_authorized_policy_and_legislation_publication"])
        self.assertFalse(manifest["publication"]["historical_assertions_independently_verified"])
        self.assertFalse(manifest["publication"]["proposed_legislation_enacted"])
        self.assertEqual(len(manifest["source_files"]), 16)
        self.assertEqual(len({item["path"] for item in manifest["source_files"]}), 16)
        for item in manifest["source_files"]:
            self.assertEqual(len(item["sha256"]), 64)
            self.assertTrue(item["path"].startswith("policy/"))
        self.assertEqual(len(manifest["external_materials"]), 12)
        self.assertTrue(all(isinstance(x.get("bytes"), int) and len(x.get("sha256", "")) == 64 for x in manifest["external_materials"]))
        self.assertTrue(all(item["transfer_status"] == "not_in_repository" for item in manifest["external_materials"]))

    def test_modified_original_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            folder = root / "policy" / "legislation"
            folder.mkdir(parents=True)
            original = b"Original legislative source\n"
            target = folder / "draft.md"
            target.write_bytes(original + b"changed")
            manifest = {"source_files": [{
                "path": "policy/legislation/draft.md",
                "bytes": len(original),
                "sha256": hashlib.sha256(original).hexdigest()
            }]}
            metadata = root / "policy" / "SOURCE_MANIFEST.json"
            metadata.write_text(json.dumps(manifest), encoding="utf-8")
            with patch.object(verifier, "ROOT", root), patch.object(verifier, "MANIFEST", metadata):
                with patch("sys.argv", ["verify_policy_sources.py", "--check"]):
                    self.assertEqual(verifier.main(), 1)


if __name__ == "__main__":
    unittest.main()
