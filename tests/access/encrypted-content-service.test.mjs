import test from 'node:test';
import assert from 'node:assert/strict';
import {createEncryptedContentService,encryptionRequestDigest,EncryptionPersistenceError} from '../../apps/research/access/encryption-persistence.mjs';
import {envelopeDigest} from '../../services/workers/src/trusted-encryption.mjs';
import {createPersistenceKeys,PERSISTENCE_CANARY,persistenceId} from '../security/encryption-persistence-fixture.mjs';

const W=persistenceId(20),R=persistenceId(21),V=persistenceId(22),H=new Headers();
const target={workspaceId:W,recordId:R,recordRevision:'1',contentVersionId:V};
const context={format:'garden-trusted-envelope-v1',algorithm:'AES-256-GCM',workspaceId:W,objectId:R,versionId:V,environment:'ci',dataClass:'restricted_research',purpose:'research'};
const denied=work=>assert.rejects(work,error=>error instanceof EncryptionPersistenceError&&!/SECRET|PASSWORD|CANARY/.test(error.message));

function fixture(){
 const keys=createPersistenceKeys(),calls=[],committed=new Map(),ownedPlaintexts=[];
 let allowed=true,enabled=true,writeVersion='v1',generation='0',current=null,policyGeneration='1',hook=async()=>{},commitFailure=null;
 const keyBinding=()=>({repository:'neophilism/The-Garden',environment:'ci',providerId:keys.providerId,dataClass:'restricted_research',keyRef:'garden/ci/restricted_research',writeVersion,readVersions:['v1','v2','v3']});
 const metadata=()=>({...target,context:{...context},keyBinding:keyBinding(),keyPolicyGeneration:policyGeneration,
  head:current?{generation,digest:envelopeDigest(current)}:null,envelope:current?structuredClone(current):null});
 async function check(action,input){calls.push({action,input:structuredClone(input)});await hook(action,input);if(!allowed)throw new EncryptionPersistenceError();}
 const repository={
  async prepare(headers,input){await check('prepare',input);return metadata();},
  async load(headers,input){await check('load',input);if(!current)throw new EncryptionPersistenceError();return metadata();},
  async commit(headers,input){
   await check('commit',input);if(commitFailure)throw commitFailure;
   const requestDigest=encryptionRequestDigest(input),prior=committed.get(input.operationId);
   if(prior){if(prior.requestDigest!==requestDigest)throw new EncryptionPersistenceError();return prior;}
   if(input.expectedGeneration!==generation||input.expectedDigest!==(current?envelopeDigest(current):null)||input.keyPolicyGeneration!==policyGeneration)throw new EncryptionPersistenceError();
   current=structuredClone(input.envelope);generation=(BigInt(generation)+1n).toString();
   const receipt={operationId:input.operationId,requestDigest,...target,generation,envelopeDigest:envelopeDigest(current),previousDigest:input.expectedDigest,keyVersion:current.keyVersion,auditSequence:generation,committed:true};
   committed.set(input.operationId,receipt);return structuredClone(receipt);
  },
  async receipt(headers,input){await check('receipt',input);const value=committed.get(input.operationId);if(!value||value.requestDigest!==input.requestDigest)throw new EncryptionPersistenceError();return structuredClone(value);}
 };
 function service(extra={}){
  const crypto=keys.component({workspaceId:W,objectId:R,versionId:V,environment:'ci',dataClass:'restricted_research',purpose:'research'},{writeVersion});
  const encryption={encrypt:crypto.encrypt,rewrap:crypto.rewrap,async decrypt(...args){const value=await crypto.decrypt(...args);ownedPlaintexts.push(value);return value;}};
  return createEncryptedContentService({repository,encryption,enabled:()=>enabled,...extra});
 }
 const input=operationId=>({...target,operationId});
 return {keys,calls,repository,metadata,ownedPlaintexts,service,input,
  store:()=>service().store(H,input(persistenceId(23)),PERSISTENCE_CANARY),
  allow:value=>{allowed=value;},enable:value=>{enabled=value;},hook:value=>{hook=value;},
  rotate:()=>{writeVersion='v2';policyGeneration='2';},
  moveHead:()=>{generation=(BigInt(generation)+1n).toString();},
  failCommit:error=>{commitFailure=error;},close:()=>keys.close()};
}

test('stored encrypted content round-trips through the actual crypto component and a committed receipt',async t=>{
 const f=fixture();t.after(f.close);const original=Buffer.from(PERSISTENCE_CANARY),receipt=await f.store();
 assert.equal(receipt.committed,true);assert.equal(receipt.generation,'1');assert.equal(receipt.contentVersionId,V);
 const write=f.calls.find(call=>call.action==='commit').input;
 assert.equal(write.expectedGeneration,'0');assert.equal(write.expectedDigest,null);assert.equal(write.keyPolicyGeneration,'1');
 assert.equal(write.envelope.context.objectId,R);assert.equal(write.envelope.context.versionId,V);
 assert.equal(JSON.stringify(write).includes(PERSISTENCE_CANARY.toString()),false);
 assert.deepEqual(await f.service().decrypt(H,target),original);assert.deepEqual(PERSISTENCE_CANARY,original);
 assert.ok(f.calls.filter(call=>call.action==='load').length>=2,'plaintext release requires a fresh authoritative load');
});

test('rewrap commits a new generation with the exact predecessor while preserving ciphertext',async t=>{
 const f=fixture();t.after(f.close);const first=await f.store(),old=f.metadata().envelope;f.rotate();
 const receipt=await f.service().rewrap(H,f.input(persistenceId(24)));
 assert.equal(receipt.generation,'2');assert.equal(receipt.previousDigest,first.envelopeDigest);assert.equal(receipt.keyVersion,'v2');
 const writes=f.calls.filter(call=>call.action==='commit');assert.equal(writes[1].input.expectedGeneration,'1');assert.equal(writes[1].input.expectedDigest,first.envelopeDigest);
 assert.equal(f.metadata().envelope.ciphertext,old.ciphertext);assert.equal(f.metadata().envelope.nonce,old.nonce);assert.equal(f.metadata().envelope.tag,old.tag);
 assert.deepEqual(await f.service().decrypt(H,target),PERSISTENCE_CANARY);
});

test('default-off content service does not prepare metadata or invoke the provider',async t=>{
 const f=fixture();t.after(f.close);
 for(const enabled of [undefined,()=>false,async()=>true]){
  await denied(()=>f.service({enabled}).store(H,f.input(persistenceId(25)),PERSISTENCE_CANARY));
  assert.equal(f.calls.length,0);assert.equal(f.keys.calls.length,0);
 }
});

test('encryption failure creates no commit or successful storage receipt',async t=>{
 const f=fixture();t.after(f.close);f.keys.available(false);
 await denied(()=>f.store());assert.equal(f.calls.some(call=>call.action==='commit'),false);assert.equal(f.metadata().head,null);
});

test('permission loss during provider work rejects storage before any repository write',async t=>{
 const f=fixture();t.after(f.close);f.keys.beforeCall(()=>f.allow(false));
 await denied(()=>f.store());assert.equal(f.metadata().head,null);
});

test('disabled workflow during provider work cannot commit prepared ciphertext',async t=>{
 const f=fixture();t.after(f.close);f.keys.beforeCall(()=>f.enable(false));
 await denied(()=>f.store());assert.equal(f.calls.some(call=>call.action==='commit'),false);
});

test('service closure while metadata preparation completes prevents provider work',async t=>{
 const f=fixture();t.after(f.close);f.hook(action=>{if(action==='prepare')f.enable(false);});
 await denied(()=>f.store());assert.equal(f.keys.calls.length,0);assert.equal(f.calls.some(call=>call.action==='commit'),false);
});

test('abort while metadata preparation completes prevents provider work',async t=>{
 const f=fixture(),controller=new AbortController();t.after(f.close);f.hook(action=>{if(action==='prepare')controller.abort();});
 await denied(()=>f.service().store(H,f.input(persistenceId(26)),PERSISTENCE_CANARY,{signal:controller.signal}));
 assert.equal(f.keys.calls.length,0);assert.equal(f.calls.some(call=>call.action==='commit'),false);
});

test('permission loss during unwrap denies delivery and clears the owned plaintext result',async t=>{
 const f=fixture();t.after(f.close);await f.store();f.keys.beforeCall(call=>{if(call.operation==='unwrap')f.allow(false);});
 await denied(()=>f.service().decrypt(H,target));
 assert.ok(f.ownedPlaintexts.length>0);assert.ok(f.ownedPlaintexts.every(buffer=>buffer.every(byte=>byte===0)));
});

test('generation change during unwrap makes a once-current encrypted head ineligible for release',async t=>{
 const f=fixture();t.after(f.close);await f.store();f.keys.beforeCall(call=>{if(call.operation==='unwrap')f.moveHead();});
 await denied(()=>f.service().decrypt(H,target));assert.ok(f.ownedPlaintexts.every(buffer=>buffer.every(byte=>byte===0)));
});

test('key-policy change during unwrap prevents release under the earlier authorization',async t=>{
 const f=fixture();t.after(f.close);await f.store();f.keys.beforeCall(call=>{if(call.operation==='unwrap')f.rotate();});
 await denied(()=>f.service().decrypt(H,target));assert.ok(f.ownedPlaintexts.every(buffer=>buffer.every(byte=>byte===0)));
});

test('disabled service after unwrap cannot return an owned plaintext buffer',async t=>{
 const f=fixture();t.after(f.close);await f.store();f.keys.beforeCall(call=>{if(call.operation==='unwrap')f.enable(false);});
 await denied(()=>f.service().decrypt(H,target));assert.ok(f.ownedPlaintexts.every(buffer=>buffer.every(byte=>byte===0)));
});

test('service closure during the final metadata load denies and clears prepared plaintext',async t=>{
 const f=fixture();t.after(f.close);await f.store();let loads=0;
 f.hook(action=>{if(action==='load'&&++loads===2)f.enable(false);});
 await denied(()=>f.service().decrypt(H,target));assert.equal(loads,2);
 assert.ok(f.ownedPlaintexts.length>0);assert.ok(f.ownedPlaintexts.every(buffer=>buffer.every(byte=>byte===0)));
});

test('abort during the final metadata load denies and clears prepared plaintext',async t=>{
 const f=fixture(),controller=new AbortController();t.after(f.close);await f.store();let loads=0;
 f.hook(action=>{if(action==='load'&&++loads===2)controller.abort();});
 await denied(()=>f.service().decrypt(H,target,{signal:controller.signal}));assert.equal(loads,2);
 assert.ok(f.ownedPlaintexts.length>0);assert.ok(f.ownedPlaintexts.every(buffer=>buffer.every(byte=>byte===0)));
});

test('recovery reads a freshly authorized exact receipt without re-encrypting',async t=>{
 const f=fixture();t.after(f.close);const committed=await f.store(),before=f.keys.calls.length;
 const recovery={workspaceId:W,recordId:R,operationId:committed.operationId,requestDigest:committed.requestDigest};
 assert.deepEqual(await f.service().recover(H,recovery),committed);assert.equal(f.keys.calls.length,before);
 f.allow(false);await denied(()=>f.service().recover(H,recovery));assert.equal(f.keys.calls.length,before);
});

test('ordinary repository errors do not disclose details or fabricate a recovery receipt',async t=>{
 const f=fixture();t.after(f.close);f.failCommit(Error('PRIVATE-COMMIT-PASSWORD-CANARY'));
 await assert.rejects(()=>f.store(),error=>error instanceof EncryptionPersistenceError&&!/SECRET|PASSWORD|CANARY/.test(error.message)&&error.commitOutcome===undefined&&error.recovery===undefined);
 assert.equal(f.metadata().head,null);
});
