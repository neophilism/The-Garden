import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClaimRepository} from '../../apps/research/data/claim-repository.mjs';
import {PolicyError} from '../../apps/research/access/policy-context.mjs';
const W=randomUUID();
function setup(){
 const witness={recordType:'source',schemaVersion:1,id:randomUUID(),title:null,form:'witness',archivalItemId:null,derivedFrom:[],assertions:[],representation:null};
 const source={...witness,id:randomUUID(),form:'digital-representation',derivedFrom:[witness.id],representation:{sha256:'a'.repeat(64),mediaType:'text/plain',byteLength:10,originalFilename:null}};
 const locator={recordType:'locator',schemaVersion:1,id:randomUUID(),source:{id:source.id,revision:'2'},resourceSha256:'a'.repeat(64),originalIdentifiers:[],page:null,selector:{type:'whole'},description:null};
 const claim={recordType:'claim',schemaVersion:1,id:randomUUID(),assertionType:'source-testimony',proposition:{subject:'Fixture',predicate:'names',object:'Fixture person'},wording:'Synthetic attribution only.',attribution:{locatorId:locator.id,agentLabel:null},notes:null};
 const edge={recordType:'evidence-link',schemaVersion:1,id:randomUUID(),claim:{id:claim.id,revision:'2'},locatorId:locator.id,relation:'contradicts',rationale:'Synthetic disagreement.'};
 const placement={recordType:'claim-placement',schemaVersion:1,id:randomUUID(),target:{kind:'book',identifier:'urn:garden:fixture',version:'v1',language:null},dependencies:[{id:edge.id,revision:'2'}]};
 const values=[witness,source,locator,claim,edge,placement],hidden=new Set(),scopes=[],queries=[];
 const executor={async run(h,scope,fn){scopes.push(scope);return fn({async query(sql,args){queries.push([sql,args]);assert.equal(args[0],W);const v=values.find(v=>v.id===args[1]);if(!v||hidden.has(v.id))return {rows:[]};if(sql.includes('version=$3::bigint')&&args[2]!=='2')return {rows:[]};return {rows:[{payload:v,version:'2',changed_at:'synthetic'}]};}});}};
 return {repo:createClaimRepository(executor),hidden,scopes,queries,witness,source,locator,claim,edge,placement};
}
for(const name of['claim','edge','placement']){
 test('authorized '+name+' read follows exact source attribution',async()=>{const s=setup();assert.deepEqual((await s.repo.read(new Headers(),W,s[name].id)).record,s[name]);assert.deepEqual(s.scopes,[{workspaceId:W}]);assert(s.queries.some(([q,args])=>q.includes('record_revisions')&&args[1]===s.source.id&&args[2]==='2'));});
 test(name+' cannot expose a hidden original witness',async()=>{const s=setup();s.hidden.add(s.witness.id);await assert.rejects(()=>s.repo.read(new Headers(),W,s[name].id),PolicyError);});
 test(name+' cannot expose an ungranted locator',async()=>{const s=setup();s.hidden.add(s.locator.id);await assert.rejects(()=>s.repo.read(new Headers(),W,s[name].id),PolicyError);});
}
test('a missing claim revision never falls back to current',async()=>{const s=setup();s.edge.claim.revision='99';await assert.rejects(()=>s.repo.read(new Headers(),W,s.edge.id),PolicyError);});
test('source hash substitution fails even when identifiers match',async()=>{const s=setup();s.source.representation.sha256='b'.repeat(64);await assert.rejects(()=>s.repo.read(new Headers(),W,s.claim.id),PolicyError);});
test('source revisions used as placement dependencies are rejected',async()=>{const s=setup();s.placement.dependencies=[{id:s.source.id,revision:'2'}];await assert.rejects(()=>s.repo.read(new Headers(),W,s.placement.id));});
test('a cyclic placement dependency fails closed',async()=>{const s=setup();s.placement.dependencies=[{id:s.placement.id,revision:'2'}];await assert.rejects(()=>s.repo.read(new Headers(),W,s.placement.id));});
test('history reauthorizes indirect evidence before returning old text',async()=>{const s=setup();s.hidden.add(s.witness.id);await assert.rejects(()=>s.repo.history(new Headers(),W,s.claim.id),PolicyError);});
test('stale writes are rejected before persistence',async()=>{const s=setup();await assert.rejects(()=>s.repo.revise(new Headers(),W,s.claim.id,'1',s.claim),PolicyError);assert(!s.queries.some(([q])=>q.startsWith('UPDATE')));});
