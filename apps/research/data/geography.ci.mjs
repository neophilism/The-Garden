import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor,PolicyError} from '../access/policy-context.mjs';
import {allowSyntheticResearchUse} from '../access/consent-test-fixture.mjs';
import {createHistoricalRepository} from './historical-repository.mjs';
import {createSourceRepository} from './source-repository.mjs';
import {createLocatorRepository} from './locator-repository.mjs';
import {createClaimRepository} from './claim-repository.mjs';
import {createGeographyRepository} from './geography-repository.mjs';
import {createReviewRepository} from '../review/repository.mjs';
import {entity} from '../../../tests/data/fixtures.mjs';
import {geographic,square} from '../../../tests/data/geography-fixtures.mjs';
import {researchGeographyLayer} from '../../../packages/domain/src/historical/geography.mjs';
import {exerciseNumericHistory} from '../../../tests/data/history-pagination.ci-fixture.mjs';
if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Geographic fixtures require ephemeral CI');
const admin=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:2});
const pools=[],checks=[],check=name=>checks.push({name,result:'pass'}),W=randomUUID(),policy='e'.repeat(64),headers=who=>new Headers({'synthetic-subject':who});
let issuerPool,researchPool;
try{
 for(const[name,cap]of[['garden_geo_issuer_ci','garden_context_issuer'],['garden_geo_query_ci','garden_research']]){
  const password=randomBytes(32).toString('hex');await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE, SET TRUE`);
  const pool=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:name,password,max:3});pools.push(pool);if(cap==='garden_context_issuer')issuerPool=pool;else researchPool=pool;
 }
 const executor=createPolicyExecutor({identity:{viewer:async h=>({id:h.get('synthetic-subject'),verified:true})},issuerPool,researchPool});
 const entities=createHistoricalRepository(executor),sources=createSourceRepository(executor),locators=createLocatorRepository(executor),claims=createClaimRepository(executor),geo=createGeographyRepository(executor),reviews=createReviewRepository(executor);
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[W,'Synthetic geography workspace',policy]);
 for(const who of ['alice','bob']){
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,who,policy]);
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,$3,'alice',clock_timestamp()+interval '30 days')",[W,who,who==='alice'?'editor':'researcher']);
 }
 async function empty(classification='research'){
  const id=randomUUID();await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'alice',$3,'active')",[id,W,classification]);
  await allowSyntheticResearchUse(admin,W,id);await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'alice',true,true,'research',clock_timestamp()+interval '30 days')",[W,id]);return id;
 }
 const place=entity('place',await empty());await entities.initialize(headers('alice'),W,place.id,'1',place);
 const witness={recordType:'source',schemaVersion:1,id:await empty(),title:null,form:'witness',archivalItemId:null,derivedFrom:[],assertions:[],representation:null};await sources.initialize(headers('alice'),W,witness.id,'1',witness);
 const scan={...witness,id:await empty(),form:'digital-representation',derivedFrom:[witness.id],representation:{sha256:'d'.repeat(64),mediaType:'text/plain',byteLength:20,originalFilename:'synthetic.txt'}};await sources.initialize(headers('alice'),W,scan.id,'1',scan);
 const locator={recordType:'locator',schemaVersion:1,id:await empty(),source:{id:scan.id,revision:'2'},resourceSha256:'d'.repeat(64),originalIdentifiers:[],page:null,selector:{type:'whole'},description:null};await locators.initialize(headers('alice'),W,locator.id,'1',locator);
 const claim={recordType:'claim',schemaVersion:1,id:await empty(),assertionType:'historical-interpretation',proposition:{subject:'Synthetic place',predicate:'located-at',object:'Synthetic coordinates'},wording:'Synthetic source describes a location.',attribution:null,notes:null};await claims.initialize(headers('alice'),W,claim.id,'1',claim);
 const evidence={recordType:'evidence-link',schemaVersion:1,id:await empty(),claim:{id:claim.id,revision:'2'},locatorId:locator.id,relation:'supports',rationale:'Synthetic geographic source evaluation.'};await claims.initialize(headers('alice'),W,evidence.id,'1',evidence);
 const v={...geographic(),id:await empty(),subject:{id:place.id,revision:'2',kind:'place'},claim:{id:claim.id,revision:'2'},evidence:[{id:evidence.id,revision:'2'}]};
 const first=await geo.initialize(headers('alice'),W,v.id,'1',v);assert.equal(first.revision,'2');assert.deepEqual((await geo.read(headers('alice'),W,v.id)).record,v);check('exact subject, claim and evidence revisions persist with sourced geometry and uncertainty');
 const competing={...structuredClone(v),id:await empty(),geometry:{type:'Polygon',coordinates:[square()]},uncertainty:{kind:'disputed',radiusMeters:null,description:'Synthetic competing polygon.'}};await geo.initialize(headers('alice'),W,competing.id,'1',competing);assert.equal(researchGeographyLayer([first,await geo.read(headers('alice'),W,competing.id)]).features.length,2);check('competing extents coexist without a winner or silent merge');
 const scope=await reviews.register(headers('alice'),W,v.id,'2');assert.equal((await reviews.snapshot(headers('alice'),W,scope)).scope.recordId,v.id);check('geographic records participate in exact-revision review scopes');
 const updated=await geo.revise(headers('alice'),W,v.id,'2',{...v,rationale:'An explicit revised synthetic rationale.'});assert.equal(updated.revision,'3');assert.equal((await reviews.snapshot(headers('alice'),W,scope)).currentRevision,'3');check('revision history preserves earlier geometry and makes old review visibly stale');
 const races=await Promise.allSettled(['one','two'].map(rationale=>geo.revise(headers('alice'),W,v.id,'3',{...updated.record,rationale})));assert.equal(races.filter(r=>r.status==='fulfilled').length,1);check('concurrent optimistic writes allow exactly one update');
 await exerciseNumericHistory(geo,headers('alice'),W,v.id);check('geographic history crosses 9/10 numerically and remains stable under concurrent append');
 await assert.rejects(()=>geo.read(headers('bob'),W,v.id),PolicyError);await assert.rejects(()=>geo.history(headers('bob'),W,v.id),PolicyError);check('ungranted researcher cannot read coordinates or historical revisions');
 await assert.rejects(()=>geo.read(headers('alice'),randomUUID(),v.id),PolicyError);check('cross-workspace coordinate read denied');
 for(const key of ['subject','claim','evidence']){
  const bad={...structuredClone(v),id:await empty()};if(key==='evidence')bad.evidence[0].revision='999';else bad[key].revision='999';
  await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query('UPDATE garden_private.record_envelopes SET payload=$2::jsonb WHERE id=$1',[bad.id,JSON.stringify(bad)])),PolicyError);
 }check('SQL independently rejects missing exact subject, claim and evidence versions');
 const sensitive={...structuredClone(v),id:await empty(),sensitivity:'sensitive-site'};
 await assert.rejects(()=>geo.initialize(headers('alice'),W,sensitive.id,'1',sensitive),PolicyError);
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query('UPDATE garden_private.record_envelopes SET payload=$2::jsonb WHERE id=$1',[sensitive.id,JSON.stringify(sensitive)])),PolicyError);check('sensitive locations cannot be laundered into research-classified records');
 sensitive.id=await empty('personal');await admin.query('UPDATE garden_private.record_envelopes SET payload=$2::jsonb WHERE id=$1',[sensitive.id,JSON.stringify(sensitive)]);
 await assert.rejects(()=>geo.read(headers('alice'),W,sensitive.id),PolicyError);assert.deepEqual(researchGeographyLayer([{record:sensitive,revision:'2'}]).features,[]);check('even a pregranted personal record and privileged snapshot cannot expose sensitive map coordinates');
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{context}','\"modern-reference\"') WHERE id=$1",[v.id])),PolicyError);check('historical assertion cannot be silently relabeled as a modern reference');
 const malformed={...structuredClone(v),id:await empty(),geometry:{type:'Point',coordinates:[999,999]}};
 await admin.query('UPDATE garden_private.record_envelopes SET payload=$2::jsonb WHERE id=$1',[malformed.id,JSON.stringify(malformed)]);
 await assert.rejects(()=>geo.read(headers('alice'),W,malformed.id));check('repository revalidates geometry after privileged raw storage and refuses malformed coordinates');
 for(const refId of [place.id,claim.id,evidence.id,locator.id,witness.id]){
  await admin.query('UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE record_id=$1',[refId]);
  await assert.rejects(()=>geo.read(headers('alice'),W,v.id));await assert.rejects(()=>geo.history(headers('alice'),W,v.id));
  await admin.query('UPDATE garden_control.record_grants SET revoked_at=NULL WHERE record_id=$1',[refId]);
 }check('current permissions rechecked for every referenced entity, claim, evaluation, locator and original-source ancestor');
 const visible=(await executor.run(headers('bob'),{workspaceId:W},c=>c.query('SELECT id FROM garden_private.geographic_assertions WHERE workspace_id=$1',[W]))).rows;assert.equal(visible.length,0);check('SQL invoker view preserves forced row security');
 assert.equal((await admin.query('SELECT count(*)::int n FROM garden_control.policy_tickets')).rows[0].n,0);check('tickets retire on successful and failed geography operations');
 await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/geography.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,synthetic_only:true,production_verified:false,postgis_used:false,checks},null,2)+'\n');console.log('PASS: '+checks.length+' real PostgreSQL geographic checks');
}finally{for(const p of pools)await p.end();await admin.end();}
