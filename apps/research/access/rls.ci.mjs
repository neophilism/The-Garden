import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor,PolicyError} from './policy-context.mjs';
import {ROLE_CAPABILITIES} from './roles.mjs';
if(process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.CI!=='true'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Refuse RLS fixture outside ephemeral CI');
const base={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD};
const admin=new pg.Pool({...base,max:3}),pools=[];
const checks=[],record=name=>checks.push({name,result:'pass'});
const W=randomUUID(),OTHER=randomUUID(),policy='f'.repeat(64),ids={};
const writerRoles=new Set(['contributor','transcriber','translator','researcher','editor']);
let issuerPool,queryPool;
async function inRole(pool,role,work){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);const r=await work(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
const issue=(subject,action='read',scope=null)=>inRole(issuerPool,'garden_context_issuer',async c=>(await c.query('SELECT garden_control.issue_policy_ticket($1,$2,$3,$4) AS token',[W,subject,action,scope])).rows[0].token);
const retire=token=>inRole(issuerPool,'garden_context_issuer',c=>c.query('SELECT garden_control.invalidate_policy_ticket($1)',[token]));
const identity={viewer:async headers=>({id:headers.get('synthetic-subject'),verified:true})};
const headers=subject=>new Headers({'synthetic-subject':subject});
let executor;
async function deniedSql(sql,args=[]){await assert.rejects(()=>inRole(queryPool,'garden_research',c=>c.query(sql,args)),e=>e.code==='42501');}
try{
 for(const [name,capability] of [['garden_policy_issuer_ci','garden_context_issuer'],['garden_policy_query_ci','garden_research']]){
  const password=randomBytes(30).toString('hex');
  await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  await admin.query(`GRANT ${capability} TO ${name} WITH INHERIT FALSE, SET TRUE`);
  const pool=new pg.Pool({...base,user:name,password,max:1});pools.push(pool);
  if(capability==='garden_context_issuer')issuerPool=pool;else queryPool=pool;
 }
 executor=createPolicyExecutor({identity,issuerPool,researchPool:queryPool});
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true),($4,$5,$3,true)',[W,'RLS synthetic',policy,OTHER,'Other synthetic']);
 for(const subject of ['owner','bob','no-grant',...Object.keys(ROLE_CAPABILITIES)]){
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,subject,policy]);
 }
 for(const subject of ['owner','bob','no-grant',...Object.keys(ROLE_CAPABILITIES)]){
  const role=Object.hasOwn(ROLE_CAPABILITIES,subject)?subject:'researcher';
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,$3,'owner',clock_timestamp()+interval '30 days')",[W,subject,role]);
 }
 await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,'owner','active',$2)",[OTHER,policy]);
 await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,'owner','researcher','owner',clock_timestamp()+interval '30 days')",[OTHER]);
 for(const [label,classification,state,workspace] of [['readable','research','active',W],['unclassified','unclassified','active',W],['licensed','licensed','active',W],['personal','personal','active',W],['sealed','sealed','active',W],['government','government','active',W],['quarantine','research','quarantined',W],['withdrawn','research','withdrawn',W],['bob-only','research','active',W],['cross-workspace','research','active',OTHER]]){
  ids[label]=randomUUID();
  const payload=classification==='sealed'?{}:{label,synthetic:true};
  await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state,payload) VALUES($1,$2,'owner',$3,$4,$5)",[ids[label],workspace,classification,state,payload]);
  if(workspace===W){
   for(const subject of label==='bob-only'?['bob']:['owner',...Object.keys(ROLE_CAPABILITIES)]){
    await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,$3,true,true,'research',clock_timestamp()+interval '30 days')",[W,ids[label],subject]);
   }
  }
 }
 // All role-specific identities use the same single physical query connection.
 const backendPids=new Set();
 for(const role of Object.keys(ROLE_CAPABILITIES)){
  const result=await executor.run(headers(role),{workspaceId:W},async c=>{backendPids.add((await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);return(await c.query('SELECT id FROM garden_private.record_envelopes ORDER BY id')).rows;});
  assert.deepEqual(result.map(x=>x.id),[ids.readable]);
  if(writerRoles.has(role)){
   const updated=await executor.run(headers(role),{workspaceId:W,action:'write',recordId:ids.readable},async c=>(await c.query("UPDATE garden_private.record_envelopes SET payload=jsonb_build_object('synthetic',true,'writer',$1::text) WHERE id=$2 RETURNING version",[role,ids.readable])).rows);
   assert.equal(updated.length,1);assert.ok(Number(updated[0].version)>1);
  }else await assert.rejects(()=>executor.run(headers(role),{workspaceId:W,action:'write'},async()=>{}),PolicyError);
  record('SQL role matrix: '+role+' reads only explicitly granted active research; write authority is separate');
 }
 assert.equal(backendPids.size,1);record('ten roles tested on the same reused PostgreSQL backend');
 const noGrant=await executor.run(headers('no-grant'),{workspaceId:W},async c=>(await c.query('SELECT id FROM garden_private.record_envelopes')).rows);assert.deepEqual(noGrant,[]);
 const bob=await executor.run(headers('bob'),{workspaceId:W},async c=>(await c.query('SELECT id FROM garden_private.record_envelopes')).rows);assert.deepEqual(bob.map(x=>x.id),[ids['bob-only']]);record('pool reuse across distinct subjects reveals only each subjects explicit grant');
 const scoped=await executor.run(headers('owner'),{workspaceId:W,recordId:ids['bob-only']},async c=>(await c.query('SELECT id FROM garden_private.record_envelopes')).rows);assert.deepEqual(scoped,[]);record('single-record context cannot expand scope');
 await assert.rejects(()=>executor.run(headers('bob'),{workspaceId:OTHER},async()=>{}),PolicyError);record('workspace nonmember cannot mint a context');
 const naked=await inRole(queryPool,'garden_research',async c=>{await c.query("SELECT set_config('app.subject','owner',true),set_config('app.workspace',$1,true)",[W]);return(await c.query('SELECT id FROM garden_private.record_envelopes')).rows;});assert.deepEqual(naked,[]);record('spoofed session GUC values do not authorize record reads');
 const readWrite=await executor.run(headers('researcher'),{workspaceId:W},async c=>(await c.query("UPDATE garden_private.record_envelopes SET payload='{}' WHERE id=$1 RETURNING id",[ids.readable])).rows);assert.deepEqual(readWrite,[]);record('read ticket cannot update even with a write grant');
 for(const [sql,args] of [['SELECT * FROM garden_control.policy_tickets',[]],['SELECT * FROM garden_control.policy_contexts',[]],['SELECT * FROM garden_control.record_grants',[]],['SELECT garden_control.issue_policy_ticket($1,$2,$3,NULL)',[W,'owner','read']],['SET ROLE garden_migrator',[]],['SET ROLE garden_context_issuer',[]],['SET ROLE garden_membership_admin',[]],['ALTER TABLE garden_private.record_envelopes DISABLE ROW LEVEL SECURITY',[]],['TRUNCATE garden_private.record_envelopes',[]],["UPDATE garden_private.record_envelopes SET classification='research'",[]],['DELETE FROM garden_private.record_envelopes',[]],["INSERT INTO garden_private.record_envelopes(workspace_id,owner_subject_id) VALUES($1,'owner')",[W]]])await deniedSql(sql,args);
 record('runtime cannot mint context, read control tables, alter classification, delete, truncate or SET privileged roles');
 await assert.rejects(()=>inRole(queryPool,'garden_research',async c=>{await c.query('SET LOCAL row_security=off');return c.query('SELECT * FROM garden_private.record_envelopes');}),e=>e.code==='42501');record('row_security off does not bypass FORCE RLS');
 const ownerRows=await inRole(admin,'garden_migrator',async c=>(await c.query('SELECT id FROM garden_private.record_envelopes')).rows);assert.deepEqual(ownerRows,[]);record('table owner is denied by FORCE RLS');
 for(const role of ['garden_worker','garden_public','garden_publisher','garden_context_issuer'])await assert.rejects(()=>inRole(admin,role,c=>c.query('SELECT id FROM garden_private.record_envelopes')),e=>e.code==='42501');record('worker, public, publisher and issuer have no raw private-table access');
 // Next-statement checks see revocation, scope changes, membership versions and state.
 for(const [name,mutate,restore] of [
  ['record grant revocation',()=>admin.query('UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND record_id=$2 AND subject_id=$3',[W,ids.readable,'owner']),()=>admin.query('UPDATE garden_control.record_grants SET revoked_at=NULL WHERE workspace_id=$1 AND record_id=$2 AND subject_id=$3',[W,ids.readable,'owner'])],
  ['membership version change',()=>admin.query('UPDATE garden_control.access_members SET version=version+1 WHERE workspace_id=$1 AND subject_id=$2',[W,'owner']),async()=>{}],
  ['workspace suspension',()=>admin.query("UPDATE garden_control.access_members SET state='suspended' WHERE workspace_id=$1 AND subject_id='owner'",[W]),()=>admin.query("UPDATE garden_control.access_members SET state='active' WHERE workspace_id=$1 AND subject_id='owner'",[W])],
  ['classification withdrawal',()=>admin.query("UPDATE garden_private.record_envelopes SET classification='personal' WHERE id=$1",[ids.readable]),()=>admin.query("UPDATE garden_private.record_envelopes SET classification='research' WHERE id=$1",[ids.readable])]
 ]){
  await executor.run(headers('owner'),{workspaceId:W},async c=>{assert.equal((await c.query('SELECT id FROM garden_private.record_envelopes')).rows.length,1);await mutate();assert.equal((await c.query('SELECT id FROM garden_private.record_envelopes')).rows.length,0);});await restore();record(name+' denies next statement in an existing context');
 }
 const token=await issue('owner');
 await inRole(queryPool,'garden_research',async c=>{await c.query('SELECT garden_control.bind_policy_context($1)',[token]);assert.equal((await c.query('SELECT id FROM garden_private.record_envelopes')).rows.length,1);});
 assert.equal((await inRole(queryPool,'garden_research',async c=>(await c.query('SELECT id FROM garden_private.record_envelopes')).rows)).length,0);record('committed context cannot authorize a different transaction on the same backend');
 await assert.rejects(()=>inRole(queryPool,'garden_research',c=>c.query('SELECT garden_control.bind_policy_context($1)',[token])),e=>e.message==='Policy context denied');await retire(token);record('committed ticket replay is rejected');
 const expired=await issue('owner');await admin.query("UPDATE garden_control.policy_tickets SET issued_at=clock_timestamp()-interval '60 seconds',expires_at=clock_timestamp()-interval '40 seconds' WHERE token_hash=sha256(convert_to($1,'UTF8'))",[expired]);
 await assert.rejects(()=>inRole(queryPool,'garden_research',c=>c.query('SELECT garden_control.bind_policy_context($1)',[expired])),e=>e.message==='Policy context denied');await retire(expired);record('expired context ticket fails closed');
 const double=await issue('owner'),second=await issue('bob');
 await assert.rejects(()=>inRole(queryPool,'garden_research',async c=>{await c.query('SELECT garden_control.bind_policy_context($1)',[double]);await c.query('SELECT garden_control.bind_policy_context($1)',[second]);}),e=>e.message==='Policy context already bound');await retire(double);await retire(second);record('one transaction cannot switch to another identity');
 const before=(await admin.query('SELECT version,payload FROM garden_private.record_envelopes WHERE id=$1',[ids.readable])).rows[0];
 await assert.rejects(()=>executor.run(headers('owner'),{workspaceId:W,action:'write'},async c=>{await c.query("UPDATE garden_private.record_envelopes SET payload='{\"rollback\":true}' WHERE id=$1",[ids.readable]);throw Error('synthetic failure');}),PolicyError);
 assert.deepEqual((await admin.query('SELECT version,payload FROM garden_private.record_envelopes WHERE id=$1',[ids.readable])).rows[0],before);record('failed write rolls back data and version together');
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets')).rows[0].n,0);assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_contexts')).rows[0].n,0);record('successful and failed operations retire ticket and backend context');
 await assert.rejects(()=>admin.query("UPDATE garden_private.record_envelopes SET payload='{\"plaintext\":true}' WHERE id=$1",[ids.sealed]),e=>e.code==='23514');record('sealed envelope rejects plaintext payload');
 const reused=(await queryPool.query('SELECT current_user::text AS role')).rows[0].role;assert.equal(reused,'garden_policy_query_ci');record('query login identity is restored after every transaction');
 await mkdir('identity-evidence',{recursive:true});await writeFile('identity-evidence/rls-results.json',JSON.stringify({source:process.env.GITHUB_SHA,checks,synthetic_only:true,production_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' live PostgreSQL RLS, role and pool-contamination checks');
}finally{for(const p of pools)await p.end();await admin.end();}
