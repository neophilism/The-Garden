import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,chmodSync,lstatSync,symlinkSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {RESEARCH_CHARTER,programTermsDigest} from '../../packages/domain/src/community/program.mjs';
import {createPrivateContributionProgramRepository} from '../../services/workers/src/contribution-program-repository.mjs';
import {createContributionProgramService,createContributionProgramHandler} from '../../apps/research/community/program-service.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const workspace=id(1),programId=id(2),uploadId=id(3);
const version=(n=1,purposes=['research-submission','program-interest'])=>({schemaVersion:1,programId,version:n,title:'Synthetic optional contribution program',responsibleInstitution:'Synthetic test institution',charter:'Keep original materials private.\nSubmitting does not enroll or endorse.',permittedPurposes:purposes,researchCharter:RESEARCH_CHARTER,newInterviews:false});
const acknowledgment=(v=version(),n=10)=>({programId,version:v.version,termsDigest:programTermsDigest(v),acknowledgmentId:id(n),acknowledged:true});
const submission=(v=version(),n=20,ack=10)=>({programId,version:v.version,termsDigest:programTermsDigest(v),acknowledgmentId:id(ack),submissionId:id(n),uploadId});
const interest=(v=version(),n=30,ack=10)=>({programId,version:v.version,termsDigest:programTermsDigest(v),acknowledgmentId:id(ack),interestId:id(n),requestProgramUpdates:true});
async function fixture(fn){
 const root=mkdtempSync(join(tmpdir(),'garden-program-'));chmodSync(root,0o700);
 const state={actor:'operator',allow:true,enabled:true,authority:true,upload:true,stepup:true,time:Date.parse('2026-10-17T12:00:00.000Z'),phase:()=>{},verifyCount:0};
 const grants=new Map();let seq=100;const decisions=[];
 let repo=createPrivateContributionProgramRepository({root,now:()=>state.time});
 const config={repository:repo,enabled:()=>state.enabled,now:()=>state.time,
  decisions:{async decide(headers,w,evaluate){if(state.auditFailure)throw Error('sensitive provider error');const allowed=await evaluate({subjectId:state.actor,workspaceId:w});decisions.push({allowed,actor:state.actor});return {allowed,requestId:id(++seq)};}},
  authorize:async(f,scope)=>{await state.phase(scope);return state.allow&&f.workspaceId===workspace;},
  authorizeOperator:async()=>state.actor==='operator'&&state.stepup,
  verifyAuthority:async({authorizationId})=>{state.verifyCount++;return state.authority?grants.get(authorizationId):null;},
  verifyUpload:async({facts})=>state.upload?{workspaceId:workspace,subjectId:facts.subjectId,uploadId,state:'complete-quarantined',bytesVerified:true,publiclyAccessible:false,collectionKind:'existing-material',...(state.sourcePatch??{})}:null
 };
 const service=createContributionProgramService(config);
 async function install(v=version()){
  const authorizationId=id(500+v.version),termsDigest=programTermsDigest(v);
  grants.set(authorizationId,{authorizationId,workspaceId:workspace,programId,version:v.version,termsDigest,responsibleInstitution:v.responsibleInstitution,authorizedBy:'synthetic-authority',authorityEvidenceId:id(600+v.version),validFrom:new Date(state.time-60000).toISOString(),expiresAt:new Date(state.time+3600000).toISOString(),responseCapacityConfirmed:true});
  return service.installVersion({},workspace,{version:v,authorizationId});
 }
 const f={root,state,service,config,decisions,grants,install,get repo(){return repo;},ack:()=>service.acknowledge({},workspace,acknowledgment()),submit:()=>service.submit({},workspace,submission()),interest:()=>service.registerInterest({},workspace,interest()),status:()=>service.status({},workspace,{programId}),raw:()=>new DatabaseSync(join(root,'contribution-program.sqlite3')),
  reopen(){repo.close();repo=createPrivateContributionProgramRepository({root,now:()=>state.time});return repo;}};
 try{await install();state.actor='contributor';await fn(f);}finally{repo.close();rmSync(root,{recursive:true,force:true});}
}

test('optional submission is private, unreviewed and separate from interest, membership, enrollment and endorsement',()=>fixture(async f=>{
 await f.ack();const r=await f.submit();assert.equal(r.state,'pending-review');
 for(const key of ['interestRegistered','consentReviewed','rightsReviewed','officialEnrollment','policyEndorsement','researchMembershipChanged','publiclyAccessible','newInterviews'])assert.equal(r[key],false);
 const state=await f.status();assert.equal(state.submissions.length,1);assert.equal(state.interests.length,0);assert.equal(state.intakeAvailable,true);assert.equal(state.acknowledgmentId,id(10));
 assert.equal(JSON.stringify(state).includes('synthetic-authority'),false);assert.equal(JSON.stringify(state).includes('authorityEvidenceId'),false);
}));
test('interest alone does not create a source, consent, membership or notification',()=>fixture(async f=>{
 await f.ack();const r=await f.interest();assert.equal(r.state,'registered');assert.equal(r.submissionCreated,false);assert.equal(r.notificationSent,false);assert.equal(r.officialEnrollment,false);assert.equal(r.policyEndorsement,false);
 assert.equal((await f.status()).submissions.length,0);
}));
test('acknowledgment alone grants no content consent and creates no participation',()=>fixture(async f=>{
 const r=await f.ack();assert.equal(r.consentGranted,false);const s=await f.status();assert.deepEqual(s.submissions,[]);assert.deepEqual(s.interests,[]);
}));
test('submission and interest require an exact affirmative acknowledgment',()=>fixture(async f=>{
 await assert.rejects(f.submit);await assert.rejects(f.interest);
 await assert.rejects(()=>f.service.acknowledge({},workspace,{...acknowledgment(),acknowledged:false}));
 await assert.rejects(()=>f.service.acknowledge({},workspace,{...acknowledgment(),termsDigest:'f'.repeat(64)}));
 assert.equal((await f.status()).acknowledgmentId,null);
}));
test('same actions replay idempotently and repeated uploads cannot create another submission',()=>fixture(async f=>{
 assert.deepEqual(await f.ack(),await f.ack());assert.deepEqual(await f.submit(),await f.submit());assert.deepEqual(await f.interest(),await f.interest());
 await assert.rejects(()=>f.service.submit({},workspace,submission(version(),21)));
 await assert.rejects(()=>f.service.registerInterest({},workspace,interest(version(),31)));
 assert.equal((await f.status()).submissions.length,1);assert.equal((await f.status()).interests.length,1);
 const raw=f.raw();try{assert.equal(raw.prepare('SELECT count(*) AS n FROM program_events').get().n,4);}finally{raw.close();}
}));
test('terms changes create a new version, preserve old receipts and invalidate stale acknowledgments',()=>fixture(async f=>{
 await f.ack();await f.submit();f.state.actor='operator';const v={...version(2),charter:'Revised separate program terms.'};await f.install(v);f.state.actor='contributor';
 assert.equal((await f.status()).acknowledgmentId,null);assert.equal((await f.status()).submissions[0].version,1);
 await assert.rejects(()=>f.interest());await assert.rejects(()=>f.ack());
 await f.service.acknowledge({},workspace,acknowledgment(v,11));await f.service.registerInterest({},workspace,interest(v,31,11));assert.equal((await f.status()).interests[0].version,2);
}));
test('a version cannot be overwritten, skipped or installed by a contributor',()=>fixture(async f=>{
 await assert.rejects(()=>f.install(version(2)));f.state.actor='operator';f.state.stepup=false;await assert.rejects(()=>f.install(version(2)));f.state.stepup=true;
 await assert.rejects(()=>f.install({...version(),charter:'Overwritten terms'}));await assert.rejects(()=>f.install(version(3)));assert.equal((await f.status()).program.version,1);
}));
test('trusted authority must match exact scope, institution, digest, capacity and validity',()=>fixture(async f=>{
 f.state.actor='operator';const v=version(2);await f.install(v);const auth=f.grants.get(id(502));f.state.actor='contributor';
 for(const patch of [{workspaceId:id(99)},{programId:id(99)},{version:1},{termsDigest:'a'.repeat(64)},{responsibleInstitution:'Wrong institution'},{responseCapacityConfirmed:false},{expiresAt:new Date(f.state.time).toISOString()},{validFrom:new Date(f.state.time+1).toISOString()},{authorizationId:id(99)}]){
  f.grants.set(id(502),{...auth,...patch});await assert.rejects(()=>f.service.acknowledge({},workspace,acknowledgment(v,11)));
 }
 f.grants.set(id(502),auth);assert.equal((await f.status()).acknowledgmentId,null);
}));
test('a charter allowing only research submissions cannot register program interest',()=>fixture(async f=>{
 f.state.actor='operator';const v=version(2,['research-submission']);await f.install(v);f.state.actor='contributor';await f.service.acknowledge({},workspace,acknowledgment(v,11));
 await assert.rejects(()=>f.service.registerInterest({},workspace,interest(v,31,11)));await f.service.submit({},workspace,submission(v,21,11));
}));
test('a charter allowing only interest cannot accept research sources',()=>fixture(async f=>{
 f.state.actor='operator';const v=version(2,['program-interest']);await f.install(v);f.state.actor='contributor';await f.service.acknowledge({},workspace,acknowledgment(v,11));
 await assert.rejects(()=>f.service.submit({},workspace,submission(v,21,11)));await f.service.registerInterest({},workspace,interest(v,31,11));
}));
test('another subject sees no receipts and cannot borrow acknowledgment or withdraw interest',()=>fixture(async f=>{
 await f.ack();await f.submit();await f.interest();f.state.actor='other';const s=await f.status();assert.equal(s.acknowledgmentId,null);assert.deepEqual(s.submissions,[]);assert.deepEqual(s.interests,[]);
 await assert.rejects(f.submit);await assert.rejects(f.interest);await assert.rejects(()=>f.service.withdrawInterest({},workspace,{programId,interestId:id(30),withdrawalId:id(40)}));
 await assert.rejects(f.ack);
}));
test('other workspaces cannot expose program existence or receipts',()=>fixture(async f=>{
 await f.ack();await f.submit();await assert.rejects(()=>f.service.status({},id(99),{programId}));
 assert.throws(()=>f.repo.status({subjectId:'contributor',workspaceId:id(99),requestId:id(50)},programId));
}));
test('withdrawal persists after intake closes and authority expires; it does not erase a source',()=>fixture(async f=>{
 await f.ack();await f.submit();await f.interest();f.state.enabled=false;f.state.authority=false;f.state.time+=7200000;
 const input={programId,interestId:id(30),withdrawalId:id(40)};
 assert.equal((await f.service.withdrawInterest({},workspace,input)).state,'withdrawn');assert.equal((await f.service.withdrawInterest({},workspace,input)).state,'withdrawn');
 const s=await f.status();assert.equal(s.intakeAvailable,false);assert.equal(s.interests[0].state,'withdrawn');assert.equal(s.submissions.length,1);
 await assert.rejects(f.interest);await assert.rejects(f.submit);
 const repo=f.reopen();const restored=repo.status({subjectId:'contributor',workspaceId:workspace,requestId:id(50)},programId);assert.equal(restored.interests[0].state,'withdrawn');
}));
test('replaying a withdrawn registration does not reactivate it; new opt-in requires a new ID',()=>fixture(async f=>{
 await f.ack();await f.interest();await f.service.withdrawInterest({},workspace,{programId,interestId:id(30),withdrawalId:id(40)});
 assert.equal((await f.interest()).state,'withdrawn');assert.equal((await f.service.registerInterest({},workspace,interest(version(),31))).state,'registered');
}));
test('disabled intake prevents every new write while receipts stay available',()=>fixture(async f=>{
 f.state.enabled=false;await assert.rejects(f.ack);await assert.rejects(f.submit);await assert.rejects(f.interest);assert.equal((await f.status()).acknowledgmentId,null);
}));
test('missing or revoked authority fails collection closed',()=>fixture(async f=>{
 await f.ack();f.state.authority=false;await assert.rejects(f.submit);await assert.rejects(f.interest);assert.equal((await f.status()).intakeAvailable,false);
}));
test('authority revoked during final asynchronous authorization cannot authorize a write',()=>fixture(async f=>{
 f.state.phase=scope=>{if(scope.phase==='before-write')f.state.authority=false;};await assert.rejects(f.ack);
 f.state.phase=()=>{};assert.equal((await f.status()).acknowledgmentId,null);
}));
test('upload revoked during final asynchronous authorization cannot be submitted',()=>fixture(async f=>{
 await f.ack();f.state.phase=scope=>{if(scope.phase==='before-write')f.state.upload=false;};await assert.rejects(f.submit);
 f.state.phase=()=>{};assert.deepEqual((await f.status()).submissions,[]);
}));
test('authority expiring during final asynchronous authorization cannot be reused',()=>fixture(async f=>{
 await f.ack();f.state.phase=scope=>{if(scope.phase==='before-write')f.state.time+=7200000;};await assert.rejects(f.interest);
 f.state.phase=()=>{};assert.deepEqual((await f.status()).interests,[]);
}));
test('intake closing during final asynchronous authorization leaves no acknowledgment or event',()=>fixture(async f=>{
 f.state.phase=scope=>{if(scope.phase==='before-write')f.state.enabled=false;};await assert.rejects(f.ack);f.state.phase=()=>{};
 assert.equal((await f.status()).acknowledgmentId,null);const db=f.raw();try{assert.equal(db.prepare('SELECT count(*) AS n FROM program_events').get().n,1);}finally{db.close();}
}));
for(const [name,patch] of Object.entries({wrongOwner:{subjectId:'other'},wrongWorkspace:{workspaceId:id(9)},incomplete:{state:'receiving'},unverified:{bytesVerified:false},public:{publiclyAccessible:true},newInterview:{collectionKind:'new-interview'},unclassified:{collectionKind:'unknown'},wrongUpload:{uploadId:id(9)}}))test(`trusted upload ${name} cannot be submitted`,()=>fixture(async f=>{await f.ack();f.state.sourcePatch=patch;await assert.rejects(f.submit);assert.deepEqual((await f.status()).submissions,[]);}));
test('missing upload adapter evidence is never treated as an existing historical source',()=>fixture(async f=>{await f.ack();f.state.upload=false;await assert.rejects(f.submit);}));
test('identity switch during pre-write authorization fails before mutation',()=>fixture(async f=>{
 f.state.phase=scope=>{if(scope.phase==='admit')f.state.actor='other';};await assert.rejects(f.ack);f.state.phase=()=>{};f.state.actor='contributor';assert.equal((await f.status()).acknowledgmentId,null);
}));
test('revoked membership and unavailable audit both fail before writes without leaking errors',()=>fixture(async f=>{
 f.state.allow=false;await assert.rejects(f.ack,/Contribution request unavailable/);f.state.allow=true;f.state.auditFailure=true;await assert.rejects(f.ack,/Contribution request unavailable/);f.state.auditFailure=false;assert.equal((await f.status()).acknowledgmentId,null);
}));
test('local event failure rolls back the corresponding participation write',()=>fixture(async f=>{
 const db=f.raw();db.exec("CREATE TRIGGER fail_event BEFORE INSERT ON program_events WHEN NEW.kind='program-acknowledged' BEGIN SELECT RAISE(ABORT,'synthetic unavailable audit'); END");
 try{await assert.rejects(f.ack);assert.equal(db.prepare('SELECT count(*) AS n FROM program_acknowledgments').get().n,0);}finally{db.exec('DROP TRIGGER fail_event');db.close();}
}));
test('ledger forbids destructive history edits and exact schema drift',()=>fixture(async f=>{
 await f.ack();await f.submit();await f.interest();const db=f.raw();
 try{for(const table of ['contribution_program_versions','program_acknowledgments','contribution_submissions','program_interests','program_events'])assert.throws(()=>db.exec(`DELETE FROM ${table}`),/immutable program record/);
  db.exec('DROP TRIGGER program_events_no_delete');assert.throws(()=>createPrivateContributionProgramRepository({root:f.root}),/Contribution request unavailable/);
 }finally{db.close();}
 assert.equal(lstatSync(join(f.root,'contribution-program.sqlite3')).mode&0o077,0);
}));
test('public-mode storage directory and symlink roots are refused',()=>{
 const root=mkdtempSync(join(tmpdir(),'garden-program-path-')),link=root+'-link';
 try{chmodSync(root,0o755);assert.throws(()=>createPrivateContributionProgramRepository({root}));chmodSync(root,0o700);symlinkSync(root,link);assert.throws(()=>createPrivateContributionProgramRepository({root:link}));}
 finally{rmSync(link,{force:true});rmSync(root,{recursive:true,force:true});}
});
for(const suffix of ['-journal','-wal','-shm'])test(`unsafe SQLite ${suffix} sidecars are refused before opening`,()=>fixture(async f=>{
 const sidecar=join(f.root,'contribution-program.sqlite3'+suffix),target=join(f.root,'unrelated');
 writeFileSync(target,'untouched',{mode:0o600});symlinkSync(target,sidecar);
 try{assert.throws(()=>createPrivateContributionProgramRepository({root:f.root}));assert.equal(readFileSync(target,'utf8'),'untouched');}
 finally{rmSync(sidecar);}
 symlinkSync(join(f.root,'missing-target'),sidecar);
 try{assert.throws(()=>createPrivateContributionProgramRepository({root:f.root}));}
 finally{rmSync(sidecar);}
}));
test('stale private WAL and SHM files are refused rather than silently migrated',()=>fixture(async f=>{
 for(const suffix of ['-wal','-shm']){
  const sidecar=join(f.root,'contribution-program.sqlite3'+suffix);writeFileSync(sidecar,'unreviewed-state',{mode:0o600});
  try{assert.throws(()=>createPrivateContributionProgramRepository({root:f.root}));assert.equal(readFileSync(sidecar,'utf8'),'unreviewed-state');}finally{rmSync(sidecar);}
 }
}));
test('body mass assignment, unsupported methods, cross-origin, interview paths and operator routes are rejected',()=>fixture(async f=>{
 const origin='https://garden.example',handler=createContributionProgramHandler({service:f.service,origin});
 const request=(patch={})=>new Request(origin+'/api/research/contribution/acknowledge',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({workspaceId:workspace,input:acknowledgment()}),...patch});
 const ok=await handler(request());assert.equal(ok.status,200);assert.match(ok.headers.get('cache-control'),/no-store/);assert.equal(ok.headers.get('vary'),'Cookie, Authorization');
 const bad=[request({headers:{origin:'https://evil.example','content-type':'application/json'}}),request({body:JSON.stringify({workspaceId:workspace,input:{...acknowledgment(),subjectId:'other'}})}),request({body:'x'.repeat(4097)}),request({body:'{broken'}),new Request(origin+'/api/research/contribution/acknowledge',{method:'GET',headers:{origin}}),new Request(origin+'/api/research/contribution/submit-interview',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'}),new Request(origin+'/api/research/contribution/installVersion',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})];
 for(const r of bad){const response=await handler(r);assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'contribution_unavailable'});}
}));
