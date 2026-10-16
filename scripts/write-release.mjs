import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const observed=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const declared=process.env.RENDER_GIT_COMMIT||process.env.GITHUB_SHA||observed;
if(!/^[a-f0-9]{40}$/.test(declared)||declared!==observed)throw new Error('Build source mismatch');
writeFileSync(new URL('../config/build-release.json',import.meta.url),JSON.stringify({sha:observed})+'\n');
console.log('Release manifest written for '+observed);
