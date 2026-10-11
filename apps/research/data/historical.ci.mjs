import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor,PolicyError} from '../access/policy-context.mjs';
import {createHistoricalRepository} from './historical-repository.mjs';
import {entity,named,relationship,evidence} from '../../../tests/data/fixtures.mjs';
if(process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.CI!=='true'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Historical fixture requires ephemeral CI');
const admin=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:2});
const pools=[],checks=[],check=name=>checks.push({name,result:'pass'}),W=randomUUID(),policy='a'.repeat(64),headers=subject=>new Headers({'synthetic-subject':subject});
let issuerPool,queryPool;
try {
 for(const [name,cap] of [['garden_data_issuer_ci','garden_context_issuer'],['garden_data_query_ci','garden_research']]){
  const password=randomBytes(32).toString('hex');
  await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE, SET TRUE`);
  const pool=new pg.Pool({host:'127.0.0.1',port:5432,database:'neondb',user:name,password,max:2});pools.push(pool);
  if(cap==='garden_context_issuer')issuerPool=pool;else queryPool=pool;
 }
 const identity={viewer:async h=>({id:h.get('synthetic-subject'),verified:true})};
 const executor=createPolicyExecutor({identity,issuerPool,researchPool:queryPool}),repo=createHistoricalRepository(executor);
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[W,'Synthetic historical fixtures',policy]);
 for(const s of ['alice','bob']){
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,s,policy]);
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,'researcher','alice',clock_timestamp()+interval '30 days')",[W,s]);
 }
 const ids={};
 for(const label of ['a','b','c','language','port','voyage','relation','hidden']){
  ids[label]=randomUUID();
  await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'alice','research','active')",[ids[label],W]);
  for(const s of label==='hidden'?['bob']:label==='a'?['alice','bob']:['alice'])await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,$3,true,true,'research',clock_timestamp()+interval '30 days')",[W,ids[label],s]);
 }
 const original=named();original.id=ids.a;original.title='Same name';
 const a=await repo.initialize(headers('alice'),W,ids.a,'1',original);
 const other=named();other.id=ids.b;other.title='Same name';
 const b=await repo.initialize(headers('alice'),W,ids.b,'1',other);
 await repo.initialize(headers('alice'),W,ids.c,'1',entity('person',ids.c));
 for(const k of ['language','port','voyage'])await repo.initialize(headers('alice'),W,ids[k],'1',entity(k,ids[k]));
 assert.equal(a.revision,'2');assert.deepEqual((await repo.read(headers('alice'),W,ids.a)).record,original);check('real PostgreSQL entity roundtrip preserves identity, Unicode and uncertainty');
 assert.equal((await repo.read(headers('alice'),W,ids.b)).record.redirect,null);check('same-name records remain separate');
 await assert.rejects(()=>repo.read(headers('alice'),W,ids.hidden),PolicyError);check('ungranted envelope and its history stay hidden');
 await executor.run(headers('alice'),{workspaceId:W},async c=>{
  const visible=(await c.query('SELECT kind FROM garden_private.entities')).rows.map(r=>r.kind);
  assert.equal(visible.length,6);assert(visible.includes('port')&&visible.includes('language'));
  assert.equal((await c.query('SELECT * FROM garden_private.names')).rows.length,2);
 });check('security-invoker entity and name projections preserve RLS');
 const edited=structuredClone(original);edited.names[0].usage='preferred';
 const a3=await repo.revise(headers('alice'),W,ids.a,a.revision,edited);
 await assert.rejects(()=>repo.revise(headers('alice'),W,ids.a,a.revision,original),PolicyError);check('optimistic revision check prevents lost edits');
 const missingIds=structuredClone(edited);missingIds.sourceIdentities=[];
 await assert.rejects(()=>repo.revise(headers('alice'),W,ids.a,a3.revision,missingIds),PolicyError);check('revision cannot erase original source identity');
 const merged=await repo.merge(headers('alice'),W,ids.a,ids.b,a3.revision,b.revision,{reason:'Synthetic reviewed duplicate hypothesis',evidence:evidence()});
 assert.equal(merged.record.redirect.targetId,ids.b);assert.deepEqual(merged.record.names,edited.names);assert.deepEqual((await repo.read(headers('alice'),W,ids.b)).record,other);check('explicit merge retains both records and aliases');
 await assert.rejects(()=>repo.read(headers('bob'),W,ids.a),PolicyError);check('redirect does not expose an inaccessible target');
 const restored=await repo.unmerge(headers('alice'),W,ids.a,merged.revision);
 assert.deepEqual(restored.record,edited);check('unmerge restores source without rewriting names, identifiers or target');
 const history=await repo.history(headers('alice'),W,ids.a);
 assert.deepEqual(history.versions.map(x=>x.revision),['5','4','3','2','1']);assert.equal(history.versions[1].record.redirect.targetId,ids.b);check('append-only revisions preserve the full merge and unmerge path');
 const page=await repo.history(headers('alice'),W,ids.a,{limit:2});const next=await repo.history(headers('alice'),W,ids.a,{beforeRevision:page.nextBeforeRevision,limit:2});assert.deepEqual(next.versions.map(x=>x.revision),['3','2']);check('history pagination never silently truncates to one page');
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_private.record_revisions WHERE record_id=$1 AND actor_subject_id=$2',[ids.a,'alice'])).rows[0].n,4);check('journal actor comes from the bound server-side context');
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query('UPDATE garden_private.record_revisions SET payload=$1 WHERE record_id=$2',[{},ids.a])),PolicyError);check('runtime cannot rewrite prior revisions');
 const before=(await repo.read(headers('alice'),W,ids.a)).revision;
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},async c=>{await c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{kind}','\"port\"') WHERE id=$1",[ids.a]);}),PolicyError);
 assert.equal((await repo.read(headers('alice'),W,ids.a)).revision,before);check('database independently rejects type conversion and rolls back history');
 await assert.rejects(()=>executor.run(headers('alice'),{workspaceId:W,action:'write'},c=>c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_set(payload,'{id}',to_jsonb($2::text)) WHERE id=$1",[ids.a,ids.b])),PolicyError);check('database forbids payload/envelope identity mismatch');
 await admin.query("UPDATE garden_control.record_grants SET can_write=false WHERE record_id=$1 AND subject_id='alice'",[ids.b]);
 await assert.rejects(()=>repo.merge(headers('alice'),W,ids.a,ids.b,restored.revision,b.revision,{reason:'fixture',evidence:evidence()}),PolicyError);check('merging requires write permission on both source and destination');
 await admin.query("UPDATE garden_control.record_grants SET can_write=true WHERE record_id=$1 AND subject_id='alice'",[ids.b]);
 const relation=relationship();relation.id=ids.relation;relation.fromId=ids.voyage;relation.toId=ids.port;
 const r=await repo.initialize(headers('alice'),W,ids.relation,'1',relation);assert.equal(r.record.assessment,'unreviewed');check('typed relationship resolves actual endpoint kinds without asserting historical truth');
 const wrong=structuredClone(relation);wrong.toId=ids.language;
 await assert.rejects(()=>repo.revise(headers('alice'),W,ids.relation,r.revision,wrong),PolicyError);check('relationship cannot relabel a language UUID as a port');
 const missing=structuredClone(relation);missing.toId=randomUUID();
 await assert.rejects(()=>repo.revise(headers('alice'),W,ids.relation,r.revision,missing),PolicyError);check('dangling endpoint fails closed');
 await admin.query("UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE record_id=$1 AND subject_id='alice'",[ids.port]);
 await assert.rejects(()=>repo.read(headers('alice'),W,ids.relation),PolicyError);check('revoked endpoint denies derived relationship delivery');
 await admin.query("UPDATE garden_control.record_grants SET revoked_at=NULL WHERE record_id=$1 AND subject_id='alice'",[ids.port]);
 const results=await Promise.allSettled([
  repo.merge(headers('alice'),W,ids.a,ids.b,restored.revision,b.revision,{reason:'fixture a to b',evidence:evidence()}),
  repo.merge(headers('alice'),W,ids.b,ids.a,b.revision,restored.revision,{reason:'fixture b to a',evidence:evidence()})
 ]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);check('concurrent opposite merges cannot form a cycle');
 await admin.query("UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE record_id=$1 AND subject_id='alice'",[ids.a]);
 await assert.rejects(()=>repo.history(headers('alice'),W,ids.a),PolicyError);check('revocation removes access to previous versions too');
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets')).rows[0].n,0);check('successful and failed data operations retire authorization tickets');
 await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/historical.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,synthetic_only:true,production_verified:false,checks},null,2)+'\n');
 console.log('PASS: '+checks.length+' real PostgreSQL historical-record checks');
} finally {for(const p of pools)await p.end();await admin.end();}
