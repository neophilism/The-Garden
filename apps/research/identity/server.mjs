import {betterAuth} from 'better-auth';
import {admin} from 'better-auth/plugins/admin';
import {defaultAc,userAc} from 'better-auth/plugins/admin/access';
import {identityPolicy,boundedAuthRequest,unavailableIdentity} from './policy.mjs';
import {verifiedViewer} from './session.mjs';
/** All dependencies are server-owned. Never accept a pool, mailer, policy,
 * signing secret, activation record or origin from an HTTP caller.
 */
export function createResearchIdentity({database,secret,baseURL,environment,activation,deliverMail,isSuspended}){
 const policy=identityPolicy({environment,secret,baseURL,activation});
 if(typeof database?.query!=='function'||typeof deliverMail!=='function'||typeof isSuspended!=='function')throw new Error('Missing trusted identity dependencies');
 const operatorAc=defaultAc.newRole({user:['ban','get'],session:['list','revoke']});
 const options={
  appName:'The Garden Research',database,secret,baseURL:policy.origin,basePath:'/api/auth',trustedOrigins:[policy.origin],logger:{disabled:true},
  emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,requireEmailVerification:true,revokeSessionsOnPasswordReset:true,
   sendResetPassword:async({user,url,token})=>deliverMail({kind:'password-reset',userId:user.id,to:user.email,url,token})},
  emailVerification:{sendOnSignUp:true,autoSignInAfterVerification:false,expiresIn:1800,
   sendVerificationEmail:async({user,url,token})=>deliverMail({kind:'verify-email',userId:user.id,to:user.email,url,token})},
  account:{accountLinking:{enabled:false}},
  session:{expiresIn:28800,updateAge:3600,freshAge:600,cookieCache:{enabled:false}},
  advanced:{cookiePrefix:'garden-research',useSecureCookies:policy.secureCookies,crossSubDomainCookies:{enabled:false},defaultCookieAttributes:{httpOnly:true,sameSite:'lax',secure:policy.secureCookies}},
  rateLimit:{enabled:true,storage:'database',window:60,max:100,customRules:{'/sign-in/email':{window:60,max:10},'/request-password-reset':{window:60,max:5}}},
  plugins:[admin({defaultRole:'researcher',adminRoles:['operator'],roles:{researcher:userAc,operator:operatorAc}})]
 };
 const auth=betterAuth(options);
 return Object.freeze({options,
  async handle(request){
   let bounded;try{bounded=await boundedAuthRequest(request,policy);}catch{return Response.json({error:'request_denied'},{status:403,headers:{'Cache-Control':'no-store'}});}
   try{
    const response=await auth.handler(bounded);if(response.status>=500)return unavailableIdentity();
    const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');
    return new Response(response.body,{status:response.status,headers});
   }catch{return unavailableIdentity();}
  },
  async viewer(headers){
   try{
    const session=await auth.api.getSession({headers,query:{disableCookieCache:true}});
    if(typeof session?.user?.id!=='string')return null;
    return verifiedViewer(session,await isSuspended(session.user.id));
   }catch{return null;}
  }
 });
}
