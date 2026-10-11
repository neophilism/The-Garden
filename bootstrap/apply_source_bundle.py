"""Bounded exact-byte source transport for a single authorized development branch."""
import hashlib
import json
import lzma
import os
from pathlib import Path, PurePosixPath

ROOT = Path.cwd().resolve()
def pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError('Duplicate JSON key')
        result[key] = value
    return result

def restore(packed, expected, root=ROOT):
    if len(packed)>262144 or hashlib.sha256(packed).hexdigest()!=expected:
        raise ValueError('Source transport digest or bound')
    dec=lzma.LZMADecompressor(memlimit=134217728)
    raw=dec.decompress(packed,max_length=2097153)
    if len(raw)>2097152 or not dec.eof or dec.unused_data:
        raise ValueError('Source decompression bound')
    doc=json.loads(raw,object_pairs_hook=pairs)
    if set(doc)!={'files'} or not isinstance(doc['files'],list) or not 1<=len(doc['files'])<=80:
        raise ValueError('Source inventory shape')
    writes=[];seen=set()
    for entry in doc['files']:
        if not isinstance(entry,dict) or set(entry)!={'path','previous_sha256','sha256','segments'}:
            raise ValueError('Source member shape')
        name=entry['path'];p=PurePosixPath(name)
        if name in seen or p.is_absolute() or '..' in p.parts or str(p)!=name or '\\' in name or not p.parts or p.parts[0] not in {'apps','packages','services','tests','docs','plan','registry','db','config','scripts','.exechub','README.md'}:
            raise ValueError('Source member path')
        seen.add(name);dest=root/name
        if not dest.resolve().is_relative_to(root) or any(v.is_symlink() for v in (dest,*dest.parents)):
            raise ValueError('Source member destination')
        previous=entry['previous_sha256'];old=''
        if dest.is_file():
            if dest.stat().st_size>1048576:raise ValueError('Original member bound')
            old=dest.read_text(encoding='utf-8')
        if previous is None:
            if dest.exists(): raise ValueError('New source already exists')
        elif not dest.is_file() or hashlib.sha256(dest.read_bytes()).hexdigest()!=previous:
            raise ValueError('Source changed since inspection')
        segments=entry['segments']
        if not isinstance(segments,list) or not 1<=len(segments)<=1000:raise ValueError('Segment count')
        parts=[];size=0
        for seg in segments:
            if isinstance(seg,str):part=seg
            elif isinstance(seg,list) and len(seg)==2 and all(type(x) is int for x in seg) and 0<=seg[0]<=seg[1]<=len(old):part=old[seg[0]:seg[1]]
            else:raise ValueError('Segment shape')
            size+=len(part.encode('utf-8'))
            if size>1048576:raise ValueError('Source member text bound')
            parts.append(part)
        data=''.join(parts).encode('utf-8')
        if hashlib.sha256(data).hexdigest()!=entry['sha256']:raise ValueError('Reconstructed source mismatch')
        writes.append((dest,data))
    for dest,data in writes:
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    for dest,data in writes:
        if dest.read_bytes()!=data:raise ValueError('Source write mismatch')
    print(str(len(writes))+' source files restored with exact previous/new bytes')

if __name__=='__main__':
    if os.environ.get('GITHUB_REPOSITORY')!='neophilism/The-Garden' or os.environ.get('GITHUB_REF')!=os.environ.get('EXPECTED_REF') or os.environ.get('GITHUB_ACTOR')!='neophilism':
        raise SystemExit('Unauthorized source transport context')
    paths=[ROOT/'bootstrap'/f'gdn037-{i:02}.part' for i in range(4)]
    if sum(p.stat().st_size for p in paths)!=15220:raise ValueError('Transport inventory mismatch')
    restore(b''.join(p.read_bytes() for p in paths),os.environ['SOURCE_SHA256'])
