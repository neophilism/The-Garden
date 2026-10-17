import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createEncryptionPersistence,createEncryptedContentService,encryptionRequestDigest,encryptionDeliveryFingerprint,EncryptionPersistenceError} from '../../apps/research/access/encryption-persistence.mjs';
import {roleProbe} from '../security/database-role-fixture.mjs';
import {createPersistenceKeys,PERSISTENCE_CANARY,persistenceId} from '../security/encryption-persistence-fixture.mjs';
import {envelopeDigest} from '../../services/workers/src/trusted-encryption.mjs';

const W=persistenceId(1),R=persistenceId(2),V=persistenceId(3),H=new Headers();
const valid={workspaceId:W,recordId:R,recordRevision:'1',contentVersionId:V};

function fixture({enabled=()=>true,viewer,role={},queryHook}={}){
 const calls=[];let latestResult;
 const wireAdmission=()=>({subjectId:'synthetic-researcher',expiresAt:new Date(Date.now()+30000).toISOString(),resultFingerprint:encryptionDeliveryFingerprint(latestResult)});
 const identity={async viewer(headers){calls.push({kind:'identity'});return viewer?viewer(headers):{id:'synthetic-researcher',verified:true};}};
 function pool(kind){return {async connect(){
  calls.push({kind,connected:true});const observe=roleProbe('encryption_'+kind+'_login',role[kind]??{});
  return {async query(sql,args){
   calls.push({kind,sql,args});if(queryHook){const value=await queryHook({kind,sql,args});if(value){if(value.rows?.[0]?.result)latestResult=value.rows[0].result;return value;}}
   const guarded=observe(sql,args);if(guarded)return guarded;
   if(sql.includes('issue_policy_ticket'))return {rows:[{ticket:'a'.repeat(64)}]};
   if(sql.includes('encrypted_delivery_admission')||sql.includes('finish_encrypted_delivery'))return {rows:[{admission:wireAdmission()}]};
   return {rows:[]};
  },release:bad=>calls.push({kind,released:true,bad})};
 }};}
 const issuerPool=pool('issuer'),encryptionPool=pool('encryption');
 const config={identity,issuerPool,encryptionPool,environment:'ci',enabled};
 return {calls,config,repository:createEncryptionPersistence(config)};
}

const denied=work=>assert.rejects(work,error=>error instanceof EncryptionPersistenceError&&!/SECRET|PASSWORD|CANARY|postgres/i.test(error.message));

test('encryption persistence starts disabled and does not resolve identity or database authority',async()=>{
 for(const enabled of [undefined,()=>false,()=>1,async()=>true]){
  const f=fixture({enabled});
  // Omitted configuration must preserve the production default, not this fixture's active default.
  const config={...f.config};if(enabled===undefined)delete config.enabled;
  const repository=createEncryptionPersistence(config);
  await denied(()=>repository.prepare(H,valid));assert.equal(f.calls.length,0);
 }
});

test('preview and unrecognized environment bindings cannot construct a persistence host',()=>{
 const f=fixture();
 for(const environment of ['local','preview','production','unknown','',null,undefined])assert.throws(()=>createEncryptionPersistence({...f.config,environment}),EncryptionPersistenceError);
});

test('issuer and content capabilities cannot share one pool',()=>{
 const f=fixture();assert.throws(()=>createEncryptionPersistence({...f.config,encryptionPool:f.config.issuerPool}),EncryptionPersistenceError);
});

test('unverified identities cannot start an encrypted-content transaction',async()=>{
 for(const identity of [null,{id:'synthetic-researcher',verified:false},{id:'synthetic-researcher',verified:'true'},{id:'',verified:true}]){
  const f=fixture({viewer:async()=>identity});await denied(()=>f.repository.prepare(H,valid));
  assert.equal(f.calls.some(call=>call.connected),false);
 }
});

test('only exact content identities and canonical decimal revisions reach PostgreSQL',async()=>{
 const invalid=[null,{}, {...valid,recordRevision:1},{...valid,recordRevision:'0'},{...valid,recordRevision:'01'},
  {...valid,recordRevision:'-1'},{...valid,recordRevision:'9223372036854775808'},
  {...valid,recordId:'not-a-record'},{...valid,workspaceId:'A0000000-0000-4000-8000-000000000001'},
  {...valid,contentVersionId:null},{...valid,classification:'research'},{...valid,subjectId:'victim'},
  {...valid,environment:'production'},{...valid,purpose:'promotional-endorsement'}];
 for(const input of invalid){
  const f=fixture();await denied(()=>f.repository.prepare(H,input));
  assert.equal(f.calls.some(call=>call.connected),false,JSON.stringify(input));
 }
});

test('reads require an explicit immutable UUID content version',async()=>{
 const {contentVersionId,...withoutVersion}=valid;
 for(const input of [withoutVersion,{...valid,contentVersionId:'1'},{...valid,recordRevision:'1.0'}]){
  const f=fixture();await denied(()=>f.repository.load(H,input));assert.equal(f.calls.some(call=>call.connected),false);
 }
});

test('operation readback rejects missing, malformed and caller-extended request bindings',async()=>{
 const receipt={workspaceId:W,recordId:R,operationId:persistenceId(4),requestDigest:'b'.repeat(64)};
 for(const input of [{...receipt,requestDigest:''},{...receipt,requestDigest:'B'.repeat(64)},
  {...receipt,operationId:'old-operation'},{...receipt,subjectId:'victim'},{...receipt,recordId:null}]){
  const f=fixture();await denied(()=>f.repository.receipt(H,input));assert.equal(f.calls.some(call=>call.connected),false);
 }
});

for(const kind of ['issuer','encryption'])test(kind+' rejects inherited, mixed, elevated and object-owning SQL capabilities',async()=>{
 for(const unsafe of [{elevated:true},{inherited:true},{conflicting:true},{owns_objects:true},{expected:false},{can_set:false},{unsafe_capability:true}]){
  const f=fixture({role:{[kind]:unsafe}});await denied(()=>f.repository.prepare(H,valid));
  assert.equal(f.calls.some(call=>call.sql?.includes('prepare_encrypted_delivery')),false);
  assert.ok(f.calls.some(call=>call.kind===kind&&call.released&&call.bad),JSON.stringify(unsafe));
 }
});

test('unsafe issuer never passes a policy ticket to the encryption pool',async()=>{
 const f=fixture({role:{issuer:{conflicting:true}}});await denied(()=>f.repository.prepare(H,valid));
 assert.equal(f.calls.some(call=>call.kind==='encryption'),false);
});

test('database exceptions are redacted and rollback failure destroys the connection',async()=>{
 const f=fixture({queryHook:async({kind,sql})=>{
  if(kind==='encryption'&&(sql.includes('prepare_encrypted_delivery')||sql==='ROLLBACK'))throw Error('PRIVATE-DATABASE-PASSWORD-CANARY');
 }});
 await denied(()=>f.repository.prepare(H,valid));
 assert.ok(f.calls.some(call=>call.kind==='encryption'&&call.sql==='ROLLBACK'));
 assert.ok(f.calls.some(call=>call.kind==='encryption'&&call.released&&call.bad));
 assert.equal(f.calls.some(call=>call.kind==='encryption'&&call.sql==='COMMIT'),false);
});

async function encryptedRequest(){
 const keys=createPersistenceKeys(),target={workspaceId:W,objectId:R,versionId:V,environment:'ci',dataClass:'restricted_research',purpose:'research'};
 try{
  const envelope=await keys.component(target).encrypt(H,W,{objectId:R,versionId:V,plaintext:PERSISTENCE_CANARY});
  return {operationId:persistenceId(4),...valid,keyPolicyGeneration:'1',expectedGeneration:'0',expectedDigest:null,envelope};
 }finally{keys.close();}
}

test('operation digest has the independently specified canonical encoding and survives JSONB key order',async()=>{
 const request=await encryptedRequest(),expected=createHash('sha256').update([
  'garden-encrypted-content-request-v1',request.operationId,W,R,'1',V,'1','0','none',envelopeDigest(request.envelope)
 ].join('\n'),'utf8').digest('hex');
 assert.equal(encryptionRequestDigest(request),expected);
 const reverse=value=>Object.fromEntries(Object.entries(value).reverse());
 const reordered=reverse({...request,envelope:reverse({...request.envelope,context:reverse(request.envelope.context)})});
 assert.equal(encryptionRequestDigest(JSON.parse(JSON.stringify(reordered))),expected);
 assert.notEqual(encryptionRequestDigest({...request,operationId:persistenceId(5)}),expected);
 assert.notEqual(encryptionRequestDigest({...request,keyPolicyGeneration:'2'}),expected);
 assert.notEqual(encryptionRequestDigest({...request,expectedGeneration:'1',expectedDigest:'c'.repeat(64)}),expected);
});

test('commit validation rejects extra authority, noncanonical versions and inconsistent initial CAS state before SQL',async()=>{
 const request=await encryptedRequest();
 for(const input of [{...request,actor:'victim'},{...request,classification:'research'},
  {...request,expectedGeneration:0},{...request,expectedGeneration:'00'},{...request,keyPolicyGeneration:'0'},
  {...request,expectedGeneration:'1',expectedDigest:null},{...request,expectedGeneration:'0',expectedDigest:'a'.repeat(64)},
  {...request,expectedDigest:'B'.repeat(64)},{...request,envelope:{...request.envelope,plaintext:PERSISTENCE_CANARY.toString()}}]){
  const f=fixture();await denied(()=>f.repository.commit(H,input));assert.equal(f.calls.some(call=>call.connected),false);
 }
});

function successfulResult(request){
 const digest=envelopeDigest(request.envelope),requestDigest=encryptionRequestDigest(request);
 const metadata={...valid,context:request.envelope.context,
  keyBinding:{repository:'neophilism/The-Garden',environment:'ci',providerId:request.envelope.providerId,dataClass:'restricted_research',keyRef:request.envelope.keyRef,writeVersion:'v1',readVersions:['v1','v2','v3']},
  keyPolicyGeneration:'1',head:{generation:'1',digest},envelope:request.envelope};
 const receipt={operationId:request.operationId,requestDigest,...valid,generation:'1',envelopeDigest:digest,previousDigest:null,keyVersion:'v1',auditSequence:'1',committed:true};
 return {metadata,receipt};
}

test('repository closure during ticket retirement denies a completed load',async()=>{
 const request=await encryptedRequest(),{metadata}=successfulResult(request);let active=true,retirements=0;
 const f=fixture({enabled:()=>active,queryHook:async({kind,sql})=>{
  if(kind==='encryption'&&sql.includes('load_encrypted_delivery'))return {rows:[{result:metadata}]};
  if(kind==='issuer'&&sql.includes('finish_encrypted_delivery')){active=false;retirements++;}
 }});
 await denied(()=>f.repository.load(H,valid));assert.equal(retirements,1);
 assert.equal(f.calls.filter(call=>call.kind==='encryption'&&call.sql==='COMMIT').length,1);
});

test('committed-write closure during ticket retirement retains only exact unconfirmed recovery',async()=>{
 const request=await encryptedRequest(),{receipt}=successfulResult(request);let active=true,retirements=0;
 const f=fixture({enabled:()=>active,queryHook:async({kind,sql})=>{
  if(kind==='encryption'&&(sql.includes('commit_encrypted_delivery')||sql.includes('recover_encrypted_delivery')))return {rows:[{result:receipt}]};
  if(kind==='issuer'&&sql.includes('finish_encrypted_delivery')&&++retirements===1)active=false;
 }});
 let uncertain;await assert.rejects(()=>f.repository.commit(H,request),error=>{uncertain=error;return error instanceof EncryptionPersistenceError;});
 assert.equal(uncertain.commitOutcome,'unconfirmed');assert.ok(Object.isFrozen(uncertain.recovery));
 assert.deepEqual(uncertain.recovery,{workspaceId:W,recordId:R,operationId:request.operationId,requestDigest:encryptionRequestDigest(request)});
 assert.equal(f.calls.some(call=>call.kind==='encryption'&&call.sql==='ROLLBACK'),false,'the committed write is not reported as rolled back');
 active=true;assert.deepEqual((await f.repository.receipt(H,uncertain.recovery)).value,receipt);
 assert.equal(f.calls.filter(call=>call.kind==='encryption'&&call.sql?.includes('commit_encrypted_delivery')).length,1);
});

test('actual crypto composition cannot deliver plaintext if final load closes its repository during retirement',async t=>{
 const keys=createPersistenceKeys();t.after(()=>keys.close());
 const crypto=keys.component({workspaceId:W,objectId:R,versionId:V,environment:'ci',dataClass:'restricted_research',purpose:'research'});
 const envelope=await crypto.encrypt(H,W,{objectId:R,versionId:V,plaintext:PERSISTENCE_CANARY});
 const request={operationId:persistenceId(4),...valid,keyPolicyGeneration:'1',expectedGeneration:'0',expectedDigest:null,envelope};
 const {metadata}=successfulResult(request);let active=true,retirements=0,owned;
 const f=fixture({enabled:()=>active,queryHook:async({kind,sql})=>{
  if(kind==='encryption'&&sql.includes('load_encrypted_delivery'))return {rows:[{result:metadata}]};
  if(kind==='issuer'&&sql.includes('finish_encrypted_delivery')&&++retirements===2)active=false;
 }});
 const service=createEncryptedContentService({repository:f.repository,enabled:()=>true,
  encryption:{encrypt:crypto.encrypt,rewrap:crypto.rewrap,async decrypt(...args){owned=await crypto.decrypt(...args);return owned;}}});
 await denied(()=>service.decrypt(H,valid));assert.equal(retirements,2);assert.ok(Buffer.isBuffer(owned));assert.ok(owned.every(byte=>byte===0));
 assert.equal(f.calls.filter(call=>call.kind==='encryption'&&call.sql==='COMMIT').length,2);
});
