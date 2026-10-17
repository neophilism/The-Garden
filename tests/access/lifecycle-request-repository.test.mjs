import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createLifecycleRequestRepository,LifecycleRequestRepositoryError} from '../../apps/research/access/lifecycle-request-repository.mjs';
import {createLifecycleRequestService,LifecycleRequestOutcomeUnknownError} from '../../apps/research/access/lifecycle-requests.mjs';
import {submitLifecycleRequest,cancelLifecycleRequest,lifecycleRequestFingerprint} from '../../packages/domain/src/lifecycle/requests.mjs';
import {roleProbe} from '../security/database-role-fixture.mjs';

const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const W=id(1),R=id(2),O=id(3),CLAIM=id(4),CANCEL=id(5);
const actor=Object.freeze({workspaceId:W,subjectId:'requester-one'});
const NOW=Date.parse('2026-10-17T16:00:00.000Z');
const input=()=>({operationId:O,requestId:R,kind:'delete',claimedRecordId:CLAIM});
const submission=(p=actor,command=input())=>({input:command,fingerprint:lifecycleRequestFingerprint(p,command)});
const pending=(p=actor,command=input())=>submitLifecycleRequest(p,command,NOW).request;
const cancellation=(record=pending(),p=actor)=>{
 const command={operationId:CANCEL,requestId:record.requestId,expectedRevision:'1'};
 return {input:command,requestFingerprint:record.submission.fingerprint,fingerprint:cancelLifecycleRequest(p,record,command,NOW).operation.fingerprint};
};
const copy=value=>JSON.parse(JSON.stringify(value));
const unavailable=error=>error instanceof LifecycleRequestRepositoryError&&error.code==='lifecycle_request_unavailable'&&!/CANARY|PASSWORD|postgres|token-value/.test(error.message);
const known=error=>unavailable(error)&&!Object.hasOwn(error,'commitOutcome');
const unknown=error=>unavailable(error)&&error.commitOutcome==='unconfirmed'&&Object.isFrozen(error.recovery);

function fixture({seed=null,roles={},enabled=true,before=null,after=null,subjectId=actor.subjectId}={}){
 const state={enabled,available:true,identity:true,admissions:0,admissionHook:null,calls:[],records:new Map(),writes:0,
  ticketCounter:0,connectionCounter:0,minted:new Map(),before,after,output:null,subjectId};
 if(seed)state.records.set(seed.requestId,seed);
 const admit=async()=>{state.admissions++;if(state.admissionHook)await state.admissionHook();if(!state.identity)throw Error('IDENTITY-CANARY');return true;};
 Object.defineProperty(admit,'isAvailable',{value:()=>{if(state.available!==true)throw Error('AVAILABILITY-CANARY');return true;}});Object.freeze(admit);
 function pool(kind){return {async connect(){
  const serial=++state.connectionCounter,client={kind,serial,pid:8000+serial,xid:String(10000+serial),open:false,staged:null,bound:null,closed:false,mint:null};
  state.calls.push({kind,connect:true,client});if(state.before)await state.before({kind,connect:true,client},state);
  const observe=roleProbe('lifecycle_'+kind+'_login',roles[kind]??{});
  return {async query(sql,args){
   const call={kind,sql,args,client};state.calls.push(call);if(state.before)await state.before(call,state);
   let result=observe(sql,args);
   if(!result){
    result={rows:[]};
    if(sql==='BEGIN')client.open=true;
    else if(sql==='COMMIT'){
     assert.equal(client.open,true,'fixture COMMIT requires an open transaction');
     if(kind==='requester'&&client.staged){state.records.set(client.staged.requestId,client.staged);state.writes++;}
     if(kind==='issuer'&&client.mint)state.minted.set(client.mint.token,client.mint);
     client.open=false;
    }else if(sql==='ROLLBACK'){client.open=false;client.staged=null;}
    else if(sql==='SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')result={rows:[{backend_pid:client.pid,transaction_id:client.xid}]};
    else if(sql.includes('issue_lifecycle_request_ticket')){
     const token=(++state.ticketCounter).toString(16).padStart(64,'0');
     client.mint={token,args:[...args]};result={rows:[{ticket:token}]};
    }else if(sql.includes('invalidate_lifecycle_request_ticket')){
     assert.equal(state.calls.some(c=>c.kind==='requester'&&c.client.open),false,'retirement must follow requester transaction end');
     state.minted.delete(args[0]);
    }else if(sql.includes('bind_lifecycle_request_context')){
     const ticket=state.minted.get(args[0]);assert.ok(ticket,'ticket must be committed before binding');
     assert.equal(ticket.args[7],client.pid);assert.equal(ticket.args[8],client.xid);client.bound=ticket;
    }else if(sql.includes('check_lifecycle_request_context'))result={rows:[{admitted:true}]};
    else if(sql.includes('clear_lifecycle_request_context'))client.closed=true;
    else if(/(submit_lifecycle_request|cancel_lifecycle_request|lifecycle_request_status|recover_lifecycle_request)/.test(sql)){
     assert.ok(client.bound);const p={workspaceId:client.bound.args[0],subjectId:client.bound.args[1]};let record;
     if(sql.includes('submit_lifecycle_request')){
      const c=JSON.parse(args[0]),old=state.records.get(c.input.requestId)??null;
      const next=submitLifecycleRequest(p,c.input,NOW,old);record=next.request;if(!next.replayed)client.staged=record;
     }else if(sql.includes('cancel_lifecycle_request')){
      const c=JSON.parse(args[0]),old=state.records.get(c.input.requestId);assert.ok(old);
      const next=cancelLifecycleRequest(p,old,c.input,NOW);record=next.request;if(!next.replayed)client.staged=record;
     }else if(sql.includes('lifecycle_request_status'))record=state.records.get(args[0]);
     else record=[...state.records.values()].find(r=>(r.submission.operationId===args[0]&&r.submission.fingerprint===args[1])||(r.resolution?.operationId===args[0]&&r.resolution.fingerprint===args[1]));
     if(!record)throw Error('PRIVATE-MISSING-REQUEST-CANARY');
     state.output=copy(record);result={rows:[{result:state.output}]};
    }
   }
   if(state.after){const replacement=await state.after(call,state,result);if(replacement!==undefined)result=replacement;}
   return result;
  },release(bad){state.calls.push({kind,release:true,bad,client});if(state.releaseHook)state.releaseHook({kind,bad,client});}};
 }};}
 const issuerPool=pool('issuer'),requesterPool=pool('requester');
 const options={issuerPool,requesterPool,workspaceId:W,environment:'ci',isEnabled:()=>state.enabled};
 const repository=createLifecycleRequestRepository(options);
 return {state,admit,options,repository};
}
const mainCommits=state=>state.calls.filter(c=>c.kind==='requester'&&c.sql==='COMMIT');
const retirements=state=>state.calls.filter(c=>c.sql?.includes('invalidate_lifecycle_request_ticket'));

test('requester repository defaults off and rejects async or truthy activation before any pool access',async()=>{
 for(const flag of [undefined,()=>false,()=>1,async()=>true]){
  const f=fixture(),options={...f.options};if(flag===undefined)delete options.isEnabled;else options.isEnabled=flag;
  const repo=createLifecycleRequestRepository(options);await assert.rejects(repo.submit(actor,submission(),f.admit),known);
  assert.equal(f.state.calls.length,0);assert.equal(f.state.admissions,0);
 }
});
for(const target of ['isEnabled','isAvailable'])for(const variant of ['foreign-promise','overridden-catch','rejecting-thenable','fulfilled-false'])test(target+' denies '+variant+' without an unhandled async callback error',()=>{
 const repoUrl=new URL('../../apps/research/access/lifecycle-request-repository.mjs',import.meta.url).href;
 const domainUrl=new URL('../../packages/domain/src/lifecycle/requests.mjs',import.meta.url).href;
 const source=`import {createLifecycleRequestRepository} from ${JSON.stringify(repoUrl)};
import {lifecycleRequestFingerprint} from ${JSON.stringify(domainUrl)};
import vm from 'node:vm';
const marker='PRIVATE-CALLBACK-CANARY',unhandled=[];let connections=0,admissions=0,catchCalls=0,thenCalls=0;
process.on('unhandledRejection',error=>unhandled.push(String(error?.message)));
const p=${JSON.stringify(actor)},input=${JSON.stringify(input())};
const factory=()=>{
 if(${JSON.stringify(variant)}==='foreign-promise')return vm.runInNewContext('Promise.reject(new Error('+JSON.stringify(marker)+'))');
 if(${JSON.stringify(variant)}==='overridden-catch'){const result=Promise.reject(new Error(marker));result.catch=()=>{catchCalls++;throw Error('OVERRIDDEN-CATCH-CANARY');};return result;}
 if(${JSON.stringify(variant)}==='rejecting-thenable'){const rejected=Promise.reject(new Error(marker));return {then(resolve,reject){thenCalls++;return Promise.prototype.then.call(rejected,resolve,reject);}};}
 return Promise.resolve(false);
};
const pool=()=>({async connect(){connections++;throw Error('database must not be reached');}});
const options={issuerPool:pool(),requesterPool:pool(),workspaceId:p.workspaceId,environment:'ci',isEnabled:()=>true};
const admit=async()=>{admissions++;return true;};Object.defineProperty(admit,'isAvailable',{value:${JSON.stringify(target)}==='isAvailable'?factory:()=>true});
if(${JSON.stringify(target)}==='isEnabled')options.isEnabled=factory;
let result;try{await createLifecycleRequestRepository(options).submit(p,{input,fingerprint:lifecycleRequestFingerprint(p,input)},admit);result='unexpected-success';}catch(error){result=error.code;}
await new Promise(resolve=>setImmediate(resolve));
process.stdout.write(JSON.stringify({result,connections,admissions,unhandled:unhandled.length,rawEscaped:unhandled.includes(marker),catchCalls,thenCalls}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);
 assert.equal(result.result,'lifecycle_request_unavailable');assert.equal(result.connections,0);assert.equal(result.admissions,0);
 assert.equal(result.unhandled,0);assert.equal(result.rawEscaped,false);assert.equal(result.catchCalls,0);
 if(variant==='rejecting-thenable')assert.equal(result.thenCalls,1);
});
test('factory rejects shared pools, unsupported environments and malformed receiving workspaces',()=>{
 const f=fixture();for(const change of [{requesterPool:f.options.issuerPool},{environment:'production'},{environment:'local'},{environment:'preview'},{workspaceId:'unknown'},{isEnabled:true},{issuerPool:{}}])assert.throws(()=>createLifecycleRequestRepository({...f.options,...change}),LifecycleRequestRepositoryError);
});
test('actor and closed command validation completes before admission or database access',async()=>{
 const invalidActors=[{...actor,workspaceId:id(9)},{...actor,role:'administrator'},{...actor,subjectId:''},{...actor,subjectId:'two words'},{...actor,subjectId:'\ud800'},{...actor,subjectId:'x'.repeat(129)}];
 for(const p of invalidActors){const f=fixture();await assert.rejects(f.repository.submit(p,submission(),f.admit),known);assert.equal(f.state.calls.length,0);assert.equal(f.state.admissions,0);}
 for(const c of [null,{...submission(),headers:{}},{...submission(),fingerprint:'a'.repeat(64)},{...submission(),input:{...input(),subjectId:'victim'}},{...submission(),input:{...input(),kind:'erase'}}]){
  const f=fixture();await assert.rejects(f.repository.submit(actor,c,f.admit),known);assert.equal(f.state.calls.length,0);assert.equal(f.state.admissions,0);
 }
});
test('hidden, symbolic and accessor fields cannot bypass the owned command snapshot',async()=>{
 for(const place of ['outer','inner','principal']){
  const f=fixture(),c=submission(),p={...actor};let calls=0;const target=place==='outer'?c:place==='inner'?c.input:p;
  Object.defineProperty(target,'hidden',{value:'secret',enumerable:false});
  await assert.rejects(f.repository.submit(p,c,f.admit),known);assert.equal(calls,0);assert.equal(f.state.calls.length,0);
 }
 for(const change of [target=>Object.defineProperty(target,'fingerprint',{enumerable:true,get(){throw Error('GETTER-CANARY');}}),target=>{target[Symbol('hidden')]=true;}]){
  const f=fixture(),c=submission();change(c);await assert.rejects(f.repository.submit(actor,c,f.admit),known);assert.equal(f.state.calls.length,0);
 }
});
test('admission must have an owned synchronous availability check and explicit true result',async()=>{
 const f=fixture();for(const callback of [null,()=>true,Object.assign(async()=>true,{})])await assert.rejects(f.repository.submit(actor,submission(),callback),known);
 let reads=0;const getter=async()=>true;Object.defineProperty(getter,'isAvailable',{get(){reads++;return()=>true;}});
 await assert.rejects(f.repository.submit(actor,submission(),getter),known);assert.equal(reads,0);
 for(const result of [false,1,undefined]){
  const a=async()=>result;Object.defineProperty(a,'isAvailable',{value:()=>true});await assert.rejects(f.repository.submit(actor,submission(),a),known);
 }
 const asyncAvailable=async()=>true;Object.defineProperty(asyncAvailable,'isAvailable',{value:async()=>true});
 await assert.rejects(f.repository.submit(actor,submission(),asyncAvailable),known);assert.equal(f.state.calls.length,0);
});
test('requester obtains its actual transaction identity before issuer mint commits and before token binding',async()=>{
 const f=fixture(),result=await f.repository.submit(actor,submission(),f.admit),calls=f.state.calls;
 assert.equal(result.state,'pending');assert.equal(f.state.writes,1);assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.submission));
 const locate=(kind,pattern)=>calls.findIndex(c=>c.kind===kind&&c.sql?.includes(pattern));
 const begin=locate('requester','BEGIN'),binding=locate('requester','pg_backend_pid()'),mint=locate('issuer','issue_lifecycle_request_ticket'),issuerCommit=locate('issuer','COMMIT'),redeem=locate('requester','bind_lifecycle_request_context');
 assert.ok(begin<binding&&binding<mint&&mint<issuerCommit&&issuerCommit<redeem);
 const mintCall=calls[mint],db=calls[binding].client;
 assert.deepEqual(mintCall.args,[W,actor.subjectId,'ci','submit',R,O,submission().fingerprint,db.pid,db.xid]);
 assert.equal(retirements(f.state).length,1);assert.equal(f.state.minted.size,0);
 const mainCommit=locate('requester','COMMIT'),release=calls.findIndex(c=>c.kind==='requester'&&c.release),retire=locate('issuer','invalidate_lifecycle_request_ticket');
 assert.ok(redeem<mainCommit&&mainCommit<release&&release<retire);
 assert.ok(calls.some(c=>c.sql==='SET CONSTRAINTS ALL DEFERRED'));
 assert.doesNotMatch(calls.map(c=>c.sql??'').join('\n'),/record_envelopes|access_members|research_consent|issue_policy_ticket/);
});
test('status intent has an independent canonical digest and no caller-selected operation identity',async()=>{
 const p={workspaceId:W,subjectId:'quote"slash\\Unicodeé🌱\u2028'},f=fixture({seed:pending(p),subjectId:p.subjectId});
 await f.repository.status(p,{requestId:R},f.admit);
 const args=f.state.calls.find(c=>c.sql?.includes('issue_lifecycle_request_ticket')).args;
 const expected=createHash('sha256').update('garden-lifecycle-read-v1\nstatus\n'+JSON.stringify({workspaceId:W,subjectId:p.subjectId,requestId:R,operationId:args[5]}),'utf8').digest('hex');
 assert.equal(args[3],'status');assert.equal(args[4],R);assert.match(args[5],/^[0-9a-f-]{36}$/);assert.equal(args[6],expected);
 await assert.rejects(f.repository.status(p,{requestId:R,operationId:O},f.admit),known);
});
test('cancellation intent is checked before SQL and a pending reply cannot acknowledge cancellation',async()=>{
 const f=fixture({seed:pending()});await assert.rejects(f.repository.cancel(actor,{...cancellation(),fingerprint:'b'.repeat(64)},f.admit),known);assert.equal(f.state.calls.length,0);
 f.state.after=async call=>call.sql?.includes('cancel_lifecycle_request')?{rows:[{result:copy(pending())}]}:undefined;
 await assert.rejects(f.repository.cancel(actor,cancellation(),f.admit),known);assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,0);
});
test('all intents and principal fields are owned before the first admission await',async()=>{
 const f=fixture(),p={...actor},c=submission();let once=false;
 f.state.admissionHook=async()=>{if(!once){once=true;p.subjectId='changed';c.input.kind='export';c.input.claimedRecordId=id(9);c.fingerprint='d'.repeat(64);}};
 const result=await f.repository.submit(p,c,f.admit);assert.equal(result.requesterId,actor.subjectId);assert.equal(result.kind,'delete');assert.equal(result.claimedRecordId,CLAIM);
});
for(const kind of ['issuer','requester'])test(kind+' refuses mixed, inherited, elevated, non-settable and object-owning database capabilities',async()=>{
 for(const unsafe of [{elevated:true},{inherited:true},{conflicting:true},{owns_objects:true},{expected:false},{can_set:false},{unsafe_capability:true}]){
  const f=fixture({roles:{[kind]:unsafe}});await assert.rejects(f.repository.submit(actor,submission(),f.admit),known);
  assert.equal(f.state.writes,0);assert.equal(f.state.calls.some(c=>c.sql?.includes('submit_lifecycle_request')),false);
  assert.ok(f.state.calls.some(c=>c.kind===kind&&c.release&&c.bad),JSON.stringify(unsafe));
 }
});
test('a capability change at the final role check rolls back and destroys the requester connection',async()=>{
 const f=fixture({roles:{requester:({checks})=>checks>1?{conflicting:true}:{}}});
 await assert.rejects(f.repository.submit(actor,submission(),f.admit),known);assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,0);
 assert.ok(f.state.calls.some(c=>c.kind==='requester'&&c.release&&c.bad));
});
for(const boundary of ['mint','bind','operation','role','check','clear'])test('closure during '+boundary+' prevents requester commit and retires the ticket',async()=>{
 let changed=false;const f=fixture({after:async(call,s)=>{
  const matches=(boundary==='mint'&&call.kind==='issuer'&&call.sql==='COMMIT'&&call.client.mint)||(boundary==='bind'&&call.sql?.includes('bind_lifecycle_request_context'))||(boundary==='operation'&&call.sql?.includes('submit_lifecycle_request'))||(boundary==='role'&&call.kind==='requester'&&call.sql?.startsWith('SELECT current_user')&&call.client.bound)||(boundary==='check'&&call.sql?.includes('check_lifecycle_request_context'))||(boundary==='clear'&&call.sql?.includes('clear_lifecycle_request_context'));
  if(matches&&!changed){changed=true;s.available=false;}
 }});
 await assert.rejects(f.repository.submit(actor,submission(),f.admit),known);assert.equal(changed,true);assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,0);assert.equal(retirements(f.state).length,1);
});
test('identity admission failure after staged SQL changes rolls back without a success receipt',async()=>{
 const f=fixture({after:async(call,s)=>{if(call.sql?.includes('submit_lifecycle_request'))s.identity=false;}});
 await assert.rejects(f.repository.submit(actor,submission(),f.admit),known);assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,0);
});
test('availability is checked synchronously after the final admission await and before COMMIT',async()=>{
 const f=fixture();f.state.admissionHook=async()=>{if(f.state.calls.some(c=>c.sql?.includes('clear_lifecycle_request_context')))f.state.available=false;};
 await assert.rejects(f.repository.submit(actor,submission(),f.admit),known);assert.equal(f.state.writes,0);assert.equal(mainCommits(f.state).length,0);
});
test('lost issuer commit acknowledgement never dispatches requester mutation and still attempts retirement',async()=>{
 const f=fixture({after:async call=>{if(call.kind==='issuer'&&call.sql==='COMMIT'&&call.client.mint)throw Error('ISSUER-PASSWORD-CANARY');}});
 await assert.rejects(f.repository.submit(actor,submission(),f.admit),known);assert.equal(f.state.writes,0);assert.equal(f.state.calls.some(c=>c.sql?.includes('bind_lifecycle_request_context')),false);assert.equal(retirements(f.state).length,1);
});
test('lost requester COMMIT acknowledgement returns only unconfirmed operation binding and never retries',async()=>{
 let lost=true;const f=fixture({after:async call=>{if(lost&&call.kind==='requester'&&call.sql==='COMMIT'){lost=false;throw Error('COMMIT-PASSWORD-CANARY');}}});let failure;
 await assert.rejects(f.repository.submit(actor,submission(),f.admit),error=>{failure=error;return unknown(error);});
 assert.deepEqual(failure.recovery,{operationId:O,fingerprint:submission().fingerprint});assert.equal(f.state.writes,1);assert.equal(mainCommits(f.state).length,1);
 assert.ok(f.state.calls.some(c=>c.kind==='requester'&&c.release&&c.bad));
 const result=await f.repository.recover(actor,failure.recovery,f.admit);assert.equal(result.requestId,R);assert.equal(f.state.writes,1);
 const mint=f.state.calls.filter(c=>c.sql?.includes('issue_lifecycle_request_ticket')).at(-1);assert.equal(mint.args[3],'recover');assert.equal(mint.args[4],null);assert.equal(mint.args[5],O);assert.equal(mint.args[6],failure.recovery.fingerprint);
});
for(const boundary of ['commit','release','retirement','final-identity'])test('completed write failure during '+boundary+' retains exact recovery and never claims rollback',async()=>{
 const f=fixture({after:async(call,s)=>{
  if(boundary==='commit'&&call.kind==='requester'&&call.sql==='COMMIT')s.enabled=false;
  if(boundary==='retirement'&&call.sql?.includes('invalidate_lifecycle_request_ticket'))s.enabled=false;
  if(boundary==='final-identity'&&call.sql?.includes('invalidate_lifecycle_request_ticket'))s.identity=false;
 }});
 if(boundary==='release')f.state.releaseHook=({kind})=>{if(kind==='requester')throw Error('RELEASE-CANARY');};
 await assert.rejects(f.repository.submit(actor,submission(),f.admit),unknown);assert.equal(f.state.writes,1);assert.equal(mainCommits(f.state).length,1);
 assert.equal(f.state.calls.some(c=>c.kind==='requester'&&c.sql==='ROLLBACK'),false);assert.equal(retirements(f.state).length,1);
});
test('ticket retirement failure denies a completed read and preserves generic errors',async()=>{
 const f=fixture({seed:pending(),before:async call=>{if(call.sql?.includes('invalidate_lifecycle_request_ticket'))throw Error('RETIREMENT-TOKEN-CANARY');}});
 await assert.rejects(f.repository.status(actor,{requestId:R},f.admit),known);assert.equal(mainCommits(f.state).length,1);
});
test('issuer retirement closure is checked by the repository even when the host feature remains enabled',async()=>{
 const f=fixture({seed:pending(),after:async(call,s)=>{if(call.sql?.includes('invalidate_lifecycle_request_ticket'))s.enabled=false;}});
 const identity={async viewer(){return {id:actor.subjectId,sessionId:'session-one',verified:true};}};
 const service=createLifecycleRequestService({identity,repository:f.repository,workspaceId:W,isEnabled:()=>true,isIntakeEnabled:()=>true,clock:()=>NOW});
 await assert.rejects(service.status(new Headers(),{requestId:R}),error=>error.code==='lifecycle_request_unavailable');assert.equal(mainCommits(f.state).length,1);
});
for(const action of ['status','submit'])test('a queued closure after final cleanup admission cannot escape through '+action+' host composition',async()=>{
 const f=fixture({seed:action==='status'?pending():null});let checksAfterRetirement=0;
 const repository=createLifecycleRequestRepository({...f.options,isEnabled:()=>{
  if(retirements(f.state).length&&++checksAfterRetirement===2)queueMicrotask(()=>{f.state.enabled=false;});
  return f.state.enabled;
 }});
 const identity={async viewer(){return {id:actor.subjectId,sessionId:'session-one',verified:true};}};
 const service=createLifecycleRequestService({identity,repository,workspaceId:W,isEnabled:()=>true,isIntakeEnabled:()=>true,clock:()=>NOW});
 let failure;await assert.rejects(service[action](new Headers(),action==='status'?{requestId:R}:input()),error=>{
  failure=error;return error.code===(action==='status'?'lifecycle_request_unavailable':'lifecycle_request_outcome_unknown');
 });
 assert.ok(checksAfterRetirement>=2);assert.equal(f.state.enabled,false);assert.equal(f.state.writes,action==='status'?0:1);
 if(action==='submit')assert.deepEqual(failure.recovery,{operationId:O,fingerprint:submission().fingerprint});
});
test('host composition preserves uncertain committed intake while recovery remains independently available',async()=>{
 let intake=true;const f=fixture({after:async call=>{if(call.sql?.includes('invalidate_lifecycle_request_ticket'))intake=false;}});
 const identity={async viewer(){return {id:actor.subjectId,sessionId:'session-one',verified:true};}};
 const service=createLifecycleRequestService({identity,repository:f.repository,workspaceId:W,isEnabled:()=>true,isIntakeEnabled:()=>intake,clock:()=>NOW});let failure;
 await assert.rejects(service.submit(new Headers(),input()),error=>{failure=error;return error instanceof LifecycleRequestOutcomeUnknownError;});assert.equal(f.state.writes,1);
 const result=await service.recover(new Headers(),failure.recovery);assert.equal(result.receipt.state,'pending');assert.equal(result.receipt.effectsVerified,false);assert.equal(f.state.writes,1);
});
test('database and rollback failures are redacted and the bad connection is discarded',async()=>{
 const f=fixture({before:async call=>{if(call.kind==='requester'&&(call.sql?.includes('submit_lifecycle_request')||call.sql==='ROLLBACK'))throw Error('DATABASE-PASSWORD-CANARY');}});
 await assert.rejects(f.repository.submit(actor,submission(),f.admit),known);assert.equal(f.state.writes,0);
 assert.ok(f.state.calls.some(c=>c.kind==='requester'&&c.release&&c.bad));
});
test('foreign, malformed or action-inconsistent SQL records are rejected before commit',async()=>{
 for(const change of [r=>pending({workspaceId:W,subjectId:'other'}),r=>pending({workspaceId:id(9),subjectId:actor.subjectId}),r=>({...r,secret:'CANARY'}),r=>({...r,state:'fulfilled'}),r=>pending(actor,{...input(),requestId:id(9)})]){
  const f=fixture({seed:pending(),after:async(call,s,result)=>call.sql?.includes('lifecycle_request_status')?{rows:[{result:change(result.rows[0].result)}]}:undefined});
  await assert.rejects(f.repository.status(actor,{requestId:R},f.admit),known);assert.equal(mainCommits(f.state).length,0);
 }
});
test('SQL result is copied before final identity awaits and cannot be mutated into a different receipt',async()=>{
 const f=fixture({seed:pending()});f.state.admissionHook=async()=>{if(f.state.output){f.state.output.claimedRecordId=id(9);f.state.output.requesterId='replacement';}};
 const result=await f.repository.status(actor,{requestId:R},f.admit);assert.equal(result.claimedRecordId,CLAIM);assert.equal(result.requesterId,actor.subjectId);assert.ok(Object.isFrozen(result));
});
test('exact submission replay and cancellation recovery preserve original operation versus current status',async()=>{
 const f=fixture();const first=await f.repository.submit(actor,submission(),f.admit),again=await f.repository.submit(actor,submission(),f.admit);assert.deepEqual(first,again);assert.equal(f.state.writes,1);
 const command=cancellation(first),cancelled=await f.repository.cancel(actor,command,f.admit);assert.equal(cancelled.state,'cancelled');assert.equal(f.state.writes,2);
 const replay=await f.repository.cancel(actor,command,f.admit);assert.deepEqual(replay,cancelled);assert.equal(f.state.writes,2);
 const original=await f.repository.recover(actor,{operationId:O,fingerprint:first.submission.fingerprint},f.admit);assert.equal(original.state,'cancelled');assert.equal(original.submission.operationId,O);
 const current=await f.repository.recover(actor,{operationId:CANCEL,fingerprint:command.fingerprint},f.admit);assert.equal(current.resolution.operationId,CANCEL);assert.equal(f.state.writes,2);
});
test('pool dependency replacement cannot swap a pinned transaction implementation',async()=>{
 const f=fixture();f.options.issuerPool.connect=async()=>{throw Error('SWAP-CANARY');};f.options.requesterPool.connect=async()=>{throw Error('SWAP-CANARY');};
 assert.equal((await f.repository.submit(actor,submission(),f.admit)).state,'pending');
});
