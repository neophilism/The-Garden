import type {ProgramVersion,ProgramAuthority,ProgramAcknowledgment,ProgramSubmission,ProgramInterest,SubmissionSource} from '../../../packages/domain/src/community/program.mjs';
import type {ContributionProgramRepository,ProgramPrincipal,PublicProgramVersion,ProgramStatus,AcknowledgmentReceipt,SubmissionReceipt,InterestReceipt,InterestWithdrawal} from '../../../services/workers/src/contribution-program-repository.mjs';
export interface ProgramActionScope {action:string;phase:'admit'|'read'|'before-write'|'deliver';workspaceId:string;programId:string;uploadId:string|null;purpose:'research-submission'|'program-interest'|'program-administration'}
export interface ContributionProgramService {
 status(headers:Headers,workspaceId:string,input:{programId:string}):Promise<ProgramStatus&{intakeAvailable:boolean}>;
 installVersion(headers:Headers,workspaceId:string,input:{version:ProgramVersion;authorizationId:string}):Promise<PublicProgramVersion>;
 acknowledge(headers:Headers,workspaceId:string,input:ProgramAcknowledgment):Promise<AcknowledgmentReceipt>;
 submit(headers:Headers,workspaceId:string,input:ProgramSubmission):Promise<SubmissionReceipt>;
 registerInterest(headers:Headers,workspaceId:string,input:ProgramInterest):Promise<InterestReceipt>;
 withdrawInterest(headers:Headers,workspaceId:string,input:InterestWithdrawal):Promise<InterestReceipt>;
}
export interface ContributionProgramDependencies {
 decisions:{decide(headers:Headers,workspaceId:string,evaluate:(facts:ProgramPrincipal)=>Promise<boolean>):Promise<{allowed:boolean;requestId:string}>};
 authorize(facts:ProgramPrincipal,scope:ProgramActionScope):Promise<boolean>;
 authorizeOperator(headers:Headers,facts:ProgramPrincipal,scope:ProgramActionScope):Promise<boolean>;
 verifyAuthority(scope:{facts:ProgramPrincipal;workspaceId:string;programId:string;version:ProgramVersion;termsDigest:string;authorizationId:string}):Promise<ProgramAuthority|null>;
 verifyUpload(scope:{facts:ProgramPrincipal;workspaceId:string;subjectId:string;uploadId:string;purpose:'research-submission'}):Promise<SubmissionSource|null>;
 repository:ContributionProgramRepository;
 enabled?:()=>boolean|Promise<boolean>;
 now?:()=>number;
 maxConcurrent?:number;
}
export function createContributionProgramService(config:ContributionProgramDependencies):ContributionProgramService;
export function createContributionProgramHandler(config:{service:ContributionProgramService;origin:string}):(request:Request)=>Promise<Response>;
