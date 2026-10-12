import {createHash} from 'node:crypto';

export const UPLOAD_CHUNK_BYTES=1024*1024;
export const UPLOAD_MAX_BYTES=16*1024**3;
export const UPLOAD_TYPES=Object.freeze(['application/vnd.sqlite3','application/zip','application/pdf','image/png','image/jpeg']);
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
function fail(){throw new Error('Garden upload rejected');}
function exact(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...keys].sort().join(','))fail();
}
export function uploadSourceRef(value){
 return Object.freeze({project:'royal-union-78374030',branch:'br-purple-grass-b5hurfl7',
  kind:'quarantine',bucket:'garden-quarantine',key:`${value.sourceId}/${value.version}`,
  sourceId:value.sourceId,version:value.version,sha256:value.sha256,size:value.size});
}
/** Unmounted, disabled by default. Decisions are the existing durable audit
 * service. authorize must enforce current workspace, source and upload purpose
 * grants; client ownership/status fields never confer authority. The repository
 * is trusted server code and retains all originals in private quarantine.
 */
export function createResumableUploads({decisions,authorize,repository,enabled=()=>false,maxConcurrent=4}){
 const methods=['start','chunk','status','pause','resume','finalize','abort','expire'];
 if(!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>8)fail();
 let inFlight=0;
 if(typeof decisions?.decide!=='function'||typeof authorize!=='function'||typeof enabled!=='function'||methods.some(k=>typeof repository?.[k]!=='function'))fail();
 const api={};
 for(const action of methods)api[action]=async function(headers,workspaceId,input,{signal}={}){
  if(inFlight>=maxConcurrent)fail();
  inFlight++;
  try{
   if(!ID.test(workspaceId))fail();
   const fields=action==='start'?['uploadId','sourceId','version','sha256','size','declaredType']:
    action==='chunk'?['uploadId','index','sha256','bytes']:action==='status'?['uploadId','afterIndex']:['uploadId'];
   exact(input,fields);
   if(!ID.test(input.uploadId))fail();
   let spec={...input},bound=null;
   if(action==='start'){
    if(!ID.test(spec.sourceId)||!ID.test(spec.version)||!HASH.test(spec.sha256)||!Number.isSafeInteger(spec.size)||spec.size<1||spec.size>UPLOAD_MAX_BYTES||!UPLOAD_TYPES.includes(spec.declaredType))fail();
    bound=uploadSourceRef(spec);
   }else if(action==='chunk'){
    if(!Number.isInteger(spec.index)||spec.index<0||spec.index>=UPLOAD_MAX_BYTES/UPLOAD_CHUNK_BYTES||!HASH.test(spec.sha256)||!(spec.bytes instanceof Uint8Array)||spec.bytes.byteLength<1||spec.bytes.byteLength>UPLOAD_CHUNK_BYTES)fail();
    // Snapshot before the first asynchronous identity call.
    spec.bytes=Buffer.from(spec.bytes);
    if(createHash('sha256').update(spec.bytes).digest('hex')!==spec.sha256)fail();
   }else if(action==='status'&&(!Number.isInteger(spec.afterIndex)||spec.afterIndex< -1||spec.afterIndex>=UPLOAD_MAX_BYTES/UPLOAD_CHUNK_BYTES))fail();
   spec=Object.freeze(spec);
   let principal=null;
   async function gate(phase,sourceRef){
    if(sourceRef){
     if(bound&&JSON.stringify(bound)!==JSON.stringify(sourceRef))fail();
     bound=sourceRef;
    }
    let observed=null;
    const decision=await decisions.decide(headers,workspaceId,async facts=>{
     if(signal?.aborted||await enabled()!==true||facts?.workspaceId!==workspaceId||typeof facts.subjectId!=='string'||!facts.subjectId||facts.subjectId.length>128||(principal&&facts.subjectId!==principal.subjectId))return false;
     if(await authorize(facts,{action:`upload:${action}`,phase,uploadId:spec.uploadId,sourceRef:bound})!==true)return false;
     observed=Object.freeze({subjectId:facts.subjectId,workspaceId});return true;
    });
    if(!observed||decision?.allowed!==true||!ID.test(decision.requestId))fail();
    principal=observed;return decision.requestId;
   }
   const requestId=await gate('admit');
   const result=await repository[action]({...principal,requestId,gate},spec);
   await gate('deliver');
   return result;
  }catch{fail();}finally{inFlight--;}
 };
 return Object.freeze(api);
}
