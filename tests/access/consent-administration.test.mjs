import {roleProbe} from '../security/database-role-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConsentAdministration} from '../../apps/research/access/consent-administration.mjs';
import {ConsentError} from '../../packages/domain/src/consent/purpose.mjs';
const W='11111111-1111-4111-8111-111111111111',R='22222222-2222-4222-8222-222222222222',T='33333333-3333-4333-8333-333333333333',H='a'.repeat(64);
const terms={id:T,version:'1',digest:H};
const policy={schemaVersion:1,recordId:R,basis:'consent-required',inputs:[],terms,subjects:[{subjectId:'narrator',authority:'self'}],purposes:[],reasonDigest:H};
function fixture({enabled=()=>true,authorize,role={},fault}={}){
 const calls=[];let authCalls=0;const observe=roleProbe('consent_login',role);
 const pool={connect:async()=>({query:async(sql,args)=>{calls.push({sql,args});if(fault?.(sql))throw Error('private-database-password');const guarded=observe(sql,args);if(guarded)return guarded;if(sql.includes('set_use_policy'))return{rows:[{version:'1'}]};if(sql.includes('record_consent_grant'))return{rows:[{id:JSON.parse(args[1]).id}]};return{rows:[]};},release:bad=>calls.push({released:true,bad})})};
 const auth=authorize??(async(h,scope)=>{authCalls++;return{id:'reviewer',verified:true,privilegedAssurance:true,workspaceId:scope.workspaceId,operation:scope.operation};});
 return{calls,authCalls:()=>authCalls,service:createConsentAdministration({pool,authorize:auth,enabled})};
}
test('policy management uses a dedicated role and fixed parameterized function',async()=>{const f=fixture();assert.deepEqual(await f.service.setPolicy(new Headers(),W,policy,'0'),{recordId:R,version:'1'});assert.equal(f.authCalls(),2);const q=f.calls.find(x=>x.sql?.includes('set_use_policy'));assert.equal(q.args[0],W);assert.equal(JSON.parse(q.args[1]).subjects[0].subjectId,'narrator');assert.equal(q.args[3],'reviewer');assert.ok(f.calls.some(x=>x.sql==='SET LOCAL ROLE garden_consent_admin'));});
test('disabled administration does not connect',async()=>{const f=fixture({enabled:()=>false});await assert.rejects(f.service.setPolicy(new Headers(),W,policy,'0'),ConsentError);assert.equal(f.calls.length,0);});
for(const actor of [null,{id:'reviewer',verified:true},{id:'reviewer',verified:true,privilegedAssurance:'true'},{id:'reviewer',verified:true,privilegedAssurance:true,workspaceId:W,operation:'wrong'}])test('ordinary identity cannot mutate consent '+JSON.stringify(actor),async()=>{const f=fixture({authorize:async()=>actor});await assert.rejects(f.service.setPolicy(new Headers(),W,policy,'0'),ConsentError);assert.equal(f.calls.length,0);});
for(const role of [{elevated:true},{elevated:'false'},{conflicting:true},{expected:false},{current_role:'garden_consent_admin'}])test('unsafe consent pool rejected '+JSON.stringify(role),async()=>{const f=fixture({role});await assert.rejects(f.service.setPolicy(new Headers(),W,policy,'0'),ConsentError);assert.ok(f.calls.some(x=>x.released&&x.bad));});
test('loss of authorization during work rolls back',async()=>{let n=0;const f=fixture({authorize:async(h,s)=>++n===1?{id:'reviewer',verified:true,privilegedAssurance:true,workspaceId:s.workspaceId,operation:s.operation}:null});await assert.rejects(f.service.setPolicy(new Headers(),W,policy,'0'),ConsentError);assert.ok(f.calls.some(x=>x.sql==='ROLLBACK'));assert.ok(!f.calls.some(x=>x.sql==='COMMIT'));});
test('database failure is redacted and rolled back',async()=>{const f=fixture({fault:s=>s.includes('set_use_policy')});await assert.rejects(f.service.setPolicy(new Headers(),W,policy,'0'),e=>e instanceof ConsentError&&!e.message.includes('password'));assert.ok(f.calls.some(x=>x.sql==='ROLLBACK'));});
test('broken rollback destroys pooled connection',async()=>{const f=fixture({fault:s=>s==='ROLLBACK'||s.includes('set_use_policy')});await assert.rejects(f.service.setPolicy(new Headers(),W,policy,'0'));assert.ok(f.calls.some(x=>x.released&&x.bad));});
test('withdrawal returns no erasure or global completion claim',async()=>{const f=fixture();const r=await f.service.withdraw(new Headers(),W,R,H);assert.equal(r.scope,'subject-record-purpose');assert.equal(r.erasesPublishedCopies,false);});
test('terms are exact immutable references',async()=>{const f=fixture();assert.equal((await f.service.registerTerms(new Headers(),W,terms)).version,'1');await assert.rejects(f.service.registerTerms(new Headers(),W,{...terms,extra:true}));});
test('invalid expected revision cannot be sent to PostgreSQL',async()=>{const f=fixture();await assert.rejects(f.service.setPolicy(new Headers(),W,policy,'-1'));assert.equal(f.calls.length,0);});
