"""Apply only a digest-pinned, fully prevalidated source delta on its work branch."""
from pathlib import Path,PurePosixPath
import base64,hashlib,json,lzma,subprocess
ROOT=Path(__file__).resolve().parents[2]
EXPECTED='5a206138cb0bddb190646889eb5b709f2865189cba68f0def882b3a5c581c516'
PARTS=4
paths=[ROOT/'.transfer/gdn035'/f'part-{i:02}.txt' for i in range(PARTS)]
encoded=''.join(p.read_text() for p in paths)
if len(encoded)!=25712:raise ValueError('transfer_length')
packed=base64.b64decode(encoded,validate=True)
if hashlib.sha256(packed).hexdigest()!=EXPECTED:raise ValueError('transfer_digest')
dec=lzma.LZMADecompressor(memlimit=256*1024*1024)
raw=dec.decompress(packed,max_length=2000000)
if not dec.eof or dec.unused_data:raise ValueError('transfer_bounds')
bundle=json.loads(raw)
if bundle['version']!=1 or bundle['base_commit']!='9dab5f939c987d7b67e1f20d60ff33f812004a35' or len(bundle['files'])!=19:raise ValueError('transfer_identity')
subprocess.run(['git','merge-base','--is-ancestor',bundle['base_commit'],'HEAD'],cwd=ROOT,check=True)
outputs={}
for item in bundle['files']:
 name=item['path'];rel=PurePosixPath(name);path=ROOT/name
 if rel.is_absolute() or '..' in rel.parts or '.git' in rel.parts or '\\' in name or str(rel)!=name or name in outputs or not path.resolve().is_relative_to(ROOT) or any(p.is_symlink() for p in (path,*path.parents)):raise ValueError('transfer_path')
 before=path.read_bytes() if path.is_file() else None
 if (hashlib.sha256(before).hexdigest() if before is not None else None)!=item['before']:raise ValueError('source_changed:'+name)
 if 'text' in item:content=item['text'].encode('utf-8')
 else:
  doc=json.loads(before)
  for op in item['json_patch']:
   keys=[x.replace('~1','/').replace('~0','~') for x in op['path'].split('/')[1:]]
   if not keys:raise ValueError('root_replacement_forbidden')
   node=doc
   for k in keys[:-1]:node=node[int(k)] if isinstance(node,list) else node[k]
   key=int(keys[-1]) if isinstance(node,list) else keys[-1]
   if op['op']=='remove':del node[key]
   elif op['op'] in ('add','replace'):node[key]=op['value']
   else:raise ValueError('patch_operation')
  text=json.dumps(doc,separators=(',',':')) if item['json_format']=='compact' else json.dumps(doc,indent=2)
  content=(text+'\n').encode('utf-8')
 if hashlib.sha256(content).hexdigest()!=item['after']:raise ValueError('output_digest:'+name)
 outputs[name]=content
for name,content in outputs.items():
 path=ROOT/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(content)
subprocess.run(['git','add','--',*outputs.keys()],cwd=ROOT,check=True)
print('Applied 19 exact reviewed source files; no cloud or production data touched.')
