"""Bounded exact-source restoration; authorization for workflow changes is separate."""
from pathlib import Path,PurePosixPath
import base64,hashlib,json,lzma
ROOT=Path(__file__).resolve().parents[1]
encoded=''.join((ROOT/'bootstrap'/f'gdn039-{i}.part').read_text() for i in range(3))
assert len(encoded)==42504
packed=base64.b64decode(encoded,validate=True)
assert len(packed)==31876 and hashlib.sha256(packed).hexdigest()=='29ecb477641148763dcf7d5b5877583ec5b3b9eabc3511f33e8d580c18cad698'
dec=lzma.LZMADecompressor(memlimit=256*1024*1024)
raw=dec.decompress(packed,max_length=1024*1024)
assert dec.eof and not dec.unused_data and len(raw)==143734
rows=json.loads(raw);assert isinstance(rows,list) and len(rows)==24
seen=set();outputs=[]
for item in rows:
 name=item['path'];rel=PurePosixPath(name);path=ROOT/name
 assert str(rel)==name and not rel.is_absolute() and not ({'..','.git'}&set(rel.parts)) and '\\' not in name
 assert name not in seen and path.resolve().is_relative_to(ROOT) and not any(p.is_symlink() for p in (path,*path.parents));seen.add(name)
 if name=='.github/workflows/data.yml':
  assert hashlib.sha256(path.read_bytes()).hexdigest()==item['after'],name
  continue
 if item['before'] is None:
  assert not path.exists(),name
  old=''
 else:
  source=path.read_bytes();assert hashlib.sha256(source).hexdigest()==item['before'],name;old=source.decode('utf-8')
 assert len(item['edits'])==1
 edit=item['edits'][0];a=edit['start'];b=edit['end']
 assert type(a) is int and type(b) is int and 0<=a<=b<=len(old) and isinstance(edit['text'],str)
 result=(old[:a]+edit['text']+old[b:]).encode('utf-8');assert hashlib.sha256(result).hexdigest()==item['after'],name
 outputs.append((path,result))
for path,data in outputs:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
print('23 exact ordinary files prepared; separately authorized workflow verified; no cloud writes.')
