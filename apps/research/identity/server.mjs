import {AsyncLocalStorage} from 'node:async_hooks';
import {betterAuth} from 'better-auth';
import {APIError} from 'better-auth/api';
import {admin} from 'better-auth/plugins/admin';
import {defaultAc,userAc} from 'better-auth/plugins/admin/access';
import {passkey} from '@better-auth/passkey';
import {identityPolicy,boundedAuthRequest,unavailableIdentity} from './policy.mjs';
import {identityResponse} from './response.mjs';
import {accountLocks} from './session-locks.mjs';
import {verifiedCredential,sessionAssurance,mayEnrollPasskey,PRIVILEGED_ACTIONS,sameAssurance} from './assurance.mjs';
const denied = () => new APIError('FORBIDDEN', {message:'Identity security request denied'});
const responseJSON = (value, status=200) => Response.json(value, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
/** All inputs are server-owned. sessionLockDatabase is an independently bounded
 * pool connected to the SAME identity database/schema/role, never a new database.
 * Omit it to keep the old, nonprivileged identity surface. Neither mode mounts
 * a route, migrates a schema, enrolls an operator, or enables production.
 */
export function createResearchIdentity({database,secret,baseURL,environment,activation,deliverMail,isSuspended,sessionLockDatabase}){
 const enabled=sessionLockDatabase!==undefined;
 const policy=identityPolicy({environment,secret,baseURL,activation,sessionSecurity:enabled});
 if(typeof database?.query!=='function'||typeof deliverMail!=='function'||typeof isSuspended!=='function')throw new Error('Missing trusted identity dependencies');
 const acquire=enabled?accountLocks(database,sessionLockDatabase):null;
 const requests=new AsyncLocalStorage();
 const operatorAc=defaultAc.newRole({user:['ban','get'],session:['list','revoke']});
 let auth;
 async function lock(subjectId){
  const state=requests.getStore();if(!state||!acquire)throw denied();
  if(state.subject){if(state.subject!==subjectId)throw denied();return;}
  state.release=await acquire(subjectId);state.subject=subjectId;
 }
 async function liveSession(headers){
  const value=await auth.api.getSession({headers,query:{disableCookieCache:true}});
  if(!value||value.user.emailVerified!==true||value.user.banned===true||new Date(value.session.expiresAt).getTime()<=Date.now()||(await isSuspended(value.user.id))!==false)return null;
  return value;
 }
 async function assuranceRow(value){
  if(!value)return null;
  const result=await database.query(`SELECT s.id,s."userId",s."createdAt",s."expiresAt",s."authenticationMethod",s."assuranceVerifiedAt",s."assuranceCredentialId",
    p."credentialID" AS "activeCredentialId",p."userId" AS "credentialUserId"
    FROM "session" s LEFT JOIN "passkey" p ON p."credentialID"=s."assuranceCredentialId" AND p."userId"=s."userId"
    WHERE s.id=$1 AND s."userId"=$2`,[value.session.id,value.user.id]);
  return result.rows.length===1?result.rows[0]:null;
 }
 async function enrollment(headers){
  const value=await liveSession(headers);if(!value)throw denied();
  await lock(value.user.id);
  const current=await liveSession(headers);if(!current||current.session.id!==value.session.id)throw denied();
  const count=await database.query('SELECT count(*)::integer AS total FROM "passkey" WHERE "userId"=$1',[current.user.id]);
  if(!mayEnrollPasskey(await assuranceRow(current),current.user.id,current.session.id,count.rows[0]?.total))throw denied();
  return current;
 }
 const options={
  appName:'The Garden Research',database,secret,baseURL:policy.origin,basePath:'/api/auth',trustedOrigins:[policy.origin],
  logger:{disabled:true},
  emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,requireEmailVerification:true,revokeSessionsOnPasswordReset:true,
   sendResetPassword:async({user,url,token})=>deliverMail({kind:'password-reset',userId:user.id,to:user.email,url,token})},
  emailVerification:{sendOnSignUp:true,autoSignInAfterVerification:false,expiresIn:1800,
   sendVerificationEmail:async({user,url,token})=>deliverMail({kind:'verify-email',userId:user.id,to:user.email,url,token})},
  account:{accountLinking:{enabled:false}},
  session:{expiresIn:28800,updateAge:3600,freshAge:600,cookieCache:{enabled:false},...(enabled?{additionalFields:{
   authenticationMethod:{type:'string',required:false,input:false,returned:false,defaultValue:'unverified'},
   assuranceVerifiedAt:{type:'date',required:false,input:false,returned:false},
   assuranceCredentialId:{type:'string',required:false,input:false,returned:false}
  }}:{})},
  advanced:{cookiePrefix:'garden-research',useSecureCookies:policy.secureCookies,crossSubDomainCookies:{enabled:false},defaultCookieAttributes:{httpOnly:true,sameSite:'lax',secure:policy.secureCookies}},
  rateLimit:{enabled:true,storage:'database',window:60,max:100,customRules:{'/sign-in/email':{window:60,max:10},'/request-password-reset':{window:60,max:5},'/passkey/*':{window:60,max:20}}},
  plugins:[admin({defaultRole:'researcher',adminRoles:['operator'],roles:{researcher:userAc,operator:operatorAc}})]
 };
 if(enabled){
  options.plugins.push(passkey({
   rpID:new URL(policy.origin).hostname,rpName:'The Garden Research',origin:policy.origin,
   authenticatorSelection:{residentKey:'required',userVerification:'required'},registration:{requireSession:true,
    async afterVerification({ctx,verification,clientData,user}){
     verifiedCredential(verification,'registration',clientData.id);
     const current=await enrollment(ctx.headers);
     if(current.user.id!==user.id)throw denied();
    }},authentication:{async afterVerification({ctx,verification,clientData}){
     const credentialId=verifiedCredential(verification,'authentication',clientData.id);
     const found=await database.query('SELECT "userId" FROM "passkey" WHERE "credentialID"=$1',[credentialId]);
     if(found.rows.length!==1)throw denied();
     const subjectId=found.rows[0].userId;
     await lock(subjectId);
     const state=requests.getStore();
     if(state.prior&&state.prior.user.id!==subjectId)throw denied();
     if(state.prior&&!(await liveSession(ctx.headers)))throw denied();
     state.proof={subjectId,credentialId,verifiedAt:new Date()};
    }}
  }));
  options.databaseHooks={session:{create:{
   async before(session){
    const state=requests.getStore();
    if(!state||!['/sign-in/email','/passkey/verify-authentication'].includes(state.path))throw denied();
    await lock(session.userId);
    const user=await database.query('SELECT "emailVerified",banned FROM "user" WHERE id=$1',[session.userId]);
    if(user.rows.length!==1||user.rows[0].emailVerified!==true||user.rows[0].banned===true||(await isSuspended(session.userId))!==false)throw denied();
    const proof=state.proof;
    if(state.path==='/passkey/verify-authentication'&&(!proof||proof.subjectId!==session.userId))throw denied();
    return {data:{...session,authenticationMethod:proof?'passkey-uv':'password',assuranceVerifiedAt:proof?.verifiedAt??null,assuranceCredentialId:proof?.credentialId??null}};
   },
   async after(session){
    const state=requests.getStore();
    if(state?.prior?.user.id===session.userId&&state.prior.session.id!==session.id){
     await database.query('DELETE FROM "session" WHERE id=$1 AND "userId"=$2',[state.prior.session.id,session.userId]);
    }
   }
  }}};
 }
 auth=betterAuth(options);
 async function currentViewer(headers){
  const value=await liveSession(headers);if(!value)return null;
  const row=enabled?await assuranceRow(value):null;
  const high=enabled&&sessionAssurance(row,value.user.id,value.session.id);
  return Object.freeze({id:value.user.id,email:value.user.email,name:value.user.name,verified:true,sessionId:value.session.id,
   canReadRestrictedRecords:false,privilegedAssurance:high,
   lastStepUpAt:high?new Date(row.assuranceVerifiedAt).toISOString():null,
   assuranceCredentialId:high?row.assuranceCredentialId:null});
 }
 async function customSecurity(path,body,headers){
  const value=await liveSession(headers);if(!value)throw denied();
  await lock(value.user.id);
  const current=await liveSession(headers);if(!current||current.session.id!==value.session.id)throw denied();
  if(path==='/session/assurance'){
   const viewer=await currentViewer(headers);
   return responseJSON({authenticated:true,privilegedAssurance:viewer.privilegedAssurance,lastStepUpAt:viewer.lastStepUpAt});
  }
  if(path==='/session/list'){
   const rows=await database.query('SELECT id,"createdAt","expiresAt","authenticationMethod" FROM "session" WHERE "userId"=$1 AND "expiresAt">CURRENT_TIMESTAMP ORDER BY "createdAt" DESC,id LIMIT 101',[current.user.id]);
   return responseJSON({sessions:rows.rows.slice(0,100).map(row=>({id:row.id,current:row.id===current.session.id,createdAt:row.createdAt,expiresAt:row.expiresAt,method:row.authenticationMethod==='passkey-uv'?'passkey':'password'})),truncated:rows.rows.length>100});
  }
  if(path==='/session/revoke-all'){
   if(Object.keys(body).length)throw denied();
   await database.query('DELETE FROM "session" WHERE "userId"=$1',[current.user.id]);
   return responseJSON({revoked:true});
  }
  if(path==='/session/revoke'){
   if(Object.keys(body).length!==1||typeof body.id!=='string'||body.id.length>256)throw denied();
   const result=await database.query('DELETE FROM "session" WHERE id=$1 AND "userId"=$2 RETURNING id',[body.id,current.user.id]);
   if(result.rows.length!==1)throw denied();
   return responseJSON({revoked:true});
  }
  if(path==='/passkey/list'){
   const result=await database.query('SELECT id,name,"createdAt","backedUp" FROM "passkey" WHERE "userId"=$1 ORDER BY "createdAt",id LIMIT 101',[current.user.id]);
   return responseJSON({passkeys:result.rows.slice(0,100),truncated:result.rows.length>100});
  }
  if(path==='/passkey/remove'){
   if(Object.keys(body).length!==1||typeof body.id!=='string'||body.id.length>256||!(await currentViewer(headers))?.privilegedAssurance)throw denied();
   const keys=await database.query('SELECT id,"credentialID" FROM "passkey" WHERE "userId"=$1',[current.user.id]);
   const target=keys.rows.find(row=>row.id===body.id);
   if(!target||keys.rows.length<2)throw denied();
   await database.query('DELETE FROM "passkey" WHERE id=$1 AND "userId"=$2',[target.id,current.user.id]);
   await database.query('DELETE FROM "session" WHERE "userId"=$1 AND "assuranceCredentialId"=$2',[current.user.id,target.credentialID]);
   return responseJSON({removed:true});
  }
  throw denied();
 }
 return Object.freeze({
  options,
  async handle(request){
   let bounded;try{bounded=await boundedAuthRequest(request,policy);}catch{return responseJSON({error:'request_denied'},403);}
   const path=new URL(bounded.url).pathname.slice('/api/auth'.length);
   const state={path,subject:null,release:null,proof:null,prior:null};
   return requests.run(state,async()=>{
    let response;
    try{
     const body=bounded.method==='POST'?await bounded.clone().json():{};
     if(enabled){
      state.prior=await liveSession(bounded.headers);
      let subject=state.prior?.user.id;
      if(path==='/sign-in/email'&&typeof body.email==='string'){
       const result=await database.query('SELECT id FROM "user" WHERE lower(email)=lower($1) LIMIT 2',[body.email.trim()]);subject=result.rows.length===1?result.rows[0].id:null;
      }else if(path==='/passkey/verify-authentication'&&typeof body.response?.id==='string'){
       const result=await database.query('SELECT "userId" FROM "passkey" WHERE "credentialID"=$1',[body.response.id]);subject=result.rows.length===1?result.rows[0].userId:null;
      }else if(path==='/reset-password'&&typeof body.token==='string'){
       const result=await database.query('SELECT value FROM "verification" WHERE identifier=$1 AND "expiresAt">CURRENT_TIMESTAMP',['reset-password:'+body.token]);subject=result.rows.length===1?result.rows[0].value:null;
      }
      if(subject)await lock(subject);
      if(path==='/passkey/generate-register-options'||path==='/passkey/verify-registration')await enrollment(bounded.headers);
     }
     if(enabled&&(path.startsWith('/session/')||path==='/passkey/list'||path==='/passkey/remove')){
      response=await customSecurity(path,body,bounded.headers);
     }else{
      response=await identityResponse(await auth.handler(bounded),path);
     }
    }catch(error){response=error instanceof APIError?responseJSON({error:'request_denied'},403):unavailableIdentity();}
    finally{if(state.release){try{await state.release();}catch{response=unavailableIdentity();}}}
    return response;
   });
  },
  async viewer(headers){try{return await currentViewer(headers);}catch{return null;}},
  /** A fresh admission check, NOT a capability token. Consumers must bind their
   * own role/purpose transaction and recheck before commit. No work is executed.
   */
  async authorizePrivileged(headers,action,authorize){
   if(!enabled||!PRIVILEGED_ACTIONS.includes(action)||typeof authorize!=='function')return false;
   let release;
   try{
    const before=await currentViewer(headers);if(!before?.privilegedAssurance)return false;
    release=await acquire(before.id);
    const current=await currentViewer(headers);
    if(!current?.privilegedAssurance||current.sessionId!==before.sessionId)return false;
    if((await authorize(Object.freeze({subjectId:current.id,sessionId:current.sessionId,action})))!==true)return false;
    const after=await currentViewer(headers);
    return sameAssurance(current,after);
   }catch{return false;}finally{if(release){try{await release();}catch{return false;}}}
  }
 });
}
