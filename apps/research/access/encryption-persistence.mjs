/** Private GDN-026 persistence. No mounted HTTP route, provider credentials,
 * SQL callback, automatic plaintext replay or default activation is supplied.
 * Crypto preparation is complete before the repository mutation transaction.
 */
import {createHash,randomUUID} from 'node:crypto';
import {envelopeDigest} from '../../../services/workers/src/trusted-encryption.mjs';
import {assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
const INSTANT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HANDLE=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/;
const INTEGER=/^(0|[1-9][0-9]{0,18})$/;
const MAX=9223372036854775807n;
const CONTEXT=['format','algorithm','workspaceId','objectId','versionId','environment','dataClass','purpose'];
const ENVELOPE=['context','providerId','keyRef','keyVersion','wrappedKey','nonce','ciphertext','tag'];
const SCOPE=['workspaceId','recordId','recordRevision','contentVersionId'];
const COMMIT=['operationId',...SCOPE,'keyPolicyGeneration','expectedGeneration','expectedDigest','envelope'];
const RECEIPT=['operationId','requestDigest','workspaceId','recordId','recordRevision','contentVersionId','generation','envelopeDigest','previousDigest','keyVersion','auditSequence','committed'];
const RECOVERY=['workspaceId','recordId','operationId','requestDigest'];

export class EncryptionPersistenceError extends Error {
 constructor(recovery=null){
  super('Encrypted content unavailable');this.name='EncryptionPersistenceError';this.code='encrypted_content_unavailable';
  if(recovery){this.commitOutcome='unconfirmed';this.recovery=Object.freeze({...recovery});}
 }
}
const fail=()=>{throw new EncryptionPersistenceError();};
function exact(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(descriptors);
 if(actual.length!==keys.length||actual.some(k=>typeof k!=='string'||!keys.includes(k)))fail();
 const result={};for(const k of keys){const d=descriptors[k];if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();result[k]=d.value;}
 return result;
}
function id(value){if(typeof value!=='string'||!UUID.test(value))fail();return value;}
function hash(value){if(typeof value!=='string'||!HASH.test(value))fail();return value;}
function integer(value,zero=false){if(typeof value!=='string'||!INTEGER.test(value)||BigInt(value)>=MAX||(!zero&&value==='0'))fail();return value;}
function handle(value){if(typeof value!=='string'||!HANDLE.test(value))fail();return value;}
function environment(value){if(!['ci','staging'].includes(value))fail();return value;}
function scope(value,{optionalContent=false,operation=false}={}){
 const fields=[...SCOPE];if(optionalContent&&!Object.hasOwn(value??{},'contentVersionId'))fields.pop();if(operation)fields.push('operationId');
 const p=exact(value,fields);id(p.workspaceId);id(p.recordId);integer(p.recordRevision);
 if(p.contentVersionId!==undefined)id(p.contentVersionId);if(operation)id(p.operationId);
 return Object.freeze(p);
}
function contextFor(p,env){return Object.freeze({format:'garden-trusted-envelope-v1',algorithm:'AES-256-GCM',workspaceId:p.workspaceId,objectId:p.recordId,versionId:p.contentVersionId,environment:environment(env),dataClass:'restricted_research',purpose:'research'});}
function copyEnvelope(value){
 const e=exact(value,ENVELOPE);e.context=Object.freeze(exact(e.context,CONTEXT));
 envelopeDigest(e);return Object.freeze(e);
}
function commitRequest(value,env){
 const p=exact(value,COMMIT);scope(Object.fromEntries(SCOPE.map(k=>[k,p[k]])));id(p.operationId);integer(p.keyPolicyGeneration);integer(p.expectedGeneration,true);
 if(p.expectedGeneration==='0'){if(p.expectedDigest!==null)fail();}else hash(p.expectedDigest);
 p.envelope=copyEnvelope(p.envelope);
 const expected=contextFor(p,env??p.envelope.context.environment);
 if(JSON.stringify(p.envelope.context)!==JSON.stringify(expected))fail();
 return Object.freeze(p);
}
export function encryptionRequestDigest(value){
 try{
  const p=commitRequest(value);
  return createHash('sha256').update(['garden-encrypted-content-request-v1',p.operationId,p.workspaceId,p.recordId,p.recordRevision,p.contentVersionId,p.keyPolicyGeneration,p.expectedGeneration,p.expectedDigest??'none',envelopeDigest(p.envelope)].join('\n'),'utf8').digest('hex');
 }catch{fail();}
}
function recoveryRequest(value){const p=exact(value,RECOVERY);id(p.workspaceId);id(p.recordId);id(p.operationId);hash(p.requestDigest);return Object.freeze(p);}
function recoveryFor(p){return recoveryRequest({workspaceId:p.workspaceId,recordId:p.recordId,operationId:p.operationId,requestDigest:encryptionRequestDigest(p)});}
function sanitized(error,fallback=null){
 try{if(error instanceof EncryptionPersistenceError&&error.commitOutcome==='unconfirmed')return new EncryptionPersistenceError(recoveryRequest(error.recovery));}catch{}
 return new EncryptionPersistenceError(fallback);
}
function checkedReceipt(value,expected){
 const r=exact(value,RECEIPT);id(r.operationId);id(r.workspaceId);id(r.recordId);id(r.contentVersionId);
 for(const k of ['recordRevision','generation','auditSequence'])integer(r[k]);
 hash(r.requestDigest);hash(r.envelopeDigest);handle(r.keyVersion);if(r.previousDigest!==null)hash(r.previousDigest);if(r.committed!==true)fail();
 for(const k of RECOVERY)if(expected[k]!==r[k])fail();
 if(expected.envelope){
  if(r.recordRevision!==expected.recordRevision||r.contentVersionId!==expected.contentVersionId||r.generation!==(BigInt(expected.expectedGeneration)+1n).toString()||r.envelopeDigest!==envelopeDigest(expected.envelope)||r.previousDigest!==expected.expectedDigest||r.keyVersion!==expected.envelope.keyVersion)fail();
 }
 return Object.freeze(r);
}
function metadata(value,p,env,{existing=false}={}){
 const r=exact(value,[...SCOPE,'context','keyBinding','keyPolicyGeneration','head','envelope']);
 scope(Object.fromEntries(SCOPE.map(k=>[k,r[k]])));
 for(const k of SCOPE)if(p[k]!==undefined&&r[k]!==p[k])fail();
 r.context=Object.freeze(exact(r.context,CONTEXT));const expected=contextFor(r,env??r.context.environment);
 if(JSON.stringify(r.context)!==JSON.stringify(expected))fail();
 const b=exact(r.keyBinding,['repository','environment','providerId','dataClass','keyRef','writeVersion','readVersions']);
 if(b.repository!=='neophilism/The-Garden'||b.environment!==expected.environment||b.dataClass!=='restricted_research')fail();
 for(const k of ['providerId','keyRef','writeVersion'])handle(b[k]);
 if(!Array.isArray(b.readVersions)||b.readVersions.length<1||b.readVersions.length>32||new Set(b.readVersions).size!==b.readVersions.length||!b.readVersions.includes(b.writeVersion))fail();
 b.readVersions=Object.freeze(b.readVersions.map(handle));r.keyBinding=Object.freeze(b);integer(r.keyPolicyGeneration);
 if(r.head===null){if(existing||r.envelope!==null)fail();}
 else{
  const h=exact(r.head,['generation','digest']);integer(h.generation);hash(h.digest);r.head=Object.freeze(h);r.envelope=copyEnvelope(r.envelope);
  if(envelopeDigest(r.envelope)!==h.digest||JSON.stringify(r.envelope.context)!==JSON.stringify(expected)||r.envelope.providerId!==b.providerId||r.envelope.keyRef!==b.keyRef||!b.readVersions.includes(r.envelope.keyVersion))fail();
 }
 return Object.freeze(r);
}
function activation(enabled,signal){
 if(signal?.aborted)fail();const active=enabled();
 if(active!==null&&(typeof active==='object'||typeof active==='function'))try{void Promise.prototype.then.call(Promise.resolve(active),undefined,()=>{});}catch{}
 if(active!==true)fail();
}
function subject(value){if(typeof value!=='string'||value.length<1||value.length>128)fail();return value;}
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function encryptionDeliveryFingerprint(value){
 return createHash('sha256').update('garden-encrypted-delivery-result-v1\n'+canonical(value),'utf8').digest('hex');
}
function admission(value,fingerprint,expectedSubject){
 const a=exact(value,['subjectId','expiresAt','resultFingerprint']);subject(a.subjectId);hash(a.resultFingerprint);
 if(typeof a.expiresAt!=='string'||!INSTANT.test(a.expiresAt)||!Number.isFinite(Date.parse(a.expiresAt))||new Date(a.expiresAt).toISOString()!==a.expiresAt||a.resultFingerprint!==fingerprint||(expectedSubject!==undefined&&a.subjectId!==expectedSubject))fail();
 return Object.freeze(a);
}
function delivery(value,validate,expectedSubject){
 const r=exact(value,['value','admission']);r.value=validate(r.value);
 r.admission=admission(r.admission,encryptionDeliveryFingerprint(r.value),expectedSubject);
 return Object.freeze(r);
}
function deadlineFence(deadline){const now=Date.now();if(!Number.isSafeInteger(now)||now<0||now>=deadline)fail();}

function options(value){const o=exact(value,Object.hasOwn(value??{},'signal')?['signal']:[]);if(o.signal!==undefined&&!(o.signal instanceof AbortSignal))fail();return Object.freeze(o);}

/** Fixed-query server repository. Its SQL capability is not an end-user SQL
 * interface. Separate pools must use noninheriting, nonowning, disjoint logins.
 * The synchronous activation predicate is checked across every async boundary.
 */
export function createEncryptionPersistence({identity,issuerPool,encryptionPool,environment:env,enabled=()=>false}){
 environment(env);
 if(typeof identity?.viewer!=='function'||typeof issuerPool?.connect!=='function'||typeof encryptionPool?.connect!=='function'||issuerPool===encryptionPool||typeof enabled!=='function')fail();
 const viewer=identity.viewer.bind(identity),issuerConnect=issuerPool.connect.bind(issuerPool),encryptionConnect=encryptionPool.connect.bind(encryptionPool);
 const fence=()=>activation(enabled);
 async function actor(headers,expected){
  if(expected!==undefined)subject(expected);fence();const a=await viewer(headers);fence();
  if(a?.verified!==true)fail();const id=subject(a.id);if(expected!==undefined&&id!==expected)fail();return id;
 }
 async function issuer(kind,args,capture){
  let c,bad=false,login,attempted=false,completed=false,value;
  try{
   c=await issuerConnect();login=await assertDatabaseCapability(c,'garden_context_issuer');
   await c.query('BEGIN');await c.query('SET LOCAL ROLE garden_context_issuer');await c.query("SET LOCAL statement_timeout='5s'");await c.query('SET CONSTRAINTS ALL DEFERRED');
   if(kind==='issue'){
    const issued=await c.query('SELECT garden_control.issue_policy_ticket($1::uuid,$2::text,$3::text,$4::uuid) AS ticket',args);
    if(!Array.isArray(issued.rows)||issued.rows.length!==1)fail();value=hash(exact(issued.rows[0],['ticket']).ticket);capture(value);
   }else if(kind==='finish'){
    const result=await c.query('SELECT garden_control.finish_encrypted_delivery($1::text,$2::text) AS admission',args);
    if(!Array.isArray(result.rows)||result.rows.length!==1)fail();value=exact(result.rows[0],['admission']).admission;
   }else await c.query('SELECT garden_control.invalidate_encrypted_delivery($1::text)',args);
   await assertDatabaseCapability(c,'garden_context_issuer',{activeRole:true,login});attempted=true;await c.query('COMMIT');completed=true;
  }catch(error){
   if(error instanceof DatabaseCapabilityError||attempted&&!completed)bad=true;
   if(!completed)try{if(c)await c.query('ROLLBACK');}catch{bad=true;}fail();
  }finally{try{c?.release(bad);}catch{fail();}}
  return value;
 }
 async function run(headers,p,action,sql,args,validate,commit=null,expectedSubject){
  let ticket,c,login,bad=false,completed=false,attempted=false,principal,value,resultFingerprint,pinnedHeaders;
  let deadline=Infinity;const recovery=commit?recoveryFor(commit):null;
  const check=()=>{fence();deadlineFence(deadline);};
  const recheck=async()=>{check();await actor(pinnedHeaders,principal);check();};
  try{
   pinnedHeaders=new Headers(headers);principal=await actor(pinnedHeaders,expectedSubject);
   await issuer('issue',[p.workspaceId,principal,action,p.recordId],v=>{ticket=v;});check();
   c=await encryptionConnect();check();login=await assertDatabaseCapability(c,'garden_encryption');check();
   await c.query('BEGIN');await c.query('SET LOCAL ROLE garden_encryption');await c.query("SET LOCAL statement_timeout='5s'");await c.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
   // Only this fixed executor owns the transaction. Never accept SET CONSTRAINTS
   // or arbitrary SQL from a caller; the deferred gate must remain deferred.
   await c.query('SET CONSTRAINTS ALL DEFERRED');
   await c.query('SELECT pg_advisory_xact_lock(144729,hashtext($1::text))',[p.workspaceId]);check();
   await c.query('SELECT garden_control.bind_policy_context($1::text)',[ticket]);check();
   const result=await c.query(sql,args);check();if(!Array.isArray(result.rows)||result.rows.length!==1)fail();value=validate(exact(result.rows[0],['result']).result);
   resultFingerprint=encryptionDeliveryFingerprint(value);
   const first=await c.query('SELECT garden_control.encrypted_delivery_admission() AS admission');
   if(!Array.isArray(first.rows)||first.rows.length!==1)fail();
   const firstAdmission=admission(exact(first.rows[0],['admission']).admission,resultFingerprint,principal);
   deadline=Math.min(deadline,Date.parse(firstAdmission.expiresAt));check();
   await recheck();await assertDatabaseCapability(c,'garden_encryption',{activeRole:true,login});check();
   await c.query('SELECT garden_control.clear_encrypted_delivery()');check();
   await recheck();check();attempted=true;await c.query('COMMIT');completed=true;check();
  }catch(error){
   if(error instanceof DatabaseCapabilityError||attempted&&!completed)bad=true;
   if(!completed)try{if(c)await c.query('ROLLBACK');}catch{bad=true;}
   throw sanitized(error,attempted?recovery:null);
  }finally{
   let cleanupFailed=false;try{c?.release(bad);}catch{cleanupFailed=true;}
   // Main locks, including the original policy token, are released first. The
   // fixed finish function binds a NEW policy context on its own issuer PID/xid.
   if(ticket){
    if(completed&&!cleanupFailed)try{
     const finalAdmission=admission(await issuer('finish',[ticket,resultFingerprint]),resultFingerprint,principal);
     deadline=Math.min(deadline,Date.parse(finalAdmission.expiresAt));check();
    }catch{cleanupFailed=true;try{await issuer('retire',[ticket]);}catch{}}
    else try{await issuer('retire',[ticket]);}catch{cleanupFailed=true;}
   }
   if(completed){
    if(cleanupFailed)throw new EncryptionPersistenceError(recovery);
    try{await recheck();check();}catch{throw new EncryptionPersistenceError(recovery);}
   }
  }
  const result=Object.freeze({value,admission:Object.freeze({subjectId:principal,expiresAt:new Date(deadline).toISOString(),resultFingerprint})});
  try{check();}catch{throw new EncryptionPersistenceError(recovery);}return result;
 }
 const returned=(result,validate,expected)=>{const r=delivery(result,validate,expected);fence();deadlineFence(Date.parse(r.admission.expiresAt));return r;};
 return Object.freeze({
  async verifyIdentity(headers,expectedSubject){try{const id=await actor(new Headers(headers),subject(expectedSubject));fence();return id;}catch(error){throw sanitized(error);}},
  async prepare(headers,input,expectedSubject){
   try{const s=scope(input,{optionalContent:true}),p=Object.freeze({...s,contentVersionId:s.contentVersionId??randomUUID()});fence();
    return returned(await run(headers,p,'write','SELECT garden_control.prepare_encrypted_delivery($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::text) AS result',[p.workspaceId,p.recordId,p.recordRevision,p.contentVersionId,env],r=>metadata(r,p,env),null,expectedSubject),r=>metadata(r,p,env),expectedSubject);
   }catch(error){throw sanitized(error);}
  },
  async load(headers,input,expectedSubject){
   try{const p=scope(input);fence();return returned(await run(headers,p,'read','SELECT garden_control.load_encrypted_delivery($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::text) AS result',[p.workspaceId,p.recordId,p.recordRevision,p.contentVersionId,env],r=>metadata(r,p,env,{existing:true}),null,expectedSubject),r=>metadata(r,p,env,{existing:true}),expectedSubject);}catch(error){throw sanitized(error);}
  },
  async commit(headers,input,expectedSubject){
   let pending,received=false;try{const p=commitRequest(input,env),expected={...p,requestDigest:encryptionRequestDigest(p)};pending=recoveryFor(p);fence();
    const result=await run(headers,p,'write','SELECT garden_control.commit_encrypted_delivery($1::jsonb) AS result',[JSON.stringify(p)],r=>checkedReceipt(r,expected),p,expectedSubject);received=true;
    return returned(result,r=>checkedReceipt(r,expected),expectedSubject);
   }catch(error){throw sanitized(error,received?pending:null);}
  },
  async receipt(headers,input,expectedSubject){
   try{const p=recoveryRequest(input);fence();return returned(await run(headers,p,'write','SELECT garden_control.recover_encrypted_delivery($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text) AS result',[p.workspaceId,p.recordId,p.operationId,p.requestDigest,env],r=>checkedReceipt(r,p),null,expectedSubject),r=>checkedReceipt(r,p),expectedSubject);}catch(error){throw sanitized(error);}
  }
 });
}

/** Host-facing content API. The configured trusted crypto component generates
 * or authenticates every candidate. SQL validates metadata/CAS, not GCM tags.
 * Neither arbitrary envelopes nor provider callbacks enter a mutation TX.
 */
export function createEncryptedContentService({repository,encryption,enabled=()=>false}){
 if(['prepare','load','commit','receipt','verifyIdentity'].some(k=>typeof repository?.[k]!=='function')||['encrypt','decrypt','rewrap'].some(k=>typeof encryption?.[k]!=='function')||typeof enabled!=='function')fail();
 const repo=Object.fromEntries(['prepare','load','commit','receipt','verifyIdentity'].map(k=>[k,repository[k].bind(repository)]));
 const crypto=Object.fromEntries(['encrypt','decrypt','rewrap'].map(k=>[k,encryption[k].bind(encryption)]));
 const target=p=>Object.fromEntries(SCOPE.filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
 const same=(a,b)=>a.keyPolicyGeneration===b.keyPolicyGeneration&&JSON.stringify(a.context)===JSON.stringify(b.context)&&JSON.stringify(a.keyBinding)===JSON.stringify(b.keyBinding)&&a.head?.generation===b.head?.generation&&a.head?.digest===b.head?.digest;
 function candidate(p,m,e){return commitRequest({operationId:p.operationId,workspaceId:m.workspaceId,recordId:m.recordId,recordRevision:m.recordRevision,contentVersionId:m.contentVersionId,keyPolicyGeneration:m.keyPolicyGeneration,expectedGeneration:m.head?.generation??'0',expectedDigest:m.head?.digest??null,envelope:e},m.context.environment);}
 function flow(headers,opt={}){
  const o=options(opt),h=new Headers(headers);let principal,deadline=Infinity;
  const fence=()=>{activation(enabled,o.signal);deadlineFence(deadline);};
  function receive(raw,validate){
   const r=delivery(raw,validate,principal);principal??=r.admission.subjectId;
   deadline=Math.min(deadline,Date.parse(r.admission.expiresAt));fence();return r.value;
  }
  async function identity(){fence();const confirmed=await repo.verifyIdentity(h,subject(principal));fence();if(confirmed!==principal)fail();}
  fence();return {h,o,fence,receive,identity,subject:()=>principal};
 }
 return Object.freeze({
  async store(headers,input,plaintext,opt={}){
   let owned,pending,received=false;
   try{
    const p=scope(input,{optionalContent:true,operation:true}),f=flow(headers,opt);
    if(!Buffer.isBuffer(plaintext)||plaintext.length>8388608)fail();owned=Buffer.from(plaintext);
    const m=f.receive(await repo.prepare(f.h,target(p)),r=>metadata(r,p));if(m.head!==null)fail();
    const e=copyEnvelope(await crypto.encrypt(f.h,p.workspaceId,{objectId:p.recordId,versionId:m.contentVersionId,plaintext:owned},f.o));owned.fill(0);owned=undefined;f.fence();
    if(e.providerId!==m.keyBinding.providerId||e.keyRef!==m.keyBinding.keyRef||e.keyVersion!==m.keyBinding.writeVersion)fail();
    const request=candidate(p,m,e);pending=recoveryFor(request);await f.identity();f.fence();
    const raw=await repo.commit(f.h,request,f.subject());received=true;
    const r=f.receive(raw,v=>checkedReceipt(v,{...request,requestDigest:pending.requestDigest}));
    await f.identity();f.fence();return r;
   }catch(error){throw sanitized(error,received?pending:null);}finally{owned?.fill(0);}
  },
  async decrypt(headers,input,opt={}){
   let plaintext,output,returned=false;
   try{
    const p=scope(input),f=flow(headers,opt);
    const m=f.receive(await repo.load(f.h,p),r=>metadata(r,p,undefined,{existing:true}));
    plaintext=await crypto.decrypt(f.h,p.workspaceId,{objectId:p.recordId,versionId:p.contentVersionId,envelope:m.envelope},f.o);f.fence();
    if(!Buffer.isBuffer(plaintext)||plaintext.length>8388608)fail();
    await f.identity();
    const after=f.receive(await repo.load(f.h,p,f.subject()),r=>metadata(r,p,undefined,{existing:true}));if(!same(m,after))fail();
    await f.identity();f.fence();output=Buffer.from(plaintext);plaintext.fill(0);plaintext=undefined;f.fence();returned=true;return output;
   }catch(error){throw sanitized(error);}finally{if(Buffer.isBuffer(plaintext))plaintext.fill(0);if(!returned&&Buffer.isBuffer(output))output.fill(0);}
  },
  async rewrap(headers,input,opt={}){
   let pending,received=false;
   try{
    const p=scope(input,{operation:true}),s=target(p),f=flow(headers,opt);
    const m=f.receive(await repo.prepare(f.h,s),r=>metadata(r,p,undefined,{existing:true}));
    const prepared=exact(await crypto.rewrap(f.h,p.workspaceId,{objectId:p.recordId,versionId:p.contentVersionId,envelope:m.envelope},f.o),['envelope','rotation']);f.fence();
    const e=copyEnvelope(prepared.envelope),rotation=exact(prepared.rotation,['format','previousEnvelopeSha256','nextEnvelopeSha256','previousKeyVersion','nextKeyVersion','requiresCompareAndSwap','oldKeyRetirementVerified']);
    if(rotation.format!=='garden-key-rewrap-v1'||rotation.previousEnvelopeSha256!==m.head.digest||rotation.nextEnvelopeSha256!==envelopeDigest(e)||rotation.previousKeyVersion!==m.envelope.keyVersion||rotation.nextKeyVersion!==m.keyBinding.writeVersion||rotation.requiresCompareAndSwap!==true||rotation.oldKeyRetirementVerified!==false||e.keyVersion!==m.keyBinding.writeVersion||e.keyVersion===m.envelope.keyVersion||e.providerId!==m.envelope.providerId||e.keyRef!==m.envelope.keyRef||e.ciphertext!==m.envelope.ciphertext||e.nonce!==m.envelope.nonce||e.tag!==m.envelope.tag)fail();
    const request=candidate(p,m,e);pending=recoveryFor(request);await f.identity();f.fence();
    const raw=await repo.commit(f.h,request,f.subject());received=true;
    const r=f.receive(raw,v=>checkedReceipt(v,{...request,requestDigest:pending.requestDigest}));
    await f.identity();f.fence();return r;
   }catch(error){throw sanitized(error,received?pending:null);}
  },
  async recover(headers,input){
   try{const p=recoveryRequest(input),f=flow(headers);
    const r=f.receive(await repo.receipt(f.h,p),v=>checkedReceipt(v,p));await f.identity();f.fence();return r;
   }catch(error){throw sanitized(error);}
  }
 });
}
