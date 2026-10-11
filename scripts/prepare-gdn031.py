"""Bounded exact-byte preparation of locally reviewed GDN-031 source changes."""
from pathlib import Path, PurePosixPath
import base64, hashlib, json, lzma
ROOT=Path(__file__).resolve().parents[1]
encoded=''.join((ROOT/'bootstrap'/f'gdn031-{i}.part').read_text() for i in range(3))
assert len(encoded)==34080
packed=base64.b64decode(encoded,validate=True)
assert len(packed)==25560 and hashlib.sha256(packed).hexdigest()=='8f4cd3aabf60a2b1148c0843177f39f8133f3d9ef23f89e64c7f091093334982'
dec=lzma.LZMADecompressor(memlimit=256*1024*1024)
raw=dec.decompress(packed,max_length=1024*1024)
assert dec.eof and not dec.unused_data and len(raw)==90745
entries=json.loads(raw)
assert isinstance(entries,list) and len(entries)==32
seen=set(); prepared=[]
for item in entries:
    name=item['path']; rel=PurePosixPath(name); path=ROOT/name
    assert str(rel)==name and not rel.is_absolute() and not ({'..','.git'} & set(rel.parts)) and '\\' not in name
    assert name not in seen and path.resolve().is_relative_to(ROOT)
    assert not any(p.is_symlink() for p in (path,*path.parents))
    seen.add(name)
    if item['before'] is None:
        assert not path.exists(),name
        old=''
    else:
        old_bytes=path.read_bytes()
        assert hashlib.sha256(old_bytes).hexdigest()==item['before'],name
        old=old_bytes.decode('utf-8')
    edits=item['edits']; assert len(edits)==1
    edit=edits[0]; a=edit['start']; b=edit['end']
    assert type(a) is int and type(b) is int and 0<=a<=b<=len(old) and isinstance(edit['text'],str)
    result=(old[:a]+edit['text']+old[b:]).encode('utf-8')
    assert hashlib.sha256(result).hexdigest()==item['after'],name
    prepared.append((path,result))
for path,data in prepared:
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
print('Prepared 32 source files; every before/after digest verified; no cloud operations.')
