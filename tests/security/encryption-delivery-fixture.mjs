/** Generated cryptographic material plus a narrow SQL protocol model. The
 * independent .ci journey supplies actual PostgreSQL/locking assertions. */
import {createHash} from 'node:crypto';
import {createEncryptionPersistence,createEncryptedContentService,EncryptionPersistenceError,encryptionRequestDigest} from '../../apps/research/access/encryption-persistence.mjs';
import {envelopeDigest} from '../../services/workers/src/trusted-encryption.mjs';
import {createPersistenceKeys,PERSISTENCE_CANARY,persistenceId} from './encryption-persistence-fixture.mjs';
import {roleProbe} from './database-role-fixture.mjs';

export const DELIVERY_HEADERS=new Headers();
export const DELIVERY_SCOPE=Object.freeze({workspaceId:persistenceId(801),recordId:persistenceId(802),recordRevision:'1',contentVersionId:persistenceId(803)});
export const DELIVERY_OPERATION=persistenceId(804);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const deliveryFingerprint=v=>createHash('sha256').update('garden-encrypted-delivery-result-v1\n'+canonical(v)).digest('hex');

export async function deliveryFixture({stored=true,onEvent=async()=>{},identityHook,serviceEnabled,repositoryEnabled}={}){
 const now=Date.now(),keys=createPersistenceKeys(),scope=DELIVERY_SCOPE,calls=[],completions=new Map(),receipts=new Map(),owned=[];
 const state={identityValid:true,subjectId:'synthetic-researcher',repositoryActive:true,serviceActive:true,sqlAllowed:true,
  deadline:now+30000,loads:0,prepares:0,commits:0,rollbacks:0,finishes:0,retirements:0,viewerReads:0,verifyCalls:0,
  generation:stored?'1':'0',policyGeneration:'1',current:null,durableWrites:0,issueAttempts:0,token:0,hookResult:null};
 const crypto=keys.component({workspaceId:scope.workspaceId,objectId:scope.recordId,versionId:scope.contentVersionId,environment:'ci',dataClass:'restricted_research',purpose:'research'});
 const initial=await crypto.encrypt(DELIVERY_HEADERS,scope.workspaceId,{objectId:scope.recordId,versionId:scope.contentVersionId,plaintext:PERSISTENCE_CANARY});
 state.current=stored?initial:null;
 const metadata=()=>({...scope,context:initial.context,keyBinding:{repository:'neophilism/The-Garden',environment:'ci',providerId:keys.providerId,dataClass:'restricted_research',keyRef:'garden/ci/restricted_research',writeVersion:'v1',readVersions:['v1','v2','v3']},keyPolicyGeneration:state.policyGeneration,head:state.current?{generation:state.generation,digest:envelopeDigest(state.current)}:null,envelope:state.current});
 const receipt=p=>({operationId:p.operationId,requestDigest:encryptionRequestDigest(p),...scope,generation:(BigInt(p.expectedGeneration)+1n).toString(),envelopeDigest:envelopeDigest(p.envelope),previousDigest:p.expectedDigest,keyVersion:p.envelope.keyVersion,auditSequence:'1',committed:true});
 const event=async(name,extra={})=>{calls.push({event:name,...extra});await onEvent(name,state,extra);};
 const authority=()=>{if(!state.sqlAllowed||Date.now()>=state.deadline)throw new Error('Synthetic SQL authority unavailable');};
 const wire=value=>({subjectId:state.subjectId,expiresAt:new Date(state.deadline).toISOString(),resultFingerprint:deliveryFingerprint(value)});
 const identity={async viewer(headers){
  state.viewerReads++;await event('identity.before');const v={verified:state.identityValid,id:state.subjectId};
  if(identityHook)await identityHook(state,v);await event('identity.after');return v;
 }};
 function pool(kind){return {async connect(){
  let token,phase,result,pending,completed=false,newEntry=false,issuerAction;
  const probe=roleProbe('delivery_'+kind+'_login');
  return {async query(sql,args){
   calls.push({kind,sql:sql.startsWith('SELECT current_user')?'CAPABILITY':sql});
   const guarded=probe(sql,args);if(guarded){await event(kind+'.role',{phase});return guarded;}
   if(sql.includes('issue_policy_ticket')){
    issuerAction='issue';state.issueAttempts++;token=String(++state.token).padStart(64,'0');await event('issuer.issue',{token});return {rows:[{ticket:token}]};
   }
   if(sql.includes('bind_policy_context'))token=args[0];
   const entry=/garden_control\.(prepare_encrypted_(?:content|delivery)|load_encrypted_(?:content|delivery)|commit_encrypted_(?:content|delivery)|encrypted_content_receipt|recover_encrypted_delivery)\(/.exec(sql)?.[1];
   if(kind==='encryption'&&entry){
    phase=entry.startsWith('prepare')?'prepare':entry.startsWith('load')?'load':entry.startsWith('commit')?'commit':'recover';newEntry=entry.includes('_delivery');
    await event('main.data.before',{phase});authority();
    if(phase==='load'||phase==='prepare'){
     if(phase==='load'){state.loads++;if(!state.current)throw Error('Synthetic absent material');}else state.prepares++;
     result=metadata();
    }else if(phase==='commit'){
     pending=JSON.parse(args[0]);result=receipt(pending);
    }else{
     result=receipts.get(args[2]);if(!result||result.requestDigest!==args[3])throw Error('Synthetic missing receipt');
    }
    if(newEntry)completions.set(token,{result,phase,subjectId:state.subjectId,committed:false});
    await event('main.data.after',{phase});return {rows:[{result}]};
   }
   if(sql.includes('encrypted_delivery_admission')){
    authority();let value=wire(result);await event('main.admission',{phase,value});return {rows:[{admission:state.hookResult??value}]};
   }
   if(sql.includes('check_encrypted_commit'))authority();
   if(kind==='encryption'&&(sql.includes('clear_encrypted_delivery')||sql.includes('clear_policy_context'))){
    if(newEntry)authority();await event('main.clear',{phase});
   }
   if(sql.includes('finish_encrypted_delivery')){
    issuerAction='finish';token=args[0];state.finishes++;await event('issuer.finish.before',{token});authority();
    const c=completions.get(token);if(!c?.committed||deliveryFingerprint(c.result)!==args[1])throw Error('Synthetic completion unavailable');
    phase=c.phase;result=c.result;if(c.subjectId!==state.subjectId)throw Error('Synthetic principal changed');
    const fresh=(phase==='prepare'||phase==='load')?metadata():result;
    if(deliveryFingerprint(fresh)!==deliveryFingerprint(result))throw Error('Synthetic result changed');
    const value=wire(result);await event('issuer.finish.after',{phase,value});return {rows:[{admission:state.hookResult??value}]};
   }
   if(sql.includes('invalidate_encrypted_delivery')||sql.includes('invalidate_policy_ticket')){
    issuerAction='retire';token=args[0];state.retirements++;await event('issuer.retire',{token});completions.delete(token);
   }
   if(sql==='COMMIT'){
    if(kind==='encryption'){
     await event('main.commit.before',{phase});if(newEntry||pending)authority();
     if(pending){state.current=pending.envelope;state.generation=(BigInt(pending.expectedGeneration)+1n).toString();receipts.set(pending.operationId,result);state.durableWrites++;}
     if(newEntry)completions.get(token).committed=true;completed=true;state.commits++;await event('main.commit.after',{phase});
    }else{
     await event('issuer.commit.before',{phase,action:issuerAction});if(issuerAction==='finish'){authority();completions.delete(token);}await event('issuer.commit.after',{phase,action:issuerAction});
    }
   }
   if(sql==='ROLLBACK'){
    if(kind==='encryption'){state.rollbacks++;if(!completed&&token)completions.delete(token);}
    await event(kind+'.rollback',{phase});
   }
   return {rows:[]};
  },release(bad){calls.push({event:kind+'.release',bad,phase,completed});}};
 }};}
 const repository=createEncryptionPersistence({identity,issuerPool:pool('issuer'),encryptionPool:pool('encryption'),environment:'ci',enabled:repositoryEnabled??(()=>state.repositoryActive)});
 const boundRepository={...repository};
 if(repository.verifyIdentity)boundRepository.verifyIdentity=async(...args)=>{
  state.verifyCalls++;await event('host.verify.before');const result=await repository.verifyIdentity(...args);await event('host.verify.after');return result;
 };
 const service=createEncryptedContentService({repository:boundRepository,enabled:serviceEnabled??(()=>state.serviceActive),encryption:{encrypt:crypto.encrypt,rewrap:crypto.rewrap,async decrypt(...args){const b=await crypto.decrypt(...args);owned.push(b);return b;}}});
 return {state,calls,completions,receipts,owned,keys,repository,boundRepository,service,metadata,
  input:{...scope,operationId:DELIVERY_OPERATION},scope,headers:DELIVERY_HEADERS,
  close(){keys.close();for(const b of owned)b.fill(0);},
  async store(){return service.store(DELIVERY_HEADERS,{...scope,operationId:DELIVERY_OPERATION},PERSISTENCE_CANARY);},
  async decrypt(){return service.decrypt(DELIVERY_HEADERS,scope);}};
}

export const isDeliveryError=error=>error instanceof EncryptionPersistenceError&&error.code==='encrypted_content_unavailable'&&!/Synthetic|SQL|CANARY/.test(error.message);
