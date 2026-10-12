"""Read-only operator diagnostics. No staging, grants or publication are created.

Use only on originals the operator is already authorized to inspect. The CLI
pins the repository's CP-017 contract and writes aggregate counters, never cell
values or source locators. It does not activate the audited staging worker.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import resource
import stat
import sys
import time

SPEC = importlib.util.spec_from_file_location('garden_stage', Path(__file__).with_name('stage.py'))
stage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage)
ROOT = Path(__file__).resolve().parents[3]


def profile_source(path, mapping, inventory, check=lambda: None):
    """Bounded full scan with the actual staging serializer, no raw output.

    ``check`` is a cancellation/deadline hook, NOT an authorization adapter.
    Failure returns no report and must never be represented as a complete scan.
    """
    stage.validate_contract(mapping, inventory)
    source = reader = None
    started = time.monotonic()
    def gate(_):
        check()
    try:
        check()
        source = stage.Source(path, mapping['source_database_sha256'], mapping['source_database_bytes'])
        source.verify(gate)
        reader = stage.SQLiteRows(source, mapping, inventory, gate)
        tables, total, payload_bytes, max_row, max_cell, issues_total = [], 0, 0, 0, 0, 0
        classes = collections.Counter()
        for table in sorted(mapping['tables'], key=lambda t: t['source_table']):
            check()
            source.unchanged()
            columns = {c['source']: {'storage_classes': {}, 'max_bytes': 0,
                                    'invalid_text_cells': 0} for c in table['columns']}
            count, table_bytes = 0, 0
            for _, locator, cells, issues in reader.rows(table, None):
                if count % stage.MAX_ROWS == 0:
                    check()
                    source.unchanged()
                size = len(stage.canonical(stage.envelope(source.expected, table, locator, cells, issues)).encode())
                stage.require(size <= stage.MAX_ROW, 'row-size-limit')
                max_row = max(max_row, size)
                table_bytes += size
                count += 1
                issues_total += len(issues)
                for cell in cells:
                    column = columns[cell['column']]
                    storage = cell['storage']
                    column['storage_classes'][storage] = column['storage_classes'].get(storage, 0) + 1
                    classes[storage] += 1
                    column['max_bytes'] = max(column['max_bytes'], cell.get('size', 0))
                    max_cell = max(max_cell, cell.get('size', 0))
                    if cell.get('decoding') == 'invalid-retained':
                        column['invalid_text_cells'] += 1
            stage.require(count == table['source_rows'], 'reconciliation-failed')
            tables.append({'table': table['source_table'], 'rows': count,
                           'serialized_payload_bytes': table_bytes, 'columns': columns})
            total += count
            payload_bytes += table_bytes
        source.verify(gate)
        check()
        stage.require(total == mapping['source_row_count'], 'reconciliation-failed')
        return {'format': 'garden-corpus-preflight-v1', 'status': 'read-only-scan-complete',
                'source_sha256': source.expected, 'source_bytes': mapping['source_database_bytes'],
                'source_schema_sha256': mapping['source_schema_sha256'],
                'mapping_sha256': stage.digest(mapping), 'inventory_sha256': stage.digest(inventory),
                'observed_catalog_sha256': stage.digest(reader.catalog),
                'staging_profile': stage.PROFILE,
                'limits': {'max_cell_bytes': stage.MAX_CELL, 'max_row_bytes': stage.MAX_ROW},
                'rows_scanned': total, 'tables_scanned': len(tables),
                'storage_classes': dict(classes), 'invalid_text_cells': issues_total,
                'max_cell_bytes': max_cell, 'max_serialized_row_bytes': max_row,
                'serialized_payload_bytes': payload_bytes,
                'payload_estimate_excludes': ['SQLite pages', 'indexes', 'audit', 'checkpoints', 'backups'],
                'elapsed_seconds': round(time.monotonic() - started, 3),
                'peak_rss_kib': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                'rows_staged': 0, 'historicalReview': 'unreviewed', 'rights': 'unreviewed',
                'production_migration_authorized': False, 'publiclyAccessible': False,
                'recovery_exceptions': mapping['open_exceptions'], 'tables': tables}
    finally:
        if reader:
            reader.close()
        if source:
            source.close()


def load_contracts():
    mapping_bytes = (ROOT / 'docs/migration/migration-map.json').read_bytes()
    inventory_bytes = (ROOT / 'docs/migration/source-schema-inventory.json').read_bytes()
    stage.require(len(mapping_bytes) + len(inventory_bytes) <= stage.MAX_CONFIG, 'config-size-limit')
    mapping = stage.strict_json(mapping_bytes)
    stage.require(hashlib.sha256(inventory_bytes).hexdigest() == mapping['source_inventory_sha256'],
                  'inventory-drift')
    return mapping, stage.strict_json(inventory_bytes)


def private_report(path, report):
    """Exclusive output in an operator-owned private directory; no overwrites."""
    path = Path(path)
    stage.require(path.is_absolute() and path.parent.resolve() == path.parent and
                  not path.is_relative_to(ROOT), 'unsafe-report-path')
    info = path.parent.stat(follow_symlinks=False)
    stage.require(stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid() and
                  info.st_mode & 0o077 == 0, 'unsafe-report-directory')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(report, handle, sort_keys=True, indent=2, allow_nan=False)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        # Only the newly created partial report is removed. Existing files were
        # never opened for writing; the source is never passed to this function.
        path.unlink()
        raise


def main():
    stage.constrain()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    try:
        mapping, inventory = load_contracts()
        report = profile_source(args.source, mapping, inventory)
        private_report(args.report, report)
        print(stage.canonical({'status': report['status'], 'rows_scanned': report['rows_scanned'],
                               'tables_scanned': report['tables_scanned'], 'rows_staged': 0}))
        return 0
    except Exception:
        # Parser errors can include cell values, paths or SQL; never print them.
        print('{"status":"preflight-rejected","rows_staged":0}')
        return 2


if __name__ == '__main__':
    sys.exit(main())
