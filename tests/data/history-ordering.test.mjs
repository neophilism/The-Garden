import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHistoricalRepository} from '../../apps/research/data/historical-repository.mjs';
import {createSourceRepository} from '../../apps/research/data/source-repository.mjs';
import {createClaimRepository} from '../../apps/research/data/claim-repository.mjs';
import {entity} from './fixtures.mjs';
const W='11111111-1111-4111-8111-111111111111',ID='22222222-2222-4222-8222-222222222222';
const source={recordType:'source',schemaVersion:1,id:ID,title:null,form:'witness',archivalItemId:null,derivedFrom:[],assertions:[],representation:null};
const claim={recordType:'claim',schemaVersion:1,id:ID,assertionType:'historical-interpretation',proposition:{subject:'Synthetic',predicate:'has-name',object:'Test'},wording:'Synthetic fixture.',attribution:null,notes:null};
for(const [name,factory,value] of [['historical',createHistoricalRepository,entity('person',ID)],['source',createSourceRepository,source],['claim',createClaimRepository,claim]]){
 test(name+' history sorts the stored bigint, not its text projection',async()=>{
  let captured;
  const repo=factory({async run(_h,scope,fn){assert.deepEqual(scope,{workspaceId:W});return fn({async query(sql,args){if(sql.includes('record_revisions')){captured={sql,args};return {rows:[{version:'10',payload:value,changed_at:'synthetic'},{version:'9',payload:value,changed_at:'synthetic'},{version:'8',payload:value,changed_at:'synthetic'}]};}return {rows:[{id:ID,payload:value,version:'12'}]};}});}});
  const page=await repo.history(new Headers(),W,ID,{limit:2,beforeRevision:'11'});
  assert.match(captured.sql,/SELECT version::text/);
  assert.match(captured.sql,/record_revisions AS revisions/);
  assert.match(captured.sql,/ORDER BY revisions\.version DESC/);
  assert.match(captured.sql,/revisions\.version<\$3::bigint/);
  assert.deepEqual(captured.args,[W,ID,'11',3]);
  assert.deepEqual(page.versions.map(r=>r.revision),['10','9']);assert.equal(page.nextBeforeRevision,'9');
 });
 for(const bad of [0,1,'0','01','-1','1e1','latest','9223372036854775808'])test(name+' rejects inexact history cursor '+JSON.stringify(bad),async()=>{
  const repo=factory({async run(){assert.fail('invalid cursor must not reach storage');}});
  await assert.rejects(()=>repo.history(new Headers(),W,ID,{beforeRevision:bad}));
 });
 test(name+' has an executable multi-digit PostgreSQL regression fixture',()=>{
  const plural={historical:'historical',source:'sources',claim:'claims'}[name];
  assert.match(readFileSync(new URL('../../apps/research/data/'+plural+'.ci.mjs',import.meta.url),'utf8'),/await exerciseNumericHistory\(/);
 });
}
