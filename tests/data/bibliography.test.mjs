import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBibliography,normalizeDoi,compareBibliographicLeads,validateAttribution} from '../../packages/domain/src/historical/bibliography.mjs';
import {createDoiLeadResolver} from '../../services/workers/src/bibliographic-intake.mjs';

const where={provider:'catalog',repositoryId:null,locator:'Shelf 3 / catalog entry',license:'unknown',access:'unknown',retrievedAt:'2026-10-12T19:00:00Z'};
const ris='TY  - JOUR\nTI  - A contested history\nAU  - N. Witness\nPY  - 1872\nDO  - doi:10.1234/Test.Data\nER  - ';
const bib='@article{a-1872, title={A contested history}, author={N. Witness and A. Reader}, year=1872, doi={https://doi.org/10.1234/Test.Data}, journal="Journal of Record"}';
const csl='{"type":"book","title":"A contested history","author":[{"given":"N.","family":"Witness"}],"issued":{"date-parts":[[1872]]},"edition":"2","DOI":"10.1234/test.data"}';
const norm=(format,raw)=>parseBibliography(format,raw,where)[0];
for(const [kind,source] of [['ris',ris],['bibtex',bib],['csl-json',csl],['manual',csl]]){
 test(`parse ${kind} preserves original and marks discovery-only`,()=>{
  const v=norm(kind,source);assert.equal(v.normalized.title,'A contested history');
  assert.equal(v.normalized.doi,'10.1234/test.data');assert.equal(v.review,'discovery-only');
  assert.equal(v.publicationApproved,false);assert.equal(v.rights,'unreviewed');
  assert.equal(v.original,source);assert(Object.isFrozen(v));assert(Object.isFrozen(v.normalized));
 });
}
test('RIS CRLF original and multiline titles retain exact raw bytes',()=>{
 const text='TY  - BOOK\r\nTI  - A documented\r\n      collection\r\nAU  - Historian\r\nER  - ';
 const v=norm('ris',text);assert.equal(v.original,text);assert.equal(v.normalized.title,'A documented\ncollection');
});
test('RIS repeated authors survive as separate people; metadata assertions not upgraded',()=>{
 const text='TY  - BOOK\nTI  - Kingdoms\nAU  - One, First\nAU  - Two, Second\nT2  - Notebook\nET  - Third\nLA  - en\nER  - ';
 const r=norm('ris',text);assert.deepEqual(r.normalized.creators,['One, First','Two, Second']);assert.equal(r.normalized.edition,'Third');
});
test('RIS two distinct records are not silently collapsed',()=>{
 const records=parseBibliography('ris',ris+'\n'+ris,where);assert.equal(records.length,2);assert.deepEqual(records.map(x=>x.ordinal),[0,1]);
});
test('bibtex brace depth and quoted values preserve internal punctuation',()=>{
 const v=norm('bibtex','@book{a, title={Historical {Africas}: claims}, year={1891}, author={Ada and Bea}}');
 assert.equal(v.normalized.title,'Historical {Africas}: claims');assert.deepEqual(v.normalized.creators,['Ada','Bea']);
});
test('same title, different edition is never automatically merged',()=>{
 const a=norm('csl-json',csl),b=norm('csl-json',csl.replace('"2"','"3"'));
 const result=compareBibliographicLeads(a,b);assert.equal(result.autoMerge,false);assert.equal(result.requiresHumanDecision,true);assert.equal(result.hint,'matching-doi');
});
test('same title differing year without a DOI remains a distinct-edition lead',()=>{
 const a=norm('manual','{"type":"book","title":"The Chronicle","issued":{"date-parts":[[1818]]}}');
 const b=norm('manual','{"type":"book","title":"The Chronicle","issued":{"date-parts":[[1904]]}}');
 assert.equal(compareBibliographicLeads(a,b).hint,'same-title-different-edition-or-year');
});
test('unknown source independence remains unknown even for matching identifiers',()=>{
 const v=compareBibliographicLeads(norm('ris',ris),norm('bibtex',bib));assert.equal(v.sourceIndependence,'not-established');
});
for(const bad of ['10.12/no','https://evil.net/10.1234/x','10.1234/hello?redirect=1','10.1234/hello#frag','10.1234/a/../x','doi:']){
 test(`unsafe DOI rejected ${bad}`,()=>assert.throws(()=>normalizeDoi(bad)));
}
for(const [format,raw] of [
 ['ris','TY  - BOOK\nTI  - Incomplete'],['ris','ER  -'],['ris','TI  - No start\nER  -'],
 ['ris','TY  - BOOK\nTI  - Title\nUNKNOWN\nER  -'],
 ['bibtex','@article{lost,title={Unclosed}'],['bibtex','@string{foo="hello"}'],
 ['bibtex','@article{a,title=evil_macro}'],['bibtex','@article{a, title={Good},title={Overwritten}}'],
 ['csl-json','{broken'],['csl-json','{"type":"book"}'],
 ['manual','[{},{}]'],['manual','{"type":"book","title":"Ok","URL":"file:///etc/passwd"}'],
 ['manual','{"type":"book","title":"Ok","URL":"http://127.0.0.1:3000/foo"}'],
 ['manual','{"type":"book","title":"Ok","URL":"https://user:pass@example.org/"}']
])test(`malformed ${format} is rejected (${raw.slice(0,24)})`,()=>assert.throws(()=>parseBibliography(format,raw,where)));
test('unknown provider license is explicit and attribution cannot carry arbitrary keys',()=>{
 assert.equal(validateAttribution(where).license,'unknown');assert.throws(()=>validateAttribution({...where,verified:true}));
});
test('oversized import rejected before parsing',()=>assert.throws(()=>parseBibliography('ris','x'.repeat(256*1024+2),where)));
test('remote DOI metadata is only a discovery lead, with provider rights recorded',async()=>{
 const resolve=createDoiLeadResolver({providers:{catalog:async doi=>({status:'ok',metadata:{type:'article-journal',title:'Catalog only',DOI:doi},attribution:{repositoryId:null,locator:'catalog DOI record',license:'restricted',access:'restricted',retrievedAt:'2026-10-12T19:00:00Z'}})}});
 const r=await resolve('10.1234/example','catalog');assert.equal(r.status,'ok');assert.equal(r.lead.review,'discovery-only');assert.equal(r.lead.sourceAttribution.license,'restricted');assert.equal(r.lead.publicationApproved,false);
});
for(const status of ['access-denied','robots-disallowed','rate-limited','not-found']){
 test(`remote ${status} cannot become a false candidate`,async()=>{
  const resolver=createDoiLeadResolver({providers:{catalog:async()=>({status})}});
  assert.deepEqual(await resolver('10.1234/example','catalog'),{status,lead:null});
 });
}
test('remote provider timeout does not invent successful metadata',async()=>{
 const resolver=createDoiLeadResolver({providers:{catalog:async()=>new Promise(()=>{})},timeoutMs:100});
 assert.deepEqual(await resolver('10.1234/example','catalog'),{status:'timeout',lead:null});
});
test('remote lookup rejects tampered DOI and missing attribution',async()=>{
 const resolver=createDoiLeadResolver({providers:{catalog:async()=>({status:'ok',metadata:{type:'book',title:'X',DOI:'10.1234/other'},attribution:{locator:'catalog DOI record'}})}});
 assert.equal((await resolver('10.1234/example','catalog')).status,'unavailable');
 assert.equal((await resolver('10.1234/example','other')).status,'unavailable');
});
test('remote provider exception message never enters response',async()=>{
 const resolver=createDoiLeadResolver({providers:{catalog:async()=>{throw new Error('credential-secret-forbidden');}}});
 const r=await resolver('10.1234/example','catalog');assert.equal(r.status,'unavailable');assert(!JSON.stringify(r).includes('credential-secret-forbidden'));
});
