import type {ProgramVersion,ProgramAuthority,ProgramAcknowledgment,ProgramSubmission,ProgramInterest,SubmissionSource} from '../../../packages/domain/src/community/program.mjs';
export interface ProgramPrincipal {subjectId:string;workspaceId:string;requestId:string}
export interface ParticipationLimits {officialEnrollment:false;policyEndorsement:false;researchMembershipChanged:false;publiclyAccessible:false;newInterviews:false}
export type PublicProgramVersion=ProgramVersion&{termsDigest:string};
export interface AcknowledgmentReceipt extends ParticipationLimits {acknowledgmentId:string;version:number;termsDigest:string;consentGranted:false}
export interface SubmissionReceipt extends ParticipationLimits {submissionId:string;programId:string;version:number;uploadId:string;state:'pending-review';interestRegistered:false;consentReviewed:false;rightsReviewed:false}
export interface InterestReceipt extends ParticipationLimits {interestId:string;programId:string;version:number;state:'registered'|'withdrawn';purpose:'program-interest';submissionCreated:false;notificationSent:false}
export interface InterestWithdrawal {programId:string;interestId:string;withdrawalId:string}
export interface ProgramStatus extends ParticipationLimits {program:PublicProgramVersion;acknowledgmentId:string|null;submissions:SubmissionReceipt[];interests:InterestReceipt[];hasOlderSubmissions:boolean;hasOlderInterests:boolean}
export interface ContributionProgramRepository {
 program(principal:ProgramPrincipal,programId:string):{version:ProgramVersion;authority:ProgramAuthority};
 installVersion(principal:ProgramPrincipal,version:ProgramVersion,authority:ProgramAuthority):PublicProgramVersion;
 status(principal:ProgramPrincipal,programId:string):ProgramStatus;
 acknowledge(principal:ProgramPrincipal,input:ProgramAcknowledgment):AcknowledgmentReceipt;
 submit(principal:ProgramPrincipal,input:ProgramSubmission,source:SubmissionSource):SubmissionReceipt;
 registerInterest(principal:ProgramPrincipal,input:ProgramInterest):InterestReceipt;
 withdrawInterest(principal:ProgramPrincipal,input:InterestWithdrawal):InterestReceipt;
 close():void;
}
export function createPrivateContributionProgramRepository(config:{root:string;now?:()=>number}):ContributionProgramRepository;
