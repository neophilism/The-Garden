/** Trusted requester host boundary. The repository is a fixed, trusted
 * transaction implementation, not a request-provided SQL/query callback.
 * It must bind the principal, await admission and check admission.isAvailable()
 * synchronously immediately before COMMIT, and
 * return only after commit acknowledgement and connection/ticket cleanup.
 * This unmounted boundary does not implement a database or a deletion worker.
 */
import {
 validateLifecycleSubmission,validateLifecycleCancellation,validateLifecycleRequest,
 lifecycleRequestFingerprint,submitLifecycleRequest,cancelLifecycleRequest,lifecycleRequestReceipt
} from '../../../packages/domain/src/lifecycle/requests.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
export class LifecycleRequestServiceError extends Error {
 constructor(){super('Lifecycle request unavailable');this.code='lifecycle_request_unavailable';}
}
/** A write was attempted, but this boundary cannot confirm its outcome to the
 * caller. The supplied operation identity permits later authenticated readback;
 * it is not a bearer capability and does not assert commit or rollback.
 */
export class LifecycleRequestOutcomeUnknownError extends LifecycleRequestServiceError {
 constructor(operationId,fingerprint){super();this.code='lifecycle_request_outcome_unknown';this.recovery=Object.freeze({operationId,fingerprint});}
}
const fail=()=>{throw new LifecycleRequestServiceError();};
function exact(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
 const properties=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(properties);
 if(actual.length!==keys.length||actual.some(key=>typeof key!=='string'||!keys.includes(key)))fail();
 const copy={};
 for(const key of keys){const p=properties[key];if(!p?.enumerable||!Object.hasOwn(p,'value'))fail();copy[key]=p.value;}
 return copy;
}
function uuid(value){if(typeof value!=='string'||!UUID.test(value))fail();return value;}
function statusInput(input){const command=exact(input,['requestId']);uuid(command.requestId);return Object.freeze(command);}
function recoveryInput(input){const command=exact(input,['operationId','fingerprint']);uuid(command.operationId);if(typeof command.fingerprint!=='string'||!HASH.test(command.fingerprint))fail();return Object.freeze(command);}
function identifier(value){return typeof value==='string'&&value.length>0&&value.length<=128&&value.isWellFormed()&&!/[\x00-\x20\x7f]/.test(value);}
function viewer(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 const field=key=>{const p=descriptors[key];if(!p?.enumerable||!Object.hasOwn(p,'value'))fail();return p.value;};
 const id=field('id'),sessionId=field('sessionId');
 if(field('verified')!==true||!identifier(id)||!identifier(sessionId))fail();
 return Object.freeze({id,sessionId});
}
function boundMethod(value,key){const method=value?.[key];if(typeof method!=='function')fail();return method.bind(value);}
function synchronous(callback){
 const value=callback();
 // Async configuration is never accepted. Observe its rejection so a mistaken
 // callback cannot escape the sanitized boundary as an unhandled promise.
 if(value!==null&&(typeof value==='object'||typeof value==='function')){
  try{void Promise.prototype.then.call(Promise.resolve(value),undefined,()=>{});}catch{}
 }
 return value;
}
function clockValue(clock){const now=synchronous(clock);if(!Number.isSafeInteger(now)||now<0||now>=253402300800000)fail();return now;}
function operationFrom(request,operationId,fingerprint){
 let operation;
 if(request.submission.operationId===operationId&&request.submission.fingerprint===fingerprint){
  operation={operationId,fingerprint,requestId:request.requestId,revision:'1',state:'pending',recordedAt:request.createdAt,effectsVerified:false};
 }else if(request.resolution?.operationId===operationId&&request.resolution.fingerprint===fingerprint){
  const r=request.resolution;
  operation={operationId,fingerprint,requestId:request.requestId,revision:'2',state:r.state,recordedAt:r.recordedAt,effectsVerified:false};
 }else fail();
 return Object.freeze(operation);
}
function response(principal,request,operation=null){
 const receipt=lifecycleRequestReceipt(principal,request);
 return Object.freeze(operation?{receipt,operation}:{receipt});
}

export function createLifecycleRequestService({identity,repository,workspaceId,isEnabled=()=>false,isIntakeEnabled=()=>false,clock=Date.now}){
 const workspace=uuid(workspaceId),readViewer=boundMethod(identity,'viewer');
 if(typeof isEnabled!=='function'||typeof isIntakeEnabled!=='function'||typeof clock!=='function')fail();
 const methods=Object.freeze(Object.fromEntries(['submit','status','cancel','recover'].map(key=>[key,boundMethod(repository,key)])));
 const enabled=intake=>{if(synchronous(isEnabled)!==true||(intake&&synchronous(isIntakeEnabled)!==true))fail();};
 async function begin(headers,intake){
  enabled(intake);
  // Own the original credentials so caller mutation cannot switch identities
  // during a repository or admission await. Never expose them to the repository.
  const capturedHeaders=new Headers(headers),first=viewer(await readViewer(capturedHeaders));
  enabled(intake);
  const principal=Object.freeze({workspaceId:workspace,subjectId:first.id});
  const admit=async()=>{
   enabled(intake);const current=viewer(await readViewer(capturedHeaders));enabled(intake);
   if(current.id!==first.id||current.sessionId!==first.sessionId)fail();
   return true;
  };
  Object.defineProperty(admit,'isAvailable',{value:()=>{enabled(intake);return true;}});
  Object.freeze(admit);
  return {principal,admit};
 }
 async function read(headers,input,kind){
  try{
   const command=kind==='status'?statusInput(input):recoveryInput(input),{principal,admit}=await begin(headers,false);
   const record=validateLifecycleRequest(await methods[kind](principal,command,admit));
   await admit();admit.isAvailable();
   if(kind==='status'&&record.requestId!==command.requestId)fail();
   const operation=kind==='recover'?operationFrom(record,command.operationId,command.fingerprint):null;
   return response(principal,record,operation);
  }catch{fail();}
 }
 return Object.freeze({
  async submit(headers,input){
   let attempted=false,recovery;
   try{
    const command=validateLifecycleSubmission(input);clockValue(clock);
    const {principal,admit}=await begin(headers,true);
    const fingerprint=lifecycleRequestFingerprint(principal,command);
    recovery={operationId:command.operationId,fingerprint};
    await admit();admit.isAvailable();attempted=true;
    const record=validateLifecycleRequest(await methods.submit(principal,Object.freeze({input:command,fingerprint}),admit));
    const replay=submitLifecycleRequest(principal,command,clockValue(clock),record);
    await admit();admit.isAvailable();
    return response(principal,record,replay.operation);
   }catch{
    if(attempted)throw new LifecycleRequestOutcomeUnknownError(recovery.operationId,recovery.fingerprint);
    fail();
   }
  },
  status:(headers,input)=>read(headers,input,'status'),
  async cancel(headers,input){
   let attempted=false,recovery;
   try{
    const command=validateLifecycleCancellation(input);clockValue(clock);
    const {principal,admit}=await begin(headers,false);
    const current=validateLifecycleRequest(await methods.status(principal,Object.freeze({requestId:command.requestId}),admit));
    const candidate=cancelLifecycleRequest(principal,current,command,clockValue(clock));
    recovery={operationId:command.operationId,fingerprint:candidate.operation.fingerprint};
    await admit();admit.isAvailable();attempted=true;
    const record=validateLifecycleRequest(await methods.cancel(principal,Object.freeze({input:command,requestFingerprint:current.submission.fingerprint,fingerprint:recovery.fingerprint}),admit));
    const replay=cancelLifecycleRequest(principal,record,command,clockValue(clock));
    // A repository that returns the old pending row did not acknowledge the
    // requested cancellation. Never turn a locally computed proposal into proof.
    if(replay.replayed!==true||replay.operation.fingerprint!==recovery.fingerprint)fail();
    await admit();admit.isAvailable();
    return response(principal,record,replay.operation);
   }catch{
    if(attempted)throw new LifecycleRequestOutcomeUnknownError(recovery.operationId,recovery.fingerprint);
    fail();
   }
  },
  recover:(headers,input)=>read(headers,input,'recover')
 });
}
