/** Consent is one independent gate, never evidence of copyright or scholarly review. */
export const USE_PURPOSES = Object.freeze(['preservation','research','public-display','name-attribution','promotional-endorsement']);
export const CONSENT_BASES = Object.freeze(['unreviewed','consent-required','no-consent-required','inherits-only']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digest = /^[a-f0-9]{64}$/;
const revision = /^[1-9][0-9]{0,17}$/;
export class ConsentError extends Error { constructor(){super('Permitted use unavailable');this.code='use_not_available';} }
const fail = () => {throw new ConsentError();};
function shape(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))fail();}
function text(value,max=128){if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f\x7f]/.test(value)||!value.isWellFormed())fail();}
function id(value){if(typeof value!=='string'||!uuid.test(value))fail();}
function hash(value){if(typeof value!=='string'||!digest.test(value))fail();}
function list(value,max,check){if(!Array.isArray(value)||value.length>max)fail();value.forEach(check);if(new Set(value.map(x=>JSON.stringify(x))).size!==value.length)fail();}
function terms(value){shape(value,['id','version','digest']);id(value.id);if(typeof value.version!=='string'||!revision.test(value.version))fail();hash(value.digest);}
function instant(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail();return Date.parse(value);}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function copy(value){return freeze(JSON.parse(JSON.stringify(value)));}
export function validateUsePolicy(value){
 shape(value,['schemaVersion','recordId','basis','inputs','terms','subjects','purposes','reasonDigest']);
 if(value.schemaVersion!==1||!CONSENT_BASES.includes(value.basis))fail();id(value.recordId);hash(value.reasonDigest);
 list(value.inputs,32,id);if(value.inputs.includes(value.recordId))fail();
 list(value.purposes,5,p=>{if(!USE_PURPOSES.includes(p))fail();});
 list(value.subjects,16,s=>{shape(s,['subjectId','authority']);text(s.subjectId);if(!['self','guardian'].includes(s.authority))fail();});
 if(new Set(value.subjects.map(s=>s.subjectId)).size!==value.subjects.length)fail();
 if(value.basis==='consent-required'){
  terms(value.terms);if(!value.subjects.length||value.purposes.length)fail();
 }else if(value.terms!==null||value.subjects.length)fail();
 if(value.basis==='no-consent-required'){
  if(!value.purposes.length||value.purposes.includes('promotional-endorsement'))fail();
 }else if(value.purposes.length)fail();
 if(value.basis==='inherits-only'&&!value.inputs.length)fail();
 return copy(value);
}
export function validateConsentGrant(value){
 shape(value,['schemaVersion','id','recordId','subjectId','grantorId','authority','authorityDigest','authorityExpiresAt','terms','purpose','derivativesAllowed','validFrom','expiresAt','evidenceDigest']);
 if(value.schemaVersion!==1||!USE_PURPOSES.includes(value.purpose)||typeof value.derivativesAllowed!=='boolean')fail();
 id(value.id);id(value.recordId);text(value.subjectId);text(value.grantorId);hash(value.evidenceDigest);terms(value.terms);
 const start=instant(value.validFrom),end=instant(value.expiresAt);if(end<=start)fail();
 if(value.authority==='self'){
  if(value.grantorId!==value.subjectId||value.authorityDigest!==null||value.authorityExpiresAt!==null)fail();
 }else if(value.authority==='guardian'){
  if(value.grantorId===value.subjectId)fail();hash(value.authorityDigest);if(instant(value.authorityExpiresAt)<=start)fail();
 }else fail();
 return copy(value);
}
export function validatePolicyTransition(previous,next){
 const n=validateUsePolicy(next);if(previous===null)return n;const p=validateUsePolicy(previous);
 if(p.recordId!==n.recordId||p.inputs.some(x=>!n.inputs.includes(x)))fail();
 if(p.basis==='consent-required'&&n.basis!=='consent-required')fail();
 if(p.basis==='consent-required'&&n.basis==='consent-required'&&(p.subjects.some(s=>!n.subjects.some(t=>t.subjectId===s.subjectId))||p.terms.id!==n.terms.id||BigInt(n.terms.version)<BigInt(p.terms.version)))fail();
 return n;
}
/** Only trusted server code supplies a complete bounded snapshot and clock.
 * An allowed result is ephemeral and never a transferable publication token. */
export function evaluatePermittedUse(snapshot){
 try{
  shape(snapshot,['recordId','purpose','policies','grants','withdrawnGrantIds','now']);
  const {recordId,purpose,policies,grants,withdrawnGrantIds,now}=snapshot;
  id(recordId);if(!USE_PURPOSES.includes(purpose)||!Number.isSafeInteger(now)||now<0)fail();
  if(!Array.isArray(policies)||policies.length>256||!Array.isArray(grants)||grants.length>4096)fail();
  const ps=policies.map(validateUsePolicy),gs=grants.map(validateConsentGrant);
  if(new Set(ps.map(p=>p.recordId)).size!==ps.length||new Set(gs.map(g=>g.id)).size!==gs.length)fail();
  list(withdrawnGrantIds,4096,id);const withdrawn=new Set(withdrawnGrantIds),index=new Map(ps.map(p=>[p.recordId,p]));
  const stack=[{id:recordId,path:[],derivative:false}],evidence=new Set();let earliest=Infinity,count=0;
  while(stack.length){
   const item=stack.pop();if(item.path.includes(item.id)||item.path.length>=32)fail();
   if(++count>256)fail();
   const p=index.get(item.id);if(!p||p.basis==='unreviewed')fail();
   if(p.basis==='no-consent-required'&&!p.purposes.includes(purpose))fail();
   if(p.basis==='consent-required')for(const required of p.subjects){
    const matching=gs.filter(g=>g.recordId===p.recordId&&g.subjectId===required.subjectId&&g.authority===required.authority&&g.purpose===purpose&&g.terms.id===p.terms.id&&g.terms.version===p.terms.version&&g.terms.digest===p.terms.digest&&!withdrawn.has(g.id)&&instant(g.validFrom)<=now&&instant(g.expiresAt)>now&&(!item.derivative||g.derivativesAllowed)&&(g.authority!=='guardian'||instant(g.authorityExpiresAt)>now));
    if(!matching.length)fail();
    // Select deterministically; no claim that this confirms the signer's legal authority.
    matching.sort((a,b)=>a.id.localeCompare(b.id));const g=matching[0];evidence.add(g.id);
    earliest=Math.min(earliest,instant(g.expiresAt),g.authority==='guardian'?instant(g.authorityExpiresAt):Infinity);
   }
   for(const parent of p.inputs)stack.push({id:parent,path:[...item.path,item.id],derivative:true});
  }
  return freeze({allowed:true,purpose,checkedAt:new Date(now).toISOString(),validUntil:earliest===Infinity?null:new Date(earliest).toISOString(),grantIds:[...evidence].sort(),publicationApproved:false,revalidateBeforeUse:true});
 }catch{return Object.freeze({allowed:false,reason:'use_not_available',publicationApproved:false});}
}
