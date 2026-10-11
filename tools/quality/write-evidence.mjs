import { writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const evidence={
 schema_version:1,kind:'verification_environment',observed_at_utc:new Date().toISOString(),
 checkout_sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 pull_request_head:process.env.PR_HEAD_SHA||null,run_id:process.env.GITHUB_RUN_ID||null,
 job:process.env.GITHUB_JOB||null,node:process.version,platform:process.platform,arch:process.arch,
 locks:Object.fromEntries(['package-lock.json','tools/quality/package-lock.json'].map(p=>[p,createHash('sha256').update(readFileSync(join(root,p))).digest('hex')])),
 note:'Environment and source binding only; does not itself assert a passing test or deployment.'
};
writeFileSync(join(process.env.RUNNER_TEMP||process.cwd(),'quality-environment.json'),JSON.stringify(evidence,null,2)+'\n');
