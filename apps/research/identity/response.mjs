import {redactAuthPayload} from './assurance.mjs';
import {unavailableIdentity} from './policy.mjs';
/** Preserve bodyless redirects/no-content responses while redacting structured
 * session data. Better Auth may label a redirect JSON without giving it a body.
 */
export async function identityResponse(original,path){
 if(original.status>=500)return unavailableIdentity();
 const headers=new Headers(original.headers);
 headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');
 if(!(headers.get('content-type')??'').includes('application/json'))return new Response(original.body,{status:original.status,headers});
 const text=await original.text();
 headers.delete('content-length');
 if(text.length===0)return new Response(null,{status:original.status,headers});
 let data=redactAuthPayload(JSON.parse(text));
 if(path==='/passkey/generate-authenticate-options'&&original.ok)data={...data,userVerification:'required'};
 if(path==='/passkey/verify-registration'&&original.ok)data={registered:true,id:data.id,name:data.name??null};
 return new Response(JSON.stringify(data),{status:original.status,headers});
}
