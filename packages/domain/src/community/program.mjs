import {createHash} from 'node:crypto';

export const RESEARCH_CHARTER = Object.freeze({version:'1.0',cutoff:'2026-09-25',sha256:'1ada36ab20b492b894091e827f3caab90cc2a1a524fc870674af561ff3d75b5d'});
export const PROGRAM_PURPOSES = Object.freeze(['research-submission','program-interest']);
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const SHA256=/^[0-9a-f]{64}$/;
export class ProgramError extends Error {constructor(){super('Contribution request unavailable');this.code='contribution_unavailable';}}
export const reject=()=>{throw new ProgramError();};
export function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))reject();}
export function uuid(value){if(typeof value!=='string'||!UUID.test(value))reject();return value;}
export function text(value,max=128,{multiline=false}={}){
 if(typeof value!=='string'||!value.trim()||value.length>max||!value.isWellFormed()||(multiline?/[\x00-\x08\x0b-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value))reject();return value;
}
export function hash(value){if(typeof value!=='string'||!SHA256.test(value))reject();return value;}
export function revision(value){if(!Number.isSafeInteger(value)||value<1||value>1000000)reject();return value;}
function instant(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)reject();return Date.parse(value);}
function frozen(value){if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;}

/** This is the exact contributor-visible text and scope; changing any part
 * requires a new version and acknowledgment. It cannot authorize interviews. */
export function validateProgramVersion(input){
 exact(input,['schemaVersion','programId','version','title','responsibleInstitution','charter','permittedPurposes','researchCharter','newInterviews']);
 if(input.schemaVersion!==1||input.newInterviews!==false)reject();uuid(input.programId);revision(input.version);
 text(input.title,120);text(input.responsibleInstitution,200);text(input.charter,12000,{multiline:true});
 exact(input.researchCharter,['version','cutoff','sha256']);
 for(const key of Object.keys(RESEARCH_CHARTER))if(input.researchCharter[key]!==RESEARCH_CHARTER[key])reject();
 if(!Array.isArray(input.permittedPurposes)||!input.permittedPurposes.length||input.permittedPurposes.length>PROGRAM_PURPOSES.length||new Set(input.permittedPurposes).size!==input.permittedPurposes.length||input.permittedPurposes.some(p=>!PROGRAM_PURPOSES.includes(p)))reject();
 // Fixed key ordering makes the exact scope digest independent of JSON order.
 return frozen({schemaVersion:1,programId:input.programId,version:input.version,title:input.title,responsibleInstitution:input.responsibleInstitution,charter:input.charter,
  permittedPurposes:[...input.permittedPurposes].sort(),researchCharter:{...RESEARCH_CHARTER},newInterviews:false});
}
export function programTermsDigest(input){return createHash('sha256').update(JSON.stringify(validateProgramVersion(input)),'utf8').digest('hex');}

/** Authority must come from a trusted current operator verifier, never HTTP.
 * This validates its exact scope, not a signer's real-world legal authority. */
export function validateProgramAuthority(input,version,workspaceId,now=Date.now()){
 const v=validateProgramVersion(version);uuid(workspaceId);
 exact(input,['authorizationId','workspaceId','programId','version','termsDigest','responsibleInstitution','authorizedBy','authorityEvidenceId','validFrom','expiresAt','responseCapacityConfirmed']);
 uuid(input.authorizationId);uuid(input.authorityEvidenceId);text(input.authorizedBy);hash(input.termsDigest);
 if(!Number.isSafeInteger(now)||now<0||input.workspaceId!==workspaceId||input.programId!==v.programId||input.version!==v.version||input.termsDigest!==programTermsDigest(v)||input.responsibleInstitution!==v.responsibleInstitution||input.responseCapacityConfirmed!==true||instant(input.validFrom)>now||instant(input.expiresAt)<=now||instant(input.validFrom)>=instant(input.expiresAt))reject();
 return frozen(structuredClone(input));
}
export function acknowledgmentInput(input){
 exact(input,['programId','version','termsDigest','acknowledgmentId','acknowledged']);uuid(input.programId);revision(input.version);hash(input.termsDigest);uuid(input.acknowledgmentId);
 if(input.acknowledged!==true)reject();return structuredClone(input);
}
export function submissionInput(input){
 exact(input,['programId','version','termsDigest','acknowledgmentId','submissionId','uploadId']);
 uuid(input.programId);revision(input.version);hash(input.termsDigest);uuid(input.acknowledgmentId);uuid(input.submissionId);uuid(input.uploadId);return structuredClone(input);
}
export function interestInput(input){
 exact(input,['programId','version','termsDigest','acknowledgmentId','interestId','requestProgramUpdates']);
 uuid(input.programId);revision(input.version);hash(input.termsDigest);uuid(input.acknowledgmentId);uuid(input.interestId);
 if(input.requestProgramUpdates!==true)reject();return structuredClone(input);
}
/** Program acknowledgment is not a subject-specific consent grant. Existing
 * material still needs consent/rights review; new collection is always closed. */
export function validateSubmissionSource(value,{workspaceId,subjectId,uploadId}){
 exact(value,['workspaceId','subjectId','uploadId','state','bytesVerified','publiclyAccessible','collectionKind']);
 if(value.workspaceId!==workspaceId||value.subjectId!==subjectId||value.uploadId!==uploadId||value.state!=='complete-quarantined'||value.bytesVerified!==true||value.publiclyAccessible!==false||value.collectionKind!=='existing-material')reject();
 return structuredClone(value);
}
export const PARTICIPATION_LIMITS=Object.freeze({officialEnrollment:false,policyEndorsement:false,researchMembershipChanged:false,publiclyAccessible:false,newInterviews:false});
