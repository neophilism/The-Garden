import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateLocator,validateReanchorProposal,resolveLocator,proposeReanchor,webAnnotationSelectors,sha256,TEXT_PROFILE} from '../../packages/domain/src/historical/locators.mjs';
import {HistoricalModelError} from '../../packages/domain/src/historical/model.mjs';
const L='11111111-1111-4111-8111-111111111111',S='22222222-2222-4222-8222-222222222222';
const bytes=new TextEncoder().encode('fixture original file bytes');
const resourceHash=await sha256(bytes);
const fixtureText='A\u{1f33f} cafe\u0301; cited claim. \u0627\u0644\u0646\u0635';
const textHash=await sha256(new TextEncoder().encode(fixtureText));
const page={ordinal:2,label:'iv',canvasId:'urn:garden:fixture:canvas:three'};
const locator=()=>({recordType:'locator',schemaVersion:1,id:L,source:{id:S,revision:'2'},resourceSha256:resourceHash,originalIdentifiers:[{namespace:'fixture archive',identifier:'register folio iv'}],page,selector:{type:'text',profile:TEXT_PROFILE,textSha256:textHash,position:{start:0,end:2},quote:{exact:'A\u{1f33f}',prefix:'',suffix:' '}},description:null});
const resource=()=>({source:{id:S,revision:'2'},bytes,page,text:fixtureText,textProfile:TEXT_PROFILE});
for(const [label,edit] of [
 ['unknown keys',v=>v.extra=true],['wrong record type',v=>v.recordType='claim'],['numeric revision',v=>v.source.revision=2],['revision zero',v=>v.source.revision='0'],
 ['invalid hash',v=>v.resourceSha256='abc'],['missing selectors',v=>{v.selector.position=null;v.selector.quote=null;}],['reversed text range',v=>v.selector.position.end=0],
 ['empty quote',v=>v.selector.quote.exact=''],['invalid unicode',v=>v.selector.quote.exact='\ud800'],['overlong context',v=>v.selector.quote.prefix='x'.repeat(257)],
 ['negative page',v=>v.page.ordinal=-1],['unknown profile',v=>v.selector.profile='guess'],['self source',v=>v.source.id=L],
 ['duplicate source identifiers',v=>v.originalIdentifiers.push({identifier:'register folio iv',namespace:'fixture archive'})]
])test('locator rejects '+label,()=>{const v=structuredClone(locator());edit(v);assert.throws(()=>validateLocator(v),HistoricalModelError);});
test('unknown page label and exact Unicode identifiers survive unchanged',()=>{const v=structuredClone(locator());v.page.label=null;v.originalIdentifiers[0].identifier='\u00c9\u0301 / 001';const r=validateLocator(v);assert.deepEqual(r,v);assert(Object.isFrozen(r));assert(!Object.isFrozen(v));});
test('Unicode positions count code points, not UTF-16 units',async()=>{const r=await resolveLocator(locator(),resource());assert.equal(r.status,'resolved');assert.deepEqual(r.selection,{start:0,end:2});assert.equal(r.warning,null);});
for(const [label,edit,reason] of [
 ['witness version',r=>r.source.revision='3','source-version-mismatch'],['witness identity',r=>r.source.id=L,'source-version-mismatch'],
 ['source bytes',r=>r.bytes=new TextEncoder().encode('other'),'resource-hash-mismatch'],['page ordinal',r=>r.page.ordinal=3,'page-map-mismatch'],
 ['printed label',r=>r.page.label='3','page-map-mismatch'],['canvas identity',r=>r.page.canvasId='urn:other','page-map-mismatch'],
 ['text reflow',r=>r.text=fixtureText.replace(' ','  '),'text-hash-mismatch'],['text profile',r=>r.textProfile='html','text-profile-mismatch'],['missing transcription',r=>delete r.text,'text-unavailable']
])test('resolver orphans mismatched '+label,async()=>{const v=structuredClone(locator()),r=structuredClone(resource());edit(r);const got=await resolveLocator(v,r);assert.equal(got.status,'orphaned');assert.equal(got.reason,reason);});
test('a position/quote disagreement does not silently reanchor',async()=>{const v=structuredClone(locator());v.selector.position={start:3,end:5};assert.equal((await resolveLocator(v,resource())).reason,'position-quote-mismatch');});
test('out-of-bounds positions are visibly orphaned',async()=>{const v=structuredClone(locator());v.selector.quote=null;v.selector.position.end=1000;assert.equal((await resolveLocator(v,resource())).reason,'position-outside-text');});
test('CSS reflow is irrelevant to stored canonical plain text',async()=>{const r=resource();r.cssWidth=240;assert.equal((await resolveLocator(locator(),r)).status,'resolved');});
test('combining-character split is surfaced, not normalized away',async()=>{const v=structuredClone(locator());v.selector.quote=null;v.selector.position={start:3,end:7};const r=await resolveLocator(v,resource());assert.equal(r.warning,'selection-splits-grapheme-cluster');});
async function textFixture(body,exact,prefix='',suffix=''){
 const v=structuredClone(locator());v.selector={type:'text',profile:TEXT_PROFILE,textSha256:await sha256(new TextEncoder().encode(body)),position:null,quote:{exact,prefix,suffix}};
 return {v,r:{...resource(),text:body}};
}
test('quote-only unique anchors resolve at code-point positions',async()=>{const {v,r}=await textFixture('x\u{1f33f} target end','target');assert.deepEqual((await resolveLocator(v,r)).selection,{start:3,end:9});});
test('ambiguous repeated quotes are not reduced to the first match',async()=>{const {v,r}=await textFixture('same same','same');const out=await resolveLocator(v,r);assert.equal(out.status,'ambiguous');assert.equal(out.candidates.length,2);});
test('quote prefix and suffix disambiguate exactly',async()=>{const {v,r}=await textFixture('before same after; other same ending','same','before ',' after');assert.deepEqual((await resolveLocator(v,r)).selection,{start:7,end:11});});
test('quote bounds report ambiguity instead of dropping later matches',async()=>{const {v,r}=await textFixture('x '.repeat(130),'x');const out=await resolveLocator(v,r);assert.equal(out.status,'ambiguous');assert.equal(out.inspectionBoundReached,true);assert.deepEqual(out.candidates,[]);});
test('absent quote is orphaned',async()=>{const {v,r}=await textFixture('before','absent');assert.equal((await resolveLocator(v,r)).reason,'quote-not-found');});
test('matching respects NFC versus decomposed Unicode without implicit rewrite',async()=>{const {v,r}=await textFixture('cafe\u0301','caf\u00e9');assert.equal((await resolveLocator(v,r)).status,'orphaned');});
test('logical bidirectional text offsets stay intact',async()=>{const {v,r}=await textFixture('A \u0627\u0644\u0646\u0635 Z','\u0627\u0644\u0646\u0635');assert.deepEqual((await resolveLocator(v,r)).selection,{start:2,end:6});});
test('position selectors can select whitespace-only canonical text',async()=>{const {v,r}=await textFixture('   ','x');v.selector.quote=null;v.selector.position={start:0,end:2};assert.equal((await resolveLocator(v,r)).status,'resolved');});
test('reanchor is a proposal and never mutates the original',async()=>{const v=structuredClone(locator()),saved=JSON.stringify(v);const r={...resource(),source:{id:S,revision:'3'},text:'leading '+fixtureText,bytes:new TextEncoder().encode('new file')};const out=await proposeReanchor(v,r);assert.equal(out.status,'proposed');assert.equal(out.adopted,false);assert.equal(out.position.start,8);assert.equal(JSON.stringify(v),saved);assert(!Object.isFrozen(r.source));});
test('reanchor never silently substitutes a different witness',async()=>{const r={...resource(),source:{id:L,revision:'3'}};assert.equal((await proposeReanchor(locator(),r)).reason,'different-source-needs-new-locator');});
test('reanchor ambiguity requires a new explicit decision',async()=>{const r={...resource(),text:fixtureText+' '+fixtureText};assert.equal((await proposeReanchor(locator(),r)).status,'ambiguous');});
test('position-only locator cannot guess a reanchor',async()=>{const v=structuredClone(locator());v.selector.quote=null;assert.equal((await proposeReanchor(v,resource())).reason,'quote-required-for-reanchor');});
const imageSelector=()=>({type:'image',unit:'pixel',x:10,y:20,width:100,height:200,canvasWidth:1000,canvasHeight:800});
test('image regions bind to original image dimensions',async()=>{const v={...locator(),selector:imageSelector()};assert.equal((await resolveLocator(v,{...resource(),dimensions:{width:1000,height:800}})).status,'resolved');assert.equal(webAnnotationSelectors(v)[0].value,'xywh=pixel:10,20,100,200');});
test('cropped image extent cannot silently relocate a region',async()=>{const v={...locator(),selector:imageSelector()};assert.equal((await resolveLocator(v,{...resource(),dimensions:{width:100,height:200}})).reason,'canvas-mismatch');});
test('image coordinates never clamp an invalid rectangle',()=>{const v={...locator(),selector:{...imageSelector(),x:990}};assert.throws(()=>validateLocator(v),HistoricalModelError);});
test('fractional original pixels are rejected',()=>{const v={...locator(),selector:{...imageSelector(),x:0.5}};assert.throws(()=>validateLocator(v),HistoricalModelError);});
test('time intervals are half-open integer milliseconds with exact duration',async()=>{const v={...locator(),page:null,selector:{type:'time',startMs:1000,endMs:2501,durationMs:10000}};assert.equal((await resolveLocator(v,{...resource(),durationMs:10000})).status,'resolved');assert.equal(webAnnotationSelectors(v)[0].value,'t=npt:1.000,2.501');assert.equal((await resolveLocator(v,{...resource(),durationMs:12000})).reason,'duration-mismatch');});
test('time outside known media and string seconds are rejected',()=>{for(const s of [{type:'time',startMs:2,endMs:5,durationMs:4},{type:'time',startMs:'1',endMs:5,durationMs:10}])assert.throws(()=>validateLocator({...locator(),selector:s}),HistoricalModelError);});
test('whole-resource references are still hash and version bound',async()=>{const v={...locator(),selector:{type:'whole'}};assert.equal((await resolveLocator(v,resource())).status,'resolved');assert.deepEqual(webAnnotationSelectors(v),[]);});
test('selector exchange does not imply full annotation or rights clearance',()=>{const result=webAnnotationSelectors(locator());assert.deepEqual(result.map(r=>r.type),['TextPositionSelector','TextQuoteSelector']);assert.equal(result[0].end,2);});
test('immutable reanchor proposals cannot claim approval or reuse identities',()=>{const v={recordType:'locator-reanchor',schemaVersion:1,id:'33333333-3333-4333-8333-333333333333',fromLocatorId:L,toLocatorId:S,reason:'Explicit editorial reinspection required',decision:'proposed'};assert.equal(validateReanchorProposal(v).decision,'proposed');assert.throws(()=>validateReanchorProposal({...v,decision:'approved'}));assert.throws(()=>validateReanchorProposal({...v,toLocatorId:L}));});
test('hashing rejects unbounded or non-byte input',async()=>{await assert.rejects(()=>sha256('bytes'));await assert.rejects(()=>sha256(new Uint8Array(16*1024*1024+1)));});
