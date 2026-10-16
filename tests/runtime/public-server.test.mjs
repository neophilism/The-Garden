import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {request} from 'node:http';
import {publicServer} from '../../services/runtime/public-server.mjs';
import {operationalEvent,requestObservation} from '../../services/runtime/telemetry.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'garden-public-'));
 await writeFile(join(root,'index.html'),'<html><script>window.example=true</script><h1>Garden</h1></html>');
 await mkdir(join(root,'history'));await writeFile(join(root,'history/index.html'),'<h1>History</h1>');
 await writeFile(join(root,'.env'),'synthetic-hidden-value');
 await symlink(join(root,'.env'),join(root,'leak.txt'));
 const logs=[];const app=await publicServer({root,release:{sha:'a'.repeat(40),environment:'staging'},write:x=>logs.push(x)});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const origin='http://127.0.0.1:'+app.server.address().port;
 t.after(async()=>{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await rm(root,{recursive:true,force:true});});
 return {app,origin,logs};
}
test('real HTTP export serves pages, script hashes, HEAD and truthful readiness',async t=>{
 const {origin}=await fixture(t);
 for(const path of ['/','/history/','/history']){
  const r=await fetch(origin+path);assert.equal(r.status,200);assert.match(await r.text(),/<h1>/);
  assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');assert.equal(r.headers.get('cache-control'),'no-store');
 }
 const r=await fetch(origin);assert.match(r.headers.get('content-security-policy'),/script-src 'self' 'sha256-/);assert.doesNotMatch(r.headers.get('content-security-policy'),/script-src[^;]*unsafe-inline/);
 const head=await fetch(origin,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const ready=await (await fetch(origin+'/api/ready')).json();assert.equal(ready.dependencies.database,'not_required');assert.equal(ready.status,'ready');
 assert.equal((await (await fetch(origin+'/api/live')).json()).sha,'a'.repeat(40));
});
test('path traversal, symlinks, hidden files, private routes and mutations are rejected',async t=>{
 const {origin}=await fixture(t);
 for(const path of ['/.env','/leak.txt','/api/auth/session','/config/resource-registry.json','/%2e%2e/package.json','//index.html','/history%2findex.html'])assert.equal((await fetch(origin+path)).status,404,path);
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await fetch(origin+'/',{method})).status,405);
 const raw=await new Promise((resolve,reject)=>{request(origin,{path:'/../package.json'},r=>{r.resume();resolve(r.statusCode);}).on('error',reject).end();});
 assert.equal(raw,404);
});
test('query, token, body, header and path canaries never enter operational logs',async t=>{
 const {origin,logs}=await fixture(t);
 const canary='synthetic-sensitive-canary';
 await fetch(origin+'/?query='+canary,{headers:{authorization:'Bearer '+canary,'x-request-id':canary,cookie:canary}});
 await fetch(origin+'/'+canary,{method:'POST',body:canary});
 assert.equal(logs.length,2);assert.ok(!JSON.stringify(logs).includes(canary));
 assert.equal(logs[0].route,'public_page');assert.equal(logs[1].route,'method_denied');
 assert.deepEqual(operationalEvent({event:'dependency_failed',dependency:'database',password:canary,error:new Error(canary)}),{event:'dependency_failed',dependency:'database'});
});
test('one trace id binds the response observation and completion is idempotent',()=>{
 const logs=[];const trace=requestObservation('research',x=>logs.push(x));trace.complete('readiness',503);trace.complete('readiness',200);
 assert.equal(logs.length,1);assert.equal(logs[0].request_id,trace.requestId);assert.equal(logs[0].status,503);
});
test('a missing export refuses startup rather than advertising readiness',async()=>{
 const root=await mkdtemp(join(tmpdir(),'garden-missing-'));
 try{await assert.rejects(publicServer({root,release:{}}),/export is missing/);}finally{await rm(root,{recursive:true,force:true});}
});
