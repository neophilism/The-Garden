import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifecycleControlRepository} from '../../apps/research/access/lifecycle-control-repository.mjs';
import {createLifecycleControlService} from '../../apps/research/access/lifecycle-controls.mjs';
import {controlMethodIntent,lifecycleControlIntentFingerprint,lifecycleControlCommandFingerprint,
 buildControlCommit,controlRecovery,controlRecordId,controlRecordRevision,lifecycleControlResultFingerprint} from '../../packages/domain/src/lifecycle/control-storage.mjs';
import {proposeRetentionRule,proposeHold,proposeHoldRelease} from '../../packages/domain/src/lifecycle/retention.mjs';
import {roleProbe} from '../security/database-role-fixture.mjs';

const id=n=>'20000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const NOW=Date.now(),iso=value=>new Date(value).toISOString(),copy=value=>structuredClone(value);
const W=id(1),RECORD=id(2),OP=id(3),RULE=id(4),EVIDENCE=id(5);
const actor=Object.freeze({workspaceId:W,subjectId:'synthetic-retention-operator'});
const SCOPE=Object.freeze({workspaceId:W,recordId:RECORD,recordRevision:'1',classification:'restricted_research'});
const CANARY='PRIVATE-RETENTION-REPOSITORY-CANARY';
const unavailable=error=>error?.code==='lifecycle_control_unavailable'&&error.message==='Lifecycle control unavailable'&&!Object.hasOwn(error,'cause');
const known=error=>unavailable(error)&&!Object.hasOwn(error,'commitOutcome');
const unknown=error=>unavailable(error)&&error.commitOutcome==='unconfirmed'&&Object.isFrozen(error.recovery)&&Object.isFrozen(error.recovery.scope);
const command=(patch={})=>({operationId:OP,ruleId:RULE,revision:'1',scope:{...SCOPE},retentionClass:'case_and_rights_policy',basis:'policy',evidenceId:EVIDENCE,
 effectiveAt:iso(NOW-60000),expiresAt:iso(NOW+3600000),reviewBy:iso(NOW+1800000),retainUntil:iso(NOW+600000),disposeBy:iso(NOW+1200000),...patch});
const intent=(patch={})=>controlMethodIntent('putRule',{command:command(),expectedControlRevision:'0',expectedFingerprint:null,...patch});
const prepareRequest=(p=actor,i=intent())=>({intent:i,fingerprint:lifecycleControlIntentFingerprint(p,i)});
const grant=()=>({grantId:id(10),revision:'1',evidenceId:id(11),evidenceRevision:'1',validFrom:iso(NOW-60000),expiresAt:iso(NOW+3600000)});
function prepared(p=actor,i=intent(),g=grant(),current=null,controlRevision='0'){
 return {scope:copy(i.scope),controlRevision,current,grant:g,intentFingerprint:lifecycleControlIntentFingerprint(p,i),
  authority:{workspaceId:p.workspaceId,subjectId:p.subjectId,action:i.action,operationId:i.command.operationId,authorizationId:i.command.operationId,
   authorityEvidenceId:g.evidenceId,authorityRevision:g.revision,validFrom:g.validFrom,expiresAt:g.expiresAt,commandFingerprint:lifecycleControlCommandFingerprint(p,i)}};
}
const commitRequest=(p=actor,i=intent(),r=prepared(p,i))=>buildControlCommit(p,i,r,NOW);
function committed(c=commitRequest(),current=null,controlRevision='1'){
 const record=c.intent.action==='lifecycle.retention-rule'?proposeRetentionRule(c.authority,c.intent.command,NOW).record:
  c.intent.action==='lifecycle.hold-place'?proposeHold(c.authority,c.intent.command,NOW).record:proposeHoldRelease(c.authority,current,c.intent.command,NOW).record;
 const event=record.kind==='retention-rule'?record.event:c.intent.action==='lifecycle.hold-place'?record.placement:record.release;
 return {record,operation:copy(c),receipt:{operationId:c.intent.command.operationId,fingerprint:c.fingerprint,action:c.intent.action,scope:copy(c.intent.scope),
  controlId:controlRecordId(record),revision:controlRecordRevision(record),controlRevision,recordFingerprint:record.fingerprint,
  auditSequence:controlRevision,recordedAt:event.recordedAt,committed:true,effectsVerified:false}};
}

function fixture({roles={},enabled=true,before=null,after=null,seed=null}={}){
 const state={enabled,available:true,identity:true,admissions:0,admissionHook:null,before,after,calls:[],connectionCounter:0,ticketCounter:0,
  minted:new Map(),operations:new Map(),records:new Map(),writes:0,controlRevision:'0',grant:grant(),releaseHook:null,
  deliveryExpiry:iso(NOW+90000),finishExpiry:iso(NOW+90000),authorityCurrent:true};
 if(seed){state.operations.set(seed.receipt.operationId,copy(seed));state.records.set(seed.receipt.controlId,copy(seed.record));state.controlRevision=seed.receipt.controlRevision;}
 const admit=async()=>{state.admissions++;if(state.admissionHook)await state.admissionHook();if(!state.identity)throw Error(CANARY+'-identity');return true;};
 Object.defineProperties(admit,{isAvailable:{value:()=>state.available},expiresAt:{value:iso(NOW+120000)}});Object.freeze(admit);
 function pool(kind){return {async connect(){
  const serial=++state.connectionCounter,client={kind,serial,pid:9000+serial,xid:String(12000+serial),open:false,staged:null,bound:null,mint:null,retire:null,result:null};
  state.calls.push({kind,connect:true,client});if(state.before)await state.before({kind,connect:true,client},state);
  const observe=roleProbe('retention_'+kind+'_login',roles[kind]??{});
  return {async query(sql,args){
   const call={kind,sql,args,client};state.calls.push(call);if(state.before)await state.before(call,state);
   let result=observe(sql,args);
   if(!result){
    result={rows:[]};
    if(sql==='BEGIN')client.open=true;
    else if(sql==='COMMIT'){
     assert.equal(client.open,true);
     if(kind==='admin'&&client.staged){const r=client.staged;state.operations.set(r.receipt.operationId,copy(r));state.records.set(r.receipt.controlId,copy(r.record));state.controlRevision=r.receipt.controlRevision;state.writes++;}
     if(kind==='issuer'&&client.mint)state.minted.set(client.mint.ticket,client.mint);
     if(kind==='issuer'&&client.retire)state.minted.delete(client.retire);
     client.open=false;
    }else if(sql==='ROLLBACK'){client.open=false;client.staged=null;client.retire=null;}
    else if(sql==='SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')result={rows:[{backend_pid:client.pid,transaction_id:client.xid}]};
    else if(sql.includes('issue_lifecycle_control_ticket')){
     const ticket=(++state.ticketCounter).toString(16).padStart(64,'0'),policyTicket=(++state.ticketCounter).toString(16).padStart(64,'0');
     client.mint={ticket,policyTicket,args:[...args]};result={rows:[{result:{ticket,policyTicket}}]};
    }else if(sql.includes('invalidate_lifecycle_control_ticket')){
     assert.equal(state.calls.some(c=>c.kind==='admin'&&c.client.open),false,'retirement follows the main transaction');client.retire=args[0];
    }else if(sql.includes('finish_lifecycle_control_delivery')){
     assert.equal(state.calls.some(c=>c.kind==='admin'&&c.client.open),false,'final validation follows the main transaction');
     const ticket=state.minted.get(args[0]);assert.ok(ticket?.delivery);assert.equal(args[1],ticket.delivery.resultFingerprint);
     if(!state.authorityCurrent)throw Error(CANARY+'-authority-revoked');
     client.retire=args[0];result={rows:[{admission:{expiresAt:state.finishExpiry,resultFingerprint:args[1]}}]};
    }else if(sql.includes('bind_lifecycle_control_context')){
     const t=state.minted.get(args[0]);assert.ok(t,'issuer mint must commit before redemption');assert.equal(args[1],t.policyTicket);
     assert.equal(t.args[6],client.pid);assert.equal(t.args[7],client.xid);client.bound=t;
    }else if(sql.includes('lifecycle_control_delivery()')){
     assert.ok(client.result);const delivery={expiresAt:state.deliveryExpiry,resultFingerprint:lifecycleControlResultFingerprint(client.result)};
     client.bound.delivery=delivery;result={rows:[{admission:delivery}]};
    }else if(sql.includes('check_lifecycle_control_context'))result={rows:[{admitted:true}]};
    else if(sql.includes('clear_lifecycle_control_context'))client.closed=true;
    else if(/(prepare_lifecycle_control|commit_lifecycle_control|lifecycle_control_status|recover_lifecycle_control)/.test(sql)){
     assert.ok(client.bound);const p={workspaceId:client.bound.args[0],subjectId:client.bound.args[1]},input=JSON.parse(args[0]);let value;
     if(sql.includes('prepare_lifecycle_control'))value=prepared(p,input.intent,copy(state.grant),copy(state.records.get(input.intent.command.ruleId??input.intent.command.holdId)??null),state.controlRevision);
     else if(sql.includes('commit_lifecycle_control')){
      const old=state.operations.get(input.intent.command.operationId);
      if(old){assert.equal(old.receipt.fingerprint,input.fingerprint);value=copy(old);}
      else{
       assert.equal(input.intent.expectedControlRevision,state.controlRevision);value=committed(input,state.records.get(input.intent.command.ruleId??input.intent.command.holdId)??null,String(BigInt(state.controlRevision)+1n));client.staged=value;
      }
     }else if(sql.includes('lifecycle_control_status'))value={scope:copy(input.scope),controlRevision:state.controlRevision,records:[...state.records.values()].map(copy),effectsVerified:false};
     else{value=copy(state.operations.get(input.operationId));if(!value||value.receipt.fingerprint!==input.fingerprint)throw Error(CANARY+'-not-found');}
     client.result=copy(value);result={rows:[{result:value}]};
    }
   }
   if(state.after){const replacement=await state.after(call,state,result);if(replacement!==undefined)result=replacement;}
   return result;
  },release(bad){state.calls.push({kind,release:true,bad,client});if(state.releaseHook)state.releaseHook({kind,bad,client});}};
 }};}
 const options={issuerPool:pool('issuer'),adminPool:pool('admin'),workspaceId:W,environment:'ci',isEnabled:()=>state.enabled};
 return {state,admit,options,repository:createLifecycleControlRepository(options)};
}
const mainCommits=state=>state.calls.filter(c=>c.kind==='admin'&&c.sql==='COMMIT');
const retires=state=>state.calls.filter(c=>/(invalidate_lifecycle_control_ticket|finish_lifecycle_control_delivery)/.test(c.sql??''));

test('control repository defaults off and rejects asynchronous or truthy activation before pool access',async()=>{
 for(const flag of [undefined,()=>false,()=>1,async()=>true]){
  const f=fixture(),options={...f.options};if(flag===undefined)delete options.isEnabled;else options.isEnabled=flag;
  await assert.rejects(createLifecycleControlRepository(options).prepare(actor,prepareRequest(),f.admit),known);
  assert.equal(f.state.calls.length,0);assert.equal(f.state.admissions,0);
 }
});
test('factory rejects shared pools, unsupported environment and malformed workspace',()=>{
 const f=fixture();for(const patch of [{adminPool:f.options.issuerPool},{environment:'production'},{environment:'preview'},{workspaceId:'bad'},{isEnabled:true},{issuerPool:{}}]){
  assert.throws(()=>createLifecycleControlRepository({...f.options,...patch}),unavailable);
 }
});
test('actor, scope, intent and exact operation fingerprints are validated before admission or SQL',async()=>{
 for(const p of [{...actor,workspaceId:id(99)},{...actor,subjectId:''},{...actor,subjectId:'two words'},{...actor,admin:true}]){
  const f=fixture();await assert.rejects(f.repository.prepare(p,prepareRequest(),f.admit),known);assert.equal(f.state.calls.length,0);
 }
 for(const input of [null,{...prepareRequest(),headers:{}},{...prepareRequest(),fingerprint:'b'.repeat(64)},
  {...prepareRequest(),intent:{...intent(),expectedControlRevision:0}},
  {...prepareRequest(),intent:{...intent(),scope:{...SCOPE,classification:'sealed_ciphertext'}}}]){
  const f=fixture();await assert.rejects(f.repository.prepare(actor,input,f.admit),known);assert.equal(f.state.calls.length,0);
 }
 const c=commitRequest();for(const patch of [{fingerprint:'c'.repeat(64)},{grantRevision:'2'},{proposalFingerprint:'d'.repeat(64)}]){
  const f=fixture();await assert.rejects(f.repository.commit(actor,{...c,...patch},f.admit),known);assert.equal(f.state.calls.length,0);
 }
});
test('admission needs an explicit true result, owned synchronous availability and finite assurance deadline',async()=>{
 const callbacks=[null,async()=>true];
 for(const patch of [{isAvailable:async()=>true,expiresAt:iso(NOW+100000)},
  {isAvailable:()=>true,expiresAt:null},{isAvailable:()=>true,expiresAt:'never'},
  {isAvailable:()=>true,expiresAt:iso(Date.now()-1000)}]){
  const admit=async()=>true;for(const [key,value] of Object.entries(patch))Object.defineProperty(admit,key,{value});callbacks.push(admit);
 }
 let getterReads=0;const accessor=async()=>true;Object.defineProperties(accessor,{isAvailable:{get(){getterReads++;return()=>true;}},expiresAt:{value:iso(NOW+100000)}});callbacks.push(accessor);
 for(const a of callbacks){const f=fixture();await assert.rejects(f.repository.prepare(actor,prepareRequest(),a),known);assert.equal(f.state.calls.length,0);}
 assert.equal(getterReads,0);
 const no=async()=>false;Object.defineProperties(no,{isAvailable:{value:()=>true},expiresAt:{value:iso(NOW+100000)}});
 const f=fixture();await assert.rejects(f.repository.prepare(actor,prepareRequest(),no),known);assert.equal(f.state.calls.length,0);
});

test('actual PID and xid precede committed dual-ticket mint, redemption, mutation and post-transaction retirement',async()=>{
 const f=fixture(),c=commitRequest(),reply=await f.repository.commit(actor,c,f.admit),result=reply.value;
 assert.deepEqual(Object.keys(reply).sort(),['admission','value']);assert.ok(Object.isFrozen(reply.admission));
 assert.equal(reply.admission.expiresAt,f.state.deliveryExpiry);assert.equal(reply.admission.resultFingerprint,lifecycleControlResultFingerprint(result));
 assert.deepEqual(result,committed(c));assert.equal(f.state.writes,1);assert.ok(Object.isFrozen(result.operation.intent));
 const calls=f.state.calls,at=(kind,part)=>calls.findIndex(call=>call.kind===kind&&call.sql?.includes(part));
 assert.ok(at('admin','BEGIN')<at('admin','pg_backend_pid()'));
 assert.ok(at('admin','pg_backend_pid()')<at('issuer','issue_lifecycle_control_ticket'));
 assert.ok(at('issuer','COMMIT')<at('admin','bind_lifecycle_control_context'));
 assert.ok(at('admin','commit_lifecycle_control')<at('admin','COMMIT'));
 assert.ok(at('admin','COMMIT')<at('issuer','finish_lifecycle_control_delivery'));
 assert.ok(at('admin','commit_lifecycle_control')<at('admin','lifecycle_control_delivery()'));
 assert.ok(at('admin','lifecycle_control_delivery()')<at('admin','COMMIT'));
 const mint=calls[at('issuer','issue_lifecycle_control_ticket')],db=calls[at('admin','pg_backend_pid()')].client;
 assert.equal(mint.args[0],W);assert.equal(mint.args[1],actor.subjectId);assert.equal(mint.args[2],'ci');assert.equal(mint.args[3],'commit');
 assert.deepEqual(JSON.parse(mint.args[4]),c);assert.equal(mint.args[5],f.admit.expiresAt);assert.equal(mint.args[6],db.pid);assert.equal(mint.args[7],db.xid);
 assert.equal(retires(f.state).length,1);assert.equal(f.state.minted.size,0);assert.ok(calls.some(call=>call.sql==='SET CONSTRAINTS ALL DEFERRED'));
});

for(const kind of ['issuer','admin'])test(kind+' denies mixed, inherited, elevated, owning and non-settable runtime capabilities',async()=>{
 for(const unsafe of [{elevated:true},{inherited:true},{conflicting:true},{owns_objects:true},{expected:false},{can_set:false},{unsafe_capability:true}]){
  const f=fixture({roles:{[kind]:unsafe}});await assert.rejects(f.repository.commit(actor,commitRequest(),f.admit),known);
  assert.equal(f.state.writes,0);assert.equal(f.state.calls.some(c=>c.sql?.includes('commit_lifecycle_control')),false);
  assert.ok(f.state.calls.some(c=>c.kind===kind&&c.release&&c.bad));
 }
});

for(const boundary of ['mint','bind','operation','role','check','clear'])test('closure at '+boundary+' rolls back before control COMMIT',async()=>{
 let observed=false;const f=fixture({after:async(call,state)=>{
  const matches=(boundary==='mint'&&call.kind==='issuer'&&call.sql==='COMMIT'&&call.client.mint)||
   (boundary==='bind'&&call.sql?.includes('bind_lifecycle_control_context'))||
   (boundary==='operation'&&call.sql?.includes('commit_lifecycle_control'))||
   (boundary==='role'&&call.kind==='admin'&&call.sql?.startsWith('SELECT current_user')&&call.client.bound)||
   (boundary==='check'&&call.sql?.includes('check_lifecycle_control_context'))||
   (boundary==='clear'&&call.sql?.includes('clear_lifecycle_control_context'));
  if(matches&&!observed){observed=true;state.available=false;}
 }});
 await assert.rejects(f.repository.commit(actor,commitRequest(),f.admit),known);assert.equal(observed,true);assert.equal(f.state.writes,0);
 assert.equal(mainCommits(f.state).length,0);assert.equal(retires(f.state).length,1);
});

test('final capability loss and admission failure both reject already staged changes',async()=>{
 for(const variant of ['capability','identity','queued-feature']){
  const f=fixture({roles:variant==='capability'?{admin:({checks})=>checks>1?{conflicting:true}:{}}:{}});
  if(variant==='identity')f.state.after=async(call,state)=>{if(call.sql?.includes('commit_lifecycle_control'))state.identity=false;};
  if(variant==='queued-feature')f.state.admissionHook=async()=>{if(f.state.calls.some(call=>call.sql?.includes('clear_lifecycle_control_context')))queueMicrotask(()=>{f.state.available=false;});};
  await assert.rejects(f.repository.commit(actor,commitRequest(),f.admit),known);assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,0);
 }
});

test('a valid but different record or operation in SQL output cannot be committed',async()=>{
 for(const replace of ['record','operation']){
  const f=fixture({after:async(call,state,result)=>{
   if(!call.sql?.includes('commit_lifecycle_control'))return;
   const c=commitRequest(),changedIntent=intent({command:command({retainUntil:iso(NOW+700000)})}),changedCommit=commitRequest(actor,changedIntent);
   const wrong=committed(changedCommit),original=committed(c);
   return {rows:[{result:replace==='record'?{...original,record:wrong.record,receipt:{...original.receipt,recordFingerprint:wrong.record.fingerprint}}:
    {...wrong,receipt:{...wrong.receipt,fingerprint:c.fingerprint}}}]};
  }});
  await assert.rejects(f.repository.commit(actor,commitRequest(),f.admit),known);assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,0);
 }
});

test('the protected main-transaction delivery digest and exact finite deadline bind the validated result before COMMIT',async()=>{
 for(const patch of [{resultFingerprint:'f'.repeat(64)},{expiresAt:null},{expiresAt:'never'},{expiresAt:iso(NOW-1)},{extra:true}]){
  const f=fixture({after:async(call,state,result)=>call.sql?.includes('lifecycle_control_delivery()')?
   {rows:[{admission:{...result.rows[0].admission,...patch}}]}:undefined});
  await assert.rejects(f.repository.commit(actor,commitRequest(),f.admit),known);
  assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,0);assert.equal(f.state.minted.size,0);
 }
});

test('the final issuer admission cannot substitute the result digest or malformed authority deadline after a durable write',async()=>{
 for(const patch of [{resultFingerprint:'f'.repeat(64)},{expiresAt:null},{expiresAt:'never'},{extra:true}]){
  const f=fixture({after:async(call,state,result)=>call.sql?.includes('finish_lifecycle_control_delivery')?
   {rows:[{admission:{...result.rows[0].admission,...patch}}]}:undefined});
  await assert.rejects(f.repository.commit(actor,commitRequest(),f.admit),unknown);
  assert.equal(f.state.writes,1);assert.equal(mainCommits(f.state).length,1);assert.equal(f.state.minted.size,0);
  assert.ok(f.state.calls.some(call=>call.sql?.includes('invalidate_lifecycle_control_ticket')));
 }
});

for(const action of ['commit','status','recover'])test('selected authority revoked after main COMMIT denies '+action+' delivery and retires the original token pair',async()=>{
 const c=commitRequest(),f=fixture({seed:action==='commit'?null:committed(c),after:async(call,state)=>{
  if(call.kind==='admin'&&call.sql==='COMMIT')state.authorityCurrent=false;
 }});
 await assert.rejects(f.repository[action](actor,action==='commit'?c:action==='status'?{scope:{...SCOPE}}:controlRecovery(c),f.admit),action==='commit'?unknown:known);
 assert.equal(f.state.writes,action==='commit'?1:0);assert.equal(f.state.minted.size,0);
 assert.equal(f.state.calls.filter(call=>call.sql?.includes('finish_lifecycle_control_delivery')).length,1);
 assert.equal(f.state.calls.filter(call=>call.sql?.includes('invalidate_lifecycle_control_ticket')).length,1);
});

for(const selected of ['initial','final'])test('the minimum '+selected+' SQL authority deadline survives final identity await even when UV and availability remain current',async t=>{
 let now=NOW;t.mock.method(Date,'now',()=>now);const f=fixture({seed:committed()});
 f.state.deliveryExpiry=iso(NOW+(selected==='initial'?1000:10000));f.state.finishExpiry=iso(NOW+(selected==='final'?1000:10000));
 let expiredInAdmission=false;f.state.admissionHook=async()=>{
  if(mainCommits(f.state).length&&f.state.minted.size===0){expiredInAdmission=true;now=NOW+1000;}
 };
 await assert.rejects(f.repository.status(actor,{scope:{...SCOPE}},f.admit),known);
 assert.equal(expiredInAdmission,true);assert.equal(f.state.enabled,true);assert.equal(f.state.available,true);assert.equal(f.state.identity,true);
 assert.equal(f.state.writes,0);assert.equal(f.state.minted.size,0);
});

test('a lost final issuer acknowledgement never releases a completed write result or repeats the mutation',async()=>{
 const c=commitRequest(),f=fixture({after:async call=>{
  if(call.kind==='issuer'&&call.sql==='COMMIT'&&call.client.retire)throw Error(CANARY+'-lost-final-ack');
 }});
 await assert.rejects(f.repository.commit(actor,c,f.admit),unknown);assert.equal(f.state.writes,1);assert.equal(f.state.minted.size,0);
 f.state.after=null;assert.deepEqual((await f.repository.recover(actor,controlRecovery(c),f.admit)).value,committed(c));assert.equal(f.state.writes,1);
});

test('lost COMMIT acknowledgement reports an exact authenticated recovery handle and never repeats the mutation',async()=>{
 const c=commitRequest(),f=fixture({after:async call=>{if(call.kind==='admin'&&call.sql==='COMMIT')throw Error(CANARY+'-lost-ack');}});
 let failure;await assert.rejects(f.repository.commit(actor,c,f.admit),error=>{failure=error;return unknown(error);});
 assert.equal(f.state.writes,1);assert.deepEqual(failure.recovery,controlRecovery(c));assert.ok(f.state.calls.some(call=>call.kind==='admin'&&call.release&&call.bad));
 f.state.after=null;const result=(await f.repository.recover(actor,failure.recovery,f.admit)).value;assert.equal(result.receipt.fingerprint,c.fingerprint);assert.equal(f.state.writes,1);
});

for(const action of ['commit','status','recover'])test('retirement closure denies '+action+' output after transaction completion',async()=>{
 const c=commitRequest(),f=fixture({seed:action==='commit'?null:committed(c),after:async(call,state)=>{if(call.sql?.includes('finish_lifecycle_control_delivery'))state.enabled=false;}});
 const input=action==='commit'?c:action==='status'?{scope:{...SCOPE}}:controlRecovery(c);
 await assert.rejects(f.repository[action](actor,input,f.admit),action==='commit'?unknown:known);
 assert.equal(f.state.writes,action==='commit'?1:0);assert.equal(mainCommits(f.state).length,1);
});

test('retirement failure preserves exact write uncertainty but never releases a read result',async()=>{
 for(const action of ['commit','status']){
  const c=commitRequest(),f=fixture({seed:action==='status'?committed(c):null,before:async call=>{if(/(invalidate_lifecycle_control_ticket|finish_lifecycle_control_delivery)/.test(call.sql??''))throw Error(CANARY+'-retire');}});
  await assert.rejects(f.repository[action](actor,action==='commit'?c:{scope:{...SCOPE}},f.admit),action==='commit'?unknown:known);
  assert.equal(f.state.writes,action==='commit'?1:0);assert.equal(f.state.minted.size,1);
 }
});

for(const method of ['putRule','status'])test('queued repository closure after cleanup admission cannot escape through '+method+' host composition',async()=>{
 const c=commitRequest(),f=fixture({seed:method==='status'?committed(c):null});let checksAfterRetirement=0;
 const repository=createLifecycleControlRepository({...f.options,isEnabled:()=>{
  if(retires(f.state).length&&(method==='status'||f.state.writes>0)&&++checksAfterRetirement===2)queueMicrotask(()=>{f.state.enabled=false;});
  return f.state.enabled;
 }});
 const profile=Object.freeze({id:actor.subjectId,sessionId:'synthetic-retention-session',verified:true,privilegedAssurance:true,
  lastStepUpAt:iso(NOW-1000),assuranceCredentialId:'synthetic-retention-credential'});
 const identity={viewer:async()=>profile,authorizePrivileged:async(h,action,authorize)=>
  action==='lifecycle.administer'&&await authorize(Object.freeze({subjectId:profile.id,sessionId:profile.sessionId,action}))};
 const app=createLifecycleControlService({identity,repository,workspaceId:W,isEnabled:()=>true,isAdministrationEnabled:()=>true,clock:()=>NOW});
 let failure;await assert.rejects(app[method](new Headers(),method==='status'?{scope:{...SCOPE}}:
  {command:command(),expectedControlRevision:'0',expectedFingerprint:null}),error=>{failure=error;return error?.code===
   (method==='status'?'lifecycle_control_unavailable':'lifecycle_control_outcome_unknown');});
 assert.ok(checksAfterRetirement>=2);assert.equal(f.state.enabled,false);assert.equal(f.state.writes,method==='status'?0:1);
 if(method==='putRule')assert.deepEqual(failure.recovery,controlRecovery(c));else assert.equal(Object.hasOwn(failure,'recovery'),false);
});

for(const action of ['status','recover'])test('assurance expiry during '+action+' cleanup denies output even when admission keeps returning true',async t=>{
 let now=NOW;t.mock.method(Date,'now',()=>now);
 const c=commitRequest(),f=fixture({seed:committed(c),after:async call=>{if(call.sql?.includes('finish_lifecycle_control_delivery'))now=NOW+120000;}});
 await assert.rejects(f.repository[action](actor,action==='status'?{scope:{...SCOPE}}:controlRecovery(c),f.admit),known);
 assert.equal(f.state.available,true);assert.equal(f.state.identity,true);assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,1);
});

for(const method of ['putRule','status','recover'])test('actual host and repository composition preserves SQL expiry through the last '+method+' identity await',async t=>{
 let now=NOW,returned=false,expiredInHost=false;t.mock.method(Date,'now',()=>now);
 const c=commitRequest(),f=fixture({seed:method==='putRule'?null:committed(c)});
 const repository=Object.fromEntries(['prepare','commit','status','recover'].map(phase=>[phase,async(...args)=>{
  const result=await f.repository[phase](...args);
  if(phase===(method==='putRule'?'commit':method))returned=true;
  return result;
 }]));
 const profile=Object.freeze({id:actor.subjectId,sessionId:'synthetic-last-host-session',verified:true,privilegedAssurance:true,
  lastStepUpAt:iso(NOW-1000),assuranceCredentialId:'synthetic-last-host-credential'});
 const identity={viewer:async()=>{if(returned){now=NOW+90001;expiredInHost=true;}return profile;},
  authorizePrivileged:async(h,action,authorize)=>action==='lifecycle.administer'&&await authorize(Object.freeze({subjectId:profile.id,sessionId:profile.sessionId,action}))};
 const app=createLifecycleControlService({identity,repository,workspaceId:W,isEnabled:()=>true,isAdministrationEnabled:()=>true,clock:()=>now});
 const input=method==='putRule'?{command:command(),expectedControlRevision:'0',expectedFingerprint:null}:method==='status'?{scope:{...SCOPE}}:controlRecovery(c);
 await assert.rejects(app[method](new Headers(),input),error=>error?.code===(method==='putRule'?'lifecycle_control_outcome_unknown':'lifecycle_control_unavailable'));
 assert.equal(expiredInHost,true);assert.equal(returned,true);assert.equal(f.state.writes,method==='putRule'?1:0);assert.equal(f.state.minted.size,0);
 assert.ok(now-Date.parse(profile.lastStepUpAt)<300000,'UV remains fresh while the SQL authority deadline has passed');
});
