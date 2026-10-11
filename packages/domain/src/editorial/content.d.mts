export class EditorialError extends Error {code:string}
export interface VersionRef {id:string;revision:string}
export type Inline={type:'text'|'strong'|'emphasis';text:string}|{type:'link';text:string;href:string};
export interface Provision {id:string;number:string;heading:string;text:string}
export interface PolicyFigure {id:string;display:string;unit:string;provisionId:string;context:string}
export interface PolicyVersion {recordType:'policy-version';schemaVersion:1;id:string;label:string;document:{id:string;sha256:string};draftDate:string|null;supersedes:string|null;provisions:Provision[];figures:PolicyFigure[]}
export type PreviewBlock=
 {id:string;kind:'paragraph';purpose:'orientation'|'advocacy-interpretation';content:Inline[]}|
 {id:string;kind:'heading';level:2|3;text:string}|
 {id:string;kind:'callout';tone:string;title:string;content:Inline[]}|
 {id:string;kind:'definition';term:string;content:Inline[]}|
 {id:string;kind:'policy-provision';referenceId:string;policyVersionId:string;value:Provision;policyLabel:string;documentSha256:string}|
 {id:string;kind:'policy-figure';referenceId:string;policyVersionId:string;value:PolicyFigure;policyLabel:string;documentSha256:string}|
 {id:string;kind:'research-claim';claim:VersionRef;evidence:VersionRef[];scopeId:string|null;wording:string;assertionType:'source-testimony'|'historical-interpretation';attribution:{locatorId:string;agentLabel:string|null}|null;reviewState:string;evidenceRelations:{id:string;relation:string;locatorId:string}[]}|
 {id:string;kind:'citation';locator:VersionRef;label:string;href:string|null};
export interface EditorialPreview {schemaVersion:1;page:{id:string;version:string;slug:string;title:string;language:string;explanationLevel:string};policyVersion:{id:string;label:string;draftDate:string|null;documentSha256:string}|null;blocks:PreviewBlock[];dependencies:VersionRef[];publicationApproved:false;wholeWorkVerified:false;mode:'editorial-preview'}
export const EXPLANATION_LEVELS:readonly string[];
export function safeEditorialHref(value:unknown):string;
export function validateInline(value:unknown):Inline[];
export function validatePolicyVersion(value:unknown):PolicyVersion;
export function validateContentPage(value:unknown):unknown;
export function compileEditorialPreview(page:unknown,bundle:unknown):EditorialPreview;
export function comparePolicyVersions(before:unknown,after:unknown):{beforeVersionId:string;afterVersionId:string;provisions:unknown[];figures:unknown[];semanticEquivalence:'not-inferred'};
