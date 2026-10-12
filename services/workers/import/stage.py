"""GDN-045 offline quarantine worker. No network, source mutation or publication.

This module accepts ONLY trusted server configuration. The executable protocol
requires a fresh parent authorization receipt at every gate; there is no CLI
flag that grants access. Production still requires an isolated private volume.
"""
import base64
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import resource
import sqlite3
import stat
import struct
import sys
import time
import uuid

PROFILE = 'garden-offline-staging-v1'
MAX_CELL = 1024 * 1024
MAX_ROW = 4 * 1024 * 1024
MAX_BATCH = 8 * 1024 * 1024
MAX_ROWS = 256
MAX_SOURCE = 16 * 1024**3
MAX_CONFIG = 4 * 1024 * 1024
MAX_TABLES = 256
MAX_COLUMNS = 128
ZERO = '0' * 64


class Rejected(Exception):
    """Codes contain no source text, paths, SQL or credential-bearing errors."""


def require(value, code):
    if not value:
        raise Rejected(code)


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=True,
                      separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def schema_digest(value):
    # Exact GDN-044 canonicalization, including its Unicode encoding choice.
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':')).encode()).hexdigest()


def strict_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate-json-key')
            result[key] = value
        return result
    def invalid(_):
        raise Rejected('non-json-number')
    return json.loads(data, object_pairs_hook=pairs, parse_constant=invalid)


def quoted(name):
    require(isinstance(name, str) and 0 < len(name) <= 512 and '\0' not in name,
            'invalid-identifier')
    return '"' + name.replace('"', '""') + '"'


def signature(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


class Source:
    """Hold the checked inode open, refuse live WAL/rollback-journal sources."""
    def __init__(self, path, expected, size):
        self.path = Path(path)
        require(self.path.is_absolute() and self.path.resolve() == self.path,
                'unsafe-source-path')
        self.fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            info = os.fstat(self.fd)
            require(stat.S_ISREG(info.st_mode) and info.st_size == size and
                    0 < size <= MAX_SOURCE, 'source-size-or-type')
            fcntl.flock(self.fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
            self.initial = signature(info)
            self.expected = expected
            self.unchanged()
        except BaseException:
            os.close(self.fd)
            raise

    def unchanged(self):
        require(signature(os.fstat(self.fd)) == self.initial and
                signature(self.path.stat(follow_symlinks=False)) == self.initial,
                'source-changed')
        require(not any(Path(str(self.path) + suffix).exists()
                        for suffix in ('-wal', '-shm', '-journal')), 'live-source-sidecar')

    def verify(self, gate):
        self.unchanged()
        value = hashlib.sha256()
        offset = 0
        while True:
            part = os.pread(self.fd, 1024 * 1024, offset)
            if not part:
                break
            value.update(part)
            offset += len(part)
            if offset % (32 * 1024 * 1024) == 0:
                gate('source-hash')
        self.unchanged()
        require(value.hexdigest() == self.expected, 'source-hash-mismatch')

    def close(self):
        os.close(self.fd)


def typed_cell(storage, value, encoding):
    if storage == b'null':
        return {'storage': 'null'}, []
    if storage == b'integer':
        return {'storage': 'integer', 'decimal': str(value)}, []
    if storage == b'real':
        return {'storage': 'real', 'ieee754_be': struct.pack('>d', value).hex()}, []
    require(storage in (b'text', b'blob') and isinstance(value, bytes), 'unsupported-cell')
    require(len(value) <= MAX_CELL, 'cell-size-limit')
    result = {'storage': storage.decode(), 'base64': base64.b64encode(value).decode(),
              'size': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
    issues = []
    if storage == b'text':
        result['encoding'] = encoding
        try:
            value.decode(encoding, errors='strict')
            result['decoding'] = 'valid'
        except UnicodeError:
            result['decoding'] = 'invalid-retained'
            issues.append('invalid-text-encoding')
    return result, issues


class SQLiteRows:
    def __init__(self, source, mapping, inventory, gate):
        self.source, self.mapping = source, mapping
        # Linux /proc ties the connection to the already opened inode. Nothing
        # evaluates source DDL, triggers, views, extensions or inherited scripts.
        self.db = sqlite3.connect(f'file:/proc/self/fd/{source.fd}?mode=ro&immutable=1', uri=True)
        try:
            self.db.enable_load_extension(False)
            self.db.execute('PRAGMA query_only=ON')
            self.db.execute('PRAGMA trusted_schema=OFF')
            self.db.execute('PRAGMA cache_size=-2048')
            self.db.execute('PRAGMA mmap_size=0')
            self.db.execute('PRAGMA temp_store=MEMORY')
            if hasattr(self.db, 'setlimit'):
                self.db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, MAX_ROW)
            self.last_gate = time.monotonic()
            def progress():
                if time.monotonic() - self.last_gate > 1:
                    try:
                        gate('source-scan')
                        source.unchanged()
                    except Exception:
                        return 1
                    self.last_gate = time.monotonic()
                return 0
            self.db.set_progress_handler(progress, 10000)
            require(self.db.execute('PRAGMA quick_check(1)').fetchone() == ('ok',),
                    'sqlite-integrity-failed')
            encoding = self.db.execute('PRAGMA encoding').fetchone()[0]
            self.encoding = {'UTF-8': 'utf-8', 'UTF-16le': 'utf-16-le',
                             'UTF-16be': 'utf-16-be'}[encoding]
            observed = []
            self.aliases = {}
            catalog = self.db.execute(
                'SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').fetchmany(2049)
            require(len(catalog) <= 2048, 'schema-size-limit')
            self.catalog = [list(row) for row in catalog]
            table_list = {row[1]: row for row in self.db.execute('PRAGMA table_list')}
            names = sorted(row[1] for row in catalog if row[0] == 'table' and
                           not row[1].startswith('sqlite_'))
            require(names == sorted(t['source_table'] for t in mapping['tables']), 'table-drift')
            originals = {t['table']: t for t in inventory['tables']}
            for table in sorted(mapping['tables'], key=lambda t: t['source_table']):
                gate('schema-table')
                name = table['source_table']
                # table_list exposes WITHOUT ROWID and virtual/shadow tables.
                require(name in table_list and table_list[name][2] == 'table' and
                        table_list[name][4] == 0, 'not-an-ordinary-rowid-table')
                columns = self.db.execute('PRAGMA table_xinfo(' + quoted(name) + ')').fetchmany(MAX_COLUMNS + 1)
                require(0 < len(columns) <= MAX_COLUMNS and all(c[6] == 0 for c in columns),
                        'hidden-or-generated-columns')
                lower = {c[1].lower() for c in columns}
                alias = next((a for a in ('rowid', '_rowid_', 'oid') if a not in lower), None)
                require(alias is not None, 'rowid-shadowed')
                self.aliases[name] = alias
                schema = {'table': name,
                          'sql': next(r[3] for r in catalog if r[0] == 'table' and r[1] == name),
                          'columns': [dict(zip(('cid', 'name', 'type', 'notnull', 'default', 'pk'), c[:6])) for c in columns]}
                require(schema == {k: originals[name][k] for k in ('table', 'sql', 'columns')} and
                        schema_digest(schema) == table['schema_sha256'], 'schema-drift')
                count = self.db.execute('SELECT count(*) FROM ' + quoted(name)).fetchone()[0]
                require(count == table['source_rows'], 'row-count-drift')
                observed.append(schema)
            require(schema_digest(observed) == mapping['source_schema_sha256'], 'schema-drift')
            self.db.text_factory = bytes
            def authorize(action, arg1, arg2, database, trigger):
                if action in (sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ):
                    return sqlite3.SQLITE_OK
                if action == sqlite3.SQLITE_FUNCTION and arg2 in ('typeof', 'length'):
                    return sqlite3.SQLITE_OK
                return sqlite3.SQLITE_DENY
            self.db.set_authorizer(authorize)
        except BaseException:
            self.db.close()
            raise

    def rows(self, table, after):
        name = table['source_table']
        alias = quoted(self.aliases[name])
        # CAST AS BLOB returns TEXT bytes in the database encoding and avoids
        # sqlite3's implicit UTF-8 decoding/replacement. Numeric values stay typed.
        expressions = []
        for column in table['columns']:
            col = quoted(column['source'])
            expressions.extend([f'typeof({col})',
                f"CASE WHEN typeof({col}) IN ('text','blob') THEN CAST({col} AS BLOB) ELSE {col} END"])
        where, params = ('', ()) if after is None else (f' WHERE {alias}>?', (after,))
        query = f'SELECT {alias},' + ','.join(expressions) + ' FROM ' + quoted(name) + where + f' ORDER BY {alias}'
        cursor = self.db.execute(query, params)
        for row in cursor:
            require(type(row[0]) is int, 'invalid-rowid')
            cells, issues = [], []
            for index, column in enumerate(table['columns']):
                cell, findings = typed_cell(row[1 + index * 2], row[2 + index * 2], self.encoding)
                cells.append({'column': column['source'], **cell})
                issues.extend({'column': column['source'], 'code': f} for f in findings)
            yield row[0], {'kind': 'sqlite-rowid', 'sqlite_rowid': str(row[0])}, cells, issues

    def close(self):
        self.db.close()


def validate_export_cell(cell, column):
    """Versioned tagged transport only. Never parse a cell's JSON-looking text."""
    require(isinstance(cell, dict) and cell.get('column') == column, 'export-column-drift')
    kind = cell.get('storage')
    common = {'column', 'storage'}
    if kind == 'null':
        require(set(cell) == common, 'invalid-export-cell')
        return []
    if kind == 'integer':
        require(set(cell) == common | {'decimal'} and isinstance(cell['decimal'], str), 'invalid-export-cell')
        value = int(cell['decimal'])
        require(str(value) == cell['decimal'] and -(2**63) <= value < 2**63, 'invalid-export-integer')
        return []
    if kind == 'real':
        require(set(cell) == common | {'ieee754_be'} and isinstance(cell['ieee754_be'], str) and
                len(cell['ieee754_be']) == 16 and bytes.fromhex(cell['ieee754_be']).hex() == cell['ieee754_be'],
                'invalid-export-real')
        # SQLite stores NaN as NULL; a purported REAL NaN is not a valid export.
        number = struct.unpack('>d', bytes.fromhex(cell['ieee754_be']))[0]
        require(number == number, 'invalid-export-real')
        return []
    require(kind in ('blob', 'text'), 'invalid-export-storage')
    fields = common | {'base64', 'size', 'sha256'}
    if kind == 'text':
        fields |= {'encoding', 'decoding'}
    require(set(cell) == fields and isinstance(cell['base64'], str) and
            len(cell['base64']) <= ((MAX_CELL + 2) // 3) * 4, 'invalid-export-cell')
    raw = base64.b64decode(cell['base64'], validate=True)
    require(base64.b64encode(raw).decode() == cell['base64'], 'invalid-export-base64')
    encoding = cell.get('encoding', 'utf-8')
    require(encoding in ('utf-8', 'utf-16-le', 'utf-16-be'), 'invalid-export-encoding')
    observed, issues = typed_cell(kind.encode(), raw, encoding)
    require(cell == {'column': column, **observed}, 'export-cell-integrity')
    return issues


class ExportRows:
    """Bounded typed NDJSON, grouped by exact table name in lexical order.

    Identity is artifact + physical byte offset. An export never impersonates
    original SQLite rowids; header origin claims remain inherited evidence.
    """
    def __init__(self, source, mapping, inventory, gate):
        self.source = source
        self.handle = os.fdopen(os.dup(source.fd), 'rb')
        self.offsets = {}
        self.tables = {t['source_table']: t for t in mapping['tables']}
        try:
            header = self.line()
            require(isinstance(header, dict) and set(header) == {'format', 'schema_sha256', 'origin'} and
                    header['format'] == 'garden-typed-export-v1' and
                    header['schema_sha256'] == mapping['source_schema_sha256'] and
                    isinstance(header['origin'], str) and len(header['origin']) <= 4096, 'invalid-export-header')
            self.catalog = {'export_header': header, 'schema_evidence': 'mapped-metadata-not-original-database-inspection'}
            previous, counts = None, {name: 0 for name in self.tables}
            while True:
                offset = self.handle.tell()
                record = self.line()
                if record is None:
                    break
                name, _, _ = self.record(record)
                require(previous is None or name >= previous, 'export-table-order')
                if name != previous:
                    self.offsets[name] = offset
                previous = name
                counts[name] += 1
                if counts[name] % 256 == 0:
                    gate('source-scan')
                    source.unchanged()
            require(all(counts[t['source_table']] == t['source_rows'] for t in mapping['tables']), 'row-count-drift')
        except BaseException:
            self.handle.close()
            raise

    def line(self):
        raw = self.handle.readline(MAX_ROW + 1)
        if not raw:
            return None
        require(len(raw) <= MAX_ROW and raw.endswith(b'\n'), 'export-line-limit-or-truncation')
        return strict_json(raw)

    def record(self, record):
        require(isinstance(record, dict) and set(record) == {'table', 'cells'} and
                record['table'] in self.tables and isinstance(record['cells'], list), 'invalid-export-record')
        table = self.tables[record['table']]
        require(len(record['cells']) == len(table['columns']), 'export-column-drift')
        issues = []
        for cell, column in zip(record['cells'], table['columns']):
            issues.extend({'column': column['source'], 'code': code}
                          for code in validate_export_cell(cell, column['source']))
        return record['table'], record['cells'], issues

    def rows(self, table, after):
        name = table['source_table']
        if name not in self.offsets:
            return
        self.handle.seek(self.offsets[name] if after is None else after)
        if after is not None:
            self.line()  # checkpoint is the start of the last committed record
        while True:
            offset = self.handle.tell()
            record = self.line()
            if record is None:
                break
            observed, cells, issues = self.record(record)
            if observed != name:
                break
            yield offset, {'kind': 'artifact-byte-offset', 'byte_offset': str(offset)}, cells, issues

    def close(self):
        self.handle.close()


SCHEMA = """
CREATE TABLE binding (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE table_state (name TEXT PRIMARY KEY, checkpoint INTEGER, rows INTEGER NOT NULL, chain TEXT NOT NULL);
CREATE TABLE staging_rows (source_sha256 TEXT NOT NULL, source_table TEXT NOT NULL,
 locator INTEGER NOT NULL, payload TEXT NOT NULL, hash TEXT NOT NULL,
 PRIMARY KEY(source_sha256,source_table,locator));
CREATE TABLE batches (sequence INTEGER PRIMARY KEY, source_table TEXT NOT NULL,
 first_locator INTEGER NOT NULL, last_locator INTEGER NOT NULL, rows INTEGER NOT NULL,
 digest TEXT NOT NULL, previous_chain TEXT NOT NULL, chain TEXT NOT NULL, attempt TEXT NOT NULL,
 audit_sequence INTEGER NOT NULL UNIQUE);
CREATE TABLE audit (sequence INTEGER PRIMARY KEY, payload TEXT NOT NULL, previous TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE status (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL);
INSERT INTO status VALUES(1,'incomplete-quarantined');
"""


class Store:
    def __init__(self, directory):
        directory = Path(directory)
        require(directory.is_absolute() and directory.resolve() == directory, 'unsafe-staging-path')
        info = directory.stat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid() and
                stat.S_IMODE(info.st_mode) == 0o700, 'private-staging-directory-required')
        self.lock = os.open(directory / 'lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            for name in ('staging.sqlite', 'staging.sqlite-journal', 'lock'):
                path = directory / name
                if path.exists() or path.is_symlink():
                    info = path.lstat()
                    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and
                            info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600,
                            'unsafe-staging-file')
            path = directory / 'staging.sqlite'
            new = not path.exists()
            if new:
                os.close(os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600))
            self.db = sqlite3.connect(path, isolation_level=None)
            self.db.execute('PRAGMA journal_mode=DELETE')
            self.db.execute('PRAGMA synchronous=FULL')
            self.db.execute('PRAGMA trusted_schema=OFF')
            self.db.execute('PRAGMA cache_size=-2048')
            self.db.execute('PRAGMA mmap_size=0')
            # A kill before the first schema transaction commits leaves an
            # empty SQLite file. Reinitialize only that empty state.
            if new or self.db.execute('SELECT count(*) FROM sqlite_schema').fetchone()[0] == 0:
                self.db.executescript('BEGIN IMMEDIATE;' + SCHEMA + 'COMMIT;')
            expected = sqlite3.connect(':memory:')
            try:
                expected.executescript(SCHEMA)
                catalog_sql = 'SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name'
                require(self.db.execute(catalog_sql).fetchall() == expected.execute(catalog_sql).fetchall(),
                        'staging-schema-drift')
            finally:
                expected.close()
            require(self.db.execute('PRAGMA quick_check(1)').fetchone() == ('ok',), 'staging-integrity-failed')
        except BaseException:
            if hasattr(self, 'db'):
                self.db.close()
            os.close(self.lock)
            raise

    @contextlib.contextmanager
    def transaction(self):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            yield
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise

    def event(self, attempt, run, kind, details, authorization_request_id=None):
        prior = self.db.execute('SELECT sequence,hash FROM audit ORDER BY sequence DESC LIMIT 1').fetchone()
        sequence, previous = (prior[0] + 1, prior[1]) if prior else (1, ZERO)
        value = {'sequence': sequence, 'attempt': attempt, 'run_id': run,
                 'kind': kind, 'details': details, 'time_ns': str(time.time_ns()),
                 'authorization_request_id': authorization_request_id}
        payload = canonical(value)
        hashed = digest({'previous': previous, 'event': value})
        self.db.execute('INSERT INTO audit VALUES(?,?,?,?)', (sequence, payload, previous, hashed))
        return sequence

    def verify(self, gate):
        binding_row = self.db.execute('SELECT payload,hash FROM binding WHERE id=1').fetchone()
        binding = strict_json(binding_row[0]) if binding_row else None
        if binding:
            require(digest(binding) == binding_row[1], 'binding-conflict')
            require({r[0] for r in self.db.execute('SELECT name FROM table_state')} ==
                    {t['source_table'] for t in binding['mapping']['tables']}, 'checkpoint-conflict')
        else:
            require(self.db.execute('SELECT count(*) FROM table_state').fetchone()[0] == 0,
                    'binding-conflict')
        previous, index, audit_batches = ZERO, 0, 0
        for sequence, payload, prior, hashed in self.db.execute('SELECT * FROM audit ORDER BY sequence'):
            index += 1
            value = strict_json(payload)
            require(sequence == index and prior == previous and
                    value['sequence'] == sequence and digest({'previous': prior, 'event': value}) == hashed,
                    'audit-conflict')
            if value['kind'] == 'batch-committed':
                audit_batches += 1
            previous = hashed
            if index % 256 == 0:
                gate('verify-staging')
        for name, checkpoint, count, chain in self.db.execute('SELECT * FROM table_state ORDER BY name'):
            current, total, last = ZERO, 0, None
            for batch in self.db.execute('SELECT * FROM batches WHERE source_table=? ORDER BY sequence', (name,)):
                gate('verify-staging')
                _, _, first, end, expected_count, expected_digest, prior, batch_chain, attempt, audit_seq = batch
                require(prior == current and (last is None or first > last), 'batch-conflict')
                h = hashlib.sha256()
                n, first_seen, last_seen = 0, None, None
                for source_sha, locator, payload, hashed in self.db.execute(
                        'SELECT source_sha256,locator,payload,hash FROM staging_rows WHERE source_table=? AND locator BETWEEN ? AND ? ORDER BY locator',
                        (name, first, end)):
                    require(hashlib.sha256(payload.encode()).hexdigest() == hashed, 'row-conflict')
                    value = strict_json(payload)
                    expected_locator = ({'kind': 'sqlite-rowid', 'sqlite_rowid': str(locator)}
                                        if binding['format'] == 'sqlite' else
                                        {'kind': 'artifact-byte-offset', 'byte_offset': str(locator)})
                    require(value['source_sha256'] == source_sha == binding['source_ref']['sha256'] and
                            value['source_table'] == name and value['locator'] == expected_locator,
                            'row-lineage-conflict')
                    h.update(canonical([locator, hashed]).encode() + b'\n')
                    n += 1
                    first_seen = locator if first_seen is None else first_seen
                    last_seen = locator
                require((n, first_seen, last_seen, h.hexdigest()) ==
                        (expected_count, first, end, expected_digest), 'batch-conflict')
                current = digest([prior, name, first, end, n, expected_digest])
                require(current == batch_chain, 'batch-conflict')
                audit_row = self.db.execute('SELECT payload FROM audit WHERE sequence=?', (audit_seq,)).fetchone()
                require(audit_row is not None, 'batch-audit-conflict')
                event = strict_json(audit_row[0])
                require(event['attempt'] == attempt and event['kind'] == 'batch-committed' and
                        event['details'] == {'table': name, 'first': str(first), 'last': str(end),
                                             'rows': n, 'digest': expected_digest, 'chain': current},
                        'batch-audit-conflict')
                total += n
                last = end
            actual = self.db.execute('SELECT count(*) FROM staging_rows WHERE source_table=?', (name,)).fetchone()[0]
            require((last, total, current, actual) == (checkpoint, count, chain, count), 'checkpoint-conflict')
        require(self.db.execute('SELECT count(*) FROM staging_rows WHERE source_table NOT IN (SELECT name FROM table_state)').fetchone()[0] == 0,
                'orphan-staging-row')
        require(self.db.execute('SELECT count(*) FROM batches').fetchone()[0] == audit_batches and
                self.db.execute('SELECT count(*) FROM batches WHERE source_table NOT IN (SELECT name FROM table_state)').fetchone()[0] == 0,
                'batch-audit-conflict')

    def close(self):
        self.db.close()
        os.close(self.lock)


def validate_contract(mapping, inventory):
    require(mapping['schema_version'] == 1 and mapping['conversion_rules_version'] == 'cp017-lossless-raw-v1' and
            mapping['normalization_executed'] is False and mapping['production_migration_authorized'] is False and
            mapping['historical_verification'] == 'not-established' and
            mapping['relationship_rule'] == 'candidate-only-exact-typed-keys-no-automatic-joins', 'unsafe-contract')
    tables = mapping['tables']
    require(0 < len(tables) <= MAX_TABLES and len(tables) == mapping['table_count'] and
            len({t['source_table'] for t in tables}) == len(tables), 'invalid-contract-tables')
    require(sum(t['source_rows'] for t in tables) == mapping['source_row_count'], 'invalid-contract-counts')
    require(len(inventory['tables']) == len(tables) and
            {t['table'] for t in inventory['tables']} == {t['source_table'] for t in tables}, 'inventory-drift')
    require(schema_digest(sorted(({k: t[k] for k in ('table', 'sql', 'columns')} for t in inventory['tables']),
                                key=lambda t: t['table'])) == mapping['source_schema_sha256'], 'inventory-drift')
    for table in tables:
        quoted(table['source_table'])
        require(table['automatic_normalization'] is False and table['public_release'] is False and
                table['preserve_all_rows'] is True and table['initial_classification'] in
                ('restricted_pending_rights', 'review_required', 'audit_restricted', 'editorial_restricted'), 'unsafe-contract')
        require(type(table['source_rows']) is int and table['source_rows'] >= 0, 'invalid-contract-counts')
        require(0 < len(table['columns']) <= MAX_COLUMNS, 'invalid-contract-columns')
        original = next(t for t in inventory['tables'] if t['table'] == table['source_table'])
        require([c['source'] for c in table['columns']] == [c['name'] for c in original['columns']] and
                len({c['source'] for c in table['columns']}) == len(table['columns']), 'invalid-contract-columns')
        for column in table['columns']:
            quoted(column['source'])
            require(column['coercion'] == 'none' and column['raw_rule'] == 'preserve-sqlite-storage-class-and-value',
                    'unsafe-contract')


def envelope(source_hash, table, locator, cells, issues):
    return {'format': PROFILE, 'source_sha256': source_hash,
            'source_table': table['source_table'], 'locator': locator,
            'schema_sha256': table['schema_sha256'], 'raw_destination': table['raw_destination'],
            'classification': table['initial_classification'], 'disposition': 'quarantined',
            'historicalReview': 'unreviewed', 'rights': 'unreviewed',
            'normalization': 'not-attempted', 'cells': cells, 'issues': issues}


def stage(config, authorize):
    """Trusted, injectable worker entrypoint; authorize must be current and audited.

    Filesystem administration remains trusted; hashes provide tamper evidence,
    not protection against an administrator replacing the entire local ledger.
    """
    attempt = str(uuid.uuid4())
    store = source = reader = None
    last_receipt = None
    def gate(phase):
        nonlocal last_receipt
        last_receipt = None
        receipt = authorize(phase)
        # Direct boolean injection is reserved for controlled in-process tests.
        # The executable parent protocol always requires a UUID audit receipt.
        if receipt is True:
            last_receipt = None
        else:
            require(isinstance(receipt, str) and str(uuid.UUID(receipt)) == receipt, 'authorization-denied')
            last_receipt = receipt
    try:
        gate('start')
        require(set(config) == {'source_path', 'staging_directory', 'source_ref', 'workspace_id',
                                'subject_id', 'run_id', 'mapping', 'inventory', 'format'}, 'invalid-job')
        require(config['format'] in ('sqlite', 'typed-ndjson'), 'unsupported-format')
        mapping, inventory, ref = config['mapping'], config['inventory'], config['source_ref']
        validate_contract(mapping, inventory)
        require(ref['sha256'] == mapping['source_database_sha256'] and
                ref['size'] == mapping['source_database_bytes'], 'source-contract-mismatch')
        store = Store(config['staging_directory'])
        # Completed technical extraction is still quarantined. Never expose a
        # partially replayed, interrupted, conflicted or revoked attempt as done.
        with store.transaction():
            store.event(attempt, config['run_id'], 'attempt-start',
                        {'subject_id': config['subject_id'], 'workspace_id': config['workspace_id'],
                         'source_sha256': ref['sha256']}, last_receipt)
            store.db.execute("UPDATE status SET state='incomplete-quarantined'")
        store.verify(gate)
        source = Source(config['source_path'], ref['sha256'], ref['size'])
        source.verify(gate)
        gate('schema')
        reader_class = SQLiteRows if config['format'] == 'sqlite' else ExportRows
        reader = reader_class(source, mapping, inventory, gate)
        binding = {'profile': PROFILE, 'source_ref': ref, 'workspace_id': config['workspace_id'],
                   'mapping': mapping, 'inventory': inventory, 'format': config['format'],
                   'catalog': reader.catalog, 'catalog_sha256': digest(reader.catalog),
                   'limits': [MAX_CELL, MAX_ROW, MAX_BATCH, MAX_ROWS]}
        encoded = canonical(binding)
        with store.transaction():
            existing = store.db.execute('SELECT payload,hash FROM binding WHERE id=1').fetchone()
            if existing:
                require(existing == (encoded, digest(binding)), 'binding-conflict')
                store.event(attempt, config['run_id'], 'resume-or-replay', {'binding_sha256': digest(binding)}, last_receipt)
            else:
                require(store.db.execute('SELECT count(*) FROM staging_rows').fetchone()[0] == 0, 'binding-conflict')
                store.db.execute('INSERT INTO binding VALUES(1,?,?)', (encoded, digest(binding)))
                for table in mapping['tables']:
                    store.db.execute('INSERT INTO table_state VALUES(?,NULL,0,?)', (table['source_table'], ZERO))
                store.event(attempt, config['run_id'], 'source-validated', {'binding_sha256': digest(binding)}, last_receipt)
        def commit_batch(table, rows):
            if not rows:
                return
            gate('before-batch')
            source.unchanged()
            name = table['source_table']
            with store.transaction():
                checkpoint, count, previous = store.db.execute('SELECT checkpoint,rows,chain FROM table_state WHERE name=?', (name,)).fetchone()
                require(checkpoint is None or rows[0][0] > checkpoint, 'checkpoint-conflict')
                h = hashlib.sha256()
                for coordinate, payload, hashed in rows:
                    existing = store.db.execute('SELECT payload,hash FROM staging_rows WHERE source_sha256=? AND source_table=? AND locator=?',
                                                (ref['sha256'], name, coordinate)).fetchone()
                    require(existing is None, 'same-key-conflict')
                    store.db.execute('INSERT INTO staging_rows VALUES(?,?,?,?,?)',
                                     (ref['sha256'], name, coordinate, payload, hashed))
                    h.update(canonical([coordinate, hashed]).encode() + b'\n')
                batch_digest = h.hexdigest()
                chain = digest([previous, name, rows[0][0], rows[-1][0], len(rows), batch_digest])
                store.db.execute('UPDATE table_state SET checkpoint=?,rows=?,chain=? WHERE name=?',
                                 (rows[-1][0], count + len(rows), chain, name))
                # Parent authorizes the transaction already in flight. Its
                # durable decision UUID is bound to the local commit event.
                gate('commit-batch')
                source.unchanged()
                audit_sequence = store.event(attempt, config['run_id'], 'batch-committed',
                            {'table': name, 'first': str(rows[0][0]), 'last': str(rows[-1][0]),
                             'rows': len(rows), 'digest': batch_digest, 'chain': chain}, last_receipt)
                store.db.execute('INSERT INTO batches(source_table,first_locator,last_locator,rows,digest,previous_chain,chain,attempt,audit_sequence) VALUES(?,?,?,?,?,?,?,?,?)',
                                 (name, rows[0][0], rows[-1][0], len(rows), batch_digest, previous, chain, attempt, audit_sequence))
            gate('after-batch')
        for table in sorted(mapping['tables'], key=lambda t: t['source_table']):
            gate('table')
            checkpoint = store.db.execute('SELECT checkpoint FROM table_state WHERE name=?', (table['source_table'],)).fetchone()[0]
            batch, size = [], 0
            for coordinate, locator, cells, issues in reader.rows(table, checkpoint):
                payload = canonical(envelope(ref['sha256'], table, locator, cells, issues))
                length = len(payload.encode())
                require(length <= MAX_ROW, 'row-size-limit')
                if batch and (len(batch) >= MAX_ROWS or size + length > MAX_BATCH):
                    commit_batch(table, batch)
                    batch, size = [], 0
                batch.append((coordinate, payload, hashlib.sha256(payload.encode()).hexdigest()))
                size += length
            commit_batch(table, batch)
            actual = store.db.execute('SELECT rows FROM table_state WHERE name=?', (table['source_table'],)).fetchone()[0]
            require(actual == table['source_rows'], 'reconciliation-failed')
        gate('reconcile')
        source.verify(gate)
        store.verify(gate)
        gate('complete')
        with store.transaction():
            store.db.execute("UPDATE status SET state='complete-quarantined'")
            store.event(attempt, config['run_id'], 'attempt-complete',
                        {'rows': mapping['source_row_count'], 'tables': mapping['table_count'],
                         'source_sha256': ref['sha256'], 'schema_sha256': mapping['source_schema_sha256']}, last_receipt)
        audit_head = store.db.execute('SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1').fetchone()[0]
        return {'profile': PROFILE, 'status': 'complete-quarantined',
                'source_sha256': ref['sha256'], 'rows': mapping['source_row_count'],
                'tables': mapping['table_count'], 'audit_head': audit_head,
                'historicalReview': 'unreviewed', 'rights': 'unreviewed',
                'publicationApproved': False, 'publiclyAccessible': False}
    except Exception as error:
        code = str(error) if isinstance(error, Rejected) else 'worker-failed'
        if store:
            with store.transaction():
                store.db.execute("UPDATE status SET state='failed-quarantined'")
                store.event(attempt, config.get('run_id'), 'attempt-rejected', {'code': code}, last_receipt)
        raise Rejected(code) from None
    finally:
        if reader:
            reader.close()
        if source:
            source.close()
        if store:
            store.close()


def constrain():
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (3600, 3600))
    resource.setrlimit(resource.RLIMIT_FSIZE, (32 * 1024**3,) * 2)
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))


def main():
    constrain()
    try:
        config = strict_json(sys.stdin.buffer.readline(MAX_CONFIG + 1))
        def authorize(phase):
            print(canonical({'type': 'authorize', 'phase': phase}), flush=True)
            answer = strict_json(sys.stdin.buffer.readline(256))
            require(isinstance(answer, dict) and set(answer) == {'allowed', 'requestId'} and
                    answer['allowed'] is True and isinstance(answer['requestId'], str), 'authorization-denied')
            return answer['requestId']
        result = stage(config, authorize)
        print(canonical({'type': 'result', 'result': result}), flush=True)
    except Exception:
        # Codes and full evidence live only in the private store. No source
        # values, source paths or parser tracebacks enter process logs.
        print('{"type":"rejected"}', flush=True)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
