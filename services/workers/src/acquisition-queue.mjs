/** GDN-085: owner-scoped and audit-gated research acquisition planning.
 * No network, email, payment, scheduling, or source-fetch operation exists.
 */
import {UUID,exact,reject,validateAcquisitionDraft,validateAcquisitionEvent} from '../../../packages/domain/src/historical/acquisition-tasks.mjs';

export function createAcquisitionQueue({decisions,authorize,repository,verifyAuthority,resolveRoute,enabled=()=>false,maxConcurrent=4}){
 const methods=['draft','list','detail','observe','approve','recordContact','finish','history'];
 if(typeof decisions?.decide!=='function'||typeof authorize!=='function'||typeof enabled!=='function'||typeof verifyAuthority!=='function'||typeof resolveRoute!=='function'||!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>8||methods.some(m=>typeof repository?.[m]!=='function'))reject();
 let inFlight=0;
 const inputs={
  draft:['taskId','repositoryId','itemId','candidateId','routeKey','requestKind','title','notes','purpose','costMinor','currency'],
  list:['afterId','limit'],detail:['taskId'],history:['taskId'],
  observe:['taskId','eventId','previousEventId','finding','note','evidenceRef'],
  approve:['taskId','eventId','previousEventId','authorizationId'],
  recordContact:['taskId','eventId','previousEventId','authorizationId','occurredAt','receiptRef'],
  finish:['taskId','eventId','previousEventId','outcome','note','evidenceRef']
 };
 const api={};
 for(const action of methods)api[action]=async function(headers,workspaceId,input,{signal}={}){
  if(inFlight>=maxConcurrent)reject();inFlight++;
  try{
   if(!UUID.test(workspaceId)||signal?.aborted)reject();
   exact(input,inputs[action]);
   const spec=structuredClone(input);
   if(action==='draft')validateAcquisitionDraft(spec);
   if(['observe','approve','recordContact','finish'].includes(action))validateAcquisitionEvent(spec,action);
   let principal=null;
   async function gate(phase,task=null){
    let observed=null;
    const decision=await decisions.decide(headers,workspaceId,async facts=>{
     if(signal?.aborted||await enabled()!==true||facts?.workspaceId!==workspaceId||typeof facts.subjectId!=='string'||!facts.subjectId||facts.subjectId.length>128||(principal&&principal.subjectId!==facts.subjectId))return false;
     if(await authorize(facts,{action:`acquisition:${action}`,phase,workspaceId,taskId:task?.id??spec.taskId??null,repositoryId:task?.task.repositoryId??spec.repositoryId??null,itemId:task?.task.itemId??spec.itemId??null,candidateId:task?.task.candidateId??spec.candidateId??null,routeKey:task?.task.routeKey??spec.routeKey??null,purpose:'research'})!==true)return false;
     observed=Object.freeze({subjectId:facts.subjectId,workspaceId});return true;
    });
    if(!observed||decision?.allowed!==true||!UUID.test(decision.requestId))reject();
    principal=observed;
    return {...observed,requestId:decision.requestId};
   }
   let facts=await gate('admit'),task=null;
   if(['detail','history','observe','approve','recordContact','finish'].includes(action)){
    task=repository.detail(facts,spec.taskId);
    facts=await gate('source-access',task);
   }
   let result;
   switch(action){
    case 'draft':{
     // Caller route aliases must never bypass a prior denial or contact receipt.
     // An authorized repository locator service must independently resolve the
     // stable route from protected repository/item identities. Never trust the
     // caller-supplied route as its own proof of canonical identity.
     const canonical=await resolveRoute({facts,repositoryId:spec.repositoryId,itemId:spec.itemId,candidateId:spec.candidateId,requestKind:spec.requestKind});
     if(canonical!==spec.routeKey)reject();
     facts=await gate('before-write');
     if(await resolveRoute({facts,repositoryId:spec.repositoryId,itemId:spec.itemId,candidateId:spec.candidateId,requestKind:spec.requestKind})!==spec.routeKey)reject();
     result=repository.draft(facts,spec);break;
    }
    case 'list':result=repository.list(facts,spec);break;
    case 'detail':result=repository.detail(facts,spec.taskId);break;
    case 'history':result=repository.history(facts,spec.taskId);break;
    case 'observe':facts=await gate('before-write',task);result=repository.observe(facts,spec);break;
    case 'finish':facts=await gate('before-write',task);result=repository.finish(facts,spec);break;
    case 'approve':case 'recordContact':{
     // Authority comes from a trusted verifier. The caller supplies only its ID;
     // it cannot assert budget, approver identity, permission, or validity.
     const authority=await verifyAuthority({facts,task,authorizationId:spec.authorizationId,action});
     facts=await gate('before-write',task);
     if(action==='approve')result=repository.approve(facts,spec,authority);
     else result=repository.recordContact(facts,spec,authority);
     break;
    }
   }
   await gate('deliver',task);
   return result;
  }catch{reject();}finally{inFlight--;}
 };
 return Object.freeze(api);
}
