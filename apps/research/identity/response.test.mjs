import test from 'node:test';
import assert from 'node:assert/strict';
import {identityResponse} from './response.mjs';
for(const status of [200,204,302,303])test('empty JSON response preserves status '+status,async()=>{
 const r=await identityResponse(new Response(null,{status,headers:{'content-type':'application/json',...(status>=300?{location:'http://localhost:3101/'}:{})}}),'/verify-email');
 assert.equal(r.status,status);assert.equal(await r.text(),'');assert.equal(r.headers.get('cache-control'),'no-store');
 if(status>=300)assert.equal(r.headers.get('location'),'http://localhost:3101/');
});
test('JSON response removes bearer credentials but preserves cookies',async()=>{
 const input=Response.json({token:'secret',session:{token:'secret',id:'s'}},{headers:{'set-cookie':'session=opaque; HttpOnly','content-length':'999'}});
 const result=await identityResponse(input,'/sign-in/email');assert.deepEqual(await result.json(),{session:{id:'s'}});assert.equal(result.headers.get('content-length'),null);assert.match(result.headers.get('set-cookie'),/HttpOnly/);
});
test('passkey options require user verification',async()=>{const r=await identityResponse(Response.json({userVerification:'preferred',challenge:'random'}),'/passkey/generate-authenticate-options');assert.equal((await r.json()).userVerification,'required');});
test('registration response excludes key material',async()=>{const r=await identityResponse(Response.json({id:'k',publicKey:'key-bytes',name:'Key'}),'/passkey/verify-registration');assert.deepEqual(await r.json(),{registered:true,id:'k',name:'Key'});});
test('malformed nonempty JSON fails closed',async()=>{await assert.rejects(()=>identityResponse(new Response('{broken',{headers:{'content-type':'application/json'}}),'/get-session'));});
test('server error exposes no internal payload',async()=>{const r=await identityResponse(Response.json({secret:'internal'},{status:500}),'/sign-in/email');assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'identity_unavailable'});});
test('non-JSON redirect remains a redirect',async()=>{const r=await identityResponse(new Response(null,{status:302,headers:{location:'http://localhost:3101/'}}),'/verify-email');assert.equal(r.status,302);assert.equal(r.headers.get('location'),'http://localhost:3101/');});
