/** Atomic assertion records; structural validity never establishes historical truth. */
import {object,text,list,uuid,freeze,reject} from './model.mjs';
import {revision,validateLocator} from './locators.mjs';
import {validateSourceRecord} from './sources.mjs';
export const ASSERTION_TYPES=Object.freeze(['source-testimony','historical-interpretation','policy-statement']);
export const EVIDENCE_RELATIONS=Object.freeze(['supports','contradicts','contextualizes']);
export const PLACEMENT_KINDS=Object.freeze(['webpage','exhibit','translation','chart','book','social-graphic','assistant-context','download']);
const CLAIM_TYPES=Object.freeze(['claim','evidence-link','claim-placement']);
function ref(v){object(v,['id','revision']);uuid(v.id);revision(v.revision);}
function finish(v){if(new TextEncoder().encode(JSON.stringify(v)).byteLength>65536)reject();return freeze(structuredClone(v));}
export function validateClaimRecord(v){
 if(!CLAIM_TYPES.includes(v?.recordType)||v.schemaVersion!==1)reject();uuid(v.id);
 if(v.recordType==='claim'){
  object(v,['recordType','schemaVersion','id','assertionType','proposition','wording','attribution','notes']);
  if(!ASSERTION_TYPES.includes(v.assertionType))reject();
  object(v.proposition,['subject','predicate','object']);
  text(v.proposition.subject,500);text(v.proposition.predicate,200);text(v.proposition.object,1500);text(v.wording,4000);text(v.notes,2000,true);
  if(v.assertionType==='source-testimony'){
   object(v.attribution,['locatorId','agentLabel']);uuid(v.attribution.locatorId);text(v.attribution.agentLabel,500,true);
   if(v.attribution.locatorId===v.id)reject();
  }else if(v.attribution!==null)reject();
 }else if(v.recordType==='evidence-link'){
  object(v,['recordType','schemaVersion','id','claim','locatorId','relation','rationale']);ref(v.claim);uuid(v.locatorId);
  if(!EVIDENCE_RELATIONS.includes(v.relation)||new Set([v.id,v.claim.id,v.locatorId]).size!==3)reject();text(v.rationale,4000);
 }else{
  object(v,['recordType','schemaVersion','id','target','dependencies']);
  object(v.target,['kind','identifier','version','language']);if(!PLACEMENT_KINDS.includes(v.target.kind))reject();
  text(v.target.identifier,1200);text(v.target.version,300);text(v.target.language,80,true);
  const seen=new Set();list(v.dependencies,100,r=>{ref(r);const key=r.id+':'+r.revision;if(seen.has(key)||r.id===v.id)reject();seen.add(key);});
  if(!v.dependencies.length)reject();
 }
 return finish(v);
}
export function preserveClaimKind(before,after){
 before=validateClaimRecord(before);after=validateClaimRecord(after);
 if(before.id!==after.id||before.recordType!==after.recordType||before.recordType!=='claim'||before.assertionType!==after.assertionType)reject();return after;
}
/** Explicit researcher segmentation; never guess a sentence's meaning from punctuation. */
export function validateClaimBatch(items){
 const ids=new Set();list(items,100,item=>{const v=validateClaimRecord(item);if(v.recordType!=='claim'||ids.has(v.id))reject();ids.add(v.id);});
 if(!items.length)reject();return freeze({claims:structuredClone(items),semanticAtomicity:'requires-human-review',historicalVerification:'not-established'});
}
/** Edges are version-bound evaluations, not votes or independent-source counts. */
export function evidenceForClaim(claim,claimRevision,links){
 claim=validateClaimRecord(claim);revision(claimRevision);if(claim.recordType!=='claim')reject();const ids=new Set(),groups={supports:[],contradicts:[],contextualizes:[]};
 list(links,1000,input=>{const v=validateClaimRecord(input);if(v.recordType!=='evidence-link'||v.claim.id!==claim.id||v.claim.revision!==claimRevision||ids.has(v.id))reject();ids.add(v.id);groups[v.relation].push(v);});
 for(const values of Object.values(groups))values.sort((a,b)=>a.id.localeCompare(b.id));
 return freeze({claimId:claim.id,revision:claimRevision,groups,conclusion:'not-computed',independentSourceCount:null});
}
/** Minimal reverse-link identifiers for correction discovery, never permission grants. */
export function dependencyIds(input){
 const kind=input?.recordType;let ids=[];
 if(CLAIM_TYPES.includes(kind)){
  const v=validateClaimRecord(input);
  ids=kind==='claim'?(v.attribution?[v.attribution.locatorId]:[]):kind==='evidence-link'?[v.claim.id,v.locatorId]:v.dependencies.map(r=>r.id);
 }else if(kind==='locator')ids=[validateLocator(input).source.id];
 else if(kind==='source'||kind==='archival-unit'){
  const v=validateSourceRecord(input);ids=kind==='source'?[...v.derivedFrom,...(v.archivalItemId?[v.archivalItemId]:[])]:v.parentId?[v.parentId]:[];
 }else reject();
 return [...new Set(ids)].sort();
}
/** Enumerate the complete authorized reverse closure or fail, never silently truncate. */
export async function collectAffectedPlacements(seedIds,findDependents,{maxRecords=512}={}){
 const seeds=new Set();list(seedIds,100,id=>{uuid(id);if(seeds.has(id))reject();seeds.add(id);});
 if(!seeds.size||seeds.size>maxRecords||typeof findDependents!=='function'||!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>512)reject();
 const visited=new Set(seeds),found=new Map(),placements=new Map(),affectedClaims=new Set();let frontier=[...seeds].sort();
 while(frontier.length){
  const rows=await findDependents(frontier,maxRecords+1);if(!Array.isArray(rows)||rows.length>maxRecords)reject();const next=[];
  for(const row of rows){
   object(row,['record','revision']);revision(row.revision);const ids=dependencyIds(row.record);
   if(!ids.some(id=>frontier.includes(id)))reject();
   const id=row.record.id,prior=found.get(id);if(prior&&JSON.stringify(prior)!==JSON.stringify(row))reject();found.set(id,row);
   if(row.record.recordType==='claim-placement')placements.set(id,row);
   if(!visited.has(id)){if(visited.size>=maxRecords)reject();visited.add(id);next.push(id);}
   // A changed source evaluation also requires re-review of the evaluated claim.
   // This is an impact edge, not promotion or a new historical assertion.
   if(row.record.recordType==='evidence-link'){const c=row.record.claim.id;affectedClaims.add(c);if(!visited.has(c)){if(visited.size>=maxRecords)reject();visited.add(c);next.push(c);}}
  }
  frontier=next.sort();
 }
 return freeze({seedIds:[...seeds].sort(),affectedRecords:[...found.values()].sort((a,b)=>a.record.id.localeCompare(b.record.id)),placements:[...placements.values()].sort((a,b)=>a.record.id.localeCompare(b.record.id)),affectedClaimIds:[...affectedClaims].sort(),completeness:'authorized-records-only',globalCompleteness:'not-established',automaticallyCorrected:false});
}
