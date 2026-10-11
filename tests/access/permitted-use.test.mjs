import test from 'node:test';
import assert from 'node:assert/strict';
import {createPermittedUseTransactions} from '../../apps/research/access/permitted-use.mjs';
import {ConsentError} from '../../packages/domain/src/consent/purpose.mjs';
const W='11111111-1111-4111-8111-111111111111',R='22222222-2222-4222-8222-222222222222',Q='33333333-3333-4333-8333-333333333333';
const input={workspaceId:W,recordId:R,requestId:Q,purposes:['public-display']};
function fixture({kind='publication',enabled=()=>true,authorize=async()=>true,role={},expired=false,fault}={}){
 const calls=[];let admits=0;
 const pool={connect:async()=>({query:async(sql,args)=>{calls.push({sql,args});if(fault?.(sql))throw Error('secret');if(sql.startsWith('SELECT current_user'))return{rows:[{login_role:'pipeline',current_role:'pipeline',elevated:false,permitted_role:true,conflicting:false,...role}]};if(sql.includes('admit_')){if(expired&&++admits===2)throw Error('expired');return{rows:[{receipt:{allowed:true,requestId:Q,publicationApproved:false}}]};}return{rows:[]};},release:bad=>calls.push({release:true,bad})})};
 return{calls,service:createPermittedUseTransactions({pool,kind,authorize,enabled})};
}
test('permission is checked again after transactional work before commit',async()=>{const f=fixture();const value=await f.service.run({},input,c=>c.query('SELECT synthetic'));assert.deepEqual(value,{rows:[]});assert.equal(f.calls.filter(x=>x.sql?.includes('admit_publication')).length,2);assert.ok(f.calls.findIndex(x=>x.sql==='SELECT synthetic')<f.calls.findIndex(x=>x.sql==='COMMIT'));});
test('expiration during work rolls back rather than admitting new publication',async()=>{const f=fixture({expired:true});await assert.rejects(f.service.run({},input,c=>c.query('SELECT synthetic')),ConsentError);assert.ok(f.calls.some(x=>x.sql==='ROLLBACK'));assert.ok(!f.calls.some(x=>x.sql==='COMMIT'));});
test('revoked pipeline authorization during work rolls back',async()=>{let n=0;const f=fixture({authorize:async()=>++n===1});await assert.rejects(f.service.run({},input,async()=>1));assert.ok(!f.calls.some(x=>x.sql==='COMMIT'));});
for(const role of [{elevated:true},{conflicting:true},{permitted_role:false},{elevated:'false'}])test('unsafe pipeline pool '+JSON.stringify(role),async()=>{const f=fixture({role});await assert.rejects(f.service.run({},input,async()=>1));assert.ok(f.calls.some(x=>x.release&&x.bad));});
test('worker preservation cannot request public permission',async()=>{const f=fixture({kind:'preservation'});await assert.rejects(f.service.run({},input,async()=>1));assert.equal(f.calls.length,0);});
test('preservation uses fixed-purpose function',async()=>{const f=fixture({kind:'preservation'});await f.service.run({},{...input,purposes:['preservation']},async()=>1);assert.ok(f.calls.some(x=>x.sql?.includes('admit_preservation_use')));});
test('publisher cannot request research access through the use gate',async()=>{const f=fixture();await assert.rejects(f.service.run({},{...input,purposes:['research']},async()=>1));assert.equal(f.calls.length,0);});
test('not enabled means no transaction',async()=>{const f=fixture({enabled:()=>false});await assert.rejects(f.service.run({},input,async()=>1));assert.equal(f.calls.length,0);});
test('duplicate or client-defined purposes are denied',async()=>{const f=fixture();for(const purposes of [['public-display','public-display'],['all'],[]])await assert.rejects(f.service.run({},{...input,purposes},async()=>1));assert.equal(f.calls.length,0);});
test('rollback failure removes the pooled connection',async()=>{const f=fixture({fault:s=>s==='ROLLBACK'||s==='SELECT synthetic'});await assert.rejects(f.service.run({},input,c=>c.query('SELECT synthetic')));assert.ok(f.calls.some(x=>x.release&&x.bad));});
