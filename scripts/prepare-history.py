"""One-time bounded source edit expansion; not application code or a scheduler."""
from pathlib import Path,PurePosixPath
import hashlib,json
root=Path(__file__).resolve().parents[1]
raw=(root/'bootstrap/history-edits.json').read_bytes();assert len(raw)<16000
rows=json.loads(raw);assert len(rows)==9
seen=set(); outputs=[]
for item in rows:
 name=item['path'];rel=PurePosixPath(name);p=root/name
 assert str(rel)==name and not rel.is_absolute() and '\\' not in name and not ({'..','.git','.github'}&set(rel.parts))
 assert name not in seen and p.resolve().is_relative_to(root) and not any(x.is_symlink() for x in (p,*p.parents));seen.add(name)
 if item['before'] is None: assert not p.exists();old=''
 else:
  oldbytes=p.read_bytes();assert hashlib.sha256(oldbytes).hexdigest()==item['before'],name;old=oldbytes.decode('utf-8')
 end=len(old)
 for edit in reversed(item['edits']):
  a=edit['start'];b=edit['end'];assert type(a) is int and type(b) is int and 0<=a<=b<=end;end=a
  old=old[:a]+edit['text']+old[b:]
 result=old.encode();assert hashlib.sha256(result).hexdigest()==item['after'],name;outputs.append((p,result))
for p,data in outputs:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
print('Nine exact-source history changes prepared; before/after digests passed.')
