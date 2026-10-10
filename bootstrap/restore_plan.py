#!/usr/bin/env python3
"""Bounded, pinned import of approved documentation; no network or execution."""
from __future__ import annotations
import base64
import hashlib
import json
import lzma
from pathlib import Path, PurePosixPath
import sys

ROOT = Path(__file__).resolve().parents[1]
SHA256 = '7c88fce20299d5731217f18fb078fec0c73b1317fbc6a57f49fe24e0444ef247'
PARTS = 14
MAX_OUTPUT = 8 * 1024 * 1024
OMITTED = {'validation/reader-desktop.png', 'validation/reader-mobile.png', 'validation/reader-pr-example.png'}

def source_files() -> dict[str, str]:
    paths = [ROOT / 'bootstrap' / f'part-{n:02}.b64' for n in range(PARTS)]
    if sorted((ROOT / 'bootstrap').glob('part-*.b64')) != paths:
        raise ValueError('Transport is incomplete or contains unexpected chunks')
    encoded = ''.join(p.read_text(encoding='ascii').strip() for p in paths)
    packed = base64.b64decode(encoded, validate=True)
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
        if not dest.resolve().is_relative_to(ROOT) or dest.is_symlink():
            raise ValueError('Source destination escapes repository')
    return files

def main() -> None:
    check = sys.argv[1:] == ['--check']
    if sys.argv[1:] not in ([], ['--check']):
        raise SystemExit('Usage: restore_plan.py [--check]')
    files = source_files()
    # The pinned archive digest authenticates the entire inventory, including its manifest.
    for name, text in files.items():
        path = ROOT / name
        expected = text.encode('utf-8')
        if check:
            if not path.is_file() or path.read_bytes() != expected:
                raise ValueError(f'Restored bytes differ: {name}')
        else:
            if path.exists() and path.read_bytes() != expected and name != 'README.md':
                raise ValueError(f'Refusing to replace changed file: {name}')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(expected)
    print(f'{len(files)} approved text files {"verified" if check else "restored"}; three historical PNG screenshots intentionally omitted.')

if __name__ == '__main__':
    main()
