/** Pure representation for administration of one retained hold.
 *
 * This module neither authenticates a maintainer nor establishes that a grant,
 * evidence identity, hold, or current record exists. The future fixed storage
 * boundary must create NEW purpose-bound grant/evidence identities, retain the
 * descriptor immutably from birth, reject legacy identities on this path, and
 * reject these identities on the research path. Fingerprints are not authority.
 *
 * The descriptor addresses the original hold placement and retained revision.
 * Current record metadata is separate admission state, never approval of its
 * content or an inventory. Existing v1 release/operation bytes are preserved;
 * content or inventory approval would require a new operation version. There
 * is no database, identity, clock, current-head, consent, or erasure check here.
 */
import {createHash} from 'node:crypto';
import {
 controlOwned,controlExact,controlFreeze,controlUUID,controlHash,controlRevision,
 controlInstant,controlPrincipal,validateControlScope,validateControlCommit,
} from './control-storage.mjs';
import {validateHoldRecord} from './retention.mjs';

export const HOLD_METADATA_PURPOSE='hold-administration-v1';
export const HOLD_METADATA_PROJECTION_VERSION='1';
const ACTIONS=Object.freeze(['lifecycle.inspect','lifecycle.hold-release']);
const EVIDENCE_FIELDS=Object.freeze(['operationId','evidenceId','revision','expectedFingerprint','scope','action','authorityKind','authorityReference','reviewerReference','validFrom','expiresAt','reviewBy','state']);
const GRANT_FIELDS=Object.freeze(['operationId','grantId','revision','expectedFingerprint','scope','subjectId','action','evidenceId','evidenceRevision','validFrom','expiresAt','reviewBy','state']);
const OPERATION_FIELDS=Object.freeze(['schemaVersion','kind','authorityKind','maintainer','descriptor','command','fingerprint','effectsVerified']);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=(profile,value)=>createHash('sha256').update(profile+'\n'+JSON.stringify(value),'utf8').digest('hex');

export class HoldMetadataError extends Error {
 constructor(){super('Hold metadata unavailable');this.name='HoldMetadataError';this.code='hold_metadata_unavailable';}
}
const fail=()=>{throw new HoldMetadataError();};
const guard=work=>{try{return work();}catch{fail();}};

function descriptor(value){
 const d=controlExact(value,['purpose','projectionVersion','scope','holdId','placementFingerprint']);
 if(d.purpose!==HOLD_METADATA_PURPOSE||d.projectionVersion!==HOLD_METADATA_PROJECTION_VERSION)fail();
 d.scope=validateControlScope(d.scope);controlUUID(d.holdId);controlHash(d.placementFingerprint);return d;
}
export function validateHoldMetadataDescriptor(value){return guard(()=>controlFreeze(descriptor(controlOwned(value))));}
export function holdMetadataDescriptorFingerprint(value){return guard(()=>digest('garden-lifecycle-hold-metadata-descriptor-v1',validateHoldMetadataDescriptor(value)));}

function retainedHold(d,value){
 const hold=validateHoldRecord(value),placed=hold.placement.command;
 const placementFingerprint=hold.release===null?hold.fingerprint:hold.release.command.holdFingerprint;
 if(!same(d.scope,placed.scope)||d.holdId!==placed.holdId||d.placementFingerprint!==placementFingerprint)fail();
 return hold;
}
function currentRecord(d,value){
 const r=controlExact(value,['workspaceId','recordId','version','classification','state']);
 controlUUID(r.workspaceId);controlUUID(r.recordId);controlRevision(r.version);
 if(r.workspaceId!==d.scope.workspaceId||r.recordId!==d.scope.recordId||BigInt(r.version)<BigInt(d.scope.recordRevision)
  ||r.classification!=='research'||!['active','quarantined','withdrawn'].includes(r.state))fail();
 return r;
}
/** An exact snapshot, not a statement that its supplied heads are current.
 * A retained expired or released hold remains valid historical metadata. */
export function validateHoldMetadataTarget(value){return guard(()=>{
 const t=controlExact(controlOwned(value),['descriptor','hold','currentRecord','controlRevision']);
 t.descriptor=descriptor(t.descriptor);t.hold=retainedHold(t.descriptor,t.hold);
 t.currentRecord=currentRecord(t.descriptor,t.currentRecord);controlRevision(t.controlRevision);
 if(BigInt(t.controlRevision)<BigInt(t.hold.revision))fail();
 return controlFreeze(t);
});}
/** This is the only caller-facing projection in this module. Never spread a
 * source row, proof, or command into it. Evidence references remain private
 * administrative metadata; their syntax does not establish legal authority. */
export function projectHoldMetadata(value){return guard(()=>{
 const t=validateHoldMetadataTarget(value),h=t.hold,p=h.placement.command;
 const release=h.release===null?null:{evidenceId:h.release.command.evidenceId,reviewBy:h.release.command.reviewBy,recordedAt:h.release.recordedAt};
 return controlFreeze({schemaVersion:1,kind:'hold-administration-metadata',purpose:t.descriptor.purpose,
  projectionVersion:t.descriptor.projectionVersion,originalScope:t.descriptor.scope,currentRecord:t.currentRecord,
  controlRevision:t.controlRevision,hold:{holdId:p.holdId,revision:h.revision,fingerprint:h.fingerprint,
   placementFingerprint:t.descriptor.placementFingerprint,reason:p.reason,evidenceId:p.evidenceId,
   effectiveAt:p.effectiveAt,expiresAt:p.expiresAt,reviewBy:p.reviewBy,recordedAt:h.placement.recordedAt,release},
  effectsVerified:false});
});}

function authorityCommand(kind,d,value){
 if(kind!=='evidence'&&kind!=='grant')fail();
 const c=controlExact(value,kind==='evidence'?EVIDENCE_FIELDS:GRANT_FIELDS);
 c.scope=validateControlScope(c.scope);
 if(!same(c.scope,d.scope)||!ACTIONS.includes(c.action))fail();
 controlUUID(c.operationId);controlUUID(c.evidenceId);controlRevision(c.revision);
 if(c.revision==='1'){if(c.expectedFingerprint!==null)fail();}else controlHash(c.expectedFingerprint);
 for(const key of ['validFrom','expiresAt','reviewBy'])controlInstant(c[key]);
 if(c.validFrom>=c.reviewBy||c.reviewBy>c.expiresAt)fail();
 if(kind==='evidence'){
  if(!['policy-appointment','legal-review','preservation-review'].includes(c.authorityKind)||!['verified','revoked'].includes(c.state))fail();
  controlUUID(c.authorityReference);controlUUID(c.reviewerReference);
 }else{
  controlUUID(c.grantId);controlRevision(c.evidenceRevision);
  c.subjectId=controlPrincipal({workspaceId:d.scope.workspaceId,subjectId:c.subjectId}).subjectId;
  if(!['active','revoked'].includes(c.state))fail();
 }
 return c;
}
function authorityInput(kind,value){
 const v=controlExact(value,['descriptor','command']);v.descriptor=descriptor(v.descriptor);
 v.command=authorityCommand(kind,v.descriptor,v.command);return v;
}
/** New authority-creation domain. Every descriptor and command field is bound;
 * the original 0015 authority or release hash is never treated as this hash. */
export function holdMetadataAuthorityFingerprint(maintainer,kind,value){return guard(()=>{
 const p=controlPrincipal(maintainer),v=authorityInput(kind,controlOwned(value));
 if(p.workspaceId!==v.descriptor.scope.workspaceId)fail();
 return digest('garden-lifecycle-hold-metadata-authority-'+kind+'-v1',{
  workspaceId:p.workspaceId,maintainerId:p.subjectId,descriptor:v.descriptor,command:v.command});
});}
function operation(hold,value){
 const o=controlExact(value,OPERATION_FIELDS);
 if(o.schemaVersion!==1||o.kind!=='hold-metadata-authority-operation'||o.effectsVerified!==false)fail();
 o.maintainer=controlPrincipal(o.maintainer);const v=authorityInput(o.authorityKind,{descriptor:o.descriptor,command:o.command});
 o.descriptor=v.descriptor;o.command=v.command;retainedHold(o.descriptor,hold);controlHash(o.fingerprint);
 if(o.fingerprint!==holdMetadataAuthorityFingerprint(o.maintainer,o.authorityKind,v))fail();return o;
}
/** Candidate only. Uniqueness, birth-bound purpose, predecessor/current heads,
 * and independently reviewed evidence must be enforced by durable storage. */
export function buildHoldMetadataAuthorityOperation(maintainer,kind,value){return guard(()=>{
 const v=controlExact(controlOwned(value),['descriptor','hold','command']),p=controlPrincipal(maintainer);
 const i=authorityInput(kind,{descriptor:v.descriptor,command:v.command});retainedHold(i.descriptor,v.hold);
 return controlFreeze(operation(v.hold,{schemaVersion:1,kind:'hold-metadata-authority-operation',authorityKind:kind,
  maintainer:p,descriptor:i.descriptor,command:i.command,fingerprint:holdMetadataAuthorityFingerprint(p,kind,i),effectsVerified:false}));
});}
export function validateHoldMetadataAuthorityOperation(hold,value){return guard(()=>{
 const owned=controlOwned({hold,value});return controlFreeze(operation(owned.hold,owned.value));
});}
/** Pure predecessor check, not a durable CAS. Both sides must already use the
 * new profile; no legacy grant or evidence can be upgraded by this helper. */
export function validateHoldMetadataAuthorityRevision(hold,previous,next){return guard(()=>{
 const owned=controlOwned({hold,previous,next}),a=operation(owned.hold,owned.previous),b=operation(owned.hold,owned.next);
 const id=a.authorityKind==='evidence'?'evidenceId':'grantId';
 if(a.authorityKind!==b.authorityKind||a.maintainer.workspaceId!==b.maintainer.workspaceId||!same(a.descriptor,b.descriptor)
  ||a.command[id]!==b.command[id]||a.command.action!==b.command.action||a.authorityKind==='grant'&&a.command.subjectId!==b.command.subjectId
  ||b.command.operationId===a.command.operationId||BigInt(b.command.revision)!==BigInt(a.command.revision)+1n||b.command.expectedFingerprint!==a.fingerprint)fail();
 return controlFreeze(b);
});}
/** Exact stored-operation readback/retry comparison. Reissuing an intent with
 * changed evidence, dates, actor, or target is not a retry of that operation. */
export function validateHoldMetadataAuthorityReplay(hold,expected,received){return guard(()=>{
 const owned=controlOwned({hold,expected,received}),a=operation(owned.hold,owned.expected),b=operation(owned.hold,owned.received);
 if(!same(a,b))fail();return controlFreeze(b);
});}

/** Check placement and command/proof compatibility around an UNCHANGED v1
 * release commit. A retained hold does not store the grant ID or aggregate
 * control revision, so it cannot identify the complete stored operation.
 * Use validateHoldMetadataReleaseReplay with an independently retained full
 * commit for exact readback. Neither helper proves the grant's purpose or
 * current authority; storage must resolve its mandatory birth binding and
 * current evidence, identity, and action-scoped authority. */
export function validateHoldMetadataReleaseCommit(principal,value){return guard(()=>{
 const v=controlExact(controlOwned(value),['descriptor','hold','commit']),d=descriptor(v.descriptor),h=retainedHold(d,v.hold);
 const c=validateControlCommit(principal,v.commit),i=c.intent;
 if(i.action!=='lifecycle.hold-release'||!same(i.scope,d.scope)||i.command.holdId!==d.holdId
  ||i.command.holdFingerprint!==d.placementFingerprint||i.command.operationId===h.placement.command.operationId)fail();
 if(h.release!==null&&(!same(i.command,h.release.command)||!same(c.authority,h.release.authority)))fail();
 return c;
});}
/** Exact full-operation replay against a released hold. The future storage
 * boundary must supply expectedCommit from its immutable operation history;
 * this pure comparison does not authenticate that supplied history. Canonical
 * validation preserves every v1 field and fingerprint on both sides. */
export function validateHoldMetadataReleaseReplay(principal,value){return guard(()=>{
 const v=controlExact(controlOwned(value),['descriptor','hold','expectedCommit','receivedCommit']);
 const p=controlPrincipal(principal),d=descriptor(v.descriptor),h=retainedHold(d,v.hold);
 if(h.release===null)fail();
 const expected=validateHoldMetadataReleaseCommit(p,{descriptor:d,hold:h,commit:v.expectedCommit});
 const received=validateHoldMetadataReleaseCommit(p,{descriptor:d,hold:h,commit:v.receivedCommit});
 if(!same(expected,received))fail();
 return received;
});}
