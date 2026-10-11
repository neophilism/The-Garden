import {allowSyntheticResearchUse} from '../access/consent-test-fixture.mjs';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor,PolicyError} from '../access/policy-context.mjs';
import {createSourceRepository} from './source-repository.mjs';
import {createLocatorRepository} from './locator-repository.mjs';
import {sha256,resolveLocator,proposeReanchor,TEXT_PROFILE} from '../../../packages/domain/src/historical/locators.mjs';
if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Locator fixtures require ephemeral CI');
const admin=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:2});
const pools=[],checks=[],check=name=>checks.push({name,result:'pass'}),W=randomUUID(),policy='b'.repeat(64),headers=who=>new Headers({'synthetic-subject':who});
let issuerPool,queryPool;
const witness=id=>({recordType:'source',schemaVersion:1,id,title:null,form:'witness',archivalItemId:null,derivedFrom:[],assertions:[],representation:null});
try {
  for(const [name,cap] of [['garden_locator_issuer_ci','garden_context_issuer'],['garden_locator_query_ci','garden_research']]) {
    const password=randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
    await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE, SET TRUE`);
    const pool=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:name,password,max:2});pools.push(pool);
    if(cap==='garden_context_issuer')issuerPool=pool;else queryPool=pool;
  }
  const executor=createPolicyExecutor({identity:{viewer:async h=>({id:h.get('synthetic-subject'),verified:true})},issuerPool,researchPool:queryPool});
  const sources=createSourceRepository(executor),locators=createLocatorRepository(executor);
  await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[W,'Synthetic locator workspace',policy]);
  for(const who of ['alice','bob']) {
    await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,who,policy]);
    await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,'researcher','alice',clock_timestamp()+interval '30 days')",[W,who]);
  }
  async function empty() {
    const id=randomUUID();await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'alice','research','active')",[id,W]);await allowSyntheticResearchUse(admin,W,id);
    await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'alice',true,true,'research',clock_timestamp()+interval '30 days')",[W,id]);return id;
  }
  const origin=witness(await empty());await sources.initialize(headers('alice'),W,origin.id,'1',origin);
  const bytes=new TextEncoder().encode('A\u{1f33f} archival transcription'),digest=await sha256(bytes),source={...witness(await empty()),form:'digital-representation',derivedFrom:[origin.id],representation:{sha256:digest,mediaType:'text/plain',byteLength:bytes.length,originalFilename:'fixture.txt'}};
  const saved=await sources.initialize(headers('alice'),W,source.id,'1',source);
  const page={ordinal:2,label:'iv',canvasId:'urn:garden:synthetic:iv'};
  const v={recordType:'locator',schemaVersion:1,id:await empty(),source:{id:source.id,revision:saved.revision},resourceSha256:digest,originalIdentifiers:[{namespace:'fixture',identifier:'folio iv'}],page,selector:{type:'text',profile:TEXT_PROFILE,textSha256:digest,position:{start:0,end:2},quote:{exact:'A\u{1f33f}',prefix:'',suffix:' '}},description:null};
  const anchor=await locators.initialize(headers('alice'),W,v.id,'1',v);
  assert.deepEqual((await locators.read(headers('alice'),W,v.id)).record,v);check('locator retains exact source revision, original folio label and code-point positions in PostgreSQL');
  const view={source:v.source,bytes,page,text:new TextDecoder().decode(bytes),textProfile:TEXT_PROFILE};
  assert.equal((await resolveLocator(v,view)).status,'resolved');assert.equal((await resolveLocator(v,{...view,page:{...page,label:'3'}})).status,'orphaned');check('retrieved locator resolves exact text but refuses a misleading page number');
  await assert.rejects(()=>locators.read(headers('bob'),W,v.id),PolicyError);check('another member cannot read an ungranted locator');
  await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{description}','\"silently changed\"') WHERE id=$1",[v.id])),PolicyError);check('SQL independently preserves locator payload immutability');
  const bad={...v,id:await empty(),resourceSha256:'0'.repeat(64)};await assert.rejects(()=>locators.initialize(headers('alice'),W,bad.id,'1',bad),PolicyError);check('declared resource hash must match the exact stored representation revision');
  const wrongVersion={...v,id:await empty(),source:{id:source.id,revision:'99'}};await assert.rejects(()=>locators.initialize(headers('alice'),W,wrongVersion.id,'1',wrongVersion),PolicyError);check('missing witness version is not resolved against latest');
  const malformedId=await empty(),malformed={...v,id:malformedId,selector:{...v.selector,position:{start:5,end:2}}};
  await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query('UPDATE garden_private.record_envelopes SET payload=$2::jsonb WHERE id=$1',[malformedId,JSON.stringify(malformed)])),PolicyError);check('database independently rejects invalid selector intervals');
  const newBytes=new TextEncoder().encode('New '+view.text),newDigest=await sha256(newBytes);
  const updated=await sources.revise(headers('alice'),W,source.id,saved.revision,{...source,representation:{...source.representation,sha256:newDigest,byteLength:newBytes.length}});
  assert.equal((await locators.read(headers('alice'),W,v.id)).record.source.revision,'2');check('a changed current representation leaves the original pinned revision available');
  const newView={...view,source:{id:source.id,revision:updated.revision},bytes:newBytes,text:new TextDecoder().decode(newBytes)};
  assert.equal((await resolveLocator(v,newView)).reason,'source-version-mismatch');
  const proposal=await proposeReanchor(v,newView);assert.equal(proposal.status,'proposed');assert.equal(proposal.adopted,false);check('reanchoring changed text is an explicit unadopted proposal');
  const newLocator={...v,id:await empty(),source:newView.source,resourceSha256:newDigest,selector:{...v.selector,textSha256:newDigest,position:proposal.position}};
  await locators.initialize(headers('alice'),W,newLocator.id,'1',newLocator);
  const decision={recordType:'locator-reanchor',schemaVersion:1,id:await empty(),fromLocatorId:v.id,toLocatorId:newLocator.id,reason:'Synthetic proposal to inspect a revised transcription',decision:'proposed'};
  await locators.initialize(headers('alice'),W,decision.id,'1',decision);assert.deepEqual((await locators.read(headers('alice'),W,decision.id)).record,decision);check('old and proposed locator coexist with a separate immutable proposal');
  await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{decision}','\"approved\"') WHERE id=$1",[decision.id])),PolicyError);check('proposal record cannot masquerade as publication approval');
  const imageSource={...source,id:await empty(),representation:{...source.representation,mediaType:'image/png'}};
  await sources.initialize(headers('alice'),W,imageSource.id,'1',imageSource);
  const image={...v,id:await empty(),source:{id:imageSource.id,revision:'2'},selector:{type:'image',unit:'pixel',x:1,y:2,width:10,height:20,canvasWidth:100,canvasHeight:100}};
  await locators.initialize(headers('alice'),W,image.id,'1',image);check('bounded image selector persists without converting printed page labels');
  const audioSource={...source,id:await empty(),representation:{...source.representation,mediaType:'audio/ogg'}};
  await sources.initialize(headers('alice'),W,audioSource.id,'1',audioSource);
  const time={...v,id:await empty(),source:{id:audioSource.id,revision:'2'},page:null,selector:{type:'time',startMs:1,endMs:999,durationMs:2000}};
  await locators.initialize(headers('alice'),W,time.id,'1',time);check('exact half-open millisecond interval persists');
  const notAudio={...time,id:await empty(),source:v.source};await assert.rejects(()=>locators.initialize(headers('alice'),W,notAudio.id,'1',notAudio),PolicyError);check('time selector cannot be attached to declared text-only media');
  await admin.query('UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE record_id=$1',[source.id]);
  await assert.rejects(()=>locators.read(headers('alice'),W,v.id),PolicyError);await assert.rejects(()=>locators.read(headers('alice'),W,decision.id),PolicyError);check('current source revocation protects both locator and reanchor reads');
  await admin.query('UPDATE garden_control.record_grants SET revoked_at=NULL WHERE record_id=$1',[source.id]);
  await admin.query('UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE record_id=$1',[origin.id]);
  await assert.rejects(()=>locators.read(headers('alice'),W,v.id),PolicyError);check('hidden original witness cannot leak through a permitted scan locator');
  await admin.query('UPDATE garden_control.record_grants SET revoked_at=NULL WHERE record_id=$1',[origin.id]);
  await executor.run(headers('alice'),{workspaceId:W},async c=>assert.equal((await c.query('SELECT count(*)::int AS n FROM garden_private.locators WHERE workspace_id=$1',[W])).rows[0].n,4));check('permission-filtered locator view retains all immutable anchors');
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets')).rows[0].n,0);check('all locator policy tickets retire after successes and failures');
  await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/locators.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,synthetic_only:true,production_verified:false,checks},null,2)+'\n');
  console.log('PASS: '+checks.length+' real PostgreSQL locator checks');
} finally { for(const p of pools)await p.end();await admin.end(); }
