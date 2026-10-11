import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHistoricalRepository} from '../../apps/research/data/historical-repository.mjs';
import {entity,relationship} from './fixtures.mjs';
import {PolicyError} from '../../apps/research/access/policy-context.mjs';
const W='11111111-1111-4111-8111-111111111111';
const R='22222222-2222-4222-8222-222222222222';
const A='33333333-3333-4333-8333-333333333333';
const B='44444444-4444-4444-8444-444444444444';
function setup(hidden=false) {
 const record={...relationship(),id:R,fromId:A,toId:B};
 const rows=new Map([[R,record],[A,entity('voyage',A)],[B,entity('port',B)]]);
 const scopes=[];
 const executor={async run(headers,scope,fn){scopes.push(scope);return fn({async query(sql,params){
  assert.equal(params[0],W);
  if(sql.includes('record_revisions'))return {rows:[{version:'2',payload:record,changed_at:'fixture'}]};
  if(hidden&&params[1]===B||scope.recordId&&scope.recordId!==params[1]||!rows.has(params[1]))return {rows:[]};
  return {rows:[{id:params[1],workspace_id:W,version:'2',payload:rows.get(params[1])}]};
 }});}};
 return {repo:createHistoricalRepository(executor),scopes};
}
for(const method of ['read','history']) {
 test(method+' can inspect both currently authorized endpoints in its workspace',async()=>{
  const {repo,scopes}=setup();const result=await repo[method](new Headers(),W,R);
  assert(result);assert.deepEqual(scopes,[{workspaceId:W}]);
 });
 test(method+' denies a relationship when an endpoint is not currently granted',async()=>{
  const {repo}=setup(true);await assert.rejects(()=>repo[method](new Headers(),W,R),PolicyError);
 });
}
