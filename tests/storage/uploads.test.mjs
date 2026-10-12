import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,chmod,symlink,stat,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createResumableUploads,UPLOAD_CHUNK_BYTES as CHUNK,UPLOAD_MAX_BYTES} from '../../services/workers/src/resumable-uploads.mjs';
import {createPrivateUploadRepository} from '../../services/workers/src/upload-repository.mjs';
import {createCorpusStaging,createOfflineStagingWorker} from '../../services/workers/src/corpus-staging.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const workspaceId='eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
function source(size=CHUNK+31){const b=Buffer.alloc(size,65);Buffer.from('SQLite format 3\0').copy(b);return b;}
async function fixture(t,{bytes=source(),...options}={}){
 const root=await mkdtemp(join(tmpdir(),'garden-uploads-'));let clock=1000,actor='synthetic-owner',allow=true,onGate=async()=>{};
 const configuration={root,workspaceQuotaBytes:64*CHUNK,ownerQuotaBytes:32*CHUNK,lifetimeMs:10000,now:()=>clock,...options};
 let repo=createPrivateUploadRepository(configuration);
 const decisions={async decide(headers,w,evaluate){const requestId=randomUUID();const allowed=await evaluate({workspaceId:w,subjectId:actor,requestId});return {allowed,requestId};}};
 let api;
 const rebuild=()=>{api=createResumableUploads({decisions,repository:repo,enabled:()=>true,authorize:async(facts,op)=>{await onGate(op);return allow;}});};rebuild();
 const input={uploadId:randomUUID(),sourceId:randomUUID(),version:randomUUID(),size:bytes.length,sha256:hash(bytes),declaredType:'application/vnd.sqlite3'};
 const f={root,bytes,input,configuration,decisions,get repo(){return repo;},get api(){return api;},
  actor:v=>{actor=v;},allow:v=>{allow=v;},clock:v=>{clock=v;},hook:fn=>{onGate=fn;},
  async reopen(){await repo.close();repo=createPrivateUploadRepository(configuration);rebuild();},
  start:()=>api.start({},workspaceId,input),
  chunk:(index=0,body=bytes.subarray(index*CHUNK,Math.min(bytes.length,(index+1)*CHUNK)))=>api.chunk({},workspaceId,{uploadId:input.uploadId,index,sha256:hash(body),bytes:body}),
  status:()=>api.status({},workspaceId,{uploadId:input.uploadId,afterIndex:-1}),
  finalize:()=>api.finalize({},workspaceId,{uploadId:input.uploadId}),
  async all(){await f.start();for(let i=0;i<Math.ceil(bytes.length/CHUNK);i++)await f.chunk(i);return f.finalize();}
 };
 t.after(async()=>{try{await repo.close();}catch{}await rm(root,{recursive:true,force:true});});return f;
}

test('partial and out-of-order uploads remain incomplete until all bytes verified',async t=>{
 const f=await fixture(t),start=await f.start();assert.equal(start.sourceRef,null);assert.equal(start.bytesVerified,false);
 await f.chunk(1);await assert.rejects(f.finalize);assert.equal((await f.status()).receivedChunks,1);
 await f.chunk(0);const result=await f.finalize();assert.equal(result.state,'complete-quarantined');assert.equal(result.bytesVerified,true);
 assert.equal(result.historicalReview,'unreviewed');assert.equal(result.rights,'unreviewed');assert.equal(result.malware,'unavailable');assert.equal(result.publiclyAccessible,false);
 assert.equal(result.storageLocation,'private-offline-quarantine');
 assert.equal(hash(await readFile(join(f.root,f.input.uploadId,'original.bin'))),f.input.sha256);
});
test('large upload passes the old 8 MiB boundary with bounded chunks',async t=>{
 const f=await fixture(t,{bytes:source(9*CHUNK+57)}),result=await f.all();assert.equal(result.receivedChunks,10);assert.equal(result.receivedBytes,f.bytes.length);
});
test('pause/resume preserves progress across a repository restart',async t=>{
 const f=await fixture(t);await f.start();await f.chunk();await f.api.pause({},workspaceId,{uploadId:f.input.uploadId});await assert.rejects(()=>f.chunk(1));
 await f.reopen();assert.equal((await f.status()).state,'paused');await f.api.resume({},workspaceId,{uploadId:f.input.uploadId});await f.chunk(1);await f.finalize();
});
test('chunk and completion replay preserve bytes and received counts',async t=>{
 const f=await fixture(t);await f.start();await f.chunk();await f.chunk();assert.equal((await f.status()).receivedChunks,1);
 await f.chunk(1);const first=await f.finalize();await f.reopen();const second=await f.finalize();assert.deepEqual(first.sourceRef,second.sourceRef);assert.equal(second.receivedChunks,2);
 assert.equal((await f.start()).state,'complete-quarantined');
});
test('conflicting chunks and manifest replays cannot overwrite',async t=>{
 const f=await fixture(t);await f.start();await f.chunk();const other=Buffer.alloc(CHUNK,66);
 await assert.rejects(()=>f.chunk(0,other));assert.equal(hash(await readFile(join(f.root,f.input.uploadId,'chunk-0'))),hash(f.bytes.subarray(0,CHUNK)));
 await assert.rejects(()=>f.api.start({},workspaceId,{...f.input,sha256:'0'.repeat(64)}));
 await assert.rejects(()=>f.api.start({},workspaceId,{...f.input,uploadId:randomUUID()}));
});
test('other owner and workspace cannot inspect, resume, write, finalize or purge',async t=>{
 const f=await fixture(t);await f.start();
 for(const wrong of ['owner','workspace']){
  f.actor(wrong==='owner'?'another-person':'synthetic-owner');const w=wrong==='workspace'?randomUUID():workspaceId;
  for(const action of ['pause','resume','finalize','abort','expire'])await assert.rejects(()=>f.api[action]({},w,{uploadId:f.input.uploadId}));
  await assert.rejects(()=>f.api.status({},w,{uploadId:f.input.uploadId,afterIndex:-1}));
  await assert.rejects(()=>f.api.start({},w,f.input));
  await assert.rejects(()=>f.api.chunk({},w,{uploadId:f.input.uploadId,index:0,sha256:hash(f.bytes.subarray(0,CHUNK)),bytes:f.bytes.subarray(0,CHUNK)}));
 }
 f.actor('synthetic-owner');assert.equal((await f.status()).receivedChunks,0);
});
test('capability disabled and audit outage prevent admission',async t=>{
 const f=await fixture(t);
 for(const options of [{enabled:()=>false},{decisions:{decide:async()=>{throw Error('private-audit-secret');}}}]){
  const api=createResumableUploads({decisions:f.decisions,repository:f.repo,authorize:async()=>true,enabled:()=>true,...options});
  await assert.rejects(()=>api.start({},workspaceId,f.input),{message:'Garden upload rejected'});
 }
 assert.deepEqual(await readdir(f.root),['uploads.sqlite']);
});
test('chunk commit revocation leaves no committed receipt and can safely retry',async t=>{
 const f=await fixture(t);await f.start();f.hook(op=>{if(op.action==='upload:chunk'&&op.phase==='commit')f.allow(false);});
 await assert.rejects(f.chunk);f.hook(async()=>{});f.allow(true);assert.equal((await f.status()).receivedChunks,0);
 await f.chunk();assert.equal((await f.status()).receivedChunks,1);
});
test('finalize revocation cannot expose an original reference',async t=>{
 const f=await fixture(t);await f.start();await f.chunk();await f.chunk(1);
 f.hook(op=>{if(op.action==='upload:finalize'&&op.phase==='commit')f.allow(false);});await assert.rejects(f.finalize);
 f.hook(async()=>{});f.allow(true);assert.equal((await f.status()).sourceRef,null);await f.finalize();
});
test('source grant is rechecked after binding and throughout assembly',async t=>{
 const f=await fixture(t);await f.start();await f.chunk();await f.chunk(1);let sawRef=false;
 f.hook(op=>{if(op.phase==='assemble-chunk'){sawRef=op.sourceRef.sha256===f.input.sha256;f.allow(false);}});
 await assert.rejects(f.finalize);assert.equal(sawRef,true);f.hook(async()=>{});f.allow(true);assert.equal((await f.status()).bytesVerified,false);
});
test('whole-file checksum and declared MIME mismatches never finalize',async t=>{
 for(const field of ['sha256','declaredType']){
  const f=await fixture(t);f.input[field]=field==='sha256'?'0'.repeat(64):'application/pdf';
  await f.start();await f.chunk();await f.chunk(1);await assert.rejects(f.finalize);assert.equal((await f.status()).sourceRef,null);
 }
});
test('unknown fields, unsupported types, invalid checksums and huge bodies reject',async t=>{
 const f=await fixture(t);
 for(const patch of [{declaredType:'text/html'},{size:UPLOAD_MAX_BYTES+1},{owner:'forged'},{sha256:'x'}])await assert.rejects(()=>f.api.start({},workspaceId,{...f.input,...patch}));
 await f.start();await assert.rejects(()=>f.chunk(0,Buffer.alloc(CHUNK+1)));await assert.rejects(()=>f.chunk(0,Buffer.alloc(3)));
 await assert.rejects(()=>f.api.chunk({},workspaceId,{uploadId:f.input.uploadId,index:0,sha256:'0'.repeat(64),bytes:Buffer.alloc(CHUNK)}));
});
test('expiration holds quota until authorized abandonment cleanup',async t=>{
 const f=await fixture(t,{workspaceQuotaBytes:4*CHUNK,ownerQuotaBytes:4*CHUNK,bytes:source(CHUNK)});
 await f.start();await f.chunk();await f.api.abort({},workspaceId,{uploadId:f.input.uploadId});
 await assert.rejects(()=>f.api.expire({},workspaceId,{uploadId:f.input.uploadId}));f.clock(11000);
 const purged=await f.api.expire({},workspaceId,{uploadId:f.input.uploadId});assert.equal(purged.state,'purged');assert.equal(purged.receivedBytes,0);
 const replay=await f.api.expire({},workspaceId,{uploadId:f.input.uploadId});assert.equal(replay.state,'purged');assert.deepEqual(await readdir(join(f.root,f.input.uploadId)),[]);
});
test('expired sessions cannot receive, resume or finalize',async t=>{
 const f=await fixture(t);await f.start();await f.chunk();f.clock(11000);assert.equal((await f.status()).state,'expired-retained');
 await assert.rejects(()=>f.chunk(1));await assert.rejects(f.finalize);await assert.rejects(()=>f.api.resume({},workspaceId,{uploadId:f.input.uploadId}));
});
test('finalized originals are never aborted or expired',async t=>{
 const f=await fixture(t);await f.all();f.clock(9999999);
 for(const action of ['abort','expire'])await assert.rejects(()=>f.api[action]({},workspaceId,{uploadId:f.input.uploadId}));
 assert.equal(hash(await readFile(join(f.root,f.input.uploadId,'original.bin'))),f.input.sha256);
});
test('orphan assembled original is retained for review even after expiration',async t=>{
 const f=await fixture(t);await f.start();await f.chunk();await f.chunk(1);
 f.hook(op=>{if(op.phase==='commit'&&op.action==='upload:finalize')f.allow(false);});await assert.rejects(f.finalize);
 f.allow(true);f.hook(async()=>{});f.clock(11000);await assert.rejects(()=>f.api.expire({},workspaceId,{uploadId:f.input.uploadId}));
 assert.equal(hash(await readFile(join(f.root,f.input.uploadId,'original.bin'))),f.input.sha256);
});
test('quotas account for chunks and assembly and serialize racing admission',async t=>{
 const f=await fixture(t,{workspaceQuotaBytes:2*CHUNK,ownerQuotaBytes:2*CHUNK,bytes:source(CHUNK)});
 const other={...f.input,uploadId:randomUUID(),sourceId:randomUUID(),version:randomUUID()};
 const attempts=await Promise.allSettled([f.start(),f.api.start({},workspaceId,other)]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
});
test('concurrent identical chunk requests commit one record',async t=>{
 const f=await fixture(t);await f.start();await Promise.all([f.chunk(),f.chunk()]);assert.equal((await f.status()).receivedChunks,1);
});
test('request body is snapshotted before asynchronous authorization',async t=>{
 const f=await fixture(t);await f.start();const body=Buffer.from(f.bytes.subarray(0,CHUNK));
 f.hook(op=>{if(op.phase==='admit'&&op.action==='upload:chunk')body.fill(66);});
 await f.chunk(0,body);assert.equal(hash(await readFile(join(f.root,f.input.uploadId,'chunk-0'))),hash(f.bytes.subarray(0,CHUNK)));
});
test('truncated or changed stored chunks cannot be finalized',async t=>{
 for(const truncate of [true,false]){
  const f=await fixture(t);await f.start();await f.chunk();await f.chunk(1);const p=join(f.root,f.input.uploadId,'chunk-0');await chmod(p,0o600);
  await writeFile(p,Buffer.alloc(truncate?8:CHUNK));await assert.rejects(f.finalize);assert.equal((await f.status()).bytesVerified,false);
 }
});
test('symlink substitution is rejected without following or replacing targets',async t=>{
 const f=await fixture(t);await f.start();await f.status();const p=join(f.root,f.input.uploadId,'chunk-0'),victim=join(f.root,'victim');await writeFile(victim,'private',{mode:0o600});await symlink(victim,p);
 await assert.rejects(f.chunk);assert.equal(await readFile(victim,'utf8'),'private');
});
test('private files and database mode; public roots are refused',async t=>{
 const f=await fixture(t);await f.all();
 assert.equal((await stat(join(f.root,'uploads.sqlite'))).mode&0o777,0o600);
 assert.equal((await stat(join(f.root,f.input.uploadId,'original.bin'))).mode&0o777,0o400);
 await chmod(f.root,0o755);assert.throws(()=>createPrivateUploadRepository(f.configuration));await chmod(f.root,0o700);
});
test('local audit records bind UUID decisions, and altered chain blocks reopen',async t=>{
 const f=await fixture(t);await f.start();await f.chunk();
 const db=new DatabaseSync(join(f.root,'uploads.sqlite'));
 const events=db.prepare('SELECT payload FROM upload_events').all().map(e=>JSON.parse(e.payload));
 assert.ok(events.every(e=>/^[0-9a-f-]{36}$/.test(e.requestId)));assert.ok(events.some(e=>e.kind==='chunk-received'));
 db.exec("UPDATE upload_events SET hash='changed' WHERE sequence=1");db.close();await assert.rejects(()=>f.reopen());
});

for(const crashAt of ['chunk','finalize'])test(`SIGKILL during ${crashAt} commit resumes from durable bytes`,async t=>{
 const f=await fixture(t,{bytes:source(1024)});await f.start();if(crashAt==='finalize')await f.chunk();await f.repo.close();
 const moduleURL=new URL('../../services/workers/src/upload-repository.mjs',import.meta.url).href;
 const apiURL=new URL('../../services/workers/src/resumable-uploads.mjs',import.meta.url).href;
 const code=`import {createPrivateUploadRepository} from ${JSON.stringify(moduleURL)};import {createResumableUploads} from ${JSON.stringify(apiURL)};import {randomUUID,createHash} from 'node:crypto';
 const repo=createPrivateUploadRepository(${JSON.stringify({...f.configuration,now:undefined})});
 const api=createResumableUploads({repository:repo,enabled:()=>true,decisions:{async decide(h,w,fn){const requestId=randomUUID();return {allowed:await fn({workspaceId:w,subjectId:'synthetic-owner',requestId}),requestId};}},authorize:async(f,op)=>{if(op.action==='upload:${crashAt}'&&op.phase==='commit'){process.stdout.write('ready\\n');setInterval(()=>{},1000);await new Promise(()=>{});}return true;}});
 const input=${JSON.stringify(f.input)};${crashAt==='chunk'?`const bytes=Buffer.alloc(1024,65);Buffer.from('SQLite format 3\\0').copy(bytes);await api.chunk({},${JSON.stringify(workspaceId)},{uploadId:input.uploadId,index:0,sha256:createHash('sha256').update(bytes).digest('hex'),bytes});`:`await api.finalize({},${JSON.stringify(workspaceId)},{uploadId:input.uploadId});`}`;
 // The synthetic clock must remain in this session's lifetime in the child.
 const child=spawn(process.execPath,['--input-type=module','-e',code.replace('"lifetimeMs":10000','"lifetimeMs":10000,"now":()=>1000')],{stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill('SIGKILL'));
 const exit=once(child,'exit');let output='';const ready=new Promise((resolve,reject)=>{child.stdout.on('data',b=>{output+=b;if(output.includes('ready\n'))resolve();});child.on('exit',()=>reject(Error('child exited before checkpoint')));});
 await Promise.race([ready,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('crash test timeout')),10000);timer.unref();})]);child.kill('SIGKILL');const [,signal]=await exit;assert.equal(signal,'SIGKILL');
 const reopened=createPrivateUploadRepository(f.configuration);t.after(()=>reopened.close().catch(()=>{}));
 const api=createResumableUploads({repository:reopened,decisions:f.decisions,authorize:async()=>true,enabled:()=>true});
 const status=await api.status({},workspaceId,{uploadId:f.input.uploadId,afterIndex:-1});assert.equal(status.sourceRef,null);assert.equal(status.receivedChunks,crashAt==='chunk'?0:1);
 if(crashAt==='chunk')await api.chunk({},workspaceId,{uploadId:f.input.uploadId,index:0,sha256:f.input.sha256,bytes:f.bytes});
 const done=await api.finalize({},workspaceId,{uploadId:f.input.uploadId});assert.equal(done.bytesVerified,true);assert.equal(done.receivedChunks,1);
});

test('finalized registry integrates with actual staging worker on a generated database',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'garden-upload-source-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const config=JSON.parse(execFileSync('python3',['tests/import/staging_fixture.py',dir,'12'],{encoding:'utf8'}));
 const f=await fixture(t,{bytes:await readFile(config.source_path)});f.input.sourceId=config.source_ref.sourceId;f.input.version=config.source_ref.version;
 const uploaded=await f.all();
 const staging=createCorpusStaging({decisions:f.decisions,authorize:async()=>true,enabled:()=>true,
  resolveSource:f.repo.resolveSource,extract:createOfflineStagingWorker({loadContracts:async()=>({mapping:config.mapping,inventory:config.inventory})})});
 const reordered=Object.fromEntries(Object.entries(uploaded.sourceRef).reverse());
 const result=await staging.stage({},workspaceId,{runId:randomUUID(),sourceRef:reordered});
 assert.equal(result.rows,12);assert.equal(result.historicalReview,'unreviewed');assert.equal(result.publiclyAccessible,false);
 const again=await staging.stage({},workspaceId,{runId:randomUUID(),sourceRef:uploaded.sourceRef});assert.equal(again.rows,12);
 await assert.rejects(()=>f.repo.resolveSource({workspaceId,subjectId:'other'},uploaded.sourceRef));
});

test('global byte and session quotas cannot be bypassed with another workspace',async t=>{
 const f=await fixture(t,{bytes:source(CHUNK),workspaceQuotaBytes:2*CHUNK,ownerQuotaBytes:2*CHUNK});await f.start();
 await assert.rejects(()=>f.api.start({},randomUUID(),{...f.input,uploadId:randomUUID(),sourceId:randomUUID()}));
 const limited=await fixture(t,{maxOpenSessions:1,bytes:source(100)});await limited.start();
 await assert.rejects(()=>limited.api.start({},workspaceId,{...limited.input,uploadId:randomUUID(),sourceId:randomUUID()}));
});
test('aborted signal and changing authenticated subject fail closed',async t=>{
 const f=await fixture(t);await f.start();
 await assert.rejects(()=>f.api.status({},workspaceId,{uploadId:f.input.uploadId,afterIndex:-1},{signal:AbortSignal.abort()}));
 f.hook(op=>{if(op.phase==='admit')f.actor('changed-subject');});await assert.rejects(f.chunk);
 f.hook(async()=>{});f.actor('synthetic-owner');assert.equal((await f.status()).receivedChunks,0);
});

test('session expiry during chunk commit or assembly prevents completion',async t=>{
 for(const action of ['chunk','finalize']){
  const f=await fixture(t,{bytes:source(1024)});await f.start();if(action==='finalize')await f.chunk();
  f.hook(op=>{if(op.action===`upload:${action}`&&op.phase==='commit')f.clock(11000);});
  await assert.rejects(action==='chunk'?f.chunk:f.finalize);f.hook(async()=>{});
  assert.equal((await f.status()).bytesVerified,false);
 }
});

test('in-flight admission is bounded before copying or queuing more chunks',async t=>{
 const f=await fixture(t);let release;const wait=new Promise(resolve=>{release=resolve;});
 f.hook(async op=>{if(op.phase==='admit')await wait;});
 const inputs=Array.from({length:4},()=>({...f.input,uploadId:randomUUID(),sourceId:randomUUID()}));
 const pending=inputs.map(input=>f.api.start({},workspaceId,input));
 try{await assert.rejects(f.start);}finally{release();}
 await Promise.all(pending);
});

test('source/version namespace is unique across workspaces',async t=>{
 const f=await fixture(t);await f.start();
 await assert.rejects(()=>f.api.start({},randomUUID(),{...f.input,uploadId:randomUUID()}));
});
test('original changed during final authorization is not accepted',async t=>{
 const f=await fixture(t,{bytes:source(1024)});await f.start();await f.chunk();
 f.hook(async op=>{if(op.action==='upload:finalize'&&op.phase==='commit'){
  const path=join(f.root,f.input.uploadId,'original.bin');await chmod(path,0o600);await writeFile(path,Buffer.alloc(1024));
 }});await assert.rejects(f.finalize);f.hook(async()=>{});assert.equal((await f.status()).sourceRef,null);
});

test('revoked session creation leaves no unreserved upload directories',async t=>{
 const f=await fixture(t);f.hook(op=>{if(op.action==='upload:start'&&op.phase==='commit')f.allow(false);});
 await assert.rejects(f.start);assert.deepEqual(await readdir(f.root),['uploads.sqlite']);
});

test('content-duplicate receipt is confined to the same owner and workspace',async t=>{
 const f=await fixture(t,{bytes:source(128)}),first=await f.all();
 assert.equal(first.duplicateOfUploadId,null);
 const unique=()=>({...f.input,uploadId:randomUUID(),sourceId:randomUUID(),version:randomUUID()});
 async function accept(input,workspace=workspaceId){
  const start=await f.api.start({},workspace,input);
  assert.equal(start.duplicateOfUploadId,null,'a claimed hash is not a verified duplicate');
  await f.api.chunk({},workspace,{uploadId:input.uploadId,index:0,sha256:hash(f.bytes),bytes:f.bytes});
  return f.api.finalize({},workspace,{uploadId:input.uploadId});
 }
 const second=await accept(unique());
 assert.equal(second.duplicateOfUploadId,first.uploadId);
 const replay=await f.api.finalize({},workspaceId,{uploadId:second.uploadId});
 assert.equal(replay.duplicateOfUploadId,first.uploadId);
 f.actor('other-contributor');
 const otherOwner=await accept(unique());assert.equal(otherOwner.duplicateOfUploadId,null);
 f.actor('synthetic-owner');
 const otherWorkspace=await accept(unique(),randomUUID());assert.equal(otherWorkspace.duplicateOfUploadId,null);
 assert.equal((await f.status()).duplicateOfUploadId,null);
});
