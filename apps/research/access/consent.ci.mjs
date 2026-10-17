import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor,PolicyError} from './policy-context.mjs';
import {createRecordRepository} from './record-delivery.mjs';
import {createConsentAdministration} from './consent-administration.mjs';
import {createPermittedUseTransactions} from './permitted-use.mjs';
import {evaluatePermittedUse} from '../../../packages/domain/src/consent/purpose.mjs';
if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Consent fixtures require isolated CI');
const base={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD};
const admin=new pg.Pool({...base,max:3}),pools={},checks=[],check=name=>checks.push({name,result:'pass'}),W=randomUUID(),OTHER=randomUUID(),terms={id:randomUUID(),version:'1',digest:'a'.repeat(64)},H='b'.repeat(64),headers=new Headers({'synthetic-subject':'alice'});
const now=Date.now(),date=offset=>new Date(now+offset).toISOString();
const policy=(recordId,extra={})=>({schemaVersion:1,recordId,basis:'consent-required',inputs:[],terms,subjects:[{subjectId:'narrator',authority:'self'}],purposes:[],reasonDigest:H,...extra});
const grant=(recordId,purpose='research',extra={})=>({schemaVersion:1,id:randomUUID(),recordId,subjectId:'narrator',grantorId:'narrator',authority:'self',authorityDigest:null,authorityExpiresAt:null,terms,purpose,derivativesAllowed:false,validFrom:date(-60000),expiresAt:date(3600000),evidenceDigest:H,...extra});
async function inRole(pool,role,fn){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
try{
 for(const[alias,cap]of Object.entries({issuer:'garden_context_issuer',query:'garden_research',consent:'garden_consent_admin',publisher:'garden_publisher',worker:'garden_worker'})){
  const name='garden_consent_'+alias+'_ci',password=randomBytes(32).toString('hex');
  await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE, SET TRUE`);pools[alias]=new pg.Pool({...base,user:name,password,max:3});
 }
 for(const workspace of[W,OTHER]){
  await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[workspace,'Synthetic consent workspace',H]);
  await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,'alice','active',$2)",[workspace,H]);
  await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,'alice','researcher','alice',clock_timestamp()+interval '30 days')",[workspace]);
 }
 const executor=createPolicyExecutor({identity:{viewer:async()=>({id:'alice',verified:true})},issuerPool:pools.issuer,researchPool:pools.query}),records=createRecordRepository(executor);
 const consent=createConsentAdministration({pool:pools.consent,enabled:()=>true,authorize:async(h,s)=>({id:'synthetic-consent-reviewer',verified:true,privilegedAssurance:true,...s})});
 // Test-only assertions above simulate a verified authorizer, not actual passkeys.
 const publisher=createPermittedUseTransactions({pool:pools.publisher,kind:'publication',enabled:()=>true,authorize:async()=>true});
 const worker=createPermittedUseTransactions({pool:pools.worker,kind:'preservation',enabled:()=>true,authorize:async()=>true});
 await consent.registerTerms(headers,W,terms);
 async function resource(title,workspace=W){const id=randomUUID();await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state,payload) VALUES($1,$2,'alice','research','active',$3::jsonb)",[id,workspace,JSON.stringify({title,kind:'source',summary:'Synthetic fixture only'})]);await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,'alice',true,true,'research',clock_timestamp()+interval '30 days')",[workspace,id]);return id;}
 const source=await resource('Consent-controlled synthetic interview');
 await assert.rejects(()=>records.find(headers,W,source),PolicyError);assert.equal((await records.search(headers,W)).total,'0');check('active membership and a record grant do not substitute for a reviewed permitted-use policy');
 await consent.setPolicy(headers,W,policy(source),'0');
 const rootResearch=grant(source);await consent.recordGrant(headers,W,rootResearch);
 assert.equal((await records.find(headers,W,source)).id,source);check('explicit research consent enables only already-authorized research reads');
 const publish=(id,purposes=['public-display'],requestId=randomUUID(),work=async()=>true)=>publisher.run({},{workspaceId:W,recordId:id,requestId,purposes},work);
 await assert.rejects(()=>publish(source));await assert.rejects(()=>worker.run({},{workspaceId:W,recordId:source,requestId:randomUUID(),purposes:['preservation']},async()=>true));check('research consent grants neither public display nor archival preservation');
 const display=grant(source,'public-display');await consent.recordGrant(headers,W,display);assert.equal(await publish(source),true);await assert.rejects(()=>publish(source,['public-display','name-attribution']));await assert.rejects(()=>publish(source,['promotional-endorsement']));check('display, name attribution and endorsement have independent permission checks');
 const child=await resource('Synthetic derivative'),grandchild=await resource('Synthetic translated derivative');
 const childPolicy=policy(child,{basis:'inherits-only',inputs:[source],subjects:[],terms:null}),grandchildPolicy=policy(grandchild,{basis:'inherits-only',inputs:[child],subjects:[],terms:null});
 await consent.setPolicy(headers,W,childPolicy,'0');await consent.setPolicy(headers,W,grandchildPolicy,'0');await assert.rejects(()=>records.find(headers,W,child),PolicyError);check('root-only permission does not silently cover derivatives');
 const derivedResearch=grant(source,'research',{derivativesAllowed:true});await consent.recordGrant(headers,W,derivedResearch);assert.equal((await records.find(headers,W,grandchild)).id,grandchild);check('nested derivatives inherit explicit permitted use from all ancestors');
 await consent.withdraw(headers,W,derivedResearch.id,H);await assert.rejects(()=>records.find(headers,W,source),PolicyError);await assert.rejects(()=>records.find(headers,W,grandchild),PolicyError);assert.equal(await publish(source),true);check('withdrawing one purpose retires older grants of that purpose without affecting display consent');
 const freshResearch=grant(source,'research',{derivativesAllowed:true});await consent.recordGrant(headers,W,freshResearch);await consent.withdraw(headers,W,derivedResearch.id,H);assert.equal((await records.find(headers,W,source)).id,source);check('idempotent withdrawal replay cannot revoke a later newly evidenced consent');
 // The trusted research executor now owns the same workspace gate as withdrawal.
 // Observe two independent transactions; awaiting withdrawal inside the paused
 // research callback would make the fixture wait on its own transaction.
 let readEntered,readResume,readPid,withdrawalDone=false;
 const readingInside=new Promise(resolve=>{readEntered=resolve;}),resumeRead=new Promise(resolve=>{readResume=resolve;});
 const reading=executor.run(headers,{workspaceId:W},async c=>{
  readPid=(await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.equal((await c.query('SELECT id FROM garden_private.record_envelopes WHERE id=$1',[source])).rows.length,1);
  readEntered();await resumeRead;
  assert.equal((await c.query('SELECT id FROM garden_private.record_envelopes WHERE id=$1',[source])).rows.length,1);
 }).then(value=>({value}),error=>({error}));
 let withdrawingResearch;
 try{
  await Promise.race([readingInside,reading.then(result=>{throw result.error??Error('Research did not reach the expected pause');})]);
  withdrawingResearch=consent.withdraw(headers,W,freshResearch.id,H).then(value=>{withdrawalDone=true;return {value};},error=>{withdrawalDone=true;return {error};});
  const end=Date.now()+3000;let observed=false;
  do{
   const rows=(await admin.query("SELECT pid FROM pg_stat_activity WHERE usename='garden_consent_consent_ci' AND wait_event_type='Lock' AND wait_event='advisory' AND query LIKE '%withdraw_consent_grant%' AND $1::integer=ANY(pg_blocking_pids(pid))",[readPid])).rows;
   if(rows.length===1){observed=true;break;}
   assert.equal(withdrawalDone,false);await new Promise(resolve=>setTimeout(resolve,10));
  }while(Date.now()<end);
  assert.equal(observed,true);assert.equal(withdrawalDone,false);readResume();
  const readResult=await reading;if(readResult.error)throw readResult.error;
  const withdrawalResult=await withdrawingResearch;if(withdrawalResult.error)throw withdrawalResult.error;
 }finally{readResume();await reading;if(withdrawingResearch)await withdrawingResearch;}
 await assert.rejects(()=>records.find(headers,W,source),PolicyError);
 check('research and consent withdrawal have an observed serialized order; the next research transaction denies');
 const expiredSource=await resource('Expired permission fixture');await consent.setPolicy(headers,W,policy(expiredSource),'0');await consent.recordGrant(headers,W,grant(expiredSource,'public-display',{expiresAt:date(-1000)}));await assert.rejects(()=>publish(expiredSource));check('expired permission blocks a new use admission');
 const guardianSource=await resource('Guardian authority synthetic fixture'),guardianPolicy=policy(guardianSource,{subjects:[{subjectId:'synthetic-minor',authority:'guardian'}]});await consent.setPolicy(headers,W,guardianPolicy,'0');
 await assert.rejects(()=>consent.recordGrant(headers,W,grant(guardianSource,'research',{subjectId:'synthetic-minor',grantorId:'synthetic-minor'})));await consent.recordGrant(headers,W,grant(guardianSource,'research',{subjectId:'synthetic-minor',grantorId:'synthetic-guardian',authority:'guardian',authorityDigest:H,authorityExpiresAt:date(-1000)}));await assert.rejects(()=>records.find(headers,W,guardianSource),PolicyError);check('guardian authority and its expiry cannot be replaced by a self-asserted child grant');
 const otherInput=await resource('Mixed-purpose input');await consent.setPolicy(headers,W,policy(otherInput),'0');await consent.recordGrant(headers,W,grant(otherInput,'preservation',{derivativesAllowed:true}));
 const mixed=await resource('Mixed derivative');await consent.setPolicy(headers,W,policy(mixed,{basis:'inherits-only',inputs:[source,otherInput],subjects:[],terms:null}),'0');await assert.rejects(()=>records.find(headers,W,mixed),PolicyError);check('mixed-purpose derivatives require the intersection of all inputs, not their union');
 const newTerms={...terms,version:'2',digest:'c'.repeat(64)};await consent.registerTerms(headers,W,newTerms);await consent.setPolicy(headers,W,policy(source,{terms:newTerms}),'1');await assert.rejects(()=>publish(source));await assert.rejects(()=>consent.setPolicy(headers,W,policy(source),'2'));check('terms changes require new consent and cannot roll back to resurrect old grants');
 await assert.rejects(()=>consent.setPolicy(headers,W,policy(source,{basis:'no-consent-required',subjects:[],terms:null,purposes:['public-display']}),'2'));await assert.rejects(()=>consent.setPolicy(headers,W,policy(child,{basis:'no-consent-required',subjects:[],terms:null,purposes:['research']}),'1'));check('no-consent labels cannot remove recorded subject or derivative obligations');
 await assert.rejects(()=>admin.query("UPDATE garden_private.record_envelopes SET payload='{}' WHERE id=$1",[source]));check('consented content cannot be replaced in place even through an administrative content edit');
 const cycleA=await resource('Cycle A'),cycleB=await resource('Cycle B');await consent.setPolicy(headers,W,policy(cycleA,{basis:'inherits-only',inputs:[cycleB],terms:null,subjects:[]}),'0');await assert.rejects(()=>consent.setPolicy(headers,W,policy(cycleB,{basis:'inherits-only',inputs:[cycleA],terms:null,subjects:[]}),'0'));check('cycles and unresolved parents cannot yield an allowed use');
 const outsider=await resource('Other workspace',OTHER);await assert.rejects(()=>consent.setPolicy(headers,W,policy(mixed,{basis:'inherits-only',inputs:[source,otherInput,outsider],terms:null,subjects:[]}),'1'));check('cross-workspace derivative references fail foreign-key validation');
 for(const sql of ['SELECT * FROM garden_control.consent_grants','SELECT * FROM garden_control.consent_withdrawals','SELECT * FROM garden_control.use_receipts','SET ROLE garden_consent_admin'])await assert.rejects(()=>inRole(pools.query,'garden_research',c=>c.query(sql)),e=>e.code==='42501');check('ordinary research sessions cannot inspect or alter consent administration data');
 await assert.rejects(()=>inRole(pools.query,'garden_research',c=>c.query('SELECT garden_control.record_consent_grant($1,$2,$3)',[W,JSON.stringify(rootResearch),'spoofed'])));check('ordinary sessions cannot mint new grants');
 for(const table of ['consent_grants','consent_withdrawals','consent_terms','use_policy_revisions','consent_dependencies','use_receipts'])await assert.rejects(()=>admin.query('UPDATE garden_control.'+table+' SET '+(table==='use_policy_revisions'?'recorded_by=recorded_by':table==='consent_dependencies'?'input_id=input_id':table==='use_receipts'?'admitted_at=admitted_at':'recorded_by=recorded_by')));check('grant, withdrawal, policy, dependency and use histories reject ordinary SQL rewrites');
 // Serialize withdrawal against transactional use. This writes only a synthetic
 // public probe inside the transaction, never external objects or messages.
 await admin.query('CREATE TABLE garden_publication.consent_ci_probe(id uuid PRIMARY KEY)');await admin.query('GRANT INSERT,SELECT ON garden_publication.consent_ci_probe TO garden_publisher');
 const raceSource=await resource('Race fixture');await consent.setPolicy(headers,W,policy(raceSource),'0');const raceGrant=grant(raceSource,'public-display');await consent.recordGrant(headers,W,raceGrant);
 let entered,release;const inside=new Promise(r=>entered=r),resume=new Promise(r=>release=r),rid=randomUUID();
 const publishing=publish(raceSource,['public-display'],randomUUID(),async c=>{await c.query('INSERT INTO garden_publication.consent_ci_probe VALUES($1)',[rid]);entered();await resume;return true;});
 await inside;let withdrawalFinished=false;const withdrawing=consent.withdraw(headers,W,raceGrant.id,H).then(()=>{withdrawalFinished=true;});
 await new Promise(r=>setTimeout(r,50));assert.equal(withdrawalFinished,false);release();await publishing;await withdrawing;await assert.rejects(()=>publish(raceSource));check('withdrawal and database-only publication admission have an explicit serialized order');
 const expiring=await resource('Mid-operation expiration');await consent.setPolicy(headers,W,policy(expiring),'0');const short=grant(expiring,'public-display',{validFrom:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3000).toISOString()});await consent.recordGrant(headers,W,short);const rolledBack=randomUUID();let expiryWorkEntered=false;
 await assert.rejects(()=>publish(expiring,['public-display'],randomUUID(),async c=>{expiryWorkEntered=true;await c.query('INSERT INTO garden_publication.consent_ci_probe VALUES($1)',[rolledBack]);await c.query('SELECT pg_sleep($1)',[Math.max(0,(Date.parse(short.expiresAt)-Date.now())/1000)+0.1]);}));assert.equal(expiryWorkEntered,true);assert.equal((await admin.query('SELECT id FROM garden_publication.consent_ci_probe WHERE id=$1',[rolledBack])).rows.length,0);check('expiry after transactional work is rechecked and rolls back staged writes');
 const receiptSource=await resource('Receipt version fixture');await consent.setPolicy(headers,W,policy(receiptSource),'0');await consent.recordGrant(headers,W,grant(receiptSource,'public-display'));const reuse=randomUUID();await publish(receiptSource,['public-display'],reuse);await consent.setPolicy(headers,W,policy(receiptSource,{reasonDigest:'d'.repeat(64)}),'1');await assert.rejects(()=>publish(receiptSource,['public-display'],reuse));await publish(receiptSource,['public-display']);check('a receipt cannot be rebound to a changed policy revision even when current permission remains valid');
 const paritySource=await resource('Pure evaluator parity');await consent.setPolicy(headers,W,policy(paritySource),'0');const parityGrant=grant(paritySource,'public-display',{derivativesAllowed:true});await consent.recordGrant(headers,W,parityGrant);
 for(const purpose of ['preservation','research','public-display','name-attribution','promotional-endorsement']){
  const local=evaluatePermittedUse({recordId:paritySource,purpose,policies:[policy(paritySource)],grants:[parityGrant],withdrawnGrantIds:[],now:Date.now()});const db=(await admin.query('SELECT garden_control.consent_allows($1,$2,$3,clock_timestamp()) AS allowed',[W,paritySource,purpose])).rows[0];assert.equal(local.allowed,db.allowed);
 }check('pure consent matrix and authoritative PostgreSQL decisions agree on all five purposes');
 await mkdir('identity-evidence',{recursive:true});await writeFile('identity-evidence/consent-results.json',JSON.stringify({testedSha:process.env.GITHUB_SHA,checks,synthetic:true,realPasskeyVerification:false,productionVerified:false},null,2)+'\n');console.log('PASS: '+checks.length+' real PostgreSQL purpose, consent, RLS and race checks');
}finally{for(const pool of Object.values(pools))await pool.end();await admin.end();}
