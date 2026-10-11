/** Catalog and source lineage records. No statement of source independence. */
import {object,text,list,uuid,provenance,freeze,reject} from './model.mjs';
export const ARCHIVAL_LEVELS=Object.freeze(['repository','collection','series','item']);
export const SOURCE_FORMS=Object.freeze(['witness','edition','digital-representation']);
const parentLevels=Object.freeze({repository:[],collection:['repository','collection'],series:['collection','series'],item:['repository','collection','series']});
const fields=Object.freeze(['title','date','creator','call-number','language','extent','description']);
function assertions(items){
 const ids=new Set();
 list(items,200,a=>{
  object(a,['id','field','value','provenance','supersedes']);uuid(a.id);
  if(ids.has(a.id)||!fields.includes(a.field))reject();ids.add(a.id);text(a.value,4000);provenance(a.provenance);
  if(a.supersedes!==null){uuid(a.supersedes);if(a.supersedes===a.id)reject();}
 });
 // Supersession is a local append-only correction, not erasure of a contrary catalog.
 for(const a of items){
  const seen=new Set([a.id]);let next=a.supersedes;
  while(next!==null){const previous=items.find(x=>x.id===next);if(!previous||seen.has(next)||previous.field!==a.field)reject();seen.add(next);next=previous.supersedes;}
 }
}
function bounded(value){if(new TextEncoder().encode(JSON.stringify(value)).byteLength>131072)reject();return freeze(structuredClone(value));}
export function validateArchivalUnit(value){
 object(value,['recordType','schemaVersion','id','title','level','parentId','assertions','notes']);
 if(value.recordType!=='archival-unit'||value.schemaVersion!==1||!ARCHIVAL_LEVELS.includes(value.level))reject();
 uuid(value.id);text(value.title,300,true);text(value.notes,4000,true);assertions(value.assertions);
 if(value.parentId!==null){uuid(value.parentId);if(value.parentId===value.id||value.level==='repository')reject();}
 return bounded(value);
}
export function validateSource(value){
 object(value,['recordType','schemaVersion','id','title','form','archivalItemId','derivedFrom','assertions','representation']);
 if(value.recordType!=='source'||value.schemaVersion!==1||!SOURCE_FORMS.includes(value.form))reject();
 uuid(value.id);text(value.title,300,true);if(value.archivalItemId!==null){uuid(value.archivalItemId);if(value.archivalItemId===value.id)reject();}
 const ids=new Set();list(value.derivedFrom,32,id=>{uuid(id);if(ids.has(id)||id===value.id)reject();ids.add(id);});assertions(value.assertions);
 if(ids.has(value.archivalItemId))reject();
 if(value.form==='witness'&&ids.size)reject();
 if(value.form==='digital-representation'){
  if(ids.size!==1)reject();
  const r=value.representation;object(r,['sha256','mediaType','byteLength','originalFilename']);
  if(typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.byteLength)||r.byteLength<0)reject();
  text(r.mediaType,120);if(!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(r.mediaType))reject();text(r.originalFilename,300,true);
 }else if(value.representation!==null)reject();
 return bounded(value);
}
export function validateSourceRecord(value){
 if(value?.recordType==='source')return validateSource(value);
 if(value?.recordType==='archival-unit')return validateArchivalUnit(value);
 reject();
}
export function preserveCatalogAssertions(before,after){
 before=validateSourceRecord(before);after=validateSourceRecord(after);
 if(before.id!==after.id||before.recordType!==after.recordType||before.form!==after.form||before.level!==after.level)reject();
 const canonical=a=>JSON.stringify([a.id,a.field,a.value,a.provenance.map(p=>[p.sourceId,p.locator]),a.supersedes]);
 const kept=new Map(after.assertions.map(a=>[a.id,canonical(a)]));
 if(before.assertions.some(a=>kept.get(a.id)!==canonical(a)))reject();
 return after;
}
/** Authorize every visited node; unknown, hidden, cyclic and oversized graphs fail closed. */
export async function validateSourceGraph(input,load,{maxNodes=512}={}){
 const root=validateSourceRecord(input);if(typeof load!=='function'||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>512)reject();
 const visiting=new Set(),done=new Set(),cache=new Map([[root.id,root]]);
 async function get(id){
  if(!cache.has(id)){if(cache.size>=maxNodes)reject();const value=validateSourceRecord(await load(id));if(value.id!==id)reject();cache.set(id,value);}return cache.get(id);
 }
 async function visit(value,depth){
  if(depth>64||visiting.has(value.id))reject();if(done.has(value.id))return;visiting.add(value.id);
  if(value.recordType==='archival-unit'&&value.parentId!==null){
   const p=await get(value.parentId);if(p.recordType!=='archival-unit'||!parentLevels[value.level].includes(p.level))reject();await visit(p,depth+1);
  }
  if(value.recordType==='source'){
   if(value.archivalItemId!==null){const item=await get(value.archivalItemId);if(item.recordType!=='archival-unit'||item.level!=='item')reject();await visit(item,depth+1);}
   for(const id of value.derivedFrom){const p=await get(id);if(p.recordType!=='source')reject();await visit(p,depth+1);}
  }
  visiting.delete(value.id);done.add(value.id);
 }
 await visit(root,0);return root;
}
/** Different known roots do not, by themselves, establish independent testimony. */
export async function compareSourceLineages(ids,load){
 const unique=new Set();list(ids,32,id=>{uuid(id);if(unique.has(id))reject();unique.add(id);});if(!ids.length||typeof load!=='function')reject();
 const cache=new Map();
 const get=async id=>{if(!cache.has(id)){if(cache.size>=512)reject();const value=validateSourceRecord(await load(id));if(value.id!==id)reject();cache.set(id,value);}return cache.get(id);};
 const results=[];
 for(const id of ids){
  const record=validateSource(await get(id));await validateSourceGraph(record,get);
  const roots=new Set(),unresolved=new Set(),seen=new Set(),queue=[record];
  while(queue.length){const v=queue.pop();if(seen.has(v.id))continue;seen.add(v.id);
   if(!v.derivedFrom.length)(v.form==='witness'?roots:unresolved).add(v.id);
   else for(const parent of v.derivedFrom)queue.push(validateSource(await get(parent)));
  }
  results.push({sourceId:id,knownWitnessRoots:[...roots].sort(),unresolvedRoots:[...unresolved].sort()});
 }
 const shared=[];
 for(let i=0;i<results.length;i++)for(let j=i+1;j<results.length;j++){
  const a=results[i],b=results[j],roots=[...a.knownWitnessRoots,...a.unresolvedRoots].filter(r=>b.knownWitnessRoots.includes(r)||b.unresolvedRoots.includes(r));
  if(roots.length)shared.push({sourceIds:[a.sourceId,b.sourceId],sharedRoots:roots.sort()});
 }
 return freeze({sources:results,sharedLineages:shared,independence:'not-established',independentEvidenceCount:null});
}
