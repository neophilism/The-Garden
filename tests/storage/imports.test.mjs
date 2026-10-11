import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createArchiveStore} from '../../services/workers/src/storage.mjs';
import {createByteInspector,createImportInventory} from '../../services/workers/src/imports.mjs';

const sourceId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',sourceVersion='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const runId='cccccccc-cccc-4ccc-cccc-cccccccccccc',inventoryVersion='dddddddd-dddd-4ddd-dddd-dddddddddddd',workspaceId='eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
const binding={project:'royal-union-78374030',branch:'br-purple-grass-b5hurfl7',access:'private'};
const original=Buffer.from('synthetic source: imported text is not evidence adjudication');
const clean=async(bytes,{sha256})=>({verdict:'clean',sourceHash:sha256,engine:'synthetic-test-only',version:'1'});
async function fixture(options={}){
 const data=new Map(),audit=[];let allowed=true,actor='researcher';const hooks={};
 const backend={async putIfAbsent(ref,bytes){await hooks.write?.(ref);if(!data.has(ref.key))data.set(ref.key,Buffer.from(bytes));},async get(ref){await hooks.read?.(ref);return data.get(ref.key);}};
 const archive=createArchiveStore({binding,backend,authorize:async()=>allowed,reviewSource:async()=>null});
 const sourceRef=await archive.quarantine(actor,sourceId,options.bytes??original,sourceVersion);
 const decisions={async decide(headers,scope,evaluate){const admitted=await evaluate({subjectId:actor,workspaceId:scope,requestId:inventoryVersion});audit.push({allowed:admitted});return {allowed:admitted,operationPerformed:false,requestId:inventoryVersion};}};
 const configuration={archive,decisions,authorize:async()=>allowed,scan:clean,enabled:()=>true,...options};
 const pipeline=createImportInventory(configuration);
 const input={runId,inventoryVersion,sourceRef,declaredType:options.declaredType??'text/plain'};
 return {pipeline,configuration,input,data,audit,hooks,archive,deny:()=>{allowed=false;},actor:value=>{actor=value;},run:()=>pipeline.inventory({},workspaceId,input)};
}
test('real subprocess inventory preserves root, lineage and private quarantine',async()=>{
 const f=await fixture(),result=await f.run();
 assert.equal(result.manifest.importRun.status,'inventoried');
 assert.equal(result.manifest.quarantineDecision.released,false);
 assert.equal(result.manifest.quarantineDecision.rights,'unreviewed');
 assert.equal(result.manifest.quarantineDecision.historicalReview,'unreviewed');
 assert.deepEqual(result.manifest.lineage.original,f.input.sourceRef);
 assert.deepEqual(f.data.get(f.input.sourceRef.key),original);
 assert.deepEqual(JSON.parse(f.data.get(result.manifestRef.key)),result.manifest);
 assert.equal(result.publicationApproved,false);assert.equal(result.publiclyAccessible,false);
 assert.equal(f.audit.length,5);
});
test('idempotent retry has identical immutable manifest and keeps originals',async()=>{
 const f=await fixture();assert.deepEqual(await f.run(),await f.run());assert.equal(f.data.size,2);
});
test('changed inspection under same attempt ID cannot overwrite successful bytes',async()=>{
 const f=await fixture(),first=await f.run();
 const other=createImportInventory({...f.configuration,scan:async(b,{sha256})=>({verdict:'infected',sourceHash:sha256,engine:'synthetic-test-only',version:'2'})});
 await assert.rejects(()=>other.inventory({},workspaceId,f.input));
 assert.deepEqual(JSON.parse(f.data.get(first.manifestRef.key)),first.manifest);
});
test('malware scan is mandatory for technical inventoried status',async()=>{
 const f=await fixture({scan:undefined}),result=await f.run();
 assert.equal(result.manifest.importRun.status,'needs-review');
 assert.equal(result.manifest.quarantineDecision.malware.verdict,'unavailable');
 assert.ok(result.manifest.quarantineDecision.findings.includes('malware-check-unavailable'));
});
test('infected source is rejected without running parser',async()=>{
 const f=await fixture({scan:async(b,{sha256})=>({verdict:'infected',sourceHash:sha256,engine:'synthetic-test-only',version:'1'}),inspect:async()=>assert.fail('must not parse')});
 const result=await f.run();assert.equal(result.manifest.importRun.status,'rejected');assert.equal(result.manifest.importedArtifacts[0].sha256,f.input.sourceRef.sha256);assert.equal(f.data.size,2);
});
test('scanner cannot pass stale bytes or client cleanliness flags',async()=>{
 for(const scan of [async()=>({verdict:'clean',sourceHash:'0'.repeat(64),engine:'fixture',version:'1'}),async()=>true,async()=>{throw new Error('credential-do-not-log');}]){
  const f=await fixture({scan}),result=await f.run();assert.equal(result.manifest.quarantineDecision.malware.verdict,'unavailable');assert.ok(!JSON.stringify(result).includes('credential-do-not-log'));
 }
});
test('mislabeled MIME is recorded from bytes and cannot certify an unparsed PDF',async()=>{
 const f=await fixture({bytes:Buffer.from('%PDF-unparsed-content')}),result=await f.run();
 assert.equal(result.manifest.importRun.detectedType,'application/pdf');assert.equal(result.manifest.importRun.status,'needs-review');
 assert.ok(result.manifest.quarantineDecision.findings.includes('declared-type-mismatch'));
});
test('malformed archive remains a checksummed rejected original',async()=>{
 const f=await fixture({bytes:Buffer.from('PK\x03\x04truncated'),declaredType:'application/zip'}),result=await f.run();
 assert.equal(result.manifest.importRun.status,'rejected');assert.equal(result.manifest.importRun.inventoryComplete,false);
});
test('unavailable parser creates an explicit incomplete quarantine inventory',async()=>{
 const f=await fixture({inspect:async()=>{throw new Error('parser-internal-secret');}}),result=await f.run();
 assert.equal(result.manifest.importRun.inventoryComplete,false);assert.equal(result.manifest.importRun.status,'needs-review');assert.ok(!JSON.stringify(result).includes('parser-internal-secret'));
});
test('missing or forged inspector checksum cannot yield a completed inventory',async()=>{
 const f=await fixture({inspect:async()=>({sha256:'0'.repeat(64),inventoryComplete:true})}),result=await f.run();
 assert.equal(result.manifest.importRun.inventoryComplete,false);
});
test('denied access is audited before any archive read',async()=>{
 const f=await fixture();f.deny();f.hooks.read=()=>assert.fail('must not read');
 await assert.rejects(f.run,/Garden import operation rejected/);assert.deepEqual(f.audit,[{allowed:false}]);assert.equal(f.data.size,1);
});
test('disabled capability remains denied even with a valid grant',async()=>{
 const f=await fixture({enabled:()=>false});await assert.rejects(f.run);assert.deepEqual(f.audit,[{allowed:false}]);
});
test('audit write failure prevents import execution',async()=>{
 const f=await fixture({decisions:{async decide(){throw new Error('audit unavailable');}}});f.hooks.read=()=>assert.fail('must not read');await assert.rejects(f.run);assert.equal(f.data.size,1);
});
test('interrupted original upload is never parsed',async()=>{
 const f=await fixture({inspect:async()=>assert.fail('must not parse')});f.data.set(f.input.sourceRef.key,original.subarray(0,5));
 await assert.rejects(f.run);assert.equal(f.data.size,1);
});
test('revocation during byte read prevents processing',async()=>{
 const f=await fixture({inspect:async()=>assert.fail('must not parse')});f.hooks.read=()=>f.deny();await assert.rejects(f.run);assert.equal(f.data.size,1);
});
test('revocation during scanner is audited and prevents parser',async()=>{
 let f;f=await fixture({scan:async(...args)=>{f.deny();return clean(...args);},inspect:async()=>assert.fail('must not parse')});
 await assert.rejects(f.run);assert.equal(f.audit.at(-1).allowed,false);assert.equal(f.data.size,1);
});
test('revocation during parsing prevents manifest write',async()=>{
 let f;const real=createByteInspector();f=await fixture({inspect:async(...args)=>{const report=await real(...args);f.deny();return report;}});
 await assert.rejects(f.run);assert.equal(f.audit.at(-1).allowed,false);assert.equal(f.data.size,1);
});
test('revocation during manifest persistence prevents response without erasing bytes',async()=>{
 const f=await fixture();f.hooks.write=ref=>{if(ref.sourceId===runId)f.deny();};await assert.rejects(f.run);assert.equal(f.data.size,2);
});
test('session subject changes cannot borrow prior authorization',async()=>{
 let f;f=await fixture({scan:async(...args)=>{f.actor('different-subject');return clean(...args);}});await assert.rejects(f.run);assert.equal(f.audit.at(-1).allowed,false);
});
test('client cannot claim release, adjust namespace, or inject callback URLs',async()=>{
 for(const change of [input=>{input.released=true;},input=>{input.sourceRef={...input.sourceRef,branch:'br-curly-band-b5aatp1e'};},input=>{input.runId=sourceId;},input=>{input.declaredType='https://callback.invalid';}]){
  const f=await fixture();change(f.input);await assert.rejects(f.run);assert.equal(f.data.size,1);
 }
});
test('cancelled inventory produces no manifest',async()=>{
 const f=await fixture(),controller=new AbortController();controller.abort();await assert.rejects(()=>f.pipeline.inventory({},workspaceId,f.input,{signal:controller.signal}));assert.equal(f.data.size,1);
});

function childFixture(output,{hang=false}={}){
 let options,args,command,killed=false;
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.kill=()=>{killed=true;};
 const spawnProcess=(cmd,a,o)=>{command=cmd;args=a;options=o;child.stdin.on('finish',()=>{if(!hang){child.stdout.write(output);child.emit('close',0);}});return child;};
 return {spawnProcess,observed:()=>({options,args,command,killed})};
}
test('subprocess has no shell or inherited credentials and fixed script only',async()=>{
 const f=childFixture('{}');await createByteInspector({spawnProcess:f.spawnProcess})(original);
 const {options,args,command}=f.observed();assert.equal(command,'/usr/bin/python3');assert.equal(options.shell,false);assert.deepEqual(options.env,{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'});assert.equal(args[0],'-I');assert.ok(args[1].endsWith('/import/inspect.py'));assert.equal(args.length,2);assert.equal(options.stdio[2],'ignore');
});
test('hung inspector is killed and reports timeout with original checksum',async()=>{
 const f=childFixture('',{hang:true}),report=await createByteInspector({timeoutMs:10,spawnProcess:f.spawnProcess})(original);
 assert.ok(f.observed().killed);assert.deepEqual(report.findings,['inspector-timeout']);assert.equal(report.size,original.length);
});
test('oversized or invalid subprocess output fails closed without leaking it',async()=>{
 for(const output of ['private-exception',Buffer.alloc(1024*1024+1,'x')]){
  const f=childFixture(output),report=await createByteInspector({spawnProcess:f.spawnProcess})(original);assert.deepEqual(report.findings,['inspector-unavailable']);assert.ok(!JSON.stringify(report).includes('private-exception'));assert.ok(f.observed().killed);
 }
});
test('inspector rejects oversized and empty inputs before spawning',async()=>{
 const inspect=createByteInspector({spawnProcess:()=>assert.fail('must not spawn')});await assert.rejects(()=>inspect(Buffer.alloc(0)));await assert.rejects(()=>inspect(Buffer.alloc(8*1024*1024+1)));
});
