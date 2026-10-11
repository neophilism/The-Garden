import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const MAX_BYTES=8*1024*1024, MAX_REPORT=1024*1024;
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const PROFILE='garden-readonly-inventory-v1';
const TYPES=new Set(['application/zip','application/vnd.sqlite3','application/pdf','image/png','application/x-executable','application/xml','application/json','text/plain','application/octet-stream']);
const FINDINGS=new Set(['input-size-limit','archive-entry-limit','archive-unsafe-path-or-type','archive-encryption-or-method-unsupported','archive-expansion-limit','archive-malformed','archive-truncated','nested-archive-not-inspected','active-content-unreviewed','sqlite-malformed','sqlite-integrity-failed','sqlite-schema-limit','format-parser-unavailable','malformed-or-uninspectable','inspector-unavailable','inspector-timeout','malware-detected']);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inspectorPath=fileURLToPath(new URL('../import/inspect.py',import.meta.url));
function fail(){throw new Error('Garden import operation rejected');}
function copyBytes(value){if(!(value instanceof Uint8Array)||!value.byteLength||value.byteLength>MAX_BYTES)fail();return Buffer.from(value);}
function keys(value,names){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...names].sort().join(','))fail();}
function safeText(value,max){return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);}
function safePath(path){return safeText(path,512)&&!path.startsWith('/')&&!/[\\:]/.test(path)&&path.split('/').every(p=>p!==''&&p!=='.'&&p!=='..');}
function ref(input){
 keys(input,['project','branch','kind','bucket','key','sourceId','version','sha256','size']);
 if(input.project!=='royal-union-78374030'||input.branch!=='br-purple-grass-b5hurfl7'||input.kind!=='quarantine'||input.bucket!=='garden-quarantine'||!ID.test(input.sourceId)||!ID.test(input.version)||input.key!==`${input.sourceId}/${input.version}`||!HASH.test(input.sha256)||!Number.isSafeInteger(input.size)||input.size<1||input.size>MAX_BYTES)fail();
 return Object.freeze({...input});
}
function fallback(bytes,reason){return {schemaVersion:1,profile:PROFILE,sha256:sha(bytes),size:bytes.length,detectedType:'application/octet-stream',inventoryComplete:false,members:[],database:null,findings:[reason],disposition:'quarantined'};}
function validateReport(input,bytes){
 keys(input,['schemaVersion','profile','sha256','size','detectedType','inventoryComplete','members','database','findings','disposition']);
 if(input.schemaVersion!==1||input.profile!==PROFILE||input.sha256!==sha(bytes)||input.size!==bytes.length||!TYPES.has(input.detectedType)||typeof input.inventoryComplete!=='boolean'||input.disposition!=='quarantined'||!Array.isArray(input.members)||input.members.length>256||!Array.isArray(input.findings)||input.findings.length>32||input.findings.some(f=>!FINDINGS.has(f)))fail();
 let total=0;const paths=new Set();
 for(const member of input.members){
  keys(member,['path','size','sha256','detectedType','inspection','disposition']);
  const normalized=typeof member.path==='string'?member.path.normalize('NFC').toLowerCase():'';
  if(!safePath(member.path)||paths.has(normalized)||!Number.isSafeInteger(member.size)||member.size<0||member.size>MAX_BYTES||!HASH.test(member.sha256)||!TYPES.has(member.detectedType)||member.inspection!=='bytes-only'||member.disposition!=='quarantined')fail();
  paths.add(normalized);total+=member.size;if(total>16*1024*1024)fail();
 }
 if(input.database!==null){
  keys(input.database,['integrity','schemaObjects','userRowsRead']);
  if(input.detectedType!=='application/vnd.sqlite3'||input.database.integrity!=='quick-check-passed'||input.database.userRowsRead!==0||!Array.isArray(input.database.schemaObjects)||input.database.schemaObjects.length>256)fail();
  for(const item of input.database.schemaObjects){keys(item,['kind','name']);if(!['table','index','view','trigger'].includes(item.kind)||!safeText(item.name,512))fail();}
 }
 if(input.members.length&&input.detectedType!=='application/zip')fail();
 return structuredClone(input);
}

/** Trusted subprocess configuration only. No shell, source filenames, caller
 * arguments or inherited credentials. Resource limits are not an OS sandbox;
 * production still requires an isolated worker with denied network egress.
 */
export function createByteInspector({python='/usr/bin/python3',timeoutMs=5000,spawnProcess=spawn}={}){
 if(!python.startsWith('/')||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||typeof spawnProcess!=='function')fail();
 return async function inspect(input,{signal}={}){
  const bytes=copyBytes(input);
  if(signal?.aborted)return fallback(bytes,'inspector-unavailable');
  return new Promise(resolve=>{
   let child,timer,done=false,total=0;const parts=[];
   const finish=result=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);child?.kill('SIGKILL');resolve(result);};
   const abort=()=>finish(fallback(bytes,'inspector-unavailable'));
   try{
    child=spawnProcess(python,['-I',inspectorPath],{shell:false,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','ignore'],cwd:'/tmp'});
    timer=setTimeout(()=>finish(fallback(bytes,'inspector-timeout')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    child.on('error',abort);child.stdin.on('error',abort);
    child.stdout.on('data',part=>{total+=part.length;if(total>MAX_REPORT){abort();return;}parts.push(part);});
    child.on('close',code=>{if(done)return;try{if(code!==0)throw new Error();finish(validateReport(JSON.parse(Buffer.concat(parts).toString('utf8')),bytes));}catch{abort();}});
    child.stdin.end(bytes);
   }catch{abort();}
  });
 };
}

async function malwareStatus(scan,bytes,signal){
 const sourceHash=sha(bytes);
 const unavailable={verdict:'unavailable',sourceHash,engine:null,version:null};
 if(typeof scan!=='function'||signal?.aborted)return unavailable;
 // Scanner adapters are trusted, bounded server integrations, never URLs or
 // executable paths supplied with an upload. The timeout never means clean.
 let timer;try{
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(null),5000);});
  const result=await Promise.race([scan(Buffer.from(bytes),{sha256:sourceHash,signal:AbortSignal.any([AbortSignal.timeout(5000),...(signal?[signal]:[])])}),timeout]);
  keys(result,['verdict','sourceHash','engine','version']);
  if(!['clean','infected','unavailable'].includes(result.verdict)||result.sourceHash!==sourceHash||!safeText(result.engine,128)||!safeText(result.version,128))return unavailable;
  return {...result};
 }catch{return unavailable;}finally{clearTimeout(timer);}
}

/** No routes or production adapters are mounted by this module. The audited
 * decision service derives identities; authorize must check current workspace,
 * source grants and historical-only classification. An inventory never admits
 * historical claims, releases quarantine, or grants publication rights.
 */
export function createImportInventory({archive,decisions,authorize,inspect=createByteInspector(),scan,enabled=()=>false}){
 if(typeof archive?.read!=='function'||typeof archive?.quarantine!=='function'||typeof decisions?.decide!=='function'||typeof authorize!=='function'||typeof inspect!=='function'||typeof enabled!=='function')fail();
 return Object.freeze({async inventory(headers,workspaceId,input,{signal}={}){
  try{
   keys(input,['runId','inventoryVersion','sourceRef','declaredType']);
   const {runId,inventoryVersion,declaredType}=input,sourceRef=ref(input.sourceRef);
   if(!ID.test(runId)||!ID.test(inventoryVersion)||!ID.test(workspaceId)||!TYPES.has(declaredType)||sourceRef.sourceId===runId)fail();
   let principal;
   async function gate(){
    let observed;
    const decision=await decisions.decide(headers,workspaceId,async facts=>{
     if(signal?.aborted||await enabled()!==true||!facts||facts.workspaceId!==workspaceId||!safeText(facts.subjectId,128)||(principal&&principal.subjectId!==facts.subjectId))return false;
     if(await authorize(facts,{action:'inspect-import',sourceRef,runId,inventoryVersion})!==true)return false;
     observed=Object.freeze({subjectId:facts.subjectId,workspaceId:facts.workspaceId});return true;
    });
    if(decision.allowed!==true||!observed)fail();principal=observed;
   }
   await gate();
   const bytes=copyBytes(await archive.read(principal,sourceRef));
   if(bytes.length!==sourceRef.size||sha(bytes)!==sourceRef.sha256)fail();
   await gate();
   const malware=await malwareStatus(scan,bytes,signal);
   await gate();
   let report;
   if(malware.verdict==='infected')report=fallback(bytes,'malware-detected');
   else{try{report=validateReport(await inspect(Buffer.from(bytes),{signal}),bytes);}catch{report=fallback(bytes,'inspector-unavailable');}}
   await gate();
   const findings=[...new Set([...report.findings,...(declaredType!==report.detectedType?['declared-type-mismatch']:[]),...(malware.verdict==='unavailable'?['malware-check-unavailable']:[])])].sort();
   const rejected=malware.verdict==='infected'||findings.some(f=>['input-size-limit','archive-entry-limit','archive-unsafe-path-or-type','archive-expansion-limit','archive-malformed','archive-truncated','sqlite-malformed','sqlite-integrity-failed','malformed-or-uninspectable'].includes(f));
   const status=rejected?'rejected':(report.inventoryComplete&&findings.length===0&&malware.verdict==='clean'?'inventoried':'needs-review');
   const manifest={schemaVersion:1,format:'garden-import-manifest-v1',
    importRun:{id:runId,version:inventoryVersion,workspaceId,status,sourceRef,declaredType,detectedType:report.detectedType,inventoryComplete:report.inventoryComplete,profile:PROFILE},
    importedArtifacts:[{path:null,size:bytes.length,sha256:sourceRef.sha256,inspection:'original-bytes',disposition:'quarantined'},...report.members],
    quarantineDecision:{disposition:'quarantined',released:false,malware,findings,rights:'unreviewed',historicalReview:'unreviewed'},
    lineage:{operation:'readonly-inventory',original:sourceRef,sourceBytesModified:false,nestedFormatsParsed:false},database:report.database};
   const serialized=Buffer.from(JSON.stringify(manifest));if(serialized.length>MAX_REPORT)fail();
   // IDs identify an immutable attempt. Identical retries converge; changed
   // scanner/version/results need a new inventoryVersion, never an overwrite.
   const manifestRef=ref(await archive.quarantine(principal,runId,serialized,inventoryVersion));
   if(manifestRef.sourceId!==runId||manifestRef.version!==inventoryVersion||manifestRef.sha256!==sha(serialized)||manifestRef.size!==serialized.length)fail();
   await gate();
   return Object.freeze({manifestRef,manifest,publiclyAccessible:false,publicationApproved:false});
  }catch{fail();}
 }});
}
