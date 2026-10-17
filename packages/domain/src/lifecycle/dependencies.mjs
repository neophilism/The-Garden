/** Retained-record dependency metadata. This module grants no access or erasure authority. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {UUID, validateHistorical} from '../historical/model.mjs';
import {revision, validateLocatorRecord} from '../historical/locators.mjs';
import {validateSourceRecord} from '../historical/sources.mjs';
import {validateClaimRecord} from '../historical/claims.mjs';
import {validateGeographicAssertion} from '../historical/geography.mjs';

export const LIFECYCLE_MANIFEST_PROFILE = 'garden-lifecycle-retained-manifest-v1';
export const LIFECYCLE_DEPENDENCY_LIMITS = Object.freeze({maxRevisions:512, maxEdges:8192, maxRecords:512, maxDepth:64});
const HASH = /^[a-f0-9]{64}$/;
const KINDS = new Set(['entity','relationship','source','archival-unit','locator','locator-reanchor','claim','evidence-link','claim-placement','geographic-assertion']);
const isProxy = types.isProxy;
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const coordinate = (id, rev) => id + ':' + rev;
const coordinateOrder = (a,b) => cmp(a.recordId,b.recordId) || cmp(BigInt(a.revision),BigInt(b.revision));
export class LifecycleDependencyError extends Error {
 constructor() { super('Lifecycle dependency snapshot unavailable'); this.code = 'lifecycle_dependencies_unavailable'; }
}
const deny = () => { throw new LifecycleDependencyError(); };
const guard = work => { try { return work(); } catch { deny(); } };
function uuid(v) { if (typeof v !== 'string' || !UUID.test(v)) deny(); }
function hash(v) { if (typeof v !== 'string' || !HASH.test(v)) deny(); }
function exact(v, fields) {
 if (!v || Object.getPrototypeOf(v) !== Object.prototype || Object.keys(v).length!==fields.length || fields.some(k=>!Object.hasOwn(v,k))) deny();
}
function array(v) { if (!Array.isArray(v)) deny(); }
function wellFormed(v) {
 for (let i=0; i<v.length; i++) {
  const c=v.charCodeAt(i);
  if (c>=0xd800 && c<=0xdbff) { const d=v.charCodeAt(++i); if (!(d>=0xdc00 && d<=0xdfff)) deny(); }
  else if (c>=0xdc00 && c<=0xdfff) deny();
 }
}
/** Never invoke caller getters, iterators, toJSON, or Proxy traps while taking ownership. */
function owned(input) {
 const active=new Set(); let nodes=0, bytes=0;
 const string=v=>{wellFormed(v); bytes+=Buffer.byteLength(v,'utf8'); if (bytes>8*1024*1024) deny(); return v;};
 function visit(v,depth) {
  if (++nodes>200000 || depth>32) deny();
  if (v===null || typeof v==='boolean') return v;
  if (typeof v==='string') return string(v);
  if (typeof v==='number') { if (!Number.isFinite(v)) deny(); return v; }
  if (typeof v!=='object' || isProxy(v) || active.has(v)) deny();
  const list=Array.isArray(v), prototype=Object.getPrototypeOf(v);
  if (prototype!==(list?Array.prototype:Object.prototype)) deny();
  const length=list?Object.getOwnPropertyDescriptor(v,'length').value:null;
  if (list && (!Number.isSafeInteger(length) || length>8192)) deny();
  const keys=Reflect.ownKeys(v);
  if (keys.length>(list?length+1:64) || list && keys.length!==length+1) deny();
  active.add(v); const out=list?[]:{};
  for (const key of keys) {
   if (typeof key!=='string' || ['__proto__','prototype','constructor','toJSON'].includes(key)) deny();
   if (list && key==='length') continue;
   const d=Object.getOwnPropertyDescriptor(v,key);
   if (!d || !Object.hasOwn(d,'value') || !d.enumerable || list && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key)>=length)) deny();
   string(key); Object.defineProperty(out,key,{value:visit(d.value,depth+1),enumerable:true,writable:true,configurable:true});
  }
  active.delete(v); return out;
 }
 return visit(input,0);
}
function freeze(v) { if (v && typeof v==='object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
function canonical(v) {
 if (v===null || typeof v!=='object') return JSON.stringify(v);
 if (Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
 return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
const digest = (profile,v) => createHash('sha256').update(profile+'\n'+canonical(v),'utf8').digest('hex');
function payloadDigest(payload) {
 if (!payload || Object.getPrototypeOf(payload)!==Object.prototype || Buffer.byteLength(canonical(payload),'utf8')>131072) deny();
 return digest('garden-lifecycle-payload-v1',payload);
}
export function lifecyclePayloadDigest(input) { return guard(()=>payloadDigest(owned(input))); }
function rowShape(v) {
 exact(v,['workspaceId','recordId','revision','payload']); uuid(v.workspaceId); uuid(v.recordId); revision(v.revision);
 if (!v.payload || Object.getPrototypeOf(v.payload)!==Object.prototype) deny();
}
function issue(code, row=null, inputRecordId=null, inputRevision=null, edgeKind=null) {
 return {code,recordId:row?.recordId??null,revision:row?.revision??null,inputRecordId,inputRevision,edgeKind};
}
const uniqueSorted = values => [...new Map(values.map(v=>[canonical(v),v])).entries()].sort(([a],[b])=>cmp(a,b)).map(([,v])=>v);
function extraction(row) {
 rowShape(row);
 const payload=row.payload, edges=[], unresolved=[];
 let value=null, recordType=KINDS.has(payload.recordType)?payload.recordType:null;
 const schemaVersion=recordType && payload.schemaVersion===1?1:null;
 if (!Object.keys(payload).length) unresolved.push(issue('uninitialized-record',row));
 else if (!recordType) unresolved.push(issue('unsupported-record-type',row));
 else if (schemaVersion===null) unresolved.push(issue('unsupported-schema-version',row));
 else if (payload.id!==row.recordId) unresolved.push(issue('payload-identity-mismatch',row));
 else {
  try {
   if (['entity','relationship'].includes(recordType)) value=validateHistorical(payload);
   else if (['source','archival-unit'].includes(recordType)) value=validateSourceRecord(payload);
   else if (['locator','locator-reanchor'].includes(recordType)) value=validateLocatorRecord(payload);
   else if (recordType==='geographic-assertion') value=validateGeographicAssertion(payload);
   else value=validateClaimRecord(payload);
  } catch { unresolved.push(issue('invalid-typed-record',row)); }
 }
 const add=(inputRecordId,inputRevision,edgeKind,relationshipClass='semantic',dependentRecordId=row.recordId,dependentRevision=row.revision)=>{
  if (edges.length>=LIFECYCLE_DEPENDENCY_LIMITS.maxEdges) deny();
  edges.push({workspaceId:row.workspaceId,originRecordId:row.recordId,originRevision:row.revision,dependentRecordId,dependentRevision,inputRecordId,inputRevision,inputBinding:inputRevision===null?'current':'exact',edgeKind,relationshipClass});
 };
 const provenance=(items,kind)=>{ for (const p of items) { add(p.sourceId,null,kind,'provenance'); unresolved.push(issue('unverified-provenance',row,p.sourceId,null,kind)); } };
 if (value) {
  switch (recordType) {
   case 'archival-unit':
    if (value.parentId!==null) add(value.parentId,null,'archival-parent');
    for (const a of value.assertions) provenance(a.provenance,'catalog-provenance');
    break;
   case 'source':
    if (value.archivalItemId!==null) add(value.archivalItemId,null,'source-archive');
    for (const id of value.derivedFrom) add(id,null,'source-derived','derivation');
    for (const a of value.assertions) provenance(a.provenance,'catalog-provenance');
    if (value.representation!==null) unresolved.push(issue('external-representation-material',row));
    break;
   case 'locator':
    add(value.source.id,value.source.revision,'locator-source');
    if (value.originalIdentifiers.length || value.page?.canvasId!==null && value.page?.canvasId!==undefined) unresolved.push(issue('external-locator-identifier',row));
    break;
   case 'locator-reanchor':
    add(value.fromLocatorId,null,'reanchor-from'); add(value.toLocatorId,null,'reanchor-to'); break;
   case 'claim':
    if (value.attribution!==null) add(value.attribution.locatorId,null,'claim-attribution');
    break;
   case 'evidence-link':
    add(value.claim.id,value.claim.revision,'evidence-claim'); add(value.locatorId,null,'evidence-locator');
    // This additional direction is review impact. Its origin is the evidence payload,
    // even though its dependent is the exact evaluated claim revision.
    add(row.recordId,row.revision,'evidence-review-impact','review-impact',value.claim.id,value.claim.revision);
    break;
   case 'claim-placement':
    for (const ref of value.dependencies) add(ref.id,ref.revision,'placement-dependency');
    unresolved.push(issue('external-placement-target',row)); break;
   case 'entity':
    for (const name of value.names) provenance(name.provenance,'entity-name-provenance');
    if (value.redirect!==null) { add(value.redirect.targetId,null,'entity-redirect'); provenance(value.redirect.evidence,'entity-redirect-provenance'); }
    if (value.sourceIdentities.length) unresolved.push(issue('external-source-identity',row));
    break;
   case 'relationship':
    add(value.fromId,null,'relationship-from'); add(value.toId,null,'relationship-to'); provenance(value.evidence,'relationship-provenance'); break;
   case 'geographic-assertion':
    add(value.subject.id,value.subject.revision,'geography-subject'); add(value.claim.id,value.claim.revision,'geography-claim');
    for (const ref of value.evidence) add(ref.id,ref.revision,'geography-evidence');
    break;
  }
 }
 const receipt={profile:'garden-lifecycle-extraction-v1',workspaceId:row.workspaceId,recordId:row.recordId,revision:row.revision,payloadDigest:payloadDigest(payload),recordType,schemaVersion,edges:uniqueSorted(edges),unresolved:uniqueSorted(unresolved),referencesVerified:false,effectsVerified:false,physicalErasureAuthorized:false};
 // A known schema can be fully extracted while references or external material
 // remain unresolved. Closure completeness additionally checks those findings.
 receipt.extractionCompleteness=value?'complete':'incomplete';
 receipt.receiptDigest=digest('garden-lifecycle-extraction-receipt-v1',receipt);
 return {receipt,value};
}
export function extractLifecycleDependencies(input) { return guard(()=>freeze(extraction(owned(input)).receipt)); }

function manifestShape(m) {
 exact(m,['profile','workspaceId','inventoryRevision','coverage','heads','revisions']);
 if (m.profile!==LIFECYCLE_MANIFEST_PROFILE || !['complete','partial'].includes(m.coverage)) deny();
 uuid(m.workspaceId); revision(m.inventoryRevision); array(m.heads); array(m.revisions);
 const heads=new Set(), coordinates=new Set();
 for (const h of m.heads) { exact(h,['recordId','revision']); uuid(h.recordId); revision(h.revision); if (heads.has(h.recordId)) deny(); heads.add(h.recordId); }
 for (const r of m.revisions) {
  exact(r,['recordId','revision','payloadDigest']); uuid(r.recordId); revision(r.revision); hash(r.payloadDigest);
  const key=coordinate(r.recordId,r.revision); if (coordinates.has(key)) deny(); coordinates.add(key);
 }
 return {...m,heads:[...m.heads].sort(coordinateOrder),revisions:[...m.revisions].sort(coordinateOrder)};
}
export function lifecycleManifestDigest(input) { return guard(()=>digest(LIFECYCLE_MANIFEST_PROFILE,manifestShape(owned(input)))); }
function limitsShape(v) {
 if (v===null) return LIFECYCLE_DEPENDENCY_LIMITS;
 exact(v,Object.keys(LIFECYCLE_DEPENDENCY_LIMITS));
 for (const [key,max] of Object.entries(LIFECYCLE_DEPENDENCY_LIMITS)) if (!Number.isSafeInteger(v[key]) || v[key]<1 || v[key]>max) deny();
 return v;
}
function compatible(edge, origin, target) {
 switch (edge.edgeKind) {
  case 'archival-parent': return target.recordType==='archival-unit' && ({repository:[],collection:['repository','collection'],series:['collection','series'],item:['repository','collection','series']})[origin.level].includes(target.level);
  case 'source-archive': return target.recordType==='archival-unit' && target.level==='item';
  case 'source-derived': return target.recordType==='source';
  case 'locator-source': return target.recordType==='source' && target.form==='digital-representation';
  case 'reanchor-from': case 'reanchor-to': case 'claim-attribution': case 'evidence-locator': return target.recordType==='locator';
  case 'evidence-claim': return target.recordType==='claim';
  case 'evidence-review-impact': return target.recordType==='evidence-link';
  case 'placement-dependency': return ['claim','evidence-link','claim-placement'].includes(target.recordType);
  case 'entity-redirect': return target.recordType==='entity' && target.kind===origin.kind;
  case 'relationship-from': return target.recordType==='entity' && target.kind===origin.fromKind;
  case 'relationship-to': return target.recordType==='entity' && target.kind===origin.toKind;
  case 'geography-subject': return target.recordType==='entity' && target.kind===origin.subject.kind && target.redirect===null;
  case 'geography-claim': return target.recordType==='claim' && target.assertionType!=='policy-statement';
  case 'geography-evidence': return target.recordType==='evidence-link' && target.claim.id===origin.claim.id && target.claim.revision===origin.claim.revision;
  default: return edge.relationshipClass==='provenance' && ['source','archival-unit'].includes(target.recordType);
 }
}

/** `manifestInput` is an independently supplied host inventory, never a requester assertion.
 * Completeness below means consistency with that supplied manifest, not authentication of it.
 */
export function inspectLifecycleDependencyClosure(manifestInput,snapshotInput,requestInput) { return guard(()=>{
 const m=manifestShape(owned(manifestInput)), s=owned(snapshotInput), request=owned(requestInput);
 exact(s,['workspaceId','inventoryRevision','manifestDigest','coverage','revisions']); uuid(s.workspaceId); revision(s.inventoryRevision); hash(s.manifestDigest); array(s.revisions);
 if (!['complete','partial'].includes(s.coverage)) deny();
 exact(request,['rootRecordIds','limits']); array(request.rootRecordIds); const limits=limitsShape(request.limits);
 if (!request.rootRecordIds.length || request.rootRecordIds.length>100) deny();
 for (const id of request.rootRecordIds) uuid(id);
 const roots=[...new Set(request.rootRecordIds)].sort(), manifestDigest=digest(LIFECYCLE_MANIFEST_PROFILE,m), unresolved=[];
 const result={profile:'garden-lifecycle-dependency-closure-v1',workspaceId:m.workspaceId,inventoryRevision:m.inventoryRevision,manifestDigest,snapshotDigest:null,scope:'record-wide-retained-revisions',rootRecordIds:roots,coverage:{manifest:m.coverage,snapshot:s.coverage,expectedRevisions:m.revisions.length,observedRevisions:s.revisions.length,matchedRevisions:0},revisions:[],affectedRecords:[],edges:[],unresolved,completeness:'incomplete',completenessScope:'supplied-retained-manifest',globalCompleteness:'not-established',materialInventory:'not-inspected',authorityVerified:false,effectsVerified:false,physicalErasureAuthorized:false};
 const finish=()=>{result.unresolved=uniqueSorted(unresolved); result.completeness=result.unresolved.length?'incomplete':'complete'; result.resultDigest=digest('garden-lifecycle-closure-result-v1',result); return freeze(result);};
 if (m.coverage!=='complete' || s.coverage!=='complete') unresolved.push(issue('partial-coverage'));
 if (s.workspaceId!==m.workspaceId) unresolved.push(issue('snapshot-workspace-mismatch'));
 if (s.inventoryRevision!==m.inventoryRevision) unresolved.push(issue('inventory-revision-mismatch'));
 if (s.manifestDigest!==manifestDigest) unresolved.push(issue('manifest-digest-mismatch'));
 if (m.revisions.length>limits.maxRevisions || s.revisions.length>limits.maxRevisions || m.heads.length>limits.maxRevisions) unresolved.push(issue('revision-cap-exceeded'));
 if (unresolved.some(x=>['snapshot-workspace-mismatch','inventory-revision-mismatch','manifest-digest-mismatch','revision-cap-exceeded'].includes(x.code))) return finish();
 const expected=new Map(m.revisions.map(r=>[coordinate(r.recordId,r.revision),r]));
 const heads=new Map(m.heads.map(h=>[h.recordId,h.revision])), byId=new Map(), groups=new Map(), foreignIds=new Set();
 for (const r of m.revisions) { if (!byId.has(r.recordId)) byId.set(r.recordId,[]); byId.get(r.recordId).push(r); }
 for (const [id,revs] of byId) {
  if (!heads.has(id)) unresolved.push(issue('missing-current-head',{recordId:id,revision:null}));
  else if (heads.get(id)!==revs.at(-1).revision) unresolved.push(issue('stale-current-head',{recordId:id,revision:heads.get(id)}));
 }
 for (const h of m.heads) if (!expected.has(coordinate(h.recordId,h.revision))) unresolved.push(issue('head-revision-not-retained',h));
 const observed=[];
 for (const row of s.revisions) {
  rowShape(row); const actualDigest=payloadDigest(row.payload);
  observed.push({workspaceId:row.workspaceId,recordId:row.recordId,revision:row.revision,payloadDigest:actualDigest});
  if (row.workspaceId!==m.workspaceId) { unresolved.push(issue('foreign-snapshot-row',row)); foreignIds.add(row.recordId); continue; }
  const key=coordinate(row.recordId,row.revision);
  if (!groups.has(key)) groups.set(key,[]); groups.get(key).push({row,actualDigest});
 }
 observed.sort((a,b)=>cmp(a.workspaceId,b.workspaceId)||coordinateOrder(a,b)||cmp(a.payloadDigest,b.payloadDigest));
 result.snapshotDigest=digest('garden-lifecycle-snapshot-v1',{workspaceId:s.workspaceId,inventoryRevision:s.inventoryRevision,manifestDigest:s.manifestDigest,coverage:s.coverage,revisions:observed});
 const extracted=new Map(); let edgeCount=0;
 for (const [key,rows] of [...groups].sort(([a],[b])=>cmp(a,b))) {
  const {row,actualDigest}=rows[0];
  if (rows.length!==1) { unresolved.push(issue('duplicate-snapshot-revision',row)); continue; }
  const expectedRow=expected.get(key);
  if (!expectedRow) { unresolved.push(issue('unexpected-snapshot-revision',row)); continue; }
  if (expectedRow.payloadDigest!==actualDigest) { unresolved.push(issue('payload-digest-mismatch',row)); continue; }
  const entry=extraction(row); extracted.set(key,entry); result.coverage.matchedRevisions++;
  unresolved.push(...entry.receipt.unresolved); edgeCount+=entry.receipt.edges.length;
  if (edgeCount>limits.maxEdges) { unresolved.push(issue('edge-cap-exceeded')); return finish(); }
 }
 for (const [key,row] of expected) if (!extracted.has(key)) unresolved.push(issue('missing-retained-revision',row));
 const allEdges=[];
 for (const {receipt,value} of extracted.values()) for (const edge of receipt.edges) {
  const resolvedInputRevision=edge.inputBinding==='exact'?edge.inputRevision:heads.get(edge.inputRecordId)??null;
  const target=resolvedInputRevision===null?null:extracted.get(coordinate(edge.inputRecordId,resolvedInputRevision));
  let resolution='matched', code=null;
  if (!target) { resolution=foreignIds.has(edge.inputRecordId)?'foreign':'missing'; code=resolution==='foreign'?'foreign-reference':edge.inputBinding==='exact'?'missing-exact-reference':'missing-current-reference'; }
  else if (!target.value || !compatible(edge,value,target.value)) { resolution='incompatible'; code='incompatible-reference'; }
  else if (edge.edgeKind==='locator-source' && target.value.representation.sha256!==value.resourceSha256) { resolution='incompatible'; code='reference-digest-mismatch'; }
  else if (edge.relationshipClass==='provenance') resolution='unverified-provenance';
  if (code) unresolved.push(issue(code,receipt,edge.inputRecordId,edge.inputRevision,edge.edgeKind));
  allEdges.push({...edge,resolution,resolvedInputRevision:target?resolvedInputRevision:null});
 }
 allEdges.sort((a,b)=>cmp(canonical(a),canonical(b)));
 const reverse=new Map();
 for (const edge of allEdges) { if (!reverse.has(edge.inputRecordId)) reverse.set(edge.inputRecordId,[]); reverse.get(edge.inputRecordId).push(edge); }
 const visited=new Map(), queue=[];
 for (const id of roots) {
  if (!byId.has(id) || !byId.get(id).some(r=>extracted.get(coordinate(id,r.revision))?.value)) unresolved.push(issue('root-not-established',{recordId:id,revision:null}));
  else { visited.set(id,0); queue.push(id); }
 }
 if (visited.size>limits.maxRecords) { unresolved.push(issue('record-cap-exceeded')); return finish(); }
 const traversed=[];
 for (let at=0; at<queue.length; at++) {
  const input=queue[at], depth=visited.get(input);
  for (const edge of reverse.get(input)??[]) {
   const id=edge.dependentRecordId;
   if (!visited.has(id)) {
    if (depth>=limits.maxDepth) { unresolved.push(issue('depth-cap-exceeded')); return finish(); }
    if (visited.size>=limits.maxRecords) { unresolved.push(issue('record-cap-exceeded')); return finish(); }
    visited.set(id,depth+1); queue.push(id);
   }
   traversed.push(edge);
  }
 }
 result.affectedRecords=[...visited].sort(([a],[b])=>cmp(a,b)).map(([recordId,distance])=>({recordId,currentRevision:heads.get(recordId)??null,distance,retainedRevisions:(byId.get(recordId)??[]).map(r=>r.revision)}));
 result.revisions=[...extracted.values()].map(x=>x.receipt).filter(r=>visited.has(r.recordId)).sort(coordinateOrder);
 result.edges=uniqueSorted(traversed);
 return finish();
}); }
