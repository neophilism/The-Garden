/** Exact private storage protocol for the bounded retention-control host.
 * A fingerprint or valid record is not an authority or an erasure capability. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {validateRetentionRuleCommand,validateHoldPlacementCommand,validateHoldReleaseCommand,
 validateRetentionAuthority,validateRetentionRule,validateHoldRecord,
 proposeRetentionRule,proposeHold,proposeHoldRelease} from './retention.mjs';

export const LIFECYCLE_CONTROL_ACTIONS=Object.freeze(['lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
const MAX=9223372036854775807n;
export class LifecycleControlError extends Error{constructor(){super('Lifecycle control unavailable');this.code='lifecycle_control_unavailable';}}
const fail=()=>{throw new LifecycleControlError();};
export const controlGuard=work=>{try{return work();}catch{fail();}};
export function controlOwned(input){
 const active=new Set();let count=0,bytes=0;
 const text=v=>{if(!v.isWellFormed()||(bytes+=Buffer.byteLength(v,'utf8'))>262144)fail();return v;};
 function copy(v,depth){
  if(++count>20000||depth>24)fail();
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='string')return text(v);
  if(typeof v==='number'){if(!Number.isFinite(v))fail();return v;}
  if(typeof v!=='object'||types.isProxy(v)||active.has(v))fail();
  const list=Array.isArray(v);if(Object.getPrototypeOf(v)!==(list?Array.prototype:Object.prototype))fail();
  const ds=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(ds),length=list?ds.length.value:null;
  if(list&&(!Number.isSafeInteger(length)||length>256||keys.length!==length+1)||!list&&keys.length>64)fail();
  active.add(v);const out=list?[]:{};
  for(const key of keys){
   if(typeof key!=='string'||['__proto__','constructor','prototype','toJSON'].includes(key))fail();
   if(list&&key==='length')continue;
   const d=ds[key];if(!d.enumerable||!Object.hasOwn(d,'value')||list&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=length))fail();
   text(key);Object.defineProperty(out,key,{value:copy(d.value,depth+1),enumerable:true,writable:true,configurable:true});
  }
  active.delete(v);return out;
 }
 return copy(input,0);
}
export function controlExact(v,fields){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))fail();return Object.fromEntries(fields.map(k=>[k,v[k]]));}
export function controlFreeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))controlFreeze(x);Object.freeze(v);}return v;}
export function controlUUID(v){if(typeof v!=='string'||!UUID.test(v))fail();return v;}
export function controlHash(v){if(typeof v!=='string'||!HASH.test(v))fail();return v;}
export function controlRevision(v,zero=false){if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(v)||BigInt(v)>MAX||!zero&&v==='0')fail();return v;}
export function controlInstant(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail();return v;}
export function controlPrincipal(v,workspace=null){return controlGuard(()=>{
 const p=controlExact(controlOwned(v),['workspaceId','subjectId']);controlUUID(p.workspaceId);
 if(workspace!==null&&p.workspaceId!==workspace||typeof p.subjectId!=='string'||!p.subjectId.length||p.subjectId.length>128||/[\x00-\x20\x7f]/.test(p.subjectId))fail();
 return controlFreeze(p);
});}
export function validateControlScope(v){return controlGuard(()=>{
 const s=controlExact(controlOwned(v),['workspaceId','recordId','recordRevision','classification']);controlUUID(s.workspaceId);controlUUID(s.recordId);controlRevision(s.recordRevision);
 if(s.classification!=='restricted_research')fail();return controlFreeze(s);
});}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=(profile,v)=>createHash('sha256').update(profile+'\n'+JSON.stringify(v),'utf8').digest('hex');
export function validateControlIntent(v){return controlGuard(()=>{
 const i=controlExact(controlOwned(v),['action','scope','command','expectedControlRevision','expectedFingerprint']);
 if(!LIFECYCLE_CONTROL_ACTIONS.includes(i.action))fail();i.scope=validateControlScope(i.scope);controlRevision(i.expectedControlRevision,true);
 if(i.action==='lifecycle.retention-rule'){
  i.command=validateRetentionRuleCommand(i.command);if(i.command.revision==='1'){if(i.expectedFingerprint!==null)fail();}else controlHash(i.expectedFingerprint);
 }else if(i.action==='lifecycle.hold-place'){
  i.command=validateHoldPlacementCommand(i.command);if(i.expectedFingerprint!==null)fail();
 }else{
  i.command=validateHoldReleaseCommand(i.command);if(i.expectedFingerprint!==i.command.holdFingerprint)fail();
 }
 if(i.command.scope&&!same(i.scope,i.command.scope))fail();return controlFreeze(i);
});}
export function controlMethodIntent(method,value){return controlGuard(()=>{
 const c=controlOwned(value);let i;
 if(method==='putRule'){const v=controlExact(c,['command','expectedControlRevision','expectedFingerprint']);i={action:LIFECYCLE_CONTROL_ACTIONS[0],scope:v.command?.scope,command:v.command,expectedControlRevision:v.expectedControlRevision,expectedFingerprint:v.expectedFingerprint};}
 else if(method==='placeHold'){const v=controlExact(c,['command','expectedControlRevision']);i={action:LIFECYCLE_CONTROL_ACTIONS[1],scope:v.command?.scope,command:v.command,expectedControlRevision:v.expectedControlRevision,expectedFingerprint:null};}
 else if(method==='releaseHold'){const v=controlExact(c,['scope','command','expectedControlRevision']);i={action:LIFECYCLE_CONTROL_ACTIONS[2],scope:v.scope,command:v.command,expectedControlRevision:v.expectedControlRevision,expectedFingerprint:v.command?.holdFingerprint};}
 else fail();return validateControlIntent(i);
});}
export function lifecycleControlIntentFingerprint(principal,input){return controlGuard(()=>{
 const p=controlPrincipal(principal),intent=validateControlIntent(input);if(p.workspaceId!==intent.scope.workspaceId)fail();
 return digest('garden-lifecycle-control-intent-v1',{workspaceId:p.workspaceId,subjectId:p.subjectId,intent});
});}
export function lifecycleControlCommandFingerprint(principal,input){return controlGuard(()=>{
 const p=controlPrincipal(principal),intent=validateControlIntent(input);if(p.workspaceId!==intent.scope.workspaceId)fail();
 return digest('garden-retention-v1\n'+intent.action,{workspaceId:p.workspaceId,subjectId:p.subjectId,command:intent.command});
});}
export function lifecycleControlReadFingerprint(principal,scope,operationId){return controlGuard(()=>{
 const p=controlPrincipal(principal),s=validateControlScope(scope);controlUUID(operationId);if(p.workspaceId!==s.workspaceId)fail();
 return digest('garden-lifecycle-control-read-v1',{workspaceId:p.workspaceId,subjectId:p.subjectId,scope:s,operationId});
});}
export function controlRecord(value){return controlGuard(()=>{
 const v=controlOwned(value);return v.kind==='retention-rule'?validateRetentionRule(v):validateHoldRecord(v);
});}
export const controlRecordScope=r=>r.kind==='retention-rule'?r.event.command.scope:r.placement.command.scope;
export const controlRecordId=r=>r.kind==='retention-rule'?r.event.command.ruleId:r.placement.command.holdId;
export const controlRecordRevision=r=>r.kind==='retention-rule'?r.event.command.revision:r.revision;
export function validateControlPreparation(principal,input,value){return controlGuard(()=>{
 const p=controlPrincipal(principal),intent=validateControlIntent(input),r=controlExact(controlOwned(value),['scope','controlRevision','current','grant','authority','intentFingerprint']);
 r.scope=validateControlScope(r.scope);if(!same(r.scope,intent.scope))fail();controlRevision(r.controlRevision,true);
 if(r.intentFingerprint!==lifecycleControlIntentFingerprint(p,intent))fail();
 const g=controlExact(r.grant,['grantId','revision','evidenceId','evidenceRevision','validFrom','expiresAt']);
 for(const k of ['grantId','evidenceId'])controlUUID(g[k]);for(const k of ['revision','evidenceRevision'])controlRevision(g[k]);for(const k of ['validFrom','expiresAt'])controlInstant(g[k]);
 if(Date.parse(g.validFrom)>=Date.parse(g.expiresAt))fail();r.grant=g;r.authority=validateRetentionAuthority(r.authority);
 const a=r.authority;if(a.workspaceId!==p.workspaceId||a.subjectId!==p.subjectId||a.action!==intent.action||a.operationId!==intent.command.operationId||a.authorizationId!==intent.command.operationId||a.authorityEvidenceId!==g.evidenceId||a.authorityRevision!==g.revision||a.validFrom!==g.validFrom||a.expiresAt!==g.expiresAt||a.commandFingerprint!==lifecycleControlCommandFingerprint(p,intent))fail();
 if(r.current!==null){r.current=controlRecord(r.current);if(!same(controlRecordScope(r.current),r.scope)||controlRecordId(r.current)!==(intent.command.ruleId??intent.command.holdId)||r.current.kind!==(intent.action===LIFECYCLE_CONTROL_ACTIONS[0]?'retention-rule':'hold-record'))fail();}
 if(intent.action==='lifecycle.hold-release'&&r.current===null)fail();return controlFreeze(r);
});}
export function validateControlCommit(principal,input){return controlGuard(()=>{
 const p=controlPrincipal(principal),c=controlExact(controlOwned(input),['intent','intentFingerprint','grantId','grantRevision','authority','proposalFingerprint','fingerprint']);
 c.intent=validateControlIntent(c.intent);controlUUID(c.grantId);controlRevision(c.grantRevision);c.authority=validateRetentionAuthority(c.authority);controlHash(c.proposalFingerprint);controlHash(c.fingerprint);
 if(c.intentFingerprint!==lifecycleControlIntentFingerprint(p,c.intent))fail();
 const a=c.authority;if(a.workspaceId!==p.workspaceId||a.subjectId!==p.subjectId||a.operationId!==c.intent.command.operationId||a.authorizationId!==a.operationId||a.action!==c.intent.action||a.authorityRevision!==c.grantRevision||a.commandFingerprint!==lifecycleControlCommandFingerprint(p,c.intent))fail();
 const proposalFingerprint=digest('garden-retention-v1\noperation',{command:c.intent.command,authority:c.authority});
 if(c.proposalFingerprint!==proposalFingerprint||c.fingerprint!==digest('garden-lifecycle-control-operation-v1',{intentFingerprint:c.intentFingerprint,grantId:c.grantId,grantRevision:c.grantRevision,authority:c.authority,proposalFingerprint}))fail();
 return controlFreeze(c);
});}
export function buildControlCommit(principal,input,prepared,now){return controlGuard(()=>{
 const p=controlPrincipal(principal),intent=validateControlIntent(input),r=validateControlPreparation(p,intent,prepared);
 const proposal=intent.action===LIFECYCLE_CONTROL_ACTIONS[0]?proposeRetentionRule(r.authority,intent.command,now):intent.action===LIFECYCLE_CONTROL_ACTIONS[1]?proposeHold(r.authority,intent.command,now):proposeHoldRelease(r.authority,r.current,intent.command,now);
 const c={intent,intentFingerprint:r.intentFingerprint,grantId:r.grant.grantId,grantRevision:r.grant.revision,authority:r.authority,proposalFingerprint:proposal.operation.fingerprint};
 c.fingerprint=digest('garden-lifecycle-control-operation-v1',{intentFingerprint:c.intentFingerprint,grantId:c.grantId,grantRevision:c.grantRevision,authority:c.authority,proposalFingerprint:c.proposalFingerprint});
 return validateControlCommit(p,c);
});}
export function validateControlRecovery(value){return controlGuard(()=>{
 const r=controlExact(controlOwned(value),['scope','operationId','fingerprint']);r.scope=validateControlScope(r.scope);controlUUID(r.operationId);controlHash(r.fingerprint);return controlFreeze(r);
});}
export function controlRecovery(commit){return controlFreeze({scope:commit.intent.scope,operationId:commit.intent.command.operationId,fingerprint:commit.fingerprint});}
export function validateControlResult(principal,reference,value,expectedCommit=null){return controlGuard(()=>{
 const p=controlPrincipal(principal),q=validateControlRecovery(reference),r=controlExact(controlOwned(value),['record','receipt','operation']);r.record=controlRecord(r.record);r.operation=validateControlCommit(p,r.operation);
 if(!same(controlRecovery(r.operation),q)||expectedCommit!==null&&!same(r.operation,validateControlCommit(p,expectedCommit)))fail();
 const e=controlExact(r.receipt,['operationId','fingerprint','action','scope','controlId','revision','controlRevision','recordFingerprint','auditSequence','recordedAt','committed','effectsVerified']);
 e.scope=validateControlScope(e.scope);for(const k of ['operationId','controlId'])controlUUID(e[k]);for(const k of ['fingerprint','recordFingerprint'])controlHash(e[k]);for(const k of ['revision','controlRevision','auditSequence'])controlRevision(e[k]);controlInstant(e.recordedAt);
 if(!LIFECYCLE_CONTROL_ACTIONS.includes(e.action)||e.committed!==true||e.effectsVerified!==false||p.workspaceId!==q.scope.workspaceId||!same(e.scope,q.scope)||e.operationId!==q.operationId||e.fingerprint!==q.fingerprint||!same(controlRecordScope(r.record),q.scope)||controlRecordId(r.record)!==e.controlId||controlRecordRevision(r.record)!==e.revision||r.record.fingerprint!==e.recordFingerprint)fail();
 const event=r.record.kind==='retention-rule'?r.record.event:e.action==='lifecycle.hold-place'?r.record.placement:r.record.release;
 if(!event||event.command.operationId!==e.operationId||event.authority.subjectId!==p.subjectId||event.authority.action!==e.action||event.recordedAt!==e.recordedAt||!same(event.command,r.operation.intent.command)||!same(event.authority,r.operation.authority)||e.action!==r.operation.intent.action||e.controlRevision!==(BigInt(r.operation.intent.expectedControlRevision)+1n).toString())fail();
 r.receipt=e;return controlFreeze(r);
});}
export function validateControlStatus(scope,value){return controlGuard(()=>{
 const s=validateControlScope(scope),r=controlExact(controlOwned(value),['scope','controlRevision','records','effectsVerified']);r.scope=validateControlScope(r.scope);controlRevision(r.controlRevision,true);
 if(!same(s,r.scope)||r.effectsVerified!==false||!Array.isArray(r.records)||r.records.length>256)fail();
 r.records=r.records.map(controlRecord);const ids=new Set();
 for(const record of r.records){const id=controlRecordId(record);if(ids.has(id)||!same(controlRecordScope(record),s))fail();ids.add(id);}
 return controlFreeze(r);
});}
/** Internal delivery receipt only. ASCII schema keys are sorted independently
 * of JSONB order; private scalar values are preserved byte-for-byte as JSON. */
export function lifecycleControlResultFingerprint(value){return controlGuard(()=>{
 const owned=controlOwned(value);
 const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>{if(!/^[A-Za-z][A-Za-z0-9]*$/.test(k))fail();return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}';
 return createHash('sha256').update('garden-lifecycle-control-result-v1\n'+canonical(owned),'utf8').digest('hex');
});}
/** Private repository transport. Hosts must retain this deadline through their
 * final awaited identity check, then expose only value to the caller. */
export function validateControlDelivery(input){return controlGuard(()=>{
 const r=controlExact(controlOwned(input),['value','admission']);
 r.admission=controlExact(r.admission,['expiresAt','resultFingerprint']);controlInstant(r.admission.expiresAt);controlHash(r.admission.resultFingerprint);
 if(r.admission.resultFingerprint!==lifecycleControlResultFingerprint(r.value))fail();return controlFreeze(r);
});}
