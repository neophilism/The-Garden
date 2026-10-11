import hashlib
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from verify_baseline import validate_manifest, verify, inspect_core_database

class TestBaselineEvidence(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.rows = []
        for name in ("CORE", "EXPORTS", "SOURCES", "RECOVERY"):
            file = self.dir / (name + ".zip")
            with zipfile.ZipFile(file, "w") as archive:
                archive.writestr("corpus_v1_17/manifest.txt", name)
            self.rows.append({"artifact_id": name, "filename": file.name,
                "size_bytes": file.stat().st_size, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
        self.manifest = {"checkpoint": "CP-017", "corpus_version": "1.17",
                         "components": self.rows, "research_claims_verified": False}

    def test_clean_fixture(self):
        result = verify(self.manifest, self.dir, sqlite=False)
        self.assertEqual(len(result["components"]), 4)
        self.assertIs(result["historical_claims_verified"], False)

    def test_truncated_archive(self):
        file = self.dir / "CORE.zip"
        file.write_bytes(file.read_bytes()[:32])
        self.rows[0]["sha256"] = hashlib.sha256(file.read_bytes()).hexdigest()
        self.rows[0]["size_bytes"] = file.stat().st_size
        with self.assertRaises(zipfile.BadZipFile):
            verify(self.manifest, self.dir, sqlite=False)

    def test_tampered_archive(self):
        with (self.dir / "CORE.zip").open("ab") as out:
            out.write(b"tamper")
        with self.assertRaisesRegex(ValueError, "size mismatch"):
            verify(self.manifest, self.dir, sqlite=False)

    def test_missing_component(self):
        (self.dir / "SOURCES.zip").unlink()
        with self.assertRaisesRegex(ValueError, "component missing"):
            verify(self.manifest, self.dir, sqlite=False)

    def test_stale_version(self):
        self.manifest["corpus_version"] = "1.16"
        with self.assertRaisesRegex(ValueError, "stale"):
            validate_manifest(self.manifest)

    def test_duplicate_component(self):
        self.rows[3]["artifact_id"] = "CORE"
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate_manifest(self.manifest)

    def test_archive_not_scholarly_review(self):
        self.manifest["research_claims_verified"] = True
        with self.assertRaisesRegex(ValueError, "historical claims"):
            validate_manifest(self.manifest)

    def test_unsafe_filename(self):
        self.rows[0]["filename"] = "../CORE.zip"
        with self.assertRaisesRegex(ValueError, "unsafe"):
            validate_manifest(self.manifest)

    def test_read_only_canonical_sqlite(self):
        db = self.dir / "seed.db"
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE evidence (id INTEGER PRIMARY KEY)")
        con.commit()
        con.close()
        archive = self.dir / "sqlite.zip"
        with zipfile.ZipFile(archive, "w") as z:
            z.write(db, arcname="corpus_v1_17/research.sqlite")
        self.assertEqual(inspect_core_database(archive)["sqlite_integrity"], "ok")

    def test_recovery_not_substitute_for_core(self):
        with self.assertRaisesRegex(ValueError, "canonical SQLite"):
            inspect_core_database(self.dir / "RECOVERY.zip")

if __name__ == "__main__":
    unittest.main()
