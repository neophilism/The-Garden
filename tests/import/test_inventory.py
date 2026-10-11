import hashlib
import importlib.util
import io
import json
from pathlib import Path
import random
import sqlite3
import stat
import struct
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('garden_inventory', ROOT / 'services/workers/import/inspect.py')
inventory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inventory)

def archive(entries, compression=zipfile.ZIP_STORED):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', compression=compression) as handle:
        for name, content in entries:
            handle.writestr(name, content)
    return stream.getvalue()

def database(sql='CREATE TABLE synthetic (id INTEGER, note TEXT);'):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'fixture.sqlite'
        connection = sqlite3.connect(path)
        connection.executescript(sql)
        connection.commit()
        connection.close()
        return path.read_bytes()

class InventoryTests(unittest.TestCase):
    def check_original(self, data):
        result = inventory.inspect(data)
        self.assertEqual(result['sha256'], hashlib.sha256(data).hexdigest())
        self.assertEqual(result['size'], len(data))
        self.assertEqual(result['disposition'], 'quarantined')
        return result

    def test_literal_text_and_sql_are_not_executed(self):
        data = b'DROP DATABASE private; curl https://never-request.invalid; $(touch /tmp/no)'
        result = self.check_original(data)
        self.assertEqual(result['detectedType'], 'text/plain')
        self.assertTrue(result['inventoryComplete'])
        self.assertEqual(result['members'], [])

    def test_valid_zip_exact_member_checksums(self):
        entries = [('folder/', b''), ('folder/candidate.txt', b'not an adjudicated historical claim'), ('empty.txt', b'')]
        data = archive(entries)
        result = self.check_original(data)
        self.assertTrue(result['inventoryComplete'])
        self.assertEqual(len(result['members']), 2)
        for member, (name, content) in zip(result['members'], entries[1:]):
            self.assertEqual(member['path'], name)
            self.assertEqual(member['sha256'], hashlib.sha256(content).hexdigest())
            self.assertEqual(member['size'], len(content))
            self.assertEqual(member['inspection'], 'bytes-only')

    def test_path_traversals_and_cross_platform_paths(self):
        for name in ['../escape', '/absolute', 'a/../../escape', 'a\\escape', 'C:/drive', 'a//b', './item', 'a/./b', 'control\n.txt']:
            with self.subTest(name=name):
                result = self.check_original(archive([(name, b'x')]))
                self.assertIn('archive-unsafe-path-or-type', result['findings'])
                self.assertFalse(result['inventoryComplete'])

    def test_unicode_and_case_aliases_rejected(self):
        for names in [('Item.txt', 'item.txt'), ('caf\u00e9.txt', 'cafe\u0301.txt'), ('STRASSE', 'stra\u00dfe')]:
            result = self.check_original(archive([(name, b'x') for name in names]))
            self.assertIn('archive-unsafe-path-or-type', result['findings'])

    def test_symlink_and_device_entries_rejected(self):
        for mode in [stat.S_IFLNK, stat.S_IFCHR, stat.S_IFBLK, stat.S_IFSOCK]:
            item = zipfile.ZipInfo('unsafe')
            item.create_system = 3
            item.external_attr = (mode | 0o777) << 16
            result = self.check_original(archive([(item, b'../elsewhere')]))
            self.assertIn('archive-unsafe-path-or-type', result['findings'])

    def test_compression_bomb_rejected_before_expansion(self):
        data = archive([('bomb.txt', b'A' * 1000000)], zipfile.ZIP_DEFLATED)
        result = self.check_original(data)
        self.assertIn('archive-expansion-limit', result['findings'])
        self.assertEqual(result['members'], [])

    def test_member_metadata_quota(self):
        data = bytearray(archive([('too-big.txt', b'x')]))
        central = data.index(b'PK\x01\x02')
        struct.pack_into('<I', data, central + 24, inventory.MAX_MEMBER + 1)
        result = self.check_original(data)
        self.assertIn('archive-expansion-limit', result['findings'])

    def test_entry_count_quota(self):
        result = self.check_original(archive([(str(i), b'') for i in range(257)]))
        self.assertIn('archive-entry-limit', result['findings'])

    def test_total_expansion_quota(self):
        # Metadata ratio below the quota; cumulative actual bytes still bounded.
        payload = (random.Random(42).randbytes(16384) + b'\x00' * 32768) * 128
        data = archive([(str(i), payload) for i in range(3)], zipfile.ZIP_DEFLATED)
        self.assertLess(len(data), inventory.MAX_INPUT)
        result = self.check_original(data)
        self.assertIn('archive-expansion-limit', result['findings'])
        self.assertFalse(result['inventoryComplete'])
        self.assertEqual(len(result['members']), 2)

    def test_truncated_zip_preserves_original_checksum(self):
        data = archive([('candidate.txt', b'x')])[:-12]
        result = self.check_original(data)
        self.assertIn('malformed-or-uninspectable', result['findings'])
        self.assertFalse(result['inventoryComplete'])

    def test_crc_corruption_rejected(self):
        data = bytearray(archive([('candidate.txt', b'checksum-target')]))
        data[data.index(b'checksum-target')] ^= 1
        result = self.check_original(data)
        self.assertIn('malformed-or-uninspectable', result['findings'])
        self.assertFalse(result['inventoryComplete'])

    def test_encrypted_or_unsupported_method(self):
        for offset, value in [(8, 99), (6, 1)]:
            data = bytearray(archive([('item.txt', b'x')]))
            central = data.index(b'PK\x01\x02')
            struct.pack_into('<H', data, offset, value)
            struct.pack_into('<H', data, central + offset + 2, value)
            result = self.check_original(data)
            self.assertIn('archive-encryption-or-method-unsupported', result['findings'])

    def test_nested_zip_not_recursed(self):
        data = archive([('inner.zip', archive([('../unsafe', b'x')]))])
        result = self.check_original(data)
        self.assertEqual(len(result['members']), 1)
        self.assertIn('nested-archive-not-inspected', result['findings'])
        self.assertEqual(result['members'][0]['inspection'], 'bytes-only')

    def test_active_macro_or_script_never_executed(self):
        for name in ['word/vbaProject.bin', 'code.js', 'sheet.xlsm', 'script.ps1']:
            result = self.check_original(archive([(name, b'not executed')]))
            self.assertIn('active-content-unreviewed', result['findings'])

    def test_xml_external_entity_not_parsed(self):
        xml = b'<!DOCTYPE data [<!ENTITY x SYSTEM "https://never-request.invalid/">]><data>&x;</data>'
        result = self.check_original(xml)
        self.assertEqual(result['detectedType'], 'application/xml')
        self.assertFalse(result['inventoryComplete'])
        self.assertIn('format-parser-unavailable', result['findings'])

    def test_sqlite_readonly_schema_inventory(self):
        data = database('CREATE TABLE synthetic (note TEXT); INSERT INTO synthetic VALUES ("private-not-exported"); CREATE VIEW dangerous AS SELECT load_extension("https://never-request.invalid");')
        result = self.check_original(data)
        self.assertTrue(result['inventoryComplete'])
        self.assertEqual(result['database']['userRowsRead'], 0)
        self.assertNotIn('private-not-exported', json.dumps(result))
        self.assertNotIn('never-request.invalid', json.dumps(result))
        self.assertEqual(result['database']['schemaObjects'], [{'kind': 'view', 'name': 'dangerous'}, {'kind': 'table', 'name': 'synthetic'}])

    def test_truncated_sqlite_fails_closed(self):
        data = database()
        for broken in [b'SQLite format 3\x00', data[:100], data[:len(data)//2], data[:100]+b'X'*200]:
            result = self.check_original(broken)
            self.assertFalse(result['inventoryComplete'])
            self.assertIsNone(result['database'])
            self.assertTrue(result['findings'])

    def test_schema_object_limit(self):
        data = database(';'.join(f'CREATE TABLE t{i}(id INTEGER)' for i in range(257)))
        result = self.check_original(data)
        self.assertIn('sqlite-schema-limit', result['findings'])

    def test_json_duplicate_keys_nonfinite_and_truncation_rejected(self):
        for data in [b'{"x":1,"x":2}', b'[NaN]', b'[Infinity]', b'{"x":', b'[' * 2000]:
            result = self.check_original(data)
            self.assertFalse(result['inventoryComplete'])
            self.assertIn('malformed-or-uninspectable', result['findings'])

    def test_valid_json_is_inventory_not_claim_validation(self):
        result = self.check_original(b'{"verified":true,"nation":"untrusted assertion"}')
        self.assertTrue(result['inventoryComplete'])
        self.assertEqual(result['disposition'], 'quarantined')
        self.assertNotIn('nation', json.dumps(result))

    def test_unknown_formats_remain_uninspected(self):
        for data in [b'MZscript', b'%PDF-unparsed', b'\x89PNG\r\n\x1a\ntruncated', b'\x00\xff']:
            result = self.check_original(data)
            self.assertIn('format-parser-unavailable', result['findings'])
            self.assertFalse(result['inventoryComplete'])

    def test_input_quota_and_empty(self):
        for data in [b'', b'x' * (inventory.MAX_INPUT + 1)]:
            result = self.check_original(data)
            self.assertIn('input-size-limit', result['findings'])

if __name__ == '__main__':
    unittest.main()
