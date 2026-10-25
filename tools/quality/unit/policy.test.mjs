import test from 'node:test';
import assert from 'node:assert/strict';
import { assertWorkflow, assertLock, assertManifests, credentialFindings } from '../policy.mjs';
const good = () => ({on:{pull_request:null,push:{branches:['main']},merge_group:null},permissions:{contents:'read'},jobs:{test:{'timeout-minutes':20,steps:[{uses:'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',with:{'persist-credentials':false}},{run:'npm run check'}]}}});
test('same read-only policy is valid for fork and same-repository PR events',()=>assert.doesNotThrow(()=>assertWorkflow(good())));
const reusable = () => ({on:{pull_request:null},permissions:{contents:'read'},jobs:{contract:{uses:'neophilism/Development-Deployment-Monitor/.github/workflows/validate-client.yml@429a9203cec131189692bfa7e41124ef5a7a906c'}}});
test('reviewed immutable reusable workflow is valid without unsupported execution fields',()=>assert.doesNotThrow(()=>assertWorkflow(reusable())));
test('reusable workflow rejects a floating ref',()=>{const d=reusable();d.jobs.contract.uses='neophilism/Development-Deployment-Monitor/.github/workflows/validate-client.yml@main';assert.throws(()=>assertWorkflow(d));});
test('reusable workflow rejects caller timeout fields unsupported by GitHub',()=>{const d=reusable();d.jobs.contract['timeout-minutes']=5;assert.throws(()=>assertWorkflow(d));});
for (const [name, mutate] of [
 ['global writes',d=>{d.permissions.contents='write';}],
 ['job writes',d=>{d.jobs.test.permissions={contents:'write'};}],
 ['secret references',d=>{d.jobs.test.env={TOKEN:'${{ secrets.DEPLOY_TOKEN }}'};}],
 ['privileged PR target',d=>{d.on={pull_request_target:null};}],
 ['persisted checkout credentials',d=>{d.jobs.test.steps[0].with['persist-credentials']=true;}],
 ['floating action',d=>{d.jobs.test.steps[0].uses='actions/checkout@v4';}],
 ['suppressed step error',d=>{d.jobs.test.steps[1]['continue-on-error']=true;}],
 ['suppressed shell error',d=>{d.jobs.test.steps[1].run='npm test || true';}],
 ['untrusted shell interpolation',d=>{d.jobs.test.steps[1].run='echo ${{ github.event.pull_request.title }}';}],
 ['unbounded timeout',d=>{delete d.jobs.test['timeout-minutes'];}]
]) test('workflow canary rejects '+name,()=>{const d=good();mutate(d);assert.throws(()=>assertWorkflow(d));});
const lock = () => ({lockfileVersion:3,packages:{'':{},'node_modules/example':{version:'1.0.0',resolved:'https://registry.npmjs.org/example/-/example-1.0.0.tgz',integrity:'sha512-'+Buffer.alloc(64).toString('base64')}}});
test('valid locked package',()=>assert.doesNotThrow(()=>assertLock(lock())));
test('dependency scanner rejects absent integrity',()=>{const d=lock();delete d.packages['node_modules/example'].integrity;assert.throws(()=>assertLock(d));});
test('dependency scanner rejects a substituted registry',()=>{const d=lock();d.packages['node_modules/example'].resolved='https://untrusted.invalid/archive.tgz';assert.throws(()=>assertLock(d));});
test('dependency scanner rejects credential-bearing registry URL',()=>{const d=lock();d.packages['node_modules/example'].resolved='https://user:synthetic@registry.npmjs.org/example.tgz';assert.throws(()=>assertLock(d));});
test('dependency scanner rejects escaping workspace link',()=>{const d=lock();d.packages['node_modules/example']={link:true,resolved:'../../outside'};assert.throws(()=>assertLock(d));});
test('direct dependency ranges cannot silently float',()=>assert.throws(()=>assertManifests({dependencies:{example:'^1.0.0'}})));
test('credential scanner canaries detect synthetic secrets without returning bytes',()=>{
 const values=['postgresql://sample:'+'synthetic-pass@localhost/example','-----BEGIN '+'PRIVATE KEY-----','ghp_'+'a'.repeat(36)];
 for(const v of values){const hits=credentialFindings(v);assert.equal(hits.length,1);assert.ok(!JSON.stringify(hits).includes(v));}
});
test('credential names alone are not secrets',()=>assert.deepEqual(credentialFindings('DATABASE_URL GITHUB_APP_PRIVATE_KEY'),[]));
