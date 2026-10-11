import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('migration_mapping', ROOT / 'scripts/validate_migration_map.py')
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)

class MappingTests(unittest.TestCase):
    def setUp(self):
        self.raw = (ROOT / 'docs/migration/source-schema-inventory.json').read_bytes()
        self.source = json.loads(self.raw)
        self.mapping = json.loads((ROOT / 'docs/migration/migration-map.json').read_text())
        self.disposition = json.loads((ROOT / 'docs/migration/table-disposition.json').read_text())

    def errors(self):
        return validator.validate(self.mapping, self.source, self.disposition, self.raw)

    def table(self, name):
        return next(t for t in self.mapping['tables'] if t['source_table'] == name)

    def test_complete_mapping_and_source_totals(self):
        self.assertEqual(self.errors(), [])
        self.assertEqual(len(self.mapping['tables']), 106)
        self.assertEqual(sum(t['source_rows'] for t in self.mapping['tables']), 923292)

    def test_missing_table_even_with_adjusted_total(self):
        self.mapping['tables'].pop()
        self.mapping['table_count'] = 105
        self.assertTrue(self.errors())

    def test_duplicate_table_cannot_replace_missing_table(self):
        self.mapping['tables'][-1] = copy.deepcopy(self.mapping['tables'][0])
        self.assertTrue(any('duplicat' in e for e in self.errors()))

    def test_duplicate_mapping_id(self):
        self.mapping['tables'][1]['id'] = self.mapping['tables'][0]['id']
        self.assertIn('duplicate mapping ID', self.errors())

    def test_unknown_table(self):
        self.mapping['tables'][0]['source_table'] = 'not_in_original'
        self.assertTrue(self.errors())

    def test_count_tamper_even_when_total_balances(self):
        self.mapping['tables'][0]['source_rows'] += 1
        self.mapping['tables'][1]['source_rows'] -= 1
        self.assertTrue(any('source count changed' in e for e in self.errors()))

    def test_source_database_hash_and_inventory_bytes_pinned(self):
        self.mapping['source_database_sha256'] = '0'*64
        self.raw += b' '
        self.assertIn('source database hash mismatch', self.errors())
        self.assertIn('source inventory drift', self.errors())

    def test_schema_ddl_drift(self):
        self.source['tables'][0]['sql'] += ' /* changed */'
        self.assertIn('table schema drift', self.errors())

    def test_schema_column_type_drift(self):
        self.source['tables'][0]['columns'][0]['type'] = 'INTEGER'
        self.assertIn('table schema drift', self.errors())

    def test_column_removal_duplicate_or_reorder(self):
        original = copy.deepcopy(self.mapping['tables'][0]['columns'])
        for changed in [original[:-1], original + [original[0]], list(reversed(original))]:
            with self.subTest(changed=changed):
                self.mapping['tables'][0]['columns'] = changed
                self.assertTrue(any('column dropped' in e for e in self.errors()))

    def test_lossy_cast_and_nullability_changes(self):
        column = self.mapping['tables'][0]['columns'][0]
        column['coercion'] = 'string-to-number'
        column['nullable'] = False
        self.assertTrue(any('lossy raw conversion' in e for e in self.errors()))
        self.assertTrue(any('nullability drift' in e for e in self.errors()))

    def test_raw_copy_never_discarded(self):
        self.table('external_records')['preserve_all_rows'] = False
        self.table('units')['raw_destination'] = None
        self.assertTrue(self.errors())

    def test_cannot_upgrade_classification_review_or_publication(self):
        self.table('sources')['initial_classification'] = 'public'
        self.table('assertions')['automatic_normalization'] = True
        self.table('entities')['public_release'] = True
        self.mapping['historical_verification'] = 'verified'
        self.assertGreaterEqual(len(self.errors()), 4)

    def test_row_counts_never_mean_people(self):
        self.mapping['counts_mean'] = 'unique-people'
        self.assertTrue(any('source counts' in e for e in self.errors()))

    def test_invented_primary_and_foreign_keys_rejected(self):
        self.table('sources')['declared_primary_key'] = ['id']
        self.table('evidence')['declared_foreign_keys'] = [{'source_id': 'sources.id'}]
        self.assertTrue(any('invented declared primary' in e for e in self.errors()))
        self.assertTrue(any('invented declared foreign' in e for e in self.errors()))

    def test_unknown_reference_target_and_column(self):
        reference = self.table('evidence')['logical_references'][0]
        reference['candidate_targets'] = [{'table': 'not_a_table', 'columns': ['id']}]
        self.assertTrue(any('unknown reference target' in e for e in self.errors()))

    def test_reference_cannot_be_silently_omitted_or_duplicated(self):
        self.table('evidence')['logical_references'].pop()
        self.assertTrue(any('reference disposition' in e for e in self.errors()))

    def test_automatic_reference_join_disallowed(self):
        self.table('evidence')['logical_references'][0]['status'] = 'confirmed-by-column-name'
        self.assertTrue(any('unsafe reference resolution' in e for e in self.errors()))

    def test_recovery_gap_cannot_be_closed_by_mapping(self):
        self.mapping['open_exceptions'][0]['status'] = 'resolved'
        self.assertIn('recovery exception silently closed', self.errors())

    def test_recovery_gap_cannot_be_dropped(self):
        self.mapping['open_exceptions'].pop()
        self.assertIn('required recovery exceptions missing or duplicated', self.errors())

    def test_source_row_id_not_legacy_id_or_position_in_export(self):
        self.mapping['raw_row_identity'] = ['id']
        self.assertTrue(any('raw identity' in e for e in self.errors()))

    def test_actual_type_mismatch_and_large_repetitions_remain_visible(self):
        evidence = self.table('evidence')
        self.assertEqual(next(c['declared_type'] for c in evidence['columns'] if c['source'] == 'unit_id'), 'INTEGER')
        self.assertTrue(any('INTEGER' in rule for rule in evidence['conversion_requirements']))
        self.assertEqual(self.table('edition_current_units')['source_rows'], 421084)
        self.assertEqual(self.table('external_records')['source_rows'], 161790)

    def test_duplicate_legacy_ids_do_not_discard_source_rows(self):
        rows = [{'id': 'same', 'text': 'one'}, {'id': 'same', 'text': 'two'}]
        before = copy.deepcopy(rows)
        self.assertEqual(validator.candidate_key_issues(rows, ['id']), [{'position': 1, 'code': 'duplicate-key'}])
        self.assertEqual(rows, before)

    def test_composite_keys_and_exact_types(self):
        rows = [{'edition': 'a', 'id': '7'}, {'edition': 'b', 'id': '7'}, {'edition': 'a', 'id': 7}]
        self.assertEqual(validator.candidate_key_issues(rows, ['edition','id']), [])

    def test_missing_unsupported_and_empty_keys_never_normalize(self):
        rows = [{}, {'id': None}, {'id': ''}, {'id': True}, {'id': {}}, {'id': 1.0}]
        self.assertEqual(len(validator.candidate_key_issues(rows, ['id'])), len(rows))

if __name__ == '__main__':
    unittest.main()
