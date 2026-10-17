import {exact,uuid,text,reject,validateProgramVersion,programTermsDigest,validateProgramAuthority,acknowledgmentInput,submissionInput,interestInput,validateSubmissionSource} from '../../../packages/domain/src/community/program.mjs';

/** All adapters are server-owned. decisions is GDN-025's audited, verified
 * session boundary; authorize checks current membership + purpose. Operator
 * authorization independently requires scope and recent step-up. No HTTP
 * caller supplies its own subject, role, authority, consent or source category.
 */
export function createContributionProgramService({decisions,authorize,authorizeOperator,verifyAuthority,verifyUpload,repository,enabled=()=>false,now=Date.now,maxConcurrent=4}){
 const actions=['status','installVersion','acknowledge','submit','registerInterest','withdrawInterest'];
 if(typeof decisions?.decide!=='function'||[authorize,authorizeOperator,verifyAuthority,verifyUpload,enabled,now].some(fn=>typeof fn!=='function')||actions.some(a=>typeof repository?.[a]!=='function')||typeof repository.program!=='function'||!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>8)reject();
 let running=0;const service={};
 for(const action of actions)service[action]=async function(headers,workspaceId,input){
  if(running>=maxConcurrent)reject();running++;
  try{
   uuid(workspaceId);let spec;
   switch(action){
    case 'status':exact(input,['programId']);uuid(input.programId);spec=structuredClone(input);break;
    case 'installVersion':exact(input,['version','authorizationId']);uuid(input.authorizationId);spec={version:validateProgramVersion(input.version),authorizationId:input.authorizationId};break;
    case 'acknowledge':spec=acknowledgmentInput(input);break;
    case 'submit':spec=submissionInput(input);break;
    case 'registerInterest':spec=interestInput(input);break;
    case 'withdrawInterest':exact(input,['programId','interestId','withdrawalId']);Object.values(input).forEach(uuid);spec=structuredClone(input);break;
   }
   const programId=action==='installVersion'?spec.version.programId:spec.programId;
   let subject=null;
   const collecting=!['status','withdrawInterest'].includes(action);
   async function gate(phase){
    let accepted=null;
    const decision=await decisions.decide(headers,workspaceId,async facts=>{
     if(facts?.workspaceId!==workspaceId||(subject!==null&&facts.subjectId!==subject))return false;
     text(facts.subjectId);
     if(collecting&&await enabled()!==true)return false;
     const scope=Object.freeze({action:`contribution:${action}`,phase,workspaceId,programId,uploadId:spec.uploadId??null,purpose:action==='registerInterest'?'program-interest':action==='submit'?'research-submission':'program-administration'});
     if(await authorize(facts,scope)!==true)return false;
     if(action==='installVersion'&&await authorizeOperator(headers,facts,scope)!==true)return false;
     // Revalidate after asynchronous membership/operator authorization, within
     // the last audited admission decision immediately preceding the write.
     // Intake closure and withdrawals remain separate paths.
     if(phase==='before-write'&&collecting){
      if(action==='submit')source=await receipt();
      authority=await currentAuthority();
      if(await enabled()!==true)return false;
     }
     accepted={subjectId:facts.subjectId,workspaceId};return true;
    });
    if(!accepted||decision?.allowed!==true)reject();uuid(decision.requestId);subject=accepted.subjectId;
    return {...accepted,requestId:decision.requestId};
   }
   let facts=await gate('admit');
   let stored=action==='installVersion'?{version:spec.version,authority:null}:repository.program(facts,programId);
   async function currentAuthority(){
    const authorizationId=action==='installVersion'?spec.authorizationId:stored.authority.authorizationId;
    const authority=validateProgramAuthority(await verifyAuthority({facts,workspaceId,programId,version:stored.version,termsDigest:programTermsDigest(stored.version),authorizationId}),stored.version,workspaceId,now());
    if(authority.authorizationId!==authorizationId)reject();
    if(stored.authority&&Object.keys(authority).some(key=>authority[key]!==stored.authority[key]))reject();
    return authority;
   }
   let authority=null;
   if(collecting)authority=await currentAuthority();
   if(!['status','installVersion','withdrawInterest'].includes(action)&&(stored.version.version!==spec.version||programTermsDigest(stored.version)!==spec.termsDigest))reject();
   let source=null;
   async function receipt(){return validateSubmissionSource(await verifyUpload({facts,workspaceId,subjectId:facts.subjectId,uploadId:spec.uploadId,purpose:'research-submission'}),{...facts,uploadId:spec.uploadId});}
   if(action==='submit')source=await receipt();
   facts=await gate(action==='status'?'read':'before-write');
   let result;
   if(action==='installVersion')result=repository.installVersion(facts,spec.version,authority);
   else if(action==='status'){
    result=repository.status(facts,programId);
    let intakeAvailable=false;
    try{if(await enabled()===true){await currentAuthority();intakeAvailable=true;}}catch{/* Reading one's receipts stays available after closure. */}
    result={...result,intakeAvailable};
   }else if(action==='submit')result=repository.submit(facts,spec,source);
   else result=repository[action](facts,spec);
   await gate('deliver');return result;
  }catch{reject();}finally{running--;}
 };
 return Object.freeze(service);
}

/** Intentionally unmounted until the real adapters are supplied. Read and
 * withdrawal remain possible after intake closure; all requests are audited.
 * Operator version installation is deliberately not exposed as an HTTP route.
 */
export function createContributionProgramHandler({service,origin}){
 const base=new URL(origin);if(!['https:','http:'].includes(base.protocol)||base.origin!==origin)reject();
 const paths={'/api/research/contribution/status':'status','/api/research/contribution/acknowledge':'acknowledge','/api/research/contribution/submit':'submit','/api/research/contribution/interest':'registerInterest','/api/research/contribution/withdraw-interest':'withdrawInterest'};
 if(Object.values(paths).some(name=>typeof service?.[name]!=='function'))reject();
 return async request=>{
  const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie, Authorization'}});
  try{
   const url=new URL(request.url);
   if(url.origin!==origin||request.method!=='POST'||request.headers.get('origin')!==origin||url.search||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!Object.hasOwn(paths,url.pathname))reject();
   const reader=request.body?.getReader();if(!reader)reject();const chunks=[];let bytes=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096){await reader.cancel();reject();}chunks.push(Buffer.from(value));}}
   finally{reader.releaseLock();}
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes)));
   exact(body,['workspaceId','input']);uuid(body.workspaceId);
   return reply(await service[paths[url.pathname]](request.headers,body.workspaceId,body.input),200);
  }catch{return reply({error:'contribution_unavailable'},403);}
 };
}
