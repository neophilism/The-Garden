/** Validated, immutable contracts for revision-scoped research reviews. */
export type ReviewAxis = 'acquisition'|'transcription'|'evidentiary-review'|'rights'|'consent'|'accessibility'|'publication';
export type ReviewEvidence = readonly Readonly<{recordId:string;revision:string}>[];
export type ReviewScope = Readonly<{id:string;recordId:string;revision:string;digest:string;digestProfile:'postgres-jsonb-text-sha256';coverage:'exact-record-revision';authorshipComplete:boolean}>;
export type ReviewSnapshot = Readonly<{schemaVersion:1;scope:ReviewScope;version:string;states:Readonly<Record<ReviewAxis,string>>;currentRevision:string;publicUseAllowed:boolean;publicationReleased:false}>;
export type ReviewTransition = Readonly<{axis:ReviewAxis;fromState:string;toState:string;expectedVersion:string;assignmentId:string|null;evidence:ReviewEvidence;rationale:string}>;
export type ReviewReopening = Readonly<{axis:ReviewAxis;fromState:string;expectedVersion:string;evidence:ReviewEvidence;rationale:string}>;
export type ImportedReview = Readonly<{axis:ReviewAxis;expectedVersion:string;namespace:string;verbatim:string;evidence:ReviewEvidence}>;
export type ReviewRule = Readonly<{id:ReviewAxis;initial:string;states:readonly string[];transitions:Readonly<Record<string,readonly string[]>>;roles:Readonly<Record<string,readonly string[]>>;passing:readonly string[];independentStates:readonly string[];assignmentKind:'research'|'rights'|null}>;
export type ReviewPresentation = Readonly<{rows:readonly Readonly<{axis:ReviewAxis;label:string;state:string;description:string;scope:string;current:boolean}>[];scope:ReviewScope;current:boolean;eligibleForReleaseReview:boolean;publicationApproved:false;wholeWorkVerified:false;requiresSeparateReleaseAcceptance:true;notice:string}>;
export type ReviewEvent = Readonly<{id:string;scopeId:string;sequence:string;axis:ReviewAxis;kind:'transition'|'reopen'|'import-observation';fromState:string;toState:string;actor:Readonly<{subjectId:string;role:string}>;assignmentId:string|null;evidence:ReviewEvidence;rationale:string|null;imported:Readonly<{namespace:string;verbatim:string}>|null;recordedAt:string}>;
export class ReviewError extends Error {readonly code:'review_unavailable'}
export const REVIEW_RULES:Readonly<{schemaVersion:1;axes:readonly ReviewRule[]}>;
export const REVIEW_AXES:readonly ReviewAxis[];
export function reviewId(value:unknown):string;
export function reviewVersion(value:unknown,options?:{zero?:boolean}):string;
export function ruleFor(axis:unknown):ReviewRule;
export function initialReviewStates():Readonly<Record<ReviewAxis,string>>;
export function validateReviewEvidence(value:unknown):ReviewEvidence;
export function validateReviewTransition(value:unknown):ReviewTransition;
export function validateReviewReopening(value:unknown):ReviewReopening;
export function validateImportedReview(value:unknown):ImportedReview;
export function reviewTransitionAllowed(transition:unknown,authority:unknown):boolean;
export function validateReviewSnapshot(value:unknown):ReviewSnapshot;
export function presentReview(value:unknown):ReviewPresentation;
export function validateReviewHistory(value:unknown):Readonly<{events:readonly ReviewEvent[];nextAfter:string|null;wholeWorkVerified:false}>;
