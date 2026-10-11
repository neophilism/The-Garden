#!/usr/bin/env python3
"""Validate the explicit CP-017 mapping without opening or importing source rows."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = '3bc3b81b7a2ffaaf2a5a0a072ddf781c8688785aa67b3d6069cca5a9918d3ed0'
INVENTORY_HASH = 'ec3f2815a372fb4ce6d186c07fea82cb407f28ce913c7adf4b41fdd8eb082325'
SOURCE_SIZE = 396087296
RAW_IDENTITY = ['source_sha256', 'source_table', 'sqlite_rowid']
DISPOSITIONS = {'raw-preservation', 'normalized-candidate', 'legacy-snapshot', 'unresolved-recovery'}
EXCEPTIONS = {'cp011-schema-lineage', 'cp016-truncated-export', 'marinerito-row223-alignment'}

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()

def table_schema(table):
    return {'table': table['table'], 'sql': table['sql'], 'columns': table['columns']}

def schema_hash(inventory):
    return digest(sorted((table_schema(t) for t in inventory['tables']), key=lambda t: t['table']))

def validate(mapping, inventory, disposition, inventory_bytes):
    errors = []
    def check(condition, message):
        if not condition:
            errors.append(message)
    check(mapping.get('schema_version') == 1, 'mapping schema version')
    check(mapping.get('source_database_sha256') == inventory.get('sha256') == disposition.get('source_sha256') == SOURCE_HASH, 'source database hash mismatch')
    check(mapping.get('source_database_bytes') == inventory.get('size_bytes') == SOURCE_SIZE, 'source database size mismatch')
    check(mapping.get('source_inventory_sha256') == hashlib.sha256(inventory_bytes).hexdigest() == INVENTORY_HASH, 'source inventory drift')
    check(mapping.get('source_schema_sha256') == schema_hash(inventory), 'table schema drift')
    check(mapping.get('source_schema_scope') == 'table-ddl-and-column-metadata; index-definitions-not-in-inventory', 'schema hash scope changed')
    check(mapping.get('table_count') == inventory.get('table_count') == 106, '106 tables required')
    check(mapping.get('source_row_count') == inventory.get('total_rows') == 923292, '923292 source rows required')
    check(mapping.get('counts_mean') == 'source-rows-including-edition-and-legacy-repetitions', 'source counts must not mean people or verified facts')
    check(mapping.get('normalization_executed') is False and mapping.get('production_migration_authorized') is False and mapping.get('historical_verification') == 'not-established', 'mapping cannot authorize import or historical acceptance')
    check(mapping.get('conversion_rules_version') == 'cp017-lossless-raw-v1', 'unknown conversion policy')
    check(mapping.get('relationship_rule') == 'candidate-only-exact-typed-keys-no-automatic-joins', 'unsafe relationship policy')
    check(mapping.get('raw_row_identity') == RAW_IDENTITY, 'raw identity must be source/table/rowid, not a historical identity')
    check(mapping.get('duplicate_legacy_keys') == 'preserve-all-raw-rows; block-normalized-link-until-adjudicated', 'unsafe duplicate key policy')
    tables = mapping.get('tables')
    if not isinstance(tables, list):
        return errors + ['mapping tables must be a list']
    source_tables = {t['table']: t for t in inventory['tables']}
    baseline_tables = {t['source_table']: t for t in disposition['tables']}
    check(len(source_tables) == len(inventory['tables']) == 106, 'duplicate or missing source tables')
    check(len(baseline_tables) == len(disposition['tables']) == 106, 'duplicate or missing baseline dispositions')
    names = [t.get('source_table') for t in tables]
    check(len(names) == len(set(names)) == 106 and set(names) == set(source_tables) == set(baseline_tables), 'missing, duplicated or unknown mapped table')
    row_total = 0
    for item in tables:
        name = item.get('source_table')
        if name not in source_tables or name not in baseline_tables:
            continue
        original, baseline = source_tables[name], baseline_tables[name]
        prefix = name + ': '
        check(item.get('id') == 'CP017:' + name, prefix + 'mapping ID mismatch')
        check(type(item.get('source_rows')) is int and item['source_rows'] == original['rows'] == baseline['source_rows'], prefix + 'source count changed')
        row_total += item.get('source_rows', 0) if type(item.get('source_rows')) is int else 0
        check(item.get('schema_sha256') == digest(table_schema(original)), prefix + 'schema drift')
        check(item.get('raw_destination') == baseline['raw_preservation'] == 'legacy_cp017.' + name, prefix + 'raw preservation destination lost')
        check(item.get('domain') == baseline['normalized_domain'], prefix + 'baseline domain changed without correction')
        check(item.get('initial_classification') == baseline['initial_classification'], prefix + 'classification broadening')
        check(item.get('disposition') in DISPOSITIONS, prefix + 'unknown disposition')
        candidate = item.get('normalized_contract_candidate')
        allowed_contracts = {'archival-unit', 'source', 'source-lineage', 'entity', 'claim', 'evidence-link', 'claim-placement', 'locator'}
        check((item.get('disposition') == 'normalized-candidate' and candidate in allowed_contracts) or (item.get('disposition') != 'normalized-candidate' and candidate is None), prefix + 'unrecognized normalized contract')
        check(item.get('automatic_normalization') is False and item.get('public_release') is False and item.get('preserve_all_rows') is True, prefix + 'unsafe release or discarded rows')
        check(item.get('declared_primary_key') == [c['name'] for c in original['columns'] if c['pk']], prefix + 'invented declared primary key')
        check(item.get('declared_foreign_keys') == [] and 'REFERENCES' not in original['sql'].upper(), prefix + 'invented declared foreign key')
        check(item.get('declared_foreign_keys_status') == 'none-in-recorded-table-ddl; full-index-catalog-unavailable', prefix + 'overstated constraint evidence')
        check(item.get('duplicate_key_action') == mapping.get('duplicate_legacy_keys'), prefix + 'unsafe per-table deduplication')
        check(isinstance(item.get('conversion_requirements'), list) and len(item['conversion_requirements']) > 0, prefix + 'conversion requirements missing')
        columns = item.get('columns', [])
        check([c.get('source') for c in columns] == baseline['source_columns'] == [c['name'] for c in original['columns']], prefix + 'column dropped, duplicated or reordered')
        for column, source in zip(columns, original['columns']):
            check(column.get('declared_type') == source['type'] and column.get('nullable') is (not bool(source['notnull'])), prefix + 'column type/nullability drift')
            check(column.get('raw_rule') == 'preserve-sqlite-storage-class-and-value' and column.get('coercion') == 'none', prefix + 'lossy raw conversion')
        for candidate in item.get('logical_references', []):
            source_columns = candidate.get('source_columns', [])
            check(bool(source_columns) and set(source_columns) <= set(baseline['source_columns']), prefix + 'unknown reference source column')
            check(candidate.get('status') == 'candidate-requires-row-and-namespace-review' and candidate.get('on_missing_or_ambiguous') == 'retain-raw-and-open-issue; no-placeholder-or-merge', prefix + 'unsafe reference resolution')
            targets = candidate.get('candidate_targets', [])
            check(bool(targets), prefix + 'reference target missing')
            for target in targets:
                target_table = source_tables.get(target.get('table'))
                check(target_table is not None and bool(target.get('columns')) and set(target['columns']) <= {c['name'] for c in target_table['columns']}, prefix + 'unknown reference target')
        required_refs = {c for c in baseline['source_columns'] if c.endswith('_id') or c.endswith('_ids_json') or c == 'asset_sha256'}
        unresolved = item.get('unresolved_reference_columns', [])
        covered_refs = [c for r in item.get('logical_references', []) for c in r.get('source_columns', [])] + unresolved
        check(len(covered_refs) == len(set(covered_refs)) and set(covered_refs) == required_refs, prefix + 'missing or duplicated reference disposition')
        check(set(unresolved) <= set(baseline['source_columns']), prefix + 'unknown unresolved reference column')
        for issue in item.get('open_exceptions', []):
            check(issue in EXCEPTIONS, prefix + 'unknown recovery exception')
        if item.get('domain') == 'lineage_and_recovery':
            check({'cp011-schema-lineage', 'cp016-truncated-export'} <= set(item.get('open_exceptions', [])), prefix + 'recovery limitations detached')
        if item.get('domain') == 'witness_sequences':
            check('marinerito-row223-alignment' in item.get('open_exceptions', []), prefix + 'witness alignment limitation detached')
    check(row_total == 923292, 'mapped row total differs from 923292')
    ids = [t.get('id') for t in tables]
    check(len(ids) == len(set(ids)), 'duplicate mapping ID')
    exceptions = mapping.get('open_exceptions', [])
    check({e.get('id') for e in exceptions} == EXCEPTIONS and len(exceptions) == len(EXCEPTIONS), 'required recovery exceptions missing or duplicated')
    for issue in exceptions:
        check(issue.get('status') == 'unresolved' and issue.get('reconstruct_by_guess') is False, 'recovery exception silently closed')
    return errors

def candidate_key_issues(rows, columns):
    """Preflight a proposed normalized key; never discard or merge raw rows."""
    if not isinstance(columns, list) or not columns or len(set(columns)) != len(columns):
        raise ValueError('Invalid key columns')
    seen, issues = set(), []
    for position, row in enumerate(rows):
        values = [row.get(name) for name in columns]
        if any(v is None or v == '' or isinstance(v, (dict, list, bool)) or not isinstance(v, (str, int)) for v in values):
            issues.append({'position': position, 'code': 'missing-or-unsupported-key'})
            continue
        key = tuple((type(value).__name__, value) for value in values)
        if key in seen:
            issues.append({'position': position, 'code': 'duplicate-key'})
        seen.add(key)
    return issues

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mapping', type=Path, default=ROOT / 'docs/migration/migration-map.json')
    args = parser.parse_args()
    try:
        data = (ROOT / 'docs/migration/source-schema-inventory.json').read_bytes()
        mapping = json.loads(args.mapping.read_text())
        errors = validate(mapping, json.loads(data), json.loads((ROOT / 'docs/migration/table-disposition.json').read_text()), data)
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        raise SystemExit('Invalid migration mapping or schema evidence')
    if errors:
        raise SystemExit('\n'.join(errors))
    print('CP-017 mapping: 106 tables, 923292 source rows; no import, historical acceptance or publication inferred.')

if __name__ == '__main__':
    main()
