import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPrivateBibliographicRepository} from '../../services/workers/src/bibliographic-repository.mjs';
import {DatabaseSync} from 'node:sqlite';
import {createBibliographicIntake,createDoiLeadResolver} from '../../services/workers/src/bibliographic-intake.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const workspace=id(1),otherWorkspace=id(2),subjectA='alice',subjectB='bob';
const attribution={provider:'catalog',repositoryId:null,locator:'Library shelf 1',license:'unknown',access:'unknown',retrievedAt:null};
const raw='TY  - BOOK\nTI  - A source title\nPY  - 1822\nER  - ';
const submissionId=id(100),secondSubmission=id(200);
function fixture({enabled=true}={}){
 const root=mkdtempSync(join(tmpdir(),'garden-bib-'));chmodSync(root,0o700);
 const repo=createPrivateBibliographicRepository({root});let authorized=true,actor=subjectA,currentWorkspace=workspace;
 let sequence=0;const events=[];let hook=()=>{};
 const decisions={async decide(headers,w,evaluate){
  hook();const facts={subjectId:actor,workspaceId:currentWorkspace};const allowed=await evaluate(facts);
  events.push({allowed,w,actor,workspace:currentWorkspace});
  return {allowed,requestId:id(++sequence)};
 }};
 const configuration={decisions,authorize:async()=>authorized,repository:repo,enabled:()=>enabled};
 const service=createBibliographicIntake(configuration);
 return {repo,root,service,events,configuration,
  actor:x=>{actor=x;},workspace:x=>{currentWorkspace=x;},deny:()=>{authorized=false;},
  hook:x=>{hook=x;},restore:()=>{authorized=true;},
  close:()=>{repo.close();rmSync(root,{recursive:true,force:true});},
  submit:()=>service.submit({},workspace,{submissionId,format:'ris',raw,attribution}),
  list:()=>service.list({},workspace,{afterId:null,limit:25})};
}
async function withFixture(fn,options={}){const f=fixture(options);try{await fn(f);}finally{f.close();}}

test('durably save a citation lead, not a verified or published assertion',()=>withFixture(async f=>{
 const r=await f.submit();assert.equal(r.candidates.length,1);
 assert.equal(r.stored,'private-discovery-only');assert.equal(r.publicationApproved,false);
 assert.equal(r.candidates[0].review,'discovery-only');assert.equal(r.candidates[0].rights,'unreviewed');
 assert.equal(r.candidates[0].original,raw);assert.equal(r.candidates[0].normalized.title,'A source title');
 assert.equal((await f.list()).candidates.length,1);
 const saved=await f.service.detail({},workspace,{candidateId:r.candidates[0].id});assert.deepEqual(saved,r.candidates[0]);
 assert.equal(lstatSync(join(f.root,'bibliographic-intake.sqlite3')).mode&0o077,0);
}));
test('same idempotency key and same bytes yields stable candidate ID',()=>withFixture(async f=>{
 const a=await f.submit(),b=await f.submit();assert.equal(a.candidates[0].id,b.candidates[0].id);
 assert.equal((await f.list()).candidates.length,1);
}));
test('reused submission key with changed source is rejected',()=>withFixture(async f=>{
 await f.submit();await assert.rejects(()=>f.service.submit({},workspace,{submissionId,format:'ris',raw:raw.replace('1822','1882'),attribution}));
 assert.equal((await f.list()).candidates.length,1);
}));
test('different submitter cannot read another contributor candidate',()=>withFixture(async f=>{
 const first=(await f.submit()).candidates[0];f.actor(subjectB);
 assert.equal((await f.list()).candidates.length,0);
 await assert.rejects(()=>f.service.detail({},workspace,{candidateId:first.id}));
}));
test('cross-workspace scope cannot be forged by caller',()=>withFixture(async f=>{
 const first=(await f.submit()).candidates[0];f.workspace(otherWorkspace);
 await assert.rejects(()=>f.service.detail({},workspace,{candidateId:first.id}));
 await assert.rejects(()=>f.service.list({},workspace,{afterId:null,limit:25}));
}));
test('disabled intake rejects before any persisted candidate or public publication',()=>withFixture(async f=>{
 await assert.rejects(()=>f.submit());assert.equal(f.events.at(-1).allowed,false);
 assert.equal(f.repo.list({workspaceId:workspace,subjectId:'alice',requestId:id(90)}).candidates.length,0);
},{enabled:false}));
test('audit-service error prevents any store mutation',()=>withFixture(async f=>{
 const unavailable=createBibliographicIntake({...f.configuration,decisions:{async decide(){throw Error('audit-secret');}}});
 await assert.rejects(()=>unavailable.submit({},workspace,{submissionId,format:'ris',raw,attribution}),/Garden bibliographic intake rejected/);
 assert.equal((await f.list()).candidates.length,0);
}));
test('authorizer revocation causes safe failure',()=>withFixture(async f=>{
 f.deny();await assert.rejects(()=>f.submit());assert.equal((await f.list().catch(()=>({candidates:[]}))).candidates.length,0);
}));
test('identity change between audited checks prevents persistence',()=>withFixture(async f=>{
 let n=0;f.hook(()=>{n++;if(n===2)f.actor(subjectB);});
 await assert.rejects(()=>f.submit());f.actor(subjectA);assert.equal((await f.list()).candidates.length,0);
}));
test('append-only duplicate decision can be reversed with later event',()=>withFixture(async f=>{
 const a=(await f.submit()).candidates[0].id;
 const b=(await f.service.submit({},workspace,{submissionId:secondSubmission,format:'ris',raw,attribution})).candidates[0].id;
 const first={eventId:id(900),firstId:a,secondId:b,decision:'duplicate',reason:'Metadata strings match, require source review',supersedes:null};
 const e1=await f.service.decide({},workspace,first);assert.equal(e1.decision,'duplicate');
 assert.equal((await f.service.decide({},workspace,first)).event_id,id(900));
 const second={...first,eventId:id(901),decision:'distinct',reason:'These are two different physical editions',supersedes:id(900)};
 const e2=await f.service.decide({},workspace,second);assert.equal(e2.previous_event_id,id(900));
 const history=await f.service.history({},workspace,{firstId:a,secondId:b});assert.deepEqual(history.map(x=>x.decision),['duplicate','distinct']);
 assert.equal(history[0].reason,first.reason);
}));
test('duplicate decision without superseding previous decision fails closed',()=>withFixture(async f=>{
 const a=(await f.submit()).candidates[0].id;
 const b=(await f.service.submit({},workspace,{submissionId:secondSubmission,format:'ris',raw,attribution})).candidates[0].id;
 await f.service.decide({},workspace,{eventId:id(920),firstId:a,secondId:b,decision:'unresolved',reason:'Requires reading',supersedes:null});
 await assert.rejects(()=>f.service.decide({},workspace,{eventId:id(921),firstId:a,secondId:b,decision:'duplicate',reason:'Cannot rewrite',supersedes:null}));
}));
test('one submitter cannot decide other contributor candidate duplicates',()=>withFixture(async f=>{
 const a=(await f.submit()).candidates[0].id;f.actor(subjectB);
 const b=(await f.service.submit({},workspace,{submissionId:secondSubmission,format:'ris',raw,attribution})).candidates[0].id;
 await assert.rejects(()=>f.service.decide({},workspace,{eventId:id(930),firstId:a,secondId:b,decision:'duplicate',reason:'No access to Alice record',supersedes:null}));
}));
test('malformed format cannot be stored even with valid authorization',()=>withFixture(async f=>{
 await assert.rejects(()=>f.service.submit({},workspace,{submissionId,format:'bibtex',raw:'@article{a,title={Unclosed}',attribution}));
 assert.equal((await f.list()).candidates.length,0);
}));
test('provider robot/rights refusal never creates candidate',()=>withFixture(async f=>{
 const svc=createBibliographicIntake({...f.configuration,resolveDoi:async()=>({status:'robots-disallowed',lead:null})});
 const x=await svc.lookupDoi({},workspace,{submissionId,provider:'catalog',doi:'10.1234/abc'});
 assert.deepEqual(x,{status:'robots-disallowed',candidateCreated:false});assert.equal((await f.list()).candidates.length,0);
}));
test('trusted provider DOI lookup stores original licensed metadata as a lead',()=>withFixture(async f=>{
 const resolver=createDoiLeadResolver({providers:{catalog:async doi=>({status:'ok',metadata:{type:'article-journal',title:'A citation',DOI:doi},attribution:{locator:'provider catalog',license:'CC BY 4.0',access:'open'}})}});
 const svc=createBibliographicIntake({...f.configuration,resolveDoi:resolver});
 const r=await svc.lookupDoi({},workspace,{submissionId,provider:'catalog',doi:'10.1234/abc'});
 assert.equal(r.status,'discovery-only');assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].sourceAttribution.license,'CC BY 4.0');assert.equal(r.candidates[0].publicationApproved,false);
}));
test('restart preserves candidates and append-only decisions',async()=>{
 const f=fixture();let id1;try{const r=await f.submit();id1=r.candidates[0].id;f.repo.close();
  const restarted=createPrivateBibliographicRepository({root:f.root});try{const row=restarted.detail({workspaceId:workspace,subjectId:subjectA,requestId:id(99)},id1);assert.equal(row.original,raw);}finally{restarted.close();}
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('private repository refuses unsafe root permissions',()=>{
 const root=mkdtempSync(join(tmpdir(),'garden-public-bib-'));
 try{chmodSync(root,0o755);assert.throws(()=>createPrivateBibliographicRepository({root}));}
 finally{rmSync(root,{recursive:true,force:true});}
});
test('citation service refuses missing audit and enablement dependencies',()=>withFixture(async f=>{
 assert.throws(()=>createBibliographicIntake({...f.configuration,authorize:null}));
 assert.throws(()=>createBibliographicIntake({...f.configuration,decisions:null}));
}));

test('version drift is rejected before reading existing candidate data',async()=>{
 const root=mkdtempSync(join(tmpdir(),'garden-bib-schema-'));chmodSync(root,0o700);
 try{
  const first=createPrivateBibliographicRepository({root});first.close();
  const db=new DatabaseSync(join(root,'bibliographic-intake.sqlite3'));
  db.exec('PRAGMA user_version=2');db.close();
  assert.throws(()=>createPrivateBibliographicRepository({root}));
 }finally{rmSync(root,{recursive:true,force:true});}
});
