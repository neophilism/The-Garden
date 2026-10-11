const ROUTES=new Map([
 ['/sign-up/email','POST'],['/sign-in/email','POST'],['/sign-out','POST'],
 ['/get-session','GET'],['/verify-email','GET'],['/request-password-reset','POST'],['/reset-password','POST']
]);
const SECURITY_ROUTES=new Map([
 ['/passkey/generate-register-options','GET'],['/passkey/verify-registration','POST'],
 ['/passkey/generate-authenticate-options','GET'],['/passkey/verify-authentication','POST'],
 ['/session/list','GET'],['/session/revoke','POST'],['/session/revoke-all','POST'],
 ['/session/assurance','GET'],['/passkey/list','GET'],['/passkey/remove','POST']
]);
export function identityPolicy({environment,baseURL,secret,activation,sessionSecurity=false}){
 let url;try{url=new URL(baseURL);}catch{throw new Error('Invalid identity configuration');}
 if(url.username||url.password||url.hash||url.search||url.pathname!=='/'||!['http:','https:'].includes(url.protocol))throw new Error('Invalid identity configuration');
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32||new Set(secret).size<8)throw new Error('Identity signing secret is not suitable');
 if(typeof sessionSecurity!=='boolean')throw new Error('Invalid identity configuration');
 if(environment==='ci'){
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('CI identity must use loopback');
 }else if(environment==='staging'){
  if(url.protocol!=='https:'||!activation||activation.environment!=='staging'||activation.origin!==url.origin||activation.project_id!=='royal-union-78374030'||activation.branch_id!=='br-purple-grass-b5hurfl7'||activation.provider!=='self-managed-better-auth'||activation.mail_verified!==true||typeof activation.review_id!=='string'||activation.review_id.length<8)throw new Error('Staging identity activation is not verified');
  if(sessionSecurity&&(activation.assurance_policy!=='passkey-uv-v1'||typeof activation.assurance_review_id!=='string'||activation.assurance_review_id.length<8))throw new Error('Session assurance activation is not verified');
 }else throw new Error('Identity is not approved for this environment');
 return Object.freeze({origin:url.origin,environment,secureCookies:url.protocol==='https:',accountLinking:false,publicReadingRequiresAccount:false,sessionSecurity});
}
export async function boundedAuthRequest(request,policy){
 const url=new URL(request.url);
 const path=url.pathname.startsWith('/api/auth/')?url.pathname.slice('/api/auth'.length):'';
 const security=SECURITY_ROUTES.has(path);
 if(url.origin!==policy.origin||(security?(policy.sessionSecurity?SECURITY_ROUTES.get(path):null):ROUTES.get(path))!==request.method)throw new Error('Identity route not allowed');
 if(request.headers.get('sec-fetch-site')==='cross-site')throw new Error('Identity origin not allowed');
 if(request.method==='POST'&&request.headers.get('origin')!==policy.origin)throw new Error('Identity origin not allowed');
 if(security&&(url.search||request.headers.get('x-garden-request')!=='1'||(request.headers.has('origin')&&request.headers.get('origin')!==policy.origin)))throw new Error('Identity security request denied');
 if(request.method!=='POST')return request;
 if(url.search)throw new Error('Mutation query parameters are not allowed');
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??''))throw new Error('Identity content type not allowed');
 const length=request.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>32768))throw new Error('Identity body too large');
 if(!request.body)throw new Error('Identity body required');
 const reader=request.body.getReader();const parts=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>32768){await reader.cancel();throw new Error('Identity body too large');}parts.push(value);}}
 finally{reader.releaseLock();}
 const body=Buffer.concat(parts.map(x=>Buffer.from(x)),total);
 const parsed=JSON.parse(body.toString('utf8'));
 if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error('Identity object required');
 // Never accept client-controlled session assurance, recovery mode or plugin configuration.
 for(const key of ['authenticationMethod','assuranceCredentialId','assuranceVerifiedAt','privilegedAssurance','sessionId','role','banned','emailVerified','createSession'])if(Object.hasOwn(parsed,key))throw new Error('Server-owned identity field');
 return new Request(request.url,{method:request.method,headers:request.headers,body,signal:request.signal});
}
export function unavailableIdentity(){return Response.json({error:'identity_unavailable'},{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
