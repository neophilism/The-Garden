export const TEXT_PROFILE: 'plain-text-codepoints-v1';
export interface VersionRef {id:string; revision:string}
export interface PageRef {ordinal:number; label:string|null; canvasId:string|null}
export type Selector = {type:'whole'} |
 {type:'text';profile:typeof TEXT_PROFILE;textSha256:string;position:{start:number;end:number}|null;quote:{exact:string;prefix:string;suffix:string}|null} |
 {type:'image';unit:'pixel';x:number;y:number;width:number;height:number;canvasWidth:number;canvasHeight:number} |
 {type:'time';startMs:number;endMs:number;durationMs:number};
export interface Locator {recordType:'locator';schemaVersion:1;id:string;source:VersionRef;resourceSha256:string;originalIdentifiers:{namespace:string;identifier:string}[];page:PageRef|null;selector:Selector;description:string|null}
export interface ReanchorProposal {recordType:'locator-reanchor';schemaVersion:1;id:string;fromLocatorId:string;toLocatorId:string;reason:string;decision:'proposed'}
export interface ResourceView {source:VersionRef;bytes:Uint8Array;page?:PageRef|null;text?:string;textProfile?:typeof TEXT_PROFILE;dimensions?:{width:number;height:number};durationMs?:number}
export interface Resolution {status:'resolved'|'orphaned'|'ambiguous'|'proposed';reason:string;page?:PageRef|null;selection?:Record<string,unknown>;warning?:string|null;candidates?:{start:number;end:number}[];inspectionBoundReached?:boolean;adopted?:false}
export function revision(value:unknown):void;
export function validateLocator(value:unknown):Locator;
export function validateReanchorProposal(value:unknown):ReanchorProposal;
export function validateLocatorRecord(value:unknown):Locator|ReanchorProposal;
export function sha256(bytes:Uint8Array):Promise<string>;
export function resolveLocator(value:Locator,resource:ResourceView):Promise<Resolution>;
export function proposeReanchor(value:Locator,resource:ResourceView):Promise<Resolution>;
export function webAnnotationSelectors(value:Locator):ReadonlyArray<Record<string,unknown>>;
