import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LIFECYCLE_MANIFEST_PROFILE, LIFECYCLE_DEPENDENCY_LIMITS, LifecycleDependencyError,
 lifecyclePayloadDigest, lifecycleManifestDigest, extractLifecycleDependencies,
 inspectLifecycleDependencyClosure
} from '../../packages/domain/src/lifecycle/dependencies.mjs';

const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const W=id(1), OTHER=id(2), H='a'.repeat(64), CANARY='PRIVATE-CONTENT-MUST-NOT-APPEAR';
const temporal=()=>({verbatim:null,earliestYear:null,latestYear:null,calendar:null});
const source=(n,parents=[],extra={})=>({recordType:'source',schemaVersion:1,id:id(n),title:CANARY,form:parents.length?'edition':'witness',archivalItemId:null,derivedFrom:parents.map(id),assertions:[],representation:null,...extra});
const digital=(n=12,parent=11)=>source(n,[parent],{form:'digital-representation',representation:{sha256:H,mediaType:'application/pdf',byteLength:123,originalFilename:CANARY+'.pdf'}});
const locator=(n=20,sourceId=12,sourceRevision='1',extra={})=>({recordType:'locator',schemaVersion:1,id:id(n),source:{id:id(sourceId),revision:sourceRevision},resourceSha256:H,originalIdentifiers:[],page:null,selector:{type:'whole'},description:CANARY,...extra});
const claim=(n=30,locatorId=null)=>({recordType:'claim',schemaVersion:1,id:id(n),assertionType:locatorId===null?'historical-interpretation':'source-testimony',proposition:{subject:CANARY,predicate:'reports',object:CANARY},wording:CANARY,attribution:locatorId===null?null:{locatorId:id(locatorId),agentLabel:CANARY},notes:null});
const evidence=(n=40,claimId=31,locatorId=20,claimRevision='1')=>({recordType:'evidence-link',schemaVersion:1,id:id(n),claim:{id:id(claimId),revision:claimRevision},locatorId:id(locatorId),relation:'supports',rationale:CANARY});
const placement=(n=50,deps=[{id:id(31),revision:'1'}])=>({recordType:'claim-placement',schemaVersion:1,id:id(n),target:{kind:'webpage',identifier:'https://private.invalid/'+CANARY,version:'private-version',language:null},dependencies:deps});
const entity=(n=60,extra={})=>({recordType:'entity',schemaVersion:1,id:id(n),kind:'place',title:CANARY,summary:CANARY,names:[],sourceIdentities:[],temporal:temporal(),redirect:null,...extra});
const relation=(n=70,from=60,to=61)=>({recordType:'relationship',schemaVersion:1,id:id(n),title:CANARY,predicate:'related_to',fromId:id(from),fromKind:'place',toId:id(to),toKind:'place',assessment:'unreviewed',explanation:CANARY,evidence:[],temporal:temporal()});
const geography=(n=80)=>({recordType:'geographic-assertion',schemaVersion:1,id:id(n),subject:{id:id(60),revision:'1',kind:'place'},claim:{id:id(31),revision:'1'},evidence:[{id:id(40),revision:'1'}],crs:'OGC:CRS84',geometry:{type:'Point',coordinates:[123.456789,45.123456]},validDuring:temporal(),uncertainty:{kind:'reported-exact',radiusMeters:null,description:CANARY},context:'historical-assertion',sensitivity:'historical',names:[],rationale:CANARY});
const row=(payload,revision='1',workspaceId=W)=>({workspaceId,recordId:payload.id,revision,payload});
function manifest(rows) {
 const heads=new Map();
 for (const r of rows) if (!heads.has(r.recordId) || BigInt(heads.get(r.recordId))<BigInt(r.revision)) heads.set(r.recordId,r.revision);
 return {profile:LIFECYCLE_MANIFEST_PROFILE,workspaceId:W,inventoryRevision:'7',coverage:'complete',heads:[...heads].map(([recordId,revision])=>({recordId,revision})),revisions:rows.map(r=>({recordId:r.recordId,revision:r.revision,payloadDigest:lifecyclePayloadDigest(r.payload)}))};
}
const snapshot=(m,rows)=>({workspaceId:W,inventoryRevision:m.inventoryRevision,manifestDigest:lifecycleManifestDigest(m),coverage:'complete',revisions:structuredClone(rows)});
const request=(roots,limits=null)=>({rootRecordIds:roots.map(x=>typeof x==='number'?id(x):x),limits});
function inspect(rows,roots,limits=null) { const m=manifest(rows); return inspectLifecycleDependencyClosure(m,snapshot(m,rows),request(roots,limits)); }
const codes=r=>r.unresolved.map(x=>x.code);
const cap=(key,n)=>({...LIFECYCLE_DEPENDENCY_LIMITS,[key]:n});
const denied=work=>assert.throws(work,e=>e instanceof LifecycleDependencyError && e.code==='lifecycle_dependencies_unavailable' && e.message==='Lifecycle dependency snapshot unavailable' && !Object.hasOwn(e,'cause'));
const graph=()=>[source(10),source(11,[10]),digital(),locator(),locator(22),claim(30,20),claim(31),evidence(),placement(),entity(),entity(61),relation(),geography(),{recordType:'locator-reanchor',schemaVersion:1,id:id(21),fromLocatorId:id(20),toLocatorId:id(22),reason:CANARY,decision:'proposed'}].map(p=>row(p));

test('canonical payload digest has an independently calculated Unicode/escaping vector',()=>{
 const a={text:'a"b\\c\nÅ😀',nested:{z:2,a:1}};
 assert.equal(lifecyclePayloadDigest(a),'a7568ceb667555f3c33b2f01503865b1cca41311d285b1a738d81f0f8c3890f7');
 assert.equal(lifecyclePayloadDigest({nested:{a:1,z:2},text:a.text}),lifecyclePayloadDigest(a));
 assert.notEqual(lifecyclePayloadDigest({...a,text:a.text+' '}),lifecyclePayloadDigest(a));
});
test('manifest digest binds exact head, retained digest, workspace, generation and coverage; order is irrelevant',()=>{
 const m=manifest([row(source(10)),row(source(11,[10]))]), expected=lifecycleManifestDigest(m);
 assert.equal(lifecycleManifestDigest({...m,heads:[...m.heads].reverse(),revisions:[...m.revisions].reverse()}),expected);
 for (const change of [{workspaceId:OTHER},{inventoryRevision:'8'},{coverage:'partial'},{heads:[{recordId:id(10),revision:'2'},m.heads[1]]},{revisions:[{...m.revisions[0],payloadDigest:'b'.repeat(64)},m.revisions[1]]}]) assert.notEqual(lifecycleManifestDigest({...m,...change}),expected);
});
test('a complete simple retained inventory is a metadata result with no authority or material claim',()=>{
 const r=inspect([row(source(10)),row(source(11,[10]))],[10]);
 assert.equal(r.completeness,'complete'); assert.equal(r.completenessScope,'supplied-retained-manifest');
 assert.deepEqual(r.affectedRecords.map(x=>x.recordId),[id(10),id(11)]);
 assert.equal(r.globalCompleteness,'not-established'); assert.equal(r.materialInventory,'not-inspected');
 for (const key of ['effectsVerified','authorityVerified','physicalErasureAuthorized']) assert.equal(r[key],false);
});
test('archival parent, source ancestry/archive and catalog provenance remain distinct edges',()=>{
 const archive={recordType:'archival-unit',schemaVersion:1,id:id(100),title:null,level:'item',parentId:id(101),assertions:[{id:id(102),field:'title',value:CANARY,provenance:[{sourceId:id(10),locator:CANARY}],supersedes:null}],notes:null};
 const a=extractLifecycleDependencies(row(archive));
 assert.deepEqual(new Set(a.edges.map(e=>e.edgeKind)),new Set(['archival-parent','catalog-provenance']));
 const s=extractLifecycleDependencies(row(source(11,[10],{archivalItemId:id(100),assertions:archive.assertions})));
 assert.deepEqual(new Set(s.edges.map(e=>e.edgeKind)),new Set(['source-derived','source-archive','catalog-provenance']));
 assert.equal(s.edges.find(e=>e.edgeKind==='source-derived').relationshipClass,'derivation');
 assert.equal(s.extractionCompleteness,'complete'); assert.ok(codes(s).includes('unverified-provenance'));
});
test('all actual v1 reference families are extracted, including reanchor and geographic pins',()=>{
 const r=inspect(graph(),[10]);
 for (const n of [10,11,12,20,21,22,30,31,40,50,80]) assert.ok(r.affectedRecords.some(x=>x.recordId===id(n)),String(n));
 for (const kind of ['source-derived','locator-source','reanchor-from','reanchor-to','claim-attribution','evidence-claim','evidence-locator','evidence-review-impact','placement-dependency','geography-claim','geography-evidence']) assert.ok(r.edges.some(e=>e.edgeKind===kind),kind);
 const geo=extractLifecycleDependencies(row(geography()));
 assert.deepEqual(new Set(geo.edges.map(e=>e.edgeKind)),new Set(['geography-subject','geography-claim','geography-evidence']));
 assert.ok(geo.edges.every(e=>e.inputBinding==='exact' && e.inputRevision==='1'));
});
test('entity names, redirect provenance and relationship endpoints are not omitted',()=>{
 const provenance=[{sourceId:id(10),locator:CANARY}];
 const e=entity(60,{names:[{id:id(600),value:CANARY,language:null,script:null,usage:'historical',provenance}],redirect:{targetId:id(61),reason:CANARY,evidence:provenance}});
 const a=extractLifecycleDependencies(row(e));
 assert.deepEqual(new Set(a.edges.map(x=>x.edgeKind)),new Set(['entity-name-provenance','entity-redirect','entity-redirect-provenance']));
 const rel={...relation(),evidence:provenance}, r=inspect([row(source(10)),row(e),row(entity(61)),row(rel)],[10]);
 assert.ok(r.affectedRecords.some(x=>x.recordId===id(70))); assert.equal(r.completeness,'incomplete');
 assert.ok(codes(r).includes('unverified-provenance'));
});
test('relationship endpoint impact does not tombstone or infer the other endpoint',()=>{
 const r=inspect([row(entity()),row(entity(61)),row(relation())],[60]);
 assert.deepEqual(r.affectedRecords.map(x=>x.recordId),[id(60),id(70)]);
 assert.equal(r.completeness,'complete');
});
test('exact and current references retain separate declared and resolved revisions',()=>{
 const r=inspect([row(source(10)),row(source(11,[10])),row(digital()),row(digital(),'2'),row(locator())],[10]);
 const pin=r.edges.find(e=>e.edgeKind==='locator-source');
 assert.equal(pin.inputBinding,'exact'); assert.equal(pin.inputRevision,'1'); assert.equal(pin.resolvedInputRevision,'1');
 const current=r.edges.find(e=>e.edgeKind==='source-derived' && e.originRecordId===id(12));
 assert.equal(current.inputBinding,'current'); assert.equal(current.inputRevision,null); assert.equal(current.resolvedInputRevision,'1');
});
test('a current rewrite cannot erase an older retained dependency',()=>{
 const old=row(source(11,[10])), latest=row(source(11,[],{form:'edition'}),'2');
 const r=inspect([row(source(10)),old,latest],[10]);
 assert.equal(r.completeness,'complete');
 assert.deepEqual(r.affectedRecords.find(x=>x.recordId===id(11)).retainedRevisions,['1','2']);
 assert.equal(r.edges.find(x=>x.dependentRecordId===id(11)).originRevision,'1');
});
test('cycles in the union of retained source revisions terminate without discarding historical edges',()=>{
 const rows=[row(source(10,[],{form:'edition'})),row(source(11,[10])),row(source(11,[],{form:'edition'}),'2'),row(source(10,[11]),'2')];
 const r=inspect(rows,[10]);
 assert.equal(r.completeness,'complete'); assert.equal(r.affectedRecords.length,2); assert.equal(r.edges.length,2);
});
test('evidence impact reaches a claim-only placement and keeps the reverse review edge distinct',()=>{
 const r=inspect(graph(),[40]);
 for (const n of [31,40,50,80]) assert.ok(r.affectedRecords.some(x=>x.recordId===id(n)));
 assert.ok(!r.affectedRecords.some(x=>x.recordId===id(20)));
 const impact=r.edges.find(e=>e.edgeKind==='evidence-review-impact');
 assert.equal(impact.inputRecordId,id(40)); assert.equal(impact.dependentRecordId,id(31));
 assert.equal(impact.originRecordId,id(40)); assert.equal(impact.originRevision,'1');
 assert.equal(impact.relationshipClass,'review-impact'); assert.equal(impact.dependentRevision,'1');
 assert.ok(r.edges.some(e=>e.edgeKind==='evidence-claim' && e.dependentRecordId===id(40)));
});
test('duplicate provenance paths collapse while edge kind and exact revisions remain distinct',()=>{
 const p={sourceId:id(10),locator:CANARY};
 const e=entity(60,{names:[{id:id(600),value:CANARY,language:null,script:null,usage:'historical',provenance:[p,p]}],redirect:{targetId:id(61),reason:CANARY,evidence:[p]}});
 const a=extractLifecycleDependencies(row(e));
 assert.equal(a.edges.filter(x=>x.edgeKind==='entity-name-provenance').length,1);
 assert.equal(a.edges.filter(x=>x.inputRecordId===id(10)).length,2);
 const pl=extractLifecycleDependencies(row(placement(50,[{id:id(31),revision:'1'},{id:id(31),revision:'2'}])));
 assert.equal(pl.edges.length,2); assert.deepEqual(new Set(pl.edges.map(e=>e.inputRevision)),new Set(['1','2']));
});
test('snapshot and root ordering do not change canonical closure or extraction receipts',()=>{
 const rows=graph(), m=manifest(rows), a=inspectLifecycleDependencyClosure(m,snapshot(m,rows),request([10,40]));
 const reverse={...m,heads:[...m.heads].reverse(),revisions:[...m.revisions].reverse()};
 const b=inspectLifecycleDependencyClosure(reverse,snapshot(reverse,[...rows].reverse()),request([40,10,40]));
 assert.deepEqual(b,a);
 const e=extractLifecycleDependencies(rows[0]), again=extractLifecycleDependencies({...rows[0],payload:Object.fromEntries(Object.entries(rows[0].payload).reverse())});
 assert.deepEqual(e,again);
});

for (const [name,change] of [
 ['missing retained row',s=>s.revisions.pop()],
 ['unexpected retained row',s=>s.revisions.push(row(source(13)))],
 ['duplicate retained row',s=>s.revisions.push(structuredClone(s.revisions[0]))],
 ['changed payload',s=>s.revisions[0].payload.title='changed'],
 ['partial snapshot',s=>s.coverage='partial'],
 ['foreign snapshot workspace',s=>s.workspaceId=OTHER],
 ['stale inventory generation',s=>s.inventoryRevision='6'],
 ['wrong manifest commitment',s=>s.manifestDigest='b'.repeat(64)]
]) test(name+' cannot become complete',()=>{
 const rows=[row(source(10)),row(source(11,[10]))], m=manifest(rows), s=snapshot(m,rows); change(s);
 const r=inspectLifecycleDependencyClosure(m,s,request([10])); assert.equal(r.completeness,'incomplete'); assert.ok(r.unresolved.length); assert.equal(r.effectsVerified,false);
});
test('an omitted manifest coordinate is caught by the independently retained snapshot set',()=>{
 const rows=[row(source(10)),row(source(11,[10]))], m=manifest(rows); m.revisions.pop(); m.heads.pop();
 const r=inspectLifecycleDependencyClosure(m,snapshot(m,rows),request([10]));
 assert.ok(codes(r).includes('unexpected-snapshot-revision')); assert.equal(r.completeness,'incomplete');
});
test('partial authoritative coverage stays incomplete even with matching counts and digests',()=>{
 const rows=[row(source(10))], m={...manifest(rows),coverage:'partial'};
 assert.ok(codes(inspectLifecycleDependencyClosure(m,snapshot(m,rows),request([10]))).includes('partial-coverage'));
});
test('a foreign row does not resolve a same-UUID reference in the requested workspace',()=>{
 const rows=[row(source(10)),row(source(11,[10]))], m=manifest(rows), s=snapshot(m,rows); s.revisions[0].workspaceId=OTHER;
 const r=inspectLifecycleDependencyClosure(m,s,request([11]));
 assert.ok(codes(r).includes('foreign-snapshot-row')); assert.ok(codes(r).includes('foreign-reference'));
 assert.equal(r.completeness,'incomplete');
});
test('an exact missing revision never falls back to the current revision',()=>{
 const rows=[row(source(10)),row(source(11,[10])),row(digital(),'2'),row(locator())];
 const r=inspect(rows,[12]);
 assert.ok(codes(r).includes('missing-exact-reference'));
 const e=r.edges.find(e=>e.edgeKind==='locator-source'); assert.equal(e.inputRevision,'1'); assert.equal(e.resolvedInputRevision,null);
});
test('missing and older current heads remain explicit despite available retained versions',()=>{
 const rows=[row(source(10)),row(source(10),'2'),row(source(11,[10]))], m=manifest(rows);
 for (const heads of [m.heads.filter(h=>h.recordId!==id(10)),m.heads.map(h=>h.recordId===id(10)?{...h,revision:'1'}:h)]) {
  const altered={...m,heads}, r=inspectLifecycleDependencyClosure(altered,snapshot(altered,rows),request([10]));
  assert.equal(r.completeness,'incomplete'); assert.ok(codes(r).some(c=>['missing-current-head','stale-current-head'].includes(c)));
 }
});
test('source bytes metadata and typed target mismatches cannot resolve as compatible references',()=>{
 const rows=[row(source(10)),row(source(11,[10])),row(digital()),row(locator(20,12,'1',{resourceSha256:'b'.repeat(64)}))];
 assert.ok(codes(inspect(rows,[12])).includes('reference-digest-mismatch'));
 assert.ok(codes(inspect([row(entity(10)),row(source(11,[10]))],[10])).includes('incompatible-reference'));
});
test('geographic evidence must evaluate its exact pinned claim revision',()=>{
 const rows=graph().filter(r=>r.recordId!==id(40)); rows.push(row(evidence(40,30)));
 assert.ok(codes(inspect(rows,[30])).includes('incompatible-reference'));
});
test('an existing provenance UUID is still unverified provenance',()=>{
 const e=entity(60,{names:[{id:id(600),value:CANARY,language:null,script:null,usage:'historical',provenance:[{sourceId:id(10),locator:CANARY}]}]});
 const r=inspect([row(source(10)),row(e)],[10]);
 assert.equal(r.edges[0].resolution,'unverified-provenance'); assert.ok(codes(r).includes('unverified-provenance'));
});
test('external IDs and free proposition text do not manufacture canonical references',()=>{
 const e=entity(60,{sourceIdentities:[{namespace:'private-namespace',identifier:id(10)}]}), c=claim(31); c.proposition.subject=id(10);
 const a=extractLifecycleDependencies(row(e)), b=extractLifecycleDependencies(row(c));
 assert.equal(a.edges.length,0); assert.ok(codes(a).includes('external-source-identity')); assert.equal(b.edges.length,0);
 const p=placement(); p.target.identifier=id(10); assert.ok(!extractLifecycleDependencies(row(p)).edges.some(x=>x.inputRecordId===id(10)));
});
test('external representation, canvas and placement coordinates are unresolved without leaking their values',()=>{
 const values=[digital(),locator(20,12,'1',{page:{ordinal:0,label:CANARY,canvasId:'https://private.invalid/'+CANARY}}),placement()];
 for (const v of values) { const a=extractLifecycleDependencies(row(v)); assert.ok(codes(a).some(c=>c.startsWith('external-'))); assert.ok(!JSON.stringify(a).includes(CANARY)); }
});
for (const [name,payload,code] of [
 ['unknown type',{id:id(10),recordType:CANARY,schemaVersion:1,secret:CANARY},'unsupported-record-type'],
 ['unknown schema',{...source(10),schemaVersion:2},'unsupported-schema-version'],
 ['uninitialized skeleton',{},'uninitialized-record'],
 ['invalid typed shape',{...source(10),unexpected:CANARY},'invalid-typed-record'],
 ['different payload identity',source(11),'payload-identity-mismatch']
]) test(name+' remains an incomplete, redacted extraction',()=>{
 const r={workspaceId:W,recordId:id(10),revision:'1',payload}, a=extractLifecycleDependencies(r);
 assert.equal(a.extractionCompleteness,'incomplete'); assert.ok(codes(a).includes(code)); assert.equal(a.edges.length,0);
 assert.ok(!JSON.stringify(a).includes(CANARY));
 const out=inspect([r],[10]); assert.equal(out.completeness,'incomplete'); assert.ok(codes(out).includes('root-not-established'));
});
test('an unrelated unknown row still prevents workspace coverage being called complete',()=>{
 const r={workspaceId:W,recordId:id(99),revision:'1',payload:{recordType:CANARY}};
 const out=inspect([row(source(10)),r],[10]); assert.equal(out.completeness,'incomplete'); assert.ok(codes(out).includes('unsupported-record-type'));
});
test('a requested but absent root never becomes established by its UUID alone',()=>{
 const r=inspect([row(source(10))],[999]); assert.ok(codes(r).includes('root-not-established')); assert.deepEqual(r.affectedRecords,[]);
});
for (const [key,n,rows,roots,code] of [
 ['maxRevisions',1,[row(source(10)),row(source(11,[10]))],[10],'revision-cap-exceeded'],
 ['maxEdges',1,[row(source(10)),row(source(11)),row(source(12,[10,11]))],[10],'edge-cap-exceeded'],
 ['maxRecords',1,[row(source(10)),row(source(11,[10]))],[10],'record-cap-exceeded'],
 ['maxDepth',1,[row(source(10)),row(source(11,[10])),row(source(12,[11]))],[10],'depth-cap-exceeded']
]) test(key+' bound reports incomplete without a partial actionable closure',()=>{
 const r=inspect(rows,roots,cap(key,n)); assert.ok(codes(r).includes(code)); assert.equal(r.completeness,'incomplete'); assert.deepEqual(r.affectedRecords,[]); assert.deepEqual(r.edges,[]);
});
test('exactly-at-bound traversal remains complete',()=>{
 const r=inspect([row(source(10)),row(source(11,[10]))],[10],{maxRevisions:2,maxEdges:1,maxRecords:2,maxDepth:1});
 assert.equal(r.completeness,'complete'); assert.equal(r.affectedRecords.length,2);
});
test('all result graphs and receipts are owned immutable snapshots',()=>{
 const rows=graph(), m=manifest(rows), s=snapshot(m,rows), r=inspectLifecycleDependencyClosure(m,s,request([10])), before=JSON.stringify(r);
 s.revisions[0].payload.title='later'; m.heads[0].revision='9'; rows[1].payload.derivedFrom=[];
 assert.equal(JSON.stringify(r),before); assert.equal(Object.isFrozen(s),false);
 assert.throws(()=>r.edges.push({}),TypeError); assert.throws(()=>r.revisions[0].edges.push({}),TypeError);
 const a=extractLifecycleDependencies(row(source(10))); assert.ok(Object.isFrozen(a)); assert.ok(Object.isFrozen(a.unresolved));
});
test('reports never return copied quotes, geometry, URLs, filename, payload, or unknown secret fields',()=>{
 const rows=graph(); rows.find(r=>r.recordId===id(20)).payload.selector={type:'text',profile:'plain-text-codepoints-v1',textSha256:H,position:null,quote:{exact:CANARY,prefix:'PRIVATE-PREFIX',suffix:'PRIVATE-SUFFIX'}};
 const r=inspect(rows,[10]), serialized=JSON.stringify(r);
 for (const value of [CANARY,'PRIVATE-PREFIX','PRIVATE-SUFFIX','123.456789','45.123456','https://private.invalid','"payload":','"quote":','"coordinates":','"keyMaterial":']) assert.ok(!serialized.includes(value),value);
});

test('accessors at row, payload, nested reference, manifest, and request never run',()=>{
 let calls=0; const getter=()=>{calls++; throw new Error(CANARY);};
 for (const make of [
  ()=>{const r=row(source(10)); Object.defineProperty(r,'payload',{get:getter,enumerable:true}); return r;},
  ()=>{const r=row(source(10)); Object.defineProperty(r.payload,'title',{get:getter,enumerable:true}); return r;},
  ()=>{const r=row(locator()); Object.defineProperty(r.payload.source,'id',{get:getter,enumerable:true}); return r;}
 ]) denied(()=>extractLifecycleDependencies(make()));
 const rows=[row(source(10))], m=manifest(rows), s=snapshot(m,rows), req=request([10]);
 Object.defineProperty(m,'heads',{get:getter,enumerable:true}); denied(()=>inspectLifecycleDependencyClosure(m,s,req));
 const good=manifest(rows); Object.defineProperty(req,'limits',{get:getter,enumerable:true}); denied(()=>inspectLifecycleDependencyClosure(good,s,req));
 assert.equal(calls,0);
});
test('proxies and revoked proxies are rejected before any traps execute',()=>{
 let calls=0; const proxy=new Proxy(row(source(10)),{get(){calls++;throw new Error(CANARY);},getPrototypeOf(){calls++;throw new Error(CANARY);},ownKeys(){calls++;throw new Error(CANARY);}});
 denied(()=>extractLifecycleDependencies(proxy));
 const revoked=Proxy.revocable(row(source(10)),{}); revoked.revoke(); denied(()=>extractLifecycleDependencies(revoked.proxy));
 const nested=row(source(10)); nested.payload.derivedFrom=new Proxy([],{ownKeys(){calls++;throw new Error(CANARY);}}); denied(()=>extractLifecycleDependencies(nested));
 assert.equal(calls,0);
});
test('non-plain objects, prototypes, symbols, hidden properties, sparse arrays and custom iterators are rejected',()=>{
 const makers=[
  ()=>Object.assign(Object.create(null),row(source(10))),
  ()=>Object.assign(Object.create({payload:source(10)}),row(source(10))),
  ()=>{const r=row(source(10)); r[Symbol('private')]=CANARY; return r;},
  ()=>{const r=row(source(10)); Object.defineProperty(r.payload,'hidden',{value:CANARY}); return r;},
  ()=>{const r=row(source(10)); r.payload.derivedFrom=new Array(1); return r;},
  ()=>{const r=row(source(10)); r.payload.derivedFrom[Symbol.iterator]=()=>{throw new Error(CANARY);}; return r;},
  ()=>{const r=row(source(10)); r.payload.secret=new Date(); return r;},
  ()=>{const r=row(source(10)); r.payload.secret=Promise.resolve(true); return r;},
  ()=>{const r=row(source(10)); Object.defineProperty(r.payload,'__proto__',{value:{secret:CANARY},enumerable:true}); return r;}
 ];
 for (const make of makers) denied(()=>extractLifecycleDependencies(make()));
});
test('cycles, malformed Unicode, nonfinite values and oversized payloads fail with a fixed error',()=>{
 const cyclic=row(source(10)); cyclic.payload.loop=cyclic;
 for (const value of [cyclic,row({...source(10),title:'\ud800'}),row({...source(10),secret:Infinity}),row({...source(10),secret:'x'.repeat(131073)})]) denied(()=>extractLifecycleDependencies(value));
});
test('input contracts reject missing or unexpected keys, invalid revisions, duplicate manifests and raised caps',()=>{
 const rows=[row(source(10))], m=manifest(rows), s=snapshot(m,rows);
 denied(()=>inspectLifecycleDependencyClosure(m,s,{rootRecordIds:[id(10)]}));
 denied(()=>inspectLifecycleDependencyClosure({...m,authority:true},s,request([10])));
 denied(()=>inspectLifecycleDependencyClosure(m,s,request([10],cap('maxEdges',8193))));
 denied(()=>inspectLifecycleDependencyClosure(m,s,request([10],cap('maxDepth',1.5))));
 denied(()=>lifecycleManifestDigest({...m,heads:[m.heads[0],m.heads[0]]}));
 denied(()=>lifecycleManifestDigest({...m,revisions:[m.revisions[0],m.revisions[0]]}));
 for (const rev of ['0','01','9223372036854775808',1]) denied(()=>extractLifecycleDependencies(row(source(10),rev)));
 denied(()=>extractLifecycleDependencies({...row(source(10)),unexpected:true}));
});
