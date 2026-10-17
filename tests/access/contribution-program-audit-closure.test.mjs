import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {roleProbe} from '../security/database-role-fixture.mjs';
import {createAuditedDecision} from '../../apps/research/access/audit.mjs';
import {createContributionProgramService} from '../../apps/research/community/program-service.mjs';
import {createPrivateContributionProgramRepository} from '../../services/workers/src/contribution-program-repository.mjs';
import {RESEARCH_CHARTER,programTermsDigest} from '../../packages/domain/src/community/program.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const workspaceId=id(1),programId=id(2),uploadId=id(3);
const version=n=>({schemaVersion:1,programId,version:n,title:'Synthetic audit closure program',responsibleInstitution:'Synthetic test institution',charter:'Private materials only. Interest is optional.',permittedPurposes:['research-submission','program-interest'],researchCharter:RESEARCH_CHARTER,newInterviews:false});
const v1=version(1),v2=version(2);
const common={programId,version:1,termsDigest:programTermsDigest(v1),acknowledgmentId:id(10)};
const inputs={
 installVersion:{version:v2,authorizationId:id(502)},
 acknowledge:{...common,acknowledgmentId:id(11),acknowledged:true},
 submit:{...common,submissionId:id(20),uploadId},
 registerInterest:{...common,interestId:id(30),requestProgramUpdates:true},
 withdrawInterest:{programId,interestId:id(30),withdrawalId:id(40)}
};
const collecting=['installVersion','acknowledge','submit','registerInterest'];
const tables=['contribution_program_versions','program_acknowledgments','contribution_submissions','program_interests','program_interest_withdrawals','program_events'];

async function fixture(run){
 const root=mkdtempSync(join(tmpdir(),'garden-program-audit-closure-'));chmodSync(root,0o700);
 const state={actor:'operator',enabled:true,authority:true,upload:true,phase:null,time:Date.parse('2026-10-17T12:00:00.000Z'),hook:null};
 const writes=[],audit=[];
 async function boundary(stage){
  if(state.hook?.stage===stage&&state.hook.phase===state.phase){
   const hook=state.hook;state.hook=null;
   await Promise.resolve();hook.change();
  }
 }
 const identity={async viewer(){await boundary('identity-recheck');return {id:state.actor,verified:true};}};
 const pool={async connect(){const observe=roleProbe('writer');return {
  async query(sql,args){
   const guarded=observe(sql,args);if(guarded)return guarded;
   if(sql.includes('record_audit_decision')){audit.push({phase:state.phase,allowed:args[3]});await boundary('audit-write');}
   if(sql==='COMMIT')await boundary('audit-commit');
   return {rows:[]};
  },release(){}
 };}};
 const decisions=createAuditedDecision({identity,pool,enabled:()=>true});
 const local=createPrivateContributionProgramRepository({root,now:()=>state.time});
 const repository={...local};
 for(const action of [...collecting,'withdrawInterest'])repository[action]=(...args)=>{writes.push(action);return local[action](...args);};
 const authority=v=>({authorizationId:id(500+v.version),workspaceId,programId,version:v.version,termsDigest:programTermsDigest(v),responsibleInstitution:v.responsibleInstitution,authorizedBy:'synthetic-operator',authorityEvidenceId:id(600+v.version),validFrom:'2026-10-17T11:00:00.000Z',expiresAt:'2026-10-17T13:00:00.000Z',responseCapacityConfirmed:true});
 const service=createContributionProgramService({decisions,repository,now:()=>state.time,enabled:async()=>state.enabled,
  authorize:async(facts,scope)=>{state.phase=scope.phase;return facts.workspaceId===workspaceId;},
  authorizeOperator:async()=>state.actor==='operator',
  verifyAuthority:async({version:v})=>state.authority?authority(v):null,
  verifyUpload:async({facts})=>state.upload?{workspaceId,subjectId:facts.subjectId,uploadId,state:'complete-quarantined',bytesVerified:true,publiclyAccessible:false,collectionKind:'existing-material'}:null
 });
 function snapshot(){
  const db=new DatabaseSync(join(root,'contribution-program.sqlite3'),{readOnly:true});
  try{return Object.fromEntries(tables.map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));}finally{db.close();}
 }
 const f={state,writes,audit,service,snapshot,
  call:action=>service[action](new Headers(),workspaceId,inputs[action]),
  status:()=>service.status(new Headers(),workspaceId,{programId}),
  arm(stage,change,phase='before-write'){state.phase=null;state.hook={stage,change,phase};writes.length=0;audit.length=0;}
 };
 try{
  await service.installVersion(new Headers(),workspaceId,{version:v1,authorizationId:id(501)});
  state.actor='contributor';await service.acknowledge(new Headers(),workspaceId,{...common,acknowledged:true});
  await run(f);
 }finally{local.close();rmSync(root,{recursive:true,force:true});}
}

for(const stage of ['identity-recheck','audit-write','audit-commit'])for(const action of collecting){
 test('intake closure during '+stage+' prevents '+action+' repository dispatch',()=>fixture(async f=>{
  if(action==='installVersion')f.state.actor='operator';
  const before=f.snapshot();f.arm(stage,()=>{f.state.enabled=false;});
  await assert.rejects(()=>f.call(action),/Contribution request unavailable/);
  assert.equal(f.state.hook,null,'The fault must occur inside the real audited decision');
  assert.ok(f.audit.some(entry=>entry.phase==='before-write'&&entry.allowed===true),'An audited allow must not imply operation execution');
  assert.deepEqual(f.writes,[]);assert.deepEqual(f.snapshot(),before);
 }));
}

test('authority revoked while the before-write audit commits cannot collect interest',()=>fixture(async f=>{
 const before=f.snapshot();f.arm('audit-commit',()=>{f.state.authority=false;});
 await assert.rejects(()=>f.call('registerInterest'),/Contribution request unavailable/);
 assert.equal(f.state.hook,null);assert.deepEqual(f.writes,[]);assert.deepEqual(f.snapshot(),before);
}));

test('upload revoked while the before-write audit commits cannot create a submission',()=>fixture(async f=>{
 const before=f.snapshot();f.arm('audit-commit',()=>{f.state.upload=false;});
 await assert.rejects(()=>f.call('submit'),/Contribution request unavailable/);
 assert.equal(f.state.hook,null);assert.deepEqual(f.writes,[]);assert.deepEqual(f.snapshot(),before);
}));

test('receipt reads survive intake and authority closure during the audited read',()=>fixture(async f=>{
 await f.call('submit');await f.call('registerInterest');const before=f.snapshot();
 f.arm('audit-commit',()=>{f.state.enabled=false;f.state.authority=false;},'read');
 const status=await f.status();assert.equal(f.state.hook,null);assert.equal(status.intakeAvailable,false);
 assert.equal(status.submissions.length,1);assert.equal(status.interests.length,1);assert.deepEqual(f.writes,[]);assert.deepEqual(f.snapshot(),before);
}));

test('withdrawal commits once despite intake and authority closure during its audit',()=>fixture(async f=>{
 await f.call('submit');await f.call('registerInterest');const before=f.snapshot();
 f.arm('audit-commit',()=>{f.state.enabled=false;f.state.authority=false;});
 assert.equal((await f.call('withdrawInterest')).state,'withdrawn');assert.equal(f.state.hook,null);
 assert.deepEqual(f.writes,['withdrawInterest']);
 const after=f.snapshot();assert.equal(after.program_interest_withdrawals.length,1);assert.equal(after.program_events.length,before.program_events.length+1);
 for(const table of tables.filter(name=>!['program_interest_withdrawals','program_events'].includes(name)))assert.deepEqual(after[table],before[table]);
 assert.equal((await f.call('withdrawInterest')).state,'withdrawn');assert.deepEqual(f.snapshot(),after);
 const status=await f.status();assert.equal(status.intakeAvailable,false);assert.equal(status.interests[0].state,'withdrawn');assert.equal(status.submissions.length,1);
}));
