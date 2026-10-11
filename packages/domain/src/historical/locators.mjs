/** Exact-version locators. Resolution proves an anchor match, not source truth or rights. */
import {object, text, list, uuid, freeze, reject} from './model.mjs';
export const TEXT_PROFILE = 'plain-text-codepoints-v1';
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_TEXT = 1024 * 1024;
const MAX_MATCHES = 128;
export function revision(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) reject();
}
function hash(value) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) reject(); }
function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(value) || value < min || value > max) reject(); }
function optionalContext(value) { if(typeof value!=='string') reject(); text('x'+value,257); }
export function validateLocator(value) {
  object(value, ['recordType','schemaVersion','id','source','resourceSha256','originalIdentifiers','page','selector','description']);
  if (value.recordType !== 'locator' || value.schemaVersion !== 1) reject();
  uuid(value.id); object(value.source,['id','revision']); uuid(value.source.id); revision(value.source.revision);
  if (value.id === value.source.id) reject(); hash(value.resourceSha256); text(value.description,1000,true);
  const seen = new Set();
  list(value.originalIdentifiers,32, ref => {
    object(ref,['namespace','identifier']); text(ref.namespace,300); text(ref.identifier,1000);
    const key=JSON.stringify([ref.namespace,ref.identifier]); if(seen.has(key)) reject(); seen.add(key);
  });
  if(value.page!==null) {
    object(value.page,['ordinal','label','canvasId']); integer(value.page.ordinal,0,1000000);
    text(value.page.label,200,true); text(value.page.canvasId,1000,true);
  }
  const s=value.selector;
  if(s?.type==='whole') object(s,['type']);
  else if(s?.type==='text') {
    object(s,['type','profile','textSha256','position','quote']);
    if(s.profile!==TEXT_PROFILE || s.position===null&&s.quote===null) reject(); hash(s.textSha256);
    if(s.position!==null) {
      object(s.position,['start','end']); integer(s.position.start); integer(s.position.end,1);
      if(s.position.end<=s.position.start) reject();
    }
    if(s.quote!==null) {
      object(s.quote,['exact','prefix','suffix']); text(s.quote.exact,2000);
      optionalContext(s.quote.prefix); optionalContext(s.quote.suffix);
    }
  } else if(s?.type==='image') {
    object(s,['type','unit','x','y','width','height','canvasWidth','canvasHeight']);
    if(s.unit!=='pixel') reject();
    for(const k of ['x','y']) integer(s[k],0,1000000);
    for(const k of ['width','height','canvasWidth','canvasHeight']) integer(s[k],1,1000000);
    if(s.x+s.width>s.canvasWidth||s.y+s.height>s.canvasHeight) reject();
  } else if(s?.type==='time') {
    object(s,['type','startMs','endMs','durationMs']);
    integer(s.startMs); integer(s.endMs,1); integer(s.durationMs,1);
    if(s.startMs>=s.endMs||s.endMs>s.durationMs) reject();
  } else reject();
  if(new TextEncoder().encode(JSON.stringify(value)).byteLength>65536) reject();
  return freeze(structuredClone(value));
}
export function validateReanchorProposal(value) {
  object(value,['recordType','schemaVersion','id','fromLocatorId','toLocatorId','reason','decision']);
  if(value.recordType!=='locator-reanchor'||value.schemaVersion!==1||value.decision!=='proposed') reject();
  for(const key of ['id','fromLocatorId','toLocatorId']) uuid(value[key]);
  if(new Set([value.id,value.fromLocatorId,value.toLocatorId]).size!==3) reject();
  text(value.reason,2000); return freeze(structuredClone(value));
}
export function validateLocatorRecord(value) {
  if(value?.recordType==='locator') return validateLocator(value);
  if(value?.recordType==='locator-reanchor') return validateReanchorProposal(value);
  reject();
}
export async function sha256(bytes) {
  if(!(bytes instanceof Uint8Array)||bytes.byteLength>MAX_BYTES) reject();
  // Copy before asynchronous hashing to avoid mutable caller buffers changing the input.
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function plain(value) {
  if(typeof value!=='string'||value.length>MAX_TEXT) reject();
  text('x'+value,MAX_TEXT+1);
  return [...value];
}
function result(status,reason,detail={}) { return freeze(structuredClone({status,reason,...detail})); }
function quoteAt(points, q, start, end) {
  if(points.slice(start,end).join('')!==q.exact) return false;
  const prefix=[...q.prefix],suffix=[...q.suffix];
  return points.slice(Math.max(0,start-prefix.length),start).join('')===q.prefix &&
    points.slice(end,end+suffix.length).join('')===q.suffix;
}
/** Linear scan in Unicode code points. A bound never silently selects the first match. */
function findQuote(points,q) {
  const needle=[...q.exact],table=new Array(needle.length).fill(0),matches=[];
  for(let i=1,j=0;i<needle.length;i++) { while(j&&needle[i]!==needle[j]) j=table[j-1]; if(needle[i]===needle[j]) j++; table[i]=j; }
  for(let i=0,j=0;i<points.length;i++) {
    while(j&&points[i]!==needle[j]) j=table[j-1]; if(points[i]===needle[j]) j++;
    if(j===needle.length) {
      const end=i+1,start=end-needle.length;
      if(quoteAt(points,q,start,end)) { matches.push({start,end}); if(matches.length>MAX_MATCHES) return {matches:[],overflow:true}; }
      j=table[j-1];
    }
  }
  return {matches,overflow:false};
}
function graphemeWarning(value,start,end) {
  if(typeof Intl.Segmenter!=='function') return 'grapheme-boundaries-not-checked';
  const boundaries=new Set([0]); let count=0;
  for(const segment of new Intl.Segmenter('und',{granularity:'grapheme'}).segment(value)) { count += [...segment.segment].length; boundaries.add(count); }
  return boundaries.has(start)&&boundaries.has(end)?null:'selection-splits-grapheme-cluster';
}
function pageMatches(expected,actual) {
  if(expected===null) return true;
  return actual&&expected.ordinal===actual.ordinal&&(expected.label===null||expected.label===actual.label)&&
    (expected.canvasId===null||expected.canvasId===actual.canvasId);
}
function snapshot(r) {
  if(!r) return r;
  if(!(r.bytes instanceof Uint8Array)||r.bytes.byteLength>MAX_BYTES) reject();
  return {...r,bytes:new Uint8Array(r.bytes),source:r.source?{...r.source}:null,page:r.page?{...r.page}:null,dimensions:r.dimensions?{...r.dimensions}:null};
}
/**
 * `resource` is supplied by an authorized reader, not a URL fetcher. Its page map,
 * dimensions and duration come from that reader's version-bound decoding manifest.
 */
export async function resolveLocator(input,resource) {
  const v=validateLocator(input);resource=snapshot(resource);
  if(!resource||v.source.id!==resource.source?.id||v.source.revision!==resource.source?.revision) return result('orphaned','source-version-mismatch');
  if(await sha256(resource.bytes)!==v.resourceSha256) return result('orphaned','resource-hash-mismatch');
  if(!pageMatches(v.page,resource.page)) return result('orphaned','page-map-mismatch');
  const s=v.selector;
  if(s.type==='whole') return result('resolved','exact-resource',{page:v.page});
  if(s.type==='image') {
    if(resource.dimensions?.width!==s.canvasWidth||resource.dimensions?.height!==s.canvasHeight) return result('orphaned','canvas-mismatch');
    return result('resolved','exact-image-region',{page:v.page,selection:{x:s.x,y:s.y,width:s.width,height:s.height,unit:s.unit}});
  }
  if(s.type==='time') {
    if(resource.durationMs!==s.durationMs) return result('orphaned','duration-mismatch');
    return result('resolved','exact-time-range',{selection:{startMs:s.startMs,endMs:s.endMs}});
  }
  if(resource.textProfile!==s.profile) return result('orphaned','text-profile-mismatch');
  if(typeof resource.text!=='string') return result('orphaned','text-unavailable');
  const points=plain(resource.text);
  if(await sha256(new TextEncoder().encode(resource.text))!==s.textSha256) return result('orphaned','text-hash-mismatch');
  let pos=s.position;
  if(pos) {
    if(pos.end>points.length) return result('orphaned','position-outside-text');
    if(s.quote&&!quoteAt(points,s.quote,pos.start,pos.end)) return result('orphaned','position-quote-mismatch');
  } else {
    const found=findQuote(points,s.quote);
    if(found.overflow||found.matches.length>1) return result('ambiguous','multiple-quote-matches',{candidates:found.matches,inspectionBoundReached:found.overflow});
    if(found.matches.length===0) return result('orphaned','quote-not-found'); pos=found.matches[0];
  }
  return result('resolved','exact-text-range',{page:v.page,selection:pos,warning:graphemeWarning(resource.text,pos.start,pos.end)});
}
/** Changed representations are inspected only by explicit request. Never move an existing anchor. */
export async function proposeReanchor(input,newResource) {
  const old=validateLocator(input);newResource=snapshot(newResource);
  if(old.selector.type!=='text'||old.selector.quote===null) return result('orphaned','quote-required-for-reanchor');
  if(newResource?.source?.id!==old.source.id) return result('orphaned','different-source-needs-new-locator');
  revision(newResource.source.revision);
  if(newResource.textProfile!==TEXT_PROFILE) return result('orphaned','text-profile-mismatch');
  if(typeof newResource.text!=='string') return result('orphaned','text-unavailable');
  const points=plain(newResource.text),found=findQuote(points,old.selector.quote);
  const resourceSha256=await sha256(newResource.bytes),textSha256=await sha256(new TextEncoder().encode(newResource.text));
  if(found.overflow||found.matches.length>1) return result('ambiguous','multiple-quote-matches',{candidates:found.matches,inspectionBoundReached:found.overflow});
  if(!found.matches.length) return result('orphaned','quote-not-found');
  return result('proposed','explicit-review-required',{fromLocatorId:old.id,source:newResource.source,resourceSha256,textSha256,position:found.matches[0],page:newResource.page??null,adopted:false});
}
/** Exports selector objects only, not a rights-cleared or complete JSON-LD annotation. */
export function webAnnotationSelectors(input) {
  const s=validateLocator(input).selector;
  if(s.type==='text') return freeze([
    ...(s.position?[{type:'TextPositionSelector',...s.position}]:[]),
    ...(s.quote?[{type:'TextQuoteSelector',...s.quote}]:[])
  ]);
  if(s.type==='image') return freeze([{type:'FragmentSelector',conformsTo:'http://www.w3.org/TR/media-frags/',value:`xywh=pixel:${s.x},${s.y},${s.width},${s.height}`}]);
  if(s.type==='time') {
    const seconds=n=>`${Math.floor(n/1000)}.${String(n%1000).padStart(3,'0')}`;
    return freeze([{type:'FragmentSelector',conformsTo:'http://www.w3.org/TR/media-frags/',value:`t=npt:${seconds(s.startMs)},${seconds(s.endMs)}`}]);
  }
  return Object.freeze([]);
}
