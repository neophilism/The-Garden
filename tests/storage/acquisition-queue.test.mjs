import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync,lstatSync,symlinkSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createPrivateAcquisitionQueueRepository} from '../../services/workers/src/acquisition-queue-repository.mjs';
import {createAcquisitionQueue} from '../../services/workers/src/acquisition-queue.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const workspace=id(1),otherWorkspace=id(2);
const task={taskId:id(10),repositoryId:id(11),itemId:id(12),candidateId:null,routeKey:'catalog/'+id(12),requestKind:'scan-request',title:'Possible archival edition',notes:'Offline research lead',purpose:'research',costMinor:0,currency:'USD'};
const observed=(finding='access-denied',num=20,prev=task.taskId)=>({taskId:task.taskId,eventId:id(num),previousEventId:prev,finding,note:'Library access observation',evidenceRef:'operator-evidence-1'});
const grant=(t=task)=>({authorizationId:id(40),approvedBy:'second-reviewer',workspaceId:workspace,taskId:t.taskId,routeKey:t.routeKey,requestKind:t.requestKind,purpose:'research',allowContact:true,currency:'USD',maxCostMinor:t.costMinor,expiresAt:new Date(Date.now()+3600000).toISOString(),evidenceRef:'signed-record-verification-1'});
const approval=(previousEventId=task.taskId,t=task)=>({taskId:t.taskId,eventId:id(41),previousEventId,authorizationId:id(40)});
const contact=(previousEventId=id(41),t=task)=>({taskId:t.taskId,eventId:id(42),previousEventId,authorizationId:id(40),occurredAt:new Date().toISOString(),receiptRef:'staff-recorded-contact-evidence'});
const finish=(previousEventId=id(42),outcome='fulfilled',t=task)=>({taskId:t.taskId,eventId:id(43),previousEventId,outcome,note:'Manual follow-up only',evidenceRef:'human-review-log'});
function fixture({enabled=true}={}){
 const root=mkdtempSync(join(tmpdir(),'garden-acquisition-'));chmodSync(root,0o700);
 const repo=createPrivateAcquisitionQueueRepository({root});let actor='researcher',w=workspace,allow=true,seq=99,hook=()=>{},allowGrant=true;
 const events=[];
 const decisions={async decide(headers,workspaceId,callback){hook();const facts={subjectId:actor,workspaceId:w},allowed=await callback(facts);events.push({allowed,actor,w});return {allowed,requestId:id(++seq)};}};
 let currentGrant=grant();let verifyCount=0;
 const verifyAuthority=async ({facts,task:subjectTask,authorizationId,action})=>{verifyCount++;if(!allowGrant||authorizationId!==currentGrant.authorizationId)return null;return currentGrant;};
 const resolveRoute=async ({repositoryId,itemId})=>repositoryId===task.repositoryId&&itemId?'catalog/'+itemId:null;
 const config={decisions,authorize:async()=>allow,repository:repo,enabled:()=>enabled,verifyAuthority,resolveRoute};
 const service=createAcquisitionQueue(config);
 return {root,repo,service,config,events,
  actor:x=>{actor=x;},workspace:x=>{w=x;},deny:()=>{allow=false;},
  toggleGrant:x=>{allowGrant=x;},setGrant:x=>{currentGrant=x;},calls:()=>verifyCount,
  hook:x=>{hook=x;},close:()=>{repo.close();rmSync(root,{recursive:true,force:true});},
  draft:()=>service.draft({},workspace,task),detail:()=>service.detail({},workspace,{taskId:task.taskId}),
  list:()=>service.list({},workspace,{afterId:null,limit:25})};
}
async function withFixture(fn,options={}){const f=fixture(options);try{await fn(f);}finally{f.close();}}

test('immutable owner scoped acquisition draft has no outreach or expense',()=>withFixture(async f=>{
 const a=await f.draft();assert.equal(a.currentStatus,'draft');assert.equal(a.task.requestKind,'scan-request');assert.equal(a.contactAutomaticallySent,false);
 assert.equal(a.paymentAutomaticallyExecuted,false);assert.equal(a.historyLength,1);assert.deepEqual(a,await f.detail());
 assert.equal((await f.list()).tasks.length,1);
 assert.equal(lstatSync(join(f.root,'source-acquisition.sqlite3')).mode&0o077,0);
}));
test('identical replay is idempotent and cannot send anything twice',()=>withFixture(async f=>{
 const a=await f.draft(),b=await f.draft();assert.deepEqual(a,b);assert.equal((await f.list()).tasks.length,1);
 assert.equal((await f.service.history({},workspace,{taskId:task.taskId})).length,1);
}));
test('changed draft with same task ID is denied',()=>withFixture(async f=>{
 await f.draft();await assert.rejects(()=>f.service.draft({},workspace,{...task,title:'Changed title'}));
 assert.equal((await f.detail()).task.title,task.title);
}));
test('one researcher cannot see another researcher original or status',()=>withFixture(async f=>{
 await f.draft();f.actor('other-researcher');assert.equal((await f.list()).tasks.length,0);
 await assert.rejects(()=>f.detail());await assert.rejects(()=>f.service.history({},workspace,{taskId:task.taskId}));
}));
test('wrong workspace cannot read or create context',()=>withFixture(async f=>{
 await f.draft();f.workspace(otherWorkspace);await assert.rejects(()=>f.detail());await assert.rejects(()=>f.list());
}));
test('disabled service denies before repository mutation',()=>withFixture(async f=>{
 await assert.rejects(()=>f.draft());assert.equal(f.events.at(-1).allowed,false);
 assert.equal(f.repo.list({workspaceId:workspace,subjectId:'researcher',requestId:id(333)}).tasks.length,0);
},{enabled:false}));
test('audit unavailability fails closed',()=>withFixture(async f=>{
 const bad=createAcquisitionQueue({...f.config,decisions:{async decide(){throw Error('should-not-leak-secret');}}});
 await assert.rejects(()=>bad.draft({},workspace,task),/Garden acquisition request rejected/);
 assert.equal((await f.list()).tasks.length,0);
}));
test('revoked grant cannot prepare request',()=>withFixture(async f=>{f.deny();await assert.rejects(()=>f.draft());}));
test('identity switching between audited checks rejects before write',()=>withFixture(async f=>{
 let n=0;f.hook(()=>{if(++n===2)f.actor('different');});
 await assert.rejects(()=>f.draft());f.actor('researcher');assert.equal((await f.list()).tasks.length,0);
}));
test('deny access records an immutable barrier and does not say a source is nonexistent',()=>withFixture(async f=>{
 await f.draft();const result=await f.service.observe({},workspace,observed());assert.equal(result.currentStatus,'access-observed');
 const history=await f.service.history({},workspace,{taskId:task.taskId});assert.equal(history.at(-1).details.finding,'access-denied');
 assert.equal((await f.detail()).task.title,task.title);
 await assert.rejects(()=>f.service.approve({},workspace,approval(id(20))));
}));
test('catalog-not-found remains a lead, not a finding of historical nonexistence',()=>withFixture(async f=>{
 await f.draft();await f.service.observe({},workspace,observed('catalog-not-found'));
 const x=await f.service.approve({},workspace,approval(id(20)));assert.equal(x.currentStatus,'approved');
 assert.equal(x.contactAutomaticallySent,false);
}));
test('failed review cannot authorize contact or spending',()=>withFixture(async f=>{
 await f.draft();f.toggleGrant(false);await assert.rejects(()=>f.service.approve({},workspace,approval()));
 assert.equal((await f.detail()).currentStatus,'draft');
}));
test('second-party verified authority is required and append-only',()=>withFixture(async f=>{
 await f.draft();const x=await f.service.approve({},workspace,approval());assert.equal(x.currentStatus,'approved');
 assert.equal(x.contactAutomaticallySent,false);assert.equal(x.paymentAutomaticallyExecuted,false);
 const events=await f.service.history({},workspace,{taskId:task.taskId});assert.equal(events.length,2);assert.equal(events[1].details.authority.approvedBy,'second-reviewer');
}));
test('caller cannot substitute a self-approved authority',()=>withFixture(async f=>{
 await f.draft();f.setGrant({...grant(),approvedBy:'researcher'});await assert.rejects(()=>f.service.approve({},workspace,approval()));
 assert.equal((await f.detail()).currentStatus,'draft');
}));
test('quoted budget may not exceed verified ceiling',()=>withFixture(async f=>{
 const expensive={...task,taskId:id(18),itemId:id(18),routeKey:'catalog/'+id(18),costMinor:500};
 await f.service.draft({},workspace,expensive);
 f.setGrant({...grant(expensive),maxCostMinor:499});
 await assert.rejects(()=>f.service.approve({},workspace,approval(expensive.taskId,expensive)));
}));
test('unexpired verified authority is required before recording external contact',()=>withFixture(async f=>{
 await f.draft();await f.service.approve({},workspace,approval());const x=await f.service.recordContact({},workspace,contact());
 assert.equal(x.currentStatus,'contact-recorded');assert.equal(x.contactAutomaticallySent,false);
 assert.equal(x.paymentAutomaticallyExecuted,false);
 assert.equal((await f.service.history({},workspace,{taskId:task.taskId})).length,3);
}));
test('no contact receipt may exist before verified approval',()=>withFixture(async f=>{
 await f.draft();await assert.rejects(()=>f.service.recordContact({},workspace,contact(task.taskId)));
 assert.equal((await f.detail()).currentStatus,'draft');
}));
test('identical contact receipt replay is stable',()=>withFixture(async f=>{
 await f.draft();await f.service.approve({},workspace,approval());const event=contact();
 const one=await f.service.recordContact({},workspace,event),two=await f.service.recordContact({},workspace,event);
 assert.deepEqual(one,two);assert.equal((await f.service.history({},workspace,{taskId:task.taskId})).length,3);
}));
test('contact receipt with forged or different grant is rejected',()=>withFixture(async f=>{
 await f.draft();await f.service.approve({},workspace,approval());f.setGrant({...grant(),evidenceRef:'different'});
 await assert.rejects(()=>f.service.recordContact({},workspace,contact()));
}));
test('one route cannot be contacted twice via different task IDs',()=>withFixture(async f=>{
 await f.draft();await f.service.approve({},workspace,approval());await f.service.recordContact({},workspace,contact());
 const other={...task,taskId:id(19)};await f.service.draft({},workspace,other);
 const otherGrant={...grant(other),taskId:other.taskId};f.setGrant(otherGrant);
 await f.service.approve({},workspace,{...approval(other.taskId,other),eventId:id(141)});
 await assert.rejects(()=>f.service.recordContact({},workspace,{...contact(id(141),other),eventId:id(142)}));
}));
test('denied route cannot be evaded with a new task ID',()=>withFixture(async f=>{
 await f.draft();await f.service.observe({},workspace,observed('robots-disallowed'));
 const other={...task,taskId:id(19)};await f.service.draft({},workspace,other);
 f.setGrant(grant(other));await assert.rejects(()=>f.service.approve({},workspace,{...approval(other.taskId,other),eventId:id(141)}));
}));
test('paywall refusal stays distinct from nonexistent source',()=>withFixture(async f=>{
 await f.draft();await f.service.observe({},workspace,observed('paywalled'));
 const history=await f.service.history({},workspace,{taskId:task.taskId});assert.equal(history.at(-1).details.finding,'paywalled');
 await assert.rejects(()=>f.service.recordContact({},workspace,contact()));
}));
test('cost is recorded as estimate, with no payment capability',()=>withFixture(async f=>{
 const priced={...task,taskId:id(17),itemId:id(17),routeKey:'catalog/'+id(17),costMinor:950};
 const x=await f.service.draft({},workspace,priced);assert.equal(x.task.costMinor,950);
 assert.equal(x.paymentAutomaticallyExecuted,false);
 f.setGrant(grant(priced));assert.equal((await f.service.approve({},workspace,approval(priced.taskId,priced))).currentStatus,'approved');
 assert.equal((await f.service.detail({},workspace,{taskId:priced.taskId})).task.costMinor,950);
}));
test('offline lead can be deferred with evidence without outward contact',()=>withFixture(async f=>{
 await f.draft();const x=await f.service.finish({},workspace,finish(task.taskId,'deferred-offline'));
 assert.equal(x.currentStatus,'finished');assert.equal(x.contactAutomaticallySent,false);
}));
test('inaccessible finding is not historical nonexistence',()=>withFixture(async f=>{
 await f.draft();await f.service.finish({},workspace,finish(task.taskId,'inaccessible'));
 await assert.rejects(()=>f.service.approve({},workspace,approval(id(43))));
}));
test('completed contact can be logged with preserved outcome',()=>withFixture(async f=>{
 await f.draft();await f.service.approve({},workspace,approval());await f.service.recordContact({},workspace,contact());
 const x=await f.service.finish({},workspace,finish());assert.equal(x.currentStatus,'finished');
 const history=await f.service.history({},workspace,{taskId:task.taskId});assert.equal(history.length,4);assert.equal(history.at(-1).details.outcome,'fulfilled');
}));
test('finished task cannot be reopened for access observation',()=>withFixture(async f=>{
 await f.draft();await f.service.finish({},workspace,finish(task.taskId,'deferred-offline'));
 await assert.rejects(()=>f.service.observe({},workspace,observed('accessible',55,id(43))));
}));
test('repository persists complete event chains across close and reopen',async()=>{
 const f=fixture();try{
  await f.draft();await f.service.observe({},workspace,observed('deferred-offline'));
  f.repo.close();const reopened=createPrivateAcquisitionQueueRepository({root:f.root});
  try{const facts={workspaceId:workspace,subjectId:'researcher',requestId:id(3)};assert.equal(reopened.detail(facts,task.taskId).historyLength,2);}
  finally{reopened.close();}
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('deny unsafe private storage modes',()=>{
 const root=mkdtempSync(join(tmpdir(),'garden-insecure-'));chmodSync(root,0o755);
 try{assert.throws(()=>createPrivateAcquisitionQueueRepository({root}));}finally{rmSync(root,{recursive:true,force:true});}
});
test('reject symlink storage roots',()=>{
 const root=mkdtempSync(join(tmpdir(),'garden-real-'));chmodSync(root,0o700);const alias=root+'-link';symlinkSync(root,alias);
 try{assert.throws(()=>createPrivateAcquisitionQueueRepository({root:alias}));}finally{rmSync(alias,{force:true});rmSync(root,{recursive:true,force:true});}
});
test('reject schema drift when reopening local repository',()=>{
 const root=mkdtempSync(join(tmpdir(),'garden-drift-'));chmodSync(root,0o700);const repo=createPrivateAcquisitionQueueRepository({root});repo.close();
 const db=new DatabaseSync(join(root,'source-acquisition.sqlite3'));db.exec('DROP TRIGGER tasks_no_delete');db.close();
 try{assert.throws(()=>createPrivateAcquisitionQueueRepository({root}));}finally{rmSync(root,{recursive:true,force:true});}
});
test('deny any future direct mutation of original or event rows',()=>withFixture(async f=>{
 await f.draft();const db=new DatabaseSync(join(f.root,'source-acquisition.sqlite3'));
 try{assert.throws(()=>db.exec("DELETE FROM tasks WHERE task_id='"+task.taskId+"'"));assert.throws(()=>db.exec("UPDATE task_events SET kind='unauthorized'"));}finally{db.close();}
}));
test('paginated task listing is owner scoped',()=>withFixture(async f=>{
 await f.draft();await f.service.draft({},workspace,{...task,taskId:id(20),itemId:id(20),routeKey:'catalog/'+id(20)});
 const first=await f.service.list({},workspace,{afterId:null,limit:1});assert.equal(first.tasks.length,1);assert(first.nextAfterId);
 const second=await f.service.list({},workspace,{afterId:first.nextAfterId,limit:1});assert.equal(second.tasks.length,1);assert.equal(second.nextAfterId,null);
}));

test('trusted canonical route resolver denies aliases before any contact/denial bypass',()=>withFixture(async f=>{
 const alias={...task,routeKey:'catalog/alternate-alias'};
 await assert.rejects(()=>f.service.draft({},workspace,alias));
 assert.equal((await f.list()).tasks.length,0);
}));
