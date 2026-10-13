#!/usr/bin/env python3
"""Read-only CP-018 ZIP structure profile. Never emits source values or names."""
import argparse
import collections
import hashlib
import json
import pathlib
import stat
import unicodedata
import zipfile

PARTS = ('CORE', 'EXPORTS', 'SOURCES', 'RECOVERY')
MAX_FILES = 4096
MAX_UNCOMPRESSED = 1024 * 1024 * 1024
MAX_METADATA = 512 * 1024
BLOCK = 4 * 1024 * 1024


def reject(reason):
    raise ValueError('CP-018 archive profile rejected: ' + reason)


def digest_and_size(path):
    h = hashlib.sha256()
    n = 0
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(BLOCK), b''):
            n += len(chunk)
            h.update(chunk)
    return n, h.hexdigest()


def members_and_shapes(path, evidence):
    suffixes = collections.Counter()
    json_kinds = collections.Counter()
    json_field_shapes = collections.Counter()
    files = 0
    expanded = 0
    unsafe = 0
    ndjson_documents = 0
    ndjson_unfinished = 0
    total_compressed = 0
    names = set()
    with zipfile.ZipFile(path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            files += 1
            if files > MAX_FILES:
                reject('member count limit')
            name = member.filename
            key = unicodedata.normalize('NFC', name).casefold()
            components = name.split('/')
            if (key in names or name.startswith('/') or '\\' in name
                or any(x in ('', '.', '..') for x in components)
                or not name.startswith('corpus_v1_18/')
                or member.flag_bits & 0x1
                or stat.S_ISLNK((member.external_attr >> 16) & 0o170000)):
                unsafe += 1
                continue
            names.add(key)
            expanded += member.file_size
            total_compressed += member.compress_size
            if expanded > MAX_UNCOMPRESSED:
                reject('uncompressed size limit')
            extension = pathlib.PurePosixPath(name).suffix.lower() or '(none)'
            suffixes[extension] += 1
            if extension == '.json' and member.file_size <= MAX_METADATA:
                with archive.open(member) as stream:
                    data = stream.read(MAX_METADATA + 1)
                if len(data) > MAX_METADATA:
                    json_kinds['oversized'] += 1
                    continue
                try:
                    value = json.loads(data.decode('utf-8'))
                except (UnicodeError, ValueError):
                    json_kinds['unreadable'] += 1
                    continue
                kind = 'object' if isinstance(value, dict) else 'array' if isinstance(value, list) else 'scalar'
                json_kinds[kind] += 1
                if isinstance(value, dict):
                    # Only a shape fingerprint (no keys or source values) leaves the worker.
                    descriptor = json.dumps(sorted(value), separators=(',', ':'), ensure_ascii=False)
                    fingerprint = hashlib.sha256(descriptor.encode()).hexdigest()[:16]
                    json_field_shapes[fingerprint] += 1
            if extension == '.ndjson':
                with archive.open(member) as stream:
                    last = b''
                    while (chunk := stream.read(65536)):
                        ndjson_documents += chunk.count(b'\n')
                        last = chunk[-1:]
                    if last and last != b'\n':
                        ndjson_documents += 1
                        ndjson_unfinished += 1
    if unsafe:
        reject('unsafe archive member paths or types')
    return {
        'component': evidence['component'],
        'archive_bytes': evidence['bytes'],
        'sha256': evidence['sha256'],
        'members': files,
        'expanded_bytes': expanded,
        'compressed_member_bytes': total_compressed,
        'file_suffix_counts': dict(sorted(suffixes.items())),
        'small_json_root_types': dict(sorted(json_kinds.items())),
        'json_root_field_set_hash_prefix_counts': dict(sorted(json_field_shapes.items())),
        'ndjson_line_count': ndjson_documents,
        'ndjson_final_unterminated_lines': ndjson_unfinished,
        'source_record_values_read_into_output': False,
        'archive_members_extracted': 0,
    }


def build_profile(directory, manifest):
    rows = []
    pending = manifest['external_materials']
    for part in PARTS:
        match = [x for x in pending if x['filename'].endswith('_' + part + '_2026-10-10.zip')]
        if len(match) != 1:
            reject('expected one original for ' + part)
        item = match[0]
        path = directory / item['filename']
        if path.is_symlink() or not path.is_file():
            reject('file absent or a symlink')
        size, sha = digest_and_size(path)
        if size != item['bytes'] or sha != item['sha256']:
            reject('source hash or byte size mismatch')
        rows.append(members_and_shapes(path, {'component': part, 'bytes': size, 'sha256': sha}))
    return {
        'profile_version': 1,
        'collection': 'CP-018 research corpus v1.18',
        'component_profiles': rows,
        'total_members': sum(x['members'] for x in rows),
        'total_ndjson_lines': sum(x['ndjson_line_count'] for x in rows),
        'limitations': [
            'Counts file containers and lines; does not classify historical claims or count independent witnesses.',
            'JSON shape hashes reveal no record values; .ndjson lines are not parsed, validated, or promoted.',
            'The archive source files remain external to GitHub and to the Garden staging database.',
            'No unzip extraction, database import, external network requests, or historical migrations performed.'
        ]
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-dir', type=pathlib.Path, required=True)
    p.add_argument('--manifest', type=pathlib.Path, required=True)
    p.add_argument('--output', type=pathlib.Path)
    args = p.parse_args(argv)
    try:
        report = build_profile(args.source_dir, json.loads(args.manifest.read_text(encoding='utf-8')))
    except (OSError, ValueError, zipfile.BadZipFile) as err:
        print(json.dumps({'status': 'rejected', 'reason': str(err)}))
        return 1
    text = json.dumps(report, indent=2, ensure_ascii=False) + '\n'
    if args.output:
        args.output.write_text(text, encoding='utf-8')
    else:
        print(text)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
