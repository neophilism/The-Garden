import test from 'node:test';
import assert from 'node:assert/strict';
import {createPolicyExecutor,PolicyError} from '../../apps/research/access/policy-context.mjs';
import {roleProbe} from '../security/database-role-fixture.mjs';

const W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOKEN='a'.repeat(64);
const GATE='SELECT pg_advisory_xact_lock(144729,hashtext($1::text))';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

function fixture({atGate=async()=>{},rollbackFails=false,issuerCommitFails=false}={}){
 const calls=[];
 const identity={viewer:async()=>{calls.push({kind:'identity'});return {id:'alice',verified:true};}};
 const pool=kind=>({connect:async()=>{
  const observe=roleProbe(kind+'_login');
  return {
   async query(sql,args){
    calls.push({kind,sql,args});
    if(kind==='issuer'&&sql==='COMMIT'&&issuerCommitFails)throw Error('SYNTHETIC-ISSUER-PRIVATE');
    if(kind==='research'&&sql===GATE)await atGate();
    if(kind==='research'&&sql==='ROLLBACK'&&rollbackFails)throw Error('SYNTHETIC-ROLLBACK-PRIVATE');
    return observe(sql,args)??{rows:sql.includes('issue_policy_ticket')?[{ticket:TOKEN}]:[]};
   },
   release(destroy){calls.push({kind,release:true,destroy});}
  };
 }});
 const executor=createPolicyExecutor({identity,issuerPool:pool('issuer'),researchPool:pool('research')});
 const run=()=>executor.run(new Headers(),{workspaceId:W.toUpperCase()},async client=>{
  calls.push({kind:'work'});await client.query('SELECT synthetic_repository_work');return {count:1};
 });
 return {calls,run};
}

test('issuer commits and releases before the research workspace gate; gate precedes context and work',async()=>{
 const f=fixture();assert.deepEqual(await f.run(),{count:1});
 const index=predicate=>f.calls.findIndex(predicate);
 const gate=index(x=>x.kind==='research'&&x.sql===GATE);
 assert.ok(gate>=0);
 assert.ok(index(x=>x.kind==='issuer'&&x.sql==='COMMIT')<gate);
 assert.ok(index(x=>x.kind==='issuer'&&x.release)<gate);
 assert.ok(index(x=>x.kind==='research'&&x.sql==='BEGIN')<gate);
 assert.ok(index(x=>x.kind==='research'&&x.sql==="SET LOCAL statement_timeout='5s'")<gate);
 assert.ok(index(x=>x.kind==='research'&&x.sql==='SET LOCAL ROLE garden_research')<gate);
 assert.ok(gate<index(x=>x.sql?.includes('bind_policy_context')));
 assert.ok(gate<index(x=>x.kind==='work'));
 assert.deepEqual(f.calls[gate].args,[W]);
 assert.equal(f.calls.filter(x=>x.sql===GATE).length,1);
 assert.ok(!f.calls.some(x=>x.sql?.includes('advisory_unlock')));
 assert.ok(index(x=>x.kind==='research'&&x.sql==='COMMIT')<index(x=>x.kind==='research'&&x.release));
 assert.ok(index(x=>x.kind==='research'&&x.release)<index(x=>x.sql?.includes('invalidate_policy_ticket')));
 assert.equal(f.calls.at(-1).kind,'identity');
});

test('a pending gate cannot bind a policy context or enter repository work',async()=>{
 const entered=deferred(),resume=deferred();
 const f=fixture({atGate:async()=>{entered.resolve('gate');await resume.promise;}});
 const outcome=f.run().then(value=>({value}),error=>({error}));
 try{
  assert.equal(await Promise.race([entered.promise,outcome.then(()=> 'completed')]),'gate');
  assert.ok(!f.calls.some(x=>x.sql?.includes('bind_policy_context')));
  assert.ok(!f.calls.some(x=>x.kind==='work'));
  assert.ok(!f.calls.some(x=>x.sql?.includes('invalidate_policy_ticket')));
 }finally{resume.resolve();}
 assert.deepEqual((await outcome).value,{count:1});
});

test('a cancelled workspace gate rolls back before retiring the token and returns a fixed denial',async()=>{
 const f=fixture({atGate:async()=>{throw Error('SYNTHETIC-LOCK-PRIVATE');}});
 await assert.rejects(f.run,error=>error instanceof PolicyError&&error.code==='access_denied'&&error.message==='Research access denied'&&!('cause' in error));
 assert.ok(!f.calls.some(x=>x.sql?.includes('bind_policy_context')||x.kind==='work'));
 assert.ok(!f.calls.some(x=>x.kind==='research'&&x.sql==='COMMIT'));
 const rollback=f.calls.findIndex(x=>x.kind==='research'&&x.sql==='ROLLBACK');
 const release=f.calls.findIndex(x=>x.kind==='research'&&x.release);
 const retirement=f.calls.findIndex(x=>x.sql?.includes('invalidate_policy_ticket'));
 assert.ok(rollback>=0&&rollback<release&&release<retirement);
 assert.equal(f.calls[release].destroy,false);
});

test('gate denial plus rollback failure destroys the research connection and still retires the ticket',async()=>{
 const f=fixture({atGate:async()=>{throw Error('SYNTHETIC-LOCK-PRIVATE');},rollbackFails:true});
 await assert.rejects(f.run,PolicyError);
 assert.ok(f.calls.some(x=>x.kind==='research'&&x.release&&x.destroy===true));
 assert.equal(f.calls.filter(x=>x.sql?.includes('invalidate_policy_ticket')).length,1);
 assert.ok(!f.calls.some(x=>x.kind==='work'));
});

test('unconfirmed issuer commit never starts a research transaction or waits for a workspace gate',async()=>{
 const f=fixture({issuerCommitFails:true});await assert.rejects(f.run,PolicyError);
 assert.ok(!f.calls.some(x=>x.kind==='research'||x.kind==='work'));
});
