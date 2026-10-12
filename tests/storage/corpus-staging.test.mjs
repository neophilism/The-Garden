import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createCorpusStaging,createOfflineStagingWorker} from '../../services/workers/src/corpus-staging.mjs';

async function fixture(t,options={}){
 const root=await mkdtemp(join(tmpdir(),'garden-staging-test-'));await chmod(root,0o700);
 t.after(()=>rm(root,{recursive:true,force:true}));
 const config=JSON.parse(execFileSync('/usr/bin/python3',['tests/import/staging_fixture.py',root],{maxBuffer:1024*1024}).toString());
 const audit=[],hooks={};let allowed=true,actor=config.subject_id,reads=0;
 const resolved={workspaceId:config.workspace_id,sourceRef:config.source_ref,sourcePath:config.source_path,
  stagingDirectory:config.staging_directory,format:'sqlite',classification:'restricted_research',
  quarantine:{disposition:'quarantined',released:false,malware:'unavailable'}};
 const defaults={
  decisions:{async decide(headers,workspace,evaluate){const admitted=await evaluate({workspaceId:workspace,subjectId:actor});audit.push(admitted);await hooks.audit?.();return {allowed:admitted,requestId:randomUUID()};}},
  authorize:async(facts,request)=>{await hooks.gate?.(request);return allowed;},
  resolveSource:async(principal,ref)=>{reads++;await hooks.resolve?.();return resolved;},
  enabled:()=>true,
  extract:createOfflineStagingWorker({loadContracts:async()=>({mapping:config.mapping,inventory:config.inventory})}),
 };
 const pipeline=createCorpusStaging({...defaults,...options});
 const input={runId:config.run_id,sourceRef:config.source_ref};
 return {root,config,input,resolved,audit,hooks,defaults,deny:()=>{allowed=false;},actor:v=>{actor=v;},reads:()=>reads,
  run:opts=>pipeline.stage({},config.workspace_id,input,opts)};
}

test('actual offline subprocess integrates audited decisions, private lineage and idempotent staging',async t=>{
 const f=await fixture(t);const original=await readFile(f.config.source_path);
 const result=await f.run();const replay=await f.run();
 assert.equal(result.status,'complete-quarantined');assert.equal(result.rows,600);assert.equal(result.tables,2);
 assert.equal(replay.rows,600);assert.equal(result.publicationApproved,false);assert.equal(result.publiclyAccessible,false);
 assert.equal(result.rights,'unreviewed');assert.equal(result.historicalReview,'unreviewed');
 assert.deepEqual(await readFile(f.config.source_path),original);
 assert.ok(f.audit.length>20&&f.audit.every(x=>x));
});
test('default disabled, source denial and audit outage never read offline source',async t=>{
 for(const option of [{enabled:()=>false},{authorize:async()=>false},{decisions:{async decide(){throw new Error('audit-secret');}}}]){
  const f=await fixture(t,option);await assert.rejects(()=>f.run(),{message:'Garden corpus staging rejected'});assert.equal(f.reads(),0);
 }
 const f=await fixture(t);const {enabled,...disabled}=f.defaults;
 await assert.rejects(()=>createCorpusStaging(disabled).stage({},f.config.workspace_id,f.input));assert.equal(f.reads(),0);
});
test('caller cannot inject filenames, contracts, release status or unrelated namespace',async t=>{
 for(const key of ['sourcePath','mapping','publicationApproved','subjectId']){
  const f=await fixture(t);f.input[key]='injected';await assert.rejects(()=>f.run());assert.equal(f.reads(),0);
 }
 const f=await fixture(t);f.input.sourceRef={...f.input.sourceRef,project:'wrong-project'};await assert.rejects(()=>f.run());assert.equal(f.reads(),0);
});
test('wrong-workspace, wrong-source, sealed and infected descriptors denied before parser',async t=>{
 for(const change of [r=>{r.workspaceId='wrong';},r=>{r.sourceRef={...r.sourceRef,sha256:'0'.repeat(64)};},
  r=>{r.classification='sealed_ciphertext';},r=>{r.quarantine.malware='infected';},r=>{r.quarantine.released=true;}]){
  const f=await fixture(t,{extract:async()=>assert.fail('must not parse')});change(f.resolved);await assert.rejects(()=>f.run());
 }
});
test('revoked resolution and changed session subject fail closed',async t=>{
 const f=await fixture(t,{extract:async()=>assert.fail('must not parse')});f.hooks.resolve=f.deny;await assert.rejects(()=>f.run());
 const g=await fixture(t,{extract:async()=>assert.fail('must not parse')});g.hooks.resolve=()=>g.actor('different-user');await assert.rejects(()=>g.run());
});
test('mid-transaction revocation rolls back, audits denial, and later resume succeeds',async t=>{
 const f=await fixture(t);let commits=0;
 f.hooks.gate=request=>{if(request.phase==='commit-batch'&&++commits===2)f.deny();};
 await assert.rejects(()=>f.run());assert.equal(f.audit.at(-1),false);
 const query=sql=>execFileSync('/usr/bin/python3',['-c','import sqlite3,sys;print(sqlite3.connect(sys.argv[1]).execute(sys.argv[2]).fetchone()[0])',join(f.resolved.stagingDirectory,'staging.sqlite'),sql]).toString().trim();
 assert.equal(query('SELECT count(*) FROM staging_rows'),'256');
 assert.equal(query('SELECT state FROM status'),'failed-quarantined');
 const resumed=createCorpusStaging({...f.defaults,authorize:async()=>true});
 assert.equal((await resumed.stage({},f.config.workspace_id,f.input)).rows,600);
});
test('audit outage at commit denies transaction and suppresses internal error',async t=>{
 const f=await fixture(t);f.hooks.gate=request=>{if(request.phase==='commit-batch')f.hooks.audit=()=>{throw new Error('audit-secret');};};
 await assert.rejects(()=>f.run(),{message:'Garden corpus staging rejected'});
});
test('result delivery rechecks authorization',async t=>{
 const f=await fixture(t);f.hooks.gate=request=>{if(request.phase==='deliver-result')f.deny();};
 await assert.rejects(()=>f.run());assert.equal(f.audit.at(-1),false);
});
test('abort and deadline stop worker with no successful result',async t=>{
 const f=await fixture(t);const abort=new AbortController();abort.abort();await assert.rejects(()=>f.run({signal:abort.signal}));
 const worker=createOfflineStagingWorker({timeoutMs:1,loadContracts:async()=>({mapping:f.config.mapping,inventory:f.config.inventory})});
 const {mapping,inventory,...job}=f.config;await assert.rejects(()=>worker(job,{gate:async()=>{}}));
});
test('repository default contract rejects a different artifact',async t=>{
 const f=await fixture(t,{extract:createOfflineStagingWorker()});await assert.rejects(()=>f.run());
});
test('public and research applications do not mount staging or import its data',async()=>{
 for(const file of ['apps/public/app/page.tsx','apps/research/app/page.tsx']){
  const content=await readFile(file,'utf8');assert.doesNotMatch(content,/corpus-staging|staging_rows|staging\.sqlite/);
 }
});
