/** Pure, private retention proposals. No function performs I/O, grants access,
 * establishes legal authority, persists a control, or disposes of material. */
import {createHash} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
const REVISION=/^[1-9][0-9]{0,18}$/;
const INSTANT=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const CLASS_RETENTION=Object.freeze({public_policy:'versioned_public_policy',public_verified_research:'versioned_with_corrections',
 restricted_research:'case_and_rights_policy',sensitive_contributor:'consent_and_legal_hold_policy',
 sealed_ciphertext:'cryptographic_key_and_policy_lifecycle',operational_security:'bounded_audit_policy',future_governmental:'requires_future_statute_and_operator'});
export const RETENTION_CLASSES=Object.freeze(Object.values(CLASS_RETENTION));
const ACTIONS=Object.freeze({rule:'lifecycle.retention-rule',place:'lifecycle.hold-place',release:'lifecycle.hold-release'});

export class RetentionError extends Error {
 constructor(){super('Retention control unavailable');this.name='RetentionError';this.code='retention_control_unavailable';}
}
const fail=()=>{throw new RetentionError();};
function exact(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(descriptors);
 if(actual.length!==keys.length||actual.some(key=>typeof key!=='string'||!keys.includes(key)))fail();
 const copy={};for(const key of keys){const d=descriptors[key];if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();copy[key]=d.value;}return copy;
}
function array(value,parse){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),length=descriptors.length?.value;
 if(!Number.isSafeInteger(length)||length>256||Reflect.ownKeys(descriptors).length!==length+1)fail();
 const result=[];for(let i=0;i<length;i++){const d=descriptors[String(i)];if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();result.push(parse(d.value));}return result;
}
function uuid(v){if(typeof v!=='string'||!UUID.test(v))fail();return v;}
function hash(v){if(typeof v!=='string'||!HASH.test(v))fail();return v;}
function revision(v){if(typeof v!=='string'||!REVISION.test(v)||BigInt(v)>9223372036854775807n)fail();return v;}
function subject(v){if(typeof v!=='string'||!v.length||v.length>128||!v.isWellFormed()||/[\x00-\x20\x7f]/.test(v))fail();return v;}
function instant(v){if(typeof v!=='string'||!INSTANT.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail();return Date.parse(v);}
function clock(now){if(!Number.isSafeInteger(now)||now<0)fail();const value=new Date(now).toISOString();instant(value);return value;}
function freeze(v){if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
function digest(kind,value){return createHash('sha256').update('garden-retention-v1\n'+kind+'\n'+JSON.stringify(value),'utf8').digest('hex');}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function scope(value){
 const s=exact(value,['workspaceId','recordId','recordRevision','classification']);uuid(s.workspaceId);uuid(s.recordId);revision(s.recordRevision);
 if(typeof s.classification!=='string'||!Object.hasOwn(CLASS_RETENTION,s.classification))fail();return s;
}
function operator(value){const p=exact(value,['workspaceId','subjectId']);uuid(p.workspaceId);subject(p.subjectId);return p;}
function commandDigest(action,context,command){
 const p=operator(context);if(command.scope&&command.scope.workspaceId!==p.workspaceId)fail();
 return digest(action,{workspaceId:p.workspaceId,subjectId:p.subjectId,command});
}
function dates(value){
 const start=instant(value.effectiveAt),end=instant(value.expiresAt),review=instant(value.reviewBy);
 if(start>=end||review<=start||review>end)fail();
}
function ruleCommand(value){
 const c=exact(value,['operationId','ruleId','revision','scope','retentionClass','basis','evidenceId','effectiveAt','expiresAt','reviewBy','retainUntil','disposeBy']);
 uuid(c.operationId);uuid(c.ruleId);revision(c.revision);c.scope=scope(c.scope);uuid(c.evidenceId);dates(c);
 if(c.retentionClass!==CLASS_RETENTION[c.scope.classification]||!['policy','preservation-exception'].includes(c.basis))fail();
 const minimum=instant(c.retainUntil),deadline=instant(c.disposeBy);
 if(minimum<instant(c.effectiveAt)||minimum>deadline||deadline>instant(c.expiresAt))fail();return c;
}
function placeCommand(value){
 const c=exact(value,['operationId','holdId','scope','reason','evidenceId','effectiveAt','expiresAt','reviewBy']);
 uuid(c.operationId);uuid(c.holdId);c.scope=scope(c.scope);uuid(c.evidenceId);dates(c);
 if(!['legal-hold','preservation-hold'].includes(c.reason))fail();return c;
}
function releaseCommand(value){
 const c=exact(value,['operationId','holdId','expectedRevision','holdFingerprint','evidenceId','reviewBy']);
 uuid(c.operationId);uuid(c.holdId);revision(c.expectedRevision);hash(c.holdFingerprint);uuid(c.evidenceId);instant(c.reviewBy);
 if(c.expectedRevision!=='1')fail();return c;
}
function proofShape(value){
 const a=exact(value,['workspaceId','subjectId','action','operationId','authorizationId','authorityEvidenceId','authorityRevision','validFrom','expiresAt','commandFingerprint']);
 uuid(a.workspaceId);subject(a.subjectId);uuid(a.operationId);uuid(a.authorizationId);uuid(a.authorityEvidenceId);revision(a.authorityRevision);hash(a.commandFingerprint);
 if(!Object.values(ACTIONS).includes(a.action)||instant(a.validFrom)>=instant(a.expiresAt))fail();return a;
}
function proof(value,action,command,target,now){
 const a=proofShape(value);
 if(a.action!==action||a.workspaceId!==target.workspaceId||a.operationId!==command.operationId||a.commandFingerprint!==commandDigest(action,{workspaceId:a.workspaceId,subjectId:a.subjectId},command)||instant(a.validFrom)>now||instant(a.expiresAt)<=now)fail();return a;
}
function event(value,action,parse,target=null){
 const e=exact(value,['command','recordedAt','authority']);e.command=parse(e.command);const when=instant(e.recordedAt);
 e.authority=proof(e.authority,action,e.command,target??e.command.scope,when);
 if(instant(e.command.reviewBy)<=when||(e.command.expiresAt&&instant(e.command.expiresAt)<=when))fail();return e;
}
function ruleSnapshot(value){
 const r=exact(value,['schemaVersion','kind','event','fingerprint']);if(r.schemaVersion!==1||r.kind!=='retention-rule')fail();
 r.event=event(r.event,ACTIONS.rule,ruleCommand);hash(r.fingerprint);
 if(r.fingerprint!==digest('rule',{schemaVersion:1,kind:r.kind,event:r.event}))fail();return freeze(r);
}
function activeHold(placement){
 const body={schemaVersion:1,kind:'hold-record',revision:'1',placement,release:null};return{...body,fingerprint:digest('hold',body)};
}
function boundRelease(command,active){
 const placed=active.placement.command;
 if(command.holdId!==placed.holdId||command.expectedRevision!==active.revision||command.holdFingerprint!==active.fingerprint||command.operationId===placed.operationId)fail();
}
function holdSnapshot(value){
 const h=exact(value,['schemaVersion','kind','revision','placement','release','fingerprint']);if(h.schemaVersion!==1||h.kind!=='hold-record')fail();
 h.placement=event(h.placement,ACTIONS.place,placeCommand);hash(h.fingerprint);const original=activeHold(h.placement);
 if(h.release===null){if(h.revision!=='1'||h.fingerprint!==original.fingerprint)fail();return freeze(original);}
 h.release=event(h.release,ACTIONS.release,releaseCommand,h.placement.command.scope);boundRelease(h.release.command,original);
 if(h.revision!=='2'||instant(h.release.recordedAt)<instant(h.placement.recordedAt))fail();
 const body={schemaVersion:1,kind:h.kind,revision:'2',placement:h.placement,release:h.release};
 if(h.fingerprint!==digest('hold',body))fail();return freeze({...body,fingerprint:h.fingerprint});
}
function proposal(record,currentEvent,replayed=false){
 return freeze({record,operation:{operationId:currentEvent.command.operationId,fingerprint:digest('operation',{command:currentEvent.command,authority:currentEvent.authority}),commandFingerprint:currentEvent.authority.commandFingerprint,
  recordedAt:currentEvent.recordedAt,effectsVerified:false},replayed,effectsVerified:false});
}

export function retentionRuleCommandFingerprint(context,input){try{return commandDigest(ACTIONS.rule,context,ruleCommand(input));}catch{fail();}}
export function holdPlacementCommandFingerprint(context,input){try{return commandDigest(ACTIONS.place,context,placeCommand(input));}catch{fail();}}
export function holdReleaseCommandFingerprint(context,current,input){try{const p=operator(context),h=holdSnapshot(current),c=releaseCommand(input);boundRelease(c,activeHold(h.placement));if(p.workspaceId!==h.placement.command.scope.workspaceId)fail();return commandDigest(ACTIONS.release,p,c);}catch{fail();}}
export function validateRetentionRule(value){try{return ruleSnapshot(value);}catch{fail();}}
export function validateHoldRecord(value){try{return holdSnapshot(value);}catch{fail();}}
// Fixed hosts snapshot commands before their first asynchronous identity read.
// These validators establish representation only, never current authority.
export function validateRetentionRuleCommand(value){try{return freeze(ruleCommand(value));}catch{fail();}}
export function validateHoldPlacementCommand(value){try{return freeze(placeCommand(value));}catch{fail();}}
export function validateHoldReleaseCommand(value){try{return freeze(releaseCommand(value));}catch{fail();}}
export function validateRetentionAuthority(value){try{return freeze(proofShape(value));}catch{fail();}}

/** Trusted authority must be independently verified for the whole fingerprinted
 * command. This is a proposal, with no database CAS or authority lookup. */
export function proposeRetentionRule(authority,input,now){
 try{const command=ruleCommand(input),recordedAt=clock(now),e=event({command,recordedAt,authority},ACTIONS.rule,ruleCommand);
  const body={schemaVersion:1,kind:'retention-rule',event:e},r=ruleSnapshot({...body,fingerprint:digest('rule',body)});return proposal(r,r.event);
 }catch{fail();}
}
export function proposeHold(authority,input,now){
 try{const command=placeCommand(input),recordedAt=clock(now),placement=event({command,recordedAt,authority},ACTIONS.place,placeCommand);
  const h=holdSnapshot(activeHold(placement));return proposal(h,h.placement);
 }catch{fail();}
}
export function proposeHoldRelease(authority,current,input,now){
 try{
  const h=holdSnapshot(current),command=releaseCommand(input),recordedAt=clock(now);boundRelease(command,activeHold(h.placement));
  if(now<instant(h.release?.recordedAt??h.placement.recordedAt))fail();
  const release=event({command,recordedAt,authority},ACTIONS.release,releaseCommand,h.placement.command.scope);
  if(h.release!==null){if(!same(release.command,h.release.command)||!same(release.authority,h.release.authority))fail();return proposal(h,h.release,true);}
  const body={schemaVersion:1,kind:'hold-record',revision:'2',placement:h.placement,release};
  const next=holdSnapshot({...body,fingerprint:digest('hold',body)});return proposal(next,next.release);
 }catch{fail();}
}

function head(value){const h=exact(value,['id','revision','fingerprint']);uuid(h.id);revision(h.revision);hash(h.fingerprint);return h;}
function authorityHead(value){const h=exact(value,['authority','state']);h.authority=proofShape(h.authority);if(!['current','revoked','unresolved'].includes(h.state))fail();return h;}
function material(value){const m=exact(value,['contentVersionId','generation','envelopeDigest']);uuid(m.contentVersionId);revision(m.generation);hash(m.envelopeDigest);return m;}
function orderedUnique(values,key){
 const sorted=values.sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
 if(sorted.some((value,i)=>i>0&&key(sorted[i-1])===key(value)))fail();return sorted;
}
function currentSnapshot(value){
 const s=exact(value,['schemaVersion','scope','revision','observedAt','validUntil','controlsState','rules','holds','ruleHeads','holdHeads','authorities','inventory']);
 if(s.schemaVersion!==1||!['complete','incomplete','unresolved'].includes(s.controlsState))fail();
 s.scope=scope(s.scope);revision(s.revision);if(instant(s.observedAt)>=instant(s.validUntil))fail();
 s.rules=orderedUnique(array(s.rules,ruleSnapshot),r=>r.event.command.ruleId);
 s.holds=orderedUnique(array(s.holds,holdSnapshot),h=>h.placement.command.holdId);
 s.ruleHeads=orderedUnique(array(s.ruleHeads,head),h=>h.id);s.holdHeads=orderedUnique(array(s.holdHeads,head),h=>h.id);
 s.authorities=orderedUnique(array(s.authorities,authorityHead),h=>h.authority.authorizationId);
 s.inventory=exact(s.inventory,['scope','revision','state','evidenceId','materials']);s.inventory.scope=scope(s.inventory.scope);revision(s.inventory.revision);uuid(s.inventory.evidenceId);
 if(!['complete','incomplete','unresolved'].includes(s.inventory.state))fail();
 s.inventory.materials=orderedUnique(array(s.inventory.materials,material),m=>m.contentVersionId+'\n'+m.generation);
 return s;
}
function output(evaluatedAt,target,status,reasons,binding=null){
 return freeze({schemaVersion:1,kind:'retention-dry-run',scope:target,status,reasonCodes:[...new Set(reasons)].sort(),evaluatedAt,snapshotFingerprint:binding,effectsVerified:false});
}

/** Evaluate a host-established current snapshot. A matching fingerprint is not
 * proof that the host supplied every hold or the latest database state. Every
 * result is an internal review proposal, never a disposal or access capability. */
export function evaluateRetention(expected,current,now){
 let evaluatedAt=null,target=null;
 try{
  evaluatedAt=clock(now);const e=exact(expected,['scope','controlRevision','inventoryRevision']);e.scope=scope(e.scope);revision(e.controlRevision);revision(e.inventoryRevision);target=e.scope;
  const s=currentSnapshot(current),reasons=[],binding=digest('snapshot',s),add=reason=>reasons.push(reason);
  if(!same(e.scope,s.scope)||!same(e.scope,s.inventory.scope))add('scope-mismatch');
  if(e.controlRevision!==s.revision)add('stale-control-revision');if(e.inventoryRevision!==s.inventory.revision)add('stale-inventory-revision');
  if(instant(s.observedAt)>now||instant(s.validUntil)<=now)add('stale-snapshot');
  if(s.controlsState!=='complete')add('incomplete-controls');if(s.inventory.state!=='complete'||s.inventory.materials.length===0)add('incomplete-material-inventory');
  if(s.scope.classification==='future_governmental')add('conditional-classification');
  if(s.rules.length===0)add('missing-retention-rule');
  const currentHead=(heads,id,rev,fingerprint)=>heads.some(h=>h.id===id&&h.revision===rev&&h.fingerprint===fingerprint);
  if(s.ruleHeads.length!==s.rules.length)add('unresolved-rule-heads');if(s.holdHeads.length!==s.holds.length)add('unresolved-hold-heads');
  const usedAuthorities=new Set([...s.rules.map(r=>r.event.authority.authorizationId),...s.holds.map(h=>(h.release?.authority??h.placement.authority).authorizationId)]);
  if(s.authorities.length!==usedAuthorities.size||s.authorities.some(h=>!usedAuthorities.has(h.authority.authorizationId)))add('unresolved-authority-heads');
  const authorityCurrent=a=>{
   const found=s.authorities.find(h=>h.authority.authorizationId===a.authorizationId);
   if(!found||found.state!=='current'||!same(found.authority,a)||instant(a.validFrom)>now||instant(a.expiresAt)<=now)add('authority-not-current');
  };
  const eventCurrent=e=>{if(instant(e.recordedAt)>instant(s.observedAt)||instant(e.recordedAt)>now)add('future-control-event');};
  let retainUntil=0,disposeBy=Infinity,activeHolds=0;
  for(const r of s.rules){
   const c=r.event.command;if(!same(c.scope,s.scope))add('scope-mismatch');
   if(!currentHead(s.ruleHeads,c.ruleId,c.revision,r.fingerprint))add('stale-rule-version');authorityCurrent(r.event.authority);eventCurrent(r.event);
   if(instant(c.effectiveAt)>now)add('rule-not-effective');if(instant(c.expiresAt)<=now)add('rule-expired');if(instant(c.reviewBy)<=now)add('rule-review-overdue');
   retainUntil=Math.max(retainUntil,instant(c.retainUntil));disposeBy=Math.min(disposeBy,instant(c.disposeBy));
  }
  for(const h of s.holds){
   const c=h.placement.command;if(!same(c.scope,s.scope))add('scope-mismatch');
   if(!currentHead(s.holdHeads,c.holdId,h.revision,h.fingerprint))add('stale-hold-version');
   eventCurrent(h.placement);
   if(h.release!==null){authorityCurrent(h.release.authority);eventCurrent(h.release);if(instant(h.release.command.reviewBy)<=now)add('hold-release-review-overdue');continue;}
   authorityCurrent(h.placement.authority);
   if(instant(c.effectiveAt)>now)add('hold-not-effective');if(instant(c.expiresAt)<=now)add('hold-expired-unreleased');if(instant(c.reviewBy)<=now)add('hold-review-overdue');
   activeHolds++;
  }
  if(retainUntil>disposeBy)add('conflicting-retention-periods');
  if(s.rules.length&&now>=disposeBy)add('retention-deadline-overdue');
  if(reasons.length)return output(evaluatedAt,target,'review-required',reasons,binding);
  if(activeHolds)return output(evaluatedAt,target,'retain',['active-hold'],binding);
  if(now<retainUntil)return output(evaluatedAt,target,'retain',['retention-period-active'],binding);
  return output(evaluatedAt,target,'review-disposal',['retention-window-reached'],binding);
 }catch{return output(evaluatedAt,target,'review-required',['invalid-or-incomplete-facts']);}
}
