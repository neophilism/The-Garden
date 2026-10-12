import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import verify_policy_sources as verifier

class PolicySourcesTests(unittest.TestCase):
    def test_registered_sources_and_digest(self):
        with patch("sys.argv", ["verify_policy_sources.py", "--check"]):
            self.assertEqual(verifier.main(), 0)

    def test_manifest_declares_no_public_archive(self):
        data = json.loads(verifier.MANIFEST.read_text(encoding="utf-8"))
        self.assertFalse(data["private_materials"]["originals_in_git"])
        self.assertFalse(data["private_materials"]["publication_approved"])
        for item in data["source_files"]:
            self.assertFalse(item["path"].endswith((".docx", ".zip", ".sqlite")))
            self.assertTrue(item["path"].startswith("policy/"))

if __name__ == "__main__":
    unittest.main()
