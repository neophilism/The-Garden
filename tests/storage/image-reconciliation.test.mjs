import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,chmod,rm,readFile,mkdir,symlink,link,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
import {createImageReconciliation,createOfflineImageScanner,createReviewedImageByteReader} from '../../services/workers/src/image-reconciliation.mjs';
import {createPrivateImageReconciliationRepository} from '../../services/workers/src/image-reconciliation-repository.mjs';
import {reconcileImageEditions,imageEvidenceDigest} from '../../packages/domain/src/historical/image-reconciliation.mjs';
import {hash,manifest,legacy,annotation,review} from '../data/image-fixtures.mjs';

async function fixture(t,overrides={}){
 const root=await mkdtemp(join(tmpdir(),'garden-images-'));await chmod(root,0o700);t.after(()=>rm(root,{recursive:true,force:true}));
 const config=JSON.parse((await promisify(execFile)('/usr/bin/python3',['tests/import/image_fixture.py',root])).stdout);
 const directory=join(root,'reports'),repository=createPrivateImageReconciliationRepository({root:directory});t.after(()=>repository.close());
 const workspaceId=randomUUID(),bundleId=randomUUID(),input={bundleId,runId:randomUUID()};
 const resolved={workspaceId,bundleId,classification:'restricted_research',sources:[{...config,quarantine:{disposition:'quarantined',released:false,malware:'unavailable'}}],legacySnapshot:null,annotations:[]};
 let allowed=true,actor='researcher-1',resolutions=0;const audit=[],hooks={};
 const defaults={decisions:{async decide(h,w,evaluate){const result=await evaluate({workspaceId:w,subjectId:actor});audit.push(result);await hooks.audit?.();return {allowed:result,requestId:randomUUID()};}},
  authorize:async(facts,scope)=>{await hooks.gate?.(scope);return allowed;},resolveBundle:async()=>{resolutions++;await hooks.resolve?.();return resolved;},repository,enabled:()=>true};
 const service=createImageReconciliation({...defaults,...overrides});
 return {root,directory,config,workspaceId,bundleId,input,resolved,repository,defaults,audit,hooks,service,deny:()=>allowed=false,setActor:a=>actor=a,resolutions:()=>resolutions,
  run:options=>service.reconcile({},workspaceId,input,options)};
}

test('actual offline scanner, audited boundary and immutable report repository integrate without modifying DOCX',async t=>{
 const f=await fixture(t),before=await readFile(f.config.sourcePath),a=await f.run(),b=await f.run();
 assert.equal(a.status,'complete-unreviewed');assert.equal(a.editions[0].counts.mediaMembers,1);assert.equal(a.editions[0].counts.storedPlacements,1);assert.equal(a.reportDigest,b.reportDigest);
 assert.equal(a.publiclyAccessible,false);assert.equal(a.publicationApproved,false);assert.deepEqual(await readFile(f.config.sourcePath),before);
 const detail=await f.service.detail({},f.workspaceId,{bundleId:f.bundleId,inputDigest:a.inputDigest});assert.equal(imageEvidenceDigest(detail),a.reportDigest);assert.equal(detail.legacySnapshot,null);
 const db=new DatabaseSync(join(f.directory,'image-reconciliation.sqlite3'),{readOnly:true});assert.equal(db.prepare('SELECT count(*) n FROM snapshots').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM attempts').get().n,2);db.close();
 assert.equal((await stat(join(f.directory,'image-reconciliation.sqlite3'))).mode&0o077,0);assert.ok(f.audit.length>10&&f.audit.every(Boolean));
});
test('default disabled, bundle denial and audit outage prevent any source resolution',async t=>{
 for(const option of [{enabled:()=>false},{authorize:async()=>false},{decisions:{async decide(){throw new Error('private audit detail');}}}]){
  const f=await fixture(t,option);await assert.rejects(()=>f.run(),{message:'Garden image reconciliation rejected'});assert.equal(f.resolutions(),0);
 }
 const f=await fixture(t),{enabled,...defaults}=f.defaults;await assert.rejects(()=>createImageReconciliation(defaults).reconcile({},f.workspaceId,f.input));assert.equal(f.resolutions(),0);
});
test('request cannot inject path, metadata, approval or subject identity',async t=>{
 for(const key of ['sourcePath','annotations','publicationApproved','subjectId']){
  const f=await fixture(t);f.input[key]='injected';await assert.rejects(()=>f.run());assert.equal(f.resolutions(),0);
 }
});
test('wrong workspace, infected/released bytes and classification drift reject before scanning',async t=>{
 for(const mutate of [r=>r.workspaceId=randomUUID(),r=>r.classification='public',r=>r.sources[0].quarantine.released=true,r=>r.sources[0].quarantine.malware='infected']){
  const f=await fixture(t,{scan:async()=>assert.fail('must not scan')});mutate(f.resolved);await assert.rejects(()=>f.run());
 }
});
test('subject change and source revocation during resolution cannot reach the scanner',async t=>{
 const f=await fixture(t,{scan:async()=>assert.fail('must not scan')});f.hooks.resolve=()=>f.setActor('different-person');await assert.rejects(()=>f.run());
 const g=await fixture(t,{scan:async()=>assert.fail('must not scan')});g.hooks.resolve=g.deny;await assert.rejects(()=>g.run());
});
test('scan and commit gates fail closed and leave no completed private report',async t=>{
 for(const phase of ['scan-media','commit']){
  const f=await fixture(t);f.hooks.gate=s=>{if(s.phase===phase)f.deny();};await assert.rejects(()=>f.run());
  const db=new DatabaseSync(join(f.directory,'image-reconciliation.sqlite3'),{readOnly:true});assert.equal(db.prepare('SELECT count(*) n FROM snapshots').get().n,0);db.close();
 }
});
test('receipt and detail delivery recheck bundle and exact evidence-source authorization',async t=>{
 const f=await fixture(t);f.hooks.gate=s=>{if(s.phase==='deliver-receipt')f.deny();};await assert.rejects(()=>f.run());
 const g=await fixture(t),result=await g.run();let received;
 g.hooks.gate=s=>{if(s.phase==='deliver-detail'){received=s.artifactHashes;g.deny();}};
 await assert.rejects(()=>g.service.detail({},g.workspaceId,{bundleId:g.bundleId,inputDigest:result.inputDigest}));assert.deepEqual(received,[g.config.document.sha256]);
});
test('detailed reports cannot be read across subject or workspace',async t=>{
 const f=await fixture(t),result=await f.run();f.setActor('another-researcher');
 await assert.rejects(()=>f.service.detail({},f.workspaceId,{bundleId:f.bundleId,inputDigest:result.inputDigest}),{message:'Garden image reconciliation rejected'});
 await assert.rejects(()=>f.service.detail({},randomUUID(),{bundleId:f.bundleId,inputDigest:result.inputDigest}),{message:'Garden image reconciliation rejected'});
});
test('same evidence with new run ID does not duplicate the projection; changed evidence cannot overwrite a run',async t=>{
 const f=await fixture(t),first=await f.run();f.input.runId=randomUUID();const second=await f.run();assert.equal(first.reportDigest,second.reportDigest);
 const m=manifest(),report=reconcileImageEditions({editions:[m],legacySnapshot:legacy(m),annotations:[]});
 assert.throws(()=>f.repository.commit({workspaceId:f.workspaceId,subjectId:'researcher-1',requestId:randomUUID()},{runId:f.input.runId,bundleId:f.bundleId,report}));
 const retained=await f.service.detail({},f.workspaceId,{bundleId:f.bundleId,inputDigest:first.inputDigest});assert.equal(imageEvidenceDigest(retained),first.reportDigest);
});
test('abort, deadline and concurrent admission denial release the worker slot',async t=>{
 const f=await fixture(t);const abort=new AbortController();abort.abort();await assert.rejects(()=>f.run({signal:abort.signal}));assert.equal((await f.run()).status,'complete-unreviewed');
 const scanner=createOfflineImageScanner({timeoutMs:1});await assert.rejects(()=>scanner(f.config,{gate:async()=>randomUUID()}));
 let release;const blocker=new Promise(resolve=>release=resolve);
 const service=createImageReconciliation({...f.defaults,scan:async()=>{await blocker;throw new Error('controlled');}});
 const first=service.reconcile({},f.workspaceId,{...f.input,runId:randomUUID()});await new Promise(resolve=>setTimeout(resolve,5));
 await assert.rejects(()=>service.reconcile({},f.workspaceId,{...f.input,runId:randomUUID()}));release();await assert.rejects(()=>first);
});
test('private repository refuses unsafe root and tampered schema on reopen',async t=>{
 const root=await mkdtemp(join(tmpdir(),'garden-image-roots-'));await chmod(root,0o700);t.after(()=>rm(root,{recursive:true,force:true}));
 const target=join(root,'target');await mkdir(target,{mode:0o700});const linked=join(root,'symlink');await symlink(target,linked);assert.throws(()=>createPrivateImageReconciliationRepository({root:linked}));
 const unsafe=join(root,'unsafe');await mkdir(unsafe,{mode:0o755});await chmod(unsafe,0o755);assert.throws(()=>createPrivateImageReconciliationRepository({root:unsafe}));
 const repo=createPrivateImageReconciliationRepository({root:target});repo.close();const db=new DatabaseSync(join(target,'image-reconciliation.sqlite3'));db.exec('DROP TRIGGER snapshots_no_update');db.close();
 assert.throws(()=>createPrivateImageReconciliationRepository({root:target}));
});
test('private repository rejects a hard-linked report journal',async t=>{
 const root=await mkdtemp(join(tmpdir(),'garden-image-hardlinks-'));await chmod(root,0o700);t.after(()=>rm(root,{recursive:true,force:true}));
 const target=join(root,'reports'),repo=createPrivateImageReconciliationRepository({root:target});repo.close();
 await link(join(target,'image-reconciliation.sqlite3'),join(root,'other.sqlite3'));assert.throws(()=>createPrivateImageReconciliationRepository({root:target}));
});

function byteFixture(overrides={}){
 const bytes=Buffer.from('bytes0'),a=annotation();a.binding.sha256=hash(bytes);
 const release={annotation:a,documentSha256:a.binding.documentSha256,mediaSha256:a.binding.sha256,placementId:a.binding.placementId,byteRef:{sha256:hash(bytes),size:bytes.length}};
 let permission=true,receipt=review(a),readCount=0;const hooks={};
 const options={loadRelease:async()=>release,reviewRelease:async()=>receipt,readBytes:async()=>{readCount++;await hooks.afterRead?.();return bytes;},authorize:async()=>permission,enabled:()=>true,...overrides};
 const reader=createReviewedImageByteReader(options),input={releaseId:randomUUID()};
 return {a,release,bytes,options,hooks,readCount:()=>readCount,setReview:r=>receipt=r,deny:()=>permission=false,read:()=>reader.read({subjectId:'authorized-publisher'},input)};
}
test('GDN-047-AC03 unknown, missing and prohibited rights deny before reading any bytes',async()=>{
 for(const status of ['unknown','permission-required','prohibited']){
  const f=byteFixture();f.a.rights.status=status;f.setReview(review(f.a));await assert.rejects(()=>f.read());assert.equal(f.readCount(),0);
 }
 const f=byteFixture();f.a.rights.evidence=[];f.setReview(review(f.a));await assert.rejects(()=>f.read());assert.equal(f.readCount(),0);
});
test('generated label, stale exact review and disabled reader deny without bytes',async()=>{
 const f=byteFixture();f.a.mediaClass='generated-illustration';f.a.label=null;f.setReview(review(f.a));await assert.rejects(()=>f.read());assert.equal(f.readCount(),0);
 const g=byteFixture();g.a.caption='changed after review';await assert.rejects(()=>g.read());assert.equal(g.readCount(),0);
 const h=byteFixture({enabled:()=>false});await assert.rejects(()=>h.read());assert.equal(h.readCount(),0);
});
test('cleared exact bytes can pass only the unmounted trusted guard with current review',async()=>{
 const f=byteFixture();assert.deepEqual(await f.read(),f.bytes);
});
test('post-read revocation, changed metadata, mismatched bytes and length never escape the guard',async()=>{
 for(const mutate of [f=>f.deny(),f=>f.setReview({...review(f.a),revoked:true}),f=>f.a.altText='changed']){
  const f=byteFixture();f.hooks.afterRead=()=>mutate(f);await assert.rejects(()=>f.read(),{message:'Garden image reconciliation rejected'});
 }
 const g=byteFixture({readBytes:async()=>Buffer.from('tampered')});await assert.rejects(()=>g.read());
 const h=byteFixture();h.release.byteRef.size++;await assert.rejects(()=>h.read());
});
test('guard does not accept caller approval flags or caller-selected byte references',async()=>{
 const f=byteFixture(),reader=createReviewedImageByteReader(f.options);
 for(const extra of [{rights:'approved'},{byteRef:f.release.byteRef},{subjectId:'admin'}])await assert.rejects(()=>reader.read({}, {releaseId:randomUUID(),...extra}));assert.equal(f.readCount(),0);
});
