import test from 'node:test';
import assert from 'node:assert/strict';
import {identityPolicy,boundedAuthRequest} from './policy.mjs';
test('new security endpoints require explicit activation and a non-simple same-origin request',async()=>{
 const p=identityPolicy({environment:'ci',baseURL:'http://127.0.0.1:3101',secret:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',sessionSecurity:true});
 const url=p.origin+'/api/auth/passkey/generate-authenticate-options';
 await assert.rejects(()=>boundedAuthRequest(new Request(url),p));
 assert.equal((await boundedAuthRequest(new Request(url,{headers:{'x-garden-request':'1'}}),p)).url,url);
 await assert.rejects(()=>boundedAuthRequest(new Request(url,{headers:{'x-garden-request':'1',origin:'https://other.invalid'}}),p));
 await assert.rejects(()=>boundedAuthRequest(new Request(url,{headers:{'x-garden-request':'1','sec-fetch-site':'cross-site'}}),p));
 await assert.rejects(()=>boundedAuthRequest(new Request(url+'?context=override',{headers:{'x-garden-request':'1'}}),p));
});
for(const field of ['authenticationMethod','assuranceCredentialId','assuranceVerifiedAt','privilegedAssurance','sessionId','role','banned','emailVerified','createSession'])test('rejects client-owned '+field,async()=>{
 const p=identityPolicy({environment:'ci',baseURL:'http://127.0.0.1:3101',secret:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'});
 await assert.rejects(()=>boundedAuthRequest(new Request(p.origin+'/api/auth/sign-in/email',{method:'POST',headers:{origin:p.origin,'content-type':'application/json'},body:JSON.stringify({email:'test@example.invalid',[field]:true})}),p));
});
test('ambiguous JSON and mutation query overrides are denied',async()=>{
 const p=identityPolicy({environment:'ci',baseURL:'http://127.0.0.1:3101',secret:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'});
 for(const body of ['null','[]','"string"','broken'])await assert.rejects(()=>boundedAuthRequest(new Request(p.origin+'/api/auth/sign-out',{method:'POST',headers:{origin:p.origin,'content-type':'application/json'},body}),p));
 await assert.rejects(()=>boundedAuthRequest(new Request(p.origin+'/api/auth/reset-password?token=other',{method:'POST',headers:{origin:p.origin,'content-type':'application/json'},body:'{}'}),p));
 await assert.rejects(()=>boundedAuthRequest(new Request(p.origin+'/api/auth/sign-out',{method:'POST',headers:{origin:p.origin,'content-type':'application/json-malformed'},body:'{}'}),p));
});
