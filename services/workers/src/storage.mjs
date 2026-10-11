import {createHash, randomUUID, timingSafeEqual} from 'node:crypto';
const PROJECT='royal-union-78374030';
const BRANCH='br-purple-grass-b5hurfl7';
const NAMES={quarantine:'garden-quarantine',original:'garden-originals',derivative:'garden-public-derivatives'};
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fail(){throw new Error('Garden storage operation rejected');}
function bytesOf(value,max){if(!(value instanceof Uint8Array)||!value.byteLength||value.byteLength>max)fail();return Buffer.from(value);}
function same(a,b){return HASH.test(a)&&HASH.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}
function validRef(ref){
 if(!ref||ref.project!==PROJECT||ref.branch!==BRANCH||!Object.hasOwn(NAMES,ref.kind)||!ID.test(ref.version)||!ID.test(ref.sourceId)||!HASH.test(ref.sha256)||!Number.isSafeInteger(ref.size)||ref.size<1||ref.size>8*1024*1024||ref.bucket!==NAMES[ref.kind]||ref.key!==`${ref.sourceId}/${ref.version}`)fail();
}
function snapshot(ref){validRef(ref);return Object.freeze({...ref});}
/** Trusted backend contracts are injected by the server, never HTTP callers.
 * Backend: putIfAbsent(ref,bytes), get(ref), both private. No delete/overwrite API.
 * authorize and reviewSource are authoritative services, not client flags.
 * Single-object limit: 8 MiB. Large archives/multipart remain disabled.
 */
export function createArchiveStore({binding,backend,authorize,reviewSource,maxBytes=8*1024*1024}){
 if(binding?.project!==PROJECT||binding?.branch!==BRANCH||binding?.access!=='private'||typeof authorize!=='function'||typeof reviewSource!=='function'||typeof backend?.putIfAbsent!=='function'||typeof backend?.get!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>8*1024*1024)fail();
 async function allowed(principal,action,ref){if((await authorize(principal,action,ref))!==true)fail();}
 async function verified(ref){validRef(ref);const bytes=bytesOf(await backend.get(ref),maxBytes);if(bytes.length!==ref.size||!same(hash(bytes),ref.sha256))fail();return bytes;}
 async function write(principal,kind,sourceId,bytes,version=randomUUID()){
  if(!ID.test(sourceId)||!ID.test(version))fail();
  const copy=bytesOf(bytes,maxBytes);
  const ref=snapshot({project:PROJECT,branch:BRANCH,kind,bucket:NAMES[kind],key:`${sourceId}/${version}`,sourceId,version,sha256:hash(copy),size:copy.length});
  await allowed(principal,'write:'+kind,ref);
  await backend.putIfAbsent(ref,copy);
  await verified(ref);
  await allowed(principal,'write:'+kind,ref);
  return ref;
 }
 async function gate(principal,source){
  await allowed(principal,'publish',source);
  const review=await reviewSource(source);
  if(!review||review.sourceVersion!==source.version||review.sourceHash!==source.sha256||review.revoked!==false||['rights','consent','historical','privacy'].some(k=>review[k]!=='approved'))fail();
 }
 return Object.freeze({
  async quarantine(principal,sourceId,bytes,operationId){return write(principal,'quarantine',sourceId,bytes,operationId);},
  async preserve(principal,source,operationId){
   source=snapshot(source);if(source.kind!=='quarantine')fail();
   await allowed(principal,'preserve',source);
   const review=await reviewSource(source);if(review?.malware!=='passed'||review.sourceVersion!==source.version)fail();
   const bytes=await verified(source);await allowed(principal,'preserve',source);
   return write(principal,'original',source.sourceId,bytes,operationId);
  },
  async derivative(principal,source,bytes,operationId){
   source=snapshot(source);if(source.kind!=='original')fail();
   await gate(principal,source);await verified(source);
   const result=await write(principal,'derivative',source.sourceId,bytes,operationId);
   await gate(principal,source);
   return Object.freeze({...result,originVersion:source.version,originHash:source.sha256,publiclyAccessible:false});
  },
  async read(principal,ref){
   ref=snapshot(ref);await allowed(principal,'read:'+ref.kind,ref);
   const result=await verified(ref);await allowed(principal,'read:'+ref.kind,ref);return result;
  }
 });
}
/** SDK-neutral transport for pre-authorized short-lived S3 requests.
 * sign() is trusted server code, never a client-supplied URL.
 * Actual provider conditional-PUT behavior requires integration verification.
 */
export function createPresignedTransport({sign,fetcher=fetch,endpoint}){
 const exact=`https://${BRANCH}.storage.c-7.us-east-2.aws.neon.tech`;
 if(endpoint!==exact||typeof sign!=='function')fail();
 async function request(ref,operation,bytes){
  validRef(ref);
  const signed=await sign({bucket:ref.bucket,key:ref.key,operation,expiresInSeconds:60,ifNoneMatch:operation==='upload'?'*':undefined});
  let url;try{url=new URL(signed.url);}catch{fail();}
  if(url.origin!==exact||url.pathname!=='/'+ref.bucket+'/'+ref.key||url.username||url.password||url.hash||signed.expiresInSeconds!==60)fail();
  const headers=operation==='upload'?{'If-None-Match':'*','Content-Type':'application/octet-stream'}:{};
  const response=await fetcher(url,{method:operation==='upload'?'PUT':'GET',body:bytes,headers,redirect:'error',signal:AbortSignal.timeout(30000)});
  if(operation==='upload'&&response.status===412)return;
  if(!response.ok)fail();
  if(operation==='upload')return;
  const parts=[];let length=0;
  if(!response.body)fail();
  for await(const part of response.body){length+=part.length;if(length>ref.size)fail();parts.push(part);}
  if(length!==ref.size)fail();
  return Buffer.concat(parts,length);
 }
 return Object.freeze({async putIfAbsent(ref,bytes){try{return await request(ref,'upload',bytes);}catch{fail();}},async get(ref){try{return await request(ref,'download');}catch{fail();}}});
}
