/** GDN-031: real PostgreSQL policy matrix with synthetic identities and bytes.
 * No network provider, government, AI, live index or actual corpus is activated.
 */
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {RUNTIME_DATABASE_CAPABILITIES as CAPS,assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';
import {createPolicyExecutor,PolicyError} from './policy-context.mjs';
import {createRecordRepository,createRecordDelivery,createDeliveryHandler} from './record-delivery.mjs';
import {createDeliveryCapabilities} from './delivery-capabilities.mjs';
import {createAuditReader} from './audit.mjs';
import {allowSyntheticResearchUse} from './consent-test-fixture.mjs';
import {createJobWorker,consumeOnce} from '../../../services/workers/src/jobs.mjs';
import {matrixCases,validateMatrix,PROJECTIONS,BYTE_KINDS} from '../../../tests/security/policy-matrix/model.mjs';
if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='neondb')throw Error('Isolation suite requires ephemeral local CI');
const registry=validateMatrix(JSON.parse(await readFile(new URL('../../../tests/security/policy-matrix/registry.json',import.meta.url))));
const allCases=matrixCases(registry),config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:3,connectionTimeoutMillis:5000};
const admin=new pg.Pool(config),pools=[],checks=[],W=randomUUID(),OTHER=randomUUID(),policy='f'.repeat(64);
const counts={databaseCapabilityPairs:0,roleClassStateGrantCases:0,httpProjectionCases:0,signedByteCases:0,writeRoleClassCases:0};
const check=name=>{checks.push({name,result:'pass'});console.log('ISOLATION '+checks.length+': '+name);};
const H=subject=>new Headers({'synthetic-subject':subject});let revokedSession=false;
// Cryptographic passkey/session verification is independently exercised by the
// existing sessions.ci journey; this adapter makes role fixtures explicit.
const identity={viewer:async h=>revokedSession||!h.get('synthetic-subject')?null:{id:h.get('synthetic-subject'),verified:true},authorizePrivileged:async(h,action,authorize)=>!revokedSession&&action==='audit.inspect'&&await authorize({subjectId:h.get('synthetic-subject'),action})};
async function login(name,cap){
 const password=randomBytes(32).toString('hex');
 await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
 if(cap)await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE, SET TRUE`);
 const p=new pg.Pool({...config,user:name,password});pools.push(p);return p;
}
async function asRole(pool,cap,work){
 const c=await pool.connect();let bad=false;
 try{const actor=await assertDatabaseCapability(c,cap);await c.query('BEGIN');await c.query('SET LOCAL ROLE '+cap);const result=await work(c);await assertDatabaseCapability(c,cap,{activeRole:true,login:actor});await c.query('COMMIT');return result;}
 catch(error){bad=error instanceof DatabaseCapabilityError;try{await c.query('ROLLBACK');}catch{bad=true;}throw error;}
 finally{c.release(bad);}
}
try{
 const guard=await login('garden_matrix_guard_ci');
 await admin.query('CREATE ROLE garden_matrix_future_ci NOLOGIN NOINHERIT');
 const foreign=[...CAPS,'garden_migrator','garden_matrix_future_ci'];
 for(const cap of CAPS){
  await admin.query(`GRANT ${cap} TO garden_matrix_guard_ci WITH INHERIT FALSE, SET TRUE`);
  await asRole(guard,cap,async()=>{});
  for(const other of foreign.filter(x=>x!==cap)){
   await admin.query(`GRANT ${other} TO garden_matrix_guard_ci WITH INHERIT FALSE, SET FALSE`);
   await assert.rejects(()=>asRole(guard,cap,async()=>assert.fail('Conflicting login ran trusted work')),DatabaseCapabilityError);
   await admin.query(`REVOKE ${other} FROM garden_matrix_guard_ci`);counts.databaseCapabilityPairs++;
  }
  await admin.query(`GRANT ${cap} TO garden_matrix_guard_ci WITH INHERIT TRUE, SET TRUE`);
  await assert.rejects(()=>asRole(guard,cap,async()=>assert.fail('Inherited capability accepted')),DatabaseCapabilityError);
  await admin.query(`GRANT ${cap} TO garden_matrix_guard_ci WITH INHERIT FALSE, SET FALSE`);
  await assert.rejects(()=>asRole(guard,cap,async()=>assert.fail('Non-settable capability accepted')),DatabaseCapabilityError);
  await admin.query(`REVOKE ${cap} FROM garden_matrix_guard_ci`);
 }
 assert.equal(counts.databaseCapabilityPairs,90);check('all nine runtime capabilities reject every other capability, migration membership and a future unknown role');
 await admin.query('GRANT garden_research TO garden_matrix_guard_ci WITH INHERIT FALSE, SET TRUE');
 await admin.query('CREATE SCHEMA garden_matrix_owned_ci AUTHORIZATION garden_matrix_guard_ci');
 await assert.rejects(()=>asRole(guard,'garden_research',async()=>assert.fail('Object owner admitted')),DatabaseCapabilityError);
 await admin.query('ALTER SCHEMA garden_matrix_owned_ci OWNER TO postgres');
 await assert.rejects(()=>asRole(guard,'garden_research',async()=>{await admin.query('REVOKE garden_research FROM garden_matrix_guard_ci');}),DatabaseCapabilityError);
 check('object ownership and a capability revoked during a transaction fail the final admission check');

 const issuer=await login('garden_matrix_issuer_ci','garden_context_issuer'),research=await login('garden_matrix_query_ci','garden_research'),auditor=await login('garden_matrix_auditor_ci','garden_audit_reader'),worker=await login('garden_matrix_worker_ci','garden_worker');
 const executor=createPolicyExecutor({identity,issuerPool:issuer,researchPool:research}),repository=createRecordRepository(executor);
 for(const workspace of [W,OTHER])await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[workspace,'Synthetic isolation matrix',policy]);
 for(const role of registry.roles){
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,role,policy]);
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,$2,'matrix-fixture',clock_timestamp()+interval '1 hour')",[W,role]);
 }
 const objects=new Map(),records=new Map();let reads=0,afterRead=null,clock=Date.now();
 for(const classification of registry.classifications)for(const state of registry.states)for(const grant of registry.grants){
  const id=randomUUID(),key=[classification,state,grant].join('/'),title='PRIVATE-MATRIX-CANARY-'+key;
  const bytes=Buffer.from(title),hash=createHash('sha256').update(bytes).digest('hex');
  const ref={kind:'original',sourceId:id,version:randomUUID(),sha256:hash,size:bytes.length,bucket:'synthetic-private-originals',key:randomUUID()};objects.set(ref.version,bytes);
  const payload=classification==='sealed'?{}:{title,kind:'source',summary:title,privateField:'NEVER-RETURN-MATRIX-RAW',assets:{download:{ref,mediaType:'application/octet-stream'},media:{ref,mediaType:'audio/mpeg'},'tile:1:0:0:0':{ref,mediaType:'image/png'}}};
  await admin.query('INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state,payload) VALUES($1,$2,$3,$4,$5,$6)',[id,W,'researcher',classification,state,payload]);
  await allowSyntheticResearchUse(admin,W,id);
  if(grant!=='missing')for(const subject of registry.roles)await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at,revoked_at) VALUES($1,$2,$3,true,true,'research',clock_timestamp()+interval '1 hour',CASE WHEN $4 THEN clock_timestamp() ELSE NULL END)",[W,id,subject,grant==='revoked']);
  records.set(key,{id,title,ref,bytes});
 }
 const visible=records.get('research/active/current');
 for(const role of registry.roles){
  const actual=await executor.run(H(role),{workspaceId:W},async c=>(await c.query('SELECT id::text FROM garden_private.record_envelopes ORDER BY id')).rows.map(r=>r.id));
  for(const entry of allCases.filter(x=>x.role===role)){
   const record=records.get([entry.classification,entry.state,entry.grant].join('/'));
   assert.equal(actual.includes(record.id),entry.visible,[role,entry.classification,entry.state,entry.grant].join('/'));counts.roleClassStateGrantCases++;
  }
  assert.deepEqual(actual,[visible.id]);
 }
 assert.equal(counts.roleClassStateGrantCases,594);check('594 real RLS outcomes span every role, class, state and grant with no owner or administrator bypass');
 for(const role of registry.roles)for(const classification of registry.classifications){
  const id=records.get(classification+'/active/current').id;
  const write=()=>executor.run(H(role),{workspaceId:W,recordId:id,action:'write'},async c=>(await c.query("UPDATE garden_private.record_envelopes SET payload=payload WHERE id=$1 RETURNING id",[id])).rows);
  if(['contributor','transcriber','translator','researcher','editor'].includes(role))assert.equal((await write()).length,classification==='research'?1:0);
  else await assert.rejects(write,PolicyError);
  counts.writeRoleClassCases++;
 }
 check('66 write role/class combinations independently refuse reviewer, auditor, administrator and non-research mutations');

 const capabilities=createDeliveryCapabilities({keys:{matrix:randomBytes(32)},activeKeyId:'matrix',now:()=>clock});
 const origin='https://matrix.example.invalid',store={async read(_ctx,ref){reads++;const data=objects.get(ref.version);const action=afterRead;afterRead=null;if(action)await action();return data;}};
 const delivery=createRecordDelivery({identity,repository,archiveStore:store,capabilities,origin,enabled:()=>true}),handler=createDeliveryHandler({service:delivery,origin});
 const path=(record,channel='record',workspace=W)=>'/api/research/workspaces/'+workspace+'/records/'+record+'/'+channel;
 const req=(who,url,options={})=>handler(new Request(url.startsWith('https:')?url:origin+url,{method:options.method??'GET',headers:{origin,'synthetic-subject':who,...(options.body?{'content-type':'application/json'}:{}),...(options.range?{range:options.range}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})}));
 for(const who of registry.roles){
  const absent=await req(who,path(randomUUID())),absentBody=await absent.text();assert.equal(absent.status,404);
  for(const classification of registry.classifications){
   const r=records.get(classification+'/active/current'),allowed=classification==='research';
   for(const channel of PROJECTIONS){
    const response=await req(who,path(r.id,channel)),text=await response.text();assert.equal(response.status,allowed?200:404);
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok(!text.includes('NEVER-RETURN-MATRIX-RAW'));
    if(allowed)assert.ok(text.includes(r.title));else{assert.equal(text,absentBody);assert.equal(response.headers.get('content-type'),absent.headers.get('content-type'));}
    const head=await req(who,path(r.id,channel),{method:'HEAD'});assert.equal(head.status,allowed?200:404);assert.equal((await head.arrayBuffer()).byteLength,0);counts.httpProjectionCases++;
   }
   for(const kind of BYTE_KINDS){
    const selector=kind==='tile'?'1:0:0:0':null;
    const response=await req(who,path(r.id,'capability'),{method:'POST',body:{kind,selector}});assert.equal(response.status,allowed?200:404);
    const before=reads;
    if(allowed){const url=(await response.json()).url;assert.equal(new URL(url).origin,origin);const bytes=await req(who,url);assert.equal(bytes.status,200);assert.deepEqual(Buffer.from(await bytes.arrayBuffer()),r.bytes);}
    else{assert.equal(await response.text(),absentBody);assert.equal(reads,before);}
    counts.signedByteCases++;
   }
  }
  const search='/api/research/workspaces/'+W+'/search';
  for(const [view,expected] of [['count',{total:'1'}],['facets',{facets:{source:'1'}}]])assert.deepEqual(await(await req(who,search+'?view='+view)).json(),expected);
  const result=await(await req(who,search)).json();assert.deepEqual(result.records.map(r=>r.id),[visible.id]);
  const hidden=await(await req(who,search+'?q='+encodeURIComponent('PRIVATE-MATRIX-CANARY-personal'))).json();assert.equal(hidden.total,'0');assert.deepEqual(hidden.facets,{});assert.deepEqual(hidden.records,[]);
  assert.equal((await req(who,path(visible.id,'record',OTHER))).status,404);
 }
 assert.equal(counts.httpProjectionCases,330);assert.equal(counts.signedByteCases,198);check('all role/class projection, HEAD and signed-byte channels enforce SQL visibility; denied records and absent records share status/body/content type');
 check('authorized search, count and facets agree and known hidden canaries reveal no preview or aggregates across workspaces');
 const mint=async(kind='download',extra={})=>(await(await req('researcher',path(visible.id,'capability'),{method:'POST',body:{kind,...extra}})).json()).url;
 const full=await mint();
 const otherSubject='editor';let before=reads;assert.equal((await req(otherSubject,full)).status,404);assert.equal(reads,before);
 for(const [from,to] of [[W,OTHER],[visible.id,randomUUID()],['/download?','/media?']]){const tampered=full.replace(from,to);assert.notEqual(tampered,full);assert.equal((await req('researcher',tampered)).status,404);}
 const tokenEdit=new URL(full);tokenEdit.searchParams.set('cap',tokenEdit.searchParams.get('cap')+'A');assert.equal((await req('researcher',tokenEdit.href)).status,404);
 const ranged=await mint('media',{range:'bytes=1-5'});assert.equal((await req('researcher',ranged,{range:'bytes=0-5'})).status,404);assert.equal((await req('researcher',ranged,{range:'bytes=1-5'})).status,206);
 const tile=await mint('tile',{selector:'1:0:0:0'}),editedTile=new URL(tile);editedTile.searchParams.set('selector','2:0:0:0');assert.equal((await req('researcher',editedTile.href)).status,404);
 clock+=30001;before=reads;assert.equal((await req('researcher',full)).status,404);assert.equal(reads,before);check('signed URL cannot cross subject, workspace, record, kind, selector, range or expiry; denied replay cannot acquire bytes');
 const refreshed=await mint();revokedSession=true;before=reads;assert.equal((await req('researcher',refreshed)).status,404);assert.equal(reads,before);revokedSession=false;
 afterRead=()=>admin.query("UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND record_id=$2 AND subject_id='researcher'",[W,visible.id]);
 assert.equal((await req('researcher',refreshed)).status,404);check('session revocation and grant withdrawal during byte acquisition prevent the final response');
 for(const missing of ['ai','index','public-projection']){before=reads;const r=await req('researcher','/api/research/'+missing);assert.equal(r.status,404);assert.equal(await r.text(),'{"error":"not_available"}');assert.equal(reads,before);}
 check('unimplemented AI, index and public-projection routes remain absent; no functionality or timing certification is inferred');
 // Fixed-seed malicious parameter generation is deterministic and reproducible.
 let seed=0x031a031;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<48;i++){
  const channel=PROJECTIONS[next()%PROJECTIONS.length],id=randomUUID(),bad=path(id,channel)+(next()%2?'?subject=administrator':'?include=private');
  const response=await req('editor',bad);assert.equal(response.status,404);assert.equal(await response.text(),'{"error":"not_available"}');
 }
 check('48 deterministic malformed route/property probes fail before broadening policy');
 const audit=createAuditReader({identity,issuerPool:issuer,auditPool:auditor,enabled:()=>true});
 for(const who of registry.roles){
  if(who==='auditor'){const page=await audit.page(H(who),W,{limit:2});assert.ok(page.entries.length>0);assert.ok(!JSON.stringify(page).includes('PRIVATE-MATRIX-CANARY'));}
  else await assert.rejects(()=>audit.page(H(who),W));
 }
 check('auditor-only read context cannot be replaced with an administrator or ordinary research role, and exported audit omits source canaries');

 const grantId=randomUUID(),subject=randomUUID(),scope=randomUUID();
 await admin.query("INSERT INTO garden_control.job_grants VALUES($1,$2,$3,1,false,clock_timestamp()+interval '1 hour')",[grantId,subject,scope]);
 const enqueue=async()=> (await admin.query("SELECT garden_control.enqueue_job($1,$2,$3,$4,1,'verify-object',$5,'restricted',$6) AS id",[randomUUID(),grantId,subject,scope,randomUUID(),randomUUID()])).rows[0].id;
 const query=(sql,args)=>asRole(worker,'garden_worker',c=>c.query(sql,args));let handlerRuns=0,afterWork=null;
 const w=createJobWorker({query,authorize:async()=>true,handlers:{'verify-object':async()=>{handlerRuns++;if(afterWork)await afterWork();return{resultRef:randomUUID()};}}});
 const beforeClaim=await enqueue();await admin.query('UPDATE garden_control.job_grants SET revoked=true WHERE grant_id=$1',[grantId]);
 assert.equal((await w.tick()).status,'idle');assert.equal(handlerRuns,0);assert.equal((await admin.query('SELECT status FROM garden_control.jobs WHERE job_id=$1',[beforeClaim])).rows[0].status,'cancelled');
 await admin.query('UPDATE garden_control.job_grants SET revoked=false WHERE grant_id=$1',[grantId]);const duringWork=await enqueue();afterWork=()=>admin.query('UPDATE garden_control.job_grants SET revoked=true WHERE grant_id=$1',[grantId]);
 assert.equal((await w.tick()).status,'fenced');assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.outbox WHERE job_id=$1',[duringWork])).rows[0].n,0);
 await admin.query('UPDATE garden_control.job_grants SET revoked=false WHERE grant_id=$1',[grantId]);const ready=await enqueue();afterWork=null;assert.equal((await w.tick()).status,'committed');
 const event=(await admin.query('SELECT event_id FROM garden_control.outbox WHERE job_id=$1',[ready])).rows[0].event_id;await admin.query('UPDATE garden_control.job_grants SET revoked=true WHERE grant_id=$1',[grantId]);
 const consumption=await consumeOnce({transaction:fn=>asRole(worker,'garden_worker',fn),eventId:event,consumer:'isolation_matrix',apply:async()=>assert.fail('Revoked outbox side effect ran')});assert.equal(consumption.applied,false);
 check('revocation before claim prevents handler execution; during work fences completion; after commit prevents a new outbox consumer effect');
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets')).rows[0].n,0);
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_contexts')).rows[0].n,0);check('mixed authorized/denied requests leave no reusable policy ticket or pooled context');
 await mkdir('identity-evidence',{recursive:true});await writeFile('identity-evidence/isolation-matrix.json',JSON.stringify({source:process.env.GITHUB_SHA,checks,counts,real_postgresql:true,synthetic_identity_and_object_backend:true,request_level_timing_benchmark:false,production_verified:false,disabled_surfaces:['ai','index','public-projection']},null,2)+'\n');
 console.log('PASS: isolation matrix '+JSON.stringify(counts));
}finally{for(const p of pools)await p.end();await admin.end();}
