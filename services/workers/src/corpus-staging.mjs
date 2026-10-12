import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const MAX_SOURCE=16*1024**3, MAX_CONFIG=4*1024**2;
const workerPath=fileURLToPath(new URL('../import/stage.py',import.meta.url));
const mapPath=fileURLToPath(new URL('../../../docs/migration/migration-map.json',import.meta.url));
const inventoryPath=fileURLToPath(new URL('../../../docs/migration/source-schema-inventory.json',import.meta.url));
const phases=new Set(['start','source-hash','schema','schema-table','source-scan','verify-staging','before-batch','commit-batch','after-batch','table','reconcile','complete']);
function fail(){throw new Error('Garden corpus staging rejected');}
function exact(value,fields){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...fields].sort().join(','))fail();}
function sameRef(a,b){return Object.keys(a).every(k=>a[k]===b?.[k])&&Object.keys(a).length===Object.keys(b??{}).length;}
function reference(value){
 exact(value,['project','branch','kind','bucket','key','sourceId','version','sha256','size']);
 if(value.project!=='royal-union-78374030'||value.branch!=='br-purple-grass-b5hurfl7'||value.kind!=='quarantine'||value.bucket!=='garden-quarantine'||!ID.test(value.sourceId)||!ID.test(value.version)||value.key!==`${value.sourceId}/${value.version}`||!HASH.test(value.sha256)||!Number.isSafeInteger(value.size)||value.size<1||value.size>MAX_SOURCE)fail();
 return Object.freeze({...value});
}

/** Trusted server dependency. Local paths/contract overrides never come from
 * requests or source data. This offline adapter does not call the 8 MiB store.
 * OS isolation, encrypted disk and denied network egress are activation gates.
 */
export function createOfflineStagingWorker({python='/usr/bin/python3',timeoutMs=3600000,loadContracts,spawnProcess=spawn}={}){
 if(typeof python!=='string'||!python.startsWith('/')||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3600000)fail();
 const contracts=loadContracts??(async()=>{
  const [mappingBytes,inventoryBytes]=await Promise.all([readFile(mapPath),readFile(inventoryPath)]);
  if(mappingBytes.length+inventoryBytes.length>MAX_CONFIG)fail();
  const mapping=JSON.parse(mappingBytes),inventory=JSON.parse(inventoryBytes);
  if(createHash('sha256').update(inventoryBytes).digest('hex')!==mapping.source_inventory_sha256)fail();
  return {mapping,inventory};
 });
 return async function extract(job,{gate,signal}={}){
  const {mapping,inventory}=await contracts();
  const config={...job,mapping,inventory};
  const serialized=JSON.stringify(config)+'\n';
  if(Buffer.byteLength(serialized)>MAX_CONFIG||signal?.aborted)fail();
  return new Promise((resolve,reject)=>{
   let child,timer,done=false,buffer='',pending=false,result=null,denied=false;
   const finish=(error)=>{
    if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
    child?.kill('SIGKILL');
    if(error||denied||!result)reject(new Error('Garden corpus staging rejected'));else resolve(result);
   };
   const abort=()=>finish(true);
   async function message(line){
    if(pending){abort();return;}
    pending=true;
    try{
     const value=JSON.parse(line);
     if(value.type==='authorize'){
      exact(value,['type','phase']);
      if(!phases.has(value.phase)||result)fail();
      let allowed=false,requestId=null;
      try{requestId=await gate(value.phase);if(!ID.test(requestId))fail();allowed=true;}catch{denied=true;}
      if(!done)child.stdin.write(JSON.stringify({allowed,requestId})+'\n');
     }else if(value.type==='result'){
      exact(value,['type','result']);
      if(result||denied)fail();
      const r=value.result;
      exact(r,['profile','status','source_sha256','rows','tables','audit_head','historicalReview','rights','publicationApproved','publiclyAccessible']);
      if(r.profile!=='garden-offline-staging-v1'||r.status!=='complete-quarantined'||r.source_sha256!==job.source_ref.sha256||r.rows!==mapping.source_row_count||r.tables!==mapping.table_count||!HASH.test(r.audit_head)||r.historicalReview!=='unreviewed'||r.rights!=='unreviewed'||r.publicationApproved!==false||r.publiclyAccessible!==false)fail();
      result=Object.freeze({...r});
     }else if(value.type==='rejected'){denied=true;}else fail();
    }catch{abort();}finally{pending=false;}
   }
   try{
    child=spawnProcess(python,['-I',workerPath],{shell:false,cwd:'/tmp',env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','ignore']});
    timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted){abort();return;}
    child.on('error',abort);child.stdin.on('error',abort);
    child.stdout.on('data',part=>{
     buffer+=part.toString('utf8');if(Buffer.byteLength(buffer)>8192){abort();return;}
     let end;
     while((end=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);void message(line);}
    });
    child.on('close',code=>finish(code!==0||pending||buffer.length!==0));
    child.stdin.write(serialized);
   }catch{abort();}
  });
 };
}

/** Unmounted and disabled by default. decisions is the existing audited
 * decision service, authorize enforces current source/workspace/operator grants.
 * resolveSource is a trusted offline storage registry, NOT a client filename.
 * It must bind a preserved, quiescent original and private encrypted staging
 * volume to this workspace/source. No research/public DB credentials are used.
 */
export function createCorpusStaging({decisions,authorize,resolveSource,extract=createOfflineStagingWorker(),enabled=()=>false}){
 if(typeof decisions?.decide!=='function'||typeof authorize!=='function'||typeof resolveSource!=='function'||typeof extract!=='function'||typeof enabled!=='function')fail();
 return Object.freeze({async stage(headers,workspaceId,input,{signal}={}){
  try{
   exact(input,['runId','sourceRef']);
   const runId=input.runId,sourceRef=reference(input.sourceRef);
   if(!ID.test(workspaceId)||!ID.test(runId)||runId===sourceRef.sourceId)fail();
   let principal;
   async function gate(phase){
    let observed;
    const decision=await decisions.decide(headers,workspaceId,async facts=>{
     if(signal?.aborted||await enabled()!==true||!facts||facts.workspaceId!==workspaceId||typeof facts.subjectId!=='string'||!facts.subjectId||facts.subjectId.length>128||(principal&&facts.subjectId!==principal.subjectId))return false;
     if(await authorize(facts,{action:'stage-import',sourceRef,runId,phase})!==true)return false;
     observed=Object.freeze({subjectId:facts.subjectId,workspaceId});return true;
    });
    if(decision?.allowed!==true||!ID.test(decision.requestId)||!observed)fail();principal=observed;
    return decision.requestId;
   }
   await gate('resolve-source');
   const resolved=await resolveSource(principal,sourceRef);
   exact(resolved,['workspaceId','sourceRef','sourcePath','stagingDirectory','format','classification','quarantine']);
   exact(resolved.quarantine,['disposition','released','malware']);
   if(resolved.workspaceId!==workspaceId||!sameRef(sourceRef,resolved.sourceRef)||!['sqlite','typed-ndjson'].includes(resolved.format)||resolved.classification!=='restricted_research'||resolved.quarantine.disposition!=='quarantined'||resolved.quarantine.released!==false||!['unavailable','clean'].includes(resolved.quarantine.malware)||typeof resolved.sourcePath!=='string'||typeof resolved.stagingDirectory!=='string'||!resolved.sourcePath.startsWith('/')||!resolved.stagingDirectory.startsWith('/'))fail();
   await gate('open-source');
   const result=await extract({source_path:resolved.sourcePath,staging_directory:resolved.stagingDirectory,
    source_ref:sourceRef,workspace_id:workspaceId,subject_id:principal.subjectId,run_id:runId,format:resolved.format}, {gate,signal});
   await gate('deliver-result');
   return result;
  }catch{fail();}
 }});
}
