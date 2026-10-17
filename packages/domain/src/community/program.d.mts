export type ProgramPurpose='research-submission'|'program-interest';
export interface ResearchCharter {version:'1.0';cutoff:'2026-09-25';sha256:string}
export interface ProgramVersion {schemaVersion:1;programId:string;version:number;title:string;responsibleInstitution:string;charter:string;permittedPurposes:ProgramPurpose[];researchCharter:ResearchCharter;newInterviews:false}
export interface ProgramAuthority {authorizationId:string;workspaceId:string;programId:string;version:number;termsDigest:string;responsibleInstitution:string;authorizedBy:string;authorityEvidenceId:string;validFrom:string;expiresAt:string;responseCapacityConfirmed:true}
export interface ProgramAcknowledgment {programId:string;version:number;termsDigest:string;acknowledgmentId:string;acknowledged:true}
export interface ProgramSubmission {programId:string;version:number;termsDigest:string;acknowledgmentId:string;submissionId:string;uploadId:string}
export interface ProgramInterest {programId:string;version:number;termsDigest:string;acknowledgmentId:string;interestId:string;requestProgramUpdates:true}
export interface SubmissionSource {workspaceId:string;subjectId:string;uploadId:string;state:'complete-quarantined';bytesVerified:true;publiclyAccessible:false;collectionKind:'existing-material'}
export const RESEARCH_CHARTER:Readonly<ResearchCharter>;
export const PROGRAM_PURPOSES:readonly ProgramPurpose[];
export const UUID:RegExp;
export const SHA256:RegExp;
export class ProgramError extends Error {code:string}
export function reject():never;
export function exact(value:unknown,keys:string[]):void;
export function uuid(value:unknown):string;
export function text(value:unknown,max?:number,options?:{multiline?:boolean}):string;
export function hash(value:unknown):string;
export function revision(value:unknown):number;
export function validateProgramVersion(value:unknown):ProgramVersion;
export function programTermsDigest(value:unknown):string;
export function validateProgramAuthority(value:unknown,version:ProgramVersion,workspaceId:string,now?:number):ProgramAuthority;
export function acknowledgmentInput(value:unknown):ProgramAcknowledgment;
export function submissionInput(value:unknown):ProgramSubmission;
export function interestInput(value:unknown):ProgramInterest;
export function validateSubmissionSource(value:unknown,context:{workspaceId:string;subjectId:string;uploadId:string}):SubmissionSource;
export const PARTICIPATION_LIMITS:Readonly<{officialEnrollment:false;policyEndorsement:false;researchMembershipChanged:false;publiclyAccessible:false;newInterviews:false}>;
