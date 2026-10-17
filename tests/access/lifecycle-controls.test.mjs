import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createLifecycleControlService} from '../../apps/research/access/lifecycle-controls.mjs';
import {ASSURANCE_LIFETIME_MS,sameAssurance} from '../../apps/research/identity/assurance.mjs';
import {controlMethodIntent,lifecycleControlIntentFingerprint,lifecycleControlCommandFingerprint,
 buildControlCommit,controlRecovery,controlRecordId,controlRecordRevision,lifecycleControlResultFingerprint} from '../../packages/domain/src/lifecycle/control-storage.mjs';
import {proposeRetentionRule,proposeHold,proposeHoldRelease} from '../../packages/domain/src/lifecycle/retention.mjs';

const id=n=>'10000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const NOW=Date.parse('2026-10-17T16:00:00.000Z'),iso=value=>new Date(value).toISOString();
const W=id(1),RECORD=id(2),RULE=id(3),HOLD=id(4),OP=id(5),EVIDENCE=id(6);
const SCOPE=Object.freeze({workspaceId:W,recordId:RECORD,recordRevision:'1',classification:'restricted_research'});
const CANARY='PRIVATE-LIFECYCLE-CONTROL-CANARY';
const copy=value=>structuredClone(value);
const headers=()=>new Headers({'synthetic-control-identity':'alice'});
function ruleCommand(patch={}){return {operationId:OP,ruleId:RULE,revision:'1',scope:{...SCOPE},retentionClass:'case_and_rights_policy',
 basis:'policy',evidenceId:EVIDENCE,effectiveAt:iso(NOW-60000),expiresAt:iso(NOW+3600000),reviewBy:iso(NOW+1800000),retainUntil:iso(NOW+600000),disposeBy:iso(NOW+1200000),...patch};}
const putRule=(patch={})=>({command:ruleCommand(),expectedControlRevision:'0',expectedFingerprint:null,...patch});
function holdCommand(patch={}){return {operationId:OP,holdId:HOLD,scope:{...SCOPE},reason:'legal-hold',evidenceId:EVIDENCE,
 effectiveAt:iso(NOW-60000),expiresAt:iso(NOW+3600000),reviewBy:iso(NOW+1800000),...patch};}
const placeHold=(patch={})=>({command:holdCommand(),expectedControlRevision:'0',...patch});
const unavailable=error=>error?.code==='lifecycle_control_unavailable'&&error.message==='Lifecycle control unavailable'&&!Object.hasOwn(error,'cause');
const outcomeUnknown=error=>error?.code==='lifecycle_control_outcome_unknown'&&error.message==='Lifecycle control unavailable'&&
 Object.isFrozen(error.recovery)&&Object.isFrozen(error.recovery.scope)&&!Object.hasOwn(error,'cause');

function authority(p,intent,grant){return {workspaceId:p.workspaceId,subjectId:p.subjectId,action:intent.action,operationId:intent.command.operationId,
 authorizationId:intent.command.operationId,authorityEvidenceId:grant.evidenceId,authorityRevision:grant.revision,
 validFrom:grant.validFrom,expiresAt:grant.expiresAt,commandFingerprint:lifecycleControlCommandFingerprint(p,intent)};}
function proposed(c,current,now){
 if(c.intent.action==='lifecycle.retention-rule')return proposeRetentionRule(c.authority,c.intent.command,now).record;
 if(c.intent.action==='lifecycle.hold-place')return proposeHold(c.authority,c.intent.command,now).record;
 return proposeHoldRelease(c.authority,current,c.intent.command,now).record;
}
function resultFor(c,current,controlRevision='1',at=NOW){
 const record=proposed(c,current,at),event=record.kind==='retention-rule'?record.event:c.intent.action==='lifecycle.hold-place'?record.placement:record.release;
 return {record,operation:copy(c),receipt:{operationId:c.intent.command.operationId,fingerprint:c.fingerprint,action:c.intent.action,scope:copy(c.intent.scope),
  controlId:controlRecordId(record),revision:controlRecordRevision(record),controlRevision,recordFingerprint:record.fingerprint,
  auditSequence:controlRevision,recordedAt:event.recordedAt,committed:true,effectsVerified:false}};
}

function fixture({enabled=true,administration=true,clock=()=>NOW,viewer=null,identityHook=null,authorityHook=null,repository={}}={}){
 const state={enabled,administration,viewers:0,authorityChecks:0,calls:[],headerValues:[],identityHook,authorityHook,writes:0,
  profile:viewer??{id:'synthetic-control-operator',sessionId:'synthetic-control-session',verified:true,privilegedAssurance:true,
   lastStepUpAt:iso(NOW-1000),assuranceCredentialId:'synthetic-control-credential'},
  beforeRepository:null,afterRepository:null,afterDelivery:null,records:new Map(),operations:new Map(),controlRevision:'0',
  grant:{grantId:id(20),revision:'1',evidenceId:id(21),evidenceRevision:'1',validFrom:iso(NOW-60000),expiresAt:iso(NOW+3600000)}};
 const identity={
  async viewer(h){state.viewers++;state.headerValues.push(h.get('synthetic-control-identity'));if(state.identityHook)await state.identityHook(h,state);return state.profile?Object.freeze({...state.profile}):null;},
  async authorizePrivileged(h,action,authorize){
   state.authorityChecks++;if(state.authorityHook)await state.authorityHook(h,action,state);
   const before=await this.viewer(h),age=NOW-Date.parse(before?.lastStepUpAt);
   if(action!=='lifecycle.administer'||before?.privilegedAssurance!==true||age<0||age>=ASSURANCE_LIFETIME_MS)return false;
   const accepted=await authorize(Object.freeze({subjectId:before.id,sessionId:before.sessionId,action}));
   const after=await this.viewer(h);return accepted===true&&sameAssurance(before,after);
  }
 };
 const repo=Object.fromEntries(['prepare','commit','status','recover'].map(method=>[method,async(...args)=>{
  state.calls.push({method,args});if(state.beforeRepository)await state.beforeRepository(method,args,state);
  if(repository[method])return repository[method](...args);
  const [p,input,admit]=args;
  assert.equal(await admit(),true);assert.equal(admit.isAvailable(),true);
  let result;
  if(method==='prepare'){
   const {intent,fingerprint}=input;
   assert.equal(fingerprint,lifecycleControlIntentFingerprint(p,intent));
   result={scope:copy(intent.scope),controlRevision:state.controlRevision,current:copy(state.records.get(intent.command.ruleId??intent.command.holdId)??null),
    grant:copy(state.grant),authority:authority(p,intent,state.grant),intentFingerprint:fingerprint};
  }else if(method==='commit'){
   const old=state.operations.get(input.intent.command.operationId);
   if(old){assert.equal(old.receipt.fingerprint,input.fingerprint);result=copy(old);}
   else{
    assert.equal(input.intent.expectedControlRevision,state.controlRevision);
    const current=state.records.get(input.intent.command.ruleId??input.intent.command.holdId)??null;
    result=resultFor(input,current,String(BigInt(state.controlRevision)+1n));
    assert.equal(await admit(),true);assert.equal(admit.isAvailable(),true);
    state.controlRevision=result.receipt.controlRevision;state.writes++;
    state.operations.set(input.intent.command.operationId,copy(result));state.records.set(result.receipt.controlId,copy(result.record));
   }
  }else if(method==='status')result={scope:copy(input.scope),controlRevision:state.controlRevision,records:[...state.records.values()].map(copy),effectsVerified:false};
  else{
   result=copy(state.operations.get(input.operationId));
   if(!result||result.receipt.fingerprint!==input.fingerprint)throw Error(CANARY+'-missing-receipt');
  }
  if(state.afterRepository){const replacement=await state.afterRepository(method,args,result,state);if(replacement!==undefined)result=replacement;}
  const delivery={value:result,admission:{expiresAt:iso(NOW+90000),resultFingerprint:lifecycleControlResultFingerprint(result)}};
  return state.afterDelivery?state.afterDelivery(method,delivery):delivery;
 }]));
 const options={identity,repository:repo,workspaceId:W,isEnabled:()=>state.enabled,isAdministrationEnabled:()=>state.administration,clock};
 return {state,identity,repository:repo,options,service:createLifecycleControlService(options)};
}

test('lifecycle controls default off and deny before identity or repository access',async()=>{
 for(const omit of ['isEnabled','isAdministrationEnabled']){
  const f=fixture(),options={...f.options};delete options[omit];const app=createLifecycleControlService(options);
  await assert.rejects(app.putRule(headers(),putRule()),unavailable);
  assert.equal(f.state.viewers,0);assert.equal(f.state.calls.length,0);
 }
 const f=fixture({enabled:false});
 for(const [method,input] of [['putRule',putRule()],['placeHold',placeHold()],['status',{scope:{...SCOPE}}],['recover',{scope:{...SCOPE},operationId:OP,fingerprint:'a'.repeat(64)}]]){
  await assert.rejects(f.service[method](headers(),input),unavailable);
 }
 assert.equal(f.state.viewers,0);assert.equal(f.state.calls.length,0);
});

test('truthy and asynchronous activation cannot admit work',async()=>{
 for(const key of ['isEnabled','isAdministrationEnabled'])for(const value of [()=>1,()=>undefined,async()=>true]){
  const f=fixture(),app=createLifecycleControlService({...f.options,[key]:value});
  await assert.rejects(app.putRule(headers(),putRule()),unavailable);assert.equal(f.state.calls.length,0);
 }
});

test('service rejects malformed and noncanonical caller controls before repository access',async()=>{
 const cases=[null,{...putRule(),subjectId:'victim'},{...putRule(),scope:{...SCOPE}},
  {...putRule(),expectedControlRevision:0},{...putRule(),expectedControlRevision:'00'},
  {...putRule(),expectedControlRevision:'9223372036854775808'},
  {...putRule(),expectedFingerprint:'bad'},
  {...putRule(),command:ruleCommand({scope:{...SCOPE,workspaceId:id(99)}})},
  {...putRule(),command:ruleCommand({scope:{...SCOPE,classification:'sealed_ciphertext'}})},
  {...putRule(),command:ruleCommand({scope:{...SCOPE,recordRevision:1}})},
  {...putRule(),command:ruleCommand({authority:{verified:true}})}];
 for(const input of cases){const f=fixture();await assert.rejects(f.service.putRule(headers(),input),unavailable);assert.equal(f.state.calls.length,0);}
});

test('accessor, hidden, symbolic and inherited control inputs are denied without invoking getters',async()=>{
 let reads=0;
 const changes=[value=>Object.defineProperty(value,'command',{enumerable:true,get(){reads++;return ruleCommand();}}),
  value=>Object.defineProperty(value,'hidden',{value:CANARY}),value=>Object.assign(value,{[Symbol('authority')]:true}),
  value=>Object.assign(Object.create({authority:true}),value)];
 for(const change of changes){const f=fixture();await assert.rejects(f.service.putRule(headers(),change(putRule())),unavailable);assert.equal(f.state.calls.length,0);}
 const nested=putRule();Object.defineProperty(nested.command.scope,'recordId',{enumerable:true,get(){reads++;return RECORD;}});
 const f=fixture();await assert.rejects(f.service.putRule(headers(),nested),unavailable);assert.equal(f.state.calls.length,0);assert.equal(reads,0);
});

test('anonymous, unverified, missing, expired and future assurance deny controls before repository access',async()=>{
 const base=fixture().state.profile;
 for(const patch of [null,{...base,verified:false},{...base,privilegedAssurance:false},{...base,lastStepUpAt:null},
  {...base,lastStepUpAt:iso(NOW-ASSURANCE_LIFETIME_MS)},{...base,lastStepUpAt:iso(NOW+1)},
  {...base,assuranceCredentialId:null},{...base,sessionId:null}]){
  const f=fixture();f.state.profile=patch;
  await assert.rejects(f.service.putRule(headers(),putRule()),unavailable);assert.equal(f.state.calls.length,0);
 }
});

test('fixed-clock validation cannot allow a mutation with missing, nonfinite or asynchronous time',async()=>{
 for(const clock of [()=>null,()=>undefined,()=>NaN,()=>Infinity,()=>-1,()=>NOW+0.5,()=>String(NOW),async()=>NOW]){
  const f=fixture({clock});await assert.rejects(f.service.putRule(headers(),putRule()),unavailable);assert.equal(f.state.calls.length,0);
 }
});

test('rule, hold and explicit release produce private committed control receipts with no disposal effects',async()=>{
 const f=fixture(),rule=await f.service.putRule(headers(),putRule());
 assert.equal(rule.record.kind,'retention-rule');assert.equal(rule.receipt.committed,true);assert.equal(rule.receipt.effectsVerified,false);
 assert.equal(rule.receipt.controlRevision,'1');assert.equal(rule.receipt.operationId,OP);
 const held=await f.service.placeHold(headers(),placeHold({command:holdCommand({operationId:id(30)}),expectedControlRevision:'1'}));
 assert.equal(held.record.revision,'1');assert.equal(held.record.release,null);assert.equal(held.receipt.controlRevision,'2');
 const released=await f.service.releaseHold(headers(),{scope:{...SCOPE},command:{operationId:id(31),holdId:HOLD,expectedRevision:'1',
  holdFingerprint:held.record.fingerprint,evidenceId:id(32),reviewBy:iso(NOW+1800000)},expectedControlRevision:'2'});
 assert.equal(released.record.revision,'2');assert.deepEqual(released.record.placement,held.record.placement);assert.equal(released.receipt.controlRevision,'3');
 const status=await f.service.status(headers(),{scope:{...SCOPE}});
 assert.equal(status.controlRevision,'3');assert.equal(status.records.length,2);assert.equal(status.effectsVerified,false);
 const recovery={scope:{...SCOPE},operationId:held.receipt.operationId,fingerprint:held.receipt.fingerprint};
 const original=await f.service.recover(headers(),recovery);assert.deepEqual(original,held);assert.equal(f.state.writes,3);
 for(const result of [rule,held,released,original]){
  for(const value of [result,result.record,result.operation,result.operation.intent,result.receipt,result.receipt.scope])assert.equal(Object.isFrozen(value),true);
  for(const key of ['erased','exported','purgeAuthorized','deliveryStopped','removalQueued','fulfilled'])assert.equal(Object.hasOwn(result.receipt,key),false);
  assert.equal(Object.hasOwn(result,'admission'),false);assert.equal(Object.hasOwn(result,'value'),false);
 }
});

test('command, headers and repository methods are captured before the first identity await',async()=>{
 const command=putRule(),h=headers();let changed=false,replacementCalls=0;const f=fixture();
 f.state.identityHook=async()=>{
  if(changed)return;changed=true;command.command.retainUntil=iso(NOW+700000);command.command.scope.recordId=id(99);h.set('synthetic-control-identity','bob');
  for(const method of ['prepare','commit'])f.repository[method]=async()=>{replacementCalls++;throw Error(CANARY);};
 };
 const result=await f.service.putRule(h,command);
 assert.equal(result.record.event.command.retainUntil,iso(NOW+600000));assert.equal(result.record.event.command.scope.recordId,RECORD);
 assert.equal(replacementCalls,0);assert.ok(f.state.headerValues.length>1);assert.deepEqual([...new Set(f.state.headerValues)],['alice']);
 const prepare=f.state.calls.find(c=>c.method==='prepare');assert.ok(Object.isFrozen(prepare.args[0]));
 assert.ok(Object.isFrozen(prepare.args[1].intent.command.scope));
});

test('host requires exact private delivery metadata bound to its value before admitting a write',async()=>{
 for(const mutation of [reply=>reply.value,reply=>({...reply,extra:true}),reply=>({...reply,admission:null}),
  reply=>({...reply,admission:{...reply.admission,resultFingerprint:'f'.repeat(64)}}),
  reply=>({...reply,admission:{...reply.admission,expiresAt:iso(NOW)}})]){
  const f=fixture();f.state.afterDelivery=(method,reply)=>method==='prepare'?mutation(reply):reply;
  await assert.rejects(f.service.putRule(headers(),putRule()),unavailable);assert.equal(f.state.writes,0);
  assert.equal(f.state.calls.some(call=>call.method==='commit'),false);
 }
});

test('invalid or absent delivery metadata after commit produces an exact uncertain outcome instead of an acknowledgement',async()=>{
 for(const mutation of [reply=>reply.value,reply=>({...reply,admission:{...reply.admission,resultFingerprint:'f'.repeat(64)}}),
  reply=>({...reply,admission:{...reply.admission,expiresAt:iso(NOW)}})]){
  const f=fixture();f.state.afterDelivery=(method,reply)=>method==='commit'?mutation(reply):reply;
  await assert.rejects(f.service.putRule(headers(),putRule()),outcomeUnknown);assert.equal(f.state.writes,1);
 }
});

test('wrong preparation scope, grant proof or intent cannot reach commit',async()=>{
 const changes=[r=>{r.scope.recordId=id(99);},r=>{r.intentFingerprint='b'.repeat(64);},r=>{r.authority.subjectId='another-operator';},
  r=>{r.authority.action='lifecycle.hold-release';},r=>{r.authority.authorizationId=id(99);},r=>{r.grant.evidenceId=id(99);},
  r=>{r.grant.revision='2';},r=>{r.authority.commandFingerprint='c'.repeat(64);}];
 for(const change of changes){
  const f=fixture();f.state.afterRepository=async(method,args,result)=>{if(method==='prepare')change(result);};
  await assert.rejects(f.service.putRule(headers(),putRule()),unavailable);
  assert.equal(f.state.calls.some(c=>c.method==='commit'),false);assert.equal(f.state.writes,0);
 }
});

for(const changed of ['identity','session','credential','step-up','feature','administration'])test('loss of '+changed+' after prepare prevents control commit',async()=>{
 const f=fixture();f.state.afterRepository=async(method,args,result,state)=>{
  if(method!=='prepare')return;
  if(changed==='identity')state.profile={...state.profile,id:'different-operator'};
  else if(changed==='session')state.profile={...state.profile,sessionId:'different-session'};
  else if(changed==='credential')state.profile={...state.profile,assuranceCredentialId:'different-credential'};
  else if(changed==='step-up')state.profile={...state.profile,lastStepUpAt:iso(NOW)};
  else if(changed==='feature')state.enabled=false;else state.administration=false;
 };
 await assert.rejects(f.service.putRule(headers(),putRule()),unavailable);assert.equal(f.state.writes,0);
 assert.equal(f.state.calls.some(c=>c.method==='commit'),false);
});

test('current identity and exact assurance are checked again inside the mutation admission callback',async()=>{
 const f=fixture();f.state.beforeRepository=async(method,args,state)=>{if(method==='commit')state.profile={...state.profile,privilegedAssurance:false};};
 await assert.rejects(f.service.putRule(headers(),putRule()),error=>unavailable(error)||outcomeUnknown(error));
 assert.equal(f.state.writes,0);assert.equal(f.state.calls.filter(c=>c.method==='commit').length,1);
});

test('late completed mutation denial carries only the exact operation recovery binding',async()=>{
 const f=fixture();f.state.afterRepository=async(method,args,result,state)=>{if(method==='commit')state.enabled=false;};
 let failure;await assert.rejects(f.service.putRule(headers(),putRule()),error=>{failure=error;return outcomeUnknown(error);});
 assert.equal(f.state.writes,1);const commit=f.state.calls.find(c=>c.method==='commit').args[1];
 assert.deepEqual(failure.recovery,controlRecovery(commit));assert.equal(JSON.stringify(failure).includes(CANARY),false);
 f.state.enabled=true;const recovered=await f.service.recover(headers(),failure.recovery);
 assert.equal(recovered.receipt.fingerprint,commit.fingerprint);assert.equal(f.state.writes,1);
});

for(const method of ['status','recover'])test('late read denial cannot release a '+method+' result',async()=>{
 const f=fixture(),stored=await f.service.putRule(headers(),putRule());
 f.state.afterRepository=async(actual,args,result,state)=>{if(actual===method)state.profile={...state.profile,sessionId:'changed-after-read'};};
 const input=method==='status'?{scope:{...SCOPE}}:{scope:{...SCOPE},operationId:OP,fingerprint:stored.receipt.fingerprint};
 await assert.rejects(f.service[method](headers(),input),unavailable);assert.equal(f.state.writes,1);
});

test('a separately valid changed record cannot acknowledge the exact reviewed commit',async()=>{
 const f=fixture();f.state.afterRepository=async(method,args,result)=>{
  if(method!=='commit')return;
  const [p,c]=args,intent=copy(c.intent);intent.command.retainUntil=iso(NOW+700000);
  const changedProof=authority(p,intent,f.state.grant);
  const changed=proposeRetentionRule(changedProof,intent.command,NOW).record;
  return {record:changed,operation:result.operation,receipt:{...result.receipt,recordFingerprint:changed.fingerprint}};
 };
 await assert.rejects(f.service.putRule(headers(),putRule()),outcomeUnknown);assert.equal(f.state.writes,1);
});

for(const target of ['isEnabled','isAdministrationEnabled','clock'])test('rejected asynchronous '+target+' is denied without an unhandled private error',()=>{
 const module=new URL('../../apps/research/access/lifecycle-controls.mjs',import.meta.url).href;
 const source=`import {createLifecycleControlService} from ${JSON.stringify(module)};
const unhandled=[];let repositoryCalls=0;
process.on('unhandledRejection',error=>unhandled.push(String(error?.message)));
const repository=Object.fromEntries(['prepare','commit','status','recover'].map(method=>[method,async()=>{repositoryCalls++;throw Error('must not reach repository');}]));
const identity={viewer:async()=>({id:'operator',sessionId:'session',verified:true,privilegedAssurance:true,lastStepUpAt:${JSON.stringify(iso(NOW-1000))},assuranceCredentialId:'credential'}),authorizePrivileged:async()=>true};
const options={identity,repository,workspaceId:${JSON.stringify(W)},isEnabled:()=>true,isAdministrationEnabled:()=>true,clock:()=>${NOW}};
options[${JSON.stringify(target)}]=async()=>{throw Error(${JSON.stringify(CANARY)});};
let code;try{await createLifecycleControlService(options).putRule(new Headers(),${JSON.stringify(putRule())});code='unexpected-allow';}catch(error){code=error.code;}
await new Promise(resolve=>setImmediate(resolve));
process.stdout.write(JSON.stringify({code,repositoryCalls,unhandled:unhandled.length}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),{code:'lifecycle_control_unavailable',repositoryCalls:0,unhandled:0});
});
