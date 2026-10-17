/** Real PostgreSQL persistence and concurrency checks; isolated synthetic CI only. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createEncryptionPersistence,createEncryptedContentService,encryptionRequestDigest,EncryptionPersistenceError} from './encryption-persistence.mjs';
import {createConsentAdministration} from './consent-administration.mjs';
import {allowSyntheticResearchUse} from './consent-test-fixture.mjs';
import {GENESIS,verifyAuditPage} from '../../../packages/domain/src/audit/ledger.mjs';
import {envelopeDigest} from '../../../services/workers/src/trusted-encryption.mjs';
import {createPersistenceKeys,PERSISTENCE_CANARY} from '../../../tests/security/encryption-persistence-fixture.mjs';

if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||
 process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='5432'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='neondb')throw Error('Encryption persistence fixtures require isolated loopback CI');
const config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:8,connectionTimeoutMillis:5000};
const admin=new pg.Pool(config),pools={},checks=[],workspaces=[],keys=createPersistenceKeys(),H=subject=>new Headers({'synthetic-subject':subject}),POLICY='d'.repeat(64);
const identity={viewer:async headers=>headers.get('synthetic-subject')?{id:headers.get('synthetic-subject'),verified:true}:null};
const check=name=>{checks.push({name,result:'pass'});console.log('ENCRYPTION '+checks.length+': '+name);};
const reject=work=>assert.rejects(work,error=>error instanceof EncryptionPersistenceError&&!/CANARY|PASSWORD|postgresql:/.test(error.message));
const PRIVATE=['encrypted_content_versions','encrypted_envelope_revisions','encrypted_material','encrypted_content_heads'];
const CONTROL=['encryption_key_versions','encryption_key_bindings'];
const CAPABILITIES={issuer:'garden_context_issuer',encryption:'garden_encryption',membership:'garden_membership_admin',consent:'garden_consent_admin',research:'garden_research',worker:'garden_worker',publisher:'garden_publisher',public:'garden_public',audit:'garden_audit_writer',reader:'garden_audit_reader'};

async function login(alias,capability){
 const name='garden_persist_'+alias+'_ci',password=randomBytes(32).toString('hex');
 await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
 await admin.query(`GRANT ${capability} TO ${name} WITH INHERIT FALSE, SET TRUE`);
 const pool=new pg.Pool({...config,user:name,password,application_name:name});pools[alias]=pool;return pool;
}
async function transaction(pool,role,work){
 const client=await pool.connect();try{await client.query('BEGIN');if(role)await client.query('SET LOCAL ROLE '+role);const result=await work(client);await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
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
 const metadata=await repo.prepare(H('alice'),spec),encryption=cryptoFor(metadata,metadata.keyBinding.writeVersion);
 const envelope=await encryption.encrypt(H('alice'),spec.workspaceId,{objectId:spec.recordId,versionId:metadata.contentVersionId,plaintext:PERSISTENCE_CANARY});
 return {operationId:randomUUID(),...spec,contentVersionId:metadata.contentVersionId,keyPolicyGeneration:metadata.keyPolicyGeneration,expectedGeneration:metadata.head?.generation??'0',expectedDigest:metadata.head?.digest??null,envelope};
}
async function rotation(spec,repo=repository()){
 const metadata=await repo.load(H('alice'),spec),encryption=cryptoFor(spec,metadata.keyBinding.writeVersion);
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
async function waitForBlocked(functionName){
 const deadline=Date.now()+4000;
 do{
  const rows=(await admin.query("SELECT pid,query_start,clock_timestamp() AS observed_at FROM pg_stat_activity WHERE application_name='garden_persist_encryption_ci' AND wait_event_type='Lock' AND position($1 in query)>0",[functionName])).rows;
  if(rows.length)return rows[0];
  await new Promise(resolve=>setTimeout(resolve,15));
 }while(Date.now()<deadline);
 throw Error('Expected encrypted-content database lock was not observed');
}
async function holdWorkspace(workspaceId){
 const client=await admin.connect();await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(144729,hashtext($1))',[workspaceId]);return client;
}
async function release(client){try{await client.query('COMMIT');}finally{client.release();}}
async function consentRequired(spec){
 const terms={id:randomUUID(),version:'1',digest:'a'.repeat(64)},grantId=randomUUID();
 const consent=createConsentAdministration({pool:pools.consent,enabled:()=>true,authorize:async(headers,scope)=>({id:'synthetic-consent-reviewer',verified:true,privilegedAssurance:true,...scope})});
 await consent.registerTerms(H('alice'),spec.workspaceId,terms);
 await consent.setPolicy(H('alice'),spec.workspaceId,{schemaVersion:1,recordId:spec.recordId,basis:'consent-required',inputs:[],terms,subjects:[{subjectId:'narrator',authority:'self'}],purposes:[],reasonDigest:'a'.repeat(64)},'0');
 await consent.recordGrant(H('alice'),spec.workspaceId,{schemaVersion:1,id:grantId,recordId:spec.recordId,subjectId:'narrator',grantorId:'narrator',authority:'self',authorityDigest:null,authorityExpiresAt:null,terms,purpose:'research',derivativesAllowed:true,
  validFrom:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),evidenceDigest:'b'.repeat(64)});
 return {grantId,consent};
}

try{
 for(const [alias,capability] of Object.entries(CAPABILITIES))await login(alias,capability);
 const repo=repository(),W=await workspace(),OTHER=await workspace(),base=await record(W);
 const request=await prepared(base),digest=encryptionRequestDigest(request);
 const reordered=JSON.parse(JSON.stringify(Object.fromEntries(Object.entries({...request,envelope:Object.fromEntries(Object.entries({...request.envelope,context:Object.fromEntries(Object.entries(request.envelope.context).reverse())}).reverse())}).reverse())));
 const sqlDigests=(await admin.query('SELECT garden_control.encrypted_request_digest($1::jsonb) AS request, garden_control.encrypted_envelope_digest($2::jsonb) AS envelope',[JSON.stringify(reordered),JSON.stringify(reordered.envelope)])).rows[0];
 assert.equal(sqlDigests.request,digest);assert.equal(sqlDigests.envelope,envelopeDigest(request.envelope));
 check('JavaScript and actual JSONB canonical digests agree despite object-key reordering');

 const first=await repo.commit(H('alice'),reordered),repeat=await repo.commit(H('alice'),request);
 assert.deepEqual(repeat,first);assert.equal(first.requestDigest,digest);assert.equal(first.generation,'1');assert.equal(first.committed,true);
 assert.deepEqual(await committedState(base,request.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 const loaded=await repo.load(H('alice'),base);assert.equal(loaded.head.digest,first.envelopeDigest);assert.deepEqual(await cryptoFor(base).decrypt(H('alice'),W,{objectId:base.recordId,versionId:base.contentVersionId,envelope:loaded.envelope}),PERSISTENCE_CANARY);
 check('stored ciphertext survives PostgreSQL serialization and exact operation retries create one material generation and one succeeded event');

 await assert.rejects(()=>admin.query('UPDATE garden_private.encrypted_content_heads SET envelope_digest=$3 WHERE workspace_id=$1 AND content_version_id=$2',[W,base.contentVersionId,'0'.repeat(64)]),error=>error.code==='23503');
 assert.equal((await repo.load(H('alice'),base)).head.digest,first.envelopeDigest);
 check('a head digest cannot diverge from its immutable generation receipt, including an attempted direct synthetic restore');

 const scope={workspaceId:W,recordId:base.recordId,operationId:request.operationId,requestDigest:digest};
 assert.deepEqual(await repo.receipt(H('alice'),scope),first);
 await reject(()=>repo.receipt(H('alice'),{...scope,requestDigest:'0'.repeat(64)}));
 await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'bob',true,true,'research',clock_timestamp()+interval '1 hour')",[W,base.recordId]);
 await reject(()=>repo.receipt(H('bob'),scope));await reject(()=>repo.commit(H('bob'),request));
 await reject(()=>repo.commit(H('alice'),{...request,envelope:{...request.envelope,wrappedKey:Buffer.alloc(60,7).toString('base64url')}}));
 assert.deepEqual(await committedState(base,request.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 check('receipt readback requires the original authenticated actor and exact request digest; changed input cannot reuse an operation ID');

 for(const changed of [{workspaceId:OTHER},{recordId:randomUUID()},{recordRevision:'2'},{contentVersionId:randomUUID()}])await reject(()=>repo.load(H('alice'),{...base,...changed}));
 const otherRecord=await record(W);await reject(()=>repo.prepare(H('alice'),{...otherRecord,contentVersionId:base.contentVersionId}));
 const {contentVersionId,...withoutContent}=otherRecord,generated=await repo.prepare(H('alice'),withoutContent);assert.match(generated.contentVersionId,/^[a-f0-9-]{36}$/);assert.equal(generated.head,null);
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
  for(const table of PRIVATE)await assert.rejects(()=>transaction(pools[alias],capability,client=>client.query('SELECT * FROM garden_private.'+table)),error=>error.code==='42501');
  for(const table of CONTROL)await assert.rejects(()=>transaction(pools[alias],capability,client=>client.query('SELECT * FROM garden_control.'+table)),error=>error.code==='42501');
 }
 await assert.rejects(()=>transaction(pools.encryption,'garden_encryption',client=>client.query('SELECT garden_control.prepare_encrypted_content($1,$2,$3,$4,$5)',[W,base.recordId,'1',base.contentVersionId,'ci'])));
 await assert.rejects(()=>transaction(pools.encryption,'garden_encryption',client=>client.query('SELECT garden_control.encrypted_envelope($1,$2,1)',[W,base.contentVersionId])),error=>error.code==='42501');
 await admin.query('GRANT garden_encryption TO garden_persist_issuer_ci WITH INHERIT FALSE, SET TRUE');await reject(()=>repo.prepare(H('alice'),base));await admin.query('REVOKE garden_encryption FROM garden_persist_issuer_ci');
 const force=(await admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1::text[])",[[...PRIVATE,...CONTROL]])).rows;
 assert.equal(force.length,6);assert.ok(force.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
 check('all six tables force RLS, every ordinary capability lacks raw access, and mixed issuer/content capabilities are rejected');

 const schema=(await admin.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='garden_private' AND table_name IN ('encrypted_content_versions','encrypted_envelope_revisions')")).rows;
 assert.equal(schema.some(row=>['wrapped_key','ciphertext','nonce','tag'].includes(row.column_name)),false);
 for(const table of ['encrypted_content_versions','encrypted_envelope_revisions'])for(const command of ['UPDATE garden_private.'+table+' SET workspace_id=workspace_id WHERE workspace_id=$1','DELETE FROM garden_private.'+table+' WHERE workspace_id=$1'])await assert.rejects(()=>admin.query(command,[W]));
 for(const table of ['encrypted_content_versions','encrypted_envelope_revisions'])await assert.rejects(()=>admin.query('TRUNCATE garden_private.'+table));
 check('immutable version and rotation metadata contain no wrapped DEK or ciphertext and reject ordinary rewrite/delete/truncate');

 const same=await record(W),sameRequest=await prepared(same),sameResults=await Promise.all([repo.commit(H('alice'),sameRequest),repo.commit(H('alice'),sameRequest)]);
 assert.deepEqual(sameResults[0],sameResults[1]);assert.deepEqual(await committedState(same,sameRequest.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 await admin.query("UPDATE garden_control.encryption_key_bindings SET write_version='v2' WHERE workspace_id=$1",[W]);
 const rotationA=await rotation(base),rotationB=await rotation(base),races=await Promise.allSettled([repo.commit(H('alice'),rotationA),repo.commit(H('alice'),rotationB)]);
 assert.equal(races.filter(result=>result.status==='fulfilled').length,1);
 const winner=races[0].status==='fulfilled'?rotationA:rotationB,receipt=races.find(result=>result.status==='fulfilled').value;
 assert.equal(receipt.generation,'2');assert.equal(receipt.previousDigest,first.envelopeDigest);assert.equal(receipt.keyVersion,'v2');
 assert.deepEqual(await repo.commit(H('alice'),winner),receipt);
 const afterRotation=await repo.load(H('alice'),base);assert.equal(afterRotation.envelope.ciphertext,loaded.envelope.ciphertext);assert.equal(afterRotation.envelope.tag,loaded.envelope.tag);assert.equal(afterRotation.envelope.nonce,loaded.envelope.nonce);
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
   await waitForBlocked('commit_encrypted_content');
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
 try{await waitForBlocked('commit_encrypted_content');await withdrawBlocker.query('SELECT garden_control.withdraw_consent_grant($1,$2,$3,$4)',[consentWorkspace,consentState.grantId,'c'.repeat(64),'synthetic-consent-reviewer']);}finally{await release(withdrawBlocker);}
 await reject(()=>waitingWithdrawal);await noCommit(withdrawn,withdrawRequest.operationId);
 check('a consent withdrawal that wins the shared workspace lock prevents a previously prepared encrypted commit');

 for(const [phase,expires] of [['authority-lock','grant'],['audit-head','grant'],['authority-lock','role'],['key-row','key-version']]){
  const ws=await workspace(),spec=await record(ws),pending=await prepared(spec);
  const expirySql=expires==='grant'?"UPDATE garden_control.record_grants SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND record_id=$2 RETURNING expires_at":
   expires==='role'?"UPDATE garden_control.access_roles SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND subject_id='alice' RETURNING expires_at":
   "UPDATE garden_control.encryption_key_versions SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND key_version='v1' RETURNING expires_at";
  const deadline=(await admin.query(expirySql,expires==='grant'?[ws,spec.recordId]:[ws])).rows[0].expires_at;
  const blocker=await admin.connect();await blocker.query('BEGIN');
  if(phase==='authority-lock')await blocker.query('SELECT pg_advisory_xact_lock(144729,hashtext($1))',[ws]);
  else if(phase==='audit-head')await blocker.query('SELECT sequence FROM garden_control.audit_heads WHERE workspace_id=$1 FOR UPDATE',[ws]);
  else await blocker.query("SELECT key_version FROM garden_control.encryption_key_versions WHERE workspace_id=$1 AND key_version='v1' FOR UPDATE",[ws]);
  const operation=repo.commit(H('alice'),pending);operation.catch(()=>{});
  try{const wait=await waitForBlocked('commit_encrypted_content');assert.ok(wait.query_start<deadline,'the blocked statement must start while authority is still valid');await admin.query('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp())))+0.05)',[deadline]);}
  finally{await release(blocker);}
  await reject(()=>operation);await noCommit(spec,pending.operationId);
 }
 check('grant, role and key expiry after already-dispatched authority, key-row or audit-head waits rolls back material, head, receipt and commit audit');

 const tailWorkspace=await workspace(),tail=await record(tailWorkspace),tailRequest=await prepared(tail);
 const tailDeadline=(await admin.query("UPDATE garden_control.record_grants SET expires_at=clock_timestamp()+interval '2 seconds' WHERE workspace_id=$1 AND record_id=$2 RETURNING expires_at",[tailWorkspace,tail.recordId])).rows[0].expires_at;
 let waited=false;
 const tailPool=interceptedPool(pools.encryption,async(client,sql,args)=>{
  if(sql==='COMMIT'&&!waited){waited=true;await admin.query('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp())))+0.05)',[tailDeadline]);}
  return client.query(sql,args);
 });
 await reject(()=>repository(tailPool).commit(H('alice'),tailRequest));assert.equal(waited,true);await noCommit(tail,tailRequest.operationId);
 check('the repository-owned transaction rechecks the captured authority deadline at actual COMMIT after its SQL function has returned');

 const rollbackWorkspace=await workspace(),rollbackSpec=await record(rollbackWorkspace),rollbackRequest=await prepared(rollbackSpec);
 const rollbackPool=interceptedPool(pools.encryption,async(client,sql,args)=>{const result=await client.query(sql,args);if(sql.includes('commit_encrypted_content'))throw Error('SYNTHETIC-ROLLBACK-SECRET-CANARY');return result;});
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
 const recovered=await repo.receipt(H('alice'),uncertain.recovery);assert.equal(recovered.committed,true);assert.deepEqual(await repo.commit(H('alice'),lostRequest),recovered);
 assert.deepEqual(await committedState(lostSpec,lostRequest.operationId),{versions:1,revisions:1,material:1,heads:1,commit_events:1});
 check('lost COMMIT acknowledgment exposes only a safe unconfirmed recovery binding; fresh readback proves the one committed operation without re-encryption');

 const stored=await repo.load(H('alice'),lostSpec),rootRef='garden/ci/restricted_research/v1',originalRoot=keys.roots.get(rootRef),root=Buffer.from(originalRoot);originalRoot.fill(0);
 keys.roots.delete(rootRef);await assert.rejects(()=>cryptoFor(lostSpec).decrypt(H('alice'),lostWorkspace,{objectId:lostSpec.recordId,versionId:lostSpec.contentVersionId,envelope:stored.envelope}));
 const wrongRoot=randomBytes(32);keys.roots.set(rootRef,wrongRoot);await reject(()=>serviceFor(lostSpec).decrypt(H('alice'),lostSpec));wrongRoot.fill(0);
 keys.roots.set(rootRef,root);assert.deepEqual(await serviceFor(lostSpec).decrypt(H('alice'),lostSpec),PERSISTENCE_CANARY);
 check('real stored ciphertext rejects a missing or wrong recovered wrapping key and becomes readable only after the exact synthetic key is recovered');

 const material=(await admin.query('SELECT * FROM garden_private.encrypted_material WHERE workspace_id=$1 AND content_version_id=$2 AND generation=1',[lostWorkspace,lostSpec.contentVersionId])).rows[0];
 await admin.query('DELETE FROM garden_private.encrypted_material WHERE workspace_id=$1 AND content_version_id=$2',[lostWorkspace,lostSpec.contentVersionId]);await reject(()=>repo.load(H('alice'),lostSpec));
 assert.deepEqual(await repo.receipt(H('alice'),uncertain.recovery),recovered);
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

 for(const ws of workspaces){
  const audit=(await admin.query('SELECT workspace_id::text AS "workspaceId",sequence::text AS sequence,previous_hash AS "previousHash",hash,event_text AS "eventText" FROM garden_control.audit_events AS ae WHERE workspace_id=$1 ORDER BY ae.sequence',[ws])).rows;
  verifyAuditPage(audit,{workspaceId:ws,sequence:'0',hash:GENESIS});assert.equal(JSON.stringify(audit).includes(PERSISTENCE_CANARY.toString()),false);
  for(const event of audit.map(row=>JSON.parse(row.eventText)))assert.equal(Object.hasOwn(event,'wrappedKey')||Object.hasOwn(event,'ciphertext'),false);
 }
 await assert.rejects(()=>admin.query("SELECT garden_control.append_audit_event($1,'subject','alice','record',$2,1,'encryption.arbitrary',gen_random_uuid())",[W,base.recordId]));
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.policy_tickets')).rows[0].n,0);
 check('all new mutation/key-policy events verify in the closed tamper-evident audit catalog without plaintext or pooled ticket residue');

 await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/encryption-persistence-results.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,checks,real_postgresql:true,synthetic_identity:true,synthetic_key_provider:true,
  live_provider_verified:false,hosted_deployment_verified:false,physical_erasure_verified:false,independent_restore_anchor:false,full_backup_restore_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' real PostgreSQL encrypted-content persistence and authority checks');
}finally{keys.close();for(const pool of Object.values(pools))await pool.end();await admin.end();}
