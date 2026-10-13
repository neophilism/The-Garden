/** GDN-085: prepare research-source acquisition without contacting a repository. */
import {createHash} from 'node:crypto';

export const REQUEST_KINDS=Object.freeze(['scan-request','catalog-request','permission-request','repository-correspondence','offline-lead','purchase-copy']);
export const ACCESS_FINDINGS=Object.freeze(['access-denied','robots-disallowed','paywalled','catalog-not-found','accessible','deferred-offline']);
export const OUTCOMES=Object.freeze(['fulfilled','inaccessible','catalog-not-found','deferred-offline','withdrawn']);
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURRENCY='USD';
const ROUTE=/^[a-z0-9][a-z0-9\-_.:/@]{2,179}$/;
export const reject=()=>{throw new Error('Garden acquisition request rejected');};
export function exact(v,keys){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).sort().join('|')!==[...keys].sort().join('|'))reject();}
export function uuid(v){if(typeof v!=='string'||!UUID.test(v))reject();}
export function text(v,max,{optional=false}={}){
 if(v===null&&optional)return;
 if(typeof v!=='string'||v.length===0||!v.trim()||v.length>max||/[\u0000-\u001f\u007f]/.test(v))reject();
 for(let i=0;i<v.length;i++){
  const c=v.charCodeAt(i);
  if(c>=0xd800&&c<=0xdbff){if(++i>=v.length||v.charCodeAt(i)<0xdc00||v.charCodeAt(i)>0xdfff)reject();}
  else if(c>=0xdc00&&c<=0xdfff)reject();
 }
}
export function routeKey(value){
 text(value,180);
 if(!ROUTE.test(value)||value.includes('..')||value.includes('://')||value.includes('//')||value.startsWith('/')||value.startsWith('http'))reject();
 return value;
}
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function bounded(v,max=16384){if(Buffer.byteLength(JSON.stringify(v),'utf8')>max)reject();return freeze(structuredClone(v));}
export function validateAcquisitionDraft(v){
 exact(v,['taskId','repositoryId','itemId','candidateId','routeKey','requestKind','title','notes','purpose','costMinor','currency']);
 uuid(v.taskId);uuid(v.repositoryId);
 for(const n of ['itemId','candidateId'])if(v[n]!==null)uuid(v[n]);
 routeKey(v.routeKey);if(!REQUEST_KINDS.includes(v.requestKind)||v.purpose!=='research')reject();
 text(v.title,300);text(v.notes,2000,{optional:true});
 if(!Number.isSafeInteger(v.costMinor)||v.costMinor<0||v.costMinor>100000000||v.currency!==CURRENCY)reject();
 return bounded(v);
}
export function validateAcquisitionEvent(input,kind){
 const map={
  observe:['taskId','eventId','previousEventId','finding','note','evidenceRef'],
  approve:['taskId','eventId','previousEventId','authorizationId'],
  recordContact:['taskId','eventId','previousEventId','authorizationId','occurredAt','receiptRef'],
  finish:['taskId','eventId','previousEventId','outcome','note','evidenceRef']
 };
 if(!Object.hasOwn(map,kind))reject();exact(input,map[kind]);
 for(const field of ['taskId','eventId','previousEventId'])uuid(input[field]);
 if(input.eventId===input.previousEventId||input.eventId===input.taskId)reject();
 if(kind==='observe'){
  if(!ACCESS_FINDINGS.includes(input.finding))reject();text(input.note,1000);text(input.evidenceRef,500);
 }
 if(kind==='finish'){
  if(!OUTCOMES.includes(input.outcome))reject();text(input.note,1000);text(input.evidenceRef,500);
 }
 if(kind==='approve'||kind==='recordContact')uuid(input.authorizationId);
 if(kind==='recordContact'){
  text(input.occurredAt,60);if(!Number.isFinite(Date.parse(input.occurredAt))||!input.occurredAt.endsWith('Z'))reject();
  text(input.receiptRef,500);
 }
 return bounded(input);
}
export function validateTrustedAuthority(v,task,actor,{now=Date.now()}={}){
 exact(v,['authorizationId','approvedBy','workspaceId','taskId','routeKey','requestKind','purpose','allowContact','currency','maxCostMinor','expiresAt','evidenceRef']);
 uuid(v.authorizationId);uuid(v.workspaceId);uuid(v.taskId);routeKey(v.routeKey);
 text(v.approvedBy,128);text(v.evidenceRef,500);text(v.expiresAt,60);
 if(v.approvedBy===actor||v.workspaceId!==task.workspaceId||v.taskId!==task.taskId||v.routeKey!==task.routeKey||v.requestKind!==task.requestKind||v.purpose!=='research'||v.currency!==task.currency||v.allowContact!==true||!Number.isSafeInteger(v.maxCostMinor)||v.maxCostMinor<task.costMinor||v.maxCostMinor>100000000)reject();
 const expiry=Date.parse(v.expiresAt);if(!v.expiresAt.endsWith('Z')||!Number.isFinite(expiry)||expiry<=now||expiry>now+90*86400000)reject();
 return bounded(v);
}
export function acquisitionIdempotencyDigest(v){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
export function classifyFinding(finding){
 if(!ACCESS_FINDINGS.includes(finding))reject();
 return freeze({finding,barrier:['access-denied','robots-disallowed','paywalled'].includes(finding),absenceProven:false});
}
