import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPrivateStaging} from '../../services/runtime/private-staging-verification.mjs';
const token=Buffer.alloc(32,23).toString('base64');
const inputs={origin:'https://garden-staging.example.test',sha:'a'.repeat(40),surface:'research',token};
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'cache-control':'private, no-store',...headers}});

test('external verifier never sends a credential to a non-HTTPS or non-origin input',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw new Error('Unexpected request');};
 for(const origin of ['http://example.test','http://127.0.0.1:3000','https://user:secret@example.test','https://example.test/path','https://example.test/?query=1'])await assert.rejects(verifyPrivateStaging({...inputs,origin,fetchImpl}),/origin/);
 await assert.rejects(verifyPrivateStaging({...inputs,origin:'http://example.test',allowLoopback:true,fetchImpl}),/origin/);
 assert.equal(calls,0);
});

test('external verifier rejects source disclosure, missing private cache protection and reflected secrets',async()=>{
 await assert.rejects(verifyPrivateStaging({...inputs,fetchImpl:async()=>response({status:'alive',sha:inputs.sha})}),/anonymous_health_disclosure/);
 await assert.rejects(verifyPrivateStaging({...inputs,fetchImpl:async()=>response({status:'alive'},200,{'cache-control':'public, max-age=60'})}),/cache/);
 await assert.rejects(verifyPrivateStaging({...inputs,fetchImpl:async()=>response({status:'alive',leaked:token})}),error=>error.message.includes('credential_disclosure')&&!error.message.includes(token));
});

test('external verifier rejects an anonymously accessible shell and disallows following redirects',async()=>{
 let calls=0;
 await assert.rejects(verifyPrivateStaging({...inputs,fetchImpl:async(_url,options)=>{
  calls++;assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,undefined);
  return calls===1?response({status:'alive'}):response({page:'exposed'});
 }}),/status/);
 assert.equal(calls,2);
});

test('external verifier binds authorized health to the exact build SHA',async()=>{
 await assert.rejects(verifyPrivateStaging({...inputs,fetchImpl:async(url,options)=>{
  if(url.pathname==='/api/live'&&!options.headers.authorization)return response({status:'alive'});
  if(options.headers.authorization==='Bearer '+token)return response({project:'The Garden',environment:'staging',service:'research',private_record_access:false,sha:'b'.repeat(40)});
  return response({error:'authentication_required'},401,{'www-authenticate':'Basic realm="Private staging"'});
 }}),/source_binding/);
});
