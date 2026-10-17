/** Permission experiment only: disposable PostgreSQL 18, no Garden row/policy changes.
 * The synthetic caller logins represent actors for this experiment. An actual
 * host must independently establish identity and purpose-bound authority; this
 * fixture's owner-created contexts are not a production admission protocol.
 * https://www.postgresql.org/docs/18/sql-select.html
 * https://www.postgresql.org/docs/18/sql-createpolicy.html
 */
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import pg from 'pg';

if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||
 process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='5432'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='neondb')throw Error('Hold metadata permission fixtures require disposable loopback CI');
const config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:6,connectionTimeoutMillis:5000};
const admin=new pg.Pool(config),suffix=randomBytes(6).toString('hex'),schema='garden_hold_permissions_'+suffix;
const roles={resolver:schema+'_resolver',alice:schema+'_alice',bob:schema+'_bob',writer:schema+'_writer'};
const pools={},sessions=new Set(),createdRoles=[],checks=[];
const W=randomUUID(),OTHER=randomUUID(),A=randomUUID(),B=randomUUID(),C=randomUUID(),SEALED=randomUUID();
const CANARY='SYNTHETIC_HOLD_METADATA_PRIVATE_'+randomBytes(12).toString('hex');
const projection=['workspace_id','record_id','version','classification','state'];
const lockSQL=`SELECT * FROM ${schema}.lock_metadata($1::uuid,$2::uuid,$3::bigint,$4::text)`;
const args=[W,A,'7',roles.alice];
let schemaCreated=false,serverVersion=null,failure=null,teardownVerified=false;
const check=name=>{checks.push({name,result:'pass'});console.log('HOLD METADATA PERMISSIONS '+checks.length+': '+name);};
const unavailable=error=>error.code==='P0001'&&error.message==='Synthetic hold metadata unavailable';
const tableDenied=table=>error=>error.code==='42501'&&error.message==='permission denied for table '+table;
const writeDenied=table=>error=>error.code==='42501'&&error.message==='new row violates row-level security policy for table "'+table+'"';
const hash=value=>createHash('sha256').update(value).digest('hex');

async function begin(pool){
 const client=await pool.connect();let closed=false,bad=false,pid,xid;
 try{
  await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='5s'");
  ({pid,xid}=(await client.query('SELECT pg_backend_pid() AS pid,pg_current_xact_id()::text AS xid')).rows[0]);
 }catch(error){try{await client.query('ROLLBACK');}finally{client.release(true);}throw error;}
 const tx={pid,xid,contextAttempted:false,query:client.query.bind(client),async finish(commit=false){
  if(closed)return;closed=true;let error=null;
  try{await client.query(commit?'COMMIT':'ROLLBACK');}
  catch(cause){error=cause;if(commit){try{await client.query('ROLLBACK');}catch{bad=true;}}else bad=true;}
  finally{client.release(bad);sessions.delete(tx);}
  if(tx.contextAttempted){try{await admin.query(`DELETE FROM ${schema}.contexts WHERE backend_pid=$1 AND transaction_id=$2::xid8`,[pid,xid]);}catch(cause){error=error?new AggregateError([error,cause],'Synthetic transaction and context cleanup failed'):cause;}}
  if(error)throw error;
 }};sessions.add(tx);return tx;
}
async function context(tx,change={}){
 const c={pid:tx.pid,xid:tx.xid,login:roles.alice,actor:roles.alice,workspace:W,record:A,revision:'7',purpose:'hold-administration-v1',closed:false,seconds:60,...change};
 tx.contextAttempted=true;
 // Capture before dispatch: an INSERT can succeed without its acknowledgment.
 // Wrong-coordinate probes still retire only their exact synthetic context.
 tx.contextCoordinates={pid:c.pid,xid:c.xid};
 await admin.query(`INSERT INTO ${schema}.contexts
  (backend_pid,transaction_id,login_name,subject_id,workspace_id,record_id,retained_revision,purpose,closed,expires_at)
  VALUES($1,$2::xid8,$3,$4,$5,$6,$7,$8,$9,clock_timestamp()+$10*interval '1 second')`,
 [c.pid,c.xid,c.login,c.actor,c.workspace,c.record,c.revision,c.purpose,c.closed,c.seconds]);
}
async function finish(tx,commit=false){
 try{await tx.finish(commit);}finally{
  const c=tx.contextCoordinates;
  if(c&&(c.pid!==tx.pid||c.xid!==tx.xid))await admin.query(`DELETE FROM ${schema}.contexts WHERE backend_pid=$1 AND transaction_id=$2::xid8`,[c.pid,c.xid]);
 }
}
async function inContext(work,{pool=pools.alice,change={}}={}){
 const tx=await begin(pool);try{await context(tx,change);return await work(tx);}finally{await finish(tx);}
}
async function deniedQuery(sql,values,expected,{pool=pools.alice,withContext=true,change={}}={}){
 const tx=await begin(pool);
 try{if(withContext)await context(tx,change);await assert.rejects(()=>tx.query(sql,values),expected);}
 finally{await finish(tx);}
}
async function retainedState(){
 const rows=(await admin.query(`SELECT * FROM (
  SELECT 'records' AS table_name,to_jsonb(r)::text AS row_text FROM ${schema}.records r
  UNION ALL SELECT 'retained',to_jsonb(r)::text FROM ${schema}.retained r
  ) snapshot ORDER BY table_name,row_text COLLATE "C"`)).rows;
 return {rows:rows.length,sha256:hash(JSON.stringify(rows))};
}
async function observedWriterWait(writer,reader,outcome){
 const end=Date.now()+3000;
 do{
  if(outcome.done)throw Error('Synthetic writer did not wait for the metadata row lock');
  const row=(await admin.query('SELECT wait_event_type,query,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[writer.pid])).rows[0];
  if(row?.wait_event_type==='Lock'&&row.query.startsWith(`UPDATE ${schema}.records SET version=version+1`)&&row.blockers.includes(reader.pid))return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }while(Date.now()<end);
 throw Error('Did not observe the exact synthetic metadata writer lock wait');
}

try{
 serverVersion=(await admin.query("SELECT current_setting('server_version_num') AS version")).rows[0].version;
 assert.ok(Number(serverVersion)>=180000&&Number(serverVersion)<190000,'This permission experiment targets PostgreSQL 18');
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_roles WHERE rolname=ANY($1::text[])',[Object.values(roles)])).rows[0].n,0);
 assert.equal((await admin.query('SELECT to_regnamespace($1) AS namespace',[schema])).rows[0].namespace,null);
 for(const [alias,name] of Object.entries(roles)){
  const password=randomBytes(32).toString('hex');
  await admin.query(`CREATE ROLE ${name} ${alias==='resolver'?'NOLOGIN':'LOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS${alias==='resolver'?'':` PASSWORD '${password}'`}`);
  createdRoles.push(name);
  if(alias!=='resolver')pools[alias]=new pg.Pool({...config,user:name,password,application_name:name});
 }
 await admin.query(`CREATE SCHEMA ${schema}`);schemaCreated=true;
 await admin.query(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`);
 await admin.query(`CREATE TABLE ${schema}.records(
  workspace_id uuid NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
  classification text NOT NULL,state text NOT NULL,owner_subject_id text NOT NULL,payload jsonb NOT NULL,
  PRIMARY KEY(workspace_id,id));
  CREATE TABLE ${schema}.retained(
   workspace_id uuid NOT NULL,record_id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
   owner_subject_id text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(workspace_id,record_id,version));
  CREATE TABLE ${schema}.contexts(
   backend_pid integer NOT NULL,transaction_id xid8 NOT NULL,login_name name NOT NULL,subject_id text NOT NULL,
   workspace_id uuid NOT NULL,record_id uuid NOT NULL,retained_revision bigint NOT NULL,purpose text NOT NULL,
   closed boolean NOT NULL,expires_at timestamptz NOT NULL,PRIMARY KEY(backend_pid,transaction_id));
  ALTER TABLE ${schema}.records ENABLE ROW LEVEL SECURITY;ALTER TABLE ${schema}.records FORCE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}.retained ENABLE ROW LEVEL SECURITY;ALTER TABLE ${schema}.retained FORCE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}.contexts ENABLE ROW LEVEL SECURITY;ALTER TABLE ${schema}.contexts FORCE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA ${schema} TO ${Object.values(roles).join(',')};
  GRANT SELECT(workspace_id,id,version,classification,state),UPDATE(version) ON ${schema}.records TO ${roles.resolver};
  GRANT SELECT(workspace_id,record_id,version),UPDATE(version) ON ${schema}.retained TO ${roles.resolver};
  GRANT SELECT ON ${schema}.contexts TO ${roles.resolver};
  CREATE POLICY exact_context ON ${schema}.contexts FOR SELECT TO ${roles.resolver}
   USING(backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id() AND login_name=session_user
    AND subject_id=session_user::text AND purpose='hold-administration-v1' AND NOT closed AND clock_timestamp()<expires_at);
  CREATE POLICY metadata_select ON ${schema}.records FOR SELECT TO ${roles.resolver}
   USING(classification='research' AND state IN('active','quarantined','withdrawn') AND EXISTS(
    SELECT 1 FROM ${schema}.contexts c WHERE c.workspace_id=records.workspace_id AND c.record_id=records.id AND c.retained_revision<=records.version
     AND EXISTS(SELECT 1 FROM ${schema}.retained h WHERE h.workspace_id=c.workspace_id AND h.record_id=c.record_id AND h.version=c.retained_revision)));
  CREATE POLICY metadata_lock ON ${schema}.records FOR UPDATE TO ${roles.resolver}
   USING(classification='research' AND state IN('active','quarantined','withdrawn') AND EXISTS(
    SELECT 1 FROM ${schema}.contexts c WHERE c.workspace_id=records.workspace_id AND c.record_id=records.id AND c.retained_revision<=records.version
     AND EXISTS(SELECT 1 FROM ${schema}.retained h WHERE h.workspace_id=c.workspace_id AND h.record_id=c.record_id AND h.version=c.retained_revision))) WITH CHECK(false);
  CREATE POLICY retained_select ON ${schema}.retained FOR SELECT TO ${roles.resolver}
   USING(EXISTS(SELECT 1 FROM ${schema}.contexts c WHERE c.workspace_id=retained.workspace_id AND c.record_id=retained.record_id AND c.retained_revision=retained.version));
  CREATE POLICY retained_lock ON ${schema}.retained FOR UPDATE TO ${roles.resolver}
   USING(EXISTS(SELECT 1 FROM ${schema}.contexts c WHERE c.workspace_id=retained.workspace_id AND c.record_id=retained.record_id AND c.retained_revision=retained.version)) WITH CHECK(false);
  GRANT SELECT(workspace_id,id,version,state),UPDATE(version,state) ON ${schema}.records TO ${roles.writer};
  CREATE POLICY writer_select ON ${schema}.records FOR SELECT TO ${roles.writer} USING(true);
  CREATE POLICY writer_update ON ${schema}.records FOR UPDATE TO ${roles.writer} USING(true) WITH CHECK(true)`);
 for(const [workspace,id,version,state,classification] of [[W,A,'11','withdrawn','research'],[W,B,'3','active','research'],[OTHER,C,'9','quarantined','research'],[W,SEALED,'7','active','sealed']]){
  const payload=JSON.stringify(classification==='sealed'?{}:{private:CANARY});
  await admin.query(`INSERT INTO ${schema}.records VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[workspace,id,version,classification,state,CANARY,payload]);
  await admin.query(`INSERT INTO ${schema}.retained VALUES($1,$2,$3,$4,$5::jsonb)`,[workspace,id,id===A?'7':version,CANARY,payload]);
 }
 // Ownership needs schema CREATE while transferred; it is revoked before any
 // caller can use these fixed, schema-qualified, non-dynamic fixture helpers.
 await admin.query(`GRANT CREATE ON SCHEMA ${schema} TO ${roles.resolver}`);
 const functions=[
  [`lock_metadata(uuid,uuid,bigint,text)`,`CREATE FUNCTION ${schema}.lock_metadata(p_workspace uuid,p_record uuid,p_revision bigint,p_actor text)
   RETURNS TABLE(workspace_id uuid,record_id uuid,version bigint,classification text,state text)
   LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM ${schema}.contexts c WHERE c.workspace_id=p_workspace AND c.record_id=p_record AND c.retained_revision=p_revision AND c.subject_id=p_actor)
     THEN RAISE EXCEPTION 'Synthetic hold metadata unavailable' USING ERRCODE='P0001';END IF;
    PERFORM h.version FROM ${schema}.retained h WHERE h.workspace_id=p_workspace AND h.record_id=p_record AND h.version=p_revision FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Synthetic hold metadata unavailable' USING ERRCODE='P0001';END IF;
    RETURN QUERY SELECT r.workspace_id,r.id,r.version,r.classification,r.state FROM ${schema}.records r
     WHERE r.workspace_id=p_workspace AND r.id=p_record FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Synthetic hold metadata unavailable' USING ERRCODE='P0001';END IF;
    IF NOT EXISTS(SELECT 1 FROM ${schema}.contexts c WHERE c.workspace_id=p_workspace AND c.record_id=p_record AND c.retained_revision=p_revision AND c.subject_id=p_actor)
     THEN RAISE EXCEPTION 'Synthetic hold metadata unavailable' USING ERRCODE='P0001';END IF;
   END $fn$`],
  [`scan_metadata()`,`CREATE FUNCTION ${schema}.scan_metadata()
   RETURNS TABLE(workspace_id uuid,record_id uuid,version bigint,classification text,state text)
   LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
    SELECT r.workspace_id,r.id,r.version,r.classification,r.state FROM ${schema}.records r FOR SHARE $fn$`],
  [`execution_identity()`,`CREATE FUNCTION ${schema}.execution_identity() RETURNS TABLE(effective_role name,login_role name)
   LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $fn$ SELECT current_user,session_user $fn$`],
  [`negative_probe(text,uuid,uuid,bigint)`,`CREATE FUNCTION ${schema}.negative_probe(p_kind text,p_workspace uuid,p_record uuid,p_revision bigint) RETURNS jsonb
   LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
   DECLARE result jsonb;
   BEGIN
    CASE p_kind
     WHEN 'payload' THEN SELECT r.payload INTO result FROM ${schema}.records r WHERE r.workspace_id=p_workspace AND r.id=p_record;
     WHEN 'owner' THEN SELECT to_jsonb(r.owner_subject_id) INTO result FROM ${schema}.records r WHERE r.workspace_id=p_workspace AND r.id=p_record;
     WHEN 'whole-row' THEN SELECT to_jsonb(r) INTO result FROM ${schema}.records r WHERE r.workspace_id=p_workspace AND r.id=p_record;
     WHEN 'payload-predicate' THEN SELECT to_jsonb(r.version) INTO result FROM ${schema}.records r WHERE r.workspace_id=p_workspace AND r.id=p_record AND r.payload IS NOT NULL;
     WHEN 'retained-payload' THEN SELECT h.payload INTO result FROM ${schema}.retained h WHERE h.workspace_id=p_workspace AND h.record_id=p_record AND h.version=p_revision;
     WHEN 'update-version' THEN UPDATE ${schema}.records SET version=version+1 WHERE workspace_id=p_workspace AND id=p_record;
     WHEN 'noop-version' THEN UPDATE ${schema}.records SET version=version WHERE workspace_id=p_workspace AND id=p_record;
     WHEN 'update-retained' THEN UPDATE ${schema}.retained SET version=version WHERE workspace_id=p_workspace AND record_id=p_record AND version=p_revision;
     WHEN 'update-payload' THEN UPDATE ${schema}.records SET payload='{}'::jsonb WHERE workspace_id=p_workspace AND id=p_record;
     WHEN 'insert' THEN INSERT INTO ${schema}.records VALUES(p_workspace,p_record,1,'research','active','synthetic','{}'::jsonb);
     WHEN 'delete' THEN DELETE FROM ${schema}.records WHERE workspace_id=p_workspace AND id=p_record;
     WHEN 'truncate' THEN TRUNCATE ${schema}.records;
     WHEN 'disable-rls' THEN ALTER TABLE ${schema}.records DISABLE ROW LEVEL SECURITY;
     ELSE RAISE EXCEPTION 'Unknown synthetic probe';
    END CASE;
    RETURN result;
   END $fn$`],
 ];
 for(const [signature,definition] of functions){
  await admin.query(definition);await admin.query(`REVOKE ALL ON FUNCTION ${schema}.${signature} FROM PUBLIC`);
  await admin.query(`ALTER FUNCTION ${schema}.${signature} OWNER TO ${roles.resolver}`);
 }
 await admin.query(`REVOKE CREATE ON SCHEMA ${schema} FROM ${roles.resolver}`);
 for(const [signature] of functions)await admin.query(`GRANT EXECUTE ON FUNCTION ${schema}.${signature} TO ${roles.alice},${roles.bob}`);

 const roleRows=(await admin.query('SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname',[Object.values(roles)])).rows;
 assert.equal(roleRows.length,4);
 for(const row of roleRows){assert.equal(row.rolcanlogin,row.rolname!==roles.resolver);for(const flag of ['rolsuper','rolinherit','rolcreaterole','rolcreatedb','rolreplication','rolbypassrls'])assert.equal(row[flag],false);}
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_auth_members WHERE member=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1::text[]))',[Object.values(roles)])).rows[0].n,0);
 const tables=(await admin.query('SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,r.rolname AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname=$1 AND c.relkind=\'r\' ORDER BY c.relname',[schema])).rows;
 assert.equal(tables.length,3);for(const row of tables){assert.equal(row.owner,'postgres');assert.equal(row.relrowsecurity,true);assert.equal(row.relforcerowsecurity,true);}
 for(const [table,allowed] of [['records',['workspace_id','id','version','classification','state']],['retained',['workspace_id','record_id','version']]]){
  const columns=(await admin.query(`SELECT a.attname,has_column_privilege($1,c.oid,a.attnum,'SELECT') AS can_select,has_column_privilege($1,c.oid,a.attnum,'UPDATE') AS can_update
   FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$2 AND c.relname=$3 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,[roles.resolver,schema,table])).rows;
  for(const col of columns){assert.equal(col.can_select,allowed.includes(col.attname));assert.equal(col.can_update,col.attname==='version');}
  for(const privilege of ['SELECT','UPDATE','INSERT','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal((await admin.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[roles.resolver,schema+'.'+table,privilege])).rows[0].allowed,false);
 }
 const policies=(await admin.query('SELECT p.polname,p.polcmd,p.polpermissive,pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND p.polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname=$2)]::oid[] ORDER BY p.polname',[schema,roles.resolver])).rows;
 assert.deepEqual(policies.map(p=>p.polname),['exact_context','metadata_lock','metadata_select','retained_lock','retained_select']);
 assert.ok(policies.every(p=>p.polpermissive));for(const p of policies.filter(p=>p.polcmd==='w'))assert.equal(p.check_expr,'false');
 const fnRows=(await admin.query('SELECT p.proname,p.prosecdef,p.proconfig,r.rolname AS owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname=$1',[schema])).rows;
 assert.equal(fnRows.length,4);for(const fn of fnRows){assert.equal(fn.owner,roles.resolver);assert.equal(fn.prosecdef,true);assert.deepEqual(fn.proconfig,['search_path=pg_catalog']);}
 assert.equal((await admin.query('SELECT has_schema_privilege($1,$2,\'CREATE\') AS allowed',[roles.resolver,schema])).rows[0].allowed,false);
 check('the nonlogin resolver owns only fixed helpers and has exact metadata-column SELECT plus UPDATE(version), forced context RLS and no administrative or role membership privilege');

 const identity=(await pools.alice.query(`SELECT * FROM ${schema}.execution_identity()`)).rows[0];
 assert.deepEqual(identity,{effective_role:roles.resolver,login_role:roles.alice});
 const expected={workspace_id:W,record_id:A,version:'11',classification:'research',state:'withdrawn'};
 const selected=await inContext(async tx=>(await tx.query(lockSQL,args)).rows);
 assert.deepEqual(selected,[expected]);assert.deepEqual(Object.keys(selected[0]),projection);assert.ok(!JSON.stringify(selected).includes(CANARY));
 check('a real low-privilege caller invokes the resolver owner and locks only the exact current metadata with original retained revision seven kept separate from current eleven');

 await deniedQuery(lockSQL,args,unavailable,{withContext:false});
 const bare=await begin(pools.alice);
 try{await bare.query("SELECT set_config('garden.metadata_subject',$1,true),set_config('garden.metadata_purpose','hold-administration-v1',true)",[roles.alice]);await assert.rejects(()=>bare.query(lockSQL,args),unavailable);}finally{await finish(bare);}
 assert.deepEqual((await pools.alice.query(`SELECT * FROM ${schema}.scan_metadata()`)).rows,[]);
 check('missing owner-issued context and caller-set identity or purpose settings confer no metadata visibility or lock');

 const wrongContexts=[{purpose:'research'},{purpose:'hold-administration-v2'},{login:roles.bob},{actor:roles.bob},{workspace:OTHER},{record:B},{revision:'8'},{closed:true},{seconds:-1}];
 for(const change of wrongContexts)await deniedQuery(lockSQL,args,unavailable,{change});
 for(const field of ['pid','xid']){
  const tx=await begin(pools.alice);
  try{await context(tx,field==='pid'?{pid:tx.pid+1000000}:{xid:(BigInt(tx.xid)+1000000n).toString()});await assert.rejects(()=>tx.query(lockSQL,args),unavailable);}finally{await finish(tx);}
 }
 await deniedQuery(lockSQL,args,unavailable,{pool:pools.bob});
 check('wrong purpose, login, actor, workspace, record, retained revision, PID, xid, expired or closed context cannot authorize the requested target');

 for(const values of [[OTHER,A,'7',roles.alice],[W,B,'7',roles.alice],[W,randomUUID(),'7',roles.alice],[W,A,'8',roles.alice],[W,A,'7',roles.bob]])await deniedQuery(lockSQL,values,unavailable);
 await deniedQuery(lockSQL,[W,A,'8',roles.alice],unavailable,{change:{revision:'8'}});
 await deniedQuery(lockSQL,[W,SEALED,'7',roles.alice],unavailable,{change:{record:SEALED}});
 const scan=await inContext(async tx=>(await tx.query(`SELECT * FROM ${schema}.scan_metadata()`)).rows);
 assert.deepEqual(scan,[expected]);assert.ok(!JSON.stringify(scan).includes(CANARY));
 check('caller arguments cannot retarget a valid context; absent retained coordinates and sealed current rows deny, and an unrestricted metadata scan remains confined to one authorized row');

 const before=await retainedState();
 for(const probe of ['payload','owner','whole-row','payload-predicate','retained-payload'])await deniedQuery(`SELECT ${schema}.negative_probe($1,$2,$3,$4)`,[probe,W,A,'7'],tableDenied(probe==='retained-payload'?'retained':'records'));
 assert.deepEqual(await retainedState(),before);
 check('the resolver cannot select payload or owner columns, whole rows, payload predicates or retained private content, even with a valid locking context');

 for(const probe of ['update-version','noop-version','update-retained'])await deniedQuery(`SELECT ${schema}.negative_probe($1,$2,$3,$4)`,[probe,W,A,'7'],writeDenied(probe==='update-retained'?'retained':'records'));
 for(const probe of ['update-payload','insert','delete','truncate'])await deniedQuery(`SELECT ${schema}.negative_probe($1,$2,$3,$4)`,[probe,W,probe==='insert'?randomUUID():A,'7'],tableDenied('records'));
 await deniedQuery(`SELECT ${schema}.negative_probe($1,$2,$3,$4)`,['disable-rls',W,A,'7'],error=>error.code==='42501'&&error.message==='must be owner of table records');
 assert.deepEqual(await retainedState(),before);
 check('UPDATE(version), including no-op updates and retained coordinates, reaches the false write check; payload updates, INSERT, DELETE, TRUNCATE and policy disabling remain denied with all rows unchanged');

 for(const table of ['records','retained','contexts'])await deniedQuery(`SELECT * FROM ${schema}.${table}`,[],tableDenied(table));
 await deniedQuery(`INSERT INTO ${schema}.contexts VALUES(pg_backend_pid(),pg_current_xact_id(),session_user,session_user,$1,$2,7,'hold-administration-v1',false,clock_timestamp()+interval '1 hour')`,[W,A],tableDenied('contexts'),{withContext:false});
 for(const target of [roles.resolver,'postgres',roles.bob])await deniedQuery('SET LOCAL ROLE '+target,[],error=>error.code==='42501'&&error.message==='permission denied to set role "'+target+'"',{withContext:false});
 await deniedQuery(`CREATE FUNCTION ${schema}.caller_replacement() RETURNS integer LANGUAGE sql AS 'SELECT 1'`,[],error=>error.code==='42501'&&error.message==='permission denied for schema '+schema,{withContext:false});
 assert.deepEqual(await retainedState(),before);
 check('actual low-privilege logins cannot read raw fixture tables, mint context, SET ROLE to resolver or privileged peers, or create a replacement resolver helper');

 const reader=await begin(pools.alice),writer=await begin(pools.writer);let outcome=null;
 try{
  await context(reader);assert.deepEqual((await reader.query(lockSQL,args)).rows,[expected]);
  outcome={done:false,error:null,value:null};
  outcome.promise=writer.query(`UPDATE ${schema}.records SET version=version+1,state='quarantined' WHERE workspace_id=$1 AND id=$2 RETURNING version::text`,[W,A]).then(value=>{outcome.done=true;outcome.value=value;},error=>{outcome.done=true;outcome.error=error;});
  await observedWriterWait(writer,reader,outcome);
  assert.equal((await admin.query(`SELECT version::text FROM ${schema}.records WHERE workspace_id=$1 AND id=$2`,[W,A])).rows[0].version,'11');
  const unrelated=await begin(pools.writer);
  try{assert.equal((await unrelated.query(`UPDATE ${schema}.records SET version=version+1 WHERE workspace_id=$1 AND id=$2`,[W,B])).rowCount,1);}finally{await finish(unrelated);}
  assert.equal(outcome.done,false);await finish(reader,true);await outcome.promise;if(outcome.error)throw outcome.error;
  assert.equal(outcome.value.rowCount,1);assert.deepEqual(outcome.value.rows,[{version:'12'}]);await finish(writer,true);
 }finally{await finish(reader);if(outcome)await outcome.promise;await finish(writer);}
 const current=await inContext(async tx=>(await tx.query(lockSQL,args)).rows);
 assert.deepEqual(current,[{...expected,version:'12',state:'quarantined'}]);
 assert.equal((await admin.query(`SELECT version::text FROM ${schema}.retained WHERE workspace_id=$1 AND record_id=$2`,[W,A])).rows[0].version,'7');
 check('FOR SHARE visibly blocks an actual non-key writer on the same row while another record remains writable; releasing the reader permits one committed version change without rewriting the retained revision');

 assert.equal((await admin.query(`SELECT count(*)::int AS n FROM ${schema}.contexts`)).rows[0].n,0);
 assert.equal(sessions.size,0);
 check('all fixture transactions and exact PID/xid contexts are retired before teardown');
}catch(error){failure=error;}
finally{
 const cleanupErrors=[];
 for(const tx of [...sessions])try{await finish(tx);}catch(error){cleanupErrors.push(error);}
 for(const pool of Object.values(pools))try{await pool.end();}catch(error){cleanupErrors.push(error);}
 if(schemaCreated)try{await admin.query(`DROP SCHEMA ${schema} CASCADE`);}catch(error){cleanupErrors.push(error);}
 for(const role of [...createdRoles].reverse())try{await admin.query(`DROP ROLE ${role}`);}catch(error){cleanupErrors.push(error);}
 try{
  assert.equal((await admin.query('SELECT to_regnamespace($1) AS namespace',[schema])).rows[0].namespace,null);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_roles WHERE rolname=ANY($1::text[])',[createdRoles])).rows[0].n,0);
  teardownVerified=true;
 }catch(error){cleanupErrors.push(error);}
 try{await admin.end();}catch(error){cleanupErrors.push(error);}
 if(cleanupErrors.length)failure=new AggregateError([...(failure?[failure]:[]),...cleanupErrors],'Synthetic metadata permission verification or exact teardown failed');
}
if(failure)throw failure;
assert.equal(teardownVerified,true);check('finally teardown removed only this experiment\'s owned schema, functions, contexts and roles');
await mkdir('data-evidence',{recursive:true});
await writeFile('data-evidence/lifecycle-hold-metadata-permissions-results.json',JSON.stringify({
 tested_sha:process.env.GITHUB_SHA,source_sha256:hash(await readFile(new URL(import.meta.url))),checks,postgresql_server_version_num:serverVersion,
 real_postgresql:true,synthetic_only:true,caller_logins:true,fixture_teardown_verified:true,
 existing_garden_rows_or_policies_modified:false,production_metadata_resolver:false,purpose_authority_verified:false,
 lifecycle_release_implemented:false,provider_calls:false,physical_erasure:false,production_verified:false,
},null,2)+'\n');
console.log('PASS: '+checks.length+' actual PostgreSQL hold metadata permission checks');
