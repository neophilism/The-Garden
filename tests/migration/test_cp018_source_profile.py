"""Format profiling must not spill raw historical/source records into evidence."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
import zipfile

MODULE = Path(__file__).resolve().parents[2] / 'scripts' / 'profile_cp018_component_archives.py'
spec = importlib.util.spec_from_file_location('cp018_profiler', MODULE)
profiler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiler)


class ArchiveProfileContract(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.records = []
        for name in profiler.PARTS:
            filename = f'Not-From-Nowhere_Research-Corpus_v1-18_{name}_2026-10-10.zip'
            with zipfile.ZipFile(self.root / filename, 'w') as archive:
                archive.writestr('corpus_v1_18/private/source.json',
                                 json.dumps({'person_record': 'secret-person-identity', 'title': 'private-title'}))
                archive.writestr('corpus_v1_18/private/rows.ndjson',
                                 b'{"secret":"never-show-me"}\n{"secret":"still-private"}')
            data = (self.root / filename).read_bytes()
            self.records.append({'filename': filename, 'bytes': len(data),
                                 'sha256': hashlib.sha256(data).hexdigest()})
        self.manifest = {'external_materials': self.records}

    def tearDown(self):
        self.tmp.cleanup()

    def test_exact_originals_and_no_private_values(self):
        report = profiler.build_profile(self.root, self.manifest)
        self.assertEqual(report['total_members'], 8)
        self.assertEqual(report['total_ndjson_lines'], 8)
        self.assertEqual(report['component_profiles'][0]['small_json_root_types'], {'object': 1})
        serialized = json.dumps(report)
        for string in ('private-title', 'secret-person-identity', 'never-show-me', 'still-private'):
            self.assertNotIn(string, serialized)
        self.assertEqual(report['component_profiles'][0]['archive_members_extracted'], 0)

    def test_original_checksum_mismatch_rejected(self):
        self.manifest['external_materials'][0]['sha256'] = 'f' * 64
        with self.assertRaisesRegex(ValueError, 'hash or byte'):
            profiler.build_profile(self.root, self.manifest)

    def test_missing_member_rejected(self):
        self.manifest['external_materials'].pop()
        with self.assertRaisesRegex(ValueError, 'expected one'):
            profiler.build_profile(self.root, self.manifest)

    def test_unsafe_zip_path_rejected(self):
        item = self.records[0]
        with zipfile.ZipFile(self.root / item['filename'], 'w') as archive:
            archive.writestr('../escape.json', '{}')
        data = (self.root / item['filename']).read_bytes()
        item.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        with self.assertRaisesRegex(ValueError, 'unsafe archive member'):
            profiler.build_profile(self.root, self.manifest)

    def test_casefold_duplicate_rejected(self):
        item = self.records[0]
        with zipfile.ZipFile(self.root / item['filename'], 'w') as archive:
            archive.writestr('corpus_v1_18/private/Test.json', '{}')
            archive.writestr('corpus_v1_18/private/test.json', '{}')
        data = (self.root / item['filename']).read_bytes()
        item.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        with self.assertRaisesRegex(ValueError, 'unsafe archive member'):
            profiler.build_profile(self.root, self.manifest)

    def test_symlink_member_rejected(self):
        item = self.records[0]
        with zipfile.ZipFile(self.root / item['filename'], 'w') as archive:
            link = zipfile.ZipInfo('corpus_v1_18/private/alias.json')
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(link, '/sensitive-file')
        data = (self.root / item['filename']).read_bytes()
        item.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        with self.assertRaisesRegex(ValueError, 'unsafe archive member'):
            profiler.build_profile(self.root, self.manifest)


if __name__ == '__main__':
    unittest.main()
