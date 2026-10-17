import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {connect} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publicServer} from '../../services/runtime/public-server.mjs';
import {privateStagingConfiguration,STAGING_ACCESS_TOKEN,validStagingToken,hardenStagingServer} from '../../services/runtime/private-staging.mjs';

// Generated fixture bytes, never an actual credential.
const token=Buffer.from(Array.from({length:32},(_,i)=>i+64)).toString('base64');
const wrongToken=Buffer.alloc(32,17).toString('base64');
const env={GARDEN_ENV:'staging',[STAGING_ACCESS_TOKEN]:token};
const basic='Basic '+Buffer.from('garden:'+token).toString('base64');
const bearer='Bearer '+token;

async function listen(t,server){
 hardenStagingServer(server);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 return 'http://127.0.0.1:'+server.address().port;
}
async function fixture(t,options={}){
 const {access}=privateStagingConfiguration('research',{...env,...options.env});
 const requests=[];
 const server=createServer({maxHeaderSize:16384,requestTimeout:10000,headersTimeout:10000,shouldUpgradeCallback:()=>false},(req,res)=>{
  if(!access(req,res))return;
  requests.push({headers:req.headers,rawHeaders:req.rawHeaders,headersDistinct:req.headersDistinct});
  if(options.handle)return options.handle(req,res);
  res.writeHead(200,{'Content-Type':'text/plain'});res.end('private_page');
 });
 return {server,origin:await listen(t,server),requests};
}
async function raw(origin,path,headers,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=request(origin,{path,headers:['Host',new URL(origin).host,...headers],method},res=>{
   let body='';res.on('data',part=>{body+=part;});res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));
  });req.on('error',reject);req.end();
 });
}

test('staging ingress requires a canonical 256-bit token and refuses other environments',()=>{
 assert.ok(validStagingToken(token));assert.ok(validStagingToken(Buffer.alloc(32,255).toString('base64url')));
 for(const value of [undefined,'short',token+' ',token.slice(1),token.replace(/=$/,'=='),'!'.repeat(44)])assert.equal(validStagingToken(value),false);
 for(const overrides of [{GARDEN_ENV:undefined},{GARDEN_ENV:'production'},{GARDEN_ENV:'preview'},{[STAGING_ACCESS_TOKEN]:''},{ENABLE_RESEARCH:'true'}]){
  assert.throws(()=>privateStagingConfiguration('public',{...env,...overrides}),error=>!error.message.includes(token));
 }
 assert.throws(()=>privateStagingConfiguration('worker',env),/surface/);
});

test('only the ingress token leaves the application environment; other credential guards remain enforced',()=>{
 const {applicationEnv}=privateStagingConfiguration('public',{...env,FEATURE_LABEL:'preserved'});
 assert.equal(applicationEnv[STAGING_ACCESS_TOKEN],undefined);assert.equal(applicationEnv.FEATURE_LABEL,'preserved');
 assert.equal(env[STAGING_ACCESS_TOKEN],token);
 for(const surface of ['public','research'])for(const name of ['GARDEN_PRODUCTION_RESEARCH_DATABASE_URL','GARDEN_STAGING_RESEARCH_DATABASE_URL','UNSCOPED_API_KEY','NEXT_PUBLIC_PRIVATE_SECRET']){
  assert.throws(()=>privateStagingConfiguration(surface,{...env,[name]:'synthetic-private-canary'}),error=>!error.message.includes('synthetic-private-canary'));
 }
});

test('anonymous pages, assets, aliases, query tokens and malformed paths never reach an application',async t=>{
 const {origin,requests}=await fixture(t);
 for(const path of ['/','/history/','/_next/static/chunk.js','/api/ready','/api/health','/api/live?token='+token,'/%61pi/live','//api/live','/api/auth/get-session','/.env']){
  const r=await fetch(origin+path);assert.equal(r.status,401,path);assert.equal(await r.text(),'{"error":"authentication_required"}');
  assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('www-authenticate'),/^Basic /);
 }
 assert.equal(requests.length,0);
 const live=await fetch(origin+'/api/live');assert.deepEqual(await live.json(),{status:'alive'});
 const head=await fetch(origin+'/api/live',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.equal((await fetch(origin+'/api/live',{method:'POST'})).status,401);
});

test('Basic and Bearer permit only the owner; no alternate identity or cookie is accepted',async t=>{
 const {origin}=await fixture(t);
 for(const authorization of [basic,bearer]){
  const r=await fetch(origin+'/',{headers:{authorization}});assert.equal(r.status,200);assert.equal(await r.text(),'private_page');
 }
 for(const authorization of ['Bearer '+wrongToken,'Bearer '+token+', '+token,'Basic '+Buffer.from('other:'+token).toString('base64'),'Basic '+Buffer.from('garden:'+wrongToken).toString('base64'),basic+'=','Bearer short']){
  assert.equal((await fetch(origin+'/',{headers:{authorization}})).status,401,authorization.slice(0,6));
 }
 assert.equal((await fetch(origin+'/',{headers:{cookie:'preview='+token}})).status,401);
 assert.equal((await raw(origin,'/',['Authorization',bearer,'Authorization',bearer])).status,401);
 assert.equal((await raw(origin,'/api/live',['Authorization',''])).status,401);
});

test('the app receives no ingress Authorization through normalized, raw or distinct headers',async t=>{
 const {origin,requests}=await fixture(t);
 await fetch(origin+'/',{headers:{authorization:basic,'proxy-authorization':bearer}});
 assert.equal(requests.length,1);assert.ok(!JSON.stringify(requests).includes(token));assert.ok(!JSON.stringify(requests).includes(basic));
 assert.equal(requests[0].headers.authorization,undefined);assert.equal(requests[0].headersDistinct.authorization,undefined);
});

test('managed requests need verified HTTPS forwarding and all shell mutation methods remain denied',async t=>{
 const {origin,requests}=await fixture(t,{env:{RENDER:'true'}});
 for(const forwarded of [undefined,'http','https, http','HTTPS']){
  const headers={authorization:bearer};if(forwarded)headers['x-forwarded-proto']=forwarded;
  assert.equal((await fetch(origin+'/',{headers})).status,403);
 }
 const headers={authorization:bearer,'x-forwarded-proto':'https'};
 assert.equal((await fetch(origin+'/',{headers})).status,200);
 assert.equal((await fetch(origin+'/',{method:'HEAD',headers})).status,200);
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
  const r=await fetch(origin+'/',{method,headers});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');
 }
 assert.equal(requests.length,2);
});

test('a framework cannot turn private HTML or assets into a shared-cache response',async t=>{
 for(const mode of ['implicit','object','array','message']){
  const {origin}=await fixture(t,{handle:(_req,res)=>{
   res.setHeader('Cache-Control','public, max-age=31536000');res.setHeader('Vary','RSC');
   if(mode==='object')res.writeHead(200,{'Cache-Control':'public','Vary':'Next-Router-State-Tree'});
   if(mode==='array')res.writeHead(200,['CACHE-CONTROL','public','VARY','Accept-Encoding']);
   if(mode==='message')res.writeHead(200,'OK',{'Cache-Control':'public'});
   res.end('private_asset');
  }});
  const r=await fetch(origin+'/',{headers:{authorization:bearer}});assert.equal(r.status,200);
  assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/Authorization/);
  assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
 }
});

test('the real public export is guarded including health metadata and request logs remain secret-free',async t=>{
 const root=await mkdtemp(join(tmpdir(),'garden-private-public-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'index.html'),'<h1>Private shell fixture</h1>');
 await writeFile(join(root,'asset.js'),'window.synthetic=true');
 const logs=[];const {access}=privateStagingConfiguration('public',env);
 const app=await publicServer({root,release:{sha:'a'.repeat(40),environment:'staging'},access,write:value=>logs.push(value)});
 const origin=await listen(t,app.server);
 assert.equal((await fetch(origin+'/')).status,401);assert.equal((await fetch(origin+'/asset.js')).status,401);
 const headers={authorization:basic};assert.equal((await fetch(origin+'/',{headers})).status,200);
 const live=await (await fetch(origin+'/api/live',{headers})).json();assert.equal(live.sha,'a'.repeat(40));assert.equal(live.private_record_access,false);
 assert.equal((await fetch(origin+'/api/auth/get-session',{headers})).status,404);
 assert.equal((await fetch(origin+'/asset.js',{headers})).headers.get('cache-control'),'private, no-store');
 assert.ok(!JSON.stringify(logs).includes(token));assert.ok(!JSON.stringify(logs).includes(basic));
});

test('HTTP upgrade, CONNECT and Expect cannot open an unguarded route, including late framework listeners',async t=>{
 const {origin,requests,server}=await fixture(t);let lateUpgradeCalls=0;
 server.on('upgrade',()=>{lateUpgradeCalls++;});
 const url=new URL(origin);
 for(const start of ['GET / HTTP/1.1\r\nUpgrade: websocket\r\nConnection: Upgrade','CONNECT example.test:443 HTTP/1.1']){
  const received=await new Promise((resolve,reject)=>{
   const socket=connect(Number(url.port),url.hostname);let data='';socket.setTimeout(3000,()=>socket.destroy(new Error('Socket did not close')));
   socket.on('data',part=>{data+=part;});socket.on('error',reject);socket.on('close',()=>resolve(data));
   socket.on('connect',()=>socket.write(start+'\r\nHost: localhost\r\nAuthorization: '+bearer+'\r\n\r\n'));
  });
  if(start.startsWith('CONNECT'))assert.equal(received,'');else assert.match(received,/HTTP\/1\.1 400/);
 }
 const expected=await raw(origin,'/',['Expect','100-continue','Content-Length','0'],'POST');assert.equal(expected.status,401);
 assert.equal(requests.length,0);
 assert.equal(lateUpgradeCalls,0);
});
