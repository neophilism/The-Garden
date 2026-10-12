import base64
import copy
import hashlib
import json
import os
from pathlib import Path
import signal
import sqlite3
import struct
import subprocess
import sys
import tempfile
import unittest

# unittest -I discover makes the test directory importable.
from staging_fixture import ROOT, contract, fixture, stage


class StagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config = fixture(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def run_stage(self, gate=lambda phase: True):
        return stage.stage(self.config, gate)

    def database(self):
        return sqlite3.connect(self.root / 'private-staging/staging.sqlite')

    def rows(self):
        with self.database() as db:
            return [json.loads(row[0]) for row in db.execute('SELECT payload FROM staging_rows ORDER BY locator')]

    def status(self):
        with self.database() as db:
            return db.execute('SELECT state FROM status').fetchone()[0]

    def test_reconciliation_and_replay_preserve_all_duplicates(self):
        original = Path(self.config['source_path']).read_bytes()
        first = self.run_stage()
        before = self.rows()
        second = self.run_stage()
        self.assertEqual(before, self.rows())
        self.assertEqual(len(before), 600)
        self.assertEqual(first['rows'], 600)
        self.assertNotEqual(first['audit_head'], second['audit_head'])
        self.assertEqual(before[0]['locator']['sqlite_rowid'], '-10')
        self.assertEqual(before[10]['locator']['sqlite_rowid'], '0')
        self.assertFalse(second['publicationApproved'])
        self.assertEqual(second['historicalReview'], 'unreviewed')
        self.assertEqual(Path(self.config['source_path']).read_bytes(), original)
        with self.database() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM batches').fetchone()[0], 3)
            self.assertEqual(db.execute("SELECT rows FROM table_state WHERE name='empty_table'").fetchone()[0], 0)
            binding = json.loads(db.execute('SELECT payload FROM binding').fetchone()[0])
        self.assertEqual(binding['mapping']['open_exceptions'], self.config['mapping']['open_exceptions'])
        self.assertEqual(binding['mapping']['tables'][1]['unresolved_reference_columns'], ['unit_id'])

    def test_typed_roundtrip_no_json_status_or_identifier_coercion(self):
        source = Path(self.config['source_path'])
        with sqlite3.connect(source) as db:
            db.execute('DELETE FROM specimens')
            values = [None, '', 'e\u0301\0é🙂', b'\0\xff', -(2**63), 2**63-1, 1.25,
                      float('inf'), '{"a":1,"a":2}', '{bad', '001', 1, '1']
            db.executemany('INSERT INTO specimens VALUES(?,?,?,?)', ((v, v, v, 'verified') for v in values))
            db.execute("INSERT INTO specimens VALUES(NULL,NULL,CAST(x'80ff' AS TEXT),'verified')")
        self.config = contract(self.root, source)
        self.run_stage()
        rows = self.rows()
        cells = [r['cells'][2] for r in rows]
        self.assertEqual(cells[0]['storage'], 'null')
        for n in (1,2,8,9,10,12):
            self.assertEqual(base64.b64decode(cells[n]['base64']).decode(), values[n])
        self.assertEqual(base64.b64decode(cells[3]['base64']), values[3])
        for n in (4,5,11):
            self.assertEqual(cells[n]['decimal'], str(values[n]))
        for n in (6,7):
            self.assertEqual(bytes.fromhex(cells[n]['ieee754_be']), struct.pack('>d', values[n]))
        self.assertEqual(cells[-1]['decoding'], 'invalid-retained')
        self.assertEqual(base64.b64decode(cells[-1]['base64']), b'\x80\xff')
        self.assertEqual(rows[-1]['issues'], [{'column':'value','code':'invalid-text-encoding'}])
        self.assertTrue(all(r['historicalReview']=='unreviewed' and r['normalization']=='not-attempted' for r in rows))

    def test_utf16_exact_encoding_bytes(self):
        source = self.root/'utf16.sqlite'
        with sqlite3.connect(source) as db:
            db.execute("PRAGMA encoding='UTF-16le'")
            db.execute('CREATE TABLE t(value TEXT)')
            db.execute('INSERT INTO t VALUES(?)', ('e\u0301🙂\0end',))
        self.config = contract(self.root, source)
        self.run_stage()
        cell = self.rows()[0]['cells'][0]
        self.assertEqual(cell['encoding'], 'utf-16-le')
        self.assertEqual(base64.b64decode(cell['base64']), 'e\u0301🙂\0end'.encode('utf-16-le'))

    def test_denied_before_read_has_no_staging_artifact(self):
        with self.assertRaisesRegex(stage.Rejected, 'authorization-denied'):
            self.run_stage(lambda phase: False)
        self.assertFalse((self.root/'private-staging/staging.sqlite').exists())

    def test_denial_at_commit_rolls_back_rows_checkpoint_and_batch(self):
        commits = 0
        def gate(phase):
            nonlocal commits
            if phase == 'commit-batch':
                commits += 1
                return commits != 2
            return True
        with self.assertRaises(stage.Rejected):
            self.run_stage(gate)
        self.assertEqual(len(self.rows()), 256)
        self.assertEqual(self.status(), 'failed-quarantined')
        with self.database() as db:
            self.assertEqual(db.execute('SELECT sum(rows) FROM table_state').fetchone()[0], 256)
            self.assertEqual(db.execute('SELECT count(*) FROM batches').fetchone()[0], 1)
        self.run_stage()
        self.assertEqual(len(self.rows()), 600)

    def test_sigkill_inside_transaction_recovers(self):
        process = subprocess.Popen([sys.executable, '-I', str(ROOT/'services/workers/import/stage.py')],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            process.stdin.write(json.dumps(self.config)+'\n'); process.stdin.flush()
            commits = 0
            while True:
                message = json.loads(process.stdout.readline())
                self.assertEqual(message['type'], 'authorize')
                if message['phase'] == 'commit-batch':
                    commits += 1
                    if commits == 2:
                        process.kill(); process.wait(timeout=10)
                        break
                process.stdin.write('{"allowed":true,"requestId":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"}\n'); process.stdin.flush()
        finally:
            if process.poll() is None:
                process.kill(); process.wait(timeout=10)
            process.stdin.close(); process.stdout.close(); process.stderr.close()
        self.assertEqual(len(self.rows()), 256)
        self.assertEqual(self.status(), 'incomplete-quarantined')
        self.run_stage()
        self.assertEqual(len(self.rows()), 600)

    def test_hash_mismatch_and_changed_source_fail_closed(self):
        self.config['source_ref']['sha256'] = 'f'*64
        self.config['mapping']['source_database_sha256'] = 'f'*64
        with self.assertRaisesRegex(stage.Rejected, 'source-hash-mismatch'):
            self.run_stage()
        self.assertEqual(self.rows(), [])
        self.assertEqual(self.status(), 'failed-quarantined')

    def test_same_source_namespace_cannot_change_mapping_or_workspace(self):
        self.run_stage()
        original = self.rows()
        for key in ('workspace_id', 'mapping'):
            saved = copy.deepcopy(self.config)
            if key == 'workspace_id':
                self.config[key] = 'different-workspace'
            else:
                self.config[key]['tables'][0]['raw_destination'] = 'new-destination'
            with self.assertRaisesRegex(stage.Rejected, 'binding-conflict'):
                self.run_stage()
            self.assertEqual(self.rows(), original)
            self.config = saved

    def test_new_run_same_artifact_reuses_immutable_rows(self):
        self.run_stage()
        self.config['run_id'] = 'dddddddd-dddd-4ddd-dddd-dddddddddddd'
        self.config['subject_id'] = 'another-authorized-operator'
        self.run_stage()
        self.assertEqual(len(self.rows()), 600)

    def test_source_change_during_extraction_prevents_commit(self):
        changed = False
        def gate(phase):
            nonlocal changed
            if phase == 'commit-batch' and not changed:
                changed = True
                os.utime(self.config['source_path'], None)
            return True
        with self.assertRaisesRegex(stage.Rejected, 'source-changed'):
            self.run_stage(gate)
        self.assertEqual(self.rows(), [])

    def test_cell_limit_rejects_instead_of_truncating(self):
        with sqlite3.connect(self.config['source_path']) as db:
            db.execute('INSERT INTO specimens VALUES(NULL,NULL,?,NULL)', (b'x'*(stage.MAX_CELL+1),))
        self.config = contract(self.root, self.config['source_path'])
        with self.assertRaisesRegex(stage.Rejected, 'cell-size-limit'):
            self.run_stage()
        self.assertEqual(self.status(), 'failed-quarantined')
        self.assertLess(len(self.rows()), 601)

    def test_schema_and_count_drift_no_rows_written(self):
        self.config['mapping']['tables'][1]['source_rows'] += 1
        self.config['mapping']['source_row_count'] += 1
        with self.assertRaisesRegex(stage.Rejected, 'row-count-drift'):
            self.run_stage()
        self.assertEqual(self.rows(), [])

    def test_schema_drift_with_consistent_contract_hashes_rejected(self):
        self.config['inventory']['tables'][1]['sql'] += ' /* fabricated */'
        self.config['mapping']['tables'][1]['schema_sha256'] = stage.schema_digest(
            {k:self.config['inventory']['tables'][1][k] for k in ('table','sql','columns')})
        self.config['mapping']['source_schema_sha256'] = stage.schema_digest(
            [{k:t[k] for k in ('table','sql','columns')} for t in self.config['inventory']['tables']])
        with self.assertRaisesRegex(stage.Rejected, 'schema-drift'):
            self.run_stage()

    def test_schema_does_not_execute_trigger_or_view(self):
        with sqlite3.connect(self.config['source_path']) as db:
            db.execute("CREATE VIEW evil AS SELECT load_extension('/not/allowed')")
            db.execute("CREATE TRIGGER evil_trigger AFTER INSERT ON specimens BEGIN DELETE FROM specimens; END")
        self.config = contract(self.root, self.config['source_path'])
        self.run_stage()
        self.assertEqual(len(self.rows()), 600)

    def test_nonrowid_and_fully_shadowed_tables_rejected(self):
        for ddl in ('CREATE TABLE t(id TEXT PRIMARY KEY) WITHOUT ROWID',
                    'CREATE TABLE t(rowid,_rowid_,oid)'):
            with tempfile.TemporaryDirectory() as directory:
                config = fixture(directory, ddl=ddl)
                with self.assertRaises(stage.Rejected):
                    stage.stage(config, lambda p:True)

    def test_partial_rowid_shadowing_selects_real_alias(self):
        with tempfile.TemporaryDirectory() as directory:
            config = fixture(directory, ddl='CREATE TABLE t(rowid TEXT, value TEXT)')
            with sqlite3.connect(config['source_path']) as db:
                db.execute("INSERT INTO t(_rowid_,rowid,value) VALUES(-17,'not-a-locator','synthetic')")
            config = contract(directory, config['source_path'])
            stage.stage(config, lambda p:True)
            with sqlite3.connect(Path(directory)/'private-staging/staging.sqlite') as db:
                self.assertEqual(db.execute('SELECT locator FROM staging_rows').fetchone()[0], -17)

    def test_sidecar_and_symlink_and_public_directory_denied(self):
        for suffix in ('-wal','-shm','-journal'):
            sidecar = Path(self.config['source_path']+suffix); sidecar.touch()
            with self.assertRaisesRegex(stage.Rejected, 'live-source-sidecar'):
                self.run_stage()
            sidecar.unlink()
        os.chmod(self.root/'private-staging', 0o755)
        with self.assertRaisesRegex(stage.Rejected, 'private-staging-directory-required'):
            self.run_stage()
        os.chmod(self.root/'private-staging', 0o700)
        link = self.root/'symlink.sqlite'; link.symlink_to(self.config['source_path'])
        self.config['source_path'] = str(link)
        with self.assertRaisesRegex(stage.Rejected, 'unsafe-source-path'):
            self.run_stage()

    def test_mutated_row_checkpoint_batch_or_audit_is_quarantined(self):
        for sql in ("UPDATE staging_rows SET payload='{}' WHERE locator=0",
                    "UPDATE staging_rows SET source_sha256='wrong' WHERE locator=0",
                    "UPDATE table_state SET checkpoint=99 WHERE name='specimens'",
                    "UPDATE batches SET digest='forged' WHERE sequence=1",
                    "UPDATE batches SET attempt='forged' WHERE sequence=1",
                    "UPDATE audit SET payload='{}' WHERE sequence=1"):
            with self.subTest(sql=sql), tempfile.TemporaryDirectory() as directory:
                config = fixture(directory)
                stage.stage(config, lambda p:True)
                with sqlite3.connect(Path(directory)/'private-staging/staging.sqlite') as db:
                    db.execute(sql)
                with self.assertRaises(stage.Rejected):
                    stage.stage(config, lambda p:True)

    def test_staging_schema_drift_is_rejected(self):
        self.run_stage()
        with self.database() as db:
            db.execute('CREATE TRIGGER mutate AFTER INSERT ON audit BEGIN DELETE FROM staging_rows; END')
        with self.assertRaisesRegex(stage.Rejected,'staging-schema-drift'):
            self.run_stage()
        self.assertEqual(len(self.rows()),600)

    def test_malformed_sqlite_is_not_imported(self):
        path = Path(self.config['source_path'])
        path.write_bytes(b'SQLite format 3\0'+b'broken'*100)
        self.config['source_ref'].update(sha256=hashlib.sha256(path.read_bytes()).hexdigest(),size=path.stat().st_size)
        self.config['mapping'].update(source_database_sha256=self.config['source_ref']['sha256'],source_database_bytes=path.stat().st_size)
        with self.assertRaises(stage.Rejected):
            self.run_stage()
        self.assertEqual(self.rows(), [])

    def test_audit_failure_rolls_back_batch(self):
        from unittest.mock import patch
        original = stage.Store.event
        def fail_event(store, attempt, run, kind, details, authorization_request_id=None):
            if kind == 'batch-committed':
                raise OSError('synthetic disk failure')
            return original(store, attempt, run, kind, details, authorization_request_id)
        with patch.object(stage.Store, 'event', fail_event), self.assertRaises(stage.Rejected):
            self.run_stage()
        self.assertEqual(self.rows(), [])

    def export_fixture(self):
        header = {'format':'garden-typed-export-v1',
                  'schema_sha256':self.config['mapping']['source_schema_sha256'],
                  'origin':'synthetic export; original rowids unavailable'}
        records = []
        for n in range(600):
            cells = []
            for column, value in [('id',b'duplicate'),('unit_id',b'001'),('value',b'{bad'),('review_state',b'verified')]:
                cell, _ = stage.typed_cell(b'text',value,'utf-8')
                cells.append({'column':column,**cell})
            records.append({'table':'specimens','cells':cells})
        path = self.root/'synthetic.ndjson'
        path.write_text('\n'.join(stage.canonical(r) for r in [header]+records)+'\n')
        self.config.update(format='typed-ndjson',source_path=str(path))
        self.rehash_export()
        return path

    def rehash_export(self):
        path = Path(self.config['source_path'])
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        self.config['source_ref'].update(sha256=sha,size=path.stat().st_size)
        self.config['mapping'].update(source_database_sha256=sha,source_database_bytes=path.stat().st_size)

    def test_typed_export_has_artifact_coordinate_not_invented_sqlite_rowid(self):
        path = self.export_fixture()
        original = path.read_bytes()
        self.run_stage(); self.run_stage()
        rows = self.rows()
        self.assertEqual(len(rows),600)
        self.assertEqual(rows[0]['locator'],{'kind':'artifact-byte-offset','byte_offset':str(original.index(b'\n')+1)})
        self.assertNotIn('sqlite_rowid',str(rows))
        self.assertEqual(path.read_bytes(),original)

    def test_export_interruption_and_resume(self):
        self.export_fixture()
        seen = 0
        def gate(phase):
            nonlocal seen
            if phase=='commit-batch':
                seen += 1
                return seen != 2
            return True
        with self.assertRaises(stage.Rejected):
            self.run_stage(gate)
        self.assertEqual(len(self.rows()),256)
        self.run_stage()
        self.assertEqual(len(self.rows()),600)

    def test_export_invalid_cell_truncation_and_duplicate_json_keys(self):
        path = self.export_fixture()
        original = path.read_bytes()
        for data in (original[:-1], original.replace(b'"storage":"text"',b'"storage":"number"',1),
                     original.replace(b'"table":"specimens"',b'"table":"specimens","table":"specimens"',1),
                     original.replace(b'"size":9',b'"size":8',1)):
            path.write_bytes(data); self.rehash_export()
            with self.assertRaises(stage.Rejected):
                self.run_stage()
            self.assertEqual(self.rows(),[])

    def test_same_key_conflict_retains_existing_row(self):
        def gate(phase):
            if phase=='table':
                with self.database() as db:
                    db.execute('INSERT OR IGNORE INTO staging_rows VALUES(?,?,?,?,?)',
                               (self.config['source_ref']['sha256'],'specimens',-10,'conflicting-preserved-bytes','x'))
            return True
        with self.assertRaisesRegex(stage.Rejected,'same-key-conflict'):
            self.run_stage(gate)
        with self.database() as db:
            self.assertEqual(db.execute('SELECT payload FROM staging_rows').fetchone()[0],'conflicting-preserved-bytes')

    def test_concurrent_writer_fails_without_mutating_existing_run(self):
        import fcntl
        lock = os.open(self.root/'private-staging/lock',os.O_CREAT|os.O_RDWR,0o600)
        try:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            with self.assertRaises(stage.Rejected):
                self.run_stage()
            self.assertFalse((self.root/'private-staging/staging.sqlite').exists())
        finally:
            os.close(lock)

    def test_empty_preinitialization_file_recovers(self):
        os.close(os.open(self.root/'private-staging/staging.sqlite',os.O_CREAT|os.O_WRONLY,0o600))
        self.run_stage()
        self.assertEqual(len(self.rows()),600)

    def test_source_inside_staging_directory_is_never_opened_for_writes(self):
        for name in ('staging.sqlite','staging.sqlite-journal','lock','original.sqlite'):
            with tempfile.TemporaryDirectory() as directory:
                config = fixture(directory)
                original = Path(config['source_path']).read_bytes()
                overlap = Path(config['staging_directory'])/name
                Path(config['source_path']).rename(overlap)
                config['source_path'] = str(overlap)
                with self.assertRaisesRegex(stage.Rejected,'source-output-overlap'):
                    stage.stage(config,lambda p:True)
                self.assertEqual(overlap.read_bytes(),original)


if __name__ == '__main__':
    unittest.main()
