import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,readSync,writeSync,fsyncSync,fstatSync,lstatSync,
 realpathSync,mkdirSync,existsSync,linkSync,unlinkSync,chmodSync,readdirSync} from 'node:fs';
import {isAbsolute,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {UPLOAD_CHUNK_BYTES,UPLOAD_MAX_BYTES,uploadSourceRef} from './resumable-uploads.mjs';

const REPO_ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const ZERO='0'.repeat(64), ID=/^[a-f0-9-]{36}$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const reject=()=>{throw new Error('Garden upload repository rejected');};
const require=value=>{if(!value)reject();};
const SCHEMA=`
CREATE TABLE upload_sessions(
 uploadId TEXT PRIMARY KEY, workspaceId TEXT NOT NULL, subjectId TEXT NOT NULL,
 sourceId TEXT NOT NULL, version TEXT NOT NULL, sha256 TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size>0), declaredType TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('receiving','paused','complete-quarantined','aborted','purged')),
 createdMs INTEGER NOT NULL, expiresMs INTEGER NOT NULL,
 UNIQUE(sourceId,version));
CREATE TABLE upload_chunks(
 uploadId TEXT NOT NULL REFERENCES upload_sessions(uploadId), chunkIndex INTEGER NOT NULL,
 size INTEGER NOT NULL, sha256 TEXT NOT NULL, PRIMARY KEY(uploadId,chunkIndex));
CREATE TABLE upload_events(
 sequence INTEGER PRIMARY KEY, uploadId TEXT NOT NULL REFERENCES upload_sessions(uploadId),
 payload TEXT NOT NULL, previous TEXT NOT NULL, hash TEXT NOT NULL);
`;
function identity(st){return `${st.dev}:${st.ino}:${st.size}:${st.mtimeMs}:${st.ctimeMs}`;}
function privatePath(path,directory=false){
 const st=lstatSync(path);
 require((directory?st.isDirectory():st.isFile())&&st.uid===process.getuid()&&
  (st.mode&0o7077)===0&&(directory||st.nlink===1));
 return st;
}
function directory(path){if(!existsSync(path))mkdirSync(path,{mode:0o700});privatePath(path,true);}
function syncDirectory(path){const fd=openSync(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(fd);}finally{closeSync(fd);}}
function writeAll(fd,bytes){for(let offset=0;offset<bytes.length;){const n=writeSync(fd,bytes,offset,bytes.length-offset);require(n>0);offset+=n;}}
function removeTemporary(path){if(existsSync(path)){privatePath(path);unlinkSync(path);}}
function detectedType(prefix){
 if(prefix.subarray(0,16).equals(Buffer.from('SQLite format 3\0')))return 'application/vnd.sqlite3';
 if(['504b0304','504b0506','504b0708'].includes(prefix.subarray(0,4).toString('hex')))return 'application/zip';
 if(prefix.subarray(0,5).toString('ascii')==='%PDF-')return 'application/pdf';
 if(prefix.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return 'image/png';
 if(prefix.subarray(0,3).toString('hex')==='ffd8ff')return 'image/jpeg';
 return null;
}
async function visitFile(path,size,sha256,gate,consume=()=>{}){
 const initial=privatePath(path);require(initial.size===size);
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  require(identity(fstatSync(fd))===identity(initial));
  const digest=createHash('sha256'),buffer=Buffer.alloc(65536);let total=0,prefix=Buffer.alloc(0);
  for(;;){
   const n=readSync(fd,buffer,0,buffer.length,null);if(!n)break;
   total+=n;require(total<=size);
   const part=buffer.subarray(0,n);digest.update(part);consume(part);
   if(prefix.length<16)prefix=Buffer.concat([prefix,part.subarray(0,16-prefix.length)]);
   if(total%UPLOAD_CHUNK_BYTES===0)await gate('verify-bytes');
  }
  require(total===size&&digest.digest('hex')===sha256&&identity(fstatSync(fd))===identity(initial)&&identity(privatePath(path))===identity(initial));
  return prefix;
 }finally{closeSync(fd);}
}

/** Linux/private-volume adapter; no provider upload or HTTP endpoint. Uses real
 * SQLite transactions and fsync-before-checkpoint files. The process/volume
 * administrator is trusted; independent anchoring, encryption and isolation are
 * activation requirements. Quotas reserve two copies: chunks plus assembly.
 */
export function createPrivateUploadRepository({root,workspaceQuotaBytes,ownerQuotaBytes,
 globalQuotaBytes=workspaceQuotaBytes,maxOpenSessions=1024,
 maxSourceBytes=UPLOAD_MAX_BYTES,lifetimeMs=86400000,now=Date.now}){
 require(typeof root==='string'&&isAbsolute(root)&&resolve(root)===root&&realpathSync(root)===root);
 privatePath(root,true);
 const inside=relative(REPO_ROOT,root);require(inside==='..'||inside.startsWith('../'));
 require([globalQuotaBytes,maxOpenSessions,workspaceQuotaBytes,ownerQuotaBytes,maxSourceBytes,lifetimeMs].every(Number.isSafeInteger)&&
  maxSourceBytes>0&&maxSourceBytes<=UPLOAD_MAX_BYTES&&workspaceQuotaBytes>0&&workspaceQuotaBytes<=128*1024**3&&
  globalQuotaBytes>=workspaceQuotaBytes&&globalQuotaBytes<=128*1024**3&&maxOpenSessions>=1&&maxOpenSessions<=16384&&
  ownerQuotaBytes>0&&ownerQuotaBytes<=workspaceQuotaBytes&&lifetimeMs>0&&lifetimeMs<=7*86400000&&typeof now==='function');
 const path=join(root,'uploads.sqlite');
 if(!existsSync(path)){const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);closeSync(fd);syncDirectory(root);}
 privatePath(path);
 const db=new DatabaseSync(path,{allowExtension:false});let tail=Promise.resolve(),closed=false;
 try{
  db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=0; PRAGMA cache_size=-2048; PRAGMA mmap_size=0;');
  if(db.prepare('SELECT count(*) AS n FROM sqlite_schema').get().n===0)db.exec('BEGIN IMMEDIATE;'+SCHEMA+'COMMIT;');
  const expected=new DatabaseSync(':memory:');
  try{
   expected.exec(SCHEMA);const sql='SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name';
   require(JSON.stringify(db.prepare(sql).all())===JSON.stringify(expected.prepare(sql).all()));
  }finally{expected.close();}
  require(Object.values(db.prepare('PRAGMA quick_check(1)').get())[0]==='ok');
  let previous=ZERO,sequence=0;
  for(const e of db.prepare('SELECT * FROM upload_events ORDER BY sequence').iterate()){
   require(e.sequence===++sequence&&e.previous===previous&&e.hash===hash(previous+'\n'+e.payload));previous=e.hash;
  }
 }catch{db.close();reject();}
 const one=(sql,...args)=>db.prepare(sql).get(...args);
 const run=(sql,...args)=>db.prepare(sql).run(...args);
 const sessionDir=row=>join(root,row.uploadId);
 const chunkPath=(row,index)=>join(sessionDir(row),`chunk-${index}`);
 function event(row,kind,requestId,details={}){
  const prior=one('SELECT sequence,hash FROM upload_events ORDER BY sequence DESC LIMIT 1');
  const sequence=(prior?.sequence??0)+1,previous=prior?.hash??ZERO;
  const payload=JSON.stringify({sequence,uploadId:row.uploadId,kind,requestId,atMs:now(),details});
  run('INSERT INTO upload_events VALUES(?,?,?,?,?)',sequence,row.uploadId,payload,previous,hash(previous+'\n'+payload));
 }
 function receipt(row,afterIndex=-1){
  // Report exact-byte duplicates only within this contributor's own workspace.
  // Never reveal cross-contributor matches or infer a historical duplicate.
  let duplicateOfUploadId=null;
  if(row.state==='complete-quarantined'){
   duplicateOfUploadId=one("SELECT uploadId FROM upload_sessions WHERE workspaceId=? AND subjectId=? AND sha256=? AND size=? AND declaredType=? AND state='complete-quarantined' AND uploadId<>? ORDER BY createdMs,uploadId LIMIT 1",
    row.workspaceId,row.subjectId,row.sha256,row.size,row.declaredType,row.uploadId)?.uploadId??null;
  }
  const counts=one('SELECT count(*) AS n,coalesce(sum(size),0) AS bytes FROM upload_chunks WHERE uploadId=?',row.uploadId);
  const chunks=db.prepare('SELECT chunkIndex AS "index",size,sha256 FROM upload_chunks WHERE uploadId=? AND chunkIndex>? ORDER BY chunkIndex LIMIT 128').all(row.uploadId,afterIndex);
  const head=one('SELECT hash FROM upload_events WHERE uploadId=? ORDER BY sequence DESC LIMIT 1',row.uploadId)?.hash??ZERO;
  const state=now()>=row.expiresMs&&['receiving','paused','aborted'].includes(row.state)?'expired-retained':row.state;
  return Object.freeze({uploadId:row.uploadId,state,expectedBytes:row.size,expectedSha256:row.sha256,
   chunkBytes:UPLOAD_CHUNK_BYTES,totalChunks:Math.ceil(row.size/UPLOAD_CHUNK_BYTES),receivedChunks:counts.n,receivedBytes:counts.bytes,
   chunks:chunks.map(c=>Object.freeze({...c})),nextAfterIndex:chunks.length===128?chunks.at(-1).index:null,
   expiresMs:row.expiresMs,auditHead:head,bytesVerified:row.state==='complete-quarantined',
   sourceRef:row.state==='complete-quarantined'?uploadSourceRef(row):null,
   duplicateOfUploadId,
   storageLocation:'private-offline-quarantine',malware:'unavailable',historicalReview:'unreviewed',rights:'unreviewed',
   publicationApproved:false,publiclyAccessible:false});
 }
 function serial(work){const result=tail.then(()=>{require(!closed);return work();});tail=result.catch(()=>{});return result;}
 async function transaction(work){
  db.exec('BEGIN IMMEDIATE');
  try{const result=await work();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}
 }
 function owned(ctx,id){
  require(ID.test(id));const row=one('SELECT * FROM upload_sessions WHERE uploadId=?',id);
  require(row&&row.workspaceId===ctx.workspaceId&&row.subjectId===ctx.subjectId);return row;
 }
 const active=row=>require(now()<row.expiresMs&&row.state==='receiving');
 function operation(kind,work){return (ctx,input)=>serial(async()=>{
  let admitted=null;
  try{return await transaction(async()=>{
   const row=owned(ctx,input.uploadId);
   await ctx.gate('session-bound',uploadSourceRef(row));admitted=row;
   directory(sessionDir(row));syncDirectory(root);
   const result=await work(ctx,row,input);
   return result;
  });}catch{
   if(admitted)await transaction(async()=>event(admitted,'operation-rejected',ctx.requestId,{operation:kind}));
   reject();
  }
 });}
 const api={
  start:(ctx,spec)=>serial(()=>transaction(async()=>{
   require(spec.size<=maxSourceBytes);
   const existing=one('SELECT * FROM upload_sessions WHERE uploadId=?',spec.uploadId);
   if(existing){
    const row=owned(ctx,spec.uploadId);
    require(['sourceId','version','sha256','size','declaredType'].every(k=>row[k]===spec[k]));
    await ctx.gate('session-bound',uploadSourceRef(row));
    event(row,'start-replayed',await ctx.gate('commit'));return receipt(row);
   }
   const global=one("SELECT count(*) AS sessions,coalesce(sum(size*2),0) AS bytes FROM upload_sessions WHERE state<>'purged'");
   require(global.sessions<maxOpenSessions&&global.bytes+spec.size*2<=globalQuotaBytes);
   const total=one("SELECT coalesce(sum(size*2),0) AS n FROM upload_sessions WHERE workspaceId=? AND state<>'purged'",ctx.workspaceId).n;
   const owner=one("SELECT coalesce(sum(size*2),0) AS n FROM upload_sessions WHERE workspaceId=? AND subjectId=? AND state<>'purged'",ctx.workspaceId,ctx.subjectId).n;
   require(total+spec.size*2<=workspaceQuotaBytes&&owner+spec.size*2<=ownerQuotaBytes);
   const at=now();require(Number.isSafeInteger(at)&&at>=0);
   const row={...spec,workspaceId:ctx.workspaceId,subjectId:ctx.subjectId,state:'receiving',createdMs:at,expiresMs:at+lifetimeMs};
   await ctx.gate('session-bound',uploadSourceRef(row));
   run('INSERT INTO upload_sessions VALUES(?,?,?,?,?,?,?,?,?,?,?)',row.uploadId,row.workspaceId,row.subjectId,row.sourceId,row.version,row.sha256,row.size,row.declaredType,row.state,row.createdMs,row.expiresMs);
   event(row,'session-created',await ctx.gate('commit'),{reservedBytes:row.size*2});return receipt(row);
  })),
  chunk:operation('chunk',async(ctx,row,spec)=>{
   active(row);require(spec.index<Math.ceil(row.size/UPLOAD_CHUNK_BYTES));
   const size=Math.min(UPLOAD_CHUNK_BYTES,row.size-spec.index*UPLOAD_CHUNK_BYTES);
   require(spec.bytes.length===size&&hash(spec.bytes)===spec.sha256);
   const prior=one('SELECT size,sha256 FROM upload_chunks WHERE uploadId=? AND chunkIndex=?',row.uploadId,spec.index);
   if(prior)require(prior.size===size&&prior.sha256===spec.sha256);
   const target=chunkPath(row,spec.index),temporary=target+'.partial';
   if(existsSync(target))await visitFile(target,size,spec.sha256,ctx.gate);
   else{
    require(!prior);removeTemporary(temporary);
    const fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    try{writeAll(fd,spec.bytes);fsyncSync(fd);}finally{closeSync(fd);}
    linkSync(temporary,target);unlinkSync(temporary);chmodSync(target,0o400);syncDirectory(sessionDir(row));
   }
   const stamp=identity(privatePath(target));
   const requestId=await ctx.gate('commit');active(row);require(identity(privatePath(target))===stamp);
   if(!prior)run('INSERT INTO upload_chunks VALUES(?,?,?,?)',row.uploadId,spec.index,size,spec.sha256);
   event(row,prior?'chunk-replayed':'chunk-received',requestId,{index:spec.index,size,sha256:spec.sha256});return receipt(row);
  }),
  status:operation('status',async(ctx,row,spec)=>{
   event(row,'status-read',await ctx.gate('commit'));return receipt(row,spec.afterIndex);
  }),
  pause:operation('pause',async(ctx,row)=>{
   require(now()<row.expiresMs&&['receiving','paused'].includes(row.state));row.state='paused';
   run('UPDATE upload_sessions SET state=? WHERE uploadId=?',row.state,row.uploadId);
   event(row,'paused',await ctx.gate('commit'));return receipt(row);
  }),
  resume:operation('resume',async(ctx,row)=>{
   require(now()<row.expiresMs&&['receiving','paused'].includes(row.state));row.state='receiving';
   run('UPDATE upload_sessions SET state=? WHERE uploadId=?',row.state,row.uploadId);
   event(row,'resumed',await ctx.gate('commit'));return receipt(row);
  }),
  finalize:operation('finalize',async(ctx,row)=>{
   require(row.state==='complete-quarantined'||(row.state==='receiving'&&now()<row.expiresMs));
   const n=one('SELECT count(*) AS n FROM upload_chunks WHERE uploadId=?',row.uploadId).n;
   require(n===Math.ceil(row.size/UPLOAD_CHUNK_BYTES));
   const original=join(sessionDir(row),'original.bin'),temporary=join(sessionDir(row),'assembly.partial');
   const already=existsSync(original);if(row.state==='complete-quarantined')require(already);
   let fd=null,total=0,prefix=Buffer.alloc(0);const digest=createHash('sha256');
   if(!already){removeTemporary(temporary);fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
   try{
    for(let index=0;index<n;index++){
     const part=one('SELECT size,sha256 FROM upload_chunks WHERE uploadId=? AND chunkIndex=?',row.uploadId,index);
     require(part&&part.size===Math.min(UPLOAD_CHUNK_BYTES,row.size-index*UPLOAD_CHUNK_BYTES));
     await ctx.gate('assemble-chunk');
     await visitFile(chunkPath(row,index),part.size,part.sha256,ctx.gate,bytes=>{
      total+=bytes.length;require(total<=row.size);digest.update(bytes);if(fd!==null)writeAll(fd,bytes);
      if(prefix.length<16)prefix=Buffer.concat([prefix,bytes.subarray(0,16-prefix.length)]);
     });
    }
    require(total===row.size&&digest.digest('hex')===row.sha256&&detectedType(prefix)===row.declaredType);
    if(fd!==null)fsyncSync(fd);
   }finally{if(fd!==null)closeSync(fd);}
   if(already)await visitFile(original,row.size,row.sha256,ctx.gate);
   else{linkSync(temporary,original);unlinkSync(temporary);chmodSync(original,0o400);syncDirectory(sessionDir(row));}
   // The final digest, owner/source grant and durable audit must succeed before
   // the database exposes an original reference. A killed transaction retries.
   const stamp=identity(privatePath(original));
   const requestId=await ctx.gate('commit');if(row.state!=='complete-quarantined')active(row);
   require(identity(privatePath(original))===stamp);
   row.state='complete-quarantined';run('UPDATE upload_sessions SET state=? WHERE uploadId=?',row.state,row.uploadId);
   event(row,'finalized-quarantined',requestId,{size:row.size,sha256:row.sha256});return receipt(row);
  }),
  abort:operation('abort',async(ctx,row)=>{
   require(['receiving','paused','aborted'].includes(row.state));row.state='aborted';
   run('UPDATE upload_sessions SET state=? WHERE uploadId=?',row.state,row.uploadId);
   event(row,'aborted-retained',await ctx.gate('commit'));return receipt(row);
  }),
  expire:operation('expire',async(ctx,row)=>{
   require(row.state!=='complete-quarantined'&&now()>=row.expiresMs);
   // An assembled orphan is valuable evidence: retain it for explicit review.
   require(!existsSync(join(sessionDir(row),'original.bin')));
   const names=readdirSync(sessionDir(row));require(names.length<=Math.ceil(row.size/UPLOAD_CHUNK_BYTES)*2+1);
   for(const name of names)require(/^(chunk-[0-9]+(\.partial)?|assembly\.partial)$/.test(name));
   await ctx.gate('purge-abandoned');
   for(const name of names){const path=join(sessionDir(row),name);privatePath(path);unlinkSync(path);}
   syncDirectory(sessionDir(row));
   // File removal before the transaction commits is idempotent after a crash;
   // no active or finalized session can be purged through this path.
   run('DELETE FROM upload_chunks WHERE uploadId=?',row.uploadId);
   row.state='purged';run('UPDATE upload_sessions SET state=? WHERE uploadId=?',row.state,row.uploadId);
   event(row,'expired-chunks-purged',await ctx.gate('commit'));return receipt(row);
  }),
  resolveSource:(principal,ref)=>serial(()=>transaction(async()=>{
   const row=one('SELECT * FROM upload_sessions WHERE workspaceId=? AND sourceId=? AND version=?',principal.workspaceId,ref.sourceId,ref.version);
   require(row&&row.subjectId===principal.subjectId&&row.state==='complete-quarantined'&&
    row.declaredType==='application/vnd.sqlite3'&&Object.keys(ref).length===Object.keys(uploadSourceRef(row)).length&&
    Object.entries(uploadSourceRef(row)).every(([k,v])=>ref[k]===v));
   privatePath(sessionDir(row),true);const sourcePath=join(sessionDir(row),'original.bin');
   require(privatePath(sourcePath).size===row.size);
   const stagingDirectory=join(sessionDir(row),'staging');directory(stagingDirectory);syncDirectory(sessionDir(row));
   return Object.freeze({workspaceId:row.workspaceId,sourceRef:uploadSourceRef(row),sourcePath,stagingDirectory,
    format:'sqlite',classification:'restricted_research',
    quarantine:Object.freeze({disposition:'quarantined',released:false,malware:'unavailable'})});
  })),
  close:()=>serial(()=>{closed=true;db.close();})
 };
 return Object.freeze(api);
}
