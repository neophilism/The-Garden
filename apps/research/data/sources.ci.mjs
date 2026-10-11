import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor,PolicyError} from '../access/policy-context.mjs';
import {createSourceRepository} from './source-repository.mjs';
if(process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.CI!=='true'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Source fixture requires ephemeral CI');
const admin=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:2});
const pools=[],checks=[],check=name=>checks.push({name,result:'pass'}),W=randomUUID(),policy='a'.repeat(64),headers=subject=>new Headers({'synthetic-subject':subject});
const unit=(id,level='repository',parentId=null)=>({recordType:'archival-unit',schemaVersion:1,id,title:null,level,parentId,assertions:[],notes:null});
const source=(id,form='witness',derivedFrom=[])=>({recordType:'source',schemaVersion:1,id,title:null,form,archivalItemId:null,derivedFrom,assertions:[],representation:form==='digital-representation'?{sha256:'a'.repeat(64),mediaType:'image/tiff',byteLength:128,originalFilename:null}:null});
const assertion=value=>({id:randomUUID(),field:'date',value,provenance:[{sourceId:randomUUID(),locator:'Synthetic catalog date field'}],supersedes:null});
let issuerPool,queryPool;
try {
 for(const [name,cap] of [['garden_source_issuer_ci','garden_context_issuer'],['garden_source_query_ci','garden_research']]){
  const password=randomBytes(32).toString('hex');
  await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE, SET TRUE`);
  const pool=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:name,password,max:2});pools.push(pool);if(cap==='garden_context_issuer')issuerPool=pool;else queryPool=pool;
 }
 const executor=createPolicyExecutor({identity:{viewer:async h=>({id:h.get('synthetic-subject'),verified:true})},issuerPool,researchPool:queryPool});
 const repo=createSourceRepository(executor);
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[W,'Synthetic archival fixture',policy]);
 for(const s of ['alice','bob']){
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,s,policy]);
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,'researcher','alice',clock_timestamp()+interval '30 days')",[W,s]);
 }
 async function empty(){const id=randomUUID();await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'alice','research','active')",[id,W]);await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'alice',true,true,'research',clock_timestamp()+interval '30 days')",[W,id]);return id;}
 async function create(value){return repo.initialize(headers('alice'),W,value.id,'1',value);}
 const repository=await create(unit(await empty()));
 const collection=await create(unit(await empty(),'collection',repository.record.id));
 const series=await create(unit(await empty(),'series',collection.record.id));
 const item=await create(unit(await empty(),'item',series.record.id));
 const w={...source(await empty()),archivalItemId:item.record.id,assertions:[assertion('1740?'),assertion('1743')]};
 const witness=await create(w);
 const edition=await create(source(await empty(),'edition',[w.id]));
 const scan=await create(source(await empty(),'digital-representation',[edition.record.id]));
 const secondScan=await create(source(await empty(),'digital-representation',[edition.record.id]));
 assert.deepEqual((await repo.read(headers('alice'),W,scan.record.id)).record,scan.record);check('real archived witness edition and representation chain roundtrips');
 assert.deepEqual((await repo.read(headers('alice'),W,w.id)).record.assertions,w.assertions);check('conflicting catalog dates preserved without choosing a false canonical date');
 const lineage=await repo.compareLineages(headers('alice'),W,[scan.record.id,secondScan.record.id]);
 assert.equal(lineage.sharedLineages.length,1);assert.deepEqual(lineage.sharedLineages[0].sharedRoots,[w.id]);assert.equal(lineage.independentEvidenceCount,null);check('two derivatives retain one known source root without an independence claim');
 await executor.run(headers('alice'),{workspaceId:W},async c=>{
  assert.equal((await c.query('SELECT * FROM garden_private.archival_units WHERE workspace_id=$1',[W])).rowCount,4);
  assert.equal((await c.query('SELECT * FROM garden_private.sources WHERE workspace_id=$1',[W])).rowCount,4);
  assert.equal((await c.query('SELECT * FROM garden_private.witnesses WHERE workspace_id=$1',[W])).rowCount,1);
  assert.equal((await c.query('SELECT * FROM garden_private.source_derivations WHERE workspace_id=$1',[W])).rowCount,3);
 });check('source and archival projections retain explicit source-form counts');
 await assert.rejects(()=>repo.read(headers('bob'),W,scan.record.id),PolicyError);check('ungranted source and lineage are inaccessible');
 const revised={...w,assertions:[...w.assertions,assertion('additional catalog reports 1744')]};
 const w3=await repo.revise(headers('alice'),W,w.id,witness.revision,revised);
 await assert.rejects(()=>repo.revise(headers('alice'),W,w.id,witness.revision,revised),PolicyError);check('source optimistic revisions reject stale edits');
 await assert.rejects(()=>repo.revise(headers('alice'),W,w.id,w3.revision,w),PolicyError);check('catalog statements cannot be silently removed');
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{assertions}','[]') WHERE id=$1",[w.id])),PolicyError);check('database independently rejects catalog erasure');
 const history=await repo.history(headers('alice'),W,w.id,{limit:2});assert.equal(history.versions.length,2);assert.equal(history.versions[1].record.assertions.length,2);assert.equal(history.nextBeforeRevision,'2');check('versioned catalog history retains former exact statements and pagination');
 await admin.query("UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE record_id=$1",[w.id]);
 await assert.rejects(()=>repo.read(headers('alice'),W,scan.record.id),PolicyError);
 await assert.rejects(()=>repo.compareLineages(headers('alice'),W,[scan.record.id,secondScan.record.id]),PolicyError);check('revoked root cannot leak through derived source or lineage result');
 await admin.query('UPDATE garden_control.record_grants SET revoked_at=NULL WHERE record_id=$1',[w.id]);
 const cycle={...collection.record,parentId:series.record.id};
 await assert.rejects(()=>repo.revise(headers('alice'),W,collection.record.id,collection.revision,cycle),PolicyError);check('application hierarchy cycles rejected');
 const a=await create(unit(await empty(),'series')),b=await create(unit(await empty(),'series'));
 const rawParent=(from,to)=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{parentId}',to_jsonb($2::text)) WHERE id=$1",[from,to]));
 const outcomes=await Promise.allSettled([rawParent(a.record.id,b.record.id),rawParent(b.record.id,a.record.id)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);check('concurrent raw PostgreSQL graph writes cannot establish opposite-parent cycles');
 const linked=(await repo.read(headers('alice'),W,a.record.id)).record.parentId?a:b;
 const free=linked.record.id===a.record.id?b:a;
 await assert.rejects(()=>rawParent(free.record.id,linked.record.id),PolicyError);check('database rejects a sequential closing cycle without relying on application validation');
 const unknownEdition=await create(source(await empty(),'edition'));
 const unknownLineage=await repo.compareLineages(headers('alice'),W,[unknownEdition.record.id]);
 assert.deepEqual(unknownLineage.sources[0].unresolvedRoots,[unknownEdition.record.id]);check('unknown edition provenance remains explicitly unresolved');
 const bad=source(await empty(),'edition',[randomUUID()]);await assert.rejects(()=>create(bad),PolicyError);check('dangling source reference rejects atomically');
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{derivedFrom}',jsonb_build_array($2::text)) WHERE id=$1",[edition.record.id,scan.record.id])),PolicyError);check('database rejects edition to own digitization cycles');
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{form}','\"witness\"') WHERE id=$1",[edition.record.id])),PolicyError);check('database cannot reclassify an edition as a new witness');
 await admin.query("UPDATE garden_control.access_members SET state='revoked' WHERE workspace_id=$1 AND subject_id='alice'",[W]);
 await assert.rejects(()=>repo.history(headers('alice'),W,w.id),PolicyError);check('membership revocation also protects historical versions');
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets')).rows[0].n,0);check('all source tickets retired after successes and failures');
 await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/sources.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,synthetic_only:true,production_verified:false,checks},null,2)+'\n');
 console.log('PASS: '+checks.length+' real PostgreSQL source checks');
}finally{for(const p of pools)await p.end();await admin.end();}
