/** Synthetic key custody for persistence tests. Never an application provider. */
import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {createKeyProviderAdapter,createTrustedEncryption} from '../../services/workers/src/trusted-encryption.mjs';

export const PERSISTENCE_CANARY=Buffer.from('PRIVATE-PERSISTENCE-CANARY: stored research content is not publication');
export const persistenceId=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');

export function createPersistenceKeys(){
 const providerId='synthetic-persistence-kms',roots=new Map(),calls=[];
 const classes=['restricted_research','sensitive_contributor','operational_security'];
 let beforeCall=async()=>{},available=true;
 for(const dataClass of classes)for(const version of ['v1','v2','v3'])roots.set('garden/ci/'+dataClass+'/'+version,randomBytes(32));
 const client={};
 for(const [name,operation] of [['wrapDataKey','wrap'],['unwrapDataKey','unwrap']])client[name]=async request=>{
  const observation=Object.freeze({operation,providerId,keyRef:request.keyRef,keyVersion:request.keyVersion,contextSha256:request.contextSha256});
  calls.push(observation);await beforeCall(observation);
  if(!available)throw Error('SYNTHETIC-PROVIDER-SECRET-CANARY');
  const root=roots.get(request.keyRef+'/'+request.keyVersion);if(!root)throw Error('Synthetic key unavailable');
  const aad=Buffer.from(request.keyRef+'/'+request.keyVersion+'/'+request.contextSha256);let keyMaterial;
  if(operation==='wrap'){
   const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',root,nonce);cipher.setAAD(aad);
   keyMaterial=Buffer.concat([nonce,cipher.update(request.keyMaterial),cipher.final(),cipher.getAuthTag()]);
  }else{
   const cipher=createDecipheriv('aes-256-gcm',root,request.keyMaterial.subarray(0,12));cipher.setAAD(aad);cipher.setAuthTag(request.keyMaterial.subarray(-16));
   keyMaterial=Buffer.concat([cipher.update(request.keyMaterial.subarray(12,-16)),cipher.final()]);
  }
  return {providerId,keyRef:request.keyRef,keyVersion:request.keyVersion,contextSha256:request.contextSha256,keyMaterial};
 };
 const keyProvider=createKeyProviderAdapter({providerId,client});
 const bindings=(writeVersion='v1',readVersions=['v1','v2','v3'])=>({repository:'neophilism/The-Garden',environment:'ci',providerId,
  classes:Object.fromEntries(classes.map(dataClass=>[dataClass,{keyRef:'garden/ci/'+dataClass,writeVersion,readVersions:[...readVersions]}]))});
 function component(target,options={}){
  const {writeVersion='v1',readVersions=['v1','v2','v3'],...overrides}=options;
  return createTrustedEncryption({environment:'ci',bindings:bindings(writeVersion,readVersions),keyProvider,
   decisions:{async decide(headers,workspaceId,evaluate){const requestId=randomUUID();return {allowed:await evaluate({subjectId:'synthetic-researcher',workspaceId,requestId}),requestId,operationPerformed:false};}},
   authorize:async()=>true,resolveTarget:async()=>({...target}),audit:async()=>true,enabled:()=>true,providerTimeoutMs:2000,...overrides});
 }
 return {providerId,keyProvider,bindings,component,calls,roots,
  beforeCall:hook=>{beforeCall=hook;},available:value=>{available=value;},
  close(){for(const key of roots.values())key.fill(0);roots.clear();}};
}

/** Synchronize races with an observed operation, rather than elapsed guesses. */
export function persistenceBarrier(){
 let entered,release;
 const ready=new Promise(resolve=>{entered=resolve;}),resume=new Promise(resolve=>{release=resolve;});
 return {ready,release,async wait(){entered();await resume;}};
}
