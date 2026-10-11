import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDatabaseCapability,validateDatabaseCapability,DATABASE_CAPABILITY_QUERY,RUNTIME_DATABASE_CAPABILITIES,DatabaseCapabilityError} from '../../apps/research/access/database-role.mjs';
const safe={login_role:'runtime_login',current_role:'runtime_login',login_enabled:true,elevated:false,expected:true,can_set:true,inherited:false,conflicting:false,unsafe_capability:false,owns_objects:false};
for(const capability of RUNTIME_DATABASE_CAPABILITIES){
 test('isolated login '+capability+' is admitted before and after SET ROLE',()=>{
  assert.equal(validateDatabaseCapability([safe],capability),'runtime_login');
  assert.equal(validateDatabaseCapability([{...safe,current_role:capability}],capability,{activeRole:true,login:'runtime_login'}),'runtime_login');
 });
 for(const foreign of [...RUNTIME_DATABASE_CAPABILITIES,'garden_migrator','future_unknown_capability'].filter(x=>x!==capability)){
  test(capability+' rejects reachable '+foreign,()=>assert.throws(()=>validateDatabaseCapability([{...safe,conflicting:true}],capability),DatabaseCapabilityError));
 }
}
for(const [field,good] of Object.entries(safe).filter(([,v])=>typeof v==='boolean')){
 for(const invalid of [!good,String(good),null,undefined,0,1])test('role evidence '+field+' rejects '+String(invalid),()=>{
  assert.throws(()=>validateDatabaseCapability([{...safe,[field]:invalid}],'garden_research'),DatabaseCapabilityError);
 });
}
for(const rows of [[],[safe,safe],null,{},[null]])test('malformed role observation '+JSON.stringify(rows),()=>assert.throws(()=>validateDatabaseCapability(rows,'garden_research'),DatabaseCapabilityError));
test('migration and arbitrary role names cannot be selected by runtime',async()=>{
 let n=0;for(const capability of ['garden_migrator','postgres','garden_research; RESET ROLE',null])await assert.rejects(()=>assertDatabaseCapability({query:async()=>{n++;}},capability),DatabaseCapabilityError);
 assert.equal(n,0);
});
test('connection and role swaps are rejected at the final check',()=>{
 assert.throws(()=>validateDatabaseCapability([{...safe,current_role:'garden_research',login_role:'other'}],'garden_research',{activeRole:true,login:'runtime_login'}),DatabaseCapabilityError);
 assert.throws(()=>validateDatabaseCapability([safe],'garden_research',{activeRole:true,login:'runtime_login'}),DatabaseCapabilityError);
});
test('probe is parameterized and examines unknown roles, inheritance and object ownership',async()=>{
 let seen;await assertDatabaseCapability({query:async(sql,args)=>{seen={sql,args};return{rows:[safe]};}},'garden_research');
 assert.deepEqual(seen.args,['garden_research']);assert.equal(seen.sql,DATABASE_CAPABILITY_QUERY);
 assert.match(seen.sql,/FROM pg_roles other/);assert.match(seen.sql,/'SET'/);assert.match(seen.sql,/'USAGE'/);assert.match(seen.sql,/pg_namespace/);assert.match(seen.sql,/pg_proc/);
 assert.doesNotMatch(seen.sql,/unnest\(ARRAY\[/);
});
test('probe outages never leak SQL diagnostics',async()=>{
 await assert.rejects(()=>assertDatabaseCapability({query:async()=>{throw Error('PRIVATE-DB-CANARY');}},'garden_research'),e=>e instanceof DatabaseCapabilityError&&!e.message.includes('CANARY'));
});
