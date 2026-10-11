/** Real PostgreSQL scoped review workflow; strictly synthetic, no hosted resource. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor} from '../access/policy-context.mjs';
import {createHistoricalRepository} from '../data/historical-repository.mjs';
import {createReviewRepository} from './repository.mjs';
import {allowSyntheticResearchUse} from '../access/consent-test-fixture.mjs';
import {presentReview,REVIEW_RULES,ReviewError} from '../../../packages/domain/src/review/states.mjs';
import {entity} from '../../../tests/data/fixtures.mjs';
import {GENESIS,verifyAuditPage} from '../../../packages/domain/src/audit/ledger.mjs';
if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='neondb')throw Error('Review fixture requires isolated local CI');
const config={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD,max:3,connectionTimeoutMillis:5000};
const admin=new pg.Pool(config),pools=[],checks=[],W=randomUUID(),OTHER=randomUUID(),policy='e'.repeat(64),H=s=>new Headers({'synthetic-subject':s});
const check=name=>{checks.push({name,result:'pass'});console.log('REVIEW '+checks.length+': '+name);};
const roleAssignments={alice:['researcher','editor','reviewer','rights_reviewer'],bob:['editor'],carl:['editor'],dave:['reviewer'],rhea:['rights_reviewer'],eve:['researcher'],admin:['administrator']};
async function login(name,cap){const password=randomBytes(32).toString('hex');await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);await admin.query(`GRANT ${cap} TO ${name} WITH INHERIT FALSE,SET TRUE`);const p=new pg.Pool({...config,user:name,password});pools.push(p);return p;}
try{
 const issuer=await login('garden_reviews_issuer_ci','garden_context_issuer'),research=await login('garden_reviews_query_ci','garden_research');
 const executor=createPolicyExecutor({identity:{viewer:async h=>h.get('synthetic-subject')?{id:h.get('synthetic-subject'),verified:true}:null},issuerPool:issuer,researchPool:research});
 const records=createHistoricalRepository(executor),reviews=createReviewRepository(executor);
 for(const id of [W,OTHER])await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[id,'Synthetic scoped review',policy]);
 for(const who of Object.keys(roleAssignments))await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,who,policy]);
 for(const[who,roles]of Object.entries(roleAssignments))for(const role of roles)await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,$3,'alice',clock_timestamp()+interval '1 hour')",[W,who,role]);
 async function record({unknown=false,hidden=false}={}){
  const id=randomUUID();await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'alice','research','active')",[id,W]);await allowSyntheticResearchUse(admin,W,id);
  for(const who of hidden?['alice']:Object.keys(roleAssignments))await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,$3,true,true,'research',clock_timestamp()+interval '1 hour')",[W,id,who]);
  if(unknown){await admin.query('UPDATE garden_private.record_envelopes SET payload=$1 WHERE id=$2',[entity('person',id),id]);return {id,revision:'2'};}
  const value=await records.initialize(H('alice'),W,id,'1',entity('person',id));return {id,revision:value.revision};
 }
 async function publicPermission(id,enabled){const head=(await admin.query('SELECT version::text FROM garden_control.use_policy_heads WHERE workspace_id=$1 AND record_id=$2',[W,id])).rows[0].version;const v={schemaVersion:1,recordId:id,basis:'no-consent-required',inputs:[],terms:null,subjects:[],purposes:enabled?['research','public-display']:['research'],reasonDigest:'2'.repeat(64)};await admin.query('SELECT garden_control.set_use_policy($1,$2::jsonb,$3::bigint,$4)',[W,JSON.stringify(v),head,'synthetic-fixture']);}
 const source=await record(),support=await record(),hidden=await record({hidden:true}),unknown=await record({unknown:true});
 const ev=[{recordId:support.id,revision:support.revision}];
 await assert.rejects(()=>reviews.register(H('eve'),W,source.id,source.revision),ReviewError);
 await assert.rejects(()=>reviews.register(H('admin'),W,source.id,source.revision),ReviewError);
 const scope=await reviews.register(H('bob'),W,source.id,source.revision);assert.equal(await reviews.register(H('bob'),W,source.id,source.revision),scope);
 const first=await reviews.snapshot(H('eve'),W,scope);assert.equal(first.scope.revision,source.revision);assert.equal(first.scope.digestProfile,'postgres-jsonb-text-sha256');assert.equal(first.version,'0');assert(first.scope.authorshipComplete);assert.equal(first.publicUseAllowed,false);assert.equal(presentReview(first).wholeWorkVerified,false);
 const actualRules=(await admin.query('SELECT axis,rule FROM garden_control.review_axis_rules ORDER BY axis')).rows;assert.deepEqual(actualRules.map(r=>r.rule),[...REVIEW_RULES.axes].sort((a,b)=>a.id.localeCompare(b.id)));
 check('editor-only scope creation is idempotent and pins exact revision, JSONB digest profile, authorship and seven independent rule axes');
 await assert.rejects(()=>reviews.snapshot(H('eve'),OTHER,scope),ReviewError);await assert.rejects(()=>reviews.snapshot(H('eve'),W,randomUUID()),ReviewError);
 await assert.rejects(()=>reviews.register(H('bob'),W,hidden.id,hidden.revision),ReviewError);
 const uScope=await reviews.register(H('bob'),W,unknown.id,unknown.revision);assert.equal((await reviews.snapshot(H('bob'),W,uScope)).scope.authorshipComplete,false);
 await assert.rejects(()=>reviews.assign(H('bob'),W,uScope,'dave','research'),ReviewError);check('unknown author lineage, cross-workspace and hidden record scopes fail closed');
 await assert.rejects(()=>reviews.assign(H('bob'),W,scope,'alice','research'),ReviewError);
 const assignment=await reviews.assign(H('bob'),W,scope,'dave','research'),rightsAssignment=await reviews.assign(H('bob'),W,scope,'rhea','rights');
 const digest=first.scope.digest;
 const legacy=(await admin.query('SELECT garden_control.assign_reviewer($1,$2,$3,$4,$5,$6)::text AS id',[W,'bob','dave',scope,digest,'research'])).rows[0].id;
 check('independent research and rights assignments have authoritative receipts; every recorded author is excluded');
 async function step(who,axis,to,assignmentId=null,{evidence=ev}={}){const state=await reviews.snapshot(H(who),W,scope);return reviews.transition(H(who),W,scope,{axis,fromState:state.states[axis],toState:to,expectedVersion:state.version,assignmentId,evidence,rationale:'Synthetic scoped review decision; no historical finding.'});}
 async function reopen(who,axis){const s=await reviews.snapshot(H(who),W,scope);return reviews.reopen(H(who),W,scope,{axis,fromState:s.states[axis],expectedVersion:s.version,evidence:ev,rationale:'A specific synthetic disagreement reopens this scope.'});}
 const afterImport=await reviews.importObservation(H('bob'),W,scope,{axis:'rights',expectedVersion:'0',namespace:'legacy-source-status',verbatim:'\n VERIFIED  /  approved \n',evidence:ev});
 assert.deepEqual(afterImport.states,first.states);assert.equal(afterImport.version,'1');const imported=(await reviews.history(H('bob'),W,scope)).events[0];assert.equal(imported.imported.verbatim,'\n VERIFIED  /  approved \n');assert.equal(imported.fromState,imported.toState);check('imported claimed verification remains a verbatim attributed observation and cannot promote any state');
 await step('alice','acquisition','in-progress');await step('alice','acquisition','recorded');
 await step('alice','transcription','in-progress');
 await assert.rejects(()=>step('alice','transcription','checked',assignment),ReviewError);await assert.rejects(()=>step('dave','transcription','checked',legacy),ReviewError);
 await step('dave','transcription','checked',assignment);
 await step('dave','evidentiary-review','in-review');
 await assert.rejects(()=>step('dave','evidentiary-review','reviewed',assignment,{evidence:[{recordId:hidden.id,revision:hidden.revision}]}),ReviewError);
 await step('dave','evidentiary-review','reviewed',assignment);check('role, prior state, self-review, legacy assignment and hidden evidence guards are checked by real SQL');
 let partial=await reviews.snapshot(H('eve'),W,scope);assert.equal(partial.states.rights,'unassessed');assert.equal(partial.states.consent,'unassessed');assert.equal(presentReview(partial).eligibleForReleaseReview,false);
 await step('rhea','rights','in-review');await assert.rejects(()=>step('dave','rights','cleared',assignment),ReviewError);await step('rhea','rights','cleared',rightsAssignment);
 await step('bob','consent','in-review');await assert.rejects(()=>step('bob','consent','not-required'),ReviewError);
 await publicPermission(source.id,true);await assert.rejects(()=>step('bob','consent','documented'),ReviewError);await step('bob','consent','not-required');
 await step('alice','accessibility','in-progress');await step('dave','accessibility','checked',assignment);
 await step('bob','publication','in-review');await assert.rejects(()=>step('alice','publication','ready-for-release-review'),ReviewError);
 const ready=await step('bob','publication','ready-for-release-review');assert(presentReview(ready).eligibleForReleaseReview);assert.equal(ready.publicationReleased,false);assert.equal(presentReview(ready).publicationApproved,false);
 check('separate acquisition, transcription, evidence, rights, consent and accessibility reviews precede an independent publication recommendation, never publication itself');
 await publicPermission(source.id,false);const lostConsent=await reviews.snapshot(H('eve'),W,scope);assert.equal(lostConsent.states.consent,'not-required');assert.equal(lostConsent.publicUseAllowed,false);assert.equal(presentReview(lostConsent).eligibleForReleaseReview,false);await publicPermission(source.id,true);
 const prior=await reviews.history(H('eve'),W,scope),disputed=await reopen('eve','evidentiary-review');assert.equal(disputed.states['evidentiary-review'],'disputed');assert.equal(presentReview(disputed).eligibleForReleaseReview,false);
 const disputedHistory=await reviews.history(H('eve'),W,scope);assert.deepEqual(disputedHistory.events.slice(0,prior.events.length),prior.events);assert.equal(disputedHistory.events.at(-1).kind,'reopen');check('current consent revocation overrides earlier labels and a read-authorized dispute appends history without deleting the decision');
 await step('dave','evidentiary-review','in-review');
 await admin.query("UPDATE garden_control.access_roles SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND subject_id='bob' AND role='editor'",[W]);
 await assert.rejects(()=>step('dave','evidentiary-review','reviewed',assignment),ReviewError);
 const replacement=await reviews.assign(H('carl'),W,scope,'dave','research');await step('dave','evidentiary-review','reviewed',replacement);
 await reopen('eve','evidentiary-review');await step('dave','evidentiary-review','in-review');
 await admin.query("UPDATE garden_control.access_roles SET expires_at=expires_at+interval '1 minute' WHERE workspace_id=$1 AND subject_id='dave' AND role='reviewer'",[W]);
 await assert.rejects(()=>step('dave','evidentiary-review','reviewed',replacement),ReviewError);
 const latestAssignment=await reviews.assign(H('carl'),W,scope,'dave','research');await step('dave','evidentiary-review','reviewed',latestAssignment);
 check('revoked assigner and changed reviewer-grant versions invalidate receipts and require a fresh authorized assignment');
 const at=(await reviews.snapshot(H('carl'),W,scope)).version;
 const race={axis:'rights',fromState:'cleared',expectedVersion:at,evidence:ev,rationale:'Concurrency test disagreement.'};
 const concurrent=await Promise.allSettled([reviews.reopen(H('carl'),W,scope,race),reviews.reopen(H('eve'),W,scope,race)]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal((await reviews.snapshot(H('carl'),W,scope)).version,(BigInt(at)+1n).toString());
 check('concurrent same-version changes serialize and exactly one advances the global review version');
 // All raw writes are confined to the checked producer functions.
 for(const sql of ["UPDATE garden_control.status_events SET rationale='changed'","DELETE FROM garden_control.status_events","UPDATE garden_control.status_snapshots SET states='{}'","INSERT INTO garden_control.review_assignment_receipts(assignment_id) VALUES(gen_random_uuid())","SELECT * FROM garden_control.review_decisions"]){await assert.rejects(()=>executor.run(H('carl'),{workspaceId:W},c=>c.query(sql)));}
 for(const sql of ["UPDATE garden_control.status_events SET rationale='changed' WHERE workspace_id=$1","DELETE FROM garden_control.status_events WHERE workspace_id=$1"]){await assert.rejects(()=>admin.query(sql,[W]));}
 await assert.rejects(()=>executor.run(H('carl'),{workspaceId:W},c=>c.query('SELECT garden_control.record_scoped_status($1,$2,$3,$4::jsonb)',[W,scope,'reopen',JSON.stringify({...race,subjectId:'bob'})])));
 check('runtime cannot mutate journals, receipts or snapshots directly; immutable events reject update/delete and injected identity fields');
 const full=await reviews.history(H('carl'),W,scope);assert(full.events.length>20);let after='0',seen=[];
 for(let i=0;i<20;i++){const page=await reviews.history(H('carl'),W,scope,{after,limit:3});seen.push(...page.events);if(!page.nextAfter)break;after=page.nextAfter;}
 assert.deepEqual(seen,full.events);assert.deepEqual(full.events.map(e=>e.sequence),Array.from({length:full.events.length},(_,i)=>String(i+1)));check('append-only journal paginates past 9/10 without duplicate or omitted events');
 const old=await records.read(H('alice'),W,source.id);await records.revise(H('alice'),W,source.id,old.revision,{...old.record,title:'A changed exact revision'});
 const stale=await reviews.snapshot(H('carl'),W,scope);assert.equal(presentReview(stale).current,false);assert.equal(presentReview(stale).eligibleForReleaseReview,false);
 await assert.rejects(()=>step('rhea','rights','in-review'),ReviewError);await assert.rejects(()=>reviews.assign(H('carl'),W,scope,'dave','research'),ReviewError);
 const current=await records.read(H('alice'),W,source.id),newScope=await reviews.register(H('carl'),W,source.id,current.revision);assert.notEqual(newScope,scope);assert.equal((await reviews.snapshot(H('carl'),W,newScope)).version,'0');check('new content revision invalidates earlier release eligibility and starts a separate review scope, preserving the former journal');
 await admin.query("UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND record_id=$2 AND subject_id='eve'",[W,support.id]);
 await assert.rejects(()=>reviews.snapshot(H('eve'),W,scope),ReviewError);await assert.rejects(()=>reviews.history(H('eve'),W,scope),ReviewError);
 await admin.query("UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND record_id=$2 AND subject_id='carl'",[W,source.id]);await assert.rejects(()=>reviews.snapshot(H('carl'),W,scope),ReviewError);check('evidence and parent revocation remove derived snapshots and historical decision access');
 const audit=(await admin.query('SELECT workspace_id::text AS "workspaceId",sequence::text AS sequence,previous_hash AS "previousHash",hash,event_text AS "eventText" FROM garden_control.audit_events AS ae WHERE workspace_id=$1 ORDER BY ae.sequence',[W])).rows;
 verifyAuditPage(audit,{workspaceId:W,sequence:'0',hash:GENESIS});assert(audit.some(r=>JSON.parse(r.eventText).action==='review.reopen'));assert(!JSON.stringify(audit).includes('VERIFIED  /  approved'));assert(!JSON.stringify(audit).includes('Synthetic scoped review decision'));
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets')).rows[0].n,0);check('new events remain in the verified numeric audit chain without rationale/import leakage or pooled policy tickets');
 await mkdir('data-evidence',{recursive:true});await writeFile('data-evidence/reviews.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,checks,real_postgresql:true,synthetic_only:true,production_verified:false,whole_work_verified:false,publication_authorized:false,journal_events:full.events.length},null,2)+'\n');console.log('PASS: '+checks.length+' real PostgreSQL scoped-review checks');
}finally{for(const p of pools)await p.end();await admin.end();}
