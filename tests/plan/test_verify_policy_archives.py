import hashlib
import tempfile
import unittest
from pathlib import Path

from scripts.verify_policy_archives import verify_external_sources


class ExternalOriginalChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.original = b"Original source bytes\n"
        self.path = self.root / "original.zip"
        self.path.write_bytes(self.original)
        self.entry = {
            "filename": "original.zip",
            "bytes": len(self.original),
            "sha256": hashlib.sha256(self.original).hexdigest(),
        }

    def tearDown(self):
        self.temp.cleanup()

    def run_case(self, *entries, require_all=False):
        return verify_external_sources({"external_materials": list(entries)}, self.root,
                                       require_all=require_all)

    def test_intact_original_succeeds(self):
        report = self.run_case(self.entry, require_all=True)
        self.assertTrue(report["all_verified"])
        self.assertEqual(report["failures"], 0)

    def test_changes_are_rejected(self):
        self.path.write_bytes(b"Tampered source\n")
        report = self.run_case(self.entry)
        self.assertEqual(report["counts"].get("mismatch"), 1)
        self.assertEqual(report["failures"], 1)

    def test_missing_can_be_reported_without_claiming_completion(self):
        self.path.unlink()
        report = self.run_case(self.entry)
        self.assertFalse(report["all_verified"])
        self.assertEqual(report["counts"].get("missing"), 1)
        self.assertEqual(report["failures"], 0)
        self.assertEqual(self.run_case(self.entry, require_all=True)["failures"], 1)

    def test_symlinks_are_rejected(self):
        link = self.root / "source-link.zip"
        link.symlink_to(self.path)
        bad = {**self.entry, "filename": link.name}
        report = self.run_case(bad)
        self.assertEqual(report["counts"].get("symlink_rejected"), 1)

    def test_path_traversal_is_rejected(self):
        bad = {**self.entry, "filename": "../original.zip"}
        report = self.run_case(bad)
        self.assertEqual(report["counts"].get("invalid_manifest_filename"), 1)

    def test_duplicate_paths_and_missing_hash_are_rejected(self):
        report = self.run_case(self.entry, self.entry)
        self.assertEqual(report["counts"].get("invalid_manifest_filename"), 1)
        self.assertEqual(self.run_case({"filename": "original.zip"})["failures"], 1)


if __name__ == "__main__":
    unittest.main()
