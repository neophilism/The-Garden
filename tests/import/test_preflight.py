"""Controlled regression fixtures for read-only corpus planning diagnostics."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from staging_fixture import fixture, contract, stage, ROOT

SPEC = importlib.util.spec_from_file_location('preflight', ROOT / 'services/workers/import/preflight.py')
preflight = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preflight)


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.config = fixture(self.root, count=7)
        self.path = Path(self.config['source_path'])

    def tearDown(self):
        self.tmp.cleanup()

    def scan(self, check=lambda: None):
        return preflight.profile_source(str(self.path), self.config['mapping'], self.config['inventory'], check)

    def rebuild(self):
        self.config = contract(self.root, self.path)

    def test_counts_duplicates_inherited_status_and_no_raw_values(self):
        before = self.path.read_bytes()
        result = self.scan()
        self.assertEqual(result['rows_scanned'], 7)
        self.assertEqual(result['tables_scanned'], 2)
        self.assertEqual(result['rows_staged'], 0)
        self.assertEqual(result['historicalReview'], 'unreviewed')
        self.assertFalse(result['publiclyAccessible'])
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(list((self.root / 'private-staging').iterdir()), [])
        serialized = json.dumps(result)
        for private_value in ['source only; not verified', 'duplicate', 'sqlite_rowid', 'base64']:
            self.assertNotIn(private_value, serialized)
        # Mixed INTEGER/TEXT identifiers remain observable as different classes.
        counts = result['tables'][1]['columns']['unit_id']['storage_classes']
        self.assertEqual(counts, {'text': 4, 'integer': 3})

    def test_exact_payload_measurement_uses_real_envelopes(self):
        result = self.scan()
        source = stage.Source(str(self.path), self.config['source_ref']['sha256'], self.path.stat().st_size)
        reader = stage.SQLiteRows(source, self.config['mapping'], self.config['inventory'], lambda _: None)
        try:
            sizes = [len(stage.canonical(stage.envelope(source.expected,t,loc,cells,issues)).encode())
                     for t in self.config['mapping']['tables'] for _,loc,cells,issues in reader.rows(t,None)]
            self.assertEqual(result['serialized_payload_bytes'], sum(sizes))
            self.assertEqual(result['max_serialized_row_bytes'], max(sizes))
            self.assertGreater(result['serialized_payload_bytes'], 0)
        finally:
            reader.close(); source.close()

    def test_invalid_text_null_blob_and_binary64(self):
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE specimens SET value=CAST(X'ff00' AS TEXT) WHERE rowid=-10")
            db.execute("UPDATE specimens SET value=X'0001' WHERE rowid=-9")
            db.execute('UPDATE specimens SET value=NULL WHERE rowid=-8')
            db.execute('UPDATE specimens SET value=0.125 WHERE rowid=-7')
        self.rebuild()
        result = self.scan()
        self.assertEqual(result['invalid_text_cells'], 1)
        self.assertEqual(result['storage_classes']['blob'], 1)
        self.assertEqual(result['storage_classes']['real'], 1)
        self.assertEqual(result['storage_classes']['null'], 1)
        self.assertEqual(result['tables'][1]['columns']['value']['invalid_text_cells'], 1)

    def test_source_change_hash_mismatch_rejected(self):
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE specimens SET id='different'")
        with self.assertRaisesRegex(preflight.stage.Rejected, 'source-hash-mismatch'):
            self.scan()

    def test_schema_and_count_drift_rejected(self):
        for field, value in [('source_rows', 8), ('schema_sha256', '0'*64)]:
            config = copy.deepcopy(self.config)
            config['mapping']['tables'][1][field] = value
            if field == 'source_rows':
                config['mapping']['source_row_count'] = 8
            with self.assertRaises(preflight.stage.Rejected):
                preflight.profile_source(str(self.path),config['mapping'],config['inventory'])

    def test_live_sidecar_rejected(self):
        Path(str(self.path)+'-wal').touch()
        with self.assertRaisesRegex(preflight.stage.Rejected, 'live-source-sidecar'):
            self.scan()

    def test_cancellation_produces_no_report_or_staging(self):
        calls = 0
        def cancel():
            nonlocal calls
            calls += 1
            if calls == 4:
                raise RuntimeError('cancelled')
        with self.assertRaisesRegex(RuntimeError, 'cancelled'):
            self.scan(cancel)
        self.assertEqual(list((self.root / 'private-staging').iterdir()), [])

    def test_cell_ceiling_rejects_without_partial_report(self):
        with sqlite3.connect(self.path) as db:
            db.execute('UPDATE specimens SET value=zeroblob(?) WHERE rowid=-10', (stage.MAX_CELL+1,))
        self.rebuild()
        with self.assertRaisesRegex(preflight.stage.Rejected, 'cell-size-limit'):
            self.scan()

    def test_mutation_during_scan_is_detected(self):
        calls = 0
        def mutate():
            nonlocal calls
            calls += 1
            if calls == 4:
                os.utime(self.path, None)
        with self.assertRaisesRegex(preflight.stage.Rejected, 'source-changed'):
            self.scan(mutate)

    def test_report_is_private_exclusive_and_contains_no_rows(self):
        output = self.root / 'report.json'
        result = self.scan()
        preflight.private_report(output, result)
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        self.assertEqual(json.loads(output.read_text()), result)
        with self.assertRaises(FileExistsError):
            preflight.private_report(output, result)
        self.assertEqual(json.loads(output.read_text()), result)

    def test_unsafe_report_directory_and_symlink_rejected(self):
        public = self.root/'public'; public.mkdir(mode=0o755)
        with self.assertRaises(preflight.stage.Rejected):
            preflight.private_report(public/'report.json', {})
        output = self.root/'report.json'; output.symlink_to(self.path)
        original = hashlib.sha256(self.path.read_bytes()).hexdigest()
        with self.assertRaises(FileExistsError):
            preflight.private_report(output, {})
        self.assertEqual(hashlib.sha256(self.path.read_bytes()).hexdigest(), original)

    def test_cli_is_pinned_and_fails_without_source_values_or_traceback(self):
        output = self.root/'report.json'
        result = subprocess.run(['/usr/bin/python3','-I',str(ROOT/'services/workers/import/preflight.py'),
                                 '--source',str(self.path),'--report',str(output)],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
        self.assertEqual(json.loads(result.stdout), {'status':'preflight-rejected','rows_staged':0})
        self.assertEqual(result.stderr,'')
        self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
