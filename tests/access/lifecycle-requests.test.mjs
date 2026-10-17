import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
 createLifecycleRequestService,LifecycleRequestServiceError,LifecycleRequestOutcomeUnknownError
} from '../../apps/research/access/lifecycle-requests.mjs';
import {
 submitLifecycleRequest,cancelLifecycleRequest,lifecycleRequestFingerprint,
 lifecycleDecisionFingerprint,decideLifecycleRequest,lifecycleRequestReceipt
} from '../../packages/domain/src/lifecycle/requests.mjs';

const workspaceId='11111111-1111-4111-8111-111111111111';
const otherWorkspace='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const operationId='44444444-4444-4444-8444-444444444444';
const claimedRecordId='55555555-5555-4555-8555-555555555555';
const cancelId='66666666-6666-4666-8666-666666666666';
const reviewId='77777777-7777-4777-8777-777777777777';
const evidenceId='88888888-8888-4888-8888-888888888888';
const authorizationId='99999999-9999-4999-8999-999999999999';
const now=Date.parse('2026-10-17T14:00:00.000Z');
const principal=Object.freeze({workspaceId,subjectId:'requester-one'});
const input=()=>({operationId,requestId,kind:'delete',claimedRecordId});
const cancellation=()=>({operationId:cancelId,requestId,expectedRevision:'1'});
const request=()=>submitLifecycleRequest(principal,input(),now).request;
const code=error=>error instanceof LifecycleRequestServiceError&&error.code==='lifecycle_request_unavailable';
const unknown=error=>error instanceof LifecycleRequestOutcomeUnknownError&&error.code==='lifecycle_request_outcome_unknown';
function decision(current){
 const command={operationId:reviewId,requestId,expectedRevision:'1',decision:'accepted',reviewEvidenceId:evidenceId,reviewBy:'2026-10-18T14:00:00.000Z'};
 const operator={workspaceId,subjectId:'operator-one'};
 const authority={...operator,action:'lifecycle.administer',requestId,operationId:reviewId,authorizationId,authorityEvidenceId:evidenceId,
  validFrom:'2026-10-17T13:00:00.000Z',expiresAt:'2026-10-17T15:00:00.000Z',decisionFingerprint:lifecycleDecisionFingerprint(operator,current,command)};
 return decideLifecycleRequest(authority,current,command,now).request;
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function fixture({enabled=true,intake=true,seed=null}={}){
 const state={enabled,intake,viewer:{id:'requester-one',sessionId:'session-one',verified:true},record:seed,identityReads:0,reads:0,writes:0,attempts:0,cookies:[],calls:[],before:null,after:null,identityHook:null};
 const identity={async viewer(headers){state.identityReads++;state.cookies.push(headers.get('cookie'));if(state.identityHook)await state.identityHook();return state.viewer;}};
 const repository={
  async status(actor,command,admit){state.reads++;state.calls.push({kind:'status',actor,command});if(state.before)await state.before('status',actor,command);await admit();admit.isAvailable();if(!state.record)throw Error('private missing record');lifecycleRequestReceipt(actor,state.record);if(state.after)await state.after('status');return state.record;},
  async submit(actor,command,admit){
   state.attempts++;state.calls.push({kind:'submit',actor,command});if(state.before)await state.before('submit',actor,command);
   if(command.fingerprint!==lifecycleRequestFingerprint(actor,command.input))throw Error('bad fingerprint');
   const candidate=submitLifecycleRequest(actor,command.input,now,state.record);
   await admit();admit.isAvailable();if(!candidate.replayed){state.record=candidate.request;state.writes++;}
   if(state.after)await state.after('submit');return state.record;
  },
  async cancel(actor,command,admit){
   state.attempts++;state.calls.push({kind:'cancel',actor,command});if(state.before)await state.before('cancel',actor,command);
   if(!state.record||command.requestFingerprint!==state.record.submission.fingerprint)throw Error('private source conflict');
   const candidate=cancelLifecycleRequest(actor,state.record,command.input,now);
   if(candidate.operation.fingerprint!==command.fingerprint)throw Error('bad fingerprint');
   await admit();admit.isAvailable();if(!candidate.replayed){state.record=candidate.request;state.writes++;}
   if(state.after)await state.after('cancel');return state.record;
  },
  async recover(actor,command,admit){
   state.reads++;state.calls.push({kind:'recover',actor,command});if(state.before)await state.before('recover',actor,command);
   await admit();admit.isAvailable();if(!state.record)throw Error('private missing operation');lifecycleRequestReceipt(actor,state.record);
   if(state.after)await state.after('recover');return state.record;
  }
 };
 const options={identity,repository,workspaceId,isEnabled:()=>state.enabled,isIntakeEnabled:()=>state.intake,clock:()=>now};
 return {state,identity,repository,options,service:createLifecycleRequestService(options)};
}
const headers=()=>new Headers({cookie:'original-credential'});

test('default disabled service admits no identity or repository work',async()=>{
 const f=fixture(),service=createLifecycleRequestService({identity:f.identity,repository:f.repository,workspaceId});
 await assert.rejects(service.submit(headers(),input()),code);assert.equal(f.state.identityReads,0);assert.equal(f.state.attempts,0);
});
test('submission returns only an immutable owner receipt and operation, without delivery or export claims',async()=>{
 const f=fixture(),result=await f.service.submit(headers(),input());
 assert.equal(f.state.writes,1);assert.equal(result.receipt.state,'pending');assert.equal(result.operation.operationId,operationId);
 assert.equal(result.receipt.effectsVerified,false);assert.equal(result.operation.effectsVerified,false);
 assert.equal(result.receipt.targetKind,'claimed-record-reference');
 for(const value of [result,result.receipt,result.operation])assert.ok(Object.isFrozen(value));
 assert.doesNotMatch(JSON.stringify(result),/requester-one|session-one|original-credential|subjectId|authorityEvidence|deliveryStopped|removalQueued|fulfilled|download|ready/);
 const call=f.state.calls.find(c=>c.kind==='submit');assert.deepEqual(call.actor,principal);assert.ok(Object.isFrozen(call.actor));assert.ok(Object.isFrozen(call.command));assert.ok(Object.isFrozen(call.command.input));
});
test('valid claimed UUID is recorded without any record-existence or consent lookup',async()=>{
 const f=fixture();await f.service.submit(headers(),input());assert.deepEqual(f.state.calls.map(c=>c.kind),['submit']);
});
test('input intent and credentials are captured before the first identity await',async()=>{
 const f=fixture(),gate=deferred(),started=deferred(),command=input(),h=headers();let once=false;
 f.state.identityHook=async()=>{if(!once){once=true;started.resolve();await gate.promise;}};
 const pending=f.service.submit(h,command);await started.promise;command.claimedRecordId=otherWorkspace;command.kind='export';h.set('cookie','changed-credential');gate.resolve();
 const result=await pending;assert.equal(result.receipt.kind,'delete');assert.equal(result.receipt.claimedRecordId,claimedRecordId);assert.deepEqual([...new Set(f.state.cookies)],['original-credential']);
});
for(const field of ['subjectId','workspaceId','role','authority','classification','effectsVerified'])test('client '+field+' cannot become trusted submission context',async()=>{
 const f=fixture();await assert.rejects(f.service.submit(headers(),{...input(),[field]:'forged'}),code);assert.equal(f.state.identityReads,0);assert.equal(f.state.attempts,0);
});
test('accessor input is rejected without invocation',async()=>{
 const f=fixture(),command=input();let reads=0;Object.defineProperty(command,'kind',{enumerable:true,get(){reads++;return 'delete';}});
 await assert.rejects(f.service.submit(headers(),command),code);assert.equal(reads,0);assert.equal(f.state.identityReads,0);
});
for(const method of ['status','recover','cancel'])test(method+' rejects unknown client authority fields before identity reads',async()=>{
 const f=fixture({seed:request()}),command=method==='status'?{requestId}:method==='recover'?{operationId,fingerprint:request().submission.fingerprint}:cancellation();
 await assert.rejects(f.service[method](headers(),{...command,subjectId:'other'}),code);assert.equal(f.state.identityReads,0);
});
test('identity fields must be owned verified data and never execute an accessor',async()=>{
 const f=fixture();let calls=0;Object.defineProperty(f.state.viewer,'id',{enumerable:true,get(){calls++;return 'requester-one';}});
 await assert.rejects(f.service.submit(headers(),input()),code);assert.equal(calls,0);assert.equal(f.state.attempts,0);
});
for(const patch of [{verified:false},{verified:'true'},{id:''},{sessionId:''},{sessionId:'session one'}])test('invalid current identity '+JSON.stringify(patch)+' denies before repository',async()=>{
 const f=fixture();Object.assign(f.state.viewer,patch);await assert.rejects(f.service.submit(headers(),input()),code);assert.equal(f.state.attempts,0);
});
test('closing intake preserves own status, cancellation and recovery',async()=>{
 const f=fixture({seed:request(),intake:false});
 await assert.rejects(f.service.submit(headers(),input()),code);
 assert.equal((await f.service.status(headers(),{requestId})).receipt.state,'pending');
 const cancelled=await f.service.cancel(headers(),cancellation());assert.equal(cancelled.receipt.state,'cancelled');
 const recovered=await f.service.recover(headers(),{operationId:cancelId,fingerprint:cancelled.operation.fingerprint});assert.deepEqual(recovered.operation,cancelled.operation);assert.equal(f.state.writes,1);
});
test('service closure denies all existing receipt paths without repository reads',async()=>{
 const f=fixture({seed:request(),enabled:false});
 for(const [method,command] of [['status',{requestId}],['cancel',cancellation()],['recover',{operationId,fingerprint:request().submission.fingerprint}]])await assert.rejects(f.service[method](headers(),command),code);
 assert.equal(f.state.reads,0);assert.equal(f.state.attempts,0);
});
test('repository method replacement after construction does not replace a pinned trusted dependency',async()=>{
 const f=fixture();f.repository.submit=async()=>{throw Error('replacement');};f.identity.viewer=async()=>({id:'foreign',sessionId:'foreign',verified:true});
 const result=await f.service.submit(headers(),input());assert.equal(result.receipt.state,'pending');assert.equal(f.state.writes,1);
});
test('exact submission retry keeps one write and one original operation receipt',async()=>{
 const f=fixture(),first=await f.service.submit(headers(),input()),second=await f.service.submit(headers(),input());
 assert.deepEqual(second,first);assert.equal(f.state.writes,1);
 await assert.rejects(f.service.submit(headers(),{...input(),kind:'export'}),unknown);assert.equal(f.state.writes,1);
});
test('intake closure during the repository admission await prevents fixture commit',async()=>{
 const f=fixture();f.state.before=async kind=>{if(kind==='submit')f.state.intake=false;};
 await assert.rejects(f.service.submit(headers(),input()),unknown);assert.equal(f.state.writes,0);assert.equal(f.state.record,null);
});
test('identity revocation during admission prevents fixture commit',async()=>{
 const f=fixture();f.state.before=async kind=>{if(kind==='submit')f.state.viewer=null;};
 await assert.rejects(f.service.submit(headers(),input()),unknown);assert.equal(f.state.writes,0);
});
test('session replacement during admission cannot reuse the earlier identity snapshot',async()=>{
 const f=fixture();f.state.before=async kind=>{if(kind==='submit')f.state.viewer={...f.state.viewer,sessionId:'replacement-session'};};
 await assert.rejects(f.service.submit(headers(),input()),unknown);assert.equal(f.state.writes,0);
});
test('intake closure during post-commit cleanup yields an uncertain write and leaves authenticated readback available',async()=>{
 const f=fixture();f.state.after=async kind=>{if(kind==='submit')f.state.intake=false;};let observed;
 await assert.rejects(f.service.submit(headers(),input()),error=>{observed=error;return unknown(error);});assert.equal(f.state.writes,1);
 assert.ok(Object.isFrozen(observed.recovery));assert.deepEqual(observed.recovery,{operationId,fingerprint:request().submission.fingerprint});
 const result=await f.service.recover(headers(),observed.recovery);assert.equal(result.operation.state,'pending');assert.equal(result.receipt.effectsVerified,false);
});
test('a lost commit acknowledgement does not trigger an automatic retry and recovers only the exact owned operation',async()=>{
 const f=fixture();f.state.after=async kind=>{if(kind==='submit')throw Error('private connection, token, database error');};let observed;
 await assert.rejects(f.service.submit(headers(),input()),error=>{observed=error;return unknown(error);});
 assert.equal(f.state.attempts,1);assert.equal(f.state.writes,1);assert.doesNotMatch(observed.message,/private|token|database/);
 assert.equal((await f.service.recover(headers(),observed.recovery)).receipt.requestId,requestId);
 await assert.rejects(f.service.recover(headers(),{...observed.recovery,fingerprint:'0'.repeat(64)}),code);
 f.state.viewer={id:'other-person',sessionId:'other-session',verified:true};await assert.rejects(f.service.recover(headers(),observed.recovery),code);
});
test('read after cleanup rechecks current identity and does not return earlier receipt bytes',async()=>{
 const f=fixture({seed:request()});f.state.after=async kind=>{if(kind==='status')f.state.viewer=null;};
 await assert.rejects(f.service.status(headers(),{requestId}),code);
});
test('read after cleanup rechecks feature availability',async()=>{
 const f=fixture({seed:request()});f.state.after=async()=>{f.state.enabled=false;};await assert.rejects(f.service.status(headers(),{requestId}),code);
});
test('a buggy repository cannot return a different request for the same caller',async()=>{
 const f=fixture({seed:request()});f.repository.status=async()=>submitLifecycleRequest(principal,{...input(),requestId:otherWorkspace},now).request;
 const service=createLifecycleRequestService(f.options);await assert.rejects(service.status(headers(),{requestId}),code);
});
test('a buggy repository cannot return a foreign workspace or actor receipt',async()=>{
 for(const foreign of [{workspaceId:otherWorkspace,subjectId:principal.subjectId},{workspaceId,subjectId:'other-person'}]){
  const f=fixture();f.repository.status=async()=>submitLifecycleRequest(foreign,input(),now).request;
  const service=createLifecycleRequestService(f.options);await assert.rejects(service.status(headers(),{requestId}),code);
 }
});
test('a malformed stored request never becomes a successful response',async()=>{
 const f=fixture();f.repository.status=async()=>({...request(),state:'fulfilled'});const service=createLifecycleRequestService(f.options);
 await assert.rejects(service.status(headers(),{requestId}),code);
});
test('accepted request proposals cannot be undone by requester cancellation',async()=>{
 const f=fixture({seed:decision(request())});assert.equal((await f.service.status(headers(),{requestId})).receipt.state,'accepted');
 await assert.rejects(f.service.cancel(headers(),cancellation()),code);assert.equal(f.state.attempts,0);assert.equal(f.state.record.state,'accepted');
});
test('cancellation loses a concurrent resolution without overwriting it',async()=>{
 const f=fixture({seed:request()});f.state.before=async kind=>{if(kind==='cancel')f.state.record=decision(f.state.record);};
 await assert.rejects(f.service.cancel(headers(),cancellation()),unknown);assert.equal(f.state.writes,0);assert.equal(f.state.record.state,'accepted');
});
test('a pending row returned by cancellation cannot be promoted into a persisted cancellation claim',async()=>{
 const f=fixture({seed:request()});f.repository.cancel=async()=>f.state.record;const service=createLifecycleRequestService(f.options);
 await assert.rejects(service.cancel(headers(),cancellation()),unknown);assert.equal(f.state.record.state,'pending');assert.equal(f.state.writes,0);
});
test('uncertain cancellation readback returns the exact cancellation operation and never an export',async()=>{
 const f=fixture({seed:request()});f.state.after=async kind=>{if(kind==='cancel')throw Error('lost response');};let observed;
 await assert.rejects(f.service.cancel(headers(),cancellation()),error=>{observed=error;return unknown(error);});assert.equal(f.state.writes,1);
 const recovered=await f.service.recover(headers(),observed.recovery);assert.equal(recovered.operation.state,'cancelled');assert.equal(recovered.operation.operationId,cancelId);assert.equal(recovered.receipt.effectsVerified,false);
});
test('submission operation readback remains original even after later cancellation',async()=>{
 const f=fixture({seed:request()}),submittedFingerprint=f.state.record.submission.fingerprint;await f.service.cancel(headers(),cancellation());
 const result=await f.service.recover(headers(),{operationId,fingerprint:submittedFingerprint});assert.equal(result.operation.state,'pending');assert.equal(result.operation.revision,'1');assert.equal(result.receipt.state,'cancelled');assert.equal(result.receipt.revision,'2');
});
for(const callback of ['isEnabled','isIntakeEnabled','clock'])test('rejecting async '+callback+' is denied before work and leaves no unhandled private callback error',()=>{
 const serviceUrl=new URL('../../apps/research/access/lifecycle-requests.mjs',import.meta.url).href;
 const domainUrl=new URL('../../packages/domain/src/lifecycle/requests.mjs',import.meta.url).href;
 const script=`import {createLifecycleRequestService} from ${JSON.stringify(serviceUrl)};
 import {submitLifecycleRequest} from ${JSON.stringify(domainUrl)};
 const errors=[];process.on('unhandledRejection',error=>errors.push(String(error?.message)));
 const marker='SYNTHETIC-PRIVATE-CALLBACK-ERROR';let identities=0,repositories=0,result;
 const principal=${JSON.stringify(principal)},command=${JSON.stringify(input())};
 const record=submitLifecycleRequest(principal,command,${now}).request;
 const repository={submit:async()=>{repositories++;return record;},status:async()=>record,cancel:async()=>record,recover:async()=>record};
 const options={workspaceId:principal.workspaceId,repository,identity:{viewer:async()=>{identities++;return {id:principal.subjectId,sessionId:'session-one',verified:true};}},isEnabled:()=>true,isIntakeEnabled:()=>true,clock:()=>${now}};
 options[${JSON.stringify(callback)}]=async()=>{throw Error(marker);};
 try{await createLifecycleRequestService(options).submit(new Headers(),command);result='unexpected-success';}catch(error){result=error.code;}
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
 process.stdout.write(JSON.stringify({result,identities,repositories,unhandled:errors.length,rawEscaped:errors.includes(marker)}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH}});
 assert.equal(child.status,0,child.stderr);const observed=JSON.parse(child.stdout);
 assert.equal(observed.unhandled,0);assert.equal(observed.rawEscaped,false);assert.equal(observed.result,'lifecycle_request_unavailable');assert.equal(observed.identities,0);assert.equal(observed.repositories,0);
});
for(const callback of ['isEnabled','isIntakeEnabled','clock'])test('resolving async '+callback+' never becomes a synchronous admission value',async()=>{
 const f=fixture(),service=createLifecycleRequestService({...f.options,[callback]:async()=>callback==='clock'?now:true});
 await assert.rejects(service.submit(headers(),input()),code);assert.equal(f.state.identityReads,0);assert.equal(f.state.attempts,0);
});
