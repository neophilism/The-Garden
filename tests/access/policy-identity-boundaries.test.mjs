import test from 'node:test';
import assert from 'node:assert/strict';
import {createPolicyExecutor,PolicyError} from '../../apps/research/access/policy-context.mjs';
import {roleProbe} from '../security/database-role-fixture.mjs';

const W='11111111-1111-4111-8111-111111111111';
const R='22222222-2222-4222-8222-222222222222';
const TOKEN='a'.repeat(64);

function fixture({boundary=null,closedIdentity=null,identityError=false}={}){
 const calls=[];
 let closed=false,cleared=false,retired=false;
 const close=point=>{if(point===boundary)closed=true;};
 const identity={viewer:async()=>{
  calls.push({kind:'identity',closed,retired});
  if(closed&&identityError)throw Error('SYNTHETIC-IDENTITY-SECRET');
  return closed?closedIdentity:{id:'alice',verified:true};
 }};
 const pool=kind=>({connect:async()=>{
  const probe=roleProbe(kind+'_login');
  let retiring=false;
  return {
   async query(sql,args){
    calls.push({kind,sql});
    if(kind==='research'&&sql.includes('clear_policy_context')){
     cleared=true;close('context-clear');
    }
    if(kind==='research'&&cleared&&sql.startsWith('SELECT current_user'))close('capability-check');
    if(kind==='research'&&sql==='COMMIT')close('research-commit');
    if(kind==='issuer'&&sql.includes('invalidate_policy_ticket')){
     retiring=true;close('ticket-retirement');
    }
    if(kind==='issuer'&&retiring&&sql==='COMMIT')close('retirement-commit');
    const result=probe(sql,args);
    return result??{rows:sql.includes('issue_policy_ticket')?[{ticket:TOKEN}]:[]};
   },
   release(destroy){
    calls.push({kind,release:true,destroy});
    if(kind==='research')close('research-release');
    if(kind==='issuer'&&retiring){retired=true;close('retirement-release');}
   }
  };
 }});
 return {calls,executor:createPolicyExecutor({identity,issuerPool:pool('issuer'),researchPool:pool('research')})};
}

for(const action of ['read','write'])for(const boundary of [
 'context-clear','capability-check','research-commit','research-release',
 'ticket-retirement','retirement-commit','retirement-release'
])test(action+' suppresses protected result after identity closes during '+boundary,async()=>{
 const f=fixture({boundary});
 let observed=false;
 await assert.rejects(async()=>{
  await f.executor.run(new Headers(),{workspaceId:W,recordId:R,action},async()=>({private:'SYNTHETIC-RESEARCH-CANARY'}));
  observed=true;
 },error=>error instanceof PolicyError&&error.code==='access_denied'&&!error.message.includes('CANARY'));
 assert.equal(observed,false);
 const beforeCommit=['context-clear','capability-check'].includes(boundary);
 assert.equal(f.calls.some(x=>x.kind==='research'&&x.sql==='COMMIT'),!beforeCommit);
 assert.equal(f.calls.some(x=>x.kind==='research'&&x.sql==='ROLLBACK'),beforeCommit);
 assert.ok(f.calls.some(x=>x.kind==='issuer'&&x.sql?.includes('invalidate_policy_ticket')));
});

for(const [name,options] of [
 ['different subject',{closedIdentity:{id:'bob',verified:true}}],
 ['unverified same subject',{closedIdentity:{id:'alice',verified:false}}],
 ['identity outage',{identityError:true}]
])test('final identity refresh denies '+name+' after successful retirement',async()=>{
 const f=fixture({boundary:'retirement-release',...options});
 await assert.rejects(()=>f.executor.run(new Headers(),{workspaceId:W},async()=>({private:'SYNTHETIC-RESEARCH-CANARY'})),
  error=>error instanceof PolicyError&&error.message==='Research access denied'&&!('cause' in error));
 assert.ok(f.calls.some(x=>x.kind==='research'&&x.sql==='COMMIT'));
 assert.ok(!f.calls.some(x=>x.kind==='research'&&x.sql==='ROLLBACK'));
});

test('a stable verified identity returns its result only after ticket retirement and refresh',async()=>{
 const f=fixture();
 const value=await f.executor.run(new Headers(),{workspaceId:W,recordId:R},async()=>({count:3}));
 assert.deepEqual(value,{count:3});
 const last=f.calls.at(-1);
 assert.deepEqual(last,{kind:'identity',closed:false,retired:true});
 assert.equal(f.calls.filter(x=>x.kind==='research'&&x.release).length,1);
 assert.equal(f.calls.filter(x=>x.kind==='issuer'&&x.sql?.includes('invalidate_policy_ticket')).length,1);
});
