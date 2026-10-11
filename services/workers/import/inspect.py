"""Bounded read-only inventory. Never execute archived SQL, XML, macros or code."""
import hashlib
import io
import json
import os
import posixpath
import resource
import sqlite3
import stat
import sys
import tempfile
import unicodedata
import zipfile

MAX_INPUT = 8 * 1024 * 1024
MAX_EXPANDED = 16 * 1024 * 1024
MAX_MEMBER = 8 * 1024 * 1024
MAX_ENTRIES = 256

def constrain():
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_INPUT,) * 2)
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    os.umask(0o077)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def detect(data):
    if data.startswith((b'PK\x03\x04', b'PK\x05\x06')):
        return 'application/zip'
    if data.startswith(b'SQLite format 3\x00'):
        return 'application/vnd.sqlite3'
    if data.startswith(b'%PDF-'):
        return 'application/pdf'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith(b'MZ') or data.startswith(b'\x7fELF'):
        return 'application/x-executable'
    try:
        text = data.decode('utf-8')
        if '\x00' in text:
            return 'application/octet-stream'
        if text.lstrip().startswith(('<', '<?xml')):
            return 'application/xml'
        if text.lstrip().startswith(('{', '[')):
            return 'application/json'
        return 'text/plain'
    except UnicodeDecodeError:
        return 'application/octet-stream'

def safe_name(name):
    if not name or len(name) > 512 or any(ord(c) < 32 or ord(c) == 127 for c in name):
        return False
    if name.startswith(('/', '\\')) or '\\' in name or ':' in name:
        return False
    parts = name.rstrip('/').split('/')
    return all(p not in ('', '.', '..') for p in parts) and posixpath.normpath(name.rstrip('/')) == name.rstrip('/')

def inventory_zip(data, report):
    total = 0
    seen = set()
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > MAX_ENTRIES:
            report['findings'].append('archive-entry-limit')
            return
        for item in entries:
            name = item.orig_filename
            normalized = unicodedata.normalize('NFC', name).casefold().rstrip('/')
            mode = item.external_attr >> 16
            if not safe_name(name) or normalized in seen or stat.S_ISLNK(mode) or stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR):
                report['findings'].append('archive-unsafe-path-or-type')
                return
            seen.add(normalized)
            if item.flag_bits & 1 or item.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                report['findings'].append('archive-encryption-or-method-unsupported')
                return
            if item.file_size > MAX_MEMBER or total + item.file_size > MAX_EXPANDED or item.file_size > max(1, item.compress_size) * 100:
                report['findings'].append('archive-expansion-limit')
                return
            if item.is_dir():
                if item.file_size != 0:
                    report['findings'].append('archive-malformed')
                    return
                continue
            h = hashlib.sha256()
            length = 0
            head = b''
            with archive.open(item, 'r') as member:
                while True:
                    chunk = member.read(65536)
                    if not chunk:
                        break
                    length += len(chunk)
                    total += len(chunk)
                    if length > MAX_MEMBER or total > MAX_EXPANDED or length > item.file_size:
                        report['findings'].append('archive-expansion-limit')
                        return
                    if len(head) < 65536:
                        head += chunk[:65536-len(head)]
                    h.update(chunk)
            if length != item.file_size:
                report['findings'].append('archive-truncated')
                return
            member_type = detect(head)
            # Detection is explicitly preliminary for members; no nested parser.
            report['members'].append({'path': name, 'size': length, 'sha256': h.hexdigest(), 'detectedType': member_type, 'inspection': 'bytes-only', 'disposition': 'quarantined'})
            if member_type == 'application/zip':
                report['findings'].append('nested-archive-not-inspected')
            if member_type in ('application/x-executable', 'application/xml') or name.lower().endswith(('.js', '.vbs', '.ps1', '.exe', '.dll', '.docm', '.xlsm', '.pptm')) or 'vbaproject' in name.lower():
                report['findings'].append('active-content-unreviewed')
        report['inventoryComplete'] = True

def inventory_sqlite(data, report):
    if len(data) < 100:
        report['findings'].append('sqlite-malformed')
        return
    with tempfile.TemporaryDirectory(prefix='garden-inspect-') as directory:
        path = os.path.join(directory, 'source.sqlite')
        with open(path, 'xb') as handle:
            handle.write(data)
        os.chmod(path, 0o400)
        db = sqlite3.connect('file:' + path + '?mode=ro&immutable=1', uri=True)
        try:
            db.enable_load_extension(False)
            db.execute('PRAGMA query_only=ON')
            db.execute('PRAGMA trusted_schema=OFF')
            ticks = [0]
            def progress():
                ticks[0] += 1
                return 1 if ticks[0] > 10000 else 0
            db.set_progress_handler(progress, 100)
            def authorize(action, arg1, arg2, database, trigger):
                if action in (sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ):
                    return sqlite3.SQLITE_OK
                if action == sqlite3.SQLITE_PRAGMA and arg1 == 'quick_check':
                    return sqlite3.SQLITE_OK
                return sqlite3.SQLITE_DENY
            db.set_authorizer(authorize)
            if db.execute('PRAGMA quick_check(1)').fetchall() != [('ok',)]:
                report['findings'].append('sqlite-integrity-failed')
                return
            rows = db.execute("SELECT type,name FROM sqlite_schema ORDER BY name LIMIT 257").fetchall()
            if len(rows) > 256 or any(len(name) > 512 for _, name in rows):
                report['findings'].append('sqlite-schema-limit')
                return
            report['database'] = {'integrity': 'quick-check-passed', 'schemaObjects': [{'kind': kind, 'name': name} for kind, name in rows], 'userRowsRead': 0}
            report['inventoryComplete'] = True
        finally:
            db.close()

def reject_constant(_):
    raise ValueError('Non-JSON constant')

def pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError('Duplicate JSON key')
        result[key] = value
    return result

def inspect(data):
    result = {'schemaVersion': 1, 'profile': 'garden-readonly-inventory-v1', 'sha256': sha(data), 'size': len(data), 'detectedType': detect(data), 'inventoryComplete': False, 'members': [], 'database': None, 'findings': [], 'disposition': 'quarantined'}
    if not data or len(data) > MAX_INPUT:
        result['findings'].append('input-size-limit')
        return result
    try:
        kind = result['detectedType']
        if kind == 'application/zip':
            inventory_zip(data, result)
        elif kind == 'application/vnd.sqlite3':
            inventory_sqlite(data, result)
        elif kind == 'application/json':
            json.loads(data.decode('utf-8'), object_pairs_hook=pairs, parse_constant=reject_constant)
            result['inventoryComplete'] = True
        elif kind == 'text/plain':
            result['inventoryComplete'] = True
        else:
            result['findings'].append('format-parser-unavailable')
    except (zipfile.BadZipFile, EOFError, OSError, RuntimeError, ValueError, sqlite3.Error, RecursionError, OverflowError, NotImplementedError):
        result['findings'].append('malformed-or-uninspectable')
    result['findings'] = sorted(set(result['findings']))
    return result

if __name__ == '__main__':
    constrain()
    payload = sys.stdin.buffer.read(MAX_INPUT + 1)
    output = json.dumps(inspect(payload), ensure_ascii=True, separators=(',', ':'))
    if len(output) > 1024 * 1024:
        raise SystemExit(2)
    sys.stdout.write(output)
