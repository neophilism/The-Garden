/** Actual PostgreSQL retention-control transactions. Every identity, authority,
 * record and date below is a disposable CI fixture, never corpus or provider
 * authority. This script requires the guarded loopback database used by CI.
 */
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createLifecycleControlRepository} from './lifecycle-control-repository.mjs';
import {createLifecycleControlService} from './lifecycle-controls.mjs';
import {createLifecycleRequestRepository} from './lifecycle-request-repository.mjs';
import {createLifecycleRequestService,LifecycleRequestOutcomeUnknownError} from './lifecycle-requests.mjs';
import {allowSyntheticResearchUse} from './consent-test-fixture.mjs';
import {ASSURANCE_LIFETIME_MS,sameAssurance} from '../identity/assurance.mjs';
import {RUNTIME_DATABASE_CAPABILITIES,assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';
import {GENESIS,verifyAuditPage} from '../../../packages/domain/src/audit/ledger.mjs';
import {retentionRuleCommandFingerprint} from '../../../packages/domain/src/lifecycle/retention.mjs';
import {lifecycleRequestFingerprint} from '../../../packages/domain/src/lifecycle/requests.mjs';
import {validateUsePolicy,validateConsentGrant} from '../../../packages/domain/src/consent/purpose.mjs';
import {controlMethodIntent,lifecycleControlIntentFingerprint,lifecycleControlCommandFingerprint,buildControlCommit,
 lifecycleControlReadFingerprint,lifecycleControlResultFingerprint,controlRecovery,validateControlResult} from '../../../packages/domain/src/lifecycle/control-storage.mjs';

if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||
 process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='5432'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='neondb'){
 throw Error('Lifecycle control fixtures require isolated loopback CI');
}
const config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:8,connectionTimeoutMillis:5000};
const admin=new pg.Pool(config),pools={},checks=[],workspaces=[];
const POLICY='e'.repeat(64),CANARY='LIFECYCLE-CONTROL-PRIVATE-CANARY';
const CAPABILITIES=Object.fromEntries(RUNTIME_DATABASE_CAPABILITIES.map(role=>[role.slice('garden_'.length),role]));
const PRIVATE=['lifecycle_control_events','lifecycle_control_payloads','lifecycle_control_heads','lifecycle_control_scope_heads'];
const CONTROL=['lifecycle_operation_registry','lifecycle_authority_evidence','lifecycle_evidence_heads','lifecycle_operator_grants',
 'lifecycle_grant_heads','lifecycle_control_tickets','lifecycle_control_contexts','lifecycle_control_delivery_checks'];
const profiles=new Map([
 ['alice',{id:CANARY+'-alice',sessionId:'synthetic-control-session-alice',verified:true,privilegedAssurance:true}],
 ['bob',{id:CANARY+'-bob',sessionId:'synthetic-control-session-bob',verified:true,privilegedAssurance:true}],
 ['unicode',{id:CANARY+'-quote"-slash\\-é-東京-\u2028-\u2029-𐐷',sessionId:'synthetic-control-session-unicode',verified:true,privilegedAssurance:true}]
]);
for(const [alias,profile] of profiles)profiles.set(alias,{...profile,lastStepUpAt:new Date().toISOString(),assuranceCredentialId:'synthetic-control-credential-'+alias});
const H=alias=>new Headers({'synthetic-control-identity':alias});
const identity={
 async viewer(headers){
  const profile=profiles.get(headers.get('synthetic-control-identity'));if(!profile)return null;
  const age=Date.now()-Date.parse(profile.lastStepUpAt);
  return Object.freeze({...profile,privilegedAssurance:profile.privilegedAssurance===true&&age>=0&&age<ASSURANCE_LIFETIME_MS});
 },
 async authorizePrivileged(headers,action,authorize){
  const before=await this.viewer(headers);
  if(action!=='lifecycle.administer'||before?.privilegedAssurance!==true)return false;
  const allowed=await authorize(Object.freeze({subjectId:before.id,sessionId:before.sessionId,action}));
  const after=await this.viewer(headers);
  return allowed===true&&sameAssurance(before,after);
 }
};
const principal=(workspaceId,alias='alice')=>Object.freeze({workspaceId,subjectId:profiles.get(alias).id});
const iso=value=>new Date(value).toISOString();
function ruleCommand(scope,patch={}){
 const now=Date.now();return {operationId:randomUUID(),ruleId:randomUUID(),revision:'1',scope:{...scope},
  retentionClass:'case_and_rights_policy',basis:'policy',evidenceId:randomUUID(),effectiveAt:iso(now-60000),
  expiresAt:iso(now+3600000),reviewBy:iso(now+1800000),retainUntil:iso(now+600000),disposeBy:iso(now+1200000),...patch};
}
function holdCommand(scope,patch={}){
 const now=Date.now();return {operationId:randomUUID(),holdId:randomUUID(),scope:{...scope},reason:'legal-hold',evidenceId:randomUUID(),
  effectiveAt:iso(now-60000),expiresAt:iso(now+3600000),reviewBy:iso(now+1800000),...patch};
}
function releaseCommand(held,patch={}){
 return {operationId:randomUUID(),holdId:held.placement.command.holdId,expectedRevision:'1',holdFingerprint:held.fingerprint,
  evidenceId:randomUUID(),reviewBy:iso(Date.now()+1800000),...patch};
}
const check=name=>{checks.push({name,result:'pass'});console.log('LIFECYCLE CONTROL '+checks.length+': '+name);};
const immutableError=error=>error.code==='P0001'&&error.message==='Audit history is append-only';
const deniedSql=error=>error.code==='42501';
const sqlUnavailable=error=>error.code==='P0001'&&error.message==='Lifecycle control unavailable';
const unavailable=error=>error?.code==='lifecycle_control_unavailable'&&error.message==='Lifecycle control unavailable';
const denied=work=>assert.rejects(work,unavailable);
const uncertain=work=>assert.rejects(work,error=>error?.code==='lifecycle_control_outcome_unknown'&&
 error.message==='Lifecycle control unavailable'&&Object.isFrozen(error.recovery)&&Object.isFrozen(error.recovery.scope));
function admission({expiresAt=iso(Date.now()+120000),before=async()=>{},available=()=>true}={}){
 const admit=async()=>{await before();return true;};Object.defineProperties(admit,{isAvailable:{value:available},expiresAt:{value:expiresAt}});return Object.freeze(admit);
}

async function login(alias,capability){
 assert.match(alias,/^[a-z_]+$/);
 const name='garden_controls_'+alias+'_ci',password=randomBytes(32).toString('hex');
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
function privateValue(reply){
 assert.deepEqual(Object.keys(reply).sort(),['admission','value']);assert.deepEqual(Object.keys(reply.admission).sort(),['expiresAt','resultFingerprint']);
 assert.ok(Object.isFrozen(reply)&&Object.isFrozen(reply.admission));
 assert.equal(reply.admission.resultFingerprint,lifecycleControlResultFingerprint(reply.value));
 assert.ok(Date.parse(reply.admission.expiresAt)>Date.now());return reply.value;
}
function repository(workspaceId,{issuerPool=pools.context_issuer,adminPool=pools.lifecycle_admin,wire=false,...extra}={}){
 const repo=createLifecycleControlRepository({issuerPool,adminPool,workspaceId,environment:'ci',isEnabled:()=>true,...extra});
 // Direct repository assertions explicitly validate and unwrap the private
 // transport. Actual host composition receives the original wrapper instead.
 return wire?repo:Object.freeze(Object.fromEntries(['prepare','commit','status','recover'].map(method=>
  [method,async(...args)=>privateValue(await repo[method](...args))])));
}
function service(workspaceId,{repository:repo=repository(workspaceId,{wire:true}),...extra}={}){
 return createLifecycleControlService({identity,repository:repo,workspaceId,isEnabled:()=>true,isAdministrationEnabled:()=>true,...extra});
}
async function workspace(){
 const id=randomUUID();workspaces.push(id);
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',
  [id,'Synthetic lifecycle control workspace',POLICY]);
 for(const {id:subject} of profiles.values()){
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[id,subject,POLICY]);
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,'researcher',$2,clock_timestamp()+interval '1 hour')",[id,subject]);
 }
 return id;
}
async function record(workspaceId,{classification='research',state='active',consent=true}={}){
 const recordId=randomUUID();
 await admin.query('INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state,payload) VALUES($1,$2,$3,$4,$5,\'{}\')',
  [recordId,workspaceId,profiles.get('alice').id,classification,state]);
 for(const {id:subject} of profiles.values())await admin.query(`INSERT INTO garden_control.record_grants
  (workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at)
  VALUES($1,$2,$3,true,false,'research',clock_timestamp()+interval '1 hour')`,[workspaceId,recordId,subject]);
 if(consent)await allowSyntheticResearchUse(admin,workspaceId,recordId);
 return {workspaceId,recordId,recordRevision:'1',classification:'restricted_research'};
}
async function authority(scope,action,{alias='alice',evidencePatch={},grantPatch={}}={}){
 const now=Date.now(),dates={validFrom:iso(now-60000),expiresAt:iso(now+3600000),reviewBy:iso(now+3000000)};
 const evidenceCommand={operationId:randomUUID(),evidenceId:randomUUID(),revision:'1',expectedFingerprint:null,scope:{...scope},action,
  authorityKind:action==='lifecycle.retention-rule'?'policy-appointment':'legal-review',authorityReference:randomUUID(),reviewerReference:randomUUID(),
  ...dates,state:'verified',...evidencePatch};
 const evidenceReceipt=(await admin.query('SELECT garden_control.record_lifecycle_evidence($1::jsonb,$2::text) AS result',
  [JSON.stringify(evidenceCommand),'synthetic-lifecycle-authority-reviewer'])).rows[0].result;
 const grantCommand={operationId:randomUUID(),grantId:randomUUID(),revision:'1',expectedFingerprint:null,scope:{...scope},subjectId:profiles.get(alias).id,
  action,evidenceId:evidenceCommand.evidenceId,evidenceRevision:evidenceReceipt.revision,...dates,state:'active',...grantPatch};
 const grantReceipt=(await admin.query('SELECT garden_control.record_lifecycle_operator_grant($1::jsonb,$2::text) AS result',
  [JSON.stringify(grantCommand),'synthetic-lifecycle-authority-reviewer'])).rows[0].result;
 assert.equal(evidenceReceipt.committed,true);assert.equal(evidenceReceipt.effectsVerified,false);
 assert.equal(grantReceipt.committed,true);assert.equal(grantReceipt.effectsVerified,false);
 return {evidenceCommand,evidenceReceipt,grantCommand,grantReceipt};
}
async function authorities(scope,options={}){
 return Object.fromEntries(await Promise.all(['lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release','lifecycle.inspect']
  .map(async action=>[action,await authority(scope,action,options)])));
}
async function personalConsent(scope,{guardian=false,deadline=iso(Date.now()+2000)}={}){
 const terms={id:randomUUID(),version:'1',digest:'3'.repeat(64)},subjectId=CANARY+'-represented-person';
 await admin.query('SELECT garden_control.register_consent_terms($1,1,$2,$3)',[terms.id,terms.digest,'synthetic-consent-reviewer']);
 const policy=validateUsePolicy({schemaVersion:1,recordId:scope.recordId,basis:'consent-required',inputs:[],terms,
  subjects:[{subjectId,authority:guardian?'guardian':'self'}],purposes:[],reasonDigest:'4'.repeat(64)});
 await admin.query('SELECT garden_control.set_use_policy($1,$2::jsonb,1,$3)',[scope.workspaceId,JSON.stringify(policy),'synthetic-consent-reviewer']);
 const grant=validateConsentGrant({schemaVersion:1,id:randomUUID(),recordId:scope.recordId,subjectId,grantorId:guardian?CANARY+'-representative':subjectId,
  authority:guardian?'guardian':'self',authorityDigest:guardian?'5'.repeat(64):null,authorityExpiresAt:guardian?deadline:null,
  terms,purpose:'research',derivativesAllowed:true,validFrom:iso(Date.now()-60000),expiresAt:guardian?iso(Date.now()+3600000):deadline,evidenceDigest:'6'.repeat(64)});
 await admin.query('SELECT garden_control.record_consent_grant($1,$2::jsonb,$3)',[scope.workspaceId,JSON.stringify(grant),'synthetic-consent-reviewer']);
 assert.equal((await admin.query("SELECT garden_control.consent_allows($1,$2,'research',clock_timestamp()) AS allowed",
  [scope.workspaceId,scope.recordId])).rows[0].allowed,true,'synthetic consent setup must allow research before expiry');
 return grant;
}
async function reviseAuthority(entry,kind,patch={}){
 const source=kind==='evidence'?entry.evidenceCommand:entry.grantCommand,previous=kind==='evidence'?entry.evidenceReceipt:entry.grantReceipt;
 const command={...source,operationId:randomUUID(),revision:String(BigInt(previous.revision)+1n),expectedFingerprint:previous.fingerprint,...patch};
 const name=kind==='evidence'?'record_lifecycle_evidence':'record_lifecycle_operator_grant';
 return {command,receipt:(await admin.query('SELECT garden_control.'+name+'($1::jsonb,$2::text) AS result',
  [JSON.stringify(command),'synthetic-lifecycle-authority-reviewer'])).rows[0].result};
}
async function retainedState(extraTables=[]){
 const tables=['garden_control.audit_events','garden_control.audit_heads',...PRIVATE.map(n=>'garden_private.'+n),...CONTROL.map(n=>'garden_control.'+n),...extraTables];
 return(await admin.query(tables.map(table=>`SELECT '${table}' AS table_name,count(*)::text AS count,
  encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text COLLATE "C"),''),'UTF8')),'hex') AS sha256
  FROM ${table} AS r`).join(' UNION ALL ')+' ORDER BY table_name')).rows;
}
async function operationState(operationId){
 return(await admin.query(`SELECT
  (SELECT count(*)::integer FROM garden_control.lifecycle_operation_registry WHERE operation_id=$1) AS operations,
  (SELECT count(*)::integer FROM garden_private.lifecycle_control_events WHERE operation_id=$1) AS events,
  (SELECT count(*)::integer FROM garden_private.lifecycle_control_payloads p JOIN garden_private.lifecycle_control_events e USING(workspace_id,control_id,revision) WHERE e.operation_id=$1) AS payloads,
  (SELECT count(*)::integer FROM garden_control.audit_events WHERE event_text::jsonb->>'requestId'=$1::text) AS audit`,[operationId])).rows[0];
}
async function noCommit(operationId){assert.deepEqual(await operationState(operationId),{operations:0,events:0,payloads:0,audit:0});}
async function scopeCount(scope){return(await admin.query(`SELECT count(*)::integer AS n FROM garden_private.lifecycle_control_events
 WHERE workspace_id=$1 AND record_id=$2 AND record_revision=$3`,[scope.workspaceId,scope.recordId,scope.recordRevision])).rows[0].n;}
async function holdAudit(workspaceId){
 const client=await admin.connect();
 try{await client.query('BEGIN');assert.equal((await client.query('SELECT workspace_id FROM garden_control.audit_heads WHERE workspace_id=$1 FOR UPDATE',[workspaceId])).rowCount,1);return client;}
 catch(error){try{await client.query('ROLLBACK');}finally{client.release();}throw error;}
}
async function waitForBlocked(functionName,{application='garden_controls_lifecycle_admin_ci',minimum=1}={}){
 const deadline=Date.now()+5000;
 do{
  const rows=(await admin.query(`SELECT pid,query_start,clock_timestamp() AS observed_at FROM pg_stat_activity
   WHERE application_name=$1 AND wait_event_type='Lock' AND position($2 in query)>0`,[application,functionName])).rows;
  if(rows.length>=minimum)return rows[0];
  await new Promise(resolve=>setTimeout(resolve,15));
 }while(Date.now()<deadline);
 throw Error('Expected lifecycle control database lock was not observed');
}
async function afterDeadline(deadline){
 const milliseconds=new Date(deadline).getTime()-Date.now();
 assert.ok(Number.isFinite(milliseconds)&&milliseconds<5000,'only short synthetic admission deadlines may be awaited');
 await admin.query('SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp())))+0.05)',[deadline]);
}
async function holdWorkspace(workspaceId){
 const client=await admin.connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(144729,hashtext($1))',[workspaceId]);return client;}
 catch(error){try{await client.query('ROLLBACK');}finally{client.release();}throw error;}
}
async function release(client){try{await client.query('COMMIT');}finally{client.release();}}
// Mutation guard probes ALWAYS roll back on the pinned client, including when
// the guard unexpectedly permits a statement or an assertion itself fails.
async function rejectedOwnerMutation(sql,args,expected){
 const client=await admin.connect();
 try{await client.query('BEGIN');await assert.rejects(()=>client.query(sql,args),expected);}
 finally{try{await client.query('ROLLBACK');}finally{client.release();}}
}
async function rejectedRuntimeStatement(pool,role,sql,args,expected=deniedSql){
 const client=await pool.connect();
 try{await client.query('BEGIN');await client.query('SET LOCAL ROLE '+role);await assert.rejects(()=>client.query(sql,args),expected);}
 finally{try{await client.query('ROLLBACK');}finally{client.release();}}
}
async function mintTicket(client,p,action,input,{backendPid,transactionId,expiresAt=iso(Date.now()+120000),issuerPool=pools.context_issuer}={}){
 const actual=(await client.query('SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')).rows[0];
 const issued=await transaction(issuerPool,'garden_context_issuer',async issuer=>{
  const result=await issuer.query('SELECT garden_control.issue_lifecycle_control_ticket($1,$2,$3,$4,$5::jsonb,$6::timestamptz,$7,$8::xid8) AS result',
   [p.workspaceId,p.subjectId,'ci',action,JSON.stringify(input),expiresAt,backendPid??actual.backend_pid,transactionId??actual.transaction_id]);
  return result.rows[0].result;
 });
 assert.deepEqual(Object.keys(issued).sort(),['policyTicket','ticket']);assert.match(issued.ticket,/^[0-9a-f]{64}$/);assert.match(issued.policyTicket,/^[0-9a-f]{64}$/);
 return {...issued,...actual};
}
async function retire(ticket,issuerPool=pools.context_issuer){
 return transaction(issuerPool,'garden_context_issuer',client=>client.query('SELECT garden_control.invalidate_lifecycle_control_ticket($1)',[ticket]));
}
async function bind(client,issued){await client.query('SELECT garden_control.bind_lifecycle_control_context($1,$2)',[issued.ticket,issued.policyTicket]);}
async function finishContext(client){
 assert.equal((await client.query('SELECT garden_control.check_lifecycle_control_context() AS admitted')).rows[0].admitted,true);
 await client.query('SELECT garden_control.clear_lifecycle_control_context()');
}
async function preparedCommit(scope,command=ruleCommand(scope),{p=principal(scope.workspaceId),repo=repository(scope.workspaceId),expectedControlRevision='0',expectedFingerprint=null}={}){
 const intent=controlMethodIntent('putRule',{command,expectedControlRevision,expectedFingerprint});
 const input={intent,fingerprint:lifecycleControlIntentFingerprint(p,intent)},prepared=await repo.prepare(p,input,admission());
 return buildControlCommit(p,intent,prepared,Date.now());
}
async function formalRuleCandidate(scope,command,{expectedControlRevision,expectedFingerprint}){
 const p=principal(scope.workspaceId),repo=repository(scope.workspaceId);
 const validIntent=controlMethodIntent('putRule',{command:ruleCommand(scope),expectedControlRevision,expectedFingerprint:null});
 const actual=await repo.prepare(p,{intent:validIntent,fingerprint:lifecycleControlIntentFingerprint(p,validIntent)},admission());
 const intent=controlMethodIntent('putRule',{command,expectedControlRevision,expectedFingerprint});
 // Derive a structurally valid hostile command from an actual current scoped
 // rule grant. SQL must still enforce the existing control identity/kind.
 const authority={...actual.authority,operationId:command.operationId,authorizationId:command.operationId,commandFingerprint:lifecycleControlCommandFingerprint(p,intent)};
 return buildControlCommit(p,intent,{...actual,current:null,authority,intentFingerprint:lifecycleControlIntentFingerprint(p,intent)},Date.now());
}
async function rejectedRawCommit(p,candidate){
 const client=await pools.lifecycle_admin.connect();let ticket;
 try{
  await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_admin');await client.query('SET CONSTRAINTS ALL DEFERRED');
  ticket=await mintTicket(client,p,'commit',candidate);await bind(client,ticket);
  await assert.rejects(()=>client.query('SELECT garden_control.commit_lifecycle_control($1::jsonb)',[JSON.stringify(candidate)]),sqlUnavailable);
 }finally{try{await client.query('ROLLBACK');}finally{client.release();if(ticket)await retire(ticket.ticket);}}
}
function statusRequest(p,scope){const operationId=randomUUID();return {scope,operationId,fingerprint:lifecycleControlReadFingerprint(p,scope,operationId)};}
const repositoryUnknown=error=>unavailable(error)&&error.commitOutcome==='unconfirmed'&&Object.isFrozen(error.recovery);
async function exactOperation(operationId){assert.deepEqual(await operationState(operationId),{operations:1,events:1,payloads:1,audit:1});}
async function freshScope({ws=null,all=true}={}){const workspaceId=ws??await workspace(),scope=await record(workspaceId);const grants=all?await authorities(scope):{};return {scope,grants,p:principal(workspaceId),repo:repository(workspaceId),app:service(workspaceId)};}
function assertControlResult(p,commit,value){
 const result=validateControlResult(p,controlRecovery(commit),value,commit);
 assert.equal(result.receipt.committed,true);assert.equal(result.receipt.effectsVerified,false);assert.deepEqual(result.operation,commit);
 for(const child of [result,result.record,result.operation,result.operation.intent,result.receipt,result.receipt.scope])assert.ok(Object.isFrozen(child));
 for(const key of ['erased','exported','deliveryStopped','removalQueued','purgeAuthorized','fulfilled'])assert.equal(Object.hasOwn(result.receipt,key),false);
 return result;
}

try{
 for(const [alias,capability] of Object.entries(CAPABILITIES))await login(alias,capability);
 const W=await workspace(),OTHER=await workspace(),P=principal(W),repo=repository(W),app=service(W),scope=await record(W);
 const original=ruleCommand(scope),initialIntent=controlMethodIntent('putRule',{command:original,expectedControlRevision:'0',expectedFingerprint:null});
 await denied(()=>repo.prepare(P,{intent:initialIntent,fingerprint:lifecycleControlIntentFingerprint(P,initialIntent)},admission()));
 await noCommit(original.operationId);
 check('research membership, read permission and reviewed consent alone cannot create a retention control');

 const ruleAuthority=await authority(scope,'lifecycle.retention-rule');
 const command=await preparedCommit(scope,original),first=assertControlResult(P,command,await repo.commit(P,command,admission()));
 assert.deepEqual(await operationState(original.operationId),{operations:1,events:1,payloads:1,audit:1});
 await denied(()=>app.status(H('alice'),{scope}));await denied(()=>app.recover(H('alice'),controlRecovery(command)));
 await authority(scope,'lifecycle.inspect');
 assert.deepEqual(await app.recover(H('alice'),controlRecovery(command)),first);
 check('a scoped write grant commits one immutable control and one succeeded audit event but never implies independent inspection authority');

 const later=await preparedCommit(scope,original),retry=await repo.commit(P,later,admission());
 assert.equal(later.fingerprint,command.fingerprint);assert.deepEqual(retry,first);assert.equal(retry.receipt.recordedAt,first.receipt.recordedAt);
 assert.deepEqual(await operationState(original.operationId),{operations:1,events:1,payloads:1,audit:1});
 const changed=ruleCommand(scope,{...original,retainUntil:iso(Date.parse(original.retainUntil)+1000)});
 await denied(async()=>{const changedCandidate=await preparedCommit(scope,changed);return repo.commit(P,changedCandidate,admission());});
 assert.deepEqual(await operationState(original.operationId),{operations:1,events:1,payloads:1,audit:1});
 check('fresh transport admission and later proposal time preserve the original exact operation receipt; changed reviewed command cannot reuse its ID');

 const versionTwo=ruleCommand(scope,{ruleId:original.ruleId,revision:'2'});
 const next=await preparedCommit(scope,versionTwo,{expectedControlRevision:'1',expectedFingerprint:first.record.fingerprint});
 const second=assertControlResult(P,next,await repo.commit(P,next,admission()));assert.equal(second.receipt.controlRevision,'2');assert.equal(second.receipt.revision,'2');
 assert.deepEqual(await app.recover(H('alice'),controlRecovery(command)),first);
 const status=await app.status(H('alice'),{scope});assert.equal(status.records.length,1);assert.equal(status.records[0].fingerprint,second.record.fingerprint);
 assert.equal(status.controlRevision,'2');assert.equal(status.effectsVerified,false);
 check('rule revision and aggregate-control CAS preserve historical receipts while status reports only the current rule head');

 await authority(scope,'lifecycle.hold-place');await authority(scope,'lifecycle.hold-release');
 const placedInput=holdCommand(scope),held=await app.placeHold(H('alice'),{command:placedInput,expectedControlRevision:'2'});
 const releaseInput=releaseCommand(held.record),released=await app.releaseHold(H('alice'),{scope,command:releaseInput,expectedControlRevision:'3'});
 assert.equal(held.record.revision,'1');assert.equal(released.record.revision,'2');assert.equal(released.receipt.controlRevision,'4');
 assert.deepEqual(released.record.placement,held.record.placement);assert.equal(released.receipt.effectsVerified,false);
 assert.equal((await app.status(H('alice'),{scope})).records.length,2);
 assert.deepEqual(await app.recover(H('alice'),{scope,operationId:placedInput.operationId,fingerprint:held.receipt.fingerprint}),held);
 check('hold release is a separately authorized immutable revision that retains its exact placement and does not claim deletion or restore delivery');

 const unicodeScope=await record(W);await authorities(unicodeScope,{alias:'unicode'});
 const unicodePrincipal=principal(W,'unicode'),unicodeCommand=ruleCommand(unicodeScope),unicodeIntent=controlMethodIntent('putRule',
  {command:unicodeCommand,expectedControlRevision:'0',expectedFingerprint:null});
 const reversed=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse().map(([key,child])=>[key,reversed(child)])):value;
 const sqlDigests=(await admin.query(`SELECT garden_control.lifecycle_control_intent_fingerprint($1,$2,$3::jsonb) AS intent,
  garden_control.lifecycle_control_command_fingerprint($1,$2,$4,$5::jsonb) AS command`,
 [W,unicodePrincipal.subjectId,JSON.stringify(reversed(unicodeIntent)),unicodeIntent.action,JSON.stringify(reversed(unicodeCommand))])).rows[0];
 assert.equal(sqlDigests.intent,lifecycleControlIntentFingerprint(unicodePrincipal,unicodeIntent));
 assert.equal(sqlDigests.command,retentionRuleCommandFingerprint(unicodePrincipal,unicodeCommand));
 const unicodeCandidate=await preparedCommit(unicodeScope,unicodeCommand,{p:unicodePrincipal});
 assert.equal((await admin.query('SELECT garden_control.lifecycle_control_operation_fingerprint($1,$2,$3::jsonb) AS fingerprint',
  [W,unicodePrincipal.subjectId,JSON.stringify(reversed(unicodeCandidate))])).rows[0].fingerprint,unicodeCandidate.fingerprint);
 const unicodeResult=assertControlResult(unicodePrincipal,unicodeCandidate,await repo.commit(unicodePrincipal,reversed(unicodeCandidate),admission()));
 assert.equal((await admin.query('SELECT garden_control.lifecycle_control_result_fingerprint($1::jsonb) AS fingerprint',[JSON.stringify(reversed(unicodeResult))])).rows[0].fingerprint,
  lifecycleControlResultFingerprint(unicodeResult));
 check('actual JSONB canonical intent, command, operation and private result digests agree for reordered keys, quotes, backslashes and Unicode actor identifiers');

 const concurrent=await record(W);await authorities(concurrent);
 const candidates=await Promise.all([preparedCommit(concurrent),preparedCommit(concurrent)]),barrier=await holdWorkspace(W);
 const racing=Promise.allSettled(candidates.map(candidate=>repo.commit(P,candidate,admission())));
 try{await waitForBlocked('bind_lifecycle_control_context',{minimum:2});}finally{await release(barrier);}
 const results=await racing;assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 for(const result of results.filter(r=>r.status==='rejected'))assert.ok(unavailable(result.reason));
 assert.equal(await scopeCount(concurrent),1);assert.equal((await app.status(H('alice'),{scope:concurrent})).controlRevision,'1');
 check('two actual blocked control transactions competing for one aggregate revision converge to exactly one committed control');

 const identical=await record(W);await authorities(identical);const same=await preparedCommit(identical),sameBarrier=await holdWorkspace(W);
 const sameRace=Promise.all([repo.commit(P,same,admission()),repo.commit(P,same,admission())]);
 try{await waitForBlocked('bind_lifecycle_control_context',{minimum:2});}finally{await release(sameBarrier);}
 const [a,b]=await sameRace;assert.deepEqual(a,b);assert.deepEqual(await operationState(same.intent.command.operationId),{operations:1,events:1,payloads:1,audit:1});
 check('identical concurrent commands share the original immutable operation, control revision and audit receipt');

 const otherScope=await record(OTHER);await authorities(otherScope);
 const globalBefore=await retainedState();
 const reused=ruleCommand(otherScope,{operationId:original.operationId});
 await denied(async()=>repository(OTHER).commit(principal(OTHER),await preparedCommit(otherScope,reused),admission()));
 await denied(()=>app.placeHold(H('alice'),{command:holdCommand(scope,{operationId:original.operationId}),expectedControlRevision:'4'}));
 assert.deepEqual(await retainedState(),globalBefore);
 const requester=createLifecycleRequestService({identity,workspaceId:W,isEnabled:()=>true,isIntakeEnabled:()=>true,
  repository:createLifecycleRequestRepository({issuerPool:pools.context_issuer,requesterPool:pools.lifecycle_requester,workspaceId:W,environment:'ci',isEnabled:()=>true})});
 const requesterTables=['lifecycle_request_cases','lifecycle_request_payloads','lifecycle_request_events','lifecycle_request_heads'].map(n=>'garden_private.'+n);
 const requesterBefore=await retainedState(requesterTables),rejectedClaim={operationId:original.operationId,requestId:randomUUID(),kind:'delete',claimedRecordId:scope.recordId};
 let rejectedClaimError;
 // The requester host conservatively reports an unknown outcome after
 // dispatch, even when the fixed repository has rejected and rolled back.
 await assert.rejects(()=>requester.submit(H('alice'),rejectedClaim),error=>{
  rejectedClaimError=error;return error instanceof LifecycleRequestOutcomeUnknownError&&error.code==='lifecycle_request_outcome_unknown'&&
   error.message==='Lifecycle request unavailable'&&Object.isFrozen(error.recovery);
 });
 assert.deepEqual(rejectedClaimError.recovery,{operationId:rejectedClaim.operationId,fingerprint:lifecycleRequestFingerprint(P,rejectedClaim)});
 await assert.rejects(()=>requester.recover(H('alice'),rejectedClaimError.recovery),
  error=>error.code==='lifecycle_request_unavailable'&&error.message==='Lifecycle request unavailable');
 assert.deepEqual(await retainedState(requesterTables),requesterBefore);
 const claimant={operationId:randomUUID(),requestId:randomUUID(),kind:'delete',claimedRecordId:scope.recordId};
 await requester.submit(H('alice'),claimant);
 const controlCollisionBefore=await retainedState(requesterTables);
 await denied(()=>app.placeHold(H('alice'),{command:holdCommand(scope,{operationId:claimant.operationId}),expectedControlRevision:'4'}));
 assert.deepEqual(await retainedState(requesterTables),controlCollisionBefore);
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.lifecycle_operation_registry WHERE operation_id=$1',[claimant.operationId])).rows[0].n,1);
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_private.lifecycle_control_events WHERE operation_id=$1',[claimant.operationId])).rows[0].n,0);
 check('one global immutable operation registry rejects cross-workspace, rule/hold and requester/control ID reuse in both directions');

 const invariant=await freshScope(),invariantHold=await invariant.app.placeHold(H('alice'),{command:holdCommand(invariant.scope),expectedControlRevision:'0'});
 const substitution=ruleCommand(invariant.scope,{ruleId:invariantHold.receipt.controlId,revision:'2'});
 await denied(()=>invariant.app.putRule(H('alice'),{command:substitution,expectedControlRevision:'1',expectedFingerprint:invariantHold.record.fingerprint}));
 await rejectedRawCommit(invariant.p,await formalRuleCandidate(invariant.scope,substitution,{expectedControlRevision:'1',expectedFingerprint:invariantHold.record.fingerprint}));
 const moved=await record(invariant.scope.workspaceId);await authorities(moved);
 const movedCommand=ruleCommand(moved,{ruleId:invariantHold.receipt.controlId,revision:'2'});
 await denied(()=>invariant.app.putRule(H('alice'),{command:movedCommand,expectedControlRevision:'0',expectedFingerprint:invariantHold.record.fingerprint}));
 await rejectedRawCommit(invariant.p,await formalRuleCandidate(moved,movedCommand,{expectedControlRevision:'0',expectedFingerprint:invariantHold.record.fingerprint}));
 await noCommit(movedCommand.operationId);
 assert.equal((await invariant.app.status(H('alice'),{scope:invariant.scope})).records[0].fingerprint,invariantHold.record.fingerprint);
 assert.equal(await scopeCount(invariant.scope),1);assert.equal(await scopeCount(moved),0);
 await noCommit(substitution.operationId);
 // A new current research revision does not move a historical control to it.
 await admin.query("UPDATE garden_private.record_envelopes SET payload='{}' WHERE workspace_id=$1 AND id=$2",[invariant.scope.workspaceId,invariant.scope.recordId]);
 const revisedScope={...invariant.scope,recordRevision:'2'};await authorities(revisedScope);
 const acrossRevision=ruleCommand(revisedScope,{ruleId:invariantHold.receipt.controlId,revision:'2'});
 await denied(()=>invariant.app.putRule(H('alice'),{command:acrossRevision,expectedControlRevision:'0',expectedFingerprint:invariantHold.record.fingerprint}));
 await rejectedRawCommit(invariant.p,await formalRuleCandidate(revisedScope,acrossRevision,{expectedControlRevision:'0',expectedFingerprint:invariantHold.record.fingerprint}));
 await noCommit(acrossRevision.operationId);assert.equal(await scopeCount(revisedScope),0);
 check('an unreleased hold cannot become a retention rule, and an existing control ID cannot move to another record or research revision');

 for(const loss of ['member','read-grant','record-state','record-revision','record-classification']){
  const f=await freshScope(),candidate=await preparedCommit(f.scope);
  if(loss==='member')await admin.query("UPDATE garden_control.access_members SET state='suspended' WHERE workspace_id=$1 AND subject_id=$2",[f.scope.workspaceId,f.p.subjectId]);
  else if(loss==='read-grant')await admin.query('UPDATE garden_control.record_grants SET can_read=false WHERE workspace_id=$1 AND record_id=$2 AND subject_id=$3',[f.scope.workspaceId,f.scope.recordId,f.p.subjectId]);
  else await admin.query('UPDATE garden_private.record_envelopes SET '+(loss==='record-state'?"state='withdrawn'":loss==='record-classification'?"classification='sealed'":"payload='{}'")+' WHERE workspace_id=$1 AND id=$2',[f.scope.workspaceId,f.scope.recordId]);
  await denied(()=>f.repo.commit(f.p,candidate,admission()));await noCommit(candidate.intent.command.operationId);
  await denied(()=>f.app.status(H('alice'),{scope:f.scope}));
 }
 await denied(()=>app.status(H('bob'),{scope}));await denied(()=>app.recover(H('bob'),controlRecovery(command)));
 await denied(()=>app.status(H('alice'),{scope:{...scope,recordId:randomUUID()}}));
 check('actual current membership, research read grant, active classification and latest record revision are required independently of stored lifecycle authority and syntactic IDs');

 for(const change of ['grant','evidence']){
  const f=await freshScope(),candidate=await preparedCommit(f.scope),grant=f.grants['lifecycle.retention-rule'];
  await reviseAuthority(grant,change,{state:change==='grant'?'revoked':'revoked'});
  await denied(()=>f.repo.commit(f.p,candidate,admission()));await noCommit(candidate.intent.command.operationId);
 }
 const changedProof=await freshScope(),oldCandidate=await preparedCommit(changedProof.scope),oldResult=await changedProof.repo.commit(changedProof.p,oldCandidate,admission());
 await reviseAuthority(changedProof.grants['lifecycle.retention-rule'],'grant');
 await denied(()=>changedProof.repo.commit(changedProof.p,oldCandidate,admission()));
 await denied(async()=>changedProof.repo.commit(changedProof.p,await preparedCommit(changedProof.scope,oldCandidate.intent.command),admission()));
 assert.deepEqual(await changedProof.app.recover(H('alice'),controlRecovery(oldCandidate)),oldResult);await exactOperation(oldCandidate.intent.command.operationId);
 check('new or revoked evidence/grant heads deny stale prepared writes and changed-proof retries while independently authorized recovery retains the original receipt');

 const restore=await freshScope(),restoreCandidate=await preparedCommit(restore.scope),restoreResult=await restore.repo.commit(restore.p,restoreCandidate,admission());
 const inspect=restore.grants['lifecycle.inspect'],revoked=await reviseAuthority(inspect,'grant',{state:'revoked'});
 await denied(()=>restore.app.status(H('alice'),{scope:restore.scope}));
 await admin.query('UPDATE garden_control.lifecycle_grant_heads SET revision=1,fingerprint=$3 WHERE workspace_id=$1 AND grant_id=$2',
  [restore.scope.workspaceId,inspect.grantCommand.grantId,inspect.grantReceipt.fingerprint]);
 try{
  await denied(()=>restore.app.status(H('alice'),{scope:restore.scope}));await denied(()=>restore.app.recover(H('alice'),controlRecovery(restoreCandidate)));
 }finally{await admin.query('UPDATE garden_control.lifecycle_grant_heads SET revision=$3,fingerprint=$4 WHERE workspace_id=$1 AND grant_id=$2',
  [restore.scope.workspaceId,inspect.grantCommand.grantId,revoked.receipt.revision,revoked.receipt.fingerprint]);}
 assert.equal(await scopeCount(restore.scope),1);await exactOperation(restoreCandidate.intent.command.operationId);
 check('restoring an older active grant pointer beside its retained revocation cannot resurrect status or historical recovery authority');

 const ancestry=await freshScope(),parent=await record(ancestry.scope.workspaceId);
 const inherited={schemaVersion:1,recordId:ancestry.scope.recordId,basis:'inherits-only',inputs:[parent.recordId],terms:null,subjects:[],purposes:[],reasonDigest:'7'.repeat(64)};
 await admin.query('SELECT garden_control.set_use_policy($1,$2::jsonb,1,$3)',[ancestry.scope.workspaceId,JSON.stringify(inherited),'synthetic-consent-reviewer']);
 const retainedHold=await ancestry.app.placeHold(H('alice'),{command:holdCommand(ancestry.scope),expectedControlRevision:'0'});
 const ancestorUnreviewed={schemaVersion:1,recordId:parent.recordId,basis:'unreviewed',inputs:[],terms:null,subjects:[],purposes:[],reasonDigest:'8'.repeat(64)};
 await admin.query('SELECT garden_control.set_use_policy($1,$2::jsonb,1,$3)',[ancestry.scope.workspaceId,JSON.stringify(ancestorUnreviewed),'synthetic-consent-reviewer']);
 await denied(()=>ancestry.app.status(H('alice'),{scope:ancestry.scope}));
 await denied(()=>ancestry.app.recover(H('alice'),{scope:ancestry.scope,operationId:retainedHold.receipt.operationId,fingerprint:retainedHold.receipt.fingerprint}));
 await denied(()=>ancestry.app.releaseHold(H('alice'),{scope:ancestry.scope,command:releaseCommand(retainedHold.record),expectedControlRevision:'1'}));
 assert.equal(await scopeCount(ancestry.scope),1);await exactOperation(retainedHold.receipt.operationId);
 check('current consent ancestry gates control inspection and release without deleting or releasing a previously recorded hold');

 const auditFailure=await freshScope(),failedCandidate=await preparedCommit(auditFailure.scope),beforeAuditFailure=await retainedState();
 await admin.query(`ALTER TABLE garden_control.audit_events ADD CONSTRAINT lifecycle_control_synthetic_audit_failure CHECK(workspace_id<>'${auditFailure.scope.workspaceId}'::uuid) NOT VALID`);
 try{await denied(()=>auditFailure.repo.commit(auditFailure.p,failedCandidate,admission()));await noCommit(failedCandidate.intent.command.operationId);}
 finally{await admin.query('ALTER TABLE garden_control.audit_events DROP CONSTRAINT lifecycle_control_synthetic_audit_failure');}
 assert.deepEqual(await retainedState(),beforeAuditFailure);
 check('forced audit failure rolls back the global operation, private payload, event and current heads with no succeeded receipt');

 for(const expire of ['grant','evidence']){
  const f=await freshScope({all:false}),deadline=iso(Date.now()+1800),dates={reviewBy:deadline,expiresAt:deadline};
  await authority(f.scope,'lifecycle.retention-rule',expire==='grant'?{grantPatch:dates}:{evidencePatch:dates});
  const candidate=await preparedCommit(f.scope),block=await holdWorkspace(f.scope.workspaceId);
  const outcome=f.repo.commit(f.p,candidate,admission()).then(value=>({value}),error=>({error}));
  try{await waitForBlocked('bind_lifecycle_control_context');await afterDeadline(deadline);}finally{await release(block);}
  assert.ok(unavailable((await outcome).error));await noCommit(candidate.intent.command.operationId);
 }
 check('actual workspace-lock waits recheck grant and evidence expiry using current database time after the wait');

 for(const expire of ['reviewBy','expiresAt']){
  const f=await freshScope(),deadline=iso(Date.now()+1800),patch=expire==='reviewBy'?{reviewBy:deadline}:
   {reviewBy:deadline,expiresAt:deadline,retainUntil:iso(Date.now()-1000),disposeBy:deadline};
  const candidate=await preparedCommit(f.scope,ruleCommand(f.scope,patch)),block=await holdAudit(f.scope.workspaceId);
  const outcome=f.repo.commit(f.p,candidate,admission()).then(value=>({value}),error=>({error}));
  try{await waitForBlocked('commit_lifecycle_control');await afterDeadline(deadline);}finally{await release(block);}
  assert.ok(unavailable((await outcome).error));await noCommit(candidate.intent.command.operationId);
 }
 check('a command review or validity deadline passing inside an actual audit-head wait prevents the control transaction from committing');

 const expiry=await freshScope(),expiryCandidate=await preparedCommit(expiry.scope);
 await denied(()=>expiry.repo.commit(expiry.p,expiryCandidate,admission({expiresAt:iso(Date.now()-1000)})));
 await noCommit(expiryCandidate.intent.command.operationId);
 const rawExpired=await pools.lifecycle_admin.connect();
 try{await rawExpired.query('BEGIN');await rawExpired.query('SET LOCAL ROLE garden_lifecycle_admin');
  await assert.rejects(()=>mintTicket(rawExpired,expiry.p,'commit',expiryCandidate,{expiresAt:iso(Date.now()-1000)}),sqlUnavailable);
 }finally{await rawExpired.query('ROLLBACK');rawExpired.release();}
 check('both repository preflight and the actual issuer reject an expired UV admission deadline despite a callback returning true');

 for(const phase of ['commit','status']){
  const f=await freshScope(),candidate=await preparedCommit(f.scope);if(phase==='status')await f.repo.commit(f.p,candidate,admission());
  const client=await pools.lifecycle_admin.connect();let ticket;
  try{
   await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_admin');await client.query('SET CONSTRAINTS ALL DEFERRED');
   const deadline=iso(Date.now()+1300),input=phase==='commit'?candidate:statusRequest(f.p,f.scope);
   ticket=await mintTicket(client,f.p,phase,input,{expiresAt:deadline});await bind(client,ticket);
   const sql=phase==='commit'?'commit_lifecycle_control':'lifecycle_control_status';
   await client.query('SELECT garden_control.'+sql+'($1::jsonb)',[JSON.stringify(input)]);await finishContext(client);
   await afterDeadline(deadline);await assert.rejects(()=>client.query('COMMIT'),sqlUnavailable);
  }finally{try{await client.query('ROLLBACK');}finally{client.release();if(ticket)await retire(ticket.ticket);}}
  if(phase==='commit')await noCommit(candidate.intent.command.operationId);else await exactOperation(candidate.intent.command.operationId);
 }
 check('deferred COMMIT admission rejects expired completed write and read contexts even after the fixed context-clear statement');

 for(const end of ['COMMIT','ROLLBACK']){
  const f=await freshScope(),input={intent:controlMethodIntent('putRule',{command:ruleCommand(f.scope),expectedControlRevision:'0',expectedFingerprint:null})};
  input.fingerprint=lifecycleControlIntentFingerprint(f.p,input.intent);const client=await pools.lifecycle_admin.connect();let ticket;
  try{
   await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_admin');ticket=await mintTicket(client,f.p,'prepare',input);await bind(client,ticket);
   await client.query('SELECT garden_control.prepare_lifecycle_control($1::jsonb)',[JSON.stringify(input)]);await finishContext(client);await client.query(end);
   // Deliberately omit retirement: the actual connection survives, but its new
   // xid must never redeem the still-retained pair, including after rollback.
   await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_admin');
   const binding=(await client.query('SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')).rows[0];
   assert.equal(binding.backend_pid,ticket.backend_pid);assert.notEqual(binding.transaction_id,ticket.transaction_id);
   await assert.rejects(()=>bind(client,ticket),sqlUnavailable);
  }finally{try{await client.query('ROLLBACK');}finally{client.release();if(ticket)await retire(ticket.ticket);}}
 }
 const wrongPair=await freshScope(),pairClients=await Promise.all([pools.lifecycle_admin.connect(),pools.lifecycle_admin.connect()]),tokens=[];
 try{
  for(const client of pairClients){await client.query('BEGIN');await client.query('SET LOCAL ROLE garden_lifecycle_admin');tokens.push(await mintTicket(client,wrongPair.p,'status',statusRequest(wrongPair.p,wrongPair.scope)));}
  await assert.rejects(()=>bind(pairClients[0],{...tokens[0],policyTicket:tokens[1].policyTicket}),sqlUnavailable);
  await assert.rejects(()=>bind(pairClients[1],tokens[0]),sqlUnavailable);
 }finally{for(const client of pairClients){try{await client.query('ROLLBACK');}finally{client.release();}}for(const token of tokens)await retire(token.ticket);}
 check('actual PID plus xid8 and paired-token bindings reject different backends, mismatched policy tickets and same-connection replay after commit or rollback even without retirement');

 const lost=await freshScope(),lostCandidate=await preparedCommit(lost.scope);let dropped=false,failure;
 const lostRepository=repository(lost.scope.workspaceId,{adminPool:interceptedPool(pools.lifecycle_admin,async(client,sql,args)=>{
  const result=await client.query(sql,args);if(sql==='COMMIT'&&!dropped){dropped=true;throw Error(CANARY+'-lost-commit-ack');}return result;
 })});
 await assert.rejects(()=>lostRepository.commit(lost.p,lostCandidate,admission()),error=>{failure=error;return repositoryUnknown(error);});
 assert.equal(dropped,true);assert.deepEqual(failure.recovery,controlRecovery(lostCandidate));await exactOperation(lostCandidate.intent.command.operationId);
 const recovered=await lost.app.recover(H('alice'),failure.recovery);assertControlResult(lost.p,lostCandidate,recovered);await exactOperation(lostCandidate.intent.command.operationId);
 check('a real committed write whose connection acknowledgement is lost returns only its exact recovery handle and recovers one original operation without another mutation');

 const material=await freshScope(),materialCandidate=await preparedCommit(material.scope),materialResult=await material.repo.commit(material.p,materialCandidate,admission());
 const materialCoordinate=[material.scope.workspaceId,materialResult.receipt.controlId,materialResult.receipt.revision];
 const savedPayload=(await admin.query('SELECT record,operation FROM garden_private.lifecycle_control_payloads WHERE workspace_id=$1 AND control_id=$2 AND revision=$3',materialCoordinate)).rows[0];
 assert.ok(savedPayload);const materialBefore=await operationState(materialCandidate.intent.command.operationId);
 // Intentional loss of one disposable private fixture, unlike the rollback-only
 // immutability probes. Its exact payload is restored in finally.
 await admin.query('DELETE FROM garden_private.lifecycle_control_payloads WHERE workspace_id=$1 AND control_id=$2 AND revision=$3',materialCoordinate);
 try{
  await denied(()=>material.app.status(H('alice'),{scope:material.scope}));
  await denied(()=>material.app.recover(H('alice'),controlRecovery(materialCandidate)));
  await denied(()=>material.repo.commit(material.p,materialCandidate,admission()));
  await denied(()=>preparedCommit(material.scope,materialCandidate.intent.command));
  assert.deepEqual(await operationState(materialCandidate.intent.command.operationId),{...materialBefore,payloads:0});
 }finally{await admin.query('INSERT INTO garden_private.lifecycle_control_payloads(workspace_id,control_id,revision,record,operation) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',
  [...materialCoordinate,JSON.stringify(savedPayload.record),JSON.stringify(savedPayload.operation)]);}
 assert.deepEqual(await material.app.recover(H('alice'),controlRecovery(materialCandidate)),materialResult);
 await admin.query("UPDATE garden_private.lifecycle_control_payloads SET record=jsonb_set(record,'{fingerprint}',to_jsonb($4::text)) WHERE workspace_id=$1 AND control_id=$2 AND revision=$3",[...materialCoordinate,'d'.repeat(64)]);
 try{
  await denied(()=>material.app.status(H('alice'),{scope:material.scope}));await denied(()=>material.app.recover(H('alice'),controlRecovery(materialCandidate)));
  await denied(()=>material.repo.commit(material.p,materialCandidate,admission()));await exactOperation(materialCandidate.intent.command.operationId);
 }finally{await admin.query('UPDATE garden_private.lifecycle_control_payloads SET record=$4::jsonb,operation=$5::jsonb WHERE workspace_id=$1 AND control_id=$2 AND revision=$3',
  [...materialCoordinate,JSON.stringify(savedPayload.record),JSON.stringify(savedPayload.operation)]);}
 check('missing or modified separately erasable payload denies reads and exact replay without recreating material or manufacturing another operation/audit');

 const headBefore=await retainedState();
 const headConstraint=(await admin.query(`SELECT conname FROM pg_constraint WHERE conrelid='garden_private.lifecycle_control_heads'::regclass
  AND contype='f' AND confrelid='garden_private.lifecycle_control_events'::regclass`)).rows;
 assert.equal(headConstraint.length,1);
 await rejectedOwnerMutation('UPDATE garden_private.lifecycle_control_heads SET fingerprint=$3 WHERE workspace_id=$1 AND control_id=$2',
  [W,first.receipt.controlId,'f'.repeat(64)],error=>error.code==='23503'&&error.table==='lifecycle_control_heads'&&error.constraint===headConstraint[0].conname);
 assert.deepEqual(await retainedState(),headBefore);
 const savedHead=(await admin.query('SELECT revision::text,fingerprint FROM garden_private.lifecycle_control_heads WHERE workspace_id=$1 AND control_id=$2',[W,first.receipt.controlId])).rows[0];
 await admin.query('UPDATE garden_private.lifecycle_control_heads SET revision=1,fingerprint=$3 WHERE workspace_id=$1 AND control_id=$2',[W,first.receipt.controlId,first.record.fingerprint]);
 try{
  await denied(()=>app.status(H('alice'),{scope}));await denied(()=>preparedCommit(scope));
  // An independently authorized exact immutable operation read remains a
  // historical receipt; it does not repair or promote the corrupt head.
  assert.deepEqual(await app.recover(H('alice'),controlRecovery(command)),first);
 }finally{await admin.query('UPDATE garden_private.lifecycle_control_heads SET revision=$3,fingerprint=$4 WHERE workspace_id=$1 AND control_id=$2',
  [W,first.receipt.controlId,savedHead.revision,savedHead.fingerprint]);}
 const savedScopeHead=(await admin.query('SELECT control_revision::text,fingerprint FROM garden_private.lifecycle_control_scope_heads WHERE workspace_id=$1 AND record_id=$2 AND record_revision=$3',
  [W,scope.recordId,scope.recordRevision])).rows[0];
 await admin.query('UPDATE garden_private.lifecycle_control_scope_heads SET control_revision=1,fingerprint=$4 WHERE workspace_id=$1 AND record_id=$2 AND record_revision=$3',
  [W,scope.recordId,scope.recordRevision,command.fingerprint]);
 try{await denied(()=>app.status(H('alice'),{scope}));await denied(()=>preparedCommit(scope));}
 finally{await admin.query('UPDATE garden_private.lifecycle_control_scope_heads SET control_revision=$4,fingerprint=$5 WHERE workspace_id=$1 AND record_id=$2 AND record_revision=$3',
  [W,scope.recordId,scope.recordRevision,savedScopeHead.control_revision,savedScopeHead.fingerprint]);}
 assert.deepEqual(await retainedState(),headBefore);
 check('exact head FKs reject altered digests and older valid control/aggregate pointers beside newer receipts cannot authorize current status or preparation; explicit historical recovery stays historical');

 for(const phase of ['commit','status','recover']){
  const f=await freshScope(),candidate=await preparedCommit(f.scope);if(phase!=='commit')await f.repo.commit(f.p,candidate,admission());
  const grant=f.grants[phase==='commit'?'lifecycle.retention-rule':'lifecycle.inspect'];let revokedDuringFinish=false;
  const guarded=repository(f.scope.workspaceId,{issuerPool:interceptedPool(pools.context_issuer,async(client,sql,args)=>{
   if(sql.includes('finish_lifecycle_control_delivery')&&!revokedDuringFinish){revokedDuringFinish=true;await reviseAuthority(grant,'grant',{state:'revoked'});}
   return client.query(sql,args);
  })});
  const input=phase==='commit'?candidate:phase==='status'?{scope:f.scope}:controlRecovery(candidate);
  await assert.rejects(()=>guarded[phase](f.p,input,admission()),phase==='commit'?repositoryUnknown:unavailable);
  assert.equal(revokedDuringFinish,true);await exactOperation(candidate.intent.command.operationId);
 }
 check('fresh final SQL validation rejects exact selected-grant revocation after main COMMIT; completed writes stay recoverable and reads release no result');

 for(const kind of ['grant','evidence','consent','representative']){
  for(const boundary of ['before-finish','after-finish']){
   const f=await freshScope({all:false});await authority(f.scope,'lifecycle.retention-rule');
   const candidate=await preparedCommit(f.scope);await f.repo.commit(f.p,candidate,admission());
   const deadline=iso(Date.now()+1800);
   const dates={reviewBy:deadline,expiresAt:deadline};
   await authority(f.scope,'lifecycle.inspect',kind==='grant'?{grantPatch:dates}:kind==='evidence'?{evidencePatch:dates}:{});
   if(kind==='consent'||kind==='representative')await personalConsent(f.scope,{guardian:kind==='representative',deadline});
   let finishStarted=false,finishCommitted=false,waited=false;
   const guarded=repository(f.scope.workspaceId,{issuerPool:interceptedPool(pools.context_issuer,async(client,sql,args)=>{
    if(sql.includes('finish_lifecycle_control_delivery')){finishStarted=true;if(boundary==='before-finish'){await afterDeadline(deadline);waited=true;}}
    const result=await client.query(sql,args);if(sql==='COMMIT'&&finishStarted)finishCommitted=true;return result;
   })});
   const admit=admission({before:async()=>{if(boundary==='after-finish'&&finishCommitted&&!waited){waited=true;await afterDeadline(deadline);}}});
   await denied(()=>guarded.status(f.p,{scope:f.scope},admit));assert.equal(waited,true);assert.equal(finishStarted,true);
   if(boundary==='after-finish')assert.equal(finishCommitted,true);await exactOperation(candidate.intent.command.operationId);
  }
 }
 check('current grant, evidence, personal consent and representative authority deadlines survive cleanup and deny delivery after the final asynchronous identity admission, independently of fresh UV');

 for(const [method,kind] of [['status','grant'],['recover','consent'],['putRule','representative']]){
  const f=await freshScope({all:false});await authority(f.scope,'lifecycle.retention-rule');
  let candidate,controlInput;if(method==='putRule')controlInput=ruleCommand(f.scope);
  else{candidate=await preparedCommit(f.scope);await f.repo.commit(f.p,candidate,admission());}
  const deadline=iso(Date.now()+1800);await authority(f.scope,'lifecycle.inspect',kind==='grant'?{grantPatch:{reviewBy:deadline,expiresAt:deadline}}:{});
  if(kind!=='grant')await personalConsent(f.scope,{guardian:kind==='representative',deadline});
  const actual=repository(f.scope.workspaceId,{wire:true});let returned=false,expiredInHost=false;
  const wrapped=Object.fromEntries(['prepare','commit','status','recover'].map(phase=>[phase,async(...args)=>{
   const value=await actual[phase](...args);if(phase===(method==='putRule'?'commit':method))returned=true;return value;
  }]));
  const lastIdentity={viewer:async function(headers){if(returned&&!expiredInHost){expiredInHost=true;await afterDeadline(deadline);}return identity.viewer(headers);},
   authorizePrivileged:identity.authorizePrivileged};
  const composed=service(f.scope.workspaceId,{identity:lastIdentity,repository:wrapped});
  const input=method==='putRule'?{command:controlInput,expectedControlRevision:'0',expectedFingerprint:null}:method==='status'?{scope:f.scope}:controlRecovery(candidate);
  await (method==='putRule'?uncertain:denied)(()=>composed[method](H('alice'),input));
  assert.equal(returned,true);assert.equal(expiredInHost,true);assert.equal((await identity.viewer(H('alice'))).privilegedAssurance,true);
  await exactOperation(method==='putRule'?controlInput.operationId:candidate.intent.command.operationId);
 }
 check('actual service plus repository composition carries SQL authority expiry through the service final identity await for status, recovery and completed-write acknowledgement');

 for(const phase of ['commit','status']){
  for(const loss of ['feature','identity','credential']){
   const f=await freshScope(),candidate=await preparedCommit(f.scope);if(phase==='status')await f.repo.commit(f.p,candidate,admission());
   const prior={...profiles.get('alice')};let enabled=true,observed=false;
   const guarded=repository(f.scope.workspaceId,{wire:true,adminPool:interceptedPool(pools.lifecycle_admin,async(client,sql,args)=>{
    const result=await client.query(sql,args);
    if(sql.includes(phase==='commit'?'commit_lifecycle_control':'lifecycle_control_status')){
     observed=true;if(loss==='feature')enabled=false;else profiles.set('alice',{...prior,...(loss==='identity'?{id:prior.id+'-changed'}:{assuranceCredentialId:prior.assuranceCredentialId+'-changed'})});
    }return result;
   })});
   const composed=service(f.scope.workspaceId,{repository:guarded,isEnabled:()=>enabled});
   try{
    await denied(()=>phase==='status'?composed.status(H('alice'),{scope:f.scope}):composed.putRule(H('alice'),
     {command:candidate.intent.command,expectedControlRevision:'0',expectedFingerprint:null}));
    assert.equal(observed,true);if(phase==='commit')await noCommit(candidate.intent.command.operationId);else await exactOperation(candidate.intent.command.operationId);
   }finally{profiles.set('alice',prior);}
  }
 }
 const inspectionOnly=service(W,{isAdministrationEnabled:()=>false});assert.equal((await inspectionOnly.status(H('alice'),{scope})).controlRevision,'4');
 await denied(()=>inspectionOnly.putRule(H('alice'),{command:ruleCommand(scope),expectedControlRevision:'4',expectedFingerprint:null}));
 check('actual host composition rolls back late feature/identity/UV changes and permits separately authorized inspection when only control administration is closed');

 const bounded=await freshScope(),boundedHold=await bounded.app.placeHold(H('alice'),{command:holdCommand(bounded.scope),expectedControlRevision:'0'});
 let firstBoundedRule;
 for(let index=1;index<64;index++){
  const value=await bounded.app.putRule(H('alice'),{command:ruleCommand(bounded.scope),expectedControlRevision:String(index),expectedFingerprint:null});
  if(index===1)firstBoundedRule=value;
 }
 assert.equal((await bounded.app.status(H('alice'),{scope:bounded.scope})).records.length,64);
 const sixtyFifth=ruleCommand(bounded.scope);await denied(()=>bounded.app.putRule(H('alice'),{command:sixtyFifth,expectedControlRevision:'64',expectedFingerprint:null}));
 await noCommit(sixtyFifth.operationId);assert.equal(await scopeCount(bounded.scope),64);
 const releasedAtCap=await bounded.app.releaseHold(H('alice'),{scope:bounded.scope,command:releaseCommand(boundedHold.record),expectedControlRevision:'64'});
 assert.equal(releasedAtCap.receipt.controlRevision,'65');assert.equal(releasedAtCap.record.revision,'2');
 const revisedAtCap=await bounded.app.putRule(H('alice'),{command:ruleCommand(bounded.scope,{ruleId:firstBoundedRule.receipt.controlId,revision:'2'}),expectedControlRevision:'65',expectedFingerprint:firstBoundedRule.record.fingerprint});
 assert.equal(revisedAtCap.receipt.controlRevision,'66');assert.equal((await bounded.app.status(H('alice'),{scope:bounded.scope})).records.length,64);
 check('the persisted 64-control bound denies a 65th ID without operation/audit effects while existing hold release and rule revision remain available');

 const consentClock=Date.now(),consentFixture=await freshScope({all:false}),consentBase=await personalConsent(consentFixture.scope,{deadline:iso(consentClock+2000)});
 const longAlternative={...consentBase,id:randomUUID(),expiresAt:iso(consentClock+10000)};
 await admin.query('SELECT garden_control.record_consent_grant($1,$2::jsonb,$3)',[consentFixture.scope.workspaceId,JSON.stringify(longAlternative),'synthetic-consent-reviewer']);
 const deadlineOf=async()=>new Date((await admin.query('SELECT garden_control.lifecycle_control_consent_deadline($1,$2,$3::timestamptz,$4::timestamptz) AS deadline',
  [consentFixture.scope.workspaceId,consentFixture.scope.recordId,iso(consentClock),iso(consentClock+60000)])).rows[0].deadline).getTime();
 assert.equal(await deadlineOf(),consentClock+10000);
 const secondSubject=CANARY+'-second-person',secondPolicy={schemaVersion:1,recordId:consentFixture.scope.recordId,basis:'consent-required',inputs:[],terms:consentBase.terms,
  subjects:[{subjectId:consentBase.subjectId,authority:'self'},{subjectId:secondSubject,authority:'self'}],purposes:[],reasonDigest:'9'.repeat(64)};
 await admin.query('SELECT garden_control.set_use_policy($1,$2::jsonb,2,$3)',[consentFixture.scope.workspaceId,JSON.stringify(secondPolicy),'synthetic-consent-reviewer']);
 const secondGrant={...consentBase,id:randomUUID(),subjectId:secondSubject,grantorId:secondSubject,expiresAt:iso(consentClock+5000)};
 await admin.query('SELECT garden_control.record_consent_grant($1,$2::jsonb,$3)',[consentFixture.scope.workspaceId,JSON.stringify(secondGrant),'synthetic-consent-reviewer']);
 assert.equal(await deadlineOf(),consentClock+5000);
 const future={...secondGrant,id:randomUUID(),validFrom:iso(consentClock+1000),expiresAt:iso(consentClock+30000)};
 await admin.query('SELECT garden_control.record_consent_grant($1,$2::jsonb,$3)',[consentFixture.scope.workspaceId,JSON.stringify(future),'synthetic-consent-reviewer']);
 assert.equal(await deadlineOf(),consentClock+5000);
 await admin.query('SELECT garden_control.withdraw_consent_grant($1,$2,$3,$4)',[consentFixture.scope.workspaceId,secondGrant.id,'a'.repeat(64),'synthetic-consent-reviewer']);
 await assert.rejects(deadlineOf,sqlUnavailable);
 check('SQL consent deadlines use the longest current alternative per required subject then the earliest required-subject expiry, excluding future and withdrawn grants');

 const rls=(await admin.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='garden_private' AND c.relname=ANY($1::text[])) OR (n.nspname='garden_control' AND c.relname=ANY($2::text[]))`,[PRIVATE,CONTROL])).rows;
 assert.equal(rls.length,PRIVATE.length+CONTROL.length);assert.ok(rls.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
 const callable={
  'garden_control.issue_lifecycle_control_ticket(uuid,text,text,text,jsonb,timestamp with time zone,integer,xid8)':'garden_context_issuer',
  'garden_control.finish_lifecycle_control_delivery(text,text)':'garden_context_issuer',
  'garden_control.invalidate_lifecycle_control_ticket(text)':'garden_context_issuer',
  'garden_control.bind_lifecycle_control_context(text,text)':'garden_lifecycle_admin',
  'garden_control.prepare_lifecycle_control(jsonb)':'garden_lifecycle_admin',
  'garden_control.commit_lifecycle_control(jsonb)':'garden_lifecycle_admin',
  'garden_control.lifecycle_control_status(jsonb)':'garden_lifecycle_admin',
  'garden_control.recover_lifecycle_control(jsonb)':'garden_lifecycle_admin',
  'garden_control.lifecycle_control_delivery()':'garden_lifecycle_admin',
  'garden_control.check_lifecycle_control_context()':'garden_lifecycle_admin',
  'garden_control.clear_lifecycle_control_context()':'garden_lifecycle_admin',
  'garden_control.record_lifecycle_evidence(jsonb,text)':null,
  'garden_control.record_lifecycle_operator_grant(jsonb,text)':null,
  'garden_control.lifecycle_control_scope_snapshot(jsonb)':null,
  'garden_control.lifecycle_control_snapshot(uuid,uuid,bigint)':null,
  'garden_control.lifecycle_control_consent_deadline(uuid,uuid,timestamp with time zone,timestamp with time zone)':null
 };
 for(const [alias,capability] of Object.entries(CAPABILITIES)){
  const client=await pools[alias].connect();try{await assertDatabaseCapability(client,capability);}finally{client.release();}
  for(const [schema,tables] of [['garden_private',PRIVATE],['garden_control',CONTROL]])for(const table of tables){
   await rejectedRuntimeStatement(pools[alias],capability,'SELECT * FROM '+schema+'.'+table+' LIMIT 1',[]);
   await rejectedRuntimeStatement(pools[alias],capability,'DELETE FROM '+schema+'.'+table+' WHERE false',[]);
  }
  for(const [signature,allowed] of Object.entries(callable)){
   assert.equal((await admin.query('SELECT has_function_privilege($1,$2::regprocedure,\'EXECUTE\') AS allowed',[capability,signature])).rows[0].allowed,capability===allowed,capability+' '+signature);
  }
  await rejectedRuntimeStatement(pools[alias],capability,'SELECT garden_control.record_lifecycle_evidence($1::jsonb,$2)',
   [JSON.stringify(ruleAuthority.evidenceCommand),'synthetic-lifecycle-authority-reviewer']);
 }
 let mixedDirections=0;
 for(const [alias,capability] of Object.entries(CAPABILITIES).filter(([name])=>name!=='lifecycle_admin')){
  for(const [loginName,expected,foreign,pool] of [
   ['garden_controls_lifecycle_admin_ci','garden_lifecycle_admin',capability,pools.lifecycle_admin],
   ['garden_controls_'+alias+'_ci',capability,'garden_lifecycle_admin',pools[alias]]
  ]){
   await admin.query(`GRANT ${foreign} TO ${loginName} WITH INHERIT FALSE, SET FALSE`);
   try{const client=await pool.connect();try{await assert.rejects(()=>assertDatabaseCapability(client,expected),DatabaseCapabilityError);}finally{client.release();}}
   finally{await admin.query(`REVOKE ${foreign} FROM ${loginName}`);}mixedDirections++;
  }
 }
 assert.equal(mixedDirections,2*(RUNTIME_DATABASE_CAPABILITIES.length-1));
 check('all '+RUNTIME_DATABASE_CAPABILITIES.length+' disjoint roles deny raw access to '+rls.length+' forced-RLS tables and owner authority functions; fixed issuer/admin grants and all '+mixedDirections+' new mixed-capability directions are verified');

 const immutableBefore=await retainedState();
 const immutableTables={
  'garden_control.lifecycle_operation_registry':['lifecycle_request_events','lifecycle_authority_evidence','lifecycle_operator_grants','lifecycle_control_events'],
  'garden_control.lifecycle_authority_evidence':['lifecycle_evidence_heads','lifecycle_operator_grants'],
  'garden_control.lifecycle_operator_grants':['lifecycle_grant_heads','lifecycle_control_events'],
  'garden_private.lifecycle_control_events':['lifecycle_control_payloads','lifecycle_control_heads','lifecycle_control_scope_heads']
 };
 for(const [table,children] of Object.entries(immutableTables)){
  const name=table.split('.')[1];assert.ok(immutableBefore.some(row=>row.table_name===table&&BigInt(row.count)>0n));
  await rejectedOwnerMutation('UPDATE '+table+' SET workspace_id=workspace_id WHERE workspace_id=$1',[W],immutableError);
  await rejectedOwnerMutation('DELETE FROM '+table+' WHERE workspace_id=$1',[W],immutableError);
  await rejectedOwnerMutation('TRUNCATE '+table,[],error=>error.code==='0A000'&&error.message==='cannot truncate a table referenced in a foreign key constraint'&&
   children.some(child=>error.detail===`Table "${child}" references "${name}".`));
  await rejectedOwnerMutation('TRUNCATE '+table+' CASCADE',[],immutableError);
 }
 for(const [table,idColumn,coordinate] of [
  ['garden_control.lifecycle_authority_evidence','evidence_id',ruleAuthority.evidenceCommand.evidenceId],
  ['garden_control.lifecycle_operator_grants','grant_id',ruleAuthority.grantCommand.grantId],
  ['garden_private.lifecycle_control_events','control_id',same.intent.command.ruleId]
 ]){
  const constraints=(await admin.query(`SELECT conname FROM pg_constraint WHERE conrelid=$1::regclass AND contype='c'
   AND pg_get_constraintdef(oid) LIKE '%previous_revision IS NOT NULL%' AND pg_get_constraintdef(oid) LIKE '%previous_fingerprint IS NOT NULL%'`,[table])).rows;
  assert.equal(constraints.length,1);
  for(const previous of [[null,'c'.repeat(64)],[1,null],[null,null]]){
   await rejectedOwnerMutation(`INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},to_jsonb(e)||jsonb_build_object(
    'revision',2,'operation_id',$3::uuid,'previous_revision',$4::bigint,'previous_fingerprint',$5::text))).*
    FROM ${table} e WHERE workspace_id=$1 AND ${idColumn}=$2 AND revision=1`,
   [W,coordinate,randomUUID(),...previous],error=>error.code==='23514'&&error.table===table.split('.')[1]&&error.constraint===constraints[0].conname);
  }
 }
 assert.deepEqual(await retainedState(),immutableBefore);
 check('populated immutable operation/evidence/grant/control history rejects exact FK truncate, append-only rewrite/cascade and explicit non-null predecessor probes, all in guaranteed rollback transactions');

 const auditAction={'lifecycle.retention-rule':['lifecycle.control.rule','retention-rule-recorded'],
  'lifecycle.hold-place':['lifecycle.control.hold-place','hold-recorded'],'lifecycle.hold-release':['lifecycle.control.hold-release','hold-release-recorded']};
 for(const ws of workspaces){
  const audit=(await admin.query(`SELECT workspace_id::text AS "workspaceId",sequence::text AS sequence,previous_hash AS "previousHash",hash,event_text AS "eventText"
   FROM garden_control.audit_events ae WHERE workspace_id=$1 ORDER BY ae.sequence`,[ws])).rows;
  verifyAuditPage(audit,{workspaceId:ws,sequence:'0',hash:GENESIS});assert.equal(JSON.stringify(audit).includes(CANARY),false);
  const events=audit.map(row=>({sequence:row.sequence,event:JSON.parse(row.eventText)}));
  const controls=(await admin.query('SELECT control_id,record_id,operation_id,revision::text,action,audit_sequence::text FROM garden_private.lifecycle_control_events WHERE workspace_id=$1',[ws])).rows;
  assert.equal(events.filter(row=>row.event.action.startsWith('lifecycle.control.')).length,controls.length);
  for(const control of controls){
   const event=events.find(row=>row.sequence===control.audit_sequence)?.event;assert.ok(event);
   assert.deepEqual(event.subject,{kind:'lifecycle-control',reference:control.control_id,version:control.revision});
   assert.equal(event.requestId,control.operation_id);assert.equal(event.action,auditAction[control.action][0]);
   assert.equal(event.reasonCode,auditAction[control.action][1]);assert.equal(event.outcome,'succeeded');assert.equal(JSON.stringify(event).includes(control.record_id),false);
  }
  for(const [table,key,action,reason] of [['lifecycle_authority_evidence','evidence_id','lifecycle.authority.evidence','authority-evidence-recorded'],
   ['lifecycle_operator_grants','grant_id','lifecycle.authority.grant','operator-grant-recorded']]){
   const revisions=(await admin.query('SELECT '+key+' AS id,operation_id,revision::text,audit_sequence::text FROM garden_control.'+table+' WHERE workspace_id=$1',[ws])).rows;
   assert.equal(events.filter(row=>row.event.action===action).length,revisions.length);
   for(const revision of revisions){const event=events.find(row=>row.sequence===revision.audit_sequence)?.event;assert.ok(event);
    assert.deepEqual(event.subject,{kind:'lifecycle-authority',reference:revision.id,version:revision.revision});
    assert.equal(event.requestId,revision.operation_id);assert.equal(event.outcome,'succeeded');assert.equal(event.reasonCode,reason);}
  }
 }
 await rejectedOwnerMutation("SELECT garden_control.append_audit_event($1,'subject',$2,'lifecycle-control',$3,1,'lifecycle.control.erase',$4)",
  [W,P.subjectId,first.receipt.controlId,randomUUID()],error=>error.code==='P0001'&&error.message==='Unregistered audit action');
 await rejectedOwnerMutation("SELECT garden_control.append_audit_event($1,'subject',$2,'record',$3,1,'lifecycle.control.rule',$4)",
  [W,P.subjectId,first.receipt.controlId,randomUUID()],error=>error.code==='P0001'&&error.message==='Audit subject mismatch');
 for(const table of ['lifecycle_control_tickets','lifecycle_control_contexts','lifecycle_control_delivery_checks']){
  assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.'+table)).rows[0].n,0);
 }
 assert.equal((await admin.query('SELECT count(*)::integer AS n FROM garden_control.policy_tickets WHERE workspace_id=ANY($1::uuid[])',[workspaces])).rows[0].n,0);
 check('every succeeded control/authority event has one verified private audit binding, fixed action/subject semantics, no raw subject or target record and no pooled delivery/ticket residue');

 await mkdir('data-evidence',{recursive:true});
 await writeFile('data-evidence/lifecycle-controls-results.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,checks,
  real_postgresql:true,synthetic_identity:true,synthetic_authority:true,synthetic_consent:true,hosted_deployment_verified:false,
  legal_authority_verified:false,physical_erasure_verified:false,export_delivery_verified:false,live_tombstone_verified:false,
  independent_restore_anchor:false,full_backup_restore_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' real PostgreSQL lifecycle control checks');
}finally{for(const pool of Object.values(pools))await pool.end();await admin.end();}
