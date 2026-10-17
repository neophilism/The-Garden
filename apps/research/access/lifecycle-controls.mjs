/** Unmounted, default-off operator boundary. Fresh UV admits an identity; the
 * fixed repository separately checks current scoped lifecycle and research
 * authority. This host never grants, seeds, erases or infers legal authority. */
import {types} from 'node:util';
import {ASSURANCE_LIFETIME_MS,sameAssurance} from '../identity/assurance.mjs';
import {
 LifecycleControlError,controlOwned,controlExact,controlFreeze,controlUUID,
 controlInstant,controlMethodIntent,controlPrincipal,validateControlScope,
 lifecycleControlIntentFingerprint,validateControlPreparation,buildControlCommit,
 controlRecovery,validateControlRecovery,validateControlResult,validateControlStatus,validateControlDelivery
} from '../../../packages/domain/src/lifecycle/control-storage.mjs';

export class LifecycleControlServiceError extends LifecycleControlError {}
export class LifecycleControlOutcomeUnknownError extends LifecycleControlServiceError {
 constructor(recovery){super();this.code='lifecycle_control_outcome_unknown';this.recovery=validateControlRecovery(recovery);}
}
const fail=()=>{throw new LifecycleControlServiceError();};
function bound(value,key){const method=value?.[key];if(typeof method!=='function')fail();return method.bind(value);}
function synchronous(callback){
 const result=callback();
 if(result!==null&&(typeof result==='object'||typeof result==='function'))try{void Promise.prototype.then.call(Promise.resolve(result),undefined,()=>{});}catch{}
 return result;
}
function time(clock){const now=synchronous(clock);if(!Number.isSafeInteger(now)||now<0||now>=253402300800000)fail();return now;}
function viewer(value,now){
 if(!value||typeof value!=='object'||types.isProxy(value)||Array.isArray(value))fail();
 const ds=Object.getOwnPropertyDescriptors(value),v={};
 for(const key of ['id','sessionId','verified','privilegedAssurance','lastStepUpAt','assuranceCredentialId']){
  const d=ds[key];if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();v[key]=d.value;
 }
 for(const key of ['id','sessionId','assuranceCredentialId'])if(typeof v[key]!=='string'||!v[key].length||v[key].length>2048||!v[key].isWellFormed()||/[\x00-\x20\x7f]/.test(v[key]))fail();
 controlInstant(v.lastStepUpAt);const at=Date.parse(v.lastStepUpAt);
 if(v.verified!==true||v.privilegedAssurance!==true||at>now||at+ASSURANCE_LIFETIME_MS<=now)fail();
 return Object.freeze(v);
}
export function createLifecycleControlService({identity,repository,workspaceId,isEnabled=()=>false,isAdministrationEnabled=()=>false,clock=Date.now}){
 const workspace=controlUUID(workspaceId),readViewer=bound(identity,'viewer'),privileged=bound(identity,'authorizePrivileged');
 const methods=Object.freeze(Object.fromEntries(['prepare','commit','status','recover'].map(key=>[key,bound(repository,key)])));
 if(typeof isEnabled!=='function'||typeof isAdministrationEnabled!=='function'||typeof clock!=='function')fail();
 const enabled=write=>{if(synchronous(isEnabled)!==true||write&&synchronous(isAdministrationEnabled)!==true)fail();};
 async function begin(headers,write){
  enabled(write);time(clock);const ownedHeaders=new Headers(headers),first=viewer(await readViewer(ownedHeaders),time(clock));enabled(write);
  const principal=controlPrincipal({workspaceId:workspace,subjectId:first.id});
  let deadline=Date.parse(first.lastStepUpAt)+ASSURANCE_LIFETIME_MS;
  const available=()=>{enabled(write);if(time(clock)>=deadline)fail();return true;};
  const receive=input=>{const r=validateControlDelivery(input);deadline=Math.min(deadline,Date.parse(r.admission.expiresAt));available();return r.value;};
  const admit=async()=>{
   available();const before=viewer(await readViewer(ownedHeaders),time(clock));available();if(!sameAssurance(first,before))fail();
   // The callback owns the exact privileged identity/action only. Independent
   // durable authority is checked by SQL; no second pool work occurs while the
   // operator transaction holds record, control or audit locks.
   const ok=await privileged(ownedHeaders,'lifecycle.administer',async value=>{
    const a=controlExact(controlOwned(value),['subjectId','sessionId','action']);available();
    return a.subjectId===first.id&&a.sessionId===first.sessionId&&a.action==='lifecycle.administer';
   });available();if(ok!==true)fail();
   const current=viewer(await readViewer(ownedHeaders),time(clock));available();if(!sameAssurance(first,current))fail();return true;
  };
  Object.defineProperties(admit,{isAvailable:{value:available},expiresAt:{value:new Date(Date.parse(first.lastStepUpAt)+ASSURANCE_LIFETIME_MS).toISOString()}});Object.freeze(admit);
  await admit();available();return {principal,admit,receive};
 }
 async function write(headers,input,method){
  let commit=null,called=false,received=false;
  try{
   const intent=controlMethodIntent(method,input);if(intent.scope.workspaceId!==workspace)fail();time(clock);
   const {principal,admit,receive}=await begin(headers,true),fingerprint=lifecycleControlIntentFingerprint(principal,intent);
   const prepared=validateControlPreparation(principal,intent,receive(await methods.prepare(principal,controlFreeze({intent,fingerprint}),admit)));
   await admit();admit.isAvailable();commit=buildControlCommit(principal,intent,prepared,time(clock));
   await admit();admit.isAvailable();called=true;
   const raw=await methods.commit(principal,commit,admit);received=true;
   const result=validateControlResult(principal,controlRecovery(commit),receive(raw),commit);
   await admit();admit.isAvailable();return result;
  }catch(error){
   if(commit&&called){
    // A fixed repository labels an acknowledged rollback separately. Any
    // returned reply or uncertain write is recovered by exact operation ID.
    const knownRollback=error?.code==='lifecycle_control_unavailable'&&error?.commitOutcome===undefined&&!received;
    if(!knownRollback)throw new LifecycleControlOutcomeUnknownError(controlRecovery(commit));
   }
   fail();
  }
 }
 async function read(headers,input,kind){
  try{
   const command=kind==='status'?controlFreeze({scope:validateControlScope(controlExact(controlOwned(input),['scope']).scope)}):validateControlRecovery(input);
   if(command.scope.workspaceId!==workspace)fail();
   const {principal,admit,receive}=await begin(headers,false),raw=receive(await methods[kind](principal,command,admit));
   const result=kind==='status'?validateControlStatus(command.scope,raw):validateControlResult(principal,command,raw);
   await admit();admit.isAvailable();return result;
  }catch{fail();}
 }
 return Object.freeze({putRule:(h,i)=>write(h,i,'putRule'),placeHold:(h,i)=>write(h,i,'placeHold'),releaseHold:(h,i)=>write(h,i,'releaseHold'),status:(h,i)=>read(h,i,'status'),recover:(h,i)=>read(h,i,'recover')});
}
