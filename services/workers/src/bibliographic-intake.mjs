/** GDN-078 unmounted citation service; authenticated quarantined discovery leads. */
import {createHash} from 'node:crypto';
import {parseBibliography,normalizeDoi,compareBibliographicLeads} from '../../../packages/domain/src/historical/bibliography.mjs';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function reject(){throw new Error('Garden bibliographic intake rejected');}
function exact(v,fields){if(v===null||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).sort().join('|')!==[...fields].sort().join('|'))reject();}
const digest=s=>createHash('sha256').update(s,'utf8').digest('hex');

/** Lookup adapters are trusted, preconfigured DOI-only services, not arbitrary
 * URLs, redirect fetchers, scrapers or a way to sidestep robots/rate limits.
 * The adapter MUST enforce provider TOS, redirect and network allowlists.
 */
export function createDoiLeadResolver({providers,timeoutMs=1500}){
 if(!providers||Object.getPrototypeOf(providers)!==Object.prototype||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>5000)reject();
 const names=Object.keys(providers);
 if(!names.length||names.length>8||names.some(n=>!/^[a-z][a-z0-9-]{0,30}$/.test(n)||typeof providers[n]!=='function'))reject();
 return async function resolveDoi(doi,provider,{signal}={}){
  doi=normalizeDoi(doi);if(!doi||!Object.hasOwn(providers,provider)||signal?.aborted)return {status:'unavailable',lead:null};
  const ownController=new AbortController();
  const parentAbort=()=>ownController.abort();
  signal?.addEventListener('abort',parentAbort,{once:true});
  let timer;
  try{
   // A provider timeout is not a cached negative result or proof of absence.
   const timeout=new Promise(resolve=>{timer=setTimeout(()=>{ownController.abort();resolve({status:'timeout'});},timeoutMs);});
   const result=await Promise.race([Promise.resolve().then(()=>providers[provider](doi,{signal:ownController.signal})),timeout]);
   if(ownController.signal.aborted)return {status:'timeout',lead:null};
   if(!result||typeof result!=='object')return {status:'unavailable',lead:null};
   if(['access-denied','robots-disallowed','rate-limited','not-found','timeout'].includes(result.status))return {status:result.status,lead:null};
   if(result.status!=='ok'||!result.metadata||typeof result.metadata!=='object'||!result.attribution||typeof result.attribution!=='object')return {status:'unavailable',lead:null};
   const a=result.attribution;
   // Attribution is not inferred from a DOI or a catalog title; rights remain explicit.
   const where={provider,repositoryId:a.repositoryId??null,locator:a.locator,license:a.license??'unknown',access:a.access??'unknown',retrievedAt:a.retrievedAt??null};
   const raw=JSON.stringify(result.metadata);
   const parsed=parseBibliography('csl-json',raw,where);
   if(parsed.length!==1||parsed[0].normalized.doi!==doi)return {status:'unavailable',lead:null};
   return {status:'ok',lead:parsed[0]};
  }catch{return {status:'unavailable',lead:null};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',parentAbort);ownController.abort();}
 };
}

/** All operations require an audited identity/authorization decision before and
 * after work. The repository is private, owner scoped, append-only and trusted.
 * No API route or background provider polling is mounted here.
 */
export function createBibliographicIntake({decisions,authorize,repository,resolveDoi,enabled=()=>false}){
 const methods=['submit','list','detail','decide','history','lookupDoi'];
 if(typeof decisions?.decide!=='function'||typeof authorize!=='function'||typeof enabled!=='function'||
  ['submit','list','detail','decision','history'].some(k=>typeof repository?.[k]!=='function')||
  (resolveDoi!==undefined&&typeof resolveDoi!=='function'))reject();
 const api={};
 for(const method of methods)api[method]=async function(headers,workspaceId,input,{signal}={}){
  try{
   if(!ID.test(workspaceId)||signal?.aborted)reject();
   const shape={submit:['submissionId','format','raw','attribution'],list:['afterId','limit'],
    detail:['candidateId'],decide:['eventId','firstId','secondId','decision','reason','supersedes'],
    history:['firstId','secondId'],lookupDoi:['submissionId','provider','doi']}[method];
   exact(input,shape);
   const spec=structuredClone(input);let principal=null;
   async function gate(phase,candidateId=null){
    let observed=null;
    const audit=await decisions.decide(headers,workspaceId,async facts=>{
     if(signal?.aborted||await enabled()!==true||facts?.workspaceId!==workspaceId||typeof facts.subjectId!=='string'||!facts.subjectId||facts.subjectId.length>128||principal&&facts.subjectId!==principal.subjectId)return false;
     if(await authorize(facts,{action:`bibliography:${method}`,phase,workspaceId,candidateId})!==true)return false;
     observed={workspaceId,subjectId:facts.subjectId};return true;
    });
    if(audit?.allowed!==true||!ID.test(audit.requestId)||!observed)reject();
    principal=observed;return {...observed,requestId:audit.requestId};
   }
   let facts=await gate('admit');let result;
   if(method==='submit'){
    if(!ID.test(spec.submissionId))reject();
    const entries=parseBibliography(spec.format,spec.raw,spec.attribution);
    facts=await gate('before-persist');
    result=repository.submit(facts,spec.submissionId,spec.format,digest(spec.raw),entries);
   }else if(method==='list'){
    result=repository.list(facts,{afterId:spec.afterId,limit:spec.limit});
   }else if(method==='detail'){
    facts=await gate('source-read',spec.candidateId);result=repository.detail(facts,spec.candidateId);
   }else if(method==='history'){
    facts=await gate('source-read',spec.firstId);facts=await gate('source-read',spec.secondId);
    result=repository.history(facts,spec.firstId,spec.secondId);
   }else if(method==='decide'){
    facts=await gate('source-write',spec.firstId);facts=await gate('source-write',spec.secondId);
    result=repository.decision(facts,spec);
   }else if(method==='lookupDoi'){
    if(!resolveDoi||!ID.test(spec.submissionId))reject();
    const lookup=await resolveDoi(spec.doi,spec.provider,{signal});
    if(lookup.status!=='ok')result={status:lookup.status,candidateCreated:false};
    else{
     facts=await gate('before-persist');
     const lead=lookup.lead;
     result={status:'discovery-only',...repository.submit(facts,spec.submissionId,'csl-json',digest(lead.original),[lead])};
    }
   }
   await gate('deliver');
   return result;
  }catch{reject();}
 };
 return Object.freeze(api);
}
export {compareBibliographicLeads};
