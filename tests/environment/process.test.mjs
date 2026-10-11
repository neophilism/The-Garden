import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../..',import.meta.url));
function run(surface,env={}){
 const flags=Number(process.versions.node.split('.')[0])<24?['--experimental-strip-types']:[];
 return spawnSync(process.execPath,[...flags,'scripts/check-environment.mjs',surface],{cwd,env:{PATH:process.env.PATH,...env},encoding:'utf8',timeout:10000});
}
test('CLI public build succeeds without any private environment',()=>{const r=run('public');assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{environment:'local',surface:'public',research_enabled:false});});
test('CLI rejects environment mixing without returning secret bytes',()=>{
 const marker='synthetic-should-never-appear-in-error';const r=run('research',{GARDEN_ENV:'production',GARDEN_PREVIEW_RESEARCH_DATABASE_URL:marker});
 assert.equal(r.status,1);assert.match(r.stderr,/cross_environment_credential/);assert.ok(!(r.stdout+r.stderr).includes(marker));
});
test('CLI rejects unassigned Render deployment environment',()=>{const r=run('public',{RENDER:'true',CI:'true'});assert.equal(r.status,1);assert.match(r.stderr,/managed_environment_not_explicit/);});
test('CLI rejects invalid command with a fixed error',()=>{const r=run('unknown');assert.equal(r.status,1);assert.match(r.stderr,/invalid_cli_usage/);});
