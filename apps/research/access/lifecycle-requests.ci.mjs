/** Actual PostgreSQL requester transactions. All identities and claims below
 * are disposable CI fixtures, never retained corpus or provider operations.
 */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createLifecycleRequestRepository} from './lifecycle-request-repository.mjs';
import {
 createLifecycleRequestService,LifecycleRequestOutcomeUnknownError
} from './lifecycle-requests.mjs';
import {
 lifecycleRequestFingerprint,cancelLifecycleRequest,validateLifecycleRequest
} from '../../../packages/domain/src/lifecycle/requests.mjs';
import {GENESIS,verifyAuditPage} from '../../../packages/domain/src/audit/ledger.mjs';
import {RUNTIME_DATABASE_CAPABILITIES,assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';

if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||
 process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='5432'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='neondb'){
 throw Error('Lifecycle request fixtures require isolated loopback CI');
}
const config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:8,connectionTimeoutMillis:5000};
const admin=new pg.Pool(config),pools={},checks=[],workspaces=[];
const POLICY='c'.repeat(64),CANARY='LIFECYCLE-PRIVATE-CANARY';
const CAPABILITIES={
 public:'garden_public',research:'garden_research',issuer:'garden_context_issuer',membership:'garden_membership_admin',
 consent:'garden_consent_admin',publisher:'garden_publisher',worker:'garden_worker',reader:'garden_audit_reader',
 audit:'garden_audit_writer',encryption:'garden_encryption',requester:'garden_lifecycle_requester'
};
const PRIVATE=['lifecycle_request_cases','lifecycle_request_payloads','lifecycle_request_events','lifecycle_request_heads'];
const CONTROL=['lifecycle_request_tickets','lifecycle_request_contexts'];
const profiles=new Map([
 ['alice',{id:CANARY+'-alice',sessionId:'synthetic-lifecycle-session-alice',verified:true}],
 ['bob',{id:CANARY+'-bob',sessionId:'synthetic-lifecycle-session-bob',verified:true}],
 ['unicode',{id:CANARY+'-quote"-slash\\-é-東京-\u2028-\u2029-𐐷',sessionId:'synthetic-lifecycle-session-unicode',verified:true}]
]);
const H=alias=>new Headers({'synthetic-lifecycle-identity':alias});
const identity={viewer:async headers=>profiles.get(headers.get('synthetic-lifecycle-identity'))??null};
const principal=(workspaceId,alias='alice')=>Object.freeze({workspaceId,subjectId:profiles.get(alias).id});
const admit=Object.freeze(Object.defineProperty(async()=>true,'isAvailable',{value:()=>true}));
const input=(extra={})=>({operationId:randomUUID(),requestId:randomUUID(),kind:'delete',claimedRecordId:randomUUID(),...extra});
const submission=(p,command)=>({input:command,fingerprint:lifecycleRequestFingerprint(p,command)});
const cancellation=(p,current,command)=>({input:command,requestFingerprint:current.submission.fingerprint,
 fingerprint:cancelLifecycleRequest(p,current,command,Date.now()).operation.fingerprint});
const check=name=>{checks.push({name,result:'pass'});console.log('LIFECYCLE '+checks.length+': '+name);};
const unavailable=error=>error?.code==='lifecycle_request_unavailable'&&error.message==='Lifecycle request unavailable';
const denied=work=>assert.rejects(work,unavailable);
const unknown=work=>assert.rejects(work,error=>error instanceof LifecycleRequestOutcomeUnknownError&&
 error.message==='Lifecycle request unavailable'&&Object.isFrozen(error.recovery));
const immutableError=error=>error.code==='P0001'&&error.message==='Audit history is append-only';
const sqlUnavailable=error=>error.code==='P0001'&&error.message==='Lifecycle request unavailable';

async function login(alias,capability){
 const name='garden_lifecycle_'+alias+'_ci',password=randomBytes(32).toString('hex');
 await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
 await admin.query(`GRANT ${capability} TO ${name} WITH INHERIT FALSE, SET TRUE`);
 const pool=new pg.Pool({...config,user:name,password,application_name:name});pools[alias]=pool;return pool;
}
async function transaction(pool,role,work){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');if(role)await client.query('SET LOCAL ROLE '+role);
  const result=await work(client);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
function interceptedPool(pool,intercept){
 return {async connect(){const client=await pool.connect();return {
  query:async(sql,args)=>intercept(client,sql,args),release:bad=>client.release(bad)
 };}};
}
function repository(workspaceId,{requesterPool=pools.requester,issuerPool=pools.issuer,...extra}={}){
 return createLifecycleRequestRepository({issuerPool,requesterPool,workspaceId,environment:'ci',isEnabled:()=>true,...extra});
}
function service(workspaceId,{repository:repo=repository(workspaceId),...extra}={}){
 return createLifecycleRequestService({identity,repository:repo,workspaceId,isEnabled:()=>true,isIntakeEnabled:()=>true,...extra});
}
async function workspace(){
 const id=randomUUID();workspaces.push(id);
 // Requester receipts must not require research activation or membership.
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,false)',[id,'Synthetic lifecycle receiving workspace',POLICY]);
 return id;
}
function assertReceipt(value,{requestId,kind,claimedRecordId,state,revision}){
 assert.deepEqual(Object.keys(value.receipt).sort(),['schemaVersion','requestId','kind','claimedRecordId','targetKind','revision','state','submittedAt','updatedAt','effectsVerified'].sort());
 assert.deepEqual({...value.receipt,submittedAt:null,updatedAt:null},{schemaVersion:1,requestId,kind,claimedRecordId,
  targetKind:'claimed-record-reference',revision,state,submittedAt:null,updatedAt:null,effectsVerified:false});
 if(value.operation)assert.equal(value.operation.effectsVerified,false);
 assert.ok(Object.isFrozen(value)&&Object.isFrozen(value.receipt));
 for(const forbidden of ['ready','fulfilled','erased','exported','deliveryStopped','removalQueued','reviewEvidenceId','requesterId']){
  assert.equal(Object.hasOwn(value.receipt,forbidden),false);
 }
}
async function waitForBlocked(functionName,application='garden_lifecycle_requester_ci',minimum=1){
 const deadline=Date.now()+5000;
 do{
  const rows=(await admin.query(`SELECT pid,query_start,clock_timestamp() AS observed_at FROM pg_stat_activity
   WHERE application_name=$1 AND wait_event_type='Lock' AND position($2 in query)>0`,[application,functionName])).rows;
  if(rows.length>=minimum)return rows[0];
  await new Promise(resolve=>setTimeout(resolve,15));
 }while(Date.now()<deadline);
 throw Error('Expected lifecycle request database lock was not observed');
}
async function afterDeadline(deadline){
 const milliseconds=new Date(deadline).getTime()-Date.now();
 assert.ok(Number.isFinite(milliseconds)&&milliseconds<5000,'only short synthetic admission deadlines may be awaited');
 await admin.query('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp())))+0.05)',[deadline]);
}
async function release(client){try{await client.query('COMMIT');}finally{client.release();}}
// Every mutation guard probe uses one pinned transaction and ALWAYS rolls back,
// even if the guard unexpectedly allows the mutation or an assertion fails.
async function rejectedOwnerMutation(sql,args,expected){
 const client=await admin.connect();
 try{await client.query('BEGIN');await assert.rejects(()=>client.query(sql,args),expected);}
 finally{try{await client.query('ROLLBACK');}finally{client.release();}}
}
async function rejectedRuntimeStatement(pool,role,sql,args,expected){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SET LOCAL ROLE '+role);
  await assert.rejects(()=>client.query(sql,args),expected);
 }finally{try{await client.query('ROLLBACK');}finally{client.release();}}
}
async function retainedState(){
 const tables=['garden_control.audit_events','garden_control.audit_heads',...PRIVATE.map(table=>'garden_private.'+table)];
 return(await admin.query(tables.map(table=>`SELECT '${table}' AS table_name,count(*)::text AS count,
  encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text COLLATE "C"),''),'UTF8')),'hex') AS sha256
  FROM ${table} AS r`).join(' UNION ALL ')+' ORDER BY table_name')).rows;
}
async function requestState(workspaceId,requestId){
 return(await admin.query(`SELECT
  (SELECT count(*)::integer FROM garden_private.lifecycle_request_cases WHERE workspace_id=$1 AND request_id=$2) AS cases,
  (SELECT count(*)::integer FROM garden_private.lifecycle_request_payloads WHERE workspace_id=$1 AND request_id=$2) AS payloads,
  (SELECT count(*)::integer FROM garden_private.lifecycle_request_events WHERE workspace_id=$1 AND request_id=$2) AS events,
  (SELECT count(*)::integer FROM garden_private.lifecycle_request_heads WHERE workspace_id=$1 AND request_id=$2) AS heads`,[workspaceId,requestId])).rows[0];
}
async function noRequest(workspaceId,command){
 assert.deepEqual(await requestState(workspaceId,command.requestId),{cases:0,payloads:0,events:0,heads:0});
 assert.equal((await admin.query(`SELECT count(*)::integer AS n FROM garden_control.audit_events
  WHERE workspace_id=$1 AND event_text::jsonb->>'requestId'=$2`,[workspaceId,command.operationId])).rows[0].n,0);
}
async function holdCase(workspaceId,requestId){
 const client=await admin.connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(144741,hashtext($1))',[workspaceId+':'+requestId]);return client;}
 catch(error){try{await client.query('ROLLBACK');}finally{client.release();}throw error;}
}
async function mintTicket(client,p,{action,requestId,operationId,fingerprint},{backendPid,transactionId,issuerPool=pools.issuer}={}){
 const actual=(await client.query('SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')).rows[0];
 const token=await transaction(issuerPool,'garden_context_issuer',async issuer=>{
  const result=await issuer.query(`SELECT garden_control.issue_lifecycle_request_ticket($1,$2,$3,$4,$5,$6,$7,$8,$9::xid8) AS token`,
   [p.workspaceId,p.subjectId,'ci',action,requestId,operationId,fingerprint,backendPid??actual.backend_pid,transactionId??actual.transaction_id]);
  return result.rows[0].token;
 });
 assert.match(token,/^[0-9a-f]{64}$/);
 return {token,...actual};
}
async function retire(token,issuerPool=pools.issuer){
 return transaction(issuerPool,'garden_context_issuer',client=>client.query('SELECT garden_control.invalidate_lifecycle_request_ticket($1)',[token]));
}
async function bind(client,token){await client.query('SELECT garden_control.bind_lifecycle_request_context($1)',[token]);}
async function finishContext(client){
 assert.equal((await client.query('SELECT garden_control.check_lifecycle_request_context() AS allowed')).rows[0].allowed,true);
 await client.query('SELECT garden_control.clear_lifecycle_request_context()');
}
async function ticketRow(token){
 return(await admin.query(`SELECT backend_pid,transaction_id::text AS transaction_id,issued_at,expires_at,used_at
  FROM garden_control.lifecycle_request_tickets WHERE token_hash=sha256(convert_to($1,'UTF8'))`,[token])).rows[0];
}
function shortAdmissionPool({onMint=()=>{},retireFailure=false}={}){
 const pending=new WeakMap();
 return interceptedPool(pools.issuer,async(client,sql,args)=>{
  if(retireFailure&&sql.includes('invalidate_lifecycle_request_ticket'))throw Error(CANARY+'-retirement');
  const result=await client.query(sql,args);
  if(sql.includes('issue_lifecycle_request_ticket')){
   const tokens=Object.values(result.rows[0]);assert.equal(tokens.length,1);const token=tokens[0];
   pending.set(client,token);
  }
  if(sql==='COMMIT'&&pending.has(client)){
   const token=pending.get(client);pending.delete(client);
   // The issuer has no raw table rights. After its real COMMIT and before the
   // requester receives the token, shorten only this disposable fixture row.
   const row=(await admin.query(`UPDATE garden_control.lifecycle_request_tickets
    SET expires_at=clock_timestamp()+interval '2 seconds'
    WHERE token_hash=sha256(convert_to($1,'UTF8')) RETURNING expires_at`,[token])).rows[0];
   assert.ok(row);await onMint({token,deadline:row.expires_at});
  }
  if(sql==='ROLLBACK')pending.delete(client);
  return result;
 });
}

try{
 for(const [alias,capability] of Object.entries(CAPABILITIES))await login(alias,capability);
 assert.deepEqual([...RUNTIME_DATABASE_CAPABILITIES].sort(),Object.values(CAPABILITIES).sort());
 const W=await workspace(),OTHER=await workspace(),P=principal(W),repo=repository(W),app=service(W,{repository:repo});
 const initial=input(),first=await app.submit(H('alice'),initial);
 assertReceipt(first,{...initial,state:'pending',revision:'1'});
 assert.equal(first.operation.fingerprint,lifecycleRequestFingerprint(P,initial));
 assert.deepEqual(await app.submit(H('alice'),initial),first);
 assert.deepEqual(await app.status(H('alice'),{requestId:initial.requestId}),{receipt:first.receipt});
 assert.deepEqual(await app.recover(H('alice'),{operationId:initial.operationId,fingerprint:first.operation.fingerprint}),first);
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.access_members WHERE workspace_id=ANY($1::uuid[])',[workspaces])).rows[0].n,0);
 assert.deepEqual(await requestState(W,initial.requestId),{cases:1,payloads:1,events:1,heads:1});
 check('a verified nonmember can submit, read and recover an exact own pending request in an inactive research workspace');

 const unicode=input({kind:'export'}),unicodePrincipal=principal(W,'unicode');
 const reordered=Object.fromEntries(Object.entries(unicode).reverse());
 const expected=lifecycleRequestFingerprint(unicodePrincipal,unicode);
 assert.equal((await admin.query('SELECT garden_control.lifecycle_submission_fingerprint($1,$2,$3::jsonb) AS digest',
  [W,unicodePrincipal.subjectId,JSON.stringify(reordered)])).rows[0].digest,expected);
 const unicodeFirst=await app.submit(H('unicode'),reordered),unicodeCurrent=await repo.status(unicodePrincipal,{requestId:unicode.requestId},admit);
 assert.equal(unicodeFirst.operation.fingerprint,expected);validateLifecycleRequest(unicodeCurrent);
 const unicodeCancel={operationId:randomUUID(),requestId:unicode.requestId,expectedRevision:'1'};
 const unicodeCancellation=cancellation(unicodePrincipal,unicodeCurrent,unicodeCancel);
 assert.equal((await admin.query('SELECT garden_control.lifecycle_cancellation_fingerprint($1,$2,$3,$4,$5,$6::bigint) AS digest',
  [W,unicodePrincipal.subjectId,unicode.requestId,expected,unicodeCancel.operationId,'1'])).rows[0].digest,unicodeCancellation.fingerprint);
 const unicodeCancelled=await app.cancel(H('unicode'),unicodeCancel);
 assertReceipt(unicodeCancelled,{...unicode,state:'cancelled',revision:'2'});
 assert.equal(unicodeCancelled.operation.fingerprint,unicodeCancellation.fingerprint);
 assert.deepEqual(await app.cancel(H('unicode'),unicodeCancel),unicodeCancelled);
 const oldSubmitReplay=await app.submit(H('unicode'),unicode);
 assert.deepEqual(oldSubmitReplay.receipt,unicodeCancelled.receipt);assert.deepEqual(oldSubmitReplay.operation,unicodeFirst.operation);
 assert.deepEqual(await app.recover(H('unicode'),{operationId:unicode.operationId,fingerprint:expected}),oldSubmitReplay);
 assert.deepEqual(await requestState(W,unicode.requestId),{cases:1,payloads:1,events:2,heads:1});
 check('actual JSONB and JavaScript agree on quotes, backslashes, Unicode and object order; cancelled status is separate from stable original operation readback');

 for(const work of [
  ()=>app.status(H('bob'),{requestId:initial.requestId}),
  ()=>app.recover(H('bob'),{operationId:initial.operationId,fingerprint:first.operation.fingerprint}),
  ()=>app.cancel(H('bob'),{operationId:randomUUID(),requestId:initial.requestId,expectedRevision:'1'}),
  ()=>service(OTHER).status(H('alice'),{requestId:initial.requestId}),
  ()=>service(OTHER).recover(H('alice'),{operationId:initial.operationId,fingerprint:first.operation.fingerprint}),
  ()=>app.recover(H('alice'),{operationId:initial.operationId,fingerprint:'0'.repeat(64)}),
  ()=>app.status(H('alice'),{requestId:randomUUID()})
 ])await denied(work);
 for(const changed of [{kind:'export'},{claimedRecordId:randomUUID()},{requestId:randomUUID()},{operationId:randomUUID()}]){
  await unknown(()=>app.submit(H('alice'),{...initial,...changed}));
 }
 await unknown(()=>app.submit(H('bob'),initial));
 await unknown(()=>service(OTHER).submit(H('alice'),initial));
 assert.deepEqual(await requestState(W,initial.requestId),{cases:1,payloads:1,events:1,heads:1});
 assert.deepEqual(await requestState(OTHER,initial.requestId),{cases:0,payloads:0,events:0,heads:0});
 check('request IDs and recovery hashes never override current actor, workspace, immutable claim or global operation binding');

 // A real record requires its own provenance owner membership. Keep that
 // unrelated fixture outside every nonmember requester workspace.
 const inaccessible=randomUUID(),recordWorkspace=randomUUID();
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,false)',
  [recordWorkspace,'Synthetic inaccessible record fixture',POLICY]);
 await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",
  [recordWorkspace,profiles.get('bob').id,POLICY]);
 await admin.query(`INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state,payload)
  VALUES($1,$2,$3,'sealed','active','{}')`,[inaccessible,recordWorkspace,profiles.get('bob').id]);
 const knownClaim=input({claimedRecordId:inaccessible}),unknownClaim=input();
 const knownResponse=await app.submit(H('alice'),knownClaim),unknownResponse=await app.submit(H('alice'),unknownClaim);
 assertReceipt(knownResponse,{...knownClaim,state:'pending',revision:'1'});
 assertReceipt(unknownResponse,{...unknownClaim,state:'pending',revision:'1'});
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_private.record_envelopes WHERE id=$1',[unknownClaim.claimedRecordId])).rows[0].n,0);
 assert.deepEqual((await admin.query('SELECT workspace_id,owner_subject_id,classification,state,payload FROM garden_private.record_envelopes WHERE id=$1',[inaccessible])).rows[0],
  {workspace_id:recordWorkspace,owner_subject_id:profiles.get('bob').id,classification:'sealed',state:'active',payload:{}});
 assert.equal(workspaces.includes(recordWorkspace),false);
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.access_members WHERE workspace_id=ANY($1::uuid[])',[workspaces])).rows[0].n,0);
 check('known inaccessible and nonexistent record claims both create pending requester receipts without resolving, reading or changing the claimed record');

 let intake=false;
 const closedIntake=service(W,{isIntakeEnabled:()=>intake});
 const intakeInput=input();await denied(()=>closedIntake.submit(H('alice'),intakeInput));await noRequest(W,intakeInput);
 assert.deepEqual(await closedIntake.status(H('alice'),{requestId:initial.requestId}),{receipt:first.receipt});
 const initialCancel={operationId:randomUUID(),requestId:initial.requestId,expectedRevision:'1'};
 const cancelled=await closedIntake.cancel(H('alice'),initialCancel);
 assertReceipt(cancelled,{...initial,state:'cancelled',revision:'2'});
 assert.deepEqual(await closedIntake.recover(H('alice'),{operationId:initialCancel.operationId,fingerprint:cancelled.operation.fingerprint}),cancelled);
 await denied(()=>closedIntake.cancel(H('alice'),{...initialCancel,operationId:randomUUID()}));
 assert.deepEqual(await requestState(W,initial.requestId),{cases:1,payloads:1,events:2,heads:1});
 check('closing intake preserves authenticated own status, cancellation and exact recovery without reopening a terminal request');

 const identical=input();
 const identicalBlocker=await holdCase(W,identical.requestId);
 const identicalWork=[app.submit(H('alice'),identical),app.submit(H('alice'),identical)];identicalWork.forEach(work=>work.catch(()=>{}));
 try{await waitForBlocked('submit_lifecycle_request','garden_lifecycle_requester_ci',2);}finally{await release(identicalBlocker);}
 const identicalResults=await Promise.all(identicalWork);
 assert.deepEqual(identicalResults[0],identicalResults[1]);assert.deepEqual(await requestState(W,identical.requestId),{cases:1,payloads:1,events:1,heads:1});
 const racing=input(),otherRace={...input(),operationId:racing.operationId};
 const globalBlocker=await admin.connect();await globalBlocker.query('BEGIN');
 await globalBlocker.query('SELECT pg_advisory_xact_lock(144740,hashtext($1))',[racing.operationId]);
 const globalWork=[app.submit(H('alice'),racing),service(OTHER).submit(H('alice'),otherRace)];globalWork.forEach(work=>work.catch(()=>{}));
 try{await waitForBlocked('submit_lifecycle_request','garden_lifecycle_requester_ci',2);}finally{await release(globalBlocker);}
 const globalRace=await Promise.allSettled(globalWork);
 assert.equal(globalRace.filter(row=>row.status==='fulfilled').length,1);
 assert.ok(globalRace.find(row=>row.status==='rejected').reason instanceof LifecycleRequestOutcomeUnknownError);
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_private.lifecycle_request_events WHERE operation_id=$1',[racing.operationId])).rows[0].n,1);
 const raceRequest=input(),raceFirst=await app.submit(H('alice'),raceRequest);
 const a={operationId:randomUUID(),requestId:raceRequest.requestId,expectedRevision:'1'},b={...a,operationId:randomUUID()};
 const pending=await repo.status(P,{requestId:raceRequest.requestId},admit);
 const cancelBlocker=await holdCase(W,raceRequest.requestId);
 const cancelWork=[repo.cancel(P,cancellation(P,pending,a),admit),repo.cancel(P,cancellation(P,pending,b),admit)];cancelWork.forEach(work=>work.catch(()=>{}));
 try{await waitForBlocked('cancel_lifecycle_request','garden_lifecycle_requester_ci',2);}finally{await release(cancelBlocker);}
 const cancels=await Promise.allSettled(cancelWork);
 assert.equal(cancels.filter(row=>row.status==='fulfilled').length,1);assert.ok(unavailable(cancels.find(row=>row.status==='rejected').reason));
 const winner=cancels[0].status==='fulfilled'?a:b,winnerRaw=cancels.find(row=>row.status==='fulfilled').value;
 assert.deepEqual(await repo.cancel(P,cancellation(P,pending,winner),admit),winnerRaw);
 assert.deepEqual(await requestState(W,raceRequest.requestId),{cases:1,payloads:1,events:2,heads:1});
 assert.equal((await app.recover(H('alice'),{operationId:raceRequest.operationId,fingerprint:raceFirst.operation.fingerprint})).receipt.state,'cancelled');
 const crossed=input({operationId:initialCancel.operationId});await unknown(()=>app.submit(H('alice'),crossed));
 assert.deepEqual(await requestState(W,crossed.requestId),{cases:0,payloads:0,events:0,heads:0});
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_private.lifecycle_request_events WHERE operation_id=$1',[crossed.operationId])).rows[0].n,1);
 const crossCurrent=await repo.status(P,{requestId:identical.requestId},admit);
 const crossCancel={operationId:initial.operationId,requestId:identical.requestId,expectedRevision:'1'};
 await denied(()=>repo.cancel(P,cancellation(P,crossCurrent,crossCancel),admit));
 assert.deepEqual(await requestState(W,identical.requestId),{cases:1,payloads:1,events:1,heads:1});
 check('observed concurrent identical submissions converge, global operation and cancellation races have one winner, and operation IDs cannot cross actions or cases');

 const originalHead=(await admin.query('SELECT * FROM garden_private.lifecycle_request_heads WHERE workspace_id=$1 AND request_id=$2',[W,initial.requestId])).rows[0];
 await admin.query('UPDATE garden_private.lifecycle_request_heads SET revision=1,fingerprint=$3 WHERE workspace_id=$1 AND request_id=$2',[W,initial.requestId,first.operation.fingerprint]);
 try{
  await denied(()=>app.status(H('alice'),{requestId:initial.requestId}));
  await denied(()=>app.recover(H('alice'),{operationId:initial.operationId,fingerprint:first.operation.fingerprint}));
  await unknown(()=>app.submit(H('alice'),initial));
  await denied(()=>app.cancel(H('alice'),{operationId:randomUUID(),requestId:initial.requestId,expectedRevision:'1'}));
  assert.deepEqual(await requestState(W,initial.requestId),{cases:1,payloads:1,events:2,heads:1});
 }finally{
  await admin.query('UPDATE garden_private.lifecycle_request_heads SET revision=$3,fingerprint=$4 WHERE workspace_id=$1 AND request_id=$2',
   [W,initial.requestId,originalHead.revision,originalHead.fingerprint]);
 }
 assert.deepEqual(await app.status(H('alice'),{requestId:initial.requestId}),{receipt:cancelled.receipt});
 check('restoring an older valid pending head beside a retained cancellation denies every read, retry and cancellation until the correct head is restored');

 const payloadWorkspace=await workspace(),payloadRepo=repository(payloadWorkspace),payloadPrincipal=principal(payloadWorkspace);
 const payloadApp=service(payloadWorkspace,{repository:payloadRepo}),payloadInput=input();
 const payloadFirst=await payloadApp.submit(H('alice'),payloadInput);
 const payloadBefore=await payloadRepo.status(payloadPrincipal,{requestId:payloadInput.requestId},admit);
 const payloadCancellation=cancellation(payloadPrincipal,payloadBefore,{operationId:randomUUID(),requestId:payloadInput.requestId,expectedRevision:'1'});
 const originalPayload=(await admin.query(`SELECT workspace_id,request_id,requester_id,kind,claimed_record_id
  FROM garden_private.lifecycle_request_payloads WHERE workspace_id=$1 AND request_id=$2`,[payloadWorkspace,payloadInput.requestId])).rows[0];
 assert.ok(originalPayload);let payloadRemoved=false;
 try{
  // Intentional committed material-loss simulation, confined to this new
  // disposable case so separate requester connections can observe absence.
  // This is not a guard probe or a physical-erasure implementation. Restore
  // the exact private row in finally; runtime retries may never recreate it.
  const removed=await admin.query('DELETE FROM garden_private.lifecycle_request_payloads WHERE workspace_id=$1 AND request_id=$2',
   [payloadWorkspace,payloadInput.requestId]);
  payloadRemoved=removed.rowCount===1;assert.equal(removed.rowCount,1);
  const absentState=await retainedState();
  await denied(()=>payloadApp.status(H('alice'),{requestId:payloadInput.requestId}));
  await denied(()=>payloadApp.recover(H('alice'),{operationId:payloadInput.operationId,fingerprint:payloadFirst.operation.fingerprint}));
  await unknown(()=>payloadApp.submit(H('alice'),payloadInput));
  await denied(()=>payloadApp.cancel(H('alice'),{operationId:randomUUID(),requestId:payloadInput.requestId,expectedRevision:'1'}));
  await denied(()=>payloadRepo.cancel(payloadPrincipal,payloadCancellation,admit));
  assert.deepEqual(await requestState(payloadWorkspace,payloadInput.requestId),{cases:1,payloads:0,events:1,heads:1});
  assert.deepEqual(await retainedState(),absentState);
 }finally{
  if(payloadRemoved)await admin.query(`INSERT INTO garden_private.lifecycle_request_payloads(workspace_id,request_id,requester_id,kind,claimed_record_id)
   VALUES($1,$2,$3,$4,$5)`,[originalPayload.workspace_id,originalPayload.request_id,originalPayload.requester_id,originalPayload.kind,originalPayload.claimed_record_id]);
 }
 assert.deepEqual(await payloadApp.status(H('alice'),{requestId:payloadInput.requestId}),{receipt:payloadFirst.receipt});
 assert.deepEqual(await requestState(payloadWorkspace,payloadInput.requestId),{cases:1,payloads:1,events:1,heads:1});
 check('missing separately stored request payload denies status, recovery, exact submission and cancellation without recreation or extra audit; exact synthetic restoration preserves the original receipt');

 const headConstraints=(await admin.query(`SELECT conname FROM pg_constraint WHERE conrelid='garden_private.lifecycle_request_heads'::regclass
  AND contype='f' AND confrelid='garden_private.lifecycle_request_events'::regclass`)).rows;
 assert.equal(headConstraints.length,1);assert.notEqual(payloadFirst.operation.fingerprint,'0'.repeat(64));
 const intactHeads=await retainedState();
 await rejectedOwnerMutation('UPDATE garden_private.lifecycle_request_heads SET fingerprint=$3 WHERE workspace_id=$1 AND request_id=$2',
  [payloadWorkspace,payloadInput.requestId,'0'.repeat(64)],error=>error.code==='23503'&&error.table==='lifecycle_request_heads'&&error.constraint===headConstraints[0].conname);
 assert.deepEqual(await retainedState(),intactHeads);
 check('a head fingerprint without its exact immutable event fails the specific foreign key in an always-rolled-back owner probe, with populated retained state unchanged');

 for(const completion of ['COMMIT','ROLLBACK']){
  const command=input(),payload=submission(P,command),client=await pools.requester.connect();let minted;
  const failingRetirement=interceptedPool(pools.issuer,async(c,sql,args)=>{
   if(sql.includes('invalidate_lifecycle_request_ticket'))throw Error(CANARY+'-failed-retirement');
   return c.query(sql,args);
  });
  try{
   await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_requester');
   minted=await mintTicket(client,P,{action:'submit',requestId:command.requestId,operationId:command.operationId,fingerprint:payload.fingerprint});
   await bind(client,minted.token);
   validateLifecycleRequest((await client.query('SELECT garden_control.submit_lifecycle_request($1::jsonb) AS result',[JSON.stringify(payload)])).rows[0].result);
   await finishContext(client);await client.query(completion);
   await assert.rejects(()=>retire(minted.token,failingRetirement),error=>error.message===CANARY+'-failed-retirement');
   const retained=await ticketRow(minted.token);assert.ok(retained);
   assert.equal(retained.transaction_id,minted.transaction_id);assert.equal(retained.backend_pid,minted.backend_pid);
   assert.equal(retained.used_at===null,completion==='ROLLBACK');
   await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_requester');
   const next=(await client.query('SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')).rows[0];
   assert.equal(next.backend_pid,minted.backend_pid);assert.notEqual(next.transaction_id,minted.transaction_id);
   await assert.rejects(()=>bind(client,minted.token),sqlUnavailable);await client.query('ROLLBACK');
   if(completion==='COMMIT')assert.deepEqual(await requestState(W,command.requestId),{cases:1,payloads:1,events:1,heads:1});
   else await noRequest(W,command);
  }finally{
   try{await client.query('ROLLBACK');}finally{client.release();if(minted)await retire(minted.token);}
  }
 }
 check('failed retirement leaves a committed PID+xid binding: both committed and rolled-back tokens deny replay on the same backend in a new transaction');

 for(const mismatch of ['pid','xid']){
  const client=await pools.requester.connect(),command=input(),payload=submission(P,command);let minted;
  try{
   await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_requester');
   const actual=(await client.query('SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')).rows[0];
   const wrong=mismatch==='pid'?{backendPid:actual.backend_pid+100000}:{transactionId:(BigInt(actual.transaction_id)+1n).toString()};
   minted=await mintTicket(client,P,{action:'submit',requestId:command.requestId,operationId:command.operationId,fingerprint:payload.fingerprint},wrong);
   await assert.rejects(()=>bind(client,minted.token),sqlUnavailable);
  }finally{try{await client.query('ROLLBACK');}finally{client.release();if(minted)await retire(minted.token);}}
  await noRequest(W,command);
 }
 for(const change of ['action','request','fingerprint','kind']){
  const client=await pools.requester.connect(),command=input(),payload=submission(P,command);let minted;
  try{
   await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_requester');
   minted=await mintTicket(client,P,{action:'submit',requestId:command.requestId,operationId:command.operationId,fingerprint:payload.fingerprint});
   await bind(client,minted.token);
   if(change==='action')await assert.rejects(()=>client.query('SELECT garden_control.lifecycle_request_status($1)',[command.requestId]),sqlUnavailable);
   else{
    const altered=structuredClone(payload);
    if(change==='request')altered.input.requestId=randomUUID();
    if(change==='fingerprint')altered.fingerprint='0'.repeat(64);
    if(change==='kind')altered.input.kind='export';
    await assert.rejects(()=>client.query('SELECT garden_control.submit_lifecycle_request($1::jsonb)',[JSON.stringify(altered)]),sqlUnavailable);
   }
  }finally{try{await client.query('ROLLBACK');}finally{client.release();if(minted)await retire(minted.token);}}
  await noRequest(W,command);
 }
 check('SQL independently binds both PID and xid8, and a redeemed ticket cannot switch action, request, canonical fingerprint or claim kind');

 const rollbackInput=input();
 const rollbackPool=interceptedPool(pools.requester,async(client,sql,args)=>{
  const result=await client.query(sql,args);
  if(sql.includes('submit_lifecycle_request'))throw Error(CANARY+'-after-mutation');
  return result;
 });
 await unknown(()=>service(W,{repository:repository(W,{requesterPool:rollbackPool})}).submit(H('alice'),rollbackInput));
 await noRequest(W,rollbackInput);
 check('failure after the SQL mutation returns but before COMMIT rolls back private payload, immutable operation, current head and succeeded audit together');

 for(const action of ['submit','cancel']){
  const command=input(),ws=await workspace(),faultRepo=repository(ws),faultApp=service(ws,{repository:faultRepo});
  let cancelInput;
  if(action==='cancel'){
   await faultApp.submit(H('alice'),command);
   cancelInput={operationId:randomUUID(),requestId:command.requestId,expectedRevision:'1'};
  }
  const before=await retainedState();
  await admin.query('CREATE SEQUENCE garden_control.lifecycle_fixture_audit_reached');
  await admin.query(`CREATE FUNCTION garden_control.lifecycle_fixture_audit_failure() RETURNS trigger
   LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM garden_private.lifecycle_request_cases c JOIN garden_private.lifecycle_request_payloads p USING(workspace_id,request_id)
     WHERE c.workspace_id=NEW.workspace_id AND c.request_id='${command.requestId}'::uuid) THEN RAISE EXCEPTION 'Synthetic lifecycle state was not reached'; END IF;
    PERFORM nextval('garden_control.lifecycle_fixture_audit_reached');
    RAISE EXCEPTION 'Synthetic lifecycle audit failure';
   END $$`);
  await admin.query(`CREATE TRIGGER lifecycle_fixture_audit_failure BEFORE INSERT ON garden_control.audit_events
   FOR EACH ROW WHEN (NEW.workspace_id='${ws}'::uuid AND NEW.event_text::jsonb->>'action'='lifecycle.request.${action}')
   EXECUTE FUNCTION garden_control.lifecycle_fixture_audit_failure()`);
  try{
   if(action==='submit')await unknown(()=>faultApp.submit(H('alice'),command));
   else await unknown(()=>faultApp.cancel(H('alice'),cancelInput));
   assert.equal((await admin.query('SELECT is_called FROM garden_control.lifecycle_fixture_audit_reached')).rows[0].is_called,true);
   assert.deepEqual(await retainedState(),before);
   if(action==='submit')await noRequest(ws,command);
   else assert.equal((await faultApp.status(H('alice'),{requestId:command.requestId})).receipt.state,'pending');
  }finally{
   await admin.query('DROP TRIGGER lifecycle_fixture_audit_failure ON garden_control.audit_events');
   await admin.query('DROP FUNCTION garden_control.lifecycle_fixture_audit_failure()');
   await admin.query('DROP SEQUENCE garden_control.lifecycle_fixture_audit_reached');
  }
 }
 check('forced real audit insertion failures leave submission absent and cancellation pending, with exact populated ledger and request snapshots unchanged');

 for(const phase of ['case','audit']){
  const ws=await workspace(),command=input();let deadline;
  const issuerPool=shortAdmissionPool({onMint:value=>{deadline=value.deadline;}});
  let blocker;
  if(phase==='case')blocker=await holdCase(ws,command.requestId);
  else{
   await admin.query('INSERT INTO garden_control.audit_heads(workspace_id) VALUES($1) ON CONFLICT DO NOTHING',[ws]);
   blocker=await admin.connect();await blocker.query('BEGIN');
   await blocker.query('SELECT sequence FROM garden_control.audit_heads WHERE workspace_id=$1 FOR UPDATE',[ws]);
  }
  const operation=service(ws,{repository:repository(ws,{issuerPool})}).submit(H('alice'),command);operation.catch(()=>{});
  try{
   const blocked=await waitForBlocked('submit_lifecycle_request');
   assert.ok(deadline&&blocked.query_start<deadline,'the actual blocked statement must begin before ticket expiry');
   await afterDeadline(deadline);
  }finally{await release(blocker);}
  await unknown(()=>operation);await noRequest(ws,command);
 }
 const readBlocker=await holdCase(W,initial.requestId);let readDeadline;
 const expiringRead=service(W,{repository:repository(W,{issuerPool:shortAdmissionPool({onMint:value=>{readDeadline=value.deadline;}})})})
  .status(H('alice'),{requestId:initial.requestId});expiringRead.catch(()=>{});
 try{
  const blocked=await waitForBlocked('lifecycle_request_status');assert.ok(readDeadline&&blocked.query_start<readDeadline);await afterDeadline(readDeadline);
 }finally{await release(readBlocker);}
 await denied(()=>expiringRead);
 check('actual case and audit-head lock waits cannot extend admission: expiry denies new writes and own-status delivery after the wait');

 const tailPending=input();await app.submit(H('alice'),tailPending);
 const tailCurrent=await repo.status(P,{requestId:tailPending.requestId},admit);
 const tailCancellation={operationId:randomUUID(),requestId:tailPending.requestId,expectedRevision:'1'};
 for(const action of ['submit','cancel','status','recover','replay']){
  const command=input(),before=await retainedState();let deadline,reached=false,waited=false;
  const name=action==='submit'||action==='replay'?'submit_lifecycle_request':action==='cancel'?'cancel_lifecycle_request':action==='status'?'lifecycle_request_status':'recover_lifecycle_request';
  const requesterPool=interceptedPool(pools.requester,async(client,sql,args)=>{
   if(sql==='COMMIT'&&reached&&!waited){
    waited=true;assert.ok(deadline&&Date.now()<new Date(deadline).getTime(),'the mutation/read and explicit context check must finish before expiry');
    await afterDeadline(deadline);
   }
   const result=await client.query(sql,args);if(sql.includes(name+'('))reached=true;return result;
  });
  const tail=repository(W,{requesterPool,issuerPool:shortAdmissionPool({onMint:value=>{deadline=value.deadline;}})});
  if(action==='submit')await denied(()=>tail.submit(P,submission(P,command),admit));
  else if(action==='cancel')await denied(()=>tail.cancel(P,cancellation(P,tailCurrent,tailCancellation),admit));
  else if(action==='status')await denied(()=>tail.status(P,{requestId:initial.requestId},admit));
  else if(action==='recover')await denied(()=>tail.recover(P,{operationId:initial.operationId,fingerprint:first.operation.fingerprint},admit));
  else await denied(()=>tail.submit(P,submission(P,initial),admit));
  assert.equal(reached,true);assert.equal(waited,true);assert.deepEqual(await retainedState(),before);
  if(action==='submit')await noRequest(W,command);
 }
 check('deferred admission checks run at actual COMMIT for submit, cancel, status, recovery and exact replay after context cleanup, not merely at SQL function return');

 for(const action of ['submit','cancel']){
  const command=input();if(action==='cancel')await app.submit(H('alice'),command);
  const cancelInput={operationId:randomUUID(),requestId:command.requestId,expectedRevision:'1'};
  const functionName=action==='submit'?'submit_lifecycle_request':'cancel_lifecycle_request';let reached=false,lost=false;
  const lostPool=interceptedPool(pools.requester,async(client,sql,args)=>{
   const result=await client.query(sql,args);if(sql.includes(functionName+'('))reached=true;
   if(sql==='COMMIT'&&reached&&!lost){lost=true;throw Error(CANARY+'-lost-commit-ack');}
   return result;
  });
  const lostApp=service(W,{repository:repository(W,{requesterPool:lostPool})});let uncertain;
  try{
   if(action==='submit')await lostApp.submit(H('alice'),command);else await lostApp.cancel(H('alice'),cancelInput);
   assert.fail('a lost COMMIT acknowledgement must not be reported as confirmed');
  }catch(error){assert.ok(error instanceof LifecycleRequestOutcomeUnknownError);uncertain=error;}
  assert.equal(lost,true);assert.deepEqual(Object.keys(uncertain.recovery).sort(),['fingerprint','operationId']);
  assert.ok(Object.isFrozen(uncertain.recovery));assert.equal(uncertain.recovery.operationId,action==='submit'?command.operationId:cancelInput.operationId);
  const recovered=await app.recover(H('alice'),uncertain.recovery);
  assertReceipt(recovered,{...command,state:action==='submit'?'pending':'cancelled',revision:action==='submit'?'1':'2'});
  assert.equal(recovered.operation.fingerprint,uncertain.recovery.fingerprint);
  if(action==='submit')assert.deepEqual(await app.submit(H('alice'),command),recovered);
  else assert.deepEqual(await app.cancel(H('alice'),cancelInput),recovered);
  await denied(()=>app.recover(H('bob'),uncertain.recovery));
  await denied(()=>service(OTHER).recover(H('alice'),uncertain.recovery));
  assert.deepEqual(await requestState(W,command.requestId),{cases:1,payloads:1,events:action==='submit'?1:2,heads:1});
 }
 check('real successful COMMIT with a lost acknowledgement returns only an uncertain operation handle; authenticated exact readback confirms one submission or cancellation');

 let leakedTicket;
 const retirementPool=interceptedPool(pools.issuer,async(client,sql,args)=>{
  if(sql.includes('invalidate_lifecycle_request_ticket'))throw Error(CANARY+'-retirement-unavailable');
  const result=await client.query(sql,args);
  if(sql.includes('issue_lifecycle_request_ticket')){assert.equal(Object.keys(result.rows[0]).length,1);leakedTicket=Object.values(result.rows[0])[0];}
  return result;
 });
 const retirementInput=input();let retirementRecovery;
 try{
  try{await service(W,{repository:repository(W,{issuerPool:retirementPool})}).submit(H('alice'),retirementInput);assert.fail('failed cleanup cannot acknowledge delivery');}
  catch(error){assert.ok(error instanceof LifecycleRequestOutcomeUnknownError);retirementRecovery=error.recovery;}
  assert.ok(leakedTicket);assert.ok((await ticketRow(leakedTicket)).used_at);
  await rejectedRuntimeStatement(pools.requester,'garden_lifecycle_requester','SELECT garden_control.bind_lifecycle_request_context($1)',[leakedTicket],sqlUnavailable);
  assert.equal((await app.recover(H('alice'),retirementRecovery)).receipt.state,'pending');
  assert.deepEqual(await requestState(W,retirementInput.requestId),{cases:1,payloads:1,events:1,heads:1});
 }finally{if(leakedTicket)await retire(leakedTicket);}
 check('a real repository retirement failure denies acknowledgement, leaves its token unusable, and preserves exact operation recovery');

 for(const closure of ['service','intake','repository','identity']){
  const command=input(),originalProfile=profiles.get('alice');let open=true,reached=false;
  const closingPool=interceptedPool(pools.requester,async(client,sql,args)=>{
   const result=await client.query(sql,args);
   if(sql.includes('clear_lifecycle_request_context')){
    reached=true;open=false;
    if(closure==='identity')profiles.set('alice',{...originalProfile,sessionId:'synthetic-revoked-session'});
   }
   return result;
  });
  const closingRepo=repository(W,{requesterPool:closingPool,isEnabled:()=>closure==='repository'?open:true});
  const closingApp=service(W,{repository:closingRepo,isEnabled:()=>closure==='service'?open:true,isIntakeEnabled:()=>closure==='intake'?open:true});
  try{await unknown(()=>closingApp.submit(H('alice'),command));assert.equal(reached,true);await noRequest(W,command);}
  finally{profiles.set('alice',originalProfile);}
 }
 check('service, intake, repository and session closure after SQL context cleanup all prevent submission COMMIT and succeeded audit');

 for(const action of ['submit','status']){
  const command=input(),originalProfile=profiles.get('alice');let open=true,reached=false;
  const closingIssuer=interceptedPool(pools.issuer,async(client,sql,args)=>{
   const result=await client.query(sql,args);
   if(sql.includes('invalidate_lifecycle_request_ticket')){
    reached=true;
    if(action==='submit')open=false;
    else profiles.set('alice',{...originalProfile,sessionId:'synthetic-late-revoked-session'});
   }
   return result;
  });
  const closingApp=service(W,{repository:repository(W,{issuerPool:closingIssuer}),isEnabled:()=>open});
  try{
   if(action==='submit'){
    await unknown(()=>closingApp.submit(H('alice'),command));
    assert.deepEqual(await requestState(W,command.requestId),{cases:1,payloads:1,events:1,heads:1});
   }else await denied(()=>closingApp.status(H('alice'),{requestId:initial.requestId}));
   assert.equal(reached,true);
  }finally{profiles.set('alice',originalProfile);}
 }
 check('closure during post-COMMIT ticket retirement denies final write acknowledgement or status delivery without pretending a committed write rolled back');

 for(const [alias,capability] of Object.entries(CAPABILITIES)){
  const own=await pools[alias].connect();
  try{await assertDatabaseCapability(own,capability);}finally{own.release();}
  for(const table of PRIVATE)await rejectedRuntimeStatement(pools[alias],capability,'SELECT * FROM garden_private.'+table,[],error=>error.code==='42501');
  for(const table of CONTROL)await rejectedRuntimeStatement(pools[alias],capability,'SELECT * FROM garden_control.'+table,[],error=>error.code==='42501');
  if(alias!=='requester'){
   await rejectedRuntimeStatement(pools[alias],capability,'SELECT garden_control.bind_lifecycle_request_context($1)',['0'.repeat(64)],error=>error.code==='42501');
   await rejectedRuntimeStatement(pools[alias],capability,'SELECT garden_control.lifecycle_request_status($1)',[initial.requestId],error=>error.code==='42501');
  }
  if(alias!=='issuer'){
   await rejectedRuntimeStatement(pools[alias],capability,'SELECT garden_control.issue_lifecycle_request_ticket($1,$2,$3,$4,$5,$6,$7,$8,$9::xid8)',
    [W,P.subjectId,'ci','submit',randomUUID(),randomUUID(),'a'.repeat(64),1,'1'],error=>error.code==='42501');
   await rejectedRuntimeStatement(pools[alias],capability,'SELECT garden_control.invalidate_lifecycle_request_ticket($1)',['0'.repeat(64)],error=>error.code==='42501');
  }
 }
 await rejectedRuntimeStatement(pools.requester,'garden_lifecycle_requester','SELECT garden_control.lifecycle_request_snapshot($1,$2,$3)',[W,initial.requestId,P.subjectId],error=>error.code==='42501');
 await rejectedRuntimeStatement(pools.requester,'garden_lifecycle_requester','SELECT garden_control.lifecycle_request_status($1)',[initial.requestId],sqlUnavailable);
 const rls=(await admin.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='garden_private' AND c.relname=ANY($1::text[])) OR (n.nspname='garden_control' AND c.relname=ANY($2::text[]))`,[PRIVATE,CONTROL])).rows;
 assert.equal(rls.length,6);assert.ok(rls.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
 let separatedPairs=0;
 for(const [alias,capability] of Object.entries(CAPABILITIES).filter(([name])=>name!=='requester')){
  for(const [loginName,expected,foreign,pool] of [
   ['garden_lifecycle_requester_ci','garden_lifecycle_requester',capability,pools.requester],
   ['garden_lifecycle_'+alias+'_ci',capability,'garden_lifecycle_requester',pools[alias]]
  ]){
   await admin.query(`GRANT ${foreign} TO ${loginName} WITH INHERIT FALSE, SET FALSE`);
   try{
    const client=await pool.connect();
    try{await assert.rejects(()=>assertDatabaseCapability(client,expected),DatabaseCapabilityError);}finally{client.release();}
   }finally{await admin.query(`REVOKE ${foreign} FROM ${loginName}`);}
   separatedPairs++;
  }
 }
 assert.equal(separatedPairs,20);
 check('all eleven disjoint runtime roles lack raw access to six forced-RLS tables; only issuer can mint/retire and only the dedicated requester can redeem, with all twenty new mixed-capability directions denied');

 const metadataColumns=(await admin.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='garden_private'
  AND table_name=ANY($1::text[])`,[['lifecycle_request_cases','lifecycle_request_events','lifecycle_request_heads']])).rows;
 assert.equal(metadataColumns.some(row=>['requester_id','subject_id','kind','claimed_record_id'].includes(row.column_name)),false);
 const retainedBefore=await retainedState();
 for(const table of PRIVATE)assert.ok(retainedBefore.some(row=>row.table_name==='garden_private.'+table&&BigInt(row.count)>0n));
 for(const table of ['lifecycle_request_cases','lifecycle_request_events']){
  await rejectedOwnerMutation('UPDATE garden_private.'+table+' SET workspace_id=workspace_id WHERE workspace_id=$1',[W],immutableError);
  await rejectedOwnerMutation('DELETE FROM garden_private.'+table+' WHERE workspace_id=$1',[W],immutableError);
  const children=table==='lifecycle_request_cases'?['lifecycle_request_payloads','lifecycle_request_events']:['lifecycle_request_heads'];
  await rejectedOwnerMutation('TRUNCATE garden_private.'+table,[],error=>error.code==='0A000'&&
   error.message==='cannot truncate a table referenced in a foreign key constraint'&&children.some(child=>error.detail===`Table "${child}" references "${table}".`));
  await rejectedOwnerMutation('TRUNCATE garden_private.'+table+' CASCADE',[],immutableError);
 }
 const predecessorConstraints=(await admin.query(`SELECT conname FROM pg_constraint WHERE conrelid='garden_private.lifecycle_request_events'::regclass
  AND contype='c' AND pg_get_constraintdef(oid) LIKE '%previous_revision IS NOT NULL%' AND pg_get_constraintdef(oid) LIKE '%previous_fingerprint IS NOT NULL%'`)).rows;
 assert.equal(predecessorConstraints.length,1);
 for(const previous of [[null,identicalResults[0].operation.fingerprint],[1,null],[null,null]]){
  await rejectedOwnerMutation(`INSERT INTO garden_private.lifecycle_request_events(workspace_id,request_id,revision,operation_id,fingerprint,action,state,requester_reference,
   expected_revision,previous_revision,previous_fingerprint,recorded_at,admission_expires_at,audit_sequence)
   SELECT workspace_id,request_id,2,$3,'${'a'.repeat(64)}','cancel','cancelled',requester_reference,1,$4,$5,
    date_trunc('milliseconds',clock_timestamp()),clock_timestamp()+interval '30 seconds',audit_sequence
   FROM garden_private.lifecycle_request_events WHERE workspace_id=$1 AND request_id=$2 AND revision=1`,
  [W,identical.requestId,randomUUID(),...previous],error=>error.code==='23514'&&error.table==='lifecycle_request_events'&&error.constraint===predecessorConstraints[0].conname);
 }
 assert.deepEqual(await retainedState(),retainedBefore);
 check('retained metadata excludes requester and claim payload; exact FK/append-only guards and non-null predecessor checks reject owner probes with every transaction rolled back and all populated state unchanged');

 for(const ws of [...workspaces,recordWorkspace]){
  const audit=(await admin.query(`SELECT workspace_id::text AS "workspaceId",sequence::text AS sequence,previous_hash AS "previousHash",hash,event_text AS "eventText"
   FROM garden_control.audit_events AS ae WHERE workspace_id=$1 ORDER BY ae.sequence`,[ws])).rows;
  verifyAuditPage(audit,{workspaceId:ws,sequence:'0',hash:GENESIS});
  assert.equal(JSON.stringify(audit).includes(CANARY),false);
  const operations=(await admin.query(`SELECT e.request_id,e.operation_id,e.revision::text,e.action,e.audit_sequence::text,p.claimed_record_id
   FROM garden_private.lifecycle_request_events e JOIN garden_private.lifecycle_request_payloads p USING(workspace_id,request_id) WHERE e.workspace_id=$1`,[ws])).rows;
  const lifecycle=audit.map(row=>({...row,event:JSON.parse(row.eventText)})).filter(row=>row.event.action.startsWith('lifecycle.request.'));
  assert.equal(lifecycle.length,operations.length);
  for(const row of operations){
   const event=lifecycle.find(item=>item.sequence===row.audit_sequence)?.event;assert.ok(event);
   assert.deepEqual(event.subject,{kind:'lifecycle-request',reference:row.request_id,version:row.revision});
   assert.equal(event.requestId,row.operation_id);assert.equal(event.action,'lifecycle.request.'+row.action);
   assert.equal(event.outcome,'succeeded');assert.equal(event.reasonCode,row.action==='submit'?'request-submitted':'request-cancelled');
   assert.notEqual(event.subject.reference,row.claimed_record_id);assert.notEqual(event.subject.reference,event.requestId);
   assert.equal(JSON.stringify(event).includes(row.claimed_record_id),false);
  }
 }
 await rejectedOwnerMutation("SELECT garden_control.append_audit_event($1,'subject',$2,'lifecycle-request',$3,1,'lifecycle.request.erase',$4)",
  [W,P.subjectId,initial.requestId,randomUUID()],error=>error.code==='P0001'&&error.message==='Unregistered audit action');
 await rejectedOwnerMutation("SELECT garden_control.append_audit_event($1,'subject',$2,'request',$3,1,'lifecycle.request.submit',$4)",
  [W,P.subjectId,initial.requestId,randomUUID()],error=>error.code==='P0001'&&error.message==='Audit subject mismatch');
 for(const table of CONTROL)assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.'+table)).rows[0].n,0);
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.access_members WHERE workspace_id=ANY($1::uuid[])',[workspaces])).rows[0].n,0);
 check('closed audit actions bind stable case IDs separately from operation IDs, verify every succeeded mutation without raw requester/claim values, and leave no pooled ticket or context residue');

 await mkdir('data-evidence',{recursive:true});
 await writeFile('data-evidence/lifecycle-requests-results.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,checks,
  real_postgresql:true,synthetic_identity:true,synthetic_claims:true,hosted_deployment_verified:false,
  record_authority_verified:false,physical_erasure_verified:false,export_delivery_verified:false,
  independent_restore_anchor:false,full_backup_restore_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' real PostgreSQL lifecycle request checks');
}finally{for(const pool of Object.values(pools))await pool.end();await admin.end();}
