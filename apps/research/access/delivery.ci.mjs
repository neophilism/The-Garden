import {allowSyntheticResearchUse} from './consent-test-fixture.mjs';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createPolicyExecutor} from './policy-context.mjs';
import {createDeliveryCapabilities} from './delivery-capabilities.mjs';
import {createRecordRepository,createRecordDelivery,createDeliveryHandler} from './record-delivery.mjs';
import {createArchiveStore} from '../../../services/workers/src/storage.mjs';
if(process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.CI!=='true'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Refuse delivery fixture outside ephemeral CI');
const base={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD};
const admin=new pg.Pool({...base,max:2}),pools=[],checks=[],record=name=>checks.push({name,result:'pass'});
const W=randomUUID(),policy='e'.repeat(64),ids={readable:randomUUID(),'bob-only':randomUUID()};
const identity={viewer:async headers=>({id:headers.get('synthetic-subject'),verified:true})};
let issuerPool,queryPool;
try{
 for(const [name,capability] of [['garden_delivery_issuer_ci','garden_context_issuer'],['garden_delivery_query_ci','garden_research']]){
  const password=randomBytes(30).toString('hex');
  await admin.query(`CREATE ROLE ${name} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  await admin.query(`GRANT ${capability} TO ${name} WITH INHERIT FALSE, SET TRUE`);
  const pool=new pg.Pool({...base,user:name,password,max:1});pools.push(pool);
  if(capability==='garden_context_issuer')issuerPool=pool;else queryPool=pool;
 }
 const executor=createPolicyExecutor({identity,issuerPool,researchPool:queryPool});
 await admin.query('INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES($1,$2,$3,true)',[W,'Delivery synthetic',policy]);
 for(const subject of ['owner','bob','no-grant'])await admin.query("INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES($1,$2,'active',$3)",[W,subject,policy]);
 for(const subject of ['owner','bob','no-grant'])await admin.query("INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES($1,$2,'researcher','owner',clock_timestamp()+interval '30 days')",[W,subject]);
 for(const [id,subject] of [[ids.readable,'owner'],[ids['bob-only'],'bob']]){
  await admin.query("INSERT INTO garden_private.record_envelopes(id,workspace_id,owner_subject_id,classification,state) VALUES($1,$2,'owner','research','active')",[id,W]);await allowSyntheticResearchUse(admin,W,id);
  await admin.query("INSERT INTO garden_control.record_grants(workspace_id,record_id,subject_id,can_read,can_write,purpose,expires_at) VALUES($1,$2,$3,true,false,'research',clock_timestamp()+interval '30 days')",[W,id,subject]);
 }
 // GDN-025: real SQL authorization plus the real archive adapter. The object
 // backend and session subject are synthetic CI fixtures, not hosted transport.
 const recordRepository=createRecordRepository(executor),objects=new Map();let storageReads=0,afterStorageRead=null;
 const store=createArchiveStore({binding:{project:'royal-union-78374030',branch:'br-purple-grass-b5hurfl7',access:'private'},
  backend:{async putIfAbsent(ref,bytes){if(!objects.has(ref.key))objects.set(ref.key,Buffer.from(bytes));},async get(ref){storageReads++;const value=objects.get(ref.key);if(afterStorageRead){const fn=afterStorageRead;afterStorageRead=null;await fn();}return value&&Buffer.from(value);}},
  authorize:async(principal,action,ref)=>{
   if(principal?.fixtureSetup===true)return action==='preserve'||action.startsWith('write:');
   if(!action.startsWith('read:')||principal.record!==ref.sourceId)return false;
   try{await recordRepository.find(principal.headers,principal.workspace,principal.record);return true;}catch{return false;}
  },
  reviewSource:async ref=>({sourceVersion:ref.version,malware:'passed'}) // Synthetic preservation attestation only; no scanner or rights clearance claim.
 });
 const setup={fixtureSetup:true},content=Buffer.from('synthetic-byte-range-0123456789');
 const quarantined=await store.quarantine(setup,ids.readable,content);
 const stored=await store.preserve(setup,quarantined);
 const payload={title:'Visible synthetic source',kind:'source',summary:'Working evidence, not a verified historical claim',secret:'NEVER_RETURN_RAW_FIELDS',verified:true,
  assets:{download:{ref:stored,mediaType:'application/octet-stream'},media:{ref:stored,mediaType:'audio/mpeg'},'tile:1:0:0:0':{ref:stored,mediaType:'image/png'}}};
 await admin.query('UPDATE garden_private.record_envelopes SET payload=$1 WHERE id=$2',[payload,ids.readable]);
 await admin.query('UPDATE garden_private.record_envelopes SET payload=$1 WHERE id=$2',[{title:'HIDDEN_SUBJECT_CANARY',kind:'person',summary:'private fixture'},ids['bob-only']]);
 const origin='https://research.example.invalid',capabilities=createDeliveryCapabilities({keys:{ci:randomBytes(32)},activeKeyId:'ci'});
 let activated=true;
 const service=createRecordDelivery({identity,repository:recordRepository,archiveStore:store,capabilities,origin,enabled:()=>activated});
 const handler=createDeliveryHandler({service,origin});
 const path=(recordId,channel='record')=>'/api/research/workspaces/'+W+'/records/'+recordId+'/'+channel;
 const request=(subject,route,{method='GET',body,range}={})=>new Request(route.startsWith('https:')?route:origin+route,{method,headers:{'synthetic-subject':subject,origin,...(body?{'content-type':'application/json'}:{}),...(range?{range}:{})},...(body?{body:JSON.stringify(body)}:{})});
 async function response(subject,route,options){return handler(request(subject,route,options));}
 const searchPath='/api/research/workspaces/'+W+'/search';
 for(const subject of ['owner','bob','no-grant']){
  const results=await (await response(subject,searchPath)).json();
  const wanted=subject==='owner'?[ids.readable]:subject==='bob'?[ids['bob-only']]:[];
  assert.deepEqual(results.records.map(x=>x.id),wanted);
  assert.equal(results.total,String(wanted.length));
  const count=await(await response(subject,searchPath+'?view=count')).json();assert.deepEqual(count,{total:String(wanted.length)});
  const facets=await(await response(subject,searchPath+'?view=facets')).json();assert.deepEqual(facets,{facets:subject==='owner'?{source:'1'}:subject==='bob'?{person:'1'}:{}});
  record('authorized search/results/count/facets share the same SQL visibility: '+subject);
 }
 const hiddenSearch=await(await response('owner',searchPath+'?q=HIDDEN_SUBJECT_CANARY')).json();assert.equal(hiddenSearch.total,'0');assert.deepEqual(hiddenSearch.facets,{});record('search for a known hidden canary reveals neither result nor count nor facet');
 for(const channel of ['record','snippet','export','notification','collaboration']){
  const good=await response('owner',path(ids.readable,channel));assert.equal(good.status,200);const text=await good.text();assert.ok(!text.includes('NEVER_RETURN_RAW_FIELDS'));assert.ok(!text.includes(stored.bucket));assert.ok(!text.includes(stored.key));assert.ok(!text.includes('"verified":true'));assert.equal(good.headers.get('cache-control'),'private, no-store');
  const denied=await response('bob',path(ids.readable,channel)),missing=await response('bob',path(randomUUID(),channel));assert.equal(denied.status,404);assert.equal(await denied.text(),await missing.text());
  record(channel+' projection is authorized, allowlisted and indistinguishable from absent when denied');
 }
 const issue=async(kind,extra={})=>{const r=await response('owner',path(ids.readable,'capability'),{method:'POST',body:{kind,...extra}});assert.equal(r.status,200);const cap=await r.json();assert.equal(new URL(cap.url).origin,origin);assert.equal(cap.publicStorageUrl,false);assert.equal(cap.requiresAuthenticatedSession,true);return cap.url;};
 const full=await issue('download');
 const downloaded=await response('owner',full);assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),content);assert.match(downloaded.headers.get('content-disposition'),/^attachment/);record('authenticated application proxy delivers exact archive bytes without publishing storage URL');
 const partial=await issue('media',{range:'bytes=2-8'});
 const ranged=await response('owner',partial,{range:'bytes=2-8'});assert.equal(ranged.status,206);assert.equal(ranged.headers.get('content-range'),'bytes 2-8/'+content.length);assert.deepEqual(Buffer.from(await ranged.arrayBuffer()),content.subarray(2,9));
 assert.equal((await response('owner',partial,{range:'bytes=0-8'})).status,404);record('media range capability cannot expand to another range');
 const tile=await issue('tile',{selector:'1:0:0:0'});assert.equal((await response('owner',tile)).status,200);const otherTile=new URL(tile);otherTile.searchParams.set('selector','2:0:0:0');assert.equal((await response('owner',otherTile.href)).status,404);record('tile capability binds exact selector; fixture checks bytes, not image decoding');
 let beforeReads=storageReads;assert.equal((await response('bob',full)).status,404);assert.equal(storageReads,beforeReads);record('another valid member cannot reuse a signed file URL or trigger its object read');
 const head=await response('owner',full,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('content-length'),String(content.length));assert.equal((await response('bob',full,{method:'HEAD'})).status,404);record('HEAD checks authorization before disclosing byte length');
 // Revoke after object acquisition but before the response can expose it.
 afterStorageRead=()=>admin.query('UPDATE garden_control.record_grants SET revoked_at=clock_timestamp() WHERE workspace_id=$1 AND record_id=$2 AND subject_id=$3',[W,ids.readable,'owner']);
 const revoked=await response('owner',full);assert.equal(revoked.status,404);assert.equal(await revoked.text(),'{"error":"not_available"}');record('revocation during archive read prevents response bytes');
 await admin.query('UPDATE garden_control.record_grants SET revoked_at=NULL WHERE workspace_id=$1 AND record_id=$2 AND subject_id=$3',[W,ids.readable,'owner']);
 await admin.query('UPDATE garden_private.record_envelopes SET payload=payload WHERE id=$1',[ids.readable]);beforeReads=storageReads;assert.equal((await response('owner',full)).status,404);assert.equal(storageReads,beforeReads);record('record revision changes invalidate earlier signed delivery capabilities');
 activated=false;assert.equal((await response('owner',searchPath)).status,404);assert.equal((await response('owner',path(ids.readable))).status,404);record('delivery activation flag fails closed for data and search');
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_tickets')).rows[0].n,0);assert.equal((await admin.query('SELECT count(*)::int AS n FROM garden_control.policy_contexts')).rows[0].n,0);record('delivery request sequence leaves no live policy ticket or transaction context');

 await mkdir('identity-evidence',{recursive:true});
 await writeFile('identity-evidence/delivery-results.json',JSON.stringify({source:process.env.GITHUB_SHA,checks,synthetic_identity_and_object_backend:true,real_postgresql:true,production_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' delivery checks with real PostgreSQL and archive adapter');
}finally{for(const p of pools)await p.end();await admin.end();}
