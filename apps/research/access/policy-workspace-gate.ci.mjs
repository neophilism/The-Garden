/** Actual PostgreSQL lock ordering; disposable loopback CI and synthetic data only. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor,PolicyError} from './policy-context.mjs';
import {createRecordRepository} from './record-delivery.mjs';
import {allowSyntheticResearchUse} from './consent-test-fixture.mjs';
import {createSourceRepository} from '../data/source-repository.mjs';
import {createReviewRepository} from '../review/repository.mjs';

if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||
 process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='5432'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='neondb')throw Error('Workspace gate fixtures require disposable loopback CI');
const config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:6,connectionTimeoutMillis:5000};
const admin=new pg.Pool(config),pools={},checks=[],workspaces=[];
const GATE='SELECT pg_advisory_xact_lock(144729,hashtext($1::text))';
const GRAPH="SELECT pg_advisory_xact_lock(hashtextextended('garden/source-graph/'||$1::text,0))";
const H='6'.repeat(64),headers=new Headers({'synthetic-subject':'alice'});
const identity={viewer:async()=>({id:'alice',verified:true})};
const source=id=>({recordType:'source',schemaVersion:1,id,title:null,form:'witness',archivalItemId:null,derivedFrom:[],assertions:[],representation:null});
const noConsent=recordId=>({schemaVersion:1,recordId,basis:'no-consent-required',inputs:[],terms:null,subjects:[],purposes:['research'],reasonDigest:'1'.repeat(64)});
const check=name=>{checks.push({name,result:'pass'});console.log('WORKSPACE GATE '+checks.length+': '+name);};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function settled(promise){const state={done:false};state.promise=promise.then(value=>{state.done=true;return {value};},error=>{state.done=true;return {error};});return state;}
async function success(state){const result=await state.promise;if(result.error)throw result.error;return result.value;}
async function denied(state){const result=await state.promise;assert.ok(result.error instanceof PolicyError);assert.equal(result.error.message,'Research access denied');assert.equal(result.error.code,'access_denied');assert.ok(!('cause' in result.error));}
async function until(predicate,label,limit=3000){const end=Date.now()+limit;do{if(await predicate())return;await new Promise(r=>setTimeout(r,10));}while(Date.now()<end);throw Error('Timed out observing synthetic '+label);}
async function expired(at){await until(async()=>(await admin.query('SELECT clock_timestamp()>$1::timestamptz AS expired',[at])).rows[0].expired,'database deadline');}

async function begin(pool,role=null){
 const client=await pool.connect();let closed=false,pid;
 try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='4s'");if(role)await client.query('SET LOCAL ROLE '+role);pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;}
 catch(error){try{await client.query('ROLLBACK');}finally{client.release(true);}throw error;}
 return {client,pid,async finish(commit=false){
  if(closed)return;closed=true;let bad=false;
  try{await client.query(commit?'COMMIT':'ROLLBACK');}
  catch(error){
   if(commit){try{await client.query('ROLLBACK');}catch{bad=true;}}
   else bad=true;
   throw error;
  }finally{client.release(bad);}
 }};
}
async function transaction(pool,role,work){const tx=await begin(pool,role);try{const value=await work(tx.client);await tx.finish(true);return value;}finally{await tx.finish();}}
const issue=(w,id,action='read')=>transaction(pools.issuer,'garden_context_issuer',async c=>(await c.query('SELECT garden_control.issue_policy_ticket($1,$2,$3,$4) AS ticket',[w,'alice',action,id])).rows[0].ticket);
const retire=token=>transaction(pools.issuer,'garden_context_issuer',c=>c.query('SELECT garden_control.invalidate_policy_ticket($1)',[token]));
function traced(pool,{before=async()=>{},after=async()=>{}}={}){
 const state={pid:null,calls:[]};
 state.pool={async connect(){const client=await pool.connect();
  try{state.pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;}catch(error){client.release(true);throw error;}
  return {async query(sql,args){state.calls.push(sql);await before({client,sql,args});const result=await client.query(sql,args);await after({client,sql,args,result});return result;},release:bad=>client.release(bad)};
 }};return state;
}
const executor=(query=pools.query,issuer=pools.issuer,viewer=identity)=>createPolicyExecutor({identity:viewer,issuerPool:issuer,researchPool:query});
async function blocked(state,blocker,statement,outcome){
 await until(async()=>{
  if(outcome.done)throw Error('Synthetic operation completed before the required lock wait');
  if(state.pid===null)return false;
  const row=(await admin.query('SELECT wait_event_type,wait_event,query,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[state.pid])).rows[0];
  return row?.wait_event_type==='Lock'&&row.wait_event==='advisory'&&row.query.startsWith(statement)&&row.blockers.includes(blocker);
 },'exact backend advisory wait');
}
async function clean(w){
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets WHERE workspace_id=$1',[w])).rows[0].n,0);
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_contexts c JOIN garden_control.policy_tickets t USING(token_hash) WHERE t.workspace_id=$1',[w])).rows[0].n,0);
}
async function workspace(){
 const w=randomUUID();workspaces.push(w);
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[w,'Synthetic workspace gate fixture',H]);
 await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,'alice','active',$2)",[w,H]);
 await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,'alice','editor','alice',clock_timestamp()+interval '1 hour')",[w]);
 return w;
}
async function record(w,{consent=true}={}){
 const id=randomUUID();await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'alice','research','active')",[id,w]);
 await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'alice',true,true,'research',clock_timestamp()+interval '1 hour')",[w,id]);
 if(consent)await allowSyntheticResearchUse(admin,w,id);return id;
}
async function consentRecord(w,{expiresIn=3600000}={}){
 const id=await record(w,{consent:false}),terms={id:randomUUID(),version:'1',digest:H};
 await admin.query("SELECT garden_control.register_consent_terms($1,1,$2,'synthetic-workspace-gate')",[terms.id,H]);
 const policy={schemaVersion:1,recordId:id,basis:'consent-required',inputs:[],terms,subjects:[{subjectId:'synthetic-narrator',authority:'self'}],purposes:[],reasonDigest:H};
 await admin.query("SELECT garden_control.set_use_policy($1,$2::jsonb,0,'synthetic-workspace-gate')",[w,JSON.stringify(policy)]);
 const point=new Date((await admin.query('SELECT clock_timestamp() AS point')).rows[0].point).getTime();
 const grant={schemaVersion:1,id:randomUUID(),recordId:id,subjectId:'synthetic-narrator',grantorId:'synthetic-narrator',authority:'self',authorityDigest:null,authorityExpiresAt:null,terms,purpose:'research',derivativesAllowed:false,validFrom:new Date(point-60000).toISOString(),expiresAt:new Date(point+expiresIn).toISOString(),evidenceDigest:H};
 await admin.query("SELECT garden_control.record_consent_grant($1,$2::jsonb,'synthetic-workspace-gate')",[w,JSON.stringify(grant)]);return {id,grant};
}
async function workspaceBlock(w){const tx=await begin(admin);try{await tx.client.query(GATE,[w]);return tx;}catch(error){await tx.finish();throw error;}}

try{
 for(const [alias,capability] of Object.entries({issuer:'garden_context_issuer',query:'garden_research',consent:'garden_consent_admin',encryption:'garden_encryption'})){
  const name='garden_workspace_gate_'+alias+'_ci',password=randomBytes(32).toString('hex');
  await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  await admin.query(`GRANT ${capability} TO ${name} WITH INHERIT FALSE, SET TRUE`);
  pools[alias]=new pg.Pool({...config,user:name,password,application_name:name});
 }
 const W=await workspace(),OTHER=await workspace(),id=await record(W),otherId=await record(OTHER);
 const records=createRecordRepository(executor()),sources=createSourceRepository(executor());

 // A competing consent function really holds the same transaction lock. While
 // waiting, the source writer has neither bound its ticket nor acquired a graph
 // or record lock. The probe transaction always rolls back, even on failure.
 const consentTx=await begin(pools.consent,'garden_consent_admin');
 let initialize;
 try{
  await consentTx.client.query("SELECT garden_control.set_use_policy($1,$2::jsonb,1,'synthetic-workspace-gate')",[W,JSON.stringify({...noConsent(id),reasonDigest:H})]);
  const query=traced(pools.query);initialize=settled(createSourceRepository(executor(query.pool)).initialize(headers,W,id,'1',source(id)));
  await blocked(query,consentTx.pid,GATE,initialize);
  assert.ok(!query.calls.some(sql=>sql.includes('bind_policy_context')||sql===GRAPH||sql.includes('record_envelopes')));
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_contexts WHERE backend_pid=$1',[query.pid])).rows[0].n,0);
  const probe=await begin(admin);
  try{
   assert.equal((await probe.client.query("SELECT pg_try_advisory_xact_lock(hashtextextended('garden/source-graph/'||$1::text,0)) AS acquired",[W])).rows[0].acquired,true);
   // The consent policy FK may hold KEY SHARE; that is compatible with this
   // probe, while a conflicting source-writer row lock must still prevent it.
   assert.equal((await probe.client.query('SELECT id FROM garden_private.record_envelopes WHERE id=$1 FOR NO KEY UPDATE NOWAIT',[id])).rows.length,1);
  }finally{await probe.finish();}
  assert.equal((await records.find(headers,OTHER,otherId)).id,otherId);
  await consentTx.finish(true);assert.equal((await success(initialize)).revision,'2');
 }finally{await consentTx.finish();if(initialize)await initialize.promise;}
 await clean(W);check('consent lock precedes source context, graph and row locks while a different workspace proceeds');

 // A held source mutation serializes a separate withdrawal. Never await that
 // withdrawal from inside the same transaction that it is waiting to acquire.
 const consenting=await consentRecord(W),entered=deferred(),resume=deferred();
 const writer=traced(pools.query,{after:async({sql})=>{if(sql.startsWith('UPDATE garden_private.record_envelopes')){entered.resolve();await resume.promise;}}});
 const writing=settled(createSourceRepository(executor(writer.pool)).revise(headers,W,id,'2',{...source(id),title:'Synthetic gated source'}));
 let withdrawing;
 try{
  await Promise.race([entered.promise,writing.promise.then(result=>{throw result.error??Error('Source mutation never reached the pause');})]);
  const withdrawal=traced(pools.consent);withdrawing=settled(transaction(withdrawal.pool,'garden_consent_admin',c=>c.query("SELECT garden_control.withdraw_consent_grant($1,$2,$3,'synthetic-workspace-gate')",[W,consenting.grant.id,H])));
  await blocked(withdrawal,writer.pid,'SELECT garden_control.withdraw_consent_grant',withdrawing);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.consent_withdrawals WHERE grant_id=$1',[consenting.grant.id])).rows[0].n,0);
  resume.resolve();assert.equal((await success(writing)).revision,'3');await success(withdrawing);
  await assert.rejects(()=>records.find(headers,W,consenting.id),PolicyError);
 }finally{resume.resolve();await writing.promise;if(withdrawing)await withdrawing.promise;}
 await clean(W);check('source mutation commits before its waiting consent withdrawal; later research access denies');

 // The existing SQL review gate and encrypted preparation gate are exercised on
 // separate non-owner sessions. They use raw fixed SQL here to isolate their own
 // established gate from the newly added host gate; no arbitrary endpoint exists.
 await admin.query("INSERT INTO garden_control.encryption_key_versions(workspace_id,environment,data_class,provider_id,key_ref,key_version,can_read,can_write,not_before,expires_at) VALUES($1,'ci','restricted_research','synthetic-workspace-gate','garden/ci/workspace-gate','v1',true,true,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour')",[W]);
 await admin.query("INSERT INTO garden_control.encryption_key_bindings(workspace_id,repository,environment,data_class,provider_id,key_ref,write_version,enabled,expires_at) VALUES($1,'neophilism/The-Garden','ci','restricted_research','synthetic-workspace-gate','garden/ci/workspace-gate','v1',true,clock_timestamp()+interval '1 hour')",[W]);
 let version='3';
 for(const kind of ['review','encryption']){
  const token=await issue(W,id,kind==='review'?'read':'write');
  const tx=await begin(kind==='review'?pools.query:pools.encryption,kind==='review'?'garden_research':'garden_encryption');let pending;
  try{
   await tx.client.query('SELECT garden_control.bind_policy_context($1)',[token]);
   if(kind==='review')await tx.client.query('SELECT garden_control.register_review_scope($1,$2,$3,$4)',[W,randomUUID(),id,version]);
   else{
    const prepared=(await tx.client.query("SELECT garden_control.prepare_encrypted_content($1,$2,$3,$4,'ci') AS result",[W,id,version,randomUUID()])).rows[0].result;
    assert.equal(prepared.recordRevision,version);assert.equal(prepared.head,null);assert.equal(prepared.envelope,null);
   }
   const query=traced(pools.query);pending=settled(createSourceRepository(executor(query.pool)).revise(headers,W,id,version,{...source(id),title:'Synthetic '+kind+' ordering'}));
   await blocked(query,tx.pid,GATE,pending);assert.ok(!query.calls.some(sql=>sql.includes('bind_policy_context')||sql===GRAPH));
   await tx.client.query('SELECT garden_control.clear_policy_context()');await tx.finish(true);
   version=(BigInt(version)+1n).toString();assert.equal((await success(pending)).revision,version);
  }finally{await tx.finish();await retire(token);if(pending)await pending.promise;}
  await clean(W);check(kind+' SQL admission holds the same workspace gate before a competing source writer');
 }
 const reviewId=await createReviewRepository(executor()).register(headers,W,id,version);
 assert.equal((await admin.query('SELECT id FROM garden_control.review_scopes WHERE workspace_id=$1 AND id=$2',[W,reviewId])).rows.length,1);
 check('review admission reacquires the exclusive workspace gate on the same research transaction without an upgrade');

 // A workspace waiter must hold no policy-ticket row lock. The owner can shorten
 // this issued synthetic ticket while the main backend is visibly waiting.
 const blockedTx=await workspaceBlock(W),query=traced(pools.query);let workEntered=false;
 const waiting=settled(executor(query.pool).run(headers,{workspaceId:W,recordId:id},async()=>{workEntered=true;return 'private';}));
 try{
  await blocked(query,blockedTx.pid,GATE,waiting);
  const at=await transaction(admin,null,async c=>{
   await c.query("SET LOCAL statement_timeout='1s'");
   const changed=await c.query("UPDATE garden_control.policy_tickets SET issued_at=clock_timestamp()-interval '1 second',expires_at=clock_timestamp()+interval '250 milliseconds' WHERE workspace_id=$1 RETURNING expires_at",[W]);
   assert.equal(changed.rows.length,1);return changed.rows[0].expires_at;
  });
  await expired(at);await blockedTx.finish(true);await denied(waiting);assert.equal(workEntered,false);
 }finally{await blockedTx.finish();await waiting.promise;}
 await clean(W);check('ticket expiry after a real gate wait denies binding and repository work, then retires all context');

 // Record and consent expiry remain RLS decisions after gate acquisition. These
 // cases intentionally leave the identity, membership and policy ticket valid.
 const grantId=await record(W),grantBlock=await workspaceBlock(W),grantQuery=traced(pools.query);
 const grantRead=settled(createRecordRepository(executor(grantQuery.pool)).find(headers,W,grantId));
 try{
  await blocked(grantQuery,grantBlock.pid,GATE,grantRead);
  const at=(await admin.query("UPDATE garden_control.record_grants SET expires_at=clock_timestamp()+interval '250 milliseconds' WHERE workspace_id=$1 AND record_id=$2 RETURNING expires_at",[W,grantId])).rows[0].expires_at;
  await expired(at);await grantBlock.finish(true);await denied(grantRead);
 }finally{await grantBlock.finish();await grantRead.promise;}
 await clean(W);check('current record-grant expiry during workspace wait hides the record after binding');

 const short=await consentRecord(W,{expiresIn:2000}),consentBlock=await workspaceBlock(W),consentQuery=traced(pools.query);
 const consentRead=settled(createRecordRepository(executor(consentQuery.pool)).find(headers,W,short.id));
 try{
  await blocked(consentQuery,consentBlock.pid,GATE,consentRead);
  assert.equal((await admin.query('SELECT clock_timestamp()<$1::timestamptz AS current',[short.grant.expiresAt])).rows[0].current,true);
  await expired(short.grant.expiresAt);await consentBlock.finish(true);await denied(consentRead);
 }finally{await consentBlock.finish();await consentRead.promise;}
 await clean(W);check('natural research-consent expiry during workspace wait is checked on the later RLS statement');

 const memberBlock=await workspaceBlock(W),memberQuery=traced(pools.query);let memberWork=false;
 const memberRead=settled(executor(memberQuery.pool).run(headers,{workspaceId:W,recordId:id},async()=>{memberWork=true;}));
 try{
  await blocked(memberQuery,memberBlock.pid,GATE,memberRead);
  await admin.query("UPDATE garden_control.access_members SET version=version+1 WHERE workspace_id=$1 AND subject_id='alice'",[W]);
  await memberBlock.finish(true);await denied(memberRead);assert.equal(memberWork,false);
 }finally{await memberBlock.finish();await memberRead.promise;}
 await clean(W);check('membership version changed while waiting rejects the original ticket before work');

 const cancelBlock=await workspaceBlock(W),cancelQuery=traced(pools.query);let cancelledWork=false;
 const cancelled=settled(executor(cancelQuery.pool).run(headers,{workspaceId:W},async()=>{cancelledWork=true;}));
 try{
  await blocked(cancelQuery,cancelBlock.pid,GATE,cancelled);
  assert.equal((await admin.query('SELECT pg_cancel_backend($1) AS cancelled',[cancelQuery.pid])).rows[0].cancelled,true);
  await denied(cancelled);assert.equal(cancelledWork,false);await clean(W);
 }finally{await cancelBlock.finish();await cancelled.promise;}
 assert.equal((await records.find(headers,W,id)).id,id);check('cancelling an actual waiting gate rolls back, retires its ticket and leaves the pool reusable');

 const order=[];let returned=false;
 const observedQuery=traced(pools.query,{after:async({sql})=>{if(sql==='COMMIT')order.push('main-commit');}});
 const observedIssuer=traced(pools.issuer,{before:async({sql})=>{if(sql.includes('invalidate_policy_ticket')){
  order.push('retirement');const probe=await begin(admin);
  try{assert.equal((await probe.client.query('SELECT pg_try_advisory_xact_lock(144729,hashtext($1::text)) AS acquired',[W])).rows[0].acquired,true);}finally{await probe.finish();}
 }}});
 const lastIdentity={viewer:async()=>{if(order.includes('retirement')){order.push('final-identity');return null;}return {id:'alice',verified:true};}};
 const before=(await admin.query('SELECT version::text,payload FROM garden_private.record_envelopes WHERE id=$1',[id])).rows[0];
 await assert.rejects(async()=>{await executor(observedQuery.pool,observedIssuer.pool,lastIdentity).run(headers,{workspaceId:W,recordId:id,action:'write'},async c=>{
  const changed={...before.payload,title:'Synthetic committed delivery denial'};
  return(await c.query('UPDATE garden_private.record_envelopes SET payload=$1::jsonb WHERE id=$2 RETURNING version::text',[changed,id])).rows[0];
 });returned=true;},PolicyError);
 assert.equal(returned,false);assert.deepEqual(order,['main-commit','retirement','final-identity']);
 assert.equal((await admin.query('SELECT version::text FROM garden_private.record_envelopes WHERE id=$1',[id])).rows[0].version,(BigInt(before.version)+1n).toString());
 await clean(W);check('workspace lock is released before ticket retirement; late identity denial preserves the observed committed write');

 for(const w of workspaces)await clean(w);
 await mkdir('data-evidence',{recursive:true});
 await writeFile('data-evidence/policy-workspace-gate-results.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,checks,real_postgresql:true,synthetic_identity:true,synthetic_records:true,provider_calls:false,tombstone_enforcement:false,physical_erasure:false,production_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' actual PostgreSQL workspace ordering and expiry checks');
}finally{
 // The CI container owns all synthetic seed data. Do not delete retained rows,
 // disable immutability, or adapt this program for an existing cloud database.
 for(const pool of Object.values(pools))await pool.end();await admin.end();
}
