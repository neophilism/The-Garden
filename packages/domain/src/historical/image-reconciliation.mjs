/** GDN-047: image bytes, media members, placements and rights remain distinct.
 * Input is restricted evidence. This module never identifies a depicted person,
 * converts an inherited review label to approval, or publishes any bytes.
 */
import {createHash} from 'node:crypto';
import {freeze} from './model.mjs';

export const IMAGE_RECONCILIATION_PROFILE='garden-image-reconciliation-v1';
export const IMAGE_CLASSES=Object.freeze(['archival-image','generated-illustration','reconstruction','unknown']);
export const HASH=/^[a-f0-9]{64}$/;
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function reject(){throw new Error('Garden image reconciliation rejected');}
export function exact(v,keys){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).sort().join('|')!==[...keys].sort().join('|'))reject();}
function string(v,max,{nullable=false,empty=false}={}){
 if(v===null&&nullable)return;
 if(typeof v!=='string'||(!empty&&!v.length)||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)||!v.isWellFormed())reject();
}
function integer(v,min,max){if(!Number.isSafeInteger(v)||v<min||v>max)reject();}
function array(v,max,validate){if(!Array.isArray(v)||v.length>max)reject();for(const entry of v)validate(entry);}
function digest(v){if(typeof v!=='string'||!HASH.test(v))reject();}
function canonical(v){
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
 return JSON.stringify(v);
}
export function imageEvidenceDigest(v){return createHash('sha256').update(canonical(v)).digest('hex');}
function copied(v,max=64*1024**2){if(Buffer.byteLength(canonical(v))>max)reject();return freeze(structuredClone(v));}
function attributes(v){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).length>32)reject();for(const [key,value] of Object.entries(v)){string(key,300);string(value,2000,{empty:true});}}
function memberPath(v){string(v,600);if(v.startsWith('/')||v.includes('\\')||v.split('/').some(p=>['','.','..'].includes(p)))reject();}
function document(v){exact(v,['editionId','documentId','sha256','size']);string(v.editionId,200);string(v.documentId,200);digest(v.sha256);integer(v.size,1,1024**3);}
const resolution=['resolved','unresolved-relationship','external-not-fetched','wrong-relationship-type','unsafe-internal-target','missing-media-member'];

export function validateImageManifest(value){
 exact(value,['profile','document','media','placements','findings','counts']);
 if(value.profile!=='garden-docx-media-v1')reject();document(value.document);
 const members=new Map();
 array(value.media,20000,m=>{
  exact(m,['memberPath','sha256','size','contentType']);memberPath(m.memberPath);digest(m.sha256);integer(m.size,0,128*1024**2);string(m.contentType,300,{nullable:true});
  if(members.has(m.memberPath))reject();members.set(m.memberPath,m);
 });
 const ids=new Set();
 array(value.placements,20000,p=>{
  exact(p,['placementId','part','locator','relationshipId','kind','status','target','memberPath','sha256','alternative','metadata','crops','extents']);
  digest(p.placementId);memberPath(p.part);string(p.locator,12000);string(p.relationshipId,2000,{nullable:true});string(p.target,2000,{nullable:true});
  if(ids.has(p.placementId)||!resolution.includes(p.status)||!['drawingml','vml','svg-alternative'].includes(p.kind)||![null,'Choice','Fallback'].includes(p.alternative))reject();ids.add(p.placementId);
  const expected=createHash('sha256').update(value.document.sha256+'\n'+p.part+'\n'+p.locator).digest('hex');if(expected!==p.placementId)reject();
  if(p.memberPath!==null)memberPath(p.memberPath);if(p.sha256!==null)digest(p.sha256);
  if(p.status==='resolved'){if(!members.has(p.memberPath)||members.get(p.memberPath).sha256!==p.sha256)reject();}else if(p.sha256!==null)reject();
  array(p.metadata,30,m=>{exact(m,['locator','kind','altText','title']);string(m.locator,12000);if(!['document-properties','picture-properties','vml-properties'].includes(m.kind))reject();string(m.altText,16000,{nullable:true,empty:true});string(m.title,16000,{nullable:true,empty:true});});
  for(const key of ['crops','extents'])array(p[key],30,c=>{exact(c,['locator','attributes']);string(c.locator,12000);attributes(c.attributes);});
 });
 array(value.findings,60000,f=>{exact(f,['code','part','locator','target']);string(f.code,100);string(f.part,600,{nullable:true});string(f.locator,12000,{nullable:true});string(f.target,2000,{nullable:true});});
 exact(value.counts,['mediaMembers','distinctByteAssets','storedPlacements','resolvedPlacements','renderedPlacements']);
 if(value.counts.mediaMembers!==members.size||value.counts.distinctByteAssets!==new Set(value.media.map(m=>m.sha256+':'+m.size)).size||value.counts.storedPlacements!==ids.size||value.counts.resolvedPlacements!==value.placements.filter(p=>p.status==='resolved').length||value.counts.renderedPlacements!==null)reject();
 return copied(value,48*1024**2);
}

const columns={
 documents:['id','role','filename','library_id','sha256','size_bytes','edition','xml_paragraphs','nonempty_units'],
 assets:['sha256','size_bytes','extension','width','height'],
 asset_members:['id','document_id','member_path','asset_sha256'],
 image_placements:['id','document_id','unit_id','part','xpath','relationship_id','asset_sha256','target','alt_text','title','crop_json','extent_json','kind','review_state']
};
/** Adapter contract for GDN-045 raw staging. Original coordinates and all source
 * columns are required. Invalid source claims become findings, never omissions.
 * The trusted loader must establish the artifact binding from its raw journal.
 */
export function validateLegacyImageSnapshot(v){
 exact(v,['snapshotId','artifactSha256','documents','assets','asset_members','image_placements']);string(v.snapshotId,200);digest(v.artifactSha256);
 for(const table of Object.keys(columns)){
  const coordinates=new Set();
  array(v[table],20000,row=>{
   exact(row,['coordinate','record']);string(row.coordinate,200);if(coordinates.has(row.coordinate))reject();coordinates.add(row.coordinate);
   // SQLite signed decimal rowid or typed-NDJSON physical byte offset; never an
   // editorial row number or the inherited, possibly duplicated, id column.
   if(!/^(rowid:-?(?:0|[1-9][0-9]{0,18})|byte-offset:(?:0|[1-9][0-9]{0,18}))$/.test(row.coordinate))reject();
   const [kind,number]=row.coordinate.split(':'),n=BigInt(number);if(number==='-0'||n>9223372036854775807n||(kind==='rowid'&&n< -9223372036854775808n))reject();
   exact(row.record,columns[table]);for(const cell of Object.values(row.record)){
    if(cell===null)continue;
    if(typeof cell==='number'){if(!Number.isFinite(cell)||!Number.isSafeInteger(cell))reject();}
    else string(cell,65536,{empty:true});
   }
  });
 }
 return copied(v,24*1024**2);
}
function evidence(v){array(v,100,r=>{exact(r,['sourceSha256','namespace','coordinate']);digest(r.sourceSha256);string(r.namespace,300);string(r.coordinate,2000);});}
export function validateImageAnnotation(v){
 exact(v,['annotationId','binding','mediaClass','label','caption','altText','inferenceLimit','permittedArgument','creator','title','dates','repository','identifiers','itemUrl','imageUrl','rights','pricing','transformations','evidence']);
 string(v.annotationId,200);exact(v.binding,['editionId','documentSha256','memberPath','sha256','placementId']);string(v.binding.editionId,200);digest(v.binding.documentSha256);memberPath(v.binding.memberPath);digest(v.binding.sha256);if(v.binding.placementId!==null)digest(v.binding.placementId);
 if(!IMAGE_CLASSES.includes(v.mediaClass))reject();
 for(const field of ['label','caption','altText','inferenceLimit','permittedArgument','creator','title','dates','repository','identifiers','itemUrl','imageUrl'])string(v[field],16000,{nullable:true,empty:true});
 exact(v.rights,['status','statement','accessedAt','evidence']);
 if(!['unknown','claimed-public-domain','claimed-licensed','permission-required','prohibited'].includes(v.rights.status))reject();
 string(v.rights.statement,16000,{nullable:true});string(v.rights.accessedAt,100,{nullable:true});evidence(v.rights.evidence);evidence(v.evidence);
 exact(v.pricing,['amountMinor','currency','note']);
 if(v.pricing.amountMinor===null){if(v.pricing.currency!==null||v.pricing.note!=='Cost could not be ascertained.')reject();}
 else{integer(v.pricing.amountMinor,0,10**12);if(typeof v.pricing.currency!=='string'||!/^[A-Z]{3}$/.test(v.pricing.currency))reject();string(v.pricing.note,2000,{nullable:true});}
 array(v.transformations,100,t=>{exact(t,['kind','sourceSha256','derivativeSha256','parameters','evidence']);if(!['crop','resize','color-adjustment','composite','reconstruction','other'].includes(t.kind))reject();digest(t.sourceSha256);digest(t.derivativeSha256);attributes(t.parameters);evidence(t.evidence);});
 return copied(v,256*1024);
}

/** A deterministic restricted projection. Replays of identical source evidence
 * have identical digests. Changed documents or metadata create new projections.
 */
export function reconcileImageEditions(input){
 exact(input,['editions','legacySnapshot','annotations']);
 const editions=[];array(input.editions,24,e=>editions.push(validateImageManifest(e)));if(!editions.length)reject();
 const legacy=input.legacySnapshot===null?null:validateLegacyImageSnapshot(input.legacySnapshot);
 const annotations=[];array(input.annotations,20000,a=>annotations.push(validateImageAnnotation(a)));
 const seen=new Set(),annotationIds=new Set();
 for(const e of editions){const key=JSON.stringify([e.document.editionId,e.document.documentId,e.document.sha256]);if(seen.has(key))reject();seen.add(key);}
 for(const a of annotations){if(annotationIds.has(a.annotationId))reject();annotationIds.add(a.annotationId);}
 const findings=[];
 const finding=(code,details={})=>findings.push({code,...details});
 const inputDigest=imageEvidenceDigest({editions,legacySnapshot:legacy,annotations});
 const output={profile:IMAGE_RECONCILIATION_PROFILE,inputDigest,classification:'restricted_research',historicalReview:'unreviewed',publicationApproved:false,publiclyAccessible:false,
  editions:[],legacySnapshot:legacy,legacyDispositions:[],annotations,findings};
 const allMedia=editions.flatMap(e=>e.media.map(m=>({...m,document:e.document})));
 const index=(rows,key)=>{const map=new Map();for(const row of rows){const k=key(row);if(!map.has(k))map.set(k,[]);map.get(k).push(row);}return map;};
 const tuple=(...v)=>JSON.stringify(v),byteKey=(sha,size)=>tuple(sha,size);
 const currentBytes=new Set(allMedia.map(m=>byteKey(m.sha256,m.size)));
 const docsByHash=index(legacy?.documents??[],d=>d.record.sha256),docsById=index(legacy?.documents??[],d=>d.record.id);
 const assetsByBytes=index(legacy?.assets??[],a=>byteKey(a.record.sha256,a.record.size_bytes));
 const placementsByLocator=index(legacy?.image_placements??[],p=>tuple(p.record.document_id,p.record.part,p.record.xpath));
 const annotationsByMedia=index(annotations,a=>tuple(a.binding.editionId,a.binding.documentSha256,a.binding.memberPath,a.binding.sha256));
 if(legacy)for(const table of ['documents','asset_members','image_placements'])for(const [id,rows] of index(legacy[table],r=>r.record.id)){
  if(id===null||id==='')finding('legacy-identifier-missing',{legacyTable:table,coordinates:rows.map(r=>r.coordinate)});
  else if(rows.length>1)finding('duplicate-legacy-identifiers',{legacyTable:table,coordinates:rows.map(r=>r.coordinate)});
 }
 const usedAnnotations=new Set();
 for(const e of editions){
  const edition={document:e.document,counts:e.counts,manifest:e,assets:[],assetPlacements:[]};output.editions.push(edition);
  const documents=docsByHash.get(e.document.sha256)??[];
  const placementById=new Map(e.placements.map(p=>[p.placementId,p]));
  if(!legacy)finding('legacy-snapshot-not-provided',{editionId:e.document.editionId});
  else if(!documents.length)finding('edition-not-in-legacy-snapshot',{editionId:e.document.editionId,documentSha256:e.document.sha256});
  else if(documents.length>1)finding('ambiguous-legacy-document',{editionId:e.document.editionId,coordinates:documents.map(d=>d.coordinate)});
  for(const d of documents)if(d.record.edition!==e.document.editionId)finding('edition-label-disagrees',{editionId:e.document.editionId,legacyCoordinate:d.coordinate});
  for(const media of e.media){
   const exactRows=assetsByBytes.get(byteKey(media.sha256,media.size))??[];
   const asset={memberPath:media.memberPath,sha256:media.sha256,size:media.size,exactByteLegacyCoordinates:exactRows.map(a=>a.coordinate),annotationIds:[],historicalReview:'unreviewed',rights:'unreviewed',publicBytesAllowed:false};
   edition.assets.push(asset);
   if(legacy&&!exactRows.length)finding('media-without-exact-legacy-byte-match',{editionId:e.document.editionId,memberPath:media.memberPath});
   if(exactRows.length>1)finding('duplicate-legacy-asset-rows',{editionId:e.document.editionId,memberPath:media.memberPath,coordinates:asset.exactByteLegacyCoordinates});
   const matches=annotationsByMedia.get(tuple(e.document.editionId,e.document.sha256,media.memberPath,media.sha256))??[];
   for(const a of matches){
    const p=placementById.get(a.binding.placementId);
    if(a.binding.placementId!==null&&(!p||p.sha256!==media.sha256||p.memberPath!==media.memberPath)){finding('annotation-placement-mismatch',{annotationId:a.annotationId});continue;}
    usedAnnotations.add(a.annotationId);asset.annotationIds.push(a.annotationId);
    if(a.mediaClass==='unknown')finding('image-classification-unresolved',{annotationId:a.annotationId});
    if(['generated-illustration','reconstruction'].includes(a.mediaClass)&&(!a.label||!a.label.trim()))finding('generated-or-reconstructed-label-missing',{annotationId:a.annotationId});
    if(a.rights.status==='unknown'||!a.rights.evidence.length||!a.rights.statement)finding('rights-evidence-unresolved',{annotationId:a.annotationId});
    if(!a.caption||!a.altText||!a.inferenceLimit)finding('caption-alt-or-inference-limit-missing',{annotationId:a.annotationId});
    for(const transform of a.transformations)if(transform.derivativeSha256!==media.sha256)finding('derivative-byte-binding-mismatch',{annotationId:a.annotationId});
   }
   if(!matches.length)finding('media-metadata-and-rights-unresolved',{editionId:e.document.editionId,memberPath:media.memberPath});
   const classes=new Set(matches.map(a=>a.mediaClass).filter(c=>c!=='unknown'));
   if(classes.size>1)finding('contradictory-image-classification',{editionId:e.document.editionId,memberPath:media.memberPath});
  }
  for(const placement of e.placements){
   const unambiguous=documents.length===1&&typeof documents[0].record.id==='string'&&documents[0].record.id.length>0&&docsById.get(documents[0].record.id)?.length===1;
   const candidates=unambiguous?(placementsByLocator.get(tuple(documents[0].record.id,placement.part,placement.locator))??[]):[];
   const row={placementId:placement.placementId,memberPath:placement.memberPath,sha256:placement.sha256,status:placement.status,legacyCoordinates:candidates.map(c=>c.coordinate),annotationIds:(annotationsByMedia.get(tuple(e.document.editionId,e.document.sha256,placement.memberPath,placement.sha256))??[]).filter(a=>usedAnnotations.has(a.annotationId)&&[null,placement.placementId].includes(a.binding.placementId)).map(a=>a.annotationId),publicBytesAllowed:false};edition.assetPlacements.push(row);
   if(candidates.length>1)finding('ambiguous-legacy-placement',{editionId:e.document.editionId,placementId:placement.placementId});
   if(legacy&&!candidates.length)finding('placement-without-exact-edition-locator-match',{editionId:e.document.editionId,placementId:placement.placementId});
   for(const old of candidates){
    if(old.record.asset_sha256!==placement.sha256)finding('placement-byte-mismatch',{editionId:e.document.editionId,placementId:placement.placementId,legacyCoordinate:old.coordinate});
    const observed=placement.metadata.filter(m=>m.kind==='document-properties');
    if(observed.length!==1)finding('placement-metadata-correspondence-unresolved',{editionId:e.document.editionId,placementId:placement.placementId,legacyCoordinate:old.coordinate});
    else for(const [legacyField,currentField] of [['alt_text','altText'],['title','title']])if(old.record[legacyField]!==observed[0][currentField])finding('placement-'+legacyField+'-mismatch',{editionId:e.document.editionId,placementId:placement.placementId,legacyCoordinate:old.coordinate});
    // Legacy crop_json may be malformed or use a different coordinate system.
    // Preserve it verbatim; syntax or numeric resemblance is not equivalence.
    if(old.record.crop_json!==null||old.record.extent_json!==null)finding('legacy-transform-comparison-required',{editionId:e.document.editionId,placementId:placement.placementId,legacyCoordinate:old.coordinate});
   }
  }
  for(const issue of e.findings)finding(issue.code,{editionId:e.document.editionId,documentSha256:e.document.sha256,sourceFinding:issue});
 }
 for(const a of annotations)if(!usedAnnotations.has(a.annotationId))finding('annotation-without-exact-edition-byte-binding',{annotationId:a.annotationId});
 if(legacy){
  for(const table of Object.keys(columns))for(const row of legacy[table]){
   let disposition='unresolved';const r=row.record;
   if(table==='documents')disposition=editions.some(e=>e.document.sha256===r.sha256)?'document-bytes-present':'edition-not-present';
   if(table==='assets')disposition=currentBytes.has(byteKey(r.sha256,r.size_bytes))?'exact-byte-match':'no-exact-current-byte-match';
   if(table==='asset_members'||table==='image_placements'){
    const docs=docsById.get(r.document_id)??[];
    if(docs.length!==1||typeof r.document_id!=='string'||!r.document_id.length)disposition='ambiguous-or-missing-legacy-document';
    else{
     const current=editions.filter(e=>e.document.sha256===docs[0].record.sha256);
     if(!current.length)disposition='edition-not-present';
     else if(table==='asset_members'){
      const found=current.flatMap(e=>e.media).filter(m=>m.memberPath===r.member_path);
      disposition=!found.length?'member-missing':found.every(m=>m.sha256===r.asset_sha256)?'exact-member-match':'member-byte-mismatch';
     }else{
      const found=current.flatMap(e=>e.placements).filter(p=>p.part===r.part&&p.locator===r.xpath);
      disposition=!found.length?'placement-locator-unresolved':found.every(p=>p.status==='resolved'&&p.sha256===r.asset_sha256)?'exact-placement-byte-match':'placement-byte-mismatch';
     }
    }
   }
   output.legacyDispositions.push({table,coordinate:row.coordinate,disposition});
   if(!['document-bytes-present','exact-byte-match','exact-member-match','exact-placement-byte-match'].includes(disposition))finding(disposition,{legacyTable:table,legacyCoordinate:row.coordinate});
  }
 }
 output.legacyCounts=legacy?Object.fromEntries(Object.keys(columns).map(t=>[t,legacy[t].length])):null;
 return copied(output);
}

/** Current review receipt is supplied only by the trusted review service.
 * Matching source bytes alone never certifies a caption, class or permission.
 * Eligibility is a guard for a later release; it does not publish the asset.
 */
export function imageReleaseEligibility(annotation,review,{documentSha256,mediaSha256,placementId,now=Date.now()}={}){
 const a=validateImageAnnotation(annotation),reasons=[];
 if(a.binding.documentSha256!==documentSha256||a.binding.sha256!==mediaSha256||a.binding.placementId!==placementId)reasons.push('exact-placement-binding-required');
 if(!['claimed-public-domain','claimed-licensed'].includes(a.rights.status)||!a.rights.statement||!a.rights.accessedAt||!a.rights.evidence.length)reasons.push('rights-not-established');
 if(a.mediaClass==='unknown')reasons.push('classification-unresolved');
 if(['generated-illustration','reconstruction'].includes(a.mediaClass)&&(!a.label||!a.label.trim()))reasons.push('explicit-generated-label-required');
 for(const field of ['caption','altText','inferenceLimit','permittedArgument'])if(!a[field]?.trim())reasons.push(field+'-required');
 if(!review||review.annotationDigest!==imageEvidenceDigest(a)||review.documentSha256!==documentSha256||review.mediaSha256!==mediaSha256||review.placementId!==placementId||review.revoked!==false||!Number.isFinite(now)||!Number.isFinite(Date.parse(review.expiresAt))||Date.parse(review.expiresAt)<=now||['rights','consent','historical','privacy','derivative'].some(key=>review[key]!=='approved')||!UUID.test(review.reviewId??''))reasons.push('current-exact-review-required');
 if(a.transformations.some(t=>t.derivativeSha256!==mediaSha256||!t.evidence.length))reasons.push('derivative-lineage-unresolved');
 return freeze({eligible:reasons.length===0,reasons,publiclyAccessible:false});
}
