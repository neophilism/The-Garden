/** Scoped research review. No status, import or validation constitutes verification of a whole work. */
import rules from './rules.json' with {type:'json'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA=/^[0-9a-f]{64}$/;
export class ReviewError extends Error {constructor(){super('Scoped review unavailable or incompatible');this.code='review_unavailable';}}
const fail=()=>{throw new ReviewError();};
function exact(v,keys){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).sort().join('|')!==[...keys].sort().join('|'))fail();}
function text(v,max,{verbatim=false}={}){if(typeof v!=='string'||!v.trim()||v.length>max||!v.isWellFormed()||/[\x00\x7f]/.test(v)||(!verbatim&&/[\x01-\x1f]/.test(v)))fail();return v;}
export function reviewId(v){if(typeof v!=='string'||!UUID.test(v))fail();return v;}
export function reviewVersion(v,{zero=false}={}){if(typeof v!=='string'||!(zero?/^(0|[1-9][0-9]{0,18})$/:/^[1-9][0-9]{0,18}$/).test(v)||BigInt(v)>9223372036854775807n)fail();return v;}
const immutable=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(immutable);Object.freeze(v);}return v;};
export const REVIEW_RULES=immutable(structuredClone(rules));
const RESEARCH_ROLES=new Set(['contributor','transcriber','translator','researcher','editor','reviewer','rights_reviewer','community_adviser','moderator','administrator','auditor']);
export const REVIEW_AXES=Object.freeze(rules.axes.map(x=>x.id));
export function ruleFor(axis){const r=REVIEW_RULES.axes.find(x=>x.id===axis);if(!r)fail();return r;}
export function initialReviewStates(){return immutable(Object.fromEntries(REVIEW_RULES.axes.map(x=>[x.id,x.initial])));}
export function validateReviewEvidence(evidence){
 if(!Array.isArray(evidence)||evidence.length>32)fail();const seen=new Set();
 for(const e of evidence){exact(e,['recordId','revision']);reviewId(e.recordId);reviewVersion(e.revision);const key=e.recordId+':'+e.revision;if(seen.has(key))fail();seen.add(key);}
 return immutable(structuredClone(evidence));
}
export function validateReviewTransition(v){
 exact(v,['axis','fromState','toState','expectedVersion','assignmentId','evidence','rationale']);
 const r=ruleFor(v.axis);reviewVersion(v.expectedVersion,{zero:true});
 if(!r.states.includes(v.fromState)||!r.states.includes(v.toState)||v.toState==='disputed'||!(r.transitions[v.fromState]??[]).includes(v.toState))fail();
 if(v.assignmentId!==null)reviewId(v.assignmentId);text(v.rationale,2000);validateReviewEvidence(v.evidence);
 const needsAssignment=r.independentStates.includes(v.toState)&&r.assignmentKind!==null;
 if(needsAssignment?v.assignmentId===null:v.assignmentId!==null)fail();
 if(r.passing.includes(v.toState)&&v.evidence.length===0)fail();
 return immutable(structuredClone(v));
}
export function validateReviewReopening(v){
 exact(v,['axis','fromState','expectedVersion','evidence','rationale']);const r=ruleFor(v.axis);
 if(!(r.transitions[v.fromState]??[]).includes('disputed'))fail();reviewVersion(v.expectedVersion,{zero:true});text(v.rationale,2000);validateReviewEvidence(v.evidence);
 return immutable(structuredClone(v));
}
export function validateImportedReview(v){
 exact(v,['axis','expectedVersion','namespace','verbatim','evidence']);ruleFor(v.axis);reviewVersion(v.expectedVersion,{zero:true});
 text(v.namespace,300);text(v.verbatim,2000,{verbatim:true});validateReviewEvidence(v.evidence);if(v.evidence.length===0)fail();
 // Even an exact imported word such as 'cleared' or 'verified' remains an observation.
 return immutable(structuredClone(v));
}
/** Trusted repository/SQL code must obtain all authority facts independently of the request. */
export function reviewTransitionAllowed(transition,authority){
 try{
  const v=validateReviewTransition(transition),r=ruleFor(v.axis);
  exact(authority,['subjectId','roles','authors','authorshipComplete','assignment','currentRevision','publicUseAllowed','consentBasis','otherAxesPassing']);
  text(authority.subjectId,128);if(!Array.isArray(authority.roles)||!Array.isArray(authority.authors)||authority.authors.length<1||authority.authors.length>256||authority.roles.length<1||authority.roles.length>11)fail();
  authority.roles.forEach(x=>{text(x,40);if(!RESEARCH_ROLES.has(x))fail();});authority.authors.forEach(x=>text(x,128));
  if(new Set(authority.roles).size!==authority.roles.length||new Set(authority.authors).size!==authority.authors.length||!['no-consent-required','consent-required','inherits-only',null].includes(authority.consentBasis))fail();
  for(const flag of ['authorshipComplete','currentRevision','publicUseAllowed','otherAxesPassing'])if(typeof authority[flag]!=='boolean')fail();
  if(!authority.currentRevision||!authority.roles.some(role=>(r.roles[v.toState]??[]).includes(role)))return false;
  if(r.independentStates.includes(v.toState)){
   if(!authority.authorshipComplete||authority.authors.includes(authority.subjectId))return false;
   if(r.assignmentKind!==null){
    const a=authority.assignment;exact(a,['id','kind','reviewer','scopeCurrent','active']);reviewId(a.id);
    if(a.id!==v.assignmentId||a.kind!==r.assignmentKind||a.reviewer!==authority.subjectId||a.scopeCurrent!==true||a.active!==true)return false;
   }
  }
  if(v.axis==='consent'&&['documented','not-required'].includes(v.toState)){
   if(!authority.publicUseAllowed)return false;
   if(v.toState==='not-required'&&authority.consentBasis!=='no-consent-required')return false;
   if(v.toState==='documented'&&!['consent-required','inherits-only'].includes(authority.consentBasis))return false;
  }
  if(v.axis==='consent'&&v.toState==='withdrawn'&&authority.publicUseAllowed)return false;
  if(v.axis==='publication'&&v.toState==='ready-for-release-review'&&(!authority.otherAxesPassing||!authority.publicUseAllowed))return false;
  return true;
 }catch{return false;}
}
export function validateReviewSnapshot(v){
 exact(v,['schemaVersion','scope','version','states','currentRevision','publicUseAllowed','publicationReleased']);
 if(v.schemaVersion!==1||v.publicationReleased!==false||typeof v.publicUseAllowed!=='boolean')fail();
 exact(v.scope,['id','recordId','revision','digest','digestProfile','coverage','authorshipComplete']);
 reviewId(v.scope.id);reviewId(v.scope.recordId);reviewVersion(v.scope.revision);reviewVersion(v.currentRevision);
 if(typeof v.scope.digest!=='string'||!SHA.test(v.scope.digest)||v.scope.digestProfile!=='postgres-jsonb-text-sha256'||v.scope.coverage!=='exact-record-revision'||typeof v.scope.authorshipComplete!=='boolean')fail();
 reviewVersion(v.version,{zero:true});exact(v.states,REVIEW_AXES);for(const axis of REVIEW_AXES)if(!ruleFor(axis).states.includes(v.states[axis]))fail();
 return immutable(structuredClone(v));
}
const labels={acquisition:'Acquisition',transcription:'Transcription','evidentiary-review':'Evidence review',rights:'Rights',consent:'Consent basis',accessibility:'Accessibility',publication:'Publication'};
const statusLabels={'unassessed':'Not assessed','private':'Private','in-progress':'Work in progress','in-review':'Review in progress',recorded:'Acquisition recorded',unavailable:'Acquisition unavailable',checked:'Scoped check recorded','not-applicable':'Not applicable within this scope',reviewed:'Scoped evidence review recorded',contested:'Interpretation contested','requires-correction':'Correction required',cleared:'Rights clearance recorded',restricted:'Rights restrictions recorded',documented:'Applicable consent basis recorded','not-required':'No-consent-required basis recorded',withdrawn:'Withdrawn', 'needs-work':'Accessibility work needed',disputed:'Reopened for review','ready-for-release-review':'Ready for separate release review'};
export function presentReview(snapshot){
 const s=validateReviewSnapshot(snapshot),current=s.currentRevision===s.scope.revision;
 const passing=REVIEW_AXES.every(axis=>ruleFor(axis).passing.includes(s.states[axis]));
 const eligible=current&&s.scope.authorshipComplete&&s.publicUseAllowed&&passing;
 const rows=REVIEW_AXES.map(axis=>({axis,label:labels[axis],state:s.states[axis],description:axis==='publication'&&s.states[axis]==='ready-for-release-review'&&!eligible?'Earlier recommendation is not currently eligible':statusLabels[s.states[axis]],scope:'Exact record revision '+s.scope.revision,current}));
 return immutable({rows,scope:s.scope,current,eligibleForReleaseReview:eligible,publicationApproved:false,wholeWorkVerified:false,requiresSeparateReleaseAcceptance:true,notice:current?'Review dimensions are independent; no overall verification is asserted.':'These reviews concern an earlier revision and do not approve the current content.'});
}
export function validateReviewHistory(v){
 exact(v,['events','nextAfter','wholeWorkVerified']);if(v.wholeWorkVerified!==false||!Array.isArray(v.events)||v.events.length>100)fail();
 if(v.nextAfter!==null)reviewVersion(v.nextAfter);let previous=0n;const ids=new Set();let scope=null;
 for(const e of v.events){
  exact(e,['id','scopeId','sequence','axis','kind','fromState','toState','actor','assignmentId','evidence','rationale','imported','recordedAt']);reviewId(e.id);reviewId(e.scopeId);reviewVersion(e.sequence);
  if(ids.has(e.id)||BigInt(e.sequence)<=previous||previous!==0n&&BigInt(e.sequence)!==previous+1n||scope!==null&&scope!==e.scopeId)fail();ids.add(e.id);previous=BigInt(e.sequence);scope=e.scopeId;
  const r=ruleFor(e.axis);if(!r.states.includes(e.fromState)||!r.states.includes(e.toState))fail();
  exact(e.actor,['subjectId','role']);text(e.actor.subjectId,128);text(e.actor.role,40);if(!(RESEARCH_ROLES.has(e.actor.role)||e.kind==='reopen'&&e.actor.role==='scoped-reader'))fail();if(e.assignmentId!==null)reviewId(e.assignmentId);validateReviewEvidence(e.evidence);
  if(typeof e.recordedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(e.recordedAt)||!Number.isFinite(Date.parse(e.recordedAt))||new Date(e.recordedAt).toISOString()!==e.recordedAt.slice(0,23)+'Z')fail();
  if(e.kind==='import-observation'){
   exact(e.imported,['namespace','verbatim']);text(e.imported.namespace,300);text(e.imported.verbatim,2000,{verbatim:true});if(e.rationale!==null||e.fromState!==e.toState||e.actor.role!=='editor'||e.evidence.length===0||e.assignmentId!==null)fail();
  }else if(e.kind==='transition'||e.kind==='reopen'){
   text(e.rationale,2000);if(e.imported!==null||!(r.transitions[e.fromState]??[]).includes(e.toState)||e.kind==='reopen'&&e.toState!=='disputed'||e.kind==='transition'&&e.toState==='disputed')fail();
  }else fail();
  if(e.kind==='transition')validateReviewTransition({axis:e.axis,fromState:e.fromState,toState:e.toState,expectedVersion:(BigInt(e.sequence)-1n).toString(),assignmentId:e.assignmentId,evidence:e.evidence,rationale:e.rationale});
 }
 if(v.nextAfter!==null&&v.nextAfter!==v.events.at(-1)?.sequence)fail();return immutable(structuredClone(v));
}
