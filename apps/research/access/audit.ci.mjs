import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {DatabaseSync} from 'node:sqlite';
import {createResumableUploads} from '../../../services/workers/src/resumable-uploads.mjs';
import {createPrivateUploadRepository} from '../../../services/workers/src/upload-repository.mjs';
import {createAuditReader,createAuditedDecision} from './audit.mjs';
import {createPolicyExecutor} from './policy-context.mjs';
import {createSourceRepository} from '../data/source-repository.mjs';
import {allowSyntheticResearchUse} from './consent-test-fixture.mjs';
import {AuditError,GENESIS,verifyAuditPage,verifyExternalCheckpoint} from '../../../packages/domain/src/audit/ledger.mjs';
import {createCorpusStaging,createOfflineStagingWorker} from '../../../services/workers/src/corpus-staging.mjs';
if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Audit fixtures require ephemeral CI');
const config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:3};
const admin=new pg.Pool(config),pools=[],checks=[],W=randomUUID(),OTHER=randomUUID(),policy='c'.repeat(64),SECRET='PRIVATE-ORAL-HISTORY-CANARY';
const checked=name=>{checks.push({name,result:'pass'});console.log('AUDIT '+checks.length+': '+name);};
const headers=subject=>new Headers({'synthetic-subject':subject});let stepUp=true,revoked=false;
// Explicit synthetic identity adapter: passkey cryptography is tested separately
// by the real-browser identity journey. The audit SQL boundary is real here.
const identity={async viewer(h){return revoked?null:{id:h.get('synthetic-subject'),verified:true};},async authorizePrivileged(h,action,authorize){return stepUp&&!revoked&&action==='audit.inspect'?(await authorize({subjectId:h.get('synthetic-subject'),action})):false;}};
const rowsSQL=`SELECT workspace_id::text AS "workspaceId",sequence::text,previous_hash AS "previousHash",hash,event_text AS "eventText" FROM garden_control.audit_events AS ae WHERE workspace_id=$1 ORDER BY ae.sequence`;
let issuer,readerPool,writer,research;
async function withRole(pool,cap,work){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+cap);const result=await work(c);await c.query('COMMIT');return result;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
// These destructive probes never commit, even if a guard unexpectedly permits
// the statement or its expected-error assertion fails. Use one pinned client.
async function rejectedMutation(pool,role,sql,expected){
 const client=await pool.connect();
 try{await client.query('BEGIN');if(role)await client.query('SET LOCAL ROLE '+role);await assert.rejects(()=>client.query(sql),expected);}
 finally{try{await client.query('ROLLBACK');}finally{client.release();}}
}
const immutableError=error=>error.code==='P0001'&&error.message==='Audit history is append-only';
async function retainedState(){
 const tables=['garden_control.audit_events','garden_control.audit_heads','garden_private.encrypted_content_versions','garden_private.encrypted_envelope_revisions','garden_private.encrypted_material','garden_private.encrypted_content_heads'];
 return(await admin.query(tables.map(table=>`SELECT '${table}' AS table_name,count(*)::text AS count,
  encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text COLLATE "C"),''),'UTF8')),'hex') AS sha256 FROM ${table} AS r`).join(' UNION ALL ')+' ORDER BY table_name')).rows;
}
try{
 for(const [name,cap] of [['garden_audit_issuer_ci','garden_context_issuer'],['garden_audit_reader_ci','garden_audit_reader'],['garden_audit_writer_ci','garden_audit_writer'],['garden_audit_research_ci','garden_research']]){
  const password=randomBytes(32).toString('hex');await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE, SET TRUE`);
  const p=new pg.Pool({...config,user:name,password,max:3,connectionTimeoutMillis:5000});pools.push(p);if(cap==='garden_context_issuer')issuer=p;else if(cap==='garden_audit_reader')readerPool=p;else if(cap==='garden_audit_writer')writer=p;else research=p;
 }
 for(const workspace of [W,OTHER]){
  await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[workspace,'Synthetic audit workspace',policy]);
  for(const [who,role] of [['alice','researcher'],['auditor','auditor'],['bob','researcher']]){
   await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[workspace,who,policy]);
   await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,$3,'alice',clock_timestamp()+interval '30 days')",[workspace,who,role]);
  }
 }
 const executor=createPolicyExecutor({identity,issuerPool:issuer,researchPool:research}),sources=createSourceRepository(executor);
 const audit=createAuditReader({identity,issuerPool:issuer,auditPool:readerPool,enabled:()=>true});
 const decisions=createAuditedDecision({identity,pool:writer,enabled:()=>true});
 const values=[];
 for(let i=0;i<4;i++){
  const id=randomUUID();await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'alice','research','active')",[id,W]);await allowSyntheticResearchUse(admin,W,id);
  await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'alice',true,true,'research',clock_timestamp()+interval '30 days')",[W,id]);
  const record={recordType:'source',schemaVersion:1,id,title:SECRET,form:'witness',archivalItemId:null,derivedFrom:[],assertions:[],representation:null};await sources.initialize(headers('alice'),W,id,'1',record);values.push(record);
 }
 let all=(await admin.query(rowsSQL,[W])).rows;
 assert.ok(all.length>=12,'fixture must exercise multi-digit sequence numbers');
 assert.deepEqual(all.map(r=>r.sequence),Array.from({length:all.length},(_,i)=>String(i+1)));
 checked('bigint audit ordering crosses sequence 9 to 10 without lexical reordering');
 verifyAuditPage(all,{workspaceId:W,sequence:'0',hash:GENESIS});
 assert.ok(all.some(r=>JSON.parse(r.eventText).action==='record.revise'));assert.ok(all.some(r=>JSON.parse(r.eventText).action==='consent.policy'));checked('real research and consent writes append hash-linked structured events in their transaction');
 assert.ok(!JSON.stringify(all).includes(SECRET));assert.ok(!JSON.stringify(all).includes('alice'));assert.ok(!JSON.stringify(all).includes('garden_audit_research_ci'));checked('private source text and raw identity/connection names are excluded from exportable events');
 const aliases=(await admin.query("SELECT workspace_id,alias FROM garden_control.audit_actor_aliases WHERE kind='subject' AND source_reference='alice'")).rows;assert.equal(new Set(aliases.map(x=>x.alias)).size,aliases.length);checked('actor aliases are independently scoped to each workspace');
 for(const table of ['audit_actor_aliases','audit_requests'])await assert.rejects(()=>withRole(readerPool,'garden_audit_reader',c=>c.query('SELECT * FROM garden_control.'+table)),e=>e.code==='42501');
 await assert.rejects(()=>withRole(writer,'garden_audit_writer',c=>c.query('SELECT * FROM garden_control.audit_events')),e=>e.code==='42501');checked('read-only audit and append-only decision capabilities cannot read protected identity mappings');
 await withRole(readerPool,'garden_audit_reader',async c=>{await c.query("SELECT set_config('garden.subject','auditor',true)");assert.equal((await c.query('SELECT count(*)::integer AS n FROM garden_control.audit_events')).rows[0].n,0);});checked('caller-controlled SQL settings cannot forge an audit context');
 stepUp=false;await assert.rejects(()=>audit.page(headers('auditor'),W),AuditError);stepUp=true;
 await assert.rejects(()=>audit.page(headers('bob'),W),AuditError);checked('both fresh passkey admission and a current SQL auditor role are required');
 const first=await audit.page(headers('auditor'),W,{limit:3});assert.equal(first.entries.length,3);assert.equal(first.externallyAnchored,false);let cursor=first.nextAfter,through=first.through,checkpoint=verifyAuditPage(first.entries,first.from).checkpoint,count=first.entries.length,pages=1;
 while(cursor!==null){assert.ok(pages<100);const page=await audit.page(headers('auditor'),W,{after:cursor,limit:3,through});assert.deepEqual(page.through,through);checkpoint=verifyAuditPage(page.entries,checkpoint).checkpoint;count+=page.entries.length;cursor=page.nextAfter;pages++;}
 assert.equal(count,Number(through.sequence));verifyExternalCheckpoint(checkpoint,through);checked('keyset pagination terminates at a pinned head despite new audit-export events');
 await assert.rejects(()=>audit.page(headers('auditor'),OTHER,{through}),AuditError);await assert.rejects(()=>audit.page(headers('auditor'),W,{through:{...through,hash:'1'.repeat(64)}}),AuditError);checked('cross-workspace and forged export checkpoints are rejected');
 const researchToken=await withRole(issuer,'garden_context_issuer',async c=>(await c.query("SELECT garden_control.issue_policy_ticket($1,'alice','read',NULL) AS t",[W])).rows[0].t);
 await withRole(readerPool,'garden_audit_reader',async c=>{await c.query('SELECT garden_control.bind_policy_context($1)',[researchToken]);assert.equal((await c.query('SELECT count(*)::integer AS n FROM garden_control.audit_events')).rows[0].n,0);await c.query('SELECT garden_control.clear_policy_context()');});await withRole(issuer,'garden_context_issuer',c=>c.query('SELECT garden_control.invalidate_policy_ticket($1)',[researchToken]));checked('ordinary research context cannot authorize an audit export');
 const auditToken=await withRole(issuer,'garden_context_issuer',async c=>(await c.query("SELECT garden_control.issue_audit_ticket($1,'auditor') AS t",[W])).rows[0].t);
 await withRole(research,'garden_research',async c=>{await c.query('SELECT garden_control.bind_policy_context($1)',[auditToken]);assert.equal((await c.query('SELECT count(*)::integer AS n FROM garden_private.record_envelopes')).rows[0].n,0);await c.query('SELECT garden_control.clear_policy_context()');});await withRole(issuer,'garden_context_issuer',c=>c.query('SELECT garden_control.invalidate_policy_ticket($1)',[auditToken]));checked('audit context cannot become a research-content read capability');
 await Promise.all(values.map((record,i)=>sources.revise(headers('alice'),W,record.id,'2',{...record,title:SECRET+'-'+i})));
 all=(await admin.query(rowsSQL,[W])).rows;verifyAuditPage(all,{workspaceId:W,sequence:'0',hash:GENESIS});assert.equal(new Set(all.map(x=>x.sequence)).size,all.length);checked('concurrent committed edits produce one contiguous, non-forking chain');
 const before=(await admin.query('SELECT sequence::text,hash FROM garden_control.audit_heads WHERE workspace_id=$1',[W])).rows[0];
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},async c=>{await c.query('UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,\'{title}\',\'"rolled-back"\') WHERE id=$1',[values[0].id]);throw Error('force rollback');}));
 assert.deepEqual((await admin.query('SELECT sequence::text,hash FROM garden_control.audit_heads WHERE workspace_id=$1',[W])).rows[0],before);checked('rolled-back record changes leave neither an audit entry nor a sequence hole');
 const retainedBefore=await retainedState();
 assert.ok(retainedBefore.some(row=>row.table_name==='garden_control.audit_events'&&BigInt(row.count)>0n));
 for(const sql of ['UPDATE garden_control.audit_events SET hash=hash','DELETE FROM garden_control.audit_events'])await rejectedMutation(admin,null,sql,immutableError);
 await rejectedMutation(admin,null,'TRUNCATE garden_control.audit_events',error=>error.code==='0A000'&&error.message==='cannot truncate a table referenced in a foreign key constraint'&&error.detail==='Table "encrypted_envelope_revisions" references "audit_events".');
 // The direct TRUNCATE is rejected before triggers by the receipt FK. CASCADE
 // explicitly reaches the append-only trigger without removing that FK.
 await rejectedMutation(admin,null,'TRUNCATE garden_control.audit_events CASCADE',immutableError);
 assert.deepEqual(await retainedState(),retainedBefore);
 checked('owner update/delete and cascading truncate reach the append-only trigger; direct truncate reaches the receipt FK; retained state is unchanged');
 for(const sql of ['UPDATE garden_control.audit_events SET hash=hash','DELETE FROM garden_control.audit_events','TRUNCATE garden_control.audit_events','TRUNCATE garden_control.audit_events CASCADE'])await rejectedMutation(readerPool,'garden_audit_reader',sql,error=>error.code==='42501'&&error.message==='permission denied for table audit_events');
 assert.deepEqual(await retainedState(),retainedBefore);
 checked('auditor runtime has no history mutation authority and all rejected probes preserve ledger, receipt, material and head state');
 const allowed=await decisions.decide(headers('alice'),W,async()=>true),denied=await decisions.decide(headers('alice'),W,async()=>{throw Error(SECRET);});assert.equal(allowed.allowed,true);assert.equal(denied.allowed,false);assert.equal(allowed.operationPerformed,false);
 all=(await admin.query(rowsSQL,[W])).rows;assert.equal(JSON.stringify(all).includes(SECRET),false);assert.ok(all.some(x=>JSON.parse(x.eventText).reasonCode==='authorization-denied'));checked('server allow/deny decisions are redacted and do not assert operation execution');
 // Real audited decision service + actual offline subprocess. The source grant
 // is synthetic; this does not activate a production storage/authorization adapter.
 const stagingRoot=await mkdtemp(join(tmpdir(),'garden-audit-staging-'));
 try{
  const fixture=JSON.parse(execFileSync('/usr/bin/python3',['tests/import/staging_fixture.py',stagingRoot],{maxBuffer:1024*1024}).toString());
  const extract=createOfflineStagingWorker({loadContracts:async()=>({mapping:fixture.mapping,inventory:fixture.inventory})});
  let denyCommit=true;
  const staging=createCorpusStaging({decisions,extract,enabled:()=>true,
   authorize:async(facts,request)=>{if(denyCommit&&request.phase==='commit-batch')revoked=true;return facts.subjectId==='alice'&&request.sourceRef.sha256===fixture.source_ref.sha256;},
   resolveSource:async()=>({workspaceId:W,sourceRef:fixture.source_ref,sourcePath:fixture.source_path,stagingDirectory:fixture.staging_directory,format:'sqlite',classification:'restricted_research',quarantine:{disposition:'quarantined',released:false,malware:'unavailable'}})});
  const input={runId:fixture.run_id,sourceRef:fixture.source_ref};
  const recordsBefore=(await admin.query('SELECT count(*)::integer AS n FROM garden_private.record_envelopes')).rows[0].n;
  await assert.rejects(()=>staging.stage(headers('alice'),W,input));revoked=false;denyCommit=false;
  const result=await staging.stage(headers('alice'),W,input);
  assert.equal(result.status,'complete-quarantined');assert.equal(result.rows,600);assert.equal(result.publicationApproved,false);
  assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_private.record_envelopes')).rows[0].n,recordsBefore);
  const receipts=JSON.parse(execFileSync('/usr/bin/python3',['-c',
   'import json,sqlite3,sys; d=sqlite3.connect(sys.argv[1]); print(json.dumps([json.loads(r[0])["authorization_request_id"] for r in d.execute("SELECT payload FROM audit") if json.loads(r[0])["kind"]=="batch-committed"]))',
   join(fixture.staging_directory,'staging.sqlite')]).toString());
  assert.equal(receipts.length,3);assert.ok(receipts.every(value=>typeof value==='string'));
  for(const receipt of receipts)assert.equal((await admin.query("SELECT count(*)::integer AS n FROM garden_control.audit_events WHERE workspace_id=$1 AND event_text::jsonb->>'requestId'=$2 AND event_text::jsonb->>'action'='access.allow'",[W,receipt])).rows[0].n,1);
  checked('offline staging rechecks actual audited identity decisions, records commit receipts and leaves operational records unchanged');
 }finally{revoked=false;await rm(stagingRoot,{recursive:true,force:true});}
 // GDN-077: actual private filesystem/SQLite upload ledger + PostgreSQL
 // decision receipts + actual staging subprocess, with synthetic source grants.
 const uploadRoot=await mkdtemp(join(tmpdir(),'garden-audit-upload-'));
 let uploadRepository;
 try{
  const sourceDir=join(uploadRoot,'generated-source'),quarantineDir=join(uploadRoot,'private-uploads');
  await mkdir(sourceDir,{mode:0o700});await mkdir(quarantineDir,{mode:0o700});
  const fixture=JSON.parse(execFileSync('/usr/bin/python3',['tests/import/staging_fixture.py',sourceDir,'5']).toString());
  const bytes=await readFile(fixture.source_path);
  uploadRepository=createPrivateUploadRepository({root:quarantineDir,workspaceQuotaBytes:1024*1024,ownerQuotaBytes:1024*1024});
  let uploadAllowed=true;
  const uploads=createResumableUploads({decisions,repository:uploadRepository,enabled:()=>true,
   authorize:async(facts,request)=>uploadAllowed&&facts.subjectId==='alice'&&(!request.sourceRef||request.sourceRef.sha256===fixture.source_ref.sha256)});
  const spec={uploadId:randomUUID(),sourceId:fixture.source_ref.sourceId,version:fixture.source_ref.version,
   sha256:fixture.source_ref.sha256,size:bytes.length,declaredType:'application/vnd.sqlite3'};
  const beforeRecords=(await admin.query('SELECT count(*)::integer AS n FROM garden_private.record_envelopes')).rows[0].n;
  await uploads.start(headers('alice'),W,spec);
  uploadAllowed=false;await assert.rejects(()=>uploads.chunk(headers('alice'),W,{uploadId:spec.uploadId,index:0,bytes,sha256:spec.sha256}));uploadAllowed=true;
  assert.equal((await uploads.status(headers('alice'),W,{uploadId:spec.uploadId,afterIndex:-1})).receivedChunks,0);
  await uploads.chunk(headers('alice'),W,{uploadId:spec.uploadId,index:0,bytes,sha256:spec.sha256});
  const receipt=await uploads.finalize(headers('alice'),W,{uploadId:spec.uploadId});
  assert.equal(receipt.publiclyAccessible,false);assert.equal(receipt.malware,'unavailable');
  const staged=createCorpusStaging({decisions,enabled:()=>true,
   authorize:async(facts,request)=>facts.subjectId==='alice'&&request.sourceRef.sha256===spec.sha256,
   resolveSource:uploadRepository.resolveSource,
   extract:createOfflineStagingWorker({loadContracts:async()=>({mapping:fixture.mapping,inventory:fixture.inventory})})});
  const result=await staged.stage(headers('alice'),W,{runId:randomUUID(),sourceRef:receipt.sourceRef});
  assert.equal(result.rows,5);assert.equal(result.historicalReview,'unreviewed');
  const ledger=new DatabaseSync(join(quarantineDir,'uploads.sqlite'),{readOnly:true});
  try{
   const committed=ledger.prepare('SELECT payload FROM upload_events').all().map(r=>JSON.parse(r.payload)).filter(e=>['session-created','chunk-received','finalized-quarantined'].includes(e.kind));
   assert.equal(committed.length,3);
   for(const event of committed)assert.equal((await admin.query("SELECT count(*)::integer AS n FROM garden_control.audit_events WHERE workspace_id=$1 AND event_text::jsonb->>'requestId'=$2 AND event_text::jsonb->>'action'='access.allow'",[W,event.requestId])).rows[0].n,1);
  }finally{ledger.close();}
  assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_private.record_envelopes')).rows[0].n,beforeRecords);
  checked('resumable upload commits bind real PostgreSQL decisions and hand off to quarantined staging without operational record promotion');
 }finally{if(uploadRepository)await uploadRepository.close();await rm(uploadRoot,{recursive:true,force:true});}
 const original=all[0];await admin.query('ALTER TABLE garden_control.audit_events DISABLE TRIGGER immutable_audit_events');
 try{await admin.query("UPDATE garden_control.audit_events SET hash=repeat('1',64) WHERE workspace_id=$1 AND sequence=1",[W]);await assert.rejects(()=>audit.page(headers('auditor'),W),AuditError);}
 finally{await admin.query('UPDATE garden_control.audit_events SET hash=$2 WHERE workspace_id=$1 AND sequence=1',[W,original.hash]);await admin.query('ALTER TABLE garden_control.audit_events ENABLE TRIGGER immutable_audit_events');}
 checked('corrupted stored history is rejected rather than exported as verified');
 // Component-level SQL snapshot/reload, not a full deployment disaster-recovery claim.
 const restore=await admin.connect();
 try{
  await restore.query('BEGIN');
  await restore.query('CREATE TEMP TABLE audit_reload_events (LIKE garden_control.audit_events INCLUDING ALL) ON COMMIT DROP; INSERT INTO audit_reload_events SELECT * FROM garden_control.audit_events; CREATE TEMP TABLE audit_reload_heads (LIKE garden_control.audit_heads INCLUDING ALL) ON COMMIT DROP; INSERT INTO audit_reload_heads SELECT * FROM garden_control.audit_heads; CREATE TEMP TABLE audit_reload_aliases (LIKE garden_control.audit_actor_aliases INCLUDING ALL) ON COMMIT DROP; INSERT INTO audit_reload_aliases SELECT * FROM garden_control.audit_actor_aliases;');
  const reloaded=(await restore.query(rowsSQL.replace('garden_control.audit_events','audit_reload_events'),[W])).rows;
  const restored=verifyAuditPage(reloaded,{workspaceId:W,sequence:'0',hash:GENESIS}).checkpoint;
  const head=(await restore.query('SELECT sequence::text,hash FROM audit_reload_heads WHERE workspace_id=$1',[W])).rows[0];verifyExternalCheckpoint(restored,{workspaceId:W,...head});
  await restore.query('COMMIT');
 }catch(error){await restore.query('ROLLBACK');throw error;}finally{restore.release();}
 checked('SQL export/reload preserves complete component rows, aliases and checkpoint consistency');
 await admin.query("UPDATE garden_control.access_roles SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND subject_id='auditor'",[W]);await assert.rejects(()=>audit.page(headers('auditor'),W),AuditError);assert.ok((await audit.page(headers('auditor'),OTHER)).entries.length>0);checked('revoking one workspace auditor does not grant access there or revoke an unrelated workspace');
 revoked=true;await assert.rejects(()=>audit.page(headers('auditor'),OTHER),AuditError);revoked=false;checked('revoked identity cannot reuse a previously valid audit role');
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.policy_tickets')).rows[0].n,0);checked('all successful, denied and corrupted export attempts retire policy tickets');
 await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/audit.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,synthetic_identity_adapter:true,real_postgres:true,checks,component_reload_tested:true,full_disaster_recovery_tested:false,independent_checkpoint_service_configured:false,production_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' real PostgreSQL audit checks');
}finally{for(const p of pools)await p.end();await admin.end();}
