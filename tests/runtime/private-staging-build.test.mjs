import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,delimiter} from 'node:path';
import {STAGING_ACCESS_TOKEN} from '../../services/runtime/private-staging.mjs';

test('the deployment build launcher strips its token from both install and build children',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'garden-build-env-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const trace=join(directory,'trace.jsonl');
 const program=`#!${process.execPath}\nconst fs=require('node:fs');if(process.env.GARDEN_STAGING_PREVIEW_ACCESS_TOKEN!==undefined)process.exit(21);fs.appendFileSync(process.env.GARDEN_BUILD_TEST_TRACE,JSON.stringify({args:process.argv.slice(2),environment:process.env.GARDEN_ENV})+'\\n');`;
 await writeFile(join(directory,'npm'),program,{mode:0o700});
 const token=Buffer.alloc(32,19).toString('base64');
 const env={PATH:directory+delimiter+process.env.PATH,GARDEN_ENV:'staging',[STAGING_ACCESS_TOKEN]:token,GARDEN_BUILD_TEST_TRACE:trace};
 for(const surface of ['public','research']){
  const result=spawnSync(process.execPath,['scripts/build-private-staging.mjs',surface],{env,encoding:'utf8'});
  assert.equal(result.status,0);assert.ok(!((result.stdout??'')+(result.stderr??'')).includes(token));
 }
 const calls=(await readFile(trace,'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(calls.length,4);assert.deepEqual(calls.map(x=>x.args[0]),['ci','run','ci','run']);
 assert.deepEqual(calls.filter(x=>x.args[0]==='run').map(x=>x.args[1]),['build:public','build:research']);
 assert.ok(calls.every(x=>x.environment==='staging'));
 const before=await readFile(trace,'utf8');
 const rejected=spawnSync(process.execPath,['scripts/build-private-staging.mjs','public'],{env:{...env,GARDEN_STAGING_RESEARCH_DATABASE_URL:'synthetic-private-canary'},encoding:'utf8'});
 assert.notEqual(rejected.status,0);assert.equal(await readFile(trace,'utf8'),before);
 assert.ok(!rejected.stderr.includes('synthetic-private-canary'));
});
