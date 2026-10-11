import {roleProbe} from '../security/database-role-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAuditReader,createAuditedDecision} from '../../apps/research/access/audit.mjs';
import {AuditError,GENESIS,auditHash} from '../../packages/domain/src/audit/ledger.mjs';
const W='11111111-1111-4111-8111-111111111111',TOKEN='a'.repeat(64),H=new Headers();
function fixture({role={},fault,viewer,assured=true,enabled=()=>true,sqlMember=true,sqlContext=true,entries}={}){
 const calls=[];let checks=0;
 const identity={viewer:viewer??(async()=>({id:'auditor',verified:true,privilegedAssurance:true})),async authorizePrivileged(h,a,authorize){checks++;if(typeof assured==='function'?!assured(checks):!assured)return false;return authorize({subjectId:'auditor',action:a});}};
 const event={schemaVersion:1,eventId:randomUUID(),workspaceId:W,sequence:'1',requestId:randomUUID(),occurredAt:'2026-10-11T12:00:00.000000Z',actor:{kind:'subject',reference:randomUUID()},subject:{kind:'record',reference:randomUUID(),version:'1'},action:'record.create',outcome:'succeeded',reasonCode:'record-created'};
 const text=JSON.stringify(event),row={workspaceId:W,sequence:'1',previousHash:GENESIS,hash:auditHash(W,'1',GENESIS,text),eventText:text};
 function pool(kind){const observe=roleProbe(kind,role[kind]??{});return{connect:async()=>({async query(sql,args){calls.push({kind,sql,args});if(fault?.(kind,sql))throw Error('secret-password-canary');
  const guarded=observe(sql,args);if(guarded)return guarded;
  if(sql.includes('issue_audit_ticket')){if(!sqlMember)throw Error('not-auditor');return{rows:[{token:TOKEN}]};}
  if(sql.includes('audit_member'))return{rows:[{allowed:sqlMember}]};
  if(sql.includes('audit_may_read'))return{rows:[{allowed:sqlContext}]};
  if(sql.startsWith('SELECT sequence::text,hash'))return{rows:[{sequence:'1',hash:row.hash}]};
  if(sql.startsWith('SELECT workspace_id::text'))return{rows:entries??[row]};
  return{rows:[]};},release:bad=>calls.push({kind,released:true,bad})})};}
 const issuerPool=pool('issuer'),auditPool=pool('reader'),writerPool=pool('writer');
 return{calls,row,identity,issuerPool,auditPool,writerPool,checks:()=>checks,reader:createAuditReader({identity,issuerPool,auditPool,enabled}),decision:createAuditedDecision({identity,pool:writerPool,enabled})};
}
test('reader requires fresh privilege, separate SQL auditor grant and bounded chain verification',async()=>{const f=fixture();const result=await f.reader.page(H,W);assert.equal(f.checks(),2);assert.equal(result.entries.length,1);assert.equal(result.externallyAnchored,false);assert.equal(result.identityMappingIncluded,false);assert.ok(f.calls.some(x=>x.sql?.includes('invalidate_policy_ticket')));assert.ok(f.calls.some(x=>x.sql==='SET LOCAL ROLE garden_audit_reader'));assert.deepEqual(f.calls.find(x=>x.sql?.includes('issue_audit_ticket')).args,[W,'auditor']);});
test('reader pools cannot share login capabilities',()=>{const f=fixture();assert.throws(()=>createAuditReader({identity:f.identity,issuerPool:f.issuerPool,auditPool:f.issuerPool}),AuditError);});
for(const enabled of [false,'true',null])test('disabled or nonboolean activation '+String(enabled)+' makes no database call',async()=>{const f=fixture({enabled:()=>enabled});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.equal(f.calls.length,0);});
for(const value of [null,{id:'auditor',verified:false},{id:'auditor',verified:'true'},{id:'',verified:true}])test('unverified viewer cannot export '+JSON.stringify(value),async()=>{const f=fixture({viewer:async()=>value});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.equal(f.calls.length,0);});
test('password-only identity is not an audit grant',async()=>{const f=fixture({assured:false});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.equal(f.calls.length,0);});
test('membership without SQL auditor role is rejected before the read pool',async()=>{const f=fixture({sqlMember:false});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.equal(f.calls.some(x=>x.kind==='reader'),false);});
for(const field of ['elevated','expected','conflicting','current_role'])test('unsafe reader '+field+' fails closed',async()=>{const value=field==='expected'?false:field==='current_role'?'unexpected':true;const f=fixture({role:{reader:{[field]:value}}});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.ok(f.calls.some(x=>x.kind==='reader'&&x.released&&x.bad));});
test('issuer cannot hold a conflicting read/write capability',async()=>{const f=fixture({role:{issuer:{conflicting:true}}});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.equal(f.calls.some(x=>x.sql?.includes('issue_audit_ticket')),false);});
test('privilege expiry after materialization causes rollback, no export',async()=>{const f=fixture({assured:n=>n===1});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.ok(f.calls.some(x=>x.kind==='reader'&&x.sql==='ROLLBACK'));assert.equal(f.calls.some(x=>x.kind==='reader'&&x.sql==='COMMIT'),false);});
test('expired SQL context cannot release an export',async()=>{const f=fixture({sqlContext:false});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.ok(f.calls.some(x=>x.kind==='reader'&&x.sql==='ROLLBACK'));});
test('identity switch cannot release another session\'s export',async()=>{let n=0;const f=fixture({viewer:async()=>({id:++n===1?'auditor':'other',verified:true})});await assert.rejects(()=>f.reader.page(H,W),AuditError);assert.ok(f.calls.some(x=>x.sql==='ROLLBACK'));});
test('corrupt stored hash fails independently of the SQL caller',async()=>{const f=fixture();const g=fixture({entries:[{...f.row,hash:'a'.repeat(64)}]});await assert.rejects(()=>g.reader.page(H,W),AuditError);});
test('empty result before the selected head is an error, not absence',async()=>{const f=fixture({entries:[]});await assert.rejects(()=>f.reader.page(H,W),AuditError);});
for(const options of [{after:'2'},{limit:'50'},{workspaceId:randomUUID()},{through:{workspaceId:randomUUID(),sequence:'0',hash:GENESIS}}])test('invalid export boundary '+JSON.stringify(options),async()=>{const f=fixture();await assert.rejects(()=>f.reader.page(H,W,options),AuditError);});
test('failing retirement cannot return a successful export',async()=>{const f=fixture({fault:(kind,sql)=>sql.includes('invalidate_policy_ticket')});await assert.rejects(()=>f.reader.page(H,W),AuditError);});
test('failed query and rollback destroy the connection and redact failure detail',async()=>{const f=fixture({fault:(kind,sql)=>kind==='reader'&&(sql==='ROLLBACK'||sql.includes('record_audit_export'))});await assert.rejects(()=>f.reader.page(H,W),e=>e instanceof AuditError&&!e.message.includes('secret'));assert.ok(f.calls.some(x=>x.kind==='reader'&&x.released&&x.bad));});
test('decision recorder records only the strict boolean and trusted actor',async()=>{const f=fixture();const result=await f.decision.decide(H,W,async()=>true);const q=f.calls.find(x=>x.sql?.includes('record_audit_decision'));assert.deepEqual(q.args,[W,'auditor',result.requestId,true]);assert.equal(result.operationPerformed,false);assert.equal(result.allowed,true);});
for(const result of [false,'true',{allowed:true},null,1])test('decision result '+JSON.stringify(result)+' cannot manufacture an allowed event',async()=>{const f=fixture();assert.equal((await f.decision.decide(H,W,async()=>result)).allowed,false);});
test('exception text and opaque request content never enter audit parameters',async()=>{const f=fixture();await f.decision.decide(H,W,async()=>{throw Error('PRIVATE-FAMILY-RECORD');});assert.equal(JSON.stringify(f.calls).includes('PRIVATE-FAMILY-RECORD'),false);assert.equal(f.calls.find(x=>x.sql?.includes('record_audit_decision')).args[3],false);});
test('anonymous decision records database origin, not an invented verified actor',async()=>{const f=fixture({viewer:async()=>null});let called=false;const r=await f.decision.decide(H,W,async()=>{called=true;return true;});assert.equal(called,false);assert.equal(r.allowed,false);assert.equal(f.calls.find(x=>x.sql?.includes('record_audit_decision')).args[1],null);});
test('identity revocation during decision converts it to denied',async()=>{let n=0;const f=fixture({viewer:async()=>++n===1?{id:'auditor',verified:true}:null});assert.equal((await f.decision.decide(H,W,async()=>true)).allowed,false);});
test('audit write outage cannot release an allowed response',async()=>{const f=fixture({fault:(kind,sql)=>kind==='writer'&&sql.includes('record_audit_decision')});await assert.rejects(()=>f.decision.decide(H,W,async()=>true),AuditError);});

// PostgreSQL ORDER BY prefers a SELECT output alias over an input column.
// Qualify the stored bigint: sorting the exported sequence::text corrupts pages
// once a history reaches ten events. The real-PostgreSQL CI exercises this too.
test('audit exports sort by stored bigint, while retaining exact string sequences',async()=>{
 const f=fixture();await f.reader.page(H,W);
 const query=f.calls.find(x=>x.sql?.startsWith('SELECT workspace_id::text'));
 assert.ok(query);
 assert.match(query.sql,/sequence::text AS sequence/);
 assert.match(query.sql,/FROM garden_control\.audit_events AS ae/);
 assert.match(query.sql,/ORDER BY ae\.sequence LIMIT \$4/);
 assert.doesNotMatch(query.sql,/ORDER BY sequence(?: |$)/);
});
