import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createTrustedEncryption,createKeyProviderAdapter,envelopeDigest,EncryptionError} from '../../services/workers/src/trusted-encryption.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const workspaceId=id(1),objectId=id(2),versionId=id(3);
const data=Buffer.from('PRIVATE-SOURCE-CANARY: preservation is not publication');
function fixture(){
 const roots=new Map(),events=[],providerCalls=[],resolutions=[];
 let subjectId='researcher',allow=true,enabled=true,auditOk=true,available=true,seq=100,hook=()=>{},auditHook=()=>{},resolverHook=()=>{},providerHook=()=>{},shapeHook=x=>x,decisionHook=()=>{},lastSpec;
 let metadata={workspaceId,objectId,versionId,environment:'ci',dataClass:'restricted_research',purpose:'research'};
 const bindings={repository:'neophilism/The-Garden',environment:'ci',providerId:'fixture-kms',classes:Object.fromEntries(['restricted_research','sensitive_contributor','operational_security'].map(c=>[c,{keyRef:'garden/ci/'+c,writeVersion:'v1',readVersions:['v1','v2']}]))};
 for(const b of Object.values(bindings.classes))for(const v of b.readVersions)roots.set(b.keyRef+'/'+v,randomBytes(32));
 const client={};
 for(const action of ['wrapDataKey','unwrapDataKey'])client[action]=async req=>{
  providerCalls.push({action,...req});await providerHook(req);if(!available)throw Error('PROVIDER-SECRET-CANARY');
  const root=roots.get(req.keyRef+'/'+req.keyVersion);if(!root)throw Error('missing key');
  const aad=Buffer.from(req.keyRef+'/'+req.keyVersion+'/'+req.contextSha256);let keyMaterial;
  if(action==='wrapDataKey'){
   const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',root,nonce);cipher.setAAD(aad);
   const body=Buffer.concat([cipher.update(req.keyMaterial),cipher.final()]);keyMaterial=Buffer.concat([nonce,body,cipher.getAuthTag()]);
  }else{
   const cipher=createDecipheriv('aes-256-gcm',root,req.keyMaterial.subarray(0,12));cipher.setAAD(aad);cipher.setAuthTag(req.keyMaterial.subarray(-16));
   keyMaterial=Buffer.concat([cipher.update(req.keyMaterial.subarray(12,-16)),cipher.final()]);
  }
  return shapeHook({providerId:'fixture-kms',keyRef:req.keyRef,keyVersion:req.keyVersion,contextSha256:req.contextSha256,keyMaterial});
 };
 const keyProvider=createKeyProviderAdapter({providerId:'fixture-kms',client});
 const config={environment:'ci',bindings,keyProvider,
  decisions:{async decide(headers,w,cb){const allowed=await cb({subjectId,workspaceId:w});await decisionHook({allowed,phase:lastSpec?.phase});return {allowed,requestId:id(++seq)};}},
  authorize:async(facts,spec)=>{lastSpec=spec;await hook(spec);return allow;},
  resolveTarget:async spec=>{resolutions.push(spec);await resolverHook();return {...metadata};},
  audit:async event=>{events.push(event);await auditHook(event);return auditOk;},enabled:()=>enabled,maxBytes:4096,providerTimeoutMs:30};
 const api=createTrustedEncryption(config);
 return {api,config,roots,events,providerCalls,resolutions,
  encrypt:(input=data,options)=>api.encrypt({},workspaceId,{objectId,versionId,plaintext:input},options),
  decrypt:(e,options)=>api.decrypt({},workspaceId,{objectId,versionId,envelope:e},options),
  actor:x=>{subjectId=x;},deny:()=>{allow=false;},disable:()=>{enabled=false;},auditFail:()=>{auditOk=false;},outage:()=>{available=false;},
  metadata:x=>{metadata={...metadata,...x};},hook:x=>{hook=x;},auditHook:x=>{auditHook=x;},providerHook:x=>{providerHook=x;},resolverHook:x=>{resolverHook=x;},shapeHook:x=>{shapeHook=x;},decisionHook:x=>{decisionHook=x;}};
}
async function rejected(action){await assert.rejects(action,e=>e instanceof EncryptionError&&e.message==='Garden encryption request rejected');}

test('restricted records round-trip with opaque wrapped key and safe audited use',async()=>{
 const f=fixture(),e=await f.encrypt();assert.equal(e.context.dataClass,'restricted_research');assert.equal(e.context.format,'garden-trusted-envelope-v1');
 assert.equal(JSON.stringify(e).includes(data.toString()),false);assert.deepEqual(await f.decrypt(e),data);
 assert.deepEqual(f.events.map(x=>x.phase),['attempt','completed','attempt','completed']);
 for(const x of f.events){assert.equal(JSON.stringify(x).includes(data.toString()),false);assert.equal(Object.hasOwn(x,'keyMaterial'),false);assert.equal(Object.hasOwn(x,'wrappedKey'),false);}
 assert.deepEqual(data,Buffer.from('PRIVATE-SOURCE-CANARY: preservation is not publication'));
 // The service clears the actual DEK supplied to the wrapping client.
 assert.ok(f.providerCalls[0].keyMaterial.every(x=>x===0));
});
test('empty content is authenticated and distinct fresh keys/nonces prevent deterministic encryption',async()=>{
 const f=fixture(),a=await f.encrypt(Buffer.alloc(0)),b=await f.encrypt(Buffer.alloc(0));
 assert.notEqual(a.nonce,b.nonce);assert.notEqual(a.wrappedKey,b.wrappedKey);assert.deepEqual(await f.decrypt(a),Buffer.alloc(0));
});
test('ciphertext, authentication tag, nonce and wrapped key tampering all fail closed',async()=>{
 const f=fixture(),e=await f.encrypt();
 for(const field of ['ciphertext','tag','nonce','wrappedKey']){const bad=structuredClone(e),b=Buffer.from(bad[field],'base64url');b[0]^=1;bad[field]=b.toString('base64url');await rejected(()=>f.decrypt(bad));}
});
test('scope, purpose and immutable object-version substitution cannot decrypt',async()=>{
 const f=fixture(),e=await f.encrypt();
 for(const [field,value] of [['workspaceId',id(7)],['objectId',id(8)],['versionId',id(9)],['environment','production'],['purpose','preservation'],['dataClass','sensitive_contributor']]){
  const bad=structuredClone(e);bad.context[field]=value;await rejected(()=>f.decrypt(bad));
 }
 await rejected(()=>f.api.decrypt({},id(7),{objectId,versionId,envelope:e}));
});
test('key-provider, key reference and key version substitution cannot decrypt',async()=>{
 const f=fixture(),e=await f.encrypt();
 for(const [field,value] of [['providerId','other-provider'],['keyRef','other/key'],['keyVersion','unapproved-v3']])await rejected(()=>f.decrypt({...e,[field]:value}));
});
test('denied and disabled calls cannot resolve protected metadata or use provider',async()=>{
 for(const change of [f=>f.deny(),f=>f.disable()]){const f=fixture();change(f);await rejected(()=>f.encrypt());assert.equal(f.resolutions.length,0);assert.equal(f.providerCalls.length,0);}
});
test('revocation before key use and after provider response blocks delivery',async()=>{
 for(const phase of ['before-key-use','deliver','after-audit']){
  const f=fixture();f.hook(s=>{if(s.phase===phase)f.deny();});await rejected(()=>f.encrypt());
  if(phase==='before-key-use')assert.equal(f.providerCalls.length,0);
 }
});
test('identity switch after admission rejects instead of changing the caller',async()=>{
 const f=fixture();f.hook(s=>{if(s.phase==='admit')f.actor('different-researcher');});await rejected(()=>f.encrypt());assert.equal(f.providerCalls.length,0);
});
test('metadata reclassification while processing fails closed',async()=>{
 const f=fixture();f.providerHook(()=>f.metadata({dataClass:'sealed_ciphertext'}));await rejected(()=>f.encrypt());
});
test('sealed, public and governmental classes never enter trusted processing',async()=>{
 for(const dataClass of ['sealed_ciphertext','public_policy','public_verified_research','future_governmental']){
  const f=fixture();f.metadata({dataClass});await rejected(()=>f.encrypt());assert.equal(f.providerCalls.length,0);
 }
});
test('wrong environment and invalid purpose reject before key use',async()=>{
 for(const patch of [{environment:'production'},{purpose:'political-targeting'},{dataClass:'operational_security',purpose:'research'}]){
  const f=fixture();f.metadata(patch);await rejected(()=>f.encrypt());assert.equal(f.providerCalls.length,0);
 }
});
test('provider outage, missing key and adapter errors do not disclose secrets or release plaintext',async()=>{
 const f=fixture(),e=await f.encrypt();f.outage();await rejected(()=>f.decrypt(e));
 const g=fixture(),x=await g.encrypt();g.roots.clear();await rejected(()=>g.decrypt(x));
});
test('provider timeout rejects promptly and settled cancellation permits the next call',async()=>{
 const f=fixture();f.providerHook(()=>new Promise(()=>{}));await rejected(()=>f.encrypt());
 const g=fixture(),controller=new AbortController();g.providerHook(()=>{controller.abort();});
 await rejected(()=>g.api.encrypt({},workspaceId,{objectId,versionId,plaintext:data},{signal:controller.signal}));
 g.providerHook(()=>{});assert.ok(await g.encrypt());
});
test('audit attempt failure prevents provider calls, completion failure prevents plaintext delivery',async()=>{
 const f=fixture();f.auditFail();await rejected(()=>f.encrypt());assert.equal(f.providerCalls.length,0);
 const g=fixture(),e=await g.encrypt();g.auditHook(event=>{if(event.phase==='completed')g.auditFail();});await rejected(()=>g.decrypt(e));
});
test('revocation during completion audit prevents plaintext delivery',async()=>{
 const f=fixture(),e=await f.encrypt();f.auditHook(event=>{if(event.phase==='completed')f.deny();});await rejected(()=>f.decrypt(e));
});
test('audit decision failure, forged allow and absent identity all fail closed',async()=>{
 for(const decisions of [{decide:async()=>{throw Error('AUDIT-TOKEN');}},{decide:async()=>({allowed:true,requestId:id(5)})},{decide:async(h,w,cb)=>({allowed:await cb({subjectId:'',workspaceId:w}),requestId:id(5)})}]){
  const f=fixture(),api=createTrustedEncryption({...f.config,decisions});await rejected(()=>api.encrypt({},workspaceId,{objectId,versionId,plaintext:data}));assert.equal(f.providerCalls.length,0);
 }
});
test('normal rewrap changes only the wrapper, returns a CAS receipt and preserves prior envelope',async()=>{
 const f=fixture(),old=await f.encrypt(),original=JSON.stringify(old),bindings=structuredClone(f.config.bindings);
 bindings.classes.restricted_research.writeVersion='v2';const rotated=createTrustedEncryption({...f.config,bindings});
 const next=await rotated.rewrap({},workspaceId,{objectId,versionId,envelope:old});
 assert.equal(JSON.stringify(old),original);assert.equal(next.envelope.ciphertext,old.ciphertext);assert.equal(next.envelope.tag,old.tag);assert.equal(next.envelope.keyVersion,'v2');
 assert.equal(next.rotation.previousEnvelopeSha256,envelopeDigest(old));assert.equal(next.rotation.nextEnvelopeSha256,envelopeDigest(next.envelope));assert.equal(next.rotation.requiresCompareAndSwap,true);assert.equal(next.rotation.oldKeyRetirementVerified,false);
 assert.deepEqual(await rotated.decrypt({},workspaceId,{objectId,versionId,envelope:next.envelope}),data);assert.deepEqual(await f.decrypt(old),data);
});
test('tampered payload cannot receive a successful rotation receipt',async()=>{
 const f=fixture(),old=await f.encrypt(),bindings=structuredClone(f.config.bindings);bindings.classes.restricted_research.writeVersion='v2';
 const api=createTrustedEncryption({...f.config,bindings});old.tag=Buffer.alloc(16).toString('base64url');
 await rejected(()=>api.rewrap({},workspaceId,{objectId,versionId,envelope:old}));assert.equal(f.providerCalls.filter(c=>c.action==='wrapDataKey').length,1);
});
test('a rewrap is not silently declared complete when already on the write key',async()=>{
 const f=fixture(),e=await f.encrypt();await rejected(()=>f.api.rewrap({},workspaceId,{objectId,versionId,envelope:e}));
});
test('backup restoration fails with absent old key and succeeds with recovered key material',async()=>{
 const f=fixture(),backup=JSON.parse(JSON.stringify(await f.encrypt())),ref=backup.keyRef+'/v1',held=Buffer.from(f.roots.get(ref));
 f.roots.delete(ref);await rejected(()=>f.decrypt(backup));f.roots.set(ref,held);assert.deepEqual(await f.decrypt(backup),data);
});
test('retired read keys are denied even when a provider still possesses them',async()=>{
 const f=fixture(),e=await f.encrypt(),bindings=structuredClone(f.config.bindings);bindings.classes.restricted_research={...bindings.classes.restricted_research,writeVersion:'v2',readVersions:['v2']};
 const api=createTrustedEncryption({...f.config,bindings});await rejected(()=>api.decrypt({},workspaceId,{objectId,versionId,envelope:e}));
});
test('bounded plaintext, malformed encodings and unknown envelope fields reject before provider access',async()=>{
 const f=fixture();await rejected(()=>f.encrypt(Buffer.alloc(4097)));const e=await f.encrypt();
 for(const patch of [{ciphertext:e.ciphertext+'='},{nonce:'!bad'},{wrappedKey:'x'.repeat(22000)},{plaintext:'should-never-be-accepted'}])await rejected(()=>f.decrypt({...e,...patch}));
});
test('caller mutation across awaits cannot alter the encrypted bytes or envelope',async()=>{
 const f=fixture(),input=Buffer.from(data);let n=0;f.resolverHook(()=>{if(++n===1)input.fill(0);});const e=await f.encrypt(input);assert.deepEqual(await f.decrypt(e),data);
 const g=fixture(),source=await g.encrypt();g.resolverHook(()=>{source.tag='changed';});assert.deepEqual(await g.decrypt(source),data);
});
test('class key separation and repository/provider/environment pins are mandatory',()=>{
 const f=fixture();
 for(const mutate of [b=>{b.repository='other/repo';},b=>{b.environment='production';},b=>{b.providerId='other';},b=>{b.classes.sensitive_contributor.keyRef=b.classes.restricted_research.keyRef;},b=>{b.classes.restricted_research.writeVersion='missing';}]){
  const bindings=structuredClone(f.config.bindings);mutate(bindings);assert.throws(()=>createTrustedEncryption({...f.config,bindings}),EncryptionError);
 }
 assert.throws(()=>createTrustedEncryption({...f.config,environment:'preview'}),EncryptionError);
});
test('provider response binding and raw key lengths are checked before use',async()=>{
 for(const patch of [{providerId:'wrong'},{keyRef:'wrong'},{keyVersion:'v2'},{contextSha256:'0'.repeat(64)},{keyMaterial:Buffer.alloc(0)}]){
  const f=fixture();f.shapeHook(x=>({...x,...patch}));await rejected(()=>f.encrypt());
 }
 const f=fixture(),e=await f.encrypt();let exposed;f.shapeHook(x=>{exposed=x.keyMaterial;return {...x,keyVersion:'wrong'};});await rejected(()=>f.decrypt(e));assert.ok(exposed.every(x=>x===0));
});
test('no roots, plaintext, provider errors or wrapping material are included in audit receipts',async()=>{
 const f=fixture(),e=await f.encrypt();await f.decrypt(e);const serialized=JSON.stringify(f.events);
 assert.ok(!serialized.includes(data.toString())&&!serialized.includes(e.wrappedKey)&&!serialized.includes(e.ciphertext));
 for(const root of f.roots.values())assert.equal(serialized.includes(root.toString('hex')),false);
 assert.deepEqual(Object.keys(f.api).sort(),['decrypt','encrypt','rewrap']);
});
test('bounded concurrent operations reject excess work and recover after completion',async()=>{
 const f=fixture();let unblock;const blocked=new Promise(r=>{unblock=r;});f.providerHook(()=>blocked);
 const api=createTrustedEncryption({...f.config,maxConcurrent:1,providerTimeoutMs:1000});const first=api.encrypt({},workspaceId,{objectId,versionId,plaintext:data});
 await rejected(()=>api.encrypt({},workspaceId,{objectId,versionId,plaintext:data}));unblock();await first;f.providerHook(()=>{});assert.ok(await api.encrypt({},workspaceId,{objectId,versionId,plaintext:data}));
});

test('disablement or cancellation inside final authorization denies every result type',async()=>{
 for(const action of ['encrypt','decrypt','rewrap'])for(const change of ['disable','abort']){
  const f=fixture(),old=await f.encrypt(),controller=new AbortController(),bindings=structuredClone(f.config.bindings);
  bindings.classes.restricted_research.writeVersion='v2';
  const api=createTrustedEncryption({...f.config,bindings});
  f.hook(spec=>{if(spec.phase==='after-audit'){if(change==='disable')f.disable();else controller.abort();}});
  const input=action==='encrypt'?{objectId,versionId,plaintext:data}:{objectId,versionId,envelope:old};
  await rejected(()=>api[action]({},workspaceId,input,{signal:controller.signal}));
 }
});
test('final decision audit tails cannot hide disablement, cancellation, grant withdrawal or reclassification',async()=>{
 for(const change of ['disable','abort','deny','reclassify']){
  const f=fixture(),old=await f.encrypt(),controller=new AbortController();
  f.decisionHook(event=>{if(event.phase!=='after-audit')return;
   if(change==='abort')controller.abort();else if(change==='reclassify')f.metadata({purpose:'preservation'});else f[change]();
  });
  await rejected(()=>f.decrypt(old,{signal:controller.signal}));
 }
});
test('revocation in attempt audit prevents the actual key-provider invocation',async()=>{
 for(const action of ['encrypt','decrypt','rewrap'])for(const change of ['deny','disable','abort','reclassify']){
  const f=fixture(),old=await f.encrypt(),controller=new AbortController(),bindings=structuredClone(f.config.bindings);
  bindings.classes.restricted_research.writeVersion='v2';const api=createTrustedEncryption({...f.config,bindings}),before=f.providerCalls.length;
  f.auditHook(event=>{if(event.phase!=='attempt')return;
   if(change==='abort')controller.abort();else if(change==='reclassify')f.metadata({purpose:'preservation'});else f[change]();
  });
  const input=action==='encrypt'?{objectId,versionId,plaintext:data}:{objectId,versionId,envelope:old};
  await rejected(()=>api[action]({},workspaceId,input,{signal:controller.signal}));assert.equal(f.providerCalls.length,before);
 }
});
test('post-attempt decision audit tail is revalidated before provider dispatch',async()=>{
 for(const change of ['deny','disable']){
  const f=fixture();f.decisionHook(event=>{if(event.phase==='after-attempt-audit')f[change]();});
  await rejected(()=>f.encrypt());assert.equal(f.providerCalls.length,0);
 }
});
test('admission audit revocation prevents protected metadata resolution',async()=>{
 for(const change of ['deny','disable']){
  const f=fixture();f.decisionHook(event=>{if(event.phase==='resolve-target')f[change]();});
  await rejected(()=>f.encrypt());assert.equal(f.resolutions.length,0);assert.equal(f.providerCalls.length,0);
 }
});
test('default-off and asynchronous enable predicates cannot activate the component',async()=>{
 for(const enabled of [undefined,async()=>true,async()=>{throw Error('ASYNC-ENABLE-SECRET');},()=>1]){
  const f=fixture(),api=createTrustedEncryption({...f.config,enabled});
  await rejected(()=>api.encrypt({},workspaceId,{objectId,versionId,plaintext:data}));assert.equal(f.resolutions.length,0);assert.equal(f.providerCalls.length,0);
 }
 const f=fixture();
 for(const options of [null,false,{signal:{aborted:false}},{unsupported:true}])await rejected(()=>f.encrypt(data,options));
 assert.equal(f.providerCalls.length,0);await new Promise(resolve=>setImmediate(resolve));
});
test('JSON object reordering preserves authenticated context, envelope digest and rewrap predecessor',async()=>{
 const f=fixture(),original=await f.encrypt(),reverse=object=>Object.fromEntries(Object.entries(object).reverse());
 const stored=JSON.parse(JSON.stringify(reverse({...original,context:reverse(original.context)})));
 assert.deepEqual(await f.decrypt(stored),data);assert.equal(envelopeDigest(stored),envelopeDigest(original));
 const bindings=structuredClone(f.config.bindings);bindings.classes.restricted_research.writeVersion='v2';
 const api=createTrustedEncryption({...f.config,bindings}),rotated=await api.rewrap({},workspaceId,{objectId,versionId,envelope:stored});
 assert.equal(rotated.rotation.previousEnvelopeSha256,envelopeDigest(original));
 assert.equal(rotated.rotation.nextEnvelopeSha256,envelopeDigest(reverse({...rotated.envelope,context:reverse(rotated.envelope.context)})));
 const changed=structuredClone(original);changed.context.purpose='preservation';assert.notEqual(envelopeDigest(changed),envelopeDigest(original));await rejected(()=>f.decrypt(changed));
 assert.throws(()=>envelopeDigest({...original,ignored:'must-not-be-hashed'}),EncryptionError);
});
test('format, algorithm and tag-length substitutions reject before additional key use',async()=>{
 const f=fixture(),envelope=await f.encrypt(),before=f.providerCalls.length;
 for(const algorithm of ['AES-128-GCM','AES-256-CBC','aes-256-gcm','unknown'])await rejected(()=>f.decrypt({...envelope,context:{...envelope.context,algorithm}}));
 await rejected(()=>f.decrypt({...envelope,context:{...envelope.context,format:'garden-trusted-envelope-v2'}}));
 for(const length of [0,4,8,12,15,17,32])await rejected(()=>f.decrypt({...envelope,tag:Buffer.alloc(length).toString('base64url')}));
 assert.equal(f.providerCalls.length,before);
});
test('unknown non-enumerable fields and accessors are not alternate envelope representations',async()=>{
 const f=fixture(),envelope=await f.encrypt(),before=f.providerCalls.length;
 const hidden=structuredClone(envelope);Object.defineProperty(hidden,'hidden',{value:'ignored'});await rejected(()=>f.decrypt(hidden));
 const accessor=structuredClone(envelope);Object.defineProperty(accessor,'tag',{get(){throw Error('GETTER-SECRET');},enumerable:true});await rejected(()=>f.decrypt(accessor));
 assert.equal(f.providerCalls.length,before);
});
test('factory adapter freezes client metadata and rejects echoes of attempted replacement pins',async()=>{
 for(const field of ['keyRef','keyVersion','contextSha256']){
  let supplied;
  const client={unwrapDataKey:async()=>{},wrapDataKey:async req=>{
   supplied=req;const wrong=field==='contextSha256'?'f'.repeat(64):'replacement';
   try{req[field]=wrong;}catch{}
   return {providerId:'fixture-kms',keyRef:req.keyRef,keyVersion:req.keyVersion,contextSha256:req.contextSha256,keyMaterial:randomBytes(60),[field]:wrong};
  }};
  const adapter=createKeyProviderAdapter({providerId:'fixture-kms',client}),key=randomBytes(32),copy=Buffer.from(key);
  await rejected(()=>adapter.wrap({keyRef:'original',keyVersion:'v1',contextSha256:'1'.repeat(64),keyMaterial:key,signal:new AbortController().signal}));
  assert.ok(Object.isFrozen(supplied));assert.deepEqual(key,copy);assert.ok(supplied.keyMaterial.every(x=>x===0));
 }
});
test('adapter pins caller metadata and client methods across asynchronous work',async()=>{
 let release,entered;const ready=new Promise(resolve=>{entered=resolve;}),blocked=new Promise(resolve=>{release=resolve;});
 const client={unwrapDataKey:async()=>{},wrapDataKey:async req=>{
  entered();await blocked;return {providerId:'fixture-kms',keyRef:req.keyRef,keyVersion:req.keyVersion,contextSha256:req.contextSha256,keyMaterial:Buffer.alloc(60,7)};
 }};
 const adapter=createKeyProviderAdapter({providerId:'fixture-kms',client}),request={keyRef:'original',keyVersion:'v1',contextSha256:'1'.repeat(64),keyMaterial:randomBytes(32),signal:new AbortController().signal};
 const result=adapter.wrap(request);await ready;request.keyRef='changed';request.keyVersion='v9';request.contextSha256='0'.repeat(64);
 client.wrapDataKey=async()=>{throw Error('REPLACEMENT-SECRET');};release();assert.deepEqual(await result,Buffer.alloc(60,7));
 assert.deepEqual(await adapter.wrap({...request,keyRef:'original'}),Buffer.alloc(60,7));
});
test('a structural provider cannot bypass the response-checking factory adapter',()=>{
 const f=fixture();assert.throws(()=>createTrustedEncryption({...f.config,keyProvider:{...f.config.keyProvider}}),EncryptionError);
});
test('a provider raw-DEK echo is not accepted as a wrapped envelope key',async()=>{
 const f=fixture();f.shapeHook(response=>({...response,keyMaterial:Buffer.from(f.providerCalls.at(-1).keyMaterial)}));
 await rejected(()=>f.encrypt());assert.equal(f.events.some(event=>event.phase==='completed'),false);
});
test('copying then clearing the client buffer cannot disguise a raw-DEK echo',async()=>{
 let retained;
 const client={unwrapDataKey:async()=>{},wrapDataKey:async req=>{
  retained=Buffer.from(req.keyMaterial);req.keyMaterial.fill(0);
  return {providerId:'fixture-kms',keyRef:req.keyRef,keyVersion:req.keyVersion,contextSha256:req.contextSha256,keyMaterial:retained};
 }};
 const adapter=createKeyProviderAdapter({providerId:'fixture-kms',client}),key=randomBytes(32);
 try{
  await rejected(()=>adapter.wrap({keyRef:'original',keyVersion:'v1',contextSha256:'1'.repeat(64),keyMaterial:key,signal:new AbortController().signal}));
  assert.ok(retained.every(x=>x===0));
 }
 finally{key.fill(0);retained?.fill(0);}
});
test('late unwrap success is cleared and timed-out or cancelled provider work retains bounded capacity',async()=>{
 for(const cancellation of ['timeout','abort']){
  const f=fixture(),old=await f.encrypt(),controller=new AbortController();let release,entered,retained;
  const ready=new Promise(resolve=>{entered=resolve;}),blocked=new Promise(resolve=>{release=resolve;});
  f.shapeHook(async response=>{retained=response.keyMaterial;entered();await blocked;return response;});
  const api=createTrustedEncryption({...f.config,maxConcurrent:1,providerTimeoutMs:cancellation==='timeout'?10:1000});
  const call=()=>api.decrypt({},workspaceId,{objectId,versionId,envelope:old},{signal:controller.signal});
  const first=rejected(call);await ready;assert.ok(retained.some(x=>x!==0));if(cancellation==='abort')controller.abort();await first;
  for(let i=0;i<3;i++)await rejected(()=>api.decrypt({},workspaceId,{objectId,versionId,envelope:old}));
  assert.equal(f.providerCalls.filter(call=>call.action==='unwrapDataKey').length,1);
  release();await new Promise(resolve=>setImmediate(resolve));assert.ok(retained.every(x=>x===0));
  f.shapeHook(response=>response);assert.deepEqual(await api.decrypt({},workspaceId,{objectId,versionId,envelope:old}),data);
 }
});
test('timeout clears the wrapping client copy while an uncooperative provider remains pending',async()=>{
 const f=fixture();let release,entered,held;const ready=new Promise(resolve=>{entered=resolve;}),blocked=new Promise(resolve=>{release=resolve;});
 f.providerHook(req=>{held=req.keyMaterial;entered();return blocked;});
 const api=createTrustedEncryption({...f.config,maxConcurrent:1,providerTimeoutMs:10}),first=rejected(()=>api.encrypt({},workspaceId,{objectId,versionId,plaintext:data}));
 await ready;assert.ok(held.some(x=>x!==0));await first;assert.ok(held.every(x=>x===0));
 await rejected(()=>api.encrypt({},workspaceId,{objectId,versionId,plaintext:data}));assert.equal(f.providerCalls.length,1);
 release();await new Promise(resolve=>setImmediate(resolve));f.providerHook(()=>{});assert.ok(await api.encrypt({},workspaceId,{objectId,versionId,plaintext:data}));
});
test('every invalid unwrap key length is rejected and the client response buffer is cleared',async()=>{
 for(const length of [0,16,24,31,33,64]){
  const f=fixture(),old=await f.encrypt(),exposed=Buffer.alloc(length,9);f.shapeHook(response=>({...response,keyMaterial:exposed}));
  await rejected(()=>f.decrypt(old));assert.ok(exposed.every(x=>x===0));
 }
});
test('wrong recovered key cannot restore an envelope; only the original key succeeds',async()=>{
 const f=fixture(),backup=JSON.parse(JSON.stringify(await f.encrypt())),ref=backup.keyRef+'/v1',recovered=Buffer.from(f.roots.get(ref));
 f.roots.delete(ref);await rejected(()=>f.decrypt(backup));f.roots.set(ref,randomBytes(32));await rejected(()=>f.decrypt(backup));
 f.roots.set(ref,recovered);assert.deepEqual(await f.decrypt(backup),data);
});
test('failed new-version rewrap leaves the prior envelope readable and returns no completed rotation',async()=>{
 const f=fixture(),old=await f.encrypt(),before=envelopeDigest(old),bindings=structuredClone(f.config.bindings);bindings.classes.restricted_research.writeVersion='v2';
 f.roots.delete(old.keyRef+'/v2');const api=createTrustedEncryption({...f.config,bindings});
 await rejected(()=>api.rewrap({},workspaceId,{objectId,versionId,envelope:old}));assert.equal(envelopeDigest(old),before);assert.deepEqual(await f.decrypt(old),data);
 assert.equal(f.events.filter(event=>event.action==='rewrap'&&event.phase==='completed').length,0);
});
test('rewrap authorization distinguishes new-version wrapping from old-version unwrapping',async()=>{
 const f=fixture(),old=await f.encrypt(),bindings=structuredClone(f.config.bindings);bindings.classes.restricted_research.writeVersion='v2';
 const seen=[],api=createTrustedEncryption({...f.config,bindings,authorize:async(facts,spec)=>{seen.push(spec);return !(spec.providerOperation==='wrap'&&spec.keyVersion==='v2');}});
 await rejected(()=>api.rewrap({},workspaceId,{objectId,versionId,envelope:old}));
 assert.ok(seen.some(spec=>spec.providerOperation==='unwrap'&&spec.keyVersion==='v1'));
 assert.ok(seen.some(spec=>spec.providerOperation==='wrap'&&spec.keyVersion==='v2'));
 assert.equal(f.providerCalls.filter(call=>call.action==='wrapDataKey').length,1);
});
test('policy mutation after construction cannot replace pinned key bindings',async()=>{
 const f=fixture();f.config.bindings.classes.restricted_research.keyRef='other/key';f.config.bindings.classes.restricted_research.writeVersion='v9';f.config.bindings.classes.restricted_research.readVersions.push('v9');
 const envelope=await f.encrypt();assert.equal(envelope.keyRef,'garden/ci/restricted_research');assert.equal(envelope.keyVersion,'v1');assert.deepEqual(await f.decrypt(envelope),data);
});
