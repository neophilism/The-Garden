import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const env={PATH:process.env.PATH,HOME:process.env.HOME,NEXT_TELEMETRY_DISABLED:'1',GARDEN_ENV:'staging',RENDER:'true',RENDER_GIT_COMMIT:sha};
async function start(command,port){
 const child=spawn(process.execPath,command,{env:{...env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
 const closed=once(child,'exit');
 async function stop(){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([closed,delay(12000).then(()=>{if(child.exitCode===null)child.kill('SIGKILL');})]);}}
 try{
  for(let n=0;n<80;n++){
   if(child.exitCode!==null)throw new Error('Process exited before readiness');
   try{const r=await fetch('http://127.0.0.1:'+port+'/api/live',{signal:AbortSignal.timeout(1000)});if(r.ok)return {child,stop,output:()=>output};}catch{}
   await delay(250);
  }
  throw new Error('Startup timeout');
 }catch(error){await stop();throw error;}
}
const checks=[];
for(const [surface,command,port]of [['public',['scripts/serve-public.mjs'],4175],['research',['node_modules/next/dist/bin/next','start','apps/research','--hostname','127.0.0.1'],4176]]){
 for(let iteration=0;iteration<2;iteration++){
  const service=await start(command,port);
  try{
   const origin='http://127.0.0.1:'+port;
   const live=await (await fetch(origin+'/api/live')).json();assert.equal(live.sha,sha);assert.equal(live.environment,'staging');assert.equal(live.private_record_access,false);
   assert.equal((await fetch(origin+'/')).status,200);
   assert.equal((await fetch(origin+'/api/ready')).status,surface==='public'?200:503);
   assert.equal((await fetch(origin+'/api/auth/get-session')).status,404);
   checks.push({surface,restart:iteration===1,sha,status:'pass'});
  }finally{await service.stop();}
 }
}
for(const overrides of [{GARDEN_ENV:''},{RENDER_GIT_COMMIT:'b'.repeat(40)},{GARDEN_PRODUCTION_RESEARCH_DATABASE_URL:'synthetic-wrong-environment-canary'}]){
 const p=spawn(process.execPath,['scripts/serve-public.mjs'],{env:{...env,...overrides},stdio:'pipe'});
 let output='';p.stdout.on('data',x=>output+=x);p.stderr.on('data',x=>output+=x);
 const [code]=await once(p,'exit');assert.notEqual(code,0);assert.ok(!output.includes('synthetic-wrong-environment-canary'));
 checks.push({startup_canary:Object.keys(overrides)[0],status:'rejected'});
}
console.log(JSON.stringify({sha,checks,result:'pass',scope:'local process lifecycle and staging configuration; not external HTTPS'},null,2));
