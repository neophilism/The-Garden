/** GDN-078: bibliographic discovery leads, never historical verification. */
import {createHash} from 'node:crypto';

const MAX_INPUT=256*1024, MAX_ITEMS=32, MAX_RAW_ITEM=65536;
const MAX_TITLE=600, MAX_FIELD=4000;
const DOI=/^10\.\d{4,9}\/[a-z0-9._;()/:+-]+$/i;
const FORMATS=Object.freeze(['ris','bibtex','csl-json','manual']);
const ACCESS=Object.freeze(['open','restricted','unknown','access-denied','robots-disallowed','timeout','rate-limited']);
const KEY_FIELDS=Object.freeze(['provider','repositoryId','locator','license','access','retrievedAt']);
function fail(){throw new Error('Garden bibliographic intake rejected');}
function obj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exact(value,fields){if(!obj(value)||Object.keys(value).sort().join('|')!==[...fields].sort().join('|'))fail();}
function safe(value,max=MAX_FIELD,nullable=false){
 if(value===null&&nullable)return null;
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))fail();
 for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const d=value.charCodeAt(++i);if(d<0xdc00||d>0xdfff)fail();}else if(c>=0xdc00&&c<=0xdfff)fail();}
 return value;
}
function optional(s,max=MAX_FIELD){return s===undefined||s===null||s===''?null:safe(s,max);}
function bytes(s){return Buffer.byteLength(s,'utf8');}
function hash(s){return createHash('sha256').update(s,'utf8').digest('hex');}
function frozen(x){if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;}
export function validateAttribution(input){
 exact(input,KEY_FIELDS);safe(input.provider,120);safe(input.repositoryId,300,true);safe(input.locator,1000);
 safe(input.license,300);if(!ACCESS.includes(input.access))fail();
 if(input.retrievedAt!==null&&(typeof input.retrievedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(input.retrievedAt)||!Number.isFinite(Date.parse(input.retrievedAt))))fail();
 return frozen(structuredClone(input));
}
export function normalizeDoi(value){
 if(value===null||value===undefined||value==='')return null;
 safe(value,300);let doi=value.trim().replace(/^doi:\s*/i,'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'');
 try{doi=decodeURIComponent(doi);}catch{fail();}
 if(!DOI.test(doi)||doi.includes('..')||doi.includes('//')||/[?#\\]/.test(doi))fail();
 return doi.toLowerCase();
}
function safeUrl(value){
 if(!value)return null;safe(value,2000);
 let url;try{url=new URL(value);}catch{fail();}
 if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.port||url.hash||/\s/.test(value))fail();
 // A citation URL is inert text. It must never be used as a server-side fetch URL.
 return value;
}
function year(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value==='number'&&Number.isInteger(value))value=String(value);
 if(typeof value!=='string')fail();
 const m=value.match(/(?:^|\b)(1[0-9]{3}|20[0-9]{2}|2100)(?:\b|$)/);return m?Number(m[1]):null;
}
function ris(raw){
 const rows=[], lines=raw.split(/\r?\n/);let tags=null,begin=0,lastTag=null;
 const offsets=[];for(let n=0,pos=0;n<lines.length;n++){offsets.push(pos);pos+=lines[n].length;if(raw.slice(pos,pos+2)==='\r\n')pos+=2;else if(raw[pos]==='\n')pos++;}
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim())continue;
  if(/^ {6}\S/.test(line)){if(!tags||!lastTag||lastTag==='TY')fail();const values=tags[lastTag];values[values.length-1]+='\n'+line.trim().slice(0,MAX_FIELD);if(values.at(-1).length>MAX_FIELD)fail();continue;}
  const m=/^([A-Z][A-Z0-9])  - ?(.*)$/.exec(line);
  if(!m)fail();
  const [,tag,value]=m; if(value.length>MAX_FIELD)fail();
  if(tag==='TY'){
   if(tags||!value.trim())fail();tags={TY:[value]};begin=i;lastTag='TY';
  }else if(tag==='ER'){
   if(!tags)fail();
   const source=raw.slice(offsets[begin],offsets[i]+line.length);
   if(bytes(source)>MAX_RAW_ITEM)fail();rows.push({tags,raw:source});tags=null;lastTag=null;
   if(rows.length>MAX_ITEMS)fail();
  }else{
   if(!tags||Object.keys(tags).length>64)fail();(tags[tag]??=[]).push(value);lastTag=tag;
   if(tags[tag].length>100)fail();
  }
 }
 if(tags||rows.length===0)fail();
 return rows.map(({tags,raw})=>{
  const a=tag=>tags[tag]?.[0]??null;
  return {raw,type:a('TY'),title:a('TI')??a('T1'),creators:tags.AU??tags.A1??[],year:a('PY')??a('Y1'),edition:a('ET'),containerTitle:a('T2')??a('JO')??a('JF'),publisher:a('PB'),doi:a('DO'),url:a('UR'),language:a('LA')};
 });
}
function bibtex(raw){
 const records=[];let p=0;
 const skip=()=>{while(p<raw.length&&/\s/.test(raw[p]))p++;};
 function parseValue(){
  skip();const opener=raw[p];let result='';
  if(opener==='{'){
   p++;let depth=1;
   while(p<raw.length&&depth){const c=raw[p++];if(c==='{'&&raw[p-2]!=='\\')depth++;else if(c==='}'&&raw[p-2]!=='\\')depth--;if(depth)result+=c;}
   if(depth!==0)fail();
  }else if(opener==='"'){
   p++;let closed=false;
   while(p<raw.length){const c=raw[p++];if(c==='"'&&raw[p-2]!=='\\'){closed=true;break;}result+=c;}
   if(!closed)fail();
  }else{
   const begin=p;while(p<raw.length&&/[A-Za-z0-9-]/.test(raw[p]))p++;result=raw.slice(begin,p);
   if(!/^[0-9]+$/.test(result))fail(); // Reject macros instead of silently expanding them.
  }
  if(!result.trim()||result.length>MAX_FIELD)fail();return result;
 }
 while(true){skip();if(p===raw.length)break;
  if(raw[p++]!=='@')fail();const start=p-1;
  const m=/^[A-Za-z]+/.exec(raw.slice(p));if(!m)fail();const type=m[0].toLowerCase();p+=m[0].length;
  if(['string','preamble','comment'].includes(type))fail();
  skip();if(raw[p++]!=='{')fail();skip();
  const keyStart=p;while(p<raw.length&&/[^\s,{}]/.test(raw[p]))p++;const key=raw.slice(keyStart,p);
  if(!key||key.length>150||raw[p++]!==',')fail();
  const fields=Object.create(null);
  while(true){skip();if(raw[p]==='}'){p++;break;}
   const name=/^[A-Za-z][A-Za-z0-9_-]*/.exec(raw.slice(p));if(!name)fail();p+=name[0].length;const field=name[0].toLowerCase();
   skip();if(raw[p++]!=='='||Object.hasOwn(fields,field))fail();fields[field]=parseValue();skip();
   if(raw[p]===','){p++;continue;}
   if(raw[p]==='}'){p++;break;}fail();
  }
  if(Object.keys(fields).length>64||bytes(raw.slice(start,p))>MAX_RAW_ITEM)fail();
  records.push({raw:raw.slice(start,p),type,title:fields.title,creators:fields.author?.split(/\s+and\s+/i)??[],year:fields.year,edition:fields.edition,containerTitle:fields.journal??fields.booktitle,publisher:fields.publisher,doi:fields.doi,url:fields.url,language:fields.language,citationKey:key});
  if(records.length>MAX_ITEMS)fail();
 }
 if(!records.length)fail();return records;
}
function cslItem(item){
 if(!obj(item))fail();
 const creators=[];
 if(item.author!==undefined){if(!Array.isArray(item.author)||item.author.length>100)fail();for(const a of item.author){if(!obj(a))fail();creators.push(a.literal??[a.given,a.family].filter(Boolean).join(' '));}}
 let issued=null;
 if(item.issued!==undefined){if(!obj(item.issued)||!Array.isArray(item.issued['date-parts'])||!Array.isArray(item.issued['date-parts'][0]))fail();issued=item.issued['date-parts'][0][0];}
 if(item.type!==undefined)safe(item.type,120);
 return {raw:JSON.stringify(item),type:item.type,title:item.title,creators,year:issued,edition:item.edition,containerTitle:item['container-title'],publisher:item.publisher,doi:item.DOI??item.doi,url:item.URL??item.url,language:item.language};
}
function values(form,raw){
 if(form==='ris')return ris(raw);
 if(form==='bibtex')return bibtex(raw);
 let input;try{input=JSON.parse(raw);}catch{fail();}
 const items=Array.isArray(input)?input:[input];if(!items.length||items.length>MAX_ITEMS)fail();
 if(form==='manual'&&items.length!==1)fail();
 return items.map(cslItem);
}
/** Bounded parse; original item bytes and source attribution remain alongside normalized leads. */
export function parseBibliography(format,raw,attribution){
 if(!FORMATS.includes(format))fail();safe(raw,MAX_INPUT);if(bytes(raw)>MAX_INPUT)fail();
 const where=validateAttribution(attribution);
 const items=values(format,raw);
 return frozen(items.map((item,i)=>{
  safe(item.type,120);const title=safe(item.title,MAX_TITLE);
  if(!Array.isArray(item.creators)||item.creators.length>100)fail();
  const creators=item.creators.map(s=>safe(s,300));
  if(bytes(item.raw)>MAX_RAW_ITEM)fail();
  return {
   ordinal:i,format,original:item.raw,sha256:hash(item.raw),sourceAttribution:where,
   normalized:{title,creators,type:item.type,year:year(item.year),edition:optional(item.edition,100),
    containerTitle:optional(item.containerTitle,300),publisher:optional(item.publisher,300),
    doi:normalizeDoi(item.doi),url:safeUrl(item.url),language:optional(item.language,80)},
   review:'discovery-only',rights:'unreviewed',publicationApproved:false
  };
 }));
}
function titleKey(s){return s.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
/** Advisory only. Same title, different edition/year must not be auto-merged. */
export function compareBibliographicLeads(left,right){
 const a=left?.normalized,b=right?.normalized;if(!obj(a)||!obj(b))fail();
 const sameDoi=!!a.doi&&a.doi===b.doi;
 const sameTitle=!!a.title&&titleKey(a.title)===titleKey(b.title);
 const differentEdition=!!a.edition&&!!b.edition&&titleKey(a.edition)!==titleKey(b.edition);
 const differentYear=a.year!==null&&b.year!==null&&a.year!==b.year;
 const hint=sameDoi?'matching-doi':sameTitle?(differentEdition||differentYear?'same-title-different-edition-or-year':'matching-title'):'no-match';
 return frozen({hint,requiresHumanDecision:true,autoMerge:false,sourceIndependence:'not-established'});
}
export const BIBLIOGRAPHY_FORMATS=FORMATS;
export const BIBLIOGRAPHY_ACCESS_STATES=ACCESS;
