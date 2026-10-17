/** GDN-026: bounded server-side envelope encryption, never sealed E2EE.
 * No HTTP route, persistent keyring, provider credential or plaintext fallback.
 */
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

const FORMAT='garden-trusted-envelope-v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HANDLE=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/;
const CLASSES=['restricted_research','sensitive_contributor','operational_security'];
const ENVIRONMENTS=['local','ci','staging','production'];
const CONTEXT_FIELDS=['format','algorithm','workspaceId','objectId','versionId','environment','dataClass','purpose'];
const ENVELOPE_FIELDS=['context','providerId','keyRef','keyVersion','wrappedKey','nonce','ciphertext','tag'];
const MAX_BYTES=8*1024*1024;
const adapters=new WeakSet();

export class EncryptionError extends Error {
 constructor(){super('Garden encryption request rejected');this.name='EncryptionError';}
}
const fail=()=>{throw new EncryptionError();};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value);
function exact(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(descriptors);
 if(actual.length!==keys.length||actual.some(key=>typeof key!=='string'||!keys.includes(key)))fail();
 const copy={};
 for(const key of keys){
  const descriptor=descriptors[key];
  if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))fail();
  copy[key]=descriptor.value;
 }
 return copy;
}
function handle(value){if(typeof value!=='string'||!HANDLE.test(value))fail();return value;}
function uuid(value){if(typeof value!=='string'||!UUID.test(value))fail();return value;}
function bytes(value,min,max){if(!Buffer.isBuffer(value)||value.length<min||value.length>max)fail();return value;}
function decode(value,min,max){
 if(typeof value!=='string'||value.length>Math.ceil(max/3)*4||!/^[A-Za-z0-9_-]*$/.test(value))fail();
 const result=Buffer.from(value,'base64url');if(result.toString('base64url')!==value)fail();return bytes(result,min,max);
}
function canonicalContext(value){
 const context=exact(value,CONTEXT_FIELDS);
 if(context.format!==FORMAT||context.algorithm!=='AES-256-GCM'||!ENVIRONMENTS.includes(context.environment)||!CLASSES.includes(context.dataClass)||!['research','preservation','security'].includes(context.purpose))fail();
 for(const key of ['workspaceId','objectId','versionId'])uuid(context[key]);
 if((context.dataClass==='operational_security')!==(context.purpose==='security'))fail();
 return Object.freeze(context);
}
function canonicalEnvelope(value,maxBytes){
 const envelope=exact(value,ENVELOPE_FIELDS);
 envelope.context=canonicalContext(envelope.context);
 handle(envelope.providerId);handle(envelope.keyRef);handle(envelope.keyVersion);
 decode(envelope.wrappedKey,1,16384);decode(envelope.nonce,12,12);decode(envelope.ciphertext,0,maxBytes);decode(envelope.tag,16,16);
 return envelope;
}
function target(value,workspaceId,objectId,versionId,environment){
 const metadata=exact(value,['workspaceId','objectId','versionId','environment','dataClass','purpose']);
 if(metadata.workspaceId!==workspaceId||metadata.objectId!==objectId||metadata.versionId!==versionId||metadata.environment!==environment)fail();
 return canonicalContext({format:FORMAT,algorithm:'AES-256-GCM',...metadata});
}
function policy(value,environment,providerId){
 const p=exact(value,['repository','environment','providerId','classes']);
 if(p.repository!=='neophilism/The-Garden'||p.environment!==environment||p.providerId!==providerId)fail();
 p.classes=exact(p.classes,CLASSES);
 const refs=new Set();
 for(const name of CLASSES){
  const b=exact(p.classes[name],['keyRef','writeVersion','readVersions']);handle(b.keyRef);handle(b.writeVersion);
  if(refs.has(b.keyRef)||!Array.isArray(b.readVersions)||!b.readVersions.length||b.readVersions.length>32||new Set(b.readVersions).size!==b.readVersions.length||!b.readVersions.includes(b.writeVersion))fail();
  b.readVersions=Object.freeze(b.readVersions.map(handle));refs.add(b.keyRef);p.classes[name]=Object.freeze(b);
 }
 Object.freeze(p.classes);return Object.freeze(p);
}
function checkEnvelope(value,context,binding,providerId){
 if(json(value.context)!==json(context)||value.providerId!==providerId||value.keyRef!==binding.keyRef||!binding.readVersions.includes(value.keyVersion))fail();
}
export function envelopeDigest(value){
 try{return hash(json(canonicalEnvelope(value,MAX_BYTES)));}catch{fail();}
}
function clearResponseKey(response){
 // Even malformed provider responses must lose any data-property DEK we can
 // reach. A hostile provider's retained copies/native memory remain outside us.
 try{const material=response&&Object.getOwnPropertyDescriptor(response,'keyMaterial')?.value;if(Buffer.isBuffer(material))material.fill(0);}catch{}
}

/** Factory-only adapter for an operator-supplied, authenticated key-service
 * client. Transport, IAM and actual provider custody must be evidenced by the
 * host; satisfying this interface does not approve a real provider.
 */
export function createKeyProviderAdapter({providerId,client}){
 handle(providerId);
 if(typeof client?.wrapDataKey!=='function'||typeof client?.unwrapDataKey!=='function')fail();
 const methods={wrap:client.wrapDataKey.bind(client),unwrap:client.unwrapDataKey.bind(client)};
 const provider={id:providerId};
 for(const method of ['wrap','unwrap'])provider[method]=async request=>{
  let response,owned,signal,abort;
  try{
   const input=exact(request,['keyRef','keyVersion','contextSha256','keyMaterial','signal']);
   const keyRef=handle(input.keyRef),keyVersion=handle(input.keyVersion),contextSha256=input.contextSha256;
   signal=input.signal;
   if(typeof contextSha256!=='string'||!/^[0-9a-f]{64}$/.test(contextSha256)||!(signal instanceof AbortSignal)||signal.aborted)fail();
   owned=Buffer.from(bytes(input.keyMaterial,method==='wrap'?32:1,method==='wrap'?32:16384));
   const inputKeyDigest=method==='wrap'?hash(owned):null;
   abort=()=>owned.fill(0);signal.addEventListener('abort',abort,{once:true});
   if(signal.aborted)fail();
   // Snapshot metadata and give the client an owned copy. Response checks use
   // captured primitives, never an object a client can rewrite across await.
   response=await methods[method](Object.freeze({keyRef,keyVersion,contextSha256,keyMaterial:owned,signal}));
   const output=exact(response,['providerId','keyRef','keyVersion','contextSha256','keyMaterial']);
   if(signal.aborted||output.providerId!==providerId||output.keyRef!==keyRef||output.keyVersion!==keyVersion||output.contextSha256!==contextSha256)fail();
   const material=bytes(output.keyMaterial,method==='unwrap'?32:1,method==='unwrap'?32:16384);
   // The client can clear/change its owned copy. Compare against a digest
   // captured before dispatch, not that mutable buffer after the await.
   if(method==='wrap'&&hash(material)===inputKeyDigest)fail();
   return Buffer.from(material);
  }catch{fail();}finally{
   if(signal instanceof AbortSignal&&abort)signal.removeEventListener('abort',abort);
   owned?.fill(0);
   // Replies are copied before return. Clear both kinds of response buffer:
   // even a malformed wrap reply can contain an echoed plaintext data key.
   clearResponseKey(response);
  }
 };
 adapters.add(provider);return Object.freeze(provider);
}

/** Trusted host obligations: resolveTarget reads authoritative version metadata;
 * authorize rechecks current record/purpose permission; decisions records every
 * allow/deny; audit durably acknowledges safe key-use events. enabled must be a
 * synchronous current-state predicate. Persistent commit/delivery atomicity,
 * real provider custody and rollback protection belong to the host.
 */
export function createTrustedEncryption({environment,bindings,keyProvider,decisions,authorize,resolveTarget,audit,enabled=()=>false,maxBytes=MAX_BYTES,maxConcurrent=4,providerTimeoutMs=5000}){
 if(!ENVIRONMENTS.includes(environment)||!adapters.has(keyProvider)||typeof decisions?.decide!=='function'||[authorize,resolveTarget,audit,enabled].some(x=>typeof x!=='function')||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_BYTES||!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>8||!Number.isInteger(providerTimeoutMs)||providerTimeoutMs<10||providerTimeoutMs>30000)fail();
 const providerId=keyProvider.id,p=policy(bindings,environment,providerId),decide=decisions.decide.bind(decisions);
 let inFlight=0,providerInFlight=0;
 const api={};
 for(const action of ['encrypt','decrypt','rewrap'])api[action]=async (headers,workspaceId,input,options={})=>{
  // A provider that ignores cancellation retains capacity until it actually
  // settles. Caller timeout cannot admit unbounded underlying key operations.
  if(inFlight>=maxConcurrent||providerInFlight>=maxConcurrent)fail();inFlight++;
  let dataKey,plaintext,result,source,actor,context,binding,signal;
  const fence=()=>{
   if(signal?.aborted)fail();const active=enabled();
   // Async predicates are unsupported and never grant access. Observe their
   // rejection so a configuration mistake cannot leave an unhandled promise.
   if(active instanceof Promise)void active.catch(()=>{});
   if(active!==true)fail();
  };
  try{
   signal=exact(options,Object.hasOwn(options,'signal')?['signal']:[]).signal;
   uuid(workspaceId);if(signal!==undefined&&!(signal instanceof AbortSignal))fail();fence();
   const request=exact(input,action==='encrypt'?['objectId','versionId','plaintext']:['objectId','versionId','envelope']);
   const objectId=uuid(request.objectId),versionId=uuid(request.versionId);
   if(action==='encrypt')plaintext=Buffer.from(bytes(request.plaintext,0,maxBytes));
   else source=canonicalEnvelope(request.envelope,maxBytes);

   function identity(facts){
    if(facts?.workspaceId!==workspaceId||typeof facts.subjectId!=='string'||!facts.subjectId||facts.subjectId.length>128||(actor&&actor!==facts.subjectId))fail();
    return Object.freeze({subjectId:facts.subjectId,workspaceId,...(facts.requestId===undefined?{}:{requestId:uuid(facts.requestId)})});
   }
   async function permitted(facts,spec){
    fence();const allowed=await authorize(facts,Object.freeze(spec));fence();if(allowed!==true)fail();
   }
   async function currentTarget(){
    fence();const current=target(await resolveTarget({workspaceId,objectId,versionId}),workspaceId,objectId,versionId,environment);fence();
    if(context&&json(current)!==json(context))fail();return current;
   }
   // Authorization precedes even metadata resolution. After the decision's
   // asynchronous audit tail, recheck permission without another audit tail.
   let admitted;
   const admissionSpec={action:'encryption:'+action,phase:'resolve-target',workspaceId,objectId,versionId,context:null};
   const admission=await decide(headers,workspaceId,async facts=>{
    try{const current=identity(facts);await permitted(current,admissionSpec);admitted=current;return true;}catch{return false;}
   });
   fence();if(!admitted||admission?.allowed!==true)fail();uuid(admission.requestId);
   await permitted(admitted,admissionSpec);actor=admitted.subjectId;
   context=await currentTarget();binding=p.classes[context.dataClass];
   if(source)checkEnvelope(source,context,binding,providerId);
   if(action==='rewrap'&&source.keyVersion===binding.writeVersion)fail();

   async function gate(phase,keyUse){
    let observed;
    const spec={action:'encryption:'+action,phase,context,keyRef:binding.keyRef,keyVersion:keyUse?.keyVersion??source?.keyVersion??binding.writeVersion,targetKeyVersion:binding.writeVersion,...(keyUse?{providerOperation:keyUse.method}:{})};
    const decision=await decide(headers,workspaceId,async facts=>{
     try{
      const current=identity(facts);await currentTarget();await permitted(current,spec);observed=current;return true;
     }catch{return false;}
    });
    fence();if(!observed||decision?.allowed!==true)fail();uuid(decision.requestId);
    // A decision receipt can take time to persist. Do not reuse its earlier
    // classification/grant check as authority after that asynchronous boundary.
    await currentTarget();await permitted(observed,spec);fence();return decision.requestId;
   }
   async function record(phase,requestId,keyVersion){
    fence();
    // Exact safe fields only: no content, keys, provider exceptions, headers,
    // source titles, user names or arbitrary error text.
    const recorded=await audit(Object.freeze({format:'garden-key-use-v1',action,phase,requestId,workspaceId,objectId,versionId,environment,dataClass:context.dataClass,providerId,keyRef:binding.keyRef,keyVersion}));
    fence();if(recorded!==true)fail();
   }
   async function callProvider(method,keyVersion,keyMaterial){
    const keyUse={method,keyVersion};
    const requestId=await gate('before-key-use',keyUse);await record('attempt',requestId,keyVersion);
    await gate('after-attempt-audit',keyUse);fence();
    if(providerInFlight>=maxConcurrent)fail();
    const controller=new AbortController(),abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    let timer,onAbort,output,transferred=false;
    try{
     const deadline=new Promise((_,reject)=>{onAbort=()=>reject(new EncryptionError());controller.signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>controller.abort(),providerTimeoutMs);});
     // Observe rejection even if a synchronous final fence prevents dispatch.
     void deadline.catch(()=>{});
     if(signal?.aborted)controller.abort();
     fence();if(controller.signal.aborted)fail();
     providerInFlight++;
     // Invoke immediately after the fence. The factory adapter owns/clears its
     // client copy; this layer also disposes any unclaimed late unwrap result.
     const work=keyProvider[method]({keyRef:binding.keyRef,keyVersion,contextSha256:hash(json(context)),keyMaterial,signal:controller.signal})
      .then(value=>{
       output=value;
       try{bytes(value,method==='unwrap'?32:1,method==='unwrap'?32:16384);if(controller.signal.aborted)fail();fence();return value;}
       catch{if(method==='unwrap'&&Buffer.isBuffer(value))value.fill(0);fail();}
      }).finally(()=>{providerInFlight--;});
     const value=await Promise.race([deadline,work]);fence();if(controller.signal.aborted)fail();
     transferred=true;return value;
    }finally{
     clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);signal?.removeEventListener('abort',abort);
     if(!transferred){controller.abort();if(method==='unwrap'&&Buffer.isBuffer(output))output.fill(0);}
    }
   }

   await gate('admit');fence();
   if(action==='encrypt'){
    dataKey=randomBytes(32);const nonce=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',dataKey,nonce,{authTagLength:16});cipher.setAAD(Buffer.from(json(context)));
    const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
    const wrapped=await callProvider('wrap',binding.writeVersion,dataKey);fence();
    result={context,providerId,keyRef:binding.keyRef,keyVersion:binding.writeVersion,wrappedKey:wrapped.toString('base64url'),nonce:nonce.toString('base64url'),ciphertext:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')};
   }else{
    dataKey=await callProvider('unwrap',source.keyVersion,decode(source.wrappedKey,1,16384));fence();
    const cipher=createDecipheriv('aes-256-gcm',dataKey,decode(source.nonce,12,12),{authTagLength:16});
    cipher.setAAD(Buffer.from(json(context)));cipher.setAuthTag(decode(source.tag,16,16));
    // Never expose update() output before GCM authentication succeeds.
    const tentative=cipher.update(decode(source.ciphertext,0,maxBytes));
    try{plaintext=Buffer.concat([tentative,cipher.final()]);}finally{tentative.fill(0);}
    if(action==='decrypt')result=plaintext;
    else{
     const wrapped=await callProvider('wrap',binding.writeVersion,dataKey);fence();
     const next={...source,keyVersion:binding.writeVersion,wrappedKey:wrapped.toString('base64url')};
     result={envelope:next,rotation:Object.freeze({format:'garden-key-rewrap-v1',previousEnvelopeSha256:envelopeDigest(source),nextEnvelopeSha256:envelopeDigest(next),previousKeyVersion:source.keyVersion,nextKeyVersion:binding.writeVersion,requiresCompareAndSwap:true,oldKeyRetirementVerified:false})};
    }
   }
   const requestId=await gate('deliver');await record('completed',requestId,action==='decrypt'?source.keyVersion:binding.writeVersion);
   await gate('after-audit');fence();
   return action==='decrypt'?Buffer.from(result):structuredClone(result);
  }catch{fail();}finally{dataKey?.fill(0);plaintext?.fill(0);inFlight--;}
 };
 return Object.freeze(api);
}
