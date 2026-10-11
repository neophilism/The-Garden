import {allowSyntheticResearchUse} from '../access/consent-test-fixture.mjs';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor,PolicyError} from '../access/policy-context.mjs';
import {createSourceRepository} from './source-repository.mjs';
import {createLocatorRepository} from './locator-repository.mjs';
import {createClaimRepository} from './claim-repository.mjs';
import {evidenceForClaim} from '../../../packages/domain/src/historical/claims.mjs';
if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Claim fixtures require ephemeral CI');
const admin=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:2});
const pools=[],checks=[],check=name=>checks.push({name,result:'pass'}),W=randomUUID(),policy='c'.repeat(64),headers=who=>new Headers({'synthetic-subject':who});
let issuerPool,queryPool;
try{
 for(const[name,cap]of[['garden_claim_issuer_ci','garden_context_issuer'],['garden_claim_query_ci','garden_research']]){
  const password=randomBytes(32).toString('hex');
  await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE, SET TRUE`);
  const pool=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:name,password,max:3});pools.push(pool);if(cap==='garden_context_issuer')issuerPool=pool;else queryPool=pool;
 }
 const executor=createPolicyExecutor({identity:{viewer:async h=>({id:h.get('synthetic-subject'),verified:true})},issuerPool,researchPool:queryPool});
 const sources=createSourceRepository(executor),locators=createLocatorRepository(executor),claims=createClaimRepository(executor);
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[W,'Synthetic claim workspace',policy]);
 for(const who of['alice','bob']){
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,who,policy]);
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,'researcher','alice',clock_timestamp()+interval '30 days')",[W,who]);
 }
 async function empty(){const id=randomUUID();await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'alice','research','active')",[id,W]);await allowSyntheticResearchUse(admin,W,id);await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'alice',true,true,'research',clock_timestamp()+interval '30 days')",[W,id]);return id;}
 const witness={recordType:'source',schemaVersion:1,id:await empty(),title:null,form:'witness',archivalItemId:null,derivedFrom:[],assertions:[],representation:null};await sources.initialize(headers('alice'),W,witness.id,'1',witness);
 const scan={...witness,id:await empty(),form:'digital-representation',derivedFrom:[witness.id],representation:{sha256:'d'.repeat(64),mediaType:'text/plain',byteLength:20,originalFilename:'synthetic.txt'}};await sources.initialize(headers('alice'),W,scan.id,'1',scan);
 const anchor={recordType:'locator',schemaVersion:1,id:await empty(),source:{id:scan.id,revision:'2'},resourceSha256:'d'.repeat(64),originalIdentifiers:[],page:null,selector:{type:'whole'},description:'Synthetic whole-resource attribution'};await locators.initialize(headers('alice'),W,anchor.id,'1',anchor);
 const makeClaim=async type=>({recordType:'claim',schemaVersion:1,id:await empty(),assertionType:type,proposition:{subject:'Synthetic vessel',predicate:'arrived-at',object:'Synthetic port'},wording:'A synthetic statement, not historical evidence.',attribution:type==='source-testimony'?{locatorId:anchor.id,agentLabel:null}:null,notes:null});
 const testimony=await makeClaim('source-testimony'),interpretation=await makeClaim('historical-interpretation'),policyClaim=await makeClaim('policy-statement');
 for(const v of[testimony,interpretation,policyClaim])await claims.initialize(headers('alice'),W,v.id,'1',v);
 assert.equal((await claims.read(headers('alice'),W,testimony.id)).record.assertionType,'source-testimony');check('separate testimony, historical interpretation and policy assertions persist without truth promotion');
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(jsonb_set(payload,'{assertionType}','\"historical-interpretation\"'),'{attribution}','null') WHERE id=$1",[testimony.id])),PolicyError);check('database blocks relabeling testimony as an interpretation');
 const links=[];for(const relation of['supports','contradicts']){const v={recordType:'evidence-link',schemaVersion:1,id:await empty(),claim:{id:interpretation.id,revision:'2'},locatorId:anchor.id,relation,rationale:'Synthetic competing evaluation'};await claims.initialize(headers('alice'),W,v.id,'1',v);links.push(v);}
 const evaluated=evidenceForClaim(interpretation,'2',links);assert.equal(evaluated.groups.contradicts.length,1);assert.equal(evaluated.conclusion,'not-computed');check('opposing evidence edges coexist for an exact claim revision');
 const place=async(r,kind='webpage',v='2')=>{const p={recordType:'claim-placement',schemaVersion:1,id:await empty(),target:{kind,identifier:'urn:garden:synthetic:'+randomUUID(),version:'draft-1',language:null},dependencies:[{id:r.id,revision:v}]};await claims.initialize(headers('alice'),W,p.id,'1',p);return p;};
 const page=await place(interpretation),book=await place(links[0],'book'),translation=await place(page,'translation');
 let report=await claims.affectedPlacements(headers('alice'),W,[interpretation.id]);assert.deepEqual(report.placements.map(r=>r.record.id).sort(),[page.id,book.id,translation.id].sort());check('one-snapshot recursive correction closure finds direct, evidence-mediated and transitive placements');
 report=await claims.affectedPlacements(headers('alice'),W,[witness.id]);assert.equal(report.placements.length,3);assert(report.affectedClaimIds.includes(interpretation.id));check('source corrections reach evaluations and placements of interpreted claims');
 const newer={...interpretation,wording:'An explicitly corrected synthetic interpretation.'};await claims.revise(headers('alice'),W,interpretation.id,'2',newer);const chart=await place(newer,'chart','3');
 assert.equal((await claims.read(headers('alice'),W,links[0].id)).record.claim.revision,'2');assert.equal((await claims.history(headers('alice'),W,interpretation.id)).versions[1].record.wording,interpretation.wording);check('claim edits retain prior versions and never silently retarget evidence');
 assert.equal((await claims.affectedPlacements(headers('alice'),W,[interpretation.id])).placements.length,4);check('all placed versions remain in correction impact');
 const changed=await Promise.allSettled(['one','two'].map(value=>claims.revise(headers('alice'),W,interpretation.id,'3',{...newer,notes:value})));assert.equal(changed.filter(r=>r.status==='fulfilled').length,1);check('concurrent stale revisions allow exactly one successful edit');
 await assert.rejects(()=>claims.revise(headers('alice'),W,interpretation.id,'2',newer),PolicyError);check('stale optimistic revision is denied');
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{relation}','\"contextualizes\"') WHERE id=$1",[links[0].id])),PolicyError);
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{target,version}','\"changed\"') WHERE id=$1",[page.id])),PolicyError);check('raw SQL cannot rewrite evidence edges or artifact placements');
 const badId=await empty(),bad={...links[0],id:badId,claim:{id:interpretation.id,revision:'99'}};await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query('UPDATE garden_private.record_envelopes SET payload=$2::jsonb WHERE id=$1',[badId,JSON.stringify(bad)])),PolicyError);check('database independently rejects nonexistent referenced revisions');
 const malformedId=await empty(),malformed={...interpretation,id:malformedId,proposition:{...interpretation.proposition,predicate:['arrived-at','departed-from']}};await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query('UPDATE garden_private.record_envelopes SET payload=$2::jsonb WHERE id=$1',[malformedId,JSON.stringify(malformed)])),PolicyError);check('raw SQL rejects a multi-predicate array disguised as one structured claim');
 await assert.rejects(()=>claims.read(headers('bob'),W,page.id),PolicyError);await assert.rejects(()=>claims.affectedPlacements(headers('bob'),W,[interpretation.id]),PolicyError);check('membership alone grants neither claims nor correction discovery');
 await admin.query('UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE record_id=$1',[witness.id]);
 for(const id of[testimony.id,links[0].id,book.id])await assert.rejects(()=>claims.read(headers('alice'),W,id),PolicyError);
 await assert.rejects(()=>claims.affectedPlacements(headers('alice'),W,[interpretation.id]),PolicyError);check('ancestor source revocation closes indirect evidence and correction reads');
 await admin.query('UPDATE garden_control.record_grants SET revoked_at=NULL WHERE record_id=$1',[witness.id]);
 await admin.query('UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE record_id=$1',[translation.id]);
 report=await claims.affectedPlacements(headers('alice'),W,[interpretation.id]);assert.equal(report.placements.length,3);assert.equal(report.globalCompleteness,'not-established');assert(!JSON.stringify(report).includes(translation.id));check('hidden placement identifiers are not disclosed or described as globally absent');
 await assert.rejects(()=>claims.affectedPlacements(headers('alice'),W,[interpretation.id],{maxRecords:2}));check('bounded correction report fails rather than giving a misleading partial result');
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets')).rows[0].n,0);check('policy tickets retire after successful and failed claim operations');
 await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/claims.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,synthetic_only:true,production_verified:false,checks},null,2)+'\n');console.log('PASS: '+checks.length+' real PostgreSQL claim checks');
}finally{for(const p of pools)await p.end();await admin.end();}
