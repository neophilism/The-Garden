/** Trusted operator composition. No HTTP route, storage URL or caller path. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {HASH,UUID,exact,imageEvidenceDigest,reject,validateImageManifest,validateLegacyImageSnapshot,validateImageAnnotation,reconcileImageEditions,imageReleaseEligibility} from '../../../packages/domain/src/historical/image-reconciliation.mjs';

const path=fileURLToPath(new URL('../import/images.py',import.meta.url));
const phases=new Set(['open-source','source-hash','scan-part','scan-media','verify-source','complete']);
const annotationSources=annotations=>annotations.flatMap(a=>[...a.evidence,...a.rights.evidence,...a.transformations.flatMap(t=>t.evidence)].map(e=>e.sourceSha256).concat(a.transformations.map(t=>t.sourceSha256)));
export function createOfflineImageScanner({python='/usr/bin/python3',timeoutMs=600000,spawnProcess=spawn}={}){
 if(typeof python!=='string'||!python.startsWith('/')||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000||typeof spawnProcess!=='function')reject();
 return async function scan(config,{gate,signal}={}){
  if(typeof gate!=='function'||signal?.aborted)reject();exact(config,['sourcePath','document']);
  const encoded=JSON.stringify(config)+'\n';if(Buffer.byteLength(encoded)>16384)reject();
  return new Promise((resolve,rejectPromise)=>{
   let child,timer,done=false,pending=false,denied=false,result=null,buffer='';
   const finish=error=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);child?.kill('SIGKILL');if(error||denied||!result)rejectPromise(new Error('Garden image reconciliation rejected'));else resolve(result);};
   const abort=()=>finish(true);
   async function message(line){
    if(pending){abort();return;}pending=true;
    try{
     const item=JSON.parse(line);
     if(item.type==='authorize'){
      exact(item,['type','phase']);if(!phases.has(item.phase)||result)reject();let allowed=false;
      try{if(!UUID.test(await gate(item.phase)))reject();allowed=true;}catch{denied=true;}
      if(!done)child.stdin.write(JSON.stringify({allowed})+'\n');
     }else if(item.type==='result'){
      exact(item,['type','result']);if(result||denied)reject();result=validateImageManifest(item.result);
      if(imageEvidenceDigest(result.document)!==imageEvidenceDigest(config.document))reject();
     }else if(item.type==='rejected')denied=true;else reject();
    }catch{abort();}finally{pending=false;}
   }
   try{
    child=spawnProcess(python,['-I',path],{shell:false,cwd:'/tmp',env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','ignore']});
    timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
    child.on('error',abort);child.stdin.on('error',abort);
    child.stdout.on('data',part=>{
     buffer+=part.toString('utf8');if(Buffer.byteLength(buffer)>48*1024**2+1024){abort();return;}
     let index;while((index=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);void message(line);}
    });
    child.on('close',code=>finish(code!==0||pending||buffer.length!==0));child.stdin.write(encoded);
   }catch{abort();}
  });
 };
}

/** resolveBundle is an authoritative private corpus registry. It must establish
 * each document's bytes and GDN-045 legacy coordinate binding, not accept claims
 * copied from a request. Full source hashes are authorized at every scan gate.
 */
export function createImageReconciliation({decisions,authorize,resolveBundle,repository,scan=createOfflineImageScanner(),enabled=()=>false,maxConcurrent=1}){
 if(typeof decisions?.decide!=='function'||typeof authorize!=='function'||typeof resolveBundle!=='function'||typeof repository?.commit!=='function'||typeof repository?.read!=='function'||typeof scan!=='function'||typeof enabled!=='function'||!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>2)reject();
 let active=0;
 async function run(action,headers,workspaceId,input,{signal}={}){
  if(active>=maxConcurrent)reject();active++;
  try{
   exact(input,action==='reconcile'?['runId','bundleId']:['bundleId','inputDigest']);const spec=structuredClone(input);
   if(!UUID.test(workspaceId)||!UUID.test(spec.bundleId)||(action==='reconcile'?!UUID.test(spec.runId):!HASH.test(spec.inputDigest)))reject();
   let principal=null,artifactHashes=[];
   async function gate(phase){
    let observed;
    const result=await decisions.decide(headers,workspaceId,async facts=>{
     if(signal?.aborted||await enabled()!==true||facts?.workspaceId!==workspaceId||typeof facts.subjectId!=='string'||!facts.subjectId||facts.subjectId.length>128||(principal&&facts.subjectId!==principal.subjectId))return false;
     if(await authorize(facts,{action:'image:'+action,bundleId:spec.bundleId,runId:spec.runId??null,artifactHashes:[...artifactHashes],phase,purpose:'research'})!==true)return false;
     if(await enabled()!==true||signal?.aborted)return false;
     observed=Object.freeze({workspaceId,subjectId:facts.subjectId});return true;
    });
    if(result?.allowed!==true||!UUID.test(result.requestId)||!observed||await enabled()!==true||signal?.aborted)reject();principal=observed;return {...principal,requestId:result.requestId};
   }
   let facts=await gate('resolve-bundle');
   if(action==='detail'){
    const report=repository.read(facts,spec);artifactHashes=[...new Set([...report.editions.map(e=>e.document.sha256),...(report.legacySnapshot?[report.legacySnapshot.artifactSha256]:[]),...annotationSources(report.annotations)])].sort();
    await gate('deliver-detail');return report;
   }
   const resolved=await resolveBundle(principal,spec.bundleId);
   exact(resolved,['workspaceId','bundleId','classification','sources','legacySnapshot','annotations']);
   if(resolved.workspaceId!==workspaceId||resolved.bundleId!==spec.bundleId||resolved.classification!=='restricted_research'||!Array.isArray(resolved.sources)||resolved.sources.length<1||resolved.sources.length>24)reject();
   for(const source of resolved.sources){
    exact(source,['sourcePath','document','quarantine']);exact(source.quarantine,['disposition','released','malware']);
    if(typeof source.sourcePath!=='string'||!source.sourcePath.startsWith('/')||source.quarantine.disposition!=='quarantined'||source.quarantine.released!==false||!['clean','unavailable'].includes(source.quarantine.malware))reject();
    exact(source.document,['editionId','documentId','sha256','size']);if(!HASH.test(source.document.sha256))reject();
   }
   const legacy=resolved.legacySnapshot===null?null:validateLegacyImageSnapshot(resolved.legacySnapshot);
   if(!Array.isArray(resolved.annotations)||resolved.annotations.length>20000)reject();const annotations=resolved.annotations.map(validateImageAnnotation);
   // Snapshot trusted descriptors so an asynchronous caller cannot replace a
   // checked path, document binding, inherited metadata or source collection.
   const sources=structuredClone(resolved.sources);
   artifactHashes=[...sources.map(s=>s.document.sha256),...(legacy?[legacy.artifactSha256]:[]),...annotationSources(annotations)];
   artifactHashes=[...new Set(artifactHashes)].sort();await gate('authorize-sources');
   const editions=[];
   for(const source of sources){const result=await scan({sourcePath:source.sourcePath,document:source.document},{gate:async phase=>(await gate(phase)).requestId,signal});editions.push(validateImageManifest(result));}
   const report=reconcileImageEditions({editions,legacySnapshot:legacy,annotations});facts=await gate('commit');
   const receipt=repository.commit(facts,{runId:spec.runId,bundleId:spec.bundleId,report});await gate('deliver-receipt');return receipt;
  }catch{reject();}finally{active--;}
 }
 return Object.freeze({reconcile:(...args)=>run('reconcile',...args),detail:(...args)=>run('detail',...args)});
}

/** Guard for a future cleared-byte delivery composition. No public endpoint is
 * mounted. loadRelease/reviewRelease/authorize are trusted server dependencies;
 * inherited metadata and caller-supplied approval flags cannot serve as review.
 */
export function createReviewedImageByteReader({loadRelease,reviewRelease,readBytes,authorize,enabled=()=>false,maxBytes=8*1024**2}){
 if([loadRelease,reviewRelease,readBytes,authorize,enabled].some(x=>typeof x!=='function')||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>8*1024**2)reject();
 return Object.freeze({async read(principal,input){
  try{
   exact(input,['releaseId']);if(!UUID.test(input.releaseId))reject();const releaseId=input.releaseId;
   let binding=null;
   async function gate(phase){
    if(await enabled()!==true||await authorize(principal,{action:'public-image-bytes',releaseId,phase})!==true)reject();
    const release=await loadRelease(principal,releaseId);
    exact(release,['annotation','documentSha256','mediaSha256','placementId','byteRef']);
    const annotation=validateImageAnnotation(release.annotation);
    if(!HASH.test(release.documentSha256)||!HASH.test(release.mediaSha256)||!HASH.test(release.placementId)||release.byteRef?.sha256!==release.mediaSha256)reject();
    const current=imageEvidenceDigest(release);if(binding&&binding!==current)reject();binding=current;
    const review=await reviewRelease(principal,releaseId);
    if(!imageReleaseEligibility(annotation,review,release).eligible||await enabled()!==true)reject();return structuredClone(release);
   }
   const release=await gate('before-read');
   const bytes=await readBytes(principal,release.byteRef);
   if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>maxBytes)reject();const copy=Buffer.from(bytes);
   if(createHash('sha256').update(copy).digest('hex')!==release.mediaSha256||copy.length!==release.byteRef.size)reject();
   await gate('after-read');return copy;
  }catch{reject();}
 }});
}
