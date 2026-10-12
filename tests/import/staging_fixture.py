"""Controlled generated source: no real historical records or service access."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('corpus_stage', ROOT / 'services/workers/import/stage.py')
stage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage)


def fixture(root, count=600, ddl=None):
    root = Path(root)
    source = root / 'synthetic.sqlite'
    db = sqlite3.connect(source)
    db.execute(ddl or 'CREATE TABLE specimens(id, unit_id, value, review_state TEXT)')
    if ddl is None:
        db.executemany('INSERT INTO specimens(rowid,id,unit_id,value,review_state) VALUES(?,?,?,?,?)',
                       ((i - 10, 'duplicate', i % 3 if i % 2 else str(i % 3),
                         'source only; not verified', 'verified') for i in range(count)))
        db.execute('CREATE TABLE empty_table(note TEXT)')
    db.commit()
    db.close()
    return contract(root, source)


def contract(root, source):
    root, source = Path(root), Path(source)
    db = sqlite3.connect(source)
    db.row_factory = sqlite3.Row
    tables = []
    for row in db.execute("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
        columns = []
        for c in db.execute('PRAGMA table_info(' + stage.quoted(row['name']) + ')'):
            columns.append(dict(zip(('cid','name','type','notnull','default','pk'), tuple(c))))
        tables.append({'table': row['name'], 'sql': row['sql'], 'columns': columns,
                       'rows': db.execute('SELECT count(*) FROM ' + stage.quoted(row['name'])).fetchone()[0]})
    db.close()
    h = hashlib.sha256()
    with source.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(chunk)
    source_hash = h.hexdigest()
    mapping = copy.deepcopy(json.loads((ROOT / 'docs/migration/migration-map.json').read_text()))
    template = mapping['tables'][0]
    mapping.update(source_database_sha256=source_hash, source_database_bytes=source.stat().st_size,
                   table_count=len(tables), source_row_count=sum(t['rows'] for t in tables),
                   source_schema_sha256=stage.schema_digest([{k:t[k] for k in ('table','sql','columns')} for t in tables]))
    mapped = []
    for t in tables:
        row = copy.deepcopy(template)
        row.update(source_table=t['table'], source_rows=t['rows'], raw_destination='synthetic.' + t['table'],
                   schema_sha256=stage.schema_digest({k:t[k] for k in ('table','sql','columns')}),
                   columns=[{'source': c['name'], 'declared_type': c['type'], 'nullable': not bool(c['notnull']),
                             'raw_rule': 'preserve-sqlite-storage-class-and-value', 'coercion':'none'} for c in t['columns']],
                   unresolved_reference_columns=['unit_id'] if t['table']=='specimens' else [])
        mapped.append(row)
    mapping['tables'] = mapped
    inventory = {'tables': tables}
    staging = root / 'private-staging'
    staging.mkdir(mode=0o700, exist_ok=True)
    source_id, version = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
    return {'source_path':str(source), 'staging_directory':str(staging),
            'source_ref':{'project':'royal-union-78374030','branch':'br-purple-grass-b5hurfl7',
                          'kind':'quarantine','bucket':'garden-quarantine','key':source_id+'/'+version,
                          'sourceId':source_id,'version':version,'sha256':source_hash,'size':source.stat().st_size},
            'workspace_id':'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee', 'subject_id':'synthetic-operator',
            'run_id':'cccccccc-cccc-4ccc-cccc-cccccccccccc',
            'mapping':mapping, 'inventory':inventory, 'format':'sqlite'}


if __name__ == '__main__':
    import sys
    print(json.dumps(fixture(sys.argv[1], count=int(sys.argv[2]) if len(sys.argv)>2 else 600)))
