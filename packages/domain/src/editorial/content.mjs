/** Structured files for editorial previews. Validation is never a publication grant. */
import {object,text,list,uuid,freeze} from '../historical/model.mjs';
import {revision,validateLocator} from '../historical/locators.mjs';
import {validateClaimRecord} from '../historical/claims.mjs';
import {validateReviewSnapshot} from '../review/states.mjs';

export class EditorialError extends Error {
 constructor(){super('Editorial content unavailable or incompatible');this.code='editorial_unavailable';}
}
const fail=()=>{throw new EditorialError();};
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^[a-z][a-z0-9-]{0,63}$/;
export const EXPLANATION_LEVELS=Object.freeze(['at-a-glance','overview','in-depth']);
function key(v){if(typeof v!=='string'||!KEY.test(v))fail();}
function bounded(v){if(new TextEncoder().encode(JSON.stringify(v)).length>262144)fail();}
function immutable(v){return freeze(structuredClone(v));}
function guard(work){try{return work();}catch{fail();}}
function unique(items,id){const seen=new Set();for(const v of items){const k=id(v);if(seen.has(k))fail();seen.add(k);}}
function ref(v){object(v,['id','revision']);uuid(v.id);revision(v.revision);}
function language(v){if(typeof v!=='string'||! /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(v))fail();}
function date(v){if(v===null)return;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail();}
/** Links navigate only. No URL is fetched, embedded, or used as a resource. */
export function safeEditorialHref(href){return guard(()=>{
 text(href,2048);if(/[\s\\\u0000-\u001f\u007f]/u.test(href)||/%(?![a-f0-9]{2})/i.test(href))fail();
 if(href.startsWith('/')){
  if(!/^\/(?:[a-z0-9-]+\/)*(?:[a-z0-9-]+)?(?:#[a-z][a-z0-9-]*)?$/.test(href))fail();
 }else{
  const u=new URL(href);if(u.protocol!=='https:'||!u.hostname||u.username||u.password||!href.startsWith('https://'))fail();
 }
 return href;
});}
export function validateInline(nodes){return guard(()=>{
 list(nodes,100,n=>{
  if(n?.type==='link'){object(n,['type','text','href']);safeEditorialHref(n.href);}
  else{object(n,['type','text']);if(!['text','strong','emphasis'].includes(n.type))fail();}
  text(n.text,8000);
 });if(!nodes.length)fail();bounded(nodes);return immutable(nodes);
});}
export function validatePolicyVersion(input){return guard(()=>{
 object(input,['recordType','schemaVersion','id','label','document','draftDate','supersedes','provisions','figures']);
 if(input.recordType!=='policy-version'||input.schemaVersion!==1)fail();uuid(input.id);text(input.label,200);date(input.draftDate);
 object(input.document,['id','sha256']);uuid(input.document.id);if(!SHA.test(input.document.sha256))fail();
 if(input.supersedes!==null){uuid(input.supersedes);if(input.supersedes===input.id)fail();}
 list(input.provisions,500,p=>{object(p,['id','number','heading','text']);key(p.id);text(p.number,80);text(p.heading,300);text(p.text,30000);});
 if(!input.provisions.length)fail();unique(input.provisions,p=>p.id);unique(input.provisions,p=>p.number);
 list(input.figures,500,f=>{object(f,['id','display','unit','provisionId','context']);key(f.id);text(f.display,100);text(f.unit,100);key(f.provisionId);text(f.context,2000);if(!input.provisions.some(p=>p.id===f.provisionId))fail();});
 unique(input.figures,f=>f.id);bounded(input);return immutable(input);
});}
export function validateContentPage(input){return guard(()=>{
 object(input,['recordType','schemaVersion','id','version','slug','title','language','explanationLevel','policyVersionId','blocks']);
 if(input.recordType!=='content-page'||input.schemaVersion!==1)fail();uuid(input.id);revision(input.version);key(input.slug);text(input.title,300);language(input.language);
 if(!EXPLANATION_LEVELS.includes(input.explanationLevel))fail();if(input.policyVersionId!==null)uuid(input.policyVersionId);
 list(input.blocks,200,b=>{
  key(b.id);
  switch(b.kind){
   case 'paragraph':object(b,['id','kind','purpose','content']);if(!['orientation','advocacy-interpretation'].includes(b.purpose))fail();validateInline(b.content);break;
   case 'heading':object(b,['id','kind','level','text']);if(![2,3].includes(b.level))fail();text(b.text,300);break;
   case 'callout':object(b,['id','kind','tone','title','content']);if(!['context','uncertainty','proposed-policy'].includes(b.tone))fail();text(b.title,200);validateInline(b.content);break;
   case 'definition':object(b,['id','kind','term','content']);text(b.term,200);validateInline(b.content);break;
   case 'policy-provision':case 'policy-figure':
    object(b,['id','kind','policyVersionId','referenceId']);uuid(b.policyVersionId);key(b.referenceId);
    if(b.policyVersionId!==input.policyVersionId)fail();break;
   case 'research-claim':
    object(b,['id','kind','claim','evidence','scopeId']);ref(b.claim);if(b.scopeId!==null)uuid(b.scopeId);
    list(b.evidence,32,ref);if(!b.evidence.length)fail();unique(b.evidence,r=>r.id);break;
   case 'citation':object(b,['id','kind','locator','label','href']);ref(b.locator);text(b.label,1000);if(b.href!==null)safeEditorialHref(b.href);break;
   default:fail();
  }
 });
 if(!input.blocks.length)fail();unique(input.blocks,b=>b.id);
 let heading=1;for(const b of input.blocks)if(b.kind==='heading'){if(b.level>heading+1)fail();heading=b.level;}
 bounded(input);return immutable(input);
});}
function indexed(rows,validate){
 list(rows,512,r=>{object(r,['record','revision']);revision(r.revision);validate(r.record);});
 unique(rows,r=>r.record.id+':'+r.revision);return new Map(rows.map(r=>[r.record.id+':'+r.revision,immutable(r.record)]));
}
function get(map,r){const v=map.get(r.id+':'+r.revision);if(!v)fail();return v;}
/** Build from a trusted, already-authorized snapshot (structured files initially).
 * This pure function cannot authenticate a supplied review or grant access. Its
 * result remains private preview material; public projection has separate gates. */
export function compileEditorialPreview(pageInput,bundle){return guard(()=>{
 const page=validateContentPage(pageInput);
 object(bundle,['policyVersion','claims','evidence','locators','reviews']);
 bounded(bundle);
 const policy=bundle.policyVersion===null?null:validatePolicyVersion(bundle.policyVersion);
 if((policy?.id??null)!==page.policyVersionId)fail();
 const claims=indexed(bundle.claims,v=>{if(validateClaimRecord(v).recordType!=='claim')fail();});
 const evidence=indexed(bundle.evidence,v=>{if(validateClaimRecord(v).recordType!=='evidence-link')fail();});
 const locators=indexed(bundle.locators,validateLocator);
 list(bundle.reviews,200,validateReviewSnapshot);unique(bundle.reviews,r=>r.scope.id);
 const reviews=new Map(bundle.reviews.map(r=>[r.scope.id,validateReviewSnapshot(r)]));
 const dependencies=[];
 const blocks=page.blocks.map(b=>{
  if(b.kind==='policy-provision'||b.kind==='policy-figure'){
   const item=(b.kind==='policy-provision'?policy.provisions:policy.figures).find(p=>p.id===b.referenceId);if(!item)fail();
   return {...b,value:item,policyLabel:policy.label,documentSha256:policy.document.sha256};
  }
  if(b.kind==='citation'){get(locators,b.locator);dependencies.push(b.locator);return b;}
  if(b.kind!=='research-claim')return b;
  const claim=get(claims,b.claim);if(claim.assertionType==='policy-statement')fail();
  const links=b.evidence.map(r=>get(evidence,r));
  for(const e of links){
   if(e.claim.id!==b.claim.id||e.claim.revision!==b.claim.revision)fail();
   // Locator records are immutable. Ambiguous supplied revisions are refused.
   if([...locators.values()].filter(l=>l.id===e.locatorId).length!==1)fail();
  }
  if(claim.attribution&&![...locators.values()].some(l=>l.id===claim.attribution.locatorId))fail();
  let reviewState='not-assessed';
  if(b.scopeId!==null){
   const review=reviews.get(b.scopeId);
   if(!review||review.scope.recordId!==b.claim.id||review.scope.revision!==b.claim.revision)fail();
   reviewState=review.currentRevision===b.claim.revision?review.states['evidentiary-review']:'earlier-revision';
   if(reviewState==='reviewed'&&!links.some(e=>e.relation==='supports'))fail();
  }
  dependencies.push(b.claim,...b.evidence);
  return {...b,wording:claim.wording,assertionType:claim.assertionType,attribution:claim.attribution,reviewState,
   evidenceRelations:links.map(e=>({id:e.id,relation:e.relation,locatorId:e.locatorId}))};
 });
 return immutable({schemaVersion:1,page:{id:page.id,version:page.version,slug:page.slug,title:page.title,language:page.language,explanationLevel:page.explanationLevel},
  policyVersion:policy?{id:policy.id,label:policy.label,draftDate:policy.draftDate,documentSha256:policy.document.sha256}:null,
  blocks,dependencies:[...new Map(dependencies.map(r=>[r.id+':'+r.revision,r])).values()],
  publicationApproved:false,wholeWorkVerified:false,mode:'editorial-preview'});
});}
/** Compare identities within explicit versions, never guess renumbered matches. */
export function comparePolicyVersions(beforeInput,afterInput){return guard(()=>{
 const a=validatePolicyVersion(beforeInput),b=validatePolicyVersion(afterInput);
 if(a.id===b.id||b.supersedes!==a.id)fail();
 const compare=(left,right)=>{
  const rows=[];for(const id of [...new Set([...left,...right].map(v=>v.id))].sort()){
   const before=left.find(v=>v.id===id)??null,after=right.find(v=>v.id===id)??null;
   if(JSON.stringify(before)!==JSON.stringify(after))rows.push({id,before,after,change:before===null?'added':after===null?'removed':'changed'});
  }return rows;
 };
 return immutable({beforeVersionId:a.id,afterVersionId:b.id,provisions:compare(a.provisions,b.provisions),figures:compare(a.figures,b.figures),semanticEquivalence:'not-inferred'});
});}
