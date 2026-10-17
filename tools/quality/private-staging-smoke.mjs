import {spawn,execFileSync} from 'node:child_process';
import {createServer,connect} from 'node:net';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {STAGING_ACCESS_TOKEN} from '../../services/runtime/private-staging.mjs';
import {verifyPrivateStaging} from '../../services/runtime/private-staging-verification.mjs';

const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const token=randomBytes(32).toString('base64');
const env={PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',GARDEN_ENV:'staging',RENDER:'true',RENDER_GIT_COMMIT:sha,[STAGING_ACCESS_TOKEN]:token};
async function unusedPort(){
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
async function start(surface,overrides={}){
 const port=await unusedPort();
 const child=spawn(process.execPath,['scripts/serve-private-staging.mjs',surface],{env:{...env,PORT:String(port),...overrides},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',x=>{output+=x;});child.stderr.on('data',x=>{output+=x;});
 const closed=once(child,'exit');
 async function stop(expectHealthy=false){
  if(child.exitCode===null&&child.signalCode===null){
   let forced=false;child.kill('SIGTERM');
   const timer=setTimeout(()=>{forced=true;child.kill('SIGKILL');},12000);timer.unref();
   const [code,signal]=await closed;clearTimeout(timer);
   assert.equal(forced,false,'Private staging shutdown required forced termination');
   assert.equal(code,0,'Private staging did not exit cleanly after SIGTERM');assert.equal(signal,null);
  }else if(expectHealthy){assert.equal(child.exitCode,0);assert.equal(child.signalCode,null);}
  assert.ok(!output.includes(token),'Ingress token leaked to process output');
  assert.ok(!output.includes('synthetic-private-canary'),'Configuration canary leaked to process output');
 }
 return {child,closed,stop,origin:'http://127.0.0.1:'+port,port};
}
async function waitForHealth(service){
 for(let n=0;n<100;n++){
  if(service.child.exitCode!==null)throw new Error('Private staging process exited before health');
  try{const r=await fetch(service.origin+'/api/live',{signal:AbortSignal.timeout(1000)});if(r.status===200)return;}catch{}
  await delay(200);
 }
 throw new Error('Private staging startup timeout');
}
async function upgradeAfterWarmup(port){
 return new Promise((resolve,reject)=>{
  const socket=connect(port,'127.0.0.1');let data='';
  socket.setTimeout(3000,()=>socket.destroy(new Error('Upgrade socket remained open')));
  socket.on('connect',()=>socket.write('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'));
  socket.on('data',part=>{data+=part;});socket.on('error',reject);
  socket.on('close',()=>{try{assert.match(data,/HTTP\/1\.1 400/);assert.ok(!data.includes('Researcher'));resolve();}catch(error){reject(error);}});
 });
}
const checks=[];
for(const surface of ['public','research']){
 for(let iteration=0;iteration<2;iteration++){
  const service=await start(surface);
  try{
   await waitForHealth(service);
   const result=await verifyPrivateStaging({origin:service.origin,sha,surface,token,allowLoopback:true});
   await upgradeAfterWarmup(service.port);
   checks.push({surface,restart:iteration===1,checks:result.checks.length,late_upgrade:'denied',graceful_shutdown:true,status:'pass'});
  }finally{await service.stop(true);}
 }
 for(const overrides of [{GARDEN_ENV:''},{GARDEN_ENV:'production'},{[STAGING_ACCESS_TOKEN]:''},{RENDER_GIT_COMMIT:'b'.repeat(40)},{GARDEN_PRODUCTION_RESEARCH_DATABASE_URL:'synthetic-private-canary'},{GARDEN_STAGING_RESEARCH_DATABASE_URL:'synthetic-private-canary'},{ENABLE_RESEARCH:'true'}]){
  const service=await start(surface,overrides);
  try{
   const result=await Promise.race([service.closed,delay(8000,undefined,{ref:false}).then(()=>null)]);
   assert.ok(result,'Unsafe configuration did not exit');assert.notEqual(result[0],0);
   await assert.rejects(fetch(service.origin+'/api/live',{signal:AbortSignal.timeout(1000)}));
   checks.push({surface,startup_canary:Object.keys(overrides)[0],status:'rejected'});
  }finally{await service.stop();}
 }
}
console.log(JSON.stringify({sha,checks,result:'pass',scope:'Local guarded processes, actual build artifacts, restart and fail-closed configuration; no external HTTPS acceptance.'},null,2));
