import json
import unittest
from unittest.mock import patch

from scripts import verify_policy_sources as verifier


class PolicySourcesTests(unittest.TestCase):
    def test_original_source_hashes(self):
        with patch("sys.argv", ["verify_policy_sources.py", "--check"]):
            self.assertEqual(verifier.main(), 0)

    def test_storage_is_not_publication(self):
        manifest = json.loads(verifier.MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["repository_visibility_verified"], "private")
        self.assertFalse(manifest["publication"]["web_publication_approved"])
        self.assertFalse(manifest["publication"]["historical_assertions_independently_verified"])
        self.assertEqual(len(manifest["source_files"]), 16)
        for source in manifest["source_files"]:
            self.assertTrue(source["path"].startswith("policy/"))
            self.assertEqual(len(source["sha256"]), 64)
        self.assertTrue(manifest["external_materials"])
        self.assertTrue(all(x["transfer_status"] == "not_in_repository" for x in manifest["external_materials"]))


if __name__ == "__main__":
    unittest.main()
