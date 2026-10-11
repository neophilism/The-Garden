/** Same-origin client. No bearer token, name or account ID is put in browser
 * storage or a cross-tab message. Broadcasts request a fresh server read only.
 */
export function createSessionClient({fetcher=globalThis.fetch,credentials=globalThis.navigator?.credentials,credentialType=globalThis.PublicKeyCredential,makeChannel=()=>new BroadcastChannel('garden-research-session')}={}){
 const subscribers=new Set();let disposed=false,channel=null;
 const notify=()=>{if(!disposed)for(const listener of subscribers)listener();};
 try{channel=makeChannel();channel.onmessage=event=>{if(event.data?.kind==='identity-changed')notify();};}catch{channel=null;}
 async function request(path,body,signal){
  if(disposed)throw Error('Account controls are closed.');
  const response=await fetcher('/api/auth'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
   headers:{'x-garden-request':'1',...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw Error(response.status===401||response.status===403?'Sign in or verify your passkey again.':'Account controls are unavailable. Try again without changing your security settings.');
  return response.json();
 }
 function changed(){try{channel?.postMessage({kind:'identity-changed'});}catch{}notify();}
 async function mutate(path,body,signal){const result=await request(path,body,signal);changed();return result;}
 function supportsPasskeys(){return Boolean(credentials?.create&&credentials?.get&&credentialType?.parseCreationOptionsFromJSON&&credentialType?.parseRequestOptionsFromJSON);}
 return Object.freeze({
  supportsPasskeys,
  session:signal=>request('/session/assurance',undefined,signal),
  sessions:signal=>request('/session/list',undefined,signal),
  passkeys:signal=>request('/passkey/list',undefined,signal),
  revoke:(id,signal)=>mutate('/session/revoke',{id},signal),
  revokeAll:signal=>mutate('/session/revoke-all',{},signal),
  signOut:signal=>mutate('/sign-out',{},signal),
  remove:(id,signal)=>mutate('/passkey/remove',{id},signal),
  async enroll(name,signal){
   if(!supportsPasskeys())throw Error('Passkeys are not available in this browser. No weaker verification method has been substituted.');
   const options=await request('/passkey/generate-register-options',undefined,signal);
   const credential=await credentials.create({publicKey:credentialType.parseCreationOptionsFromJSON(options),signal});
   if(!credential||typeof credential.toJSON!=='function')throw Error('Passkey registration was cancelled or is unsupported.');
   return mutate('/passkey/verify-registration',{response:credential.toJSON(),name:String(name||'My passkey').slice(0,80)},signal);
  },
  async stepUp(signal){
   if(!supportsPasskeys())throw Error('Passkeys are not available in this browser. No weaker verification method has been substituted.');
   const options=await request('/passkey/generate-authenticate-options',undefined,signal);
   const credential=await credentials.get({publicKey:credentialType.parseRequestOptionsFromJSON(options),signal});
   if(!credential||typeof credential.toJSON!=='function')throw Error('Passkey verification was cancelled or is unsupported.');
   return mutate('/passkey/verify-authentication',{response:credential.toJSON()},signal);
  },
  subscribe(listener){if(typeof listener!=='function')throw Error('Listener required');subscribers.add(listener);return()=>subscribers.delete(listener);},
  dispose(){if(disposed)return;disposed=true;subscribers.clear();if(channel){channel.onmessage=null;channel.close();}}
 });
}
