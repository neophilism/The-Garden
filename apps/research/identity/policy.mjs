const ROUTES=new Map([
 ['/sign-up/email','POST'],['/sign-in/email','POST'],['/sign-out','POST'],
 ['/get-session','GET'],['/verify-email','GET'],['/request-password-reset','POST'],['/reset-password','POST']
]);
export function identityPolicy({environment,baseURL,secret,activation}){
 let url;try{url=new URL(baseURL);}catch{throw new Error('Invalid identity configuration');}
 if(url.username||url.password||url.hash||url.search||url.pathname!=='/'||!['http:','https:'].includes(url.protocol))throw new Error('Invalid identity configuration');
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32||new Set(secret).size<8)throw new Error('Identity signing secret is not suitable');
 if(environment==='ci'){
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('CI identity must use loopback');
 }else if(environment==='staging'){
  if(url.protocol!=='https:'||!activation||activation.environment!=='staging'||activation.origin!==url.origin||activation.project_id!=='royal-union-78374030'||activation.branch_id!=='br-purple-grass-b5hurfl7'||activation.provider!=='self-managed-better-auth'||activation.mail_verified!==true||typeof activation.review_id!=='string'||activation.review_id.length<8)throw new Error('Staging identity activation is not verified');
 }else throw new Error('Identity is not approved for this environment');
 return Object.freeze({origin:url.origin,environment,secureCookies:url.protocol==='https:',accountLinking:false,publicReadingRequiresAccount:false});
}
export async function boundedAuthRequest(request,policy){
 const url=new URL(request.url);
 const path=url.pathname.startsWith('/api/auth/')?url.pathname.slice('/api/auth'.length):'';
 if(url.origin!==policy.origin||ROUTES.get(path)!==request.method)throw new Error('Identity route not allowed');
 if(request.method==='POST'&&request.headers.get('origin')!==policy.origin)throw new Error('Identity origin not allowed');
 if(request.method!=='POST')return request;
 if(!(request.headers.get('content-type')??'').toLowerCase().startsWith('application/json'))throw new Error('Identity content type not allowed');
 const length=request.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>32768))throw new Error('Identity body too large');
 if(!request.body)throw new Error('Identity body required');
 const reader=request.body.getReader();const parts=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>32768){await reader.cancel();throw new Error('Identity body too large');}parts.push(value);}}
 finally{reader.releaseLock();}
 const body=Buffer.concat(parts.map(x=>Buffer.from(x)),total);
 return new Request(request.url,{method:request.method,headers:request.headers,body,signal:request.signal});
}
export function unavailableIdentity(){return Response.json({error:'identity_unavailable'},{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
