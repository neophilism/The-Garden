#!/usr/bin/env python3
"""Bounded, pinned import of approved documentation; no network or execution."""
from __future__ import annotations
import hashlib
import json
import lzma
from pathlib import Path, PurePosixPath
import sys

ROOT = Path(__file__).resolve().parents[1]
SHA256 = '7c88fce20299d5731217f18fb078fec0c73b1317fbc6a57f49fe24e0444ef247'
PARTS = 25
MAX_OUTPUT = 8 * 1024 * 1024
OMITTED = {'validation/reader-desktop.png', 'validation/reader-mobile.png', 'validation/reader-pr-example.png'}


def source_files() -> dict[str, str]:
    paths = [ROOT / 'bootstrap' / f'source-{n:02}.part' for n in range(PARTS)]
    if sorted((ROOT / 'bootstrap').glob('source-*.part')) != paths:
        raise ValueError('Transport is incomplete or contains unexpected chunks')
    if sum(p.stat().st_size for p in paths) != 216592:
        raise ValueError('Unexpected transport size')
    packed = b''.join(p.read_bytes() for p in paths)
    if hashlib.sha256(packed).hexdigest() != SHA256:
        raise ValueError('Approved source digest mismatch')
    dec = lzma.LZMADecompressor(memlimit=256 * 1024 * 1024)
    raw = dec.decompress(packed, max_length=MAX_OUTPUT + 1)
    if len(raw) > MAX_OUTPUT or not dec.eof or dec.unused_data:
        raise ValueError('Invalid or oversized source archive')
    files = json.loads(raw)
    if not isinstance(files, dict) or len(files) != 274:
        raise ValueError('Unexpected source inventory')
    for name, text in files.items():
        p = PurePosixPath(name)
        if not isinstance(text, str) or p.is_absolute() or '..' in p.parts or '.git' in p.parts or '\\' in name or str(p) != name:
            raise ValueError('Invalid source path or type')
        dest = ROOT / name
        if not dest.resolve().is_relative_to(ROOT) or any(v.is_symlink() for v in (dest, *dest.parents)):
            raise ValueError('Source destination escapes repository or uses a symlink')
    manifest = json.loads(files['MANIFEST.json'])
    entries = manifest['files']
    names = {entry['path'] for entry in entries}
    if len(names) != len(entries) or names - OMITTED != set(files) - {'MANIFEST.json'}:
        raise ValueError('Original manifest inventory mismatch')
    for entry in entries:
        if entry['path'] in OMITTED:
            continue
        data = files[entry['path']].encode('utf-8')
        if len(data) != entry['size_bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError(f"Original member mismatch: {entry['path']}")
    return files


def main() -> None:
    check = sys.argv[1:] == ['--check']
    if sys.argv[1:] not in ([], ['--check']):
        raise SystemExit('Usage: restore_plan.py [--check]')
    files = source_files()
    # Validate every destination before writing any file; never silently overwrite edits.
    for name, text in files.items():
        path = ROOT / name
        expected = text.encode('utf-8')
        if check:
            if not path.is_file() or path.read_bytes() != expected:
                raise ValueError(f'Restored bytes differ: {name}')
        elif path.exists() and (not path.is_file() or path.read_bytes() != expected) and name != 'README.md':
            raise ValueError(f'Refusing to replace changed file: {name}')
    if not check:
        for name, text in files.items():
            path = ROOT / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode('utf-8'))
    print(f'{len(files)} approved text files {"verified" if check else "restored"}; three historical PNG screenshots intentionally omitted.')


if __name__ == '__main__':
    main()
