/** Real PostgreSQL persistence and concurrency checks; isolated synthetic CI only. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createEncryptionPersistence,createEncryptedContentService,encryptionRequestDigest,encryptionDeliveryFingerprint,EncryptionPersistenceError} from './encryption-persistence.mjs';
import {createConsentAdministration} from './consent-administration.mjs';
import {allowSyntheticResearchUse} from './consent-test-fixture.mjs';
import {GENESIS,verifyAuditPage} from '../../../packages/domain/src/audit/ledger.mjs';
import {validateUsePolicy,validateConsentGrant} from '../../../packages/domain/src/consent/purpose.mjs';
import {envelopeDigest} from '../../../services/workers/src/trusted-encryption.mjs';
import {createPersistenceKeys,PERSISTENCE_CANARY} from '../../../tests/security/encryption-persistence-fixture.mjs';
import {RUNTIME_DATABASE_CAPABILITIES,assertDatabaseCapability} from './database-role.mjs';

if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||
 process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='5432'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='neondb')throw Error('Encryption persistence fixtures require isolated loopback CI');
const config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:8,connectionTimeoutMillis:5000};
const admin=new pg.Pool(config),pools={},checks=[],workspaces=[],keys=createPersistenceKeys(),H=subject=>new Headers({'synthetic-subject':subject}),POLICY='d'.repeat(64);
const identity={viewer:async headers=>headers.get('synthetic-subject')?{id:headers.get('synthetic-subject'),verified:true}:null};
const check=name=>{checks.push({name,result:'pass'});console.log('ENCRYPTION '+checks.length+': '+name);};
const unavailable=error=>error instanceof EncryptionPersistenceError&&error.code==='encrypted_content_unavailable'&&error.message==='Encrypted content unavailable'&&!('cause' in error);
const reject=work=>assert.rejects(work,unavailable);
const PRIVATE=['encrypted_content_versions','encrypted_envelope_revisions','encrypted_material','encrypted_content_heads'];
const CONTROL=['encryption_key_versions','encryption_key_bindings','encrypted_delivery_contexts','encrypted_delivery_checks'];
const CAPABILITIES={issuer:'garden_context_issuer',encryption:'garden_encryption',membership:'garden_membership_admin',consent:'garden_consent_admin',research:'garden_research',worker:'garden_worker',publisher:'garden_publisher',public:'garden_public',audit:'garden_audit_writer',reader:'garden_audit_reader',requester:'garden_lifecycle_requester',lifecycle_admin:'garden_lifecycle_admin'};

async function login(alias,capability){
 const name='garden_persist_'+alias+'_ci',password=randomBytes(32).toString('hex');
 await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
 await admin.query(`GRANT ${capability} TO ${name} WITH INHERIT FALSE, SET TRUE`);
 const pool=new pg.Pool({...config,user:name,password,application_name:name});pools[alias]=pool;return pool;
}
async function beginFixture(pool,role=null){
 const client=await pool.connect();let closed=false,pid;
 try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='5s'");if(role)await client.query('SET LOCAL ROLE '+role);pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;}
 catch(error){try{await client.query('ROLLBACK');}finally{client.release(true);}throw error;}
 return {pid,query:client.query.bind(client),async finish(commit=false){
  if(closed)return;closed=true;let bad=false;
  try{await client.query(commit?'COMMIT':'ROLLBACK');}
  catch(error){if(commit){try{await client.query('ROLLBACK');}catch{bad=true;}}else bad=true;throw error;}
  finally{client.release(bad);}
 }};
}
async function transaction(pool,role,work){
 const session=await beginFixture(pool,role);try{const result=await work(session);await session.finish(true);return result;}finally{await session.finish();}
}
// Guard probes always roll back on the same client, including unexpected
// success or an assertion failure. No owner mutation under test can commit.
async function rejectedOwnerMutation(sql,args,expected){
 const session=await beginFixture(admin);
 try{await assert.rejects(()=>session.query(sql,args),expected);}finally{await session.finish();}
}
async function rejectedRuntimeQuery(pool,role,sql,args,expected=sqlUnavailable){
 const session=await beginFixture(pool,role);
 try{await assert.rejects(()=>session.query(sql,args),expected);}finally{await session.finish();}
}
const immutableError=error=>error.code==='P0001'&&error.message==='Audit history is append-only';
async function retainedState(){
 const tables=['garden_control.audit_events','garden_control.audit_heads',...PRIVATE.map(table=>'garden_private.'+table)];
 return(await admin.query(tables.map(table=>`SELECT '${table}' AS table_name,count(*)::text AS count,
  encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text COLLATE "C"),''),'UTF8')),'hex') AS sha256 FROM ${table} AS r`).join(' UNION ALL ')+' ORDER BY table_name')).rows;
}
function interceptedPool(pool,intercept){
 return {async connect(){const client=await pool.connect();return {query:async(sql,args)=>intercept(client,sql,args),release:bad=>client.release(bad)};}};
}
function repository(encryptionPool=pools.encryption,issuerPool=pools.issuer,extra={}){
 return createEncryptionPersistence({identity,issuerPool,encryptionPool,environment:'ci',enabled:()=>true,...extra});
}
async function workspace(){
 const id=randomUUID();workspaces.push(id);
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[id,'Synthetic encryption workspace',POLICY]);
 for(const subject of ['alice','bob']){
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[id,subject,POLICY]);
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,'researcher',$2,clock_timestamp()+interval '1 hour')",[id,subject]);
 }
 for(const version of ['v1','v2','v3'])await admin.query(`INSERT INTO garden_control.encryption_key_versions
  (workspace_id,environment,data_class,provider_id,key_ref,key_version,can_read,can_write,not_before,expires_at)
  VALUES($1,'ci','restricted_research',$2,$3,$4,true,true,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour')`,[id,keys.providerId,'garden/ci/restricted_research',version]);
 await admin.query(`INSERT INTO garden_control.encryption_key_bindings
  (workspace_id,repository,environment,data_class,provider_id,key_ref,write_version,enabled,expires_at)
  VALUES($1,'neophilism/The-Garden','ci','restricted_research',$2,$3,'v1',true,clock_timestamp()+interval '1 hour')`,[id,keys.providerId,'garden/ci/restricted_research']);
 return id;
}
async function record(workspaceId,{classification='research',state='active',consent='reviewed'}={}){
 const recordId=randomUUID(),contentVersionId=randomUUID();
 await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state,payload) VALUES($1,$2,'alice',$3,$4,'{}')",[recordId,workspaceId,classification,state]);
 await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'alice',true,true,'research',clock_timestamp()+interval '1 hour')",[workspaceId,recordId]);
 if(consent==='reviewed')await allowSyntheticResearchUse(admin,workspaceId,recordId);
 return {workspaceId,recordId,recordRevision:'1',contentVersionId};
}
function cryptoFor(spec,writeVersion='v1'){
 return keys.component({workspaceId:spec.workspaceId,objectId:spec.recordId,versionId:spec.contentVersionId,environment:'ci',dataClass:'restricted_research',purpose:'research'},{writeVersion});
}
function serviceFor(spec,writeVersion='v1',repo=repository()){
 return createEncryptedContentService({repository:repo,encryption:cryptoFor(spec,writeVersion),enabled:()=>true});
}
async function prepared(spec,repo=repository()){
 const metadata=(await repo.prepare(H('alice'),spec)).value,encryption=cryptoFor(metadata,metadata.keyBinding.writeVersion);
 const envelope=await encryption.encrypt(H('alice'),spec.workspaceId,{objectId:spec.recordId,versionId:metadata.contentVersionId,plaintext:PERSISTENCE_CANARY});
 return {operationId:randomUUID(),...spec,contentVersionId:metadata.contentVersionId,keyPolicyGeneration:metadata.keyPolicyGeneration,expectedGeneration:metadata.head?.generation??'0',expectedDigest:metadata.head?.digest??null,envelope};
}
async function rotation(spec,repo=repository()){
 const metadata=(await repo.load(H('alice'),spec)).value,encryption=cryptoFor(spec,metadata.keyBinding.writeVersion);
 const result=await encryption.rewrap(H('alice'),spec.workspaceId,{objectId:spec.recordId,versionId:spec.contentVersionId,envelope:metadata.envelope});
 return {operationId:randomUUID(),...spec,keyPolicyGeneration:metadata.keyPolicyGeneration,expectedGeneration:metadata.head.generation,expectedDigest:metadata.head.digest,envelope:result.envelope};
}
async function committedState(spec,operationId){
 const counts=(await admin.query(`SELECT
  (SELECT count(*)::integer FROM garden_private.encrypted_content_versions WHERE workspace_id=$1 AND content_version_id=$2) AS versions,
  (SELECT count(*)::integer FROM garden_private.encrypted_envelope_revisions WHERE workspace_id=$1 AND content_version_id=$2) AS revisions,
  (SELECT count(*)::integer FROM garden_private.encrypted_material WHERE workspace_id=$1 AND content_version_id=$2) AS material,
  (SELECT count(*)::integer FROM garden_private.encrypted_content_heads WHERE workspace_id=$1 AND content_version_id=$2) AS heads,
  (SELECT count(*)::integer FROM garden_control.audit_events WHERE workspace_id=$1 AND event_text::jsonb->>'requestId'=$3 AND event_text::jsonb->>'action' IN ('encryption.persist','encryption.rewrap')) AS commit_events`,[spec.workspaceId,spec.contentVersionId,operationId])).rows[0];
 return counts;
}
async function noCommit(spec,operationId){assert.deepEqual(await committedState(spec,operationId),{versions:0,revisions:0,material:0,heads:0,commit_events:0});}
async function waitForBlocked(functionName,{blockerPid,pid,application='garden_persist_encryption_ci'}={}){
 const deadline=Date.now()+4000;
 do{
  const rows=(await admin.query("SELECT pid,query,query_start,clock_timestamp() AS observed_at,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE application_name=$2 AND wait_event_type='Lock' AND position($1 in query)>0 AND ($3::integer IS NULL OR pid=$3) AND ($4::integer IS NULL OR $4=ANY(pg_blocking_pids(pid)))",[functionName,application,pid??null,blockerPid??null])).rows;
  if(rows.length===1)return rows[0];assert.ok(rows.length<=1,'the observed lock wait must identify one synthetic transaction');
  await new Promise(resolve=>setTimeout(resolve,15));
 }while(Date.now()<deadline);
 throw Error('Expected encrypted-content database lock was not observed');
}
async function holdWorkspace(workspaceId){
 const session=await beginFixture(admin);try{await session.query('SELECT pg_advisory_xact_lock(144729,hashtext($1))',[workspaceId]);return session;}catch(error){await session.finish();throw error;}
}
const release=session=>session.finish(true);
async function consentRequired(spec,{expiresIn=3600000,guardian=false,authorityIn=3600000}={}){
 const terms={id:randomUUID(),version:'1',digest:'a'.repeat(64)},grantId=randomUUID();
 const consent=createConsentAdministration({pool:pools.consent,enabled:()=>true,authorize:async(headers,scope)=>({id:'synthetic-consent-reviewer',verified:true,privilegedAssurance:true,...scope})});
 await consent.registerTerms(H('alice'),spec.workspaceId,terms);
 const authority=guardian?'guardian':'self',policy=validateUsePolicy({schemaVersion:1,recordId:spec.recordId,basis:'consent-required',inputs:[],terms,subjects:[{subjectId:'narrator',authority}],purposes:[],reasonDigest:'a'.repeat(64)});
 await consent.setPolicy(H('alice'),spec.workspaceId,policy,'0');
 const now=new Date((await admin.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime();
 const grant=validateConsentGrant({schemaVersion:1,id:grantId,recordId:spec.recordId,subjectId:'narrator',grantorId:guardian?'synthetic-guardian':'narrator',authority,authorityDigest:guardian?'e'.repeat(64):null,authorityExpiresAt:guardian?new Date(now+authorityIn).toISOString():null,terms,purpose:'research',derivativesAllowed:true,
  validFrom:new Date(now-60000).toISOString(),expiresAt:new Date(now+expiresIn).toISOString(),evidenceDigest:'b'.repeat(64)});
 await consent.recordGrant(H('alice'),spec.workspaceId,grant);
 assert.equal((await admin.query("SELECT garden_control.consent_allows($1,$2,'research',clock_timestamp()) AS allowed",[spec.workspaceId,spec.recordId])).rows[0].allowed,true);
 return {grantId,consent,grant,deadline:new Date(Math.min(Date.parse(grant.expiresAt),guardian?Date.parse(grant.authorityExpiresAt):Infinity))};
}
const sqlUnavailable=error=>error.code==='P0001'&&error.message==='Encrypted content unavailable';
const recoveryOf=request=>({workspaceId:request.workspaceId,recordId:request.recordId,operationId:request.operationId,requestDigest:encryptionRequestDigest(request)});
async function unconfirmed(work,request){
 let captured;await assert.rejects(work,error=>{captured=error;return unavailable(error)&&error.commitOutcome==='unconfirmed';});
 assert.ok(Object.isFrozen(captured.recovery));assert.deepEqual(captured.recovery,recoveryOf(request));return captured.recovery;
}
async function cleanDelivery(workspaceId){
 const count=(await admin.query(`SELECT
  (SELECT count(*)::integer FROM garden_control.policy_tickets WHERE workspace_id=$1) AS tickets,
  (SELECT count(*)::integer FROM garden_control.policy_contexts c JOIN garden_control.policy_tickets t USING(token_hash) WHERE t.workspace_id=$1) AS policies,
  (SELECT count(*)::integer FROM garden_control.encrypted_delivery_contexts WHERE workspace_id=$1) AS completions,
  (SELECT count(*)::integer FROM garden_control.encrypted_delivery_checks WHERE workspace_id=$1) AS checks`,[workspaceId])).rows[0];
 assert.deepEqual(count,{tickets:0,policies:0,completions:0,checks:0});
}
async function afterDeadline(deadline){
 await admin.query('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp())))+0.05)',[deadline]);
 assert.equal((await admin.query('SELECT clock_timestamp()>$1::timestamptz AS expired',[deadline])).rows[0].expired,true);
}
async function grantDeadline(spec){
 return (await admin.query("UPDATE garden_control.record_grants SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND record_id=$2 AND subject_id='alice' RETURNING expires_at",[spec.workspaceId,spec.recordId])).rows[0].expires_at;
}
async function renewGrant(spec){
 await admin.query("UPDATE garden_control.record_grants SET revoked_at=NULL,expires_at=clock_timestamp()+interval '1 hour' WHERE workspace_id=$1 AND record_id=$2 AND subject_id='alice'",[spec.workspaceId,spec.recordId]);
}
const rawIssue=spec=>transaction(pools.issuer,'garden_context_issuer',async c=>(await c.query('SELECT garden_control.issue_policy_ticket($1,$2,$3,$4) AS ticket',[spec.workspaceId,'alice','write',spec.recordId])).rows[0].ticket);
const rawRetire=token=>transaction(pools.issuer,'garden_context_issuer',c=>c.query('SELECT garden_control.invalidate_encrypted_delivery($1)',[token]));
async function rawPreparation(spec,token){
 const main=await beginFixture(pools.encryption,'garden_encryption');
 try{
  await main.query('SET CONSTRAINTS ALL DEFERRED');await main.query('SELECT pg_advisory_xact_lock(144729,hashtext($1::text))',[spec.workspaceId]);
  await main.query('SELECT garden_control.bind_policy_context($1)',[token]);
  const value=(await main.query("SELECT garden_control.prepare_encrypted_delivery($1,$2,$3,$4,'ci') AS result",[spec.workspaceId,spec.recordId,spec.recordRevision,spec.contentVersionId])).rows[0].result;
  const admission=(await main.query('SELECT garden_control.encrypted_delivery_admission() AS admission')).rows[0].admission;
  assert.equal(admission.resultFingerprint,encryptionDeliveryFingerprint(value));
  return {main,value,admission};
 }catch(error){await main.finish();throw error;}
}

try{
 assert.deepEqual([...RUNTIME_DATABASE_CAPABILITIES].sort(),Object.values(CAPABILITIES).sort());
 for(const [alias,capability] of Object.entries(CAPABILITIES))await login(alias,capability);
 const repo=repository(),W=await workspace(),OTHER=await workspace(),base=await record(W);
 const request=await prepared(base),digest=encryptionRequestDigest(request);
 const reordered=JSON.parse(JSON.stringify(Object.fromEntries(Object.entries({...request,envelope:Object.fromEntries(Object.entries({...request.envelope,context:Object.fromEntries(Object.entries(request.envelope.context).reverse())}).reverse())}).reverse())));
 const sqlDigests=(await admin.query('SELECT garden_control.encrypted_request_digest($1::jsonb) AS request, garden_control.encrypted_envelope_digest($2::jsonb) AS envelope',[JSON.stringify(reordered),JSON.stringify(reordered.envelope)])).rows[0];
 assert.equal(sqlDigests.request,digest);assert.equal(sqlDigests.envelope,envelopeDigest(request.envelope));
 check('JavaScript and actual JSONB canonical digests agree despite object-key reordering');

 const first=(await repo.commit(H('alice'),reordered)).value,repeat=(await repo.commit(H('alice'),request)).value;
 assert.deepEqual(repeat,first);assert.equal(first.requestDigest,digest);assert.equal(first.generation,'1');assert.equal(first.committed,true);
 assert.deepEqual(await committedState(base,request.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 const loaded=(await repo.load(H('alice'),base)).value;assert.equal(loaded.head.digest,first.envelopeDigest);assert.deepEqual(await cryptoFor(base).decrypt(H('alice'),W,{objectId:base.recordId,versionId:base.contentVersionId,envelope:loaded.envelope}),PERSISTENCE_CANARY);
 check('stored ciphertext survives PostgreSQL serialization and exact operation retries create one material generation and one succeeded event');

 for(const wire of [await repo.prepare(H('alice'),base),await repo.load(H('alice'),base),await repo.receipt(H('alice'),recoveryOf(request))]){
  assert.deepEqual(Object.keys(wire).sort(),['admission','value']);assert.ok(Object.isFrozen(wire)&&Object.isFrozen(wire.admission));
  assert.equal(wire.admission.subjectId,'alice');assert.ok(Date.parse(wire.admission.expiresAt)>Date.now());
  const sql=(await admin.query('SELECT garden_control.encrypted_delivery_fingerprint($1::jsonb) AS fingerprint',[JSON.stringify(wire.value)])).rows[0].fingerprint;
  assert.equal(sql,encryptionDeliveryFingerprint(wire.value));assert.equal(wire.admission.resultFingerprint,sql);
 }
 const sample={nested:{quoted:'Synthetic "quote" \\ slash café 🌱',number:1},empty:null};
 assert.equal((await admin.query('SELECT garden_control.encrypted_delivery_fingerprint($1::jsonb) AS fingerprint',[JSON.stringify(sample)])).rows[0].fingerprint,encryptionDeliveryFingerprint(sample));
 await cleanDelivery(W);
 check('PostgreSQL and JavaScript bind owned metadata and receipt results to the same actor, canonical fingerprint and bounded delivery deadline');

 await rejectedOwnerMutation('UPDATE garden_private.encrypted_content_heads SET envelope_digest=$3 WHERE workspace_id=$1 AND content_version_id=$2',[W,base.contentVersionId,'0'.repeat(64)],error=>error.code==='23503');
 assert.equal((await repo.load(H('alice'),base)).value.head.digest,first.envelopeDigest);
 check('a head digest cannot diverge from its immutable generation receipt, including an attempted direct synthetic restore');

 const scope={workspaceId:W,recordId:base.recordId,operationId:request.operationId,requestDigest:digest};
 assert.deepEqual((await repo.receipt(H('alice'),scope)).value,first);
 await reject(()=>repo.receipt(H('alice'),{...scope,requestDigest:'0'.repeat(64)}));
 await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'bob',true,true,'research',clock_timestamp()+interval '1 hour')",[W,base.recordId]);
 await reject(()=>repo.receipt(H('bob'),scope));await reject(()=>repo.commit(H('bob'),request));
 await reject(()=>repo.commit(H('alice'),{...request,envelope:{...request.envelope,wrappedKey:Buffer.alloc(60,7).toString('base64url')}}));
 assert.deepEqual(await committedState(base,request.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 check('receipt readback requires the original authenticated actor and exact request digest; changed input cannot reuse an operation ID');

 for(const changed of [{workspaceId:OTHER},{recordId:randomUUID()},{recordRevision:'2'},{contentVersionId:randomUUID()}])await reject(()=>repo.load(H('alice'),{...base,...changed}));
 const otherRecord=await record(W);await reject(()=>repo.prepare(H('alice'),{...otherRecord,contentVersionId:base.contentVersionId}));
 const {contentVersionId,...withoutContent}=otherRecord,generated=(await repo.prepare(H('alice'),withoutContent)).value;assert.match(generated.contentVersionId,/^[a-f0-9-]{36}$/);assert.equal(generated.head,null);
 await assert.rejects(()=>admin.query(`INSERT INTO garden_private.encrypted_content_versions
  (workspace_id,content_version_id,record_id,record_revision,environment,data_class,purpose,created_by)
  VALUES($1,$2,$3,999,'ci','restricted_research','research','alice')`,[W,randomUUID(),otherRecord.recordId]),error=>error.code==='23503');
 check('content-version UUIDs bind to an exact workspace/record/numeric-revision foreign key and cannot alias another record');

 for(const classification of ['unclassified','licensed','personal','sealed','government']){
  const spec=await record(W,{classification});await reject(()=>repo.prepare(H('alice'),spec));
 }
 for(const state of ['quarantined','withdrawn']){
  const spec=await record(W,{state});await reject(()=>repo.prepare(H('alice'),spec));
 }
 const unreviewed=await record(W,{consent:'missing'});await reject(()=>repo.prepare(H('alice'),unreviewed));
 const changedRecord=await record(W),changedRequest=await prepared(changedRecord);await repo.commit(H('alice'),changedRequest);
 await admin.query("UPDATE garden_private.record_envelopes SET payload='{}' WHERE workspace_id=$1 AND id=$2",[W,changedRecord.recordId]);
 await reject(()=>repo.load(H('alice'),changedRecord));await reject(()=>repo.prepare(H('alice'),changedRecord));
 check('authoritative classification, active state, exact current revision and reviewed consent are required even for a valid member with a record grant');

 for(const [alias,capability] of Object.entries(CAPABILITIES)){
  const own=await pools[alias].connect();
  try{await assertDatabaseCapability(own,capability);}finally{own.release();}
  for(const table of PRIVATE)await assert.rejects(()=>transaction(pools[alias],capability,client=>client.query('SELECT * FROM garden_private.'+table)),error=>error.code==='42501');
  for(const table of CONTROL)await assert.rejects(()=>transaction(pools[alias],capability,client=>client.query('SELECT * FROM garden_control.'+table)),error=>error.code==='42501');
  if(alias!=='encryption'){
   await assert.rejects(()=>transaction(pools[alias],capability,client=>client.query('SELECT garden_control.prepare_encrypted_delivery($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::text)',[W,base.recordId,'1',base.contentVersionId,'ci'])),error=>error.code==='42501');
   await assert.rejects(()=>transaction(pools[alias],capability,client=>client.query('SELECT garden_control.commit_encrypted_delivery($1::jsonb)',[JSON.stringify(request)])),error=>error.code==='42501');
  }
  for(const [signature,sql,args] of [
   ['prepare_encrypted_content(uuid,uuid,bigint,uuid,text)','SELECT garden_control.prepare_encrypted_content($1,$2,$3,$4,$5)',[W,base.recordId,'1',base.contentVersionId,'ci']],
   ['load_encrypted_content(uuid,uuid,bigint,uuid,text)','SELECT garden_control.load_encrypted_content($1,$2,$3,$4,$5)',[W,base.recordId,'1',base.contentVersionId,'ci']],
   ['commit_encrypted_content(jsonb)','SELECT garden_control.commit_encrypted_content($1::jsonb)',[JSON.stringify(request)]],
   ['encrypted_content_receipt(uuid,uuid,uuid,text)','SELECT garden_control.encrypted_content_receipt($1,$2,$3,$4)',[W,base.recordId,request.operationId,digest]],
   ['current_encrypted_delivery()','SELECT garden_control.current_encrypted_delivery()',[]],
   ['encrypted_delivery_value(garden_control.encrypted_delivery_contexts)','SELECT garden_control.encrypted_delivery_value(NULL::garden_control.encrypted_delivery_contexts)',[]],
   ['complete_encrypted_delivery(text,text,jsonb)',"SELECT garden_control.complete_encrypted_delivery('prepare','ci',$1::jsonb)",[JSON.stringify(loaded)]]
  ]){
 assert.equal((await admin.query('SELECT has_function_privilege($1::name,$2::text,\'EXECUTE\') AS allowed',[capability,'garden_control.'+signature])).rows[0].allowed,false);
   await assert.rejects(()=>transaction(pools[alias],capability,client=>client.query(sql,args)),error=>error.code==='42501');
  }
  if(alias!=='issuer')await assert.rejects(()=>transaction(pools[alias],capability,client=>client.query('SELECT garden_control.finish_encrypted_delivery($1,$2)',['0'.repeat(64),'0'.repeat(64)])),error=>error.code==='42501');
 }
 await assert.rejects(()=>transaction(pools.encryption,'garden_encryption',client=>client.query('SELECT garden_control.prepare_encrypted_delivery($1,$2,$3,$4,$5)',[W,base.recordId,'1',base.contentVersionId,'ci'])),sqlUnavailable);
 await assert.rejects(()=>transaction(pools.encryption,'garden_encryption',client=>client.query('SELECT garden_control.clear_policy_context()')),error=>error.code==='42501');
 await assert.rejects(()=>transaction(pools.encryption,'garden_encryption',client=>client.query('SELECT garden_control.encrypted_envelope($1,$2,1)',[W,base.contentVersionId])),error=>error.code==='42501');
 await admin.query('GRANT garden_encryption TO garden_persist_issuer_ci WITH INHERIT FALSE, SET TRUE');await reject(()=>repo.prepare(H('alice'),base));await admin.query('REVOKE garden_encryption FROM garden_persist_issuer_ci');
 const force=(await admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1::text[])",[[...PRIVATE,...CONTROL]])).rows;
 assert.equal(force.length,PRIVATE.length+CONTROL.length);assert.ok(force.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
 check('all '+force.length+' tables force RLS; '+RUNTIME_DATABASE_CAPABILITIES.length+' disjoint capabilities deny raw tables, legacy entry points and internal completion helpers, and mixed issuer/content capabilities are rejected');

 const schema=(await admin.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='garden_private' AND table_name IN ('encrypted_content_versions','encrypted_envelope_revisions')")).rows;
 assert.equal(schema.some(row=>['wrapped_key','ciphertext','nonce','tag'].includes(row.column_name)),false);
 const retainedBefore=await retainedState();
 for(const table of PRIVATE)assert.ok(retainedBefore.some(row=>row.table_name==='garden_private.'+table&&BigInt(row.count)>0n),'immutable probes require populated metadata, material and heads');
 for(const table of ['encrypted_content_versions','encrypted_envelope_revisions']){
  for(const command of ['UPDATE garden_private.'+table+' SET workspace_id=workspace_id WHERE workspace_id=$1','DELETE FROM garden_private.'+table+' WHERE workspace_id=$1'])await rejectedOwnerMutation(command,[W],immutableError);
  const references=table==='encrypted_content_versions'?['encrypted_envelope_revisions']:['encrypted_material','encrypted_content_heads'];
  await rejectedOwnerMutation('TRUNCATE garden_private.'+table,[],error=>error.code==='0A000'&&error.message==='cannot truncate a table referenced in a foreign key constraint'&&references.some(reference=>error.detail===`Table "${reference}" references "${table}".`));
  await rejectedOwnerMutation('TRUNCATE garden_private.'+table+' CASCADE',[],immutableError);
 }
 assert.deepEqual(await retainedState(),retainedBefore);
 check('immutable metadata excludes wrapped DEKs/ciphertext; direct truncate reaches exact FKs, rewrite/delete/cascading truncate reach append-only triggers, and populated retained state is unchanged');

 const same=await record(W),sameRequest=await prepared(same),sameResults=(await Promise.all([repo.commit(H('alice'),sameRequest),repo.commit(H('alice'),sameRequest)])).map(result=>result.value);
 assert.deepEqual(sameResults[0],sameResults[1]);assert.deepEqual(await committedState(same,sameRequest.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 await admin.query("UPDATE garden_control.encryption_key_bindings SET write_version='v2' WHERE workspace_id=$1",[W]);
 const rotationA=await rotation(base),rotationB=await rotation(base),races=await Promise.allSettled([repo.commit(H('alice'),rotationA),repo.commit(H('alice'),rotationB)]);
 assert.equal(races.filter(result=>result.status==='fulfilled').length,1);
 const winner=races[0].status==='fulfilled'?rotationA:rotationB,receipt=races.find(result=>result.status==='fulfilled').value.value;
 assert.equal(receipt.generation,'2');assert.equal(receipt.previousDigest,first.envelopeDigest);assert.equal(receipt.keyVersion,'v2');
 assert.deepEqual((await repo.commit(H('alice'),winner)).value,receipt);
 const afterRotation=(await repo.load(H('alice'),base)).value;assert.equal(afterRotation.envelope.ciphertext,loaded.envelope.ciphertext);assert.equal(afterRotation.envelope.tag,loaded.envelope.tag);assert.equal(afterRotation.envelope.nonce,loaded.envelope.nonce);
 assert.deepEqual(await serviceFor(base,'v2').decrypt(H('alice'),base),PERSISTENCE_CANARY);
 check('concurrent identical retries converge, while competing digest-and-generation CAS rotations yield one winner and preserve encrypted content');

 await admin.query('UPDATE garden_private.encrypted_content_heads SET generation=1,envelope_digest=$3 WHERE workspace_id=$1 AND content_version_id=$2',[W,base.contentVersionId,first.envelopeDigest]);
 const oldHeadRequest={...rotationA,operationId:randomUUID()};
 try{
  await reject(()=>repo.load(H('alice'),base));await reject(()=>repo.prepare(H('alice'),base));await reject(()=>repo.commit(H('alice'),oldHeadRequest));
  assert.deepEqual(await committedState(base,oldHeadRequest.operationId),{versions:1,revisions:2,material:2,heads:1,commit_events:0});
 }finally{await admin.query('UPDATE garden_private.encrypted_content_heads SET generation=$3,envelope_digest=$4 WHERE workspace_id=$1 AND content_version_id=$2',[W,base.contentVersionId,afterRotation.head.generation,afterRotation.head.digest]);}
 assert.deepEqual(await serviceFor(base,'v2').decrypt(H('alice'),base),PERSISTENCE_CANARY);
 check('an older valid head restored beside newer immutable receipts cannot authorize reads, preparation or another rotation');

 const staleWorkspace=await workspace(),stale=await record(staleWorkspace),staleRequest=await prepared(stale);
 await admin.query("UPDATE garden_control.encryption_key_bindings SET expires_at=expires_at+interval '1 minute' WHERE workspace_id=$1",[staleWorkspace]);
 await reject(()=>repo.commit(H('alice'),staleRequest));await noCommit(stale,staleRequest.operationId);
 const wrongEnvironment=repository(pools.encryption,pools.issuer,{environment:'staging'});await reject(()=>wrongEnvironment.prepare(H('alice'),stale));
 check('current key-policy generation and the actual deployment environment must match before a prepared envelope can commit');

 for(const kind of ['membership','grant','record-state','key-version']){
  const ws=await workspace(),spec=await record(ws),pending=await prepared(spec),blocker=await holdWorkspace(ws);
  const operation=repo.commit(H('alice'),pending);operation.catch(()=>{});
  try{
   await waitForBlocked('pg_advisory_xact_lock',{blockerPid:blocker.pid});
   if(kind==='membership')await blocker.query("UPDATE garden_control.access_members SET state='revoked',version=version+1 WHERE workspace_id=$1 AND subject_id='alice'",[ws]);
   if(kind==='grant')await blocker.query("UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND record_id=$2",[ws,spec.recordId]);
   if(kind==='record-state')await blocker.query("UPDATE garden_private.record_envelopes SET state='withdrawn' WHERE workspace_id=$1 AND id=$2",[ws,spec.recordId]);
   if(kind==='key-version')await blocker.query("UPDATE garden_control.encryption_key_versions SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND key_version='v1'",[ws]);
  }finally{await release(blocker);}
  await reject(()=>operation);await noCommit(spec,pending.operationId);
 }
 check('membership, object grant/state and key revocations committed while admission waits prevent all persistence and succeeded events');

 const consentWorkspace=await workspace(),withdrawn=await record(consentWorkspace,{consent:'required'}),consentState=await consentRequired(withdrawn),withdrawRequest=await prepared(withdrawn),withdrawBlocker=await holdWorkspace(consentWorkspace);
 const waitingWithdrawal=repo.commit(H('alice'),withdrawRequest);waitingWithdrawal.catch(()=>{});
 try{await waitForBlocked('pg_advisory_xact_lock',{blockerPid:withdrawBlocker.pid});await withdrawBlocker.query('SELECT garden_control.withdraw_consent_grant($1,$2,$3,$4)',[consentWorkspace,consentState.grantId,'c'.repeat(64),'synthetic-consent-reviewer']);}finally{await release(withdrawBlocker);}
 await reject(()=>waitingWithdrawal);await noCommit(withdrawn,withdrawRequest.operationId);
 check('a consent withdrawal that wins the shared workspace lock prevents a previously prepared encrypted commit');

 for(const [phase,expires] of [['authority-lock','grant'],['audit-head','grant'],['authority-lock','role'],['key-row','key-version']]){
  const ws=await workspace(),spec=await record(ws),pending=await prepared(spec);
  const expirySql=expires==='grant'?"UPDATE garden_control.record_grants SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND record_id=$2 RETURNING expires_at":
   expires==='role'?"UPDATE garden_control.access_roles SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND subject_id='alice' RETURNING expires_at":
   "UPDATE garden_control.encryption_key_versions SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND key_version='v1' RETURNING expires_at";
  const deadline=(await admin.query(expirySql,expires==='grant'?[ws,spec.recordId]:[ws])).rows[0].expires_at;
  const blocker=await beginFixture(admin);
  if(phase==='authority-lock')await blocker.query('SELECT pg_advisory_xact_lock(144729,hashtext($1))',[ws]);
  else if(phase==='audit-head')await blocker.query('SELECT sequence FROM garden_control.audit_heads WHERE workspace_id=$1 FOR UPDATE',[ws]);
  else await blocker.query("SELECT key_version FROM garden_control.encryption_key_versions WHERE workspace_id=$1 AND key_version='v1' FOR UPDATE",[ws]);
  const operation=repo.commit(H('alice'),pending);operation.catch(()=>{});
  try{const wait=await waitForBlocked(phase==='authority-lock'?'pg_advisory_xact_lock':'commit_encrypted_delivery',{blockerPid:blocker.pid});assert.ok(wait.query_start<deadline,'the blocked statement must start while authority is still valid');await admin.query('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp())))+0.05)',[deadline]);}
  finally{await release(blocker);}
  await reject(()=>operation);await noCommit(spec,pending.operationId);
 }
 check('grant, role and key expiry after already-dispatched authority, key-row or audit-head waits rolls back material, head, receipt and commit audit');

 const tailWorkspace=await workspace(),tail=await record(tailWorkspace),tailRequest=await prepared(tail);
 const tailDeadline=(await admin.query("UPDATE garden_control.record_grants SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND record_id=$2 RETURNING expires_at",[tailWorkspace,tail.recordId])).rows[0].expires_at;
 let waited=false;
 const tailPool=interceptedPool(pools.encryption,async(client,sql,args)=>{
  if(sql==='COMMIT'&&!waited){await afterDeadline(tailDeadline);waited=true;}
  return client.query(sql,args);
 });
 await reject(()=>repository(tailPool).commit(H('alice'),tailRequest));assert.equal(waited,true);await noCommit(tail,tailRequest.operationId);
 check('the repository-owned transaction rechecks the captured authority deadline at actual COMMIT after its SQL function has returned');

 const rollbackWorkspace=await workspace(),rollbackSpec=await record(rollbackWorkspace),rollbackRequest=await prepared(rollbackSpec);
 const rollbackPool=interceptedPool(pools.encryption,async(client,sql,args)=>{const result=await client.query(sql,args);if(sql.includes('commit_encrypted_delivery'))throw Error('SYNTHETIC-ROLLBACK-SECRET-CANARY');return result;});
 await reject(()=>repository(rollbackPool).commit(H('alice'),rollbackRequest));await noCommit(rollbackSpec,rollbackRequest.operationId);
 check('failure after the mutation function but before COMMIT rolls back its material, metadata, head and succeeded audit event atomically');

 const auditWorkspace=await workspace(),auditSpec=await record(auditWorkspace),auditRequest=await prepared(auditSpec);
 // The sequence is deliberately nontransactional test instrumentation. It
 // proves append reached a visible new identity before the forced failure;
 // all application tables and audit history must still roll back together.
 await admin.query('CREATE SEQUENCE garden_control.encryption_fixture_audit_reached');
 await admin.query(`CREATE FUNCTION garden_control.encryption_fixture_audit_failure() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
  BEGIN
   IF NOT EXISTS(SELECT 1 FROM garden_private.encrypted_content_versions WHERE workspace_id=NEW.workspace_id AND content_version_id='${auditSpec.contentVersionId}'::uuid) THEN RAISE EXCEPTION 'Synthetic fixture did not reach new version'; END IF;
   PERFORM nextval('garden_control.encryption_fixture_audit_reached');
   RAISE EXCEPTION 'Synthetic audit append failure';
  END $$`);
 await admin.query(`CREATE TRIGGER encryption_fixture_audit_failure BEFORE INSERT ON garden_control.audit_events
  FOR EACH ROW WHEN (NEW.workspace_id='${auditWorkspace}'::uuid AND NEW.event_text::jsonb->>'action'='encryption.persist')
  EXECUTE FUNCTION garden_control.encryption_fixture_audit_failure()`);
 try{
  await reject(()=>repo.commit(H('alice'),auditRequest));
  assert.equal((await admin.query('SELECT is_called FROM garden_control.encryption_fixture_audit_reached')).rows[0].is_called,true);
  await noCommit(auditSpec,auditRequest.operationId);
 }finally{
  await admin.query('DROP TRIGGER encryption_fixture_audit_failure ON garden_control.audit_events');
  await admin.query('DROP FUNCTION garden_control.encryption_fixture_audit_failure()');
  await admin.query('DROP SEQUENCE garden_control.encryption_fixture_audit_reached');
 }
 check('actual audit insertion failure after content identity insertion rolls back the identity, material, head, receipt and succeeded event');

 const lostWorkspace=await workspace(),lostSpec=await record(lostWorkspace),lostRequest=await prepared(lostSpec);let lost=false;
 const lostPool=interceptedPool(pools.encryption,async(client,sql,args)=>{const value=await client.query(sql,args);if(sql==='COMMIT'&&!lost){lost=true;throw Error('SYNTHETIC-LOST-RESPONSE-SECRET');}return value;});
 let uncertain;try{await repository(lostPool).commit(H('alice'),lostRequest);assert.fail('a deliberately lost COMMIT acknowledgment must not be reported as confirmed');}catch(error){assert.ok(error instanceof EncryptionPersistenceError);uncertain=error;}
 assert.equal(uncertain.commitOutcome,'unconfirmed');assert.ok(Object.isFrozen(uncertain.recovery));
 assert.deepEqual(uncertain.recovery,{workspaceId:lostWorkspace,recordId:lostSpec.recordId,operationId:lostRequest.operationId,requestDigest:encryptionRequestDigest(lostRequest)});
 const recovered=(await repo.receipt(H('alice'),uncertain.recovery)).value;assert.equal(recovered.committed,true);assert.deepEqual((await repo.commit(H('alice'),lostRequest)).value,recovered);
 assert.deepEqual(await committedState(lostSpec,lostRequest.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 check('lost COMMIT acknowledgment exposes only a safe unconfirmed recovery binding; fresh readback proves the one committed operation without re-encryption');

 const stored=(await repo.load(H('alice'),lostSpec)).value,rootRef='garden/ci/restricted_research/v1',originalRoot=keys.roots.get(rootRef),root=Buffer.from(originalRoot);originalRoot.fill(0);
 keys.roots.delete(rootRef);await assert.rejects(()=>cryptoFor(lostSpec).decrypt(H('alice'),lostWorkspace,{objectId:lostSpec.recordId,versionId:lostSpec.contentVersionId,envelope:stored.envelope}));
 const wrongRoot=randomBytes(32);keys.roots.set(rootRef,wrongRoot);await reject(()=>serviceFor(lostSpec).decrypt(H('alice'),lostSpec));wrongRoot.fill(0);
 keys.roots.set(rootRef,root);assert.deepEqual(await serviceFor(lostSpec).decrypt(H('alice'),lostSpec),PERSISTENCE_CANARY);
 check('real stored ciphertext rejects a missing or wrong recovered wrapping key and becomes readable only after the exact synthetic key is recovered');

 const material=(await admin.query('SELECT * FROM garden_private.encrypted_material WHERE workspace_id=$1 AND content_version_id=$2 AND generation=1',[lostWorkspace,lostSpec.contentVersionId])).rows[0];
 await admin.query('DELETE FROM garden_private.encrypted_material WHERE workspace_id=$1 AND content_version_id=$2',[lostWorkspace,lostSpec.contentVersionId]);await reject(()=>repo.load(H('alice'),lostSpec));
 assert.deepEqual((await repo.receipt(H('alice'),uncertain.recovery)).value,recovered);
 await admin.query('INSERT INTO garden_private.encrypted_material(workspace_id,content_version_id,generation,wrapped_key,nonce,ciphertext,tag) VALUES($1,$2,$3,$4,$5,$6,$7)',[material.workspace_id,material.content_version_id,material.generation,material.wrapped_key,material.nonce,material.ciphertext,material.tag]);
 assert.deepEqual(await serviceFor(lostSpec).decrypt(H('alice'),lostSpec),PERSISTENCE_CANARY);assert.equal(keys.roots.has(rootRef),true);
 check('synthetic material removal leaves immutable receipts and shared class keys intact; isolated material restoration must still pass current authorization');

 const restoreWorkspace=await workspace(),restoreSpec=await record(restoreWorkspace,{consent:'required'}),restoreConsent=await consentRequired(restoreSpec),restoreRequest=await prepared(restoreSpec);await repo.commit(H('alice'),restoreRequest);
 const backup=(await admin.query('SELECT * FROM garden_private.encrypted_material WHERE workspace_id=$1 AND content_version_id=$2',[restoreWorkspace,restoreSpec.contentVersionId])).rows[0];
 await restoreConsent.consent.withdraw(H('alice'),restoreWorkspace,restoreConsent.grantId,'f'.repeat(64));
 await admin.query('DELETE FROM garden_private.encrypted_material WHERE workspace_id=$1 AND content_version_id=$2',[restoreWorkspace,restoreSpec.contentVersionId]);
 await admin.query('INSERT INTO garden_private.encrypted_material(workspace_id,content_version_id,generation,wrapped_key,nonce,ciphertext,tag) VALUES($1,$2,$3,$4,$5,$6,$7)',[backup.workspace_id,backup.content_version_id,backup.generation,backup.wrapped_key,backup.nonce,backup.ciphertext,backup.tag]);
 await reject(()=>repo.load(H('alice'),restoreSpec));await reject(()=>repo.commit(H('alice'),restoreRequest));
 check('restoring older encrypted material into current consent state cannot revive a withdrawn source or its old operation receipt');

 // Reads and exact replays now have their own deferred completion row. Their
 // old immutable content receipt must not substitute for present admission.
 for(const mode of ['prepare','load','receipt','replay']){
  const ws=await workspace(),spec=await record(ws),pending=await prepared(spec);await repo.commit(H('alice'),pending);
  const before=await committedState(spec,pending.operationId),deadline=await grantDeadline(spec);let reached=false,waited=false;
  const delayed=interceptedPool(pools.encryption,async(client,sql,args)=>{
   const data=/garden_control\.(prepare_encrypted_delivery|load_encrypted_delivery|recover_encrypted_delivery|commit_encrypted_delivery)\(/.test(sql);
   if(sql==='COMMIT'&&reached&&!waited){await afterDeadline(deadline);waited=true;}
   const result=await client.query(sql,args);if(data)reached=true;return result;
  });
  const subject=repository(delayed);
  await reject(()=>mode==='receipt'?subject.receipt(H('alice'),recoveryOf(pending)):mode==='replay'?subject.commit(H('alice'),pending):subject[mode](H('alice'),spec));
  assert.equal(reached,true);assert.equal(waited,true);assert.deepEqual(await committedState(spec,pending.operationId),before);await cleanDelivery(ws);
 }
 check('prepare, load, receipt and exact replay all deny when current authority expires after the function but before actual main COMMIT, without changing retained content or audit');

 for(const closure of ['identity','feature'])for(const mode of ['load','commit']){
  const ws=await workspace(),spec=await record(ws),pending=await prepared(spec);
  if(mode==='load')await repo.commit(H('alice'),pending);
  let active=true,finishing=false,closed=false;
  const finishPool=interceptedPool(pools.issuer,async(client,sql,args)=>{
   const result=await client.query(sql,args);
   if(sql.includes('finish_encrypted_delivery'))finishing=true;
   if(sql==='COMMIT'&&finishing&&!closed){closed=true;active=false;}return result;
  });
  const subject=repository(pools.encryption,finishPool,{identity:{viewer:async()=>active||closure==='feature'?{id:'alice',verified:true}:null},enabled:()=>active||closure==='identity'});
  if(mode==='commit')await unconfirmed(()=>subject.commit(H('alice'),pending),pending);else await reject(()=>subject.load(H('alice'),spec));
  assert.equal(closed,true);assert.deepEqual(await committedState(spec,pending.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});await cleanDelivery(ws);
  assert.equal((await repo.receipt(H('alice'),recoveryOf(pending))).value.committed,true);
 }
 check('identity or feature closure after final issuer COMMIT suppresses reads and leaves completed writes explicitly unconfirmed with exact recovery');

 for(const revocation of ['grant','consent','key'])for(const mode of ['load','commit']){
  const ws=await workspace(),spec=await record(ws,{consent:revocation==='consent'?'required':'reviewed'});
  const consentState=revocation==='consent'?await consentRequired(spec):null,pending=await prepared(spec);
  if(mode==='load')await repo.commit(H('alice'),pending);
  let revoked=false;
  const finishPool=interceptedPool(pools.issuer,async(client,sql,args)=>{
   if(sql.includes('finish_encrypted_delivery')&&!revoked){
    if(revocation==='grant')await admin.query("UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND record_id=$2 AND subject_id='alice'",[ws,spec.recordId]);
    if(revocation==='consent')await consentState.consent.withdraw(H('alice'),ws,consentState.grantId,'f'.repeat(64));
    if(revocation==='key')await admin.query("UPDATE garden_control.encryption_key_versions SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND key_version='v1'",[ws]);
    revoked=true;
   }
   return client.query(sql,args);
  });
  const subject=repository(pools.encryption,finishPool);
  if(mode==='commit')await unconfirmed(()=>subject.commit(H('alice'),pending),pending);else await reject(()=>subject.load(H('alice'),spec));
  assert.equal(revoked,true);assert.deepEqual(await committedState(spec,pending.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});await cleanDelivery(ws);
  if(revocation==='key')assert.equal((await repo.receipt(H('alice'),recoveryOf(pending))).value.committed,true);
  else await reject(()=>repo.receipt(H('alice'),recoveryOf(pending)));
 }
 check('fresh issuer admission observes grant, consent and key revocation after main locks are released; a committed write remains recoverable only under the current required authority');

 for(const boundary of ['workspace-wait','finish-commit'])for(const mode of ['load','commit']){
  const ws=await workspace(),spec=await record(ws),pending=await prepared(spec);if(mode==='load')await repo.commit(H('alice'),pending);
  const deadline=await grantDeadline(spec);let finishing=false,waited=false;
  const finishPool=interceptedPool(pools.issuer,async(client,sql,args)=>{
   if(sql.includes('finish_encrypted_delivery')){
    finishing=true;
    if(boundary==='workspace-wait'){
     const blocker=await holdWorkspace(ws),operation=client.query(sql,args);operation.catch(()=>{});
     try{const observed=await waitForBlocked('finish_encrypted_delivery',{blockerPid:blocker.pid,application:'garden_persist_issuer_ci'});assert.ok(observed.query_start<deadline);await afterDeadline(deadline);waited=true;}
     finally{await release(blocker);}return operation;
    }
   }
   if(sql==='COMMIT'&&finishing&&!waited){await afterDeadline(deadline);waited=true;}
   return client.query(sql,args);
  });
  const subject=repository(pools.encryption,finishPool);
  if(mode==='commit')await unconfirmed(()=>subject.commit(H('alice'),pending),pending);else await reject(()=>subject.load(H('alice'),spec));
  assert.equal(waited,true);assert.deepEqual(await committedState(spec,pending.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});await cleanDelivery(ws);
  await renewGrant(spec);assert.equal((await repo.receipt(H('alice'),recoveryOf(pending))).value.committed,true);
 }
 check('an observed final issuer workspace wait and the issuer COMMIT itself recheck real authority expiry after main commit, then retire both contexts without delivering a stale result');

 // The last host identity await happens after the repository's final SQL
 // transaction. Preserve its minimum SQL deadline through that extra await.
 for(const limiting of ['grant','consent','representative'])for(const mode of ['decrypt','recover','store']){
  const ws=await workspace(),spec=await record(ws,{consent:limiting==='grant'?'reviewed':'required'});
  const consentState=limiting==='grant'?null:await consentRequired(spec,{expiresIn:limiting==='consent'?2000:3600000,guardian:limiting==='representative',authorityIn:2000});
  const pending=await prepared(spec);if(mode!=='store')await repo.commit(H('alice'),pending);
  const deadline=limiting==='grant'?await grantDeadline(spec):consentState.deadline;
  const raw=repository();let loadedCount=0,finalReturned=false,waited=false,commitRequest,owned;
  const bound={...raw,
   async load(...args){const result=await raw.load(...args);if(++loadedCount===2)finalReturned=true;return result;},
   async receipt(...args){const result=await raw.receipt(...args);finalReturned=true;return result;},
   async commit(...args){commitRequest=args[1];const result=await raw.commit(...args);finalReturned=true;return result;},
   async verifyIdentity(...args){if(finalReturned&&!waited){await afterDeadline(deadline);waited=true;}return raw.verifyIdentity(...args);}
  };
  const component=cryptoFor(spec),encryption={...component,async decrypt(...args){owned=await component.decrypt(...args);return owned;}};
  const service=createEncryptedContentService({repository:bound,encryption,enabled:()=>true});
  if(mode==='store'){
   let captured;await assert.rejects(()=>service.store(H('alice'),{...spec,operationId:pending.operationId},PERSISTENCE_CANARY),error=>{captured=error;return unavailable(error)&&error.commitOutcome==='unconfirmed';});
   assert.ok(Object.isFrozen(captured.recovery));assert.deepEqual(captured.recovery,recoveryOf(commitRequest));
  }else if(mode==='decrypt')await reject(()=>service.decrypt(H('alice'),spec));
  else await reject(()=>service.recover(H('alice'),recoveryOf(pending)));
  assert.equal(finalReturned,true);assert.equal(waited,true);
  if(mode==='decrypt'){assert.ok(Buffer.isBuffer(owned));assert.ok(owned.every(byte=>byte===0));}
  assert.deepEqual(await committedState(spec,pending.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});await cleanDelivery(ws);
  if(limiting!=='grant')assert.equal((await admin.query("SELECT garden_control.consent_allows($1,$2,'research',clock_timestamp()) AS allowed",[ws,spec.recordId])).rows[0].allowed,false);
 }
 check('grant, consent and representative deadlines survive the final composed host identity await: decrypt and recovery deny, owned plaintext is cleared, and committed stores retain only an unconfirmed operation handle');

 for(const mode of ['decrypt','store']){
  const ws=await workspace(),spec=await record(ws),pending=await prepared(spec);if(mode==='decrypt')await repo.commit(H('alice'),pending);
  await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'bob',true,true,'research',clock_timestamp()+interval '1 hour')",[ws,spec.recordId]);
  assert.equal((await repo.prepare(H('bob'),spec)).admission.subjectId,'bob');
  let actor='alice',owned,cryptoRan=false;
  const raw=repository(pools.encryption,pools.issuer,{identity:{viewer:async()=>({id:actor,verified:true})}}),component=cryptoFor(spec);
  const encryption={...component,
   async encrypt(...args){const value=await component.encrypt(...args);cryptoRan=true;actor='bob';return value;},
   async decrypt(...args){owned=await component.decrypt(...args);cryptoRan=true;actor='bob';return owned;}
  };
  const service=createEncryptedContentService({repository:raw,encryption,enabled:()=>true});
  if(mode==='store'){await reject(()=>service.store(H('alice'),{...spec,operationId:pending.operationId},PERSISTENCE_CANARY));await noCommit(spec,pending.operationId);}
  else{await reject(()=>service.decrypt(H('alice'),spec));assert.ok(owned.every(byte=>byte===0));assert.deepEqual(await committedState(spec,pending.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});}
  assert.equal(cryptoRan,true);await cleanDelivery(ws);
 }
 check('the initial authenticated principal remains pinned across real crypto and subsequent SQL calls even when the replacement actor independently has valid record authority');

 const retiredWorkspace=await workspace(),retiredSpec=await record(retiredWorkspace),retiredRequest=await prepared(retiredSpec),retiredReceipt=(await repo.commit(H('alice'),retiredRequest)).value;
 await admin.query("UPDATE garden_control.encryption_key_bindings SET write_version='v2' WHERE workspace_id=$1",[retiredWorkspace]);
 const retiredRotation=await rotation(retiredSpec);await repo.commit(H('alice'),retiredRotation);
 await admin.query("UPDATE garden_control.encryption_key_versions SET can_read=false,can_write=false,revoked_at=clock_timestamp() WHERE workspace_id=$1",[retiredWorkspace]);
 await admin.query('DELETE FROM garden_private.encrypted_material WHERE workspace_id=$1',[retiredWorkspace]);
 await reject(()=>repo.load(H('alice'),retiredSpec));await reject(()=>repo.prepare(H('alice'),retiredSpec));
 assert.deepEqual((await repo.receipt(H('alice'),recoveryOf(retiredRequest))).value,retiredReceipt);
 assert.deepEqual(await serviceFor(retiredSpec).recover(H('alice'),recoveryOf(retiredRequest)),retiredReceipt);
 assert.deepEqual(await committedState(retiredSpec,retiredRequest.operationId),{versions:1,revisions:2,material:0,heads:1,commit_events:1});await cleanDelivery(retiredWorkspace);
 check('historical-generation receipt recovery remains separate from readable keys, latest wrapper generation and erasable material, while content delivery denies');

 const contextWorkspace=await workspace(),contextSpec=await record(contextWorkspace),contextBefore=await retainedState(),contextToken=await rawIssue(contextSpec);
 let contextMain;
 try{
  const pending=await rawPreparation(contextSpec,contextToken);contextMain=pending.main;
  await rejectedRuntimeQuery(pools.encryption,'garden_encryption','SELECT garden_control.encrypted_delivery_admission()',[]);
  await rejectedRuntimeQuery(pools.issuer,'garden_context_issuer','SELECT garden_control.finish_encrypted_delivery($1,$2)',[contextToken,pending.admission.resultFingerprint]);
  await contextMain.query('SELECT garden_control.clear_encrypted_delivery()');await contextMain.finish(true);
  const retained=(await admin.query('SELECT backend_pid,transaction_id::text AS transaction_id,closed_at IS NOT NULL AS closed FROM garden_control.encrypted_delivery_contexts WHERE token_hash=sha256(convert_to($1,\'UTF8\'))',[contextToken])).rows;
  assert.equal(retained.length,1);assert.equal(retained[0].backend_pid,contextMain.pid);assert.equal(retained[0].closed,true);
  await rejectedRuntimeQuery(pools.encryption,'garden_encryption','SELECT garden_control.encrypted_delivery_admission()',[]);
  await rejectedRuntimeQuery(pools.encryption,'garden_encryption','SELECT garden_control.bind_policy_context($1)',[contextToken],error=>error.code==='P0001'&&error.message==='Policy context denied');
  await rejectedRuntimeQuery(pools.issuer,'garden_context_issuer','SELECT garden_control.finish_encrypted_delivery($1,$2)',[contextToken,'0'.repeat(64)]);
  assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.encrypted_delivery_contexts WHERE token_hash=sha256(convert_to($1,\'UTF8\'))',[contextToken])).rows[0].n,1);
  const final=await transaction(pools.issuer,'garden_context_issuer',async client=>{
   assert.notEqual(client.pid,contextMain.pid,'the final issuer must use its separate capability pool');
   return (await client.query('SELECT garden_control.finish_encrypted_delivery($1,$2) AS admission',[contextToken,pending.admission.resultFingerprint])).rows[0].admission;
  });
  assert.equal(final.subjectId,'alice');assert.equal(final.resultFingerprint,pending.admission.resultFingerprint);
  await rejectedRuntimeQuery(pools.issuer,'garden_context_issuer','SELECT garden_control.finish_encrypted_delivery($1,$2)',[contextToken,pending.admission.resultFingerprint]);
 }finally{if(contextMain)await contextMain.finish();await rawRetire(contextToken);}
 assert.deepEqual(await retainedState(),contextBefore);await cleanDelivery(contextWorkspace);
 check('main completion is bound to its actual PID and xid; uncommitted, cross-context, reused-ticket, wrong-digest and consumed-completion calls deny, while one separate issuer finish retires the exact result');

 for(const outcome of ['rollback','expired']){
  const ws=await workspace(),spec=await record(ws),token=await rawIssue(spec),before=await retainedState();let main,fingerprint;
  try{
   const prepared=await rawPreparation(spec,token);main=prepared.main;fingerprint=prepared.admission.resultFingerprint;
   await main.query('SELECT garden_control.clear_encrypted_delivery()');await main.finish(outcome==='expired');
   if(outcome==='expired'){
    const at=(await admin.query("UPDATE garden_control.policy_tickets SET expires_at=clock_timestamp()+interval '250 milliseconds' WHERE token_hash=sha256(convert_to($1,'UTF8')) RETURNING expires_at",[token])).rows[0].expires_at;
    await afterDeadline(at);
   }
   await rejectedRuntimeQuery(pools.issuer,'garden_context_issuer','SELECT garden_control.finish_encrypted_delivery($1,$2)',[token,fingerprint]);
  }finally{if(main)await main.finish();await rawRetire(token);}
  assert.deepEqual(await retainedState(),before);await cleanDelivery(ws);
 }
 check('a rolled-back main transaction and an expired original ticket cannot create final delivery authority; explicit retirement clears the bounded policy/completion residue');

 const retirementWorkspace=await workspace(),retirementSpec=await record(retirementWorkspace),retirementRequest=await prepared(retirementSpec);
 let originalToken,lostAck=false,retirementFailed=false;
 const retirementMain=interceptedPool(pools.encryption,async(client,sql,args)=>{
  const result=await client.query(sql,args);if(sql==='COMMIT'&&!lostAck){lostAck=true;throw Error('SYNTHETIC-LOST-ENCRYPTED-ACK');}return result;
 });
 const retirementIssuer=interceptedPool(pools.issuer,async(client,sql,args)=>{
  if(sql.includes('invalidate_encrypted_delivery')&&!retirementFailed){retirementFailed=true;throw Error('SYNTHETIC-ISSUER-RETIREMENT-OUTAGE');}
  const result=await client.query(sql,args);if(sql.includes('issue_policy_ticket'))originalToken=result.rows[0].ticket;return result;
 });
 try{
  await unconfirmed(()=>repository(retirementMain,retirementIssuer).commit(H('alice'),retirementRequest),retirementRequest);
  assert.equal(lostAck,true);assert.equal(retirementFailed,true);assert.match(originalToken,/^[a-f0-9]{64}$/);
  const residue=(await admin.query('SELECT count(*)::integer AS n FROM garden_control.encrypted_delivery_contexts WHERE workspace_id=$1',[retirementWorkspace])).rows[0].n;
  assert.equal(residue,1,'a deliberately failed retirement is retained, never mislabeled as successful cleanup');
  await rejectedRuntimeQuery(pools.encryption,'garden_encryption','SELECT garden_control.encrypted_delivery_admission()',[]);
  assert.equal((await repo.receipt(H('alice'),recoveryOf(retirementRequest))).value.committed,true);
  assert.deepEqual(await committedState(retirementSpec,retirementRequest.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 }finally{if(originalToken)await rawRetire(originalToken);}
 await cleanDelivery(retirementWorkspace);
 check('lost acknowledgment plus a real retirement outage denies delivery, preserves one committed operation and visible bounded residue, and a successful explicit cleanup retry removes it');

 for(const ws of workspaces){
  const audit=(await admin.query('SELECT workspace_id::text AS "workspaceId",sequence::text AS sequence,previous_hash AS "previousHash",hash,event_text AS "eventText" FROM garden_control.audit_events AS ae WHERE workspace_id=$1 ORDER BY ae.sequence',[ws])).rows;
  verifyAuditPage(audit,{workspaceId:ws,sequence:'0',hash:GENESIS});assert.equal(JSON.stringify(audit).includes(PERSISTENCE_CANARY.toString()),false);
  for(const event of audit.map(row=>JSON.parse(row.eventText)))assert.equal(Object.hasOwn(event,'wrappedKey')||Object.hasOwn(event,'ciphertext'),false);
  await cleanDelivery(ws);
 }
 await assert.rejects(()=>admin.query("SELECT garden_control.append_audit_event($1,'subject','alice','record',$2,1,'encryption.arbitrary',gen_random_uuid())",[W,base.recordId]));
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.policy_tickets')).rows[0].n,0);
 check('all new mutation/key-policy events verify in the closed tamper-evident audit catalog without plaintext or pooled ticket residue');

 await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/encryption-persistence-results.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,checks,real_postgresql:true,synthetic_identity:true,synthetic_key_provider:true,
  live_provider_verified:false,hosted_deployment_verified:false,physical_erasure_verified:false,independent_restore_anchor:false,full_backup_restore_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' real PostgreSQL encrypted-content persistence and authority checks');
}finally{keys.close();for(const pool of Object.values(pools))await pool.end();await admin.end();}
