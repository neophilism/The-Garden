import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {privateStagingConfiguration,STAGING_ACCESS_TOKEN} from '../services/runtime/private-staging.mjs';

const [surface,...extra]=process.argv.slice(2);
if(extra.length)throw new Error('Expected public or research surface');
const {applicationEnv}=privateStagingConfiguration(surface);
delete process.env[STAGING_ACCESS_TOKEN];
const cwd=fileURLToPath(new URL('..',import.meta.url));
for(const args of [['ci','--include=dev','--ignore-scripts','--no-audit','--no-fund'],['run','build:'+surface]]){
 const result=spawnSync('npm',args,{cwd,env:applicationEnv,stdio:'inherit'});
 if(result.error||result.status!==0){process.exitCode=result.status||1;break;}
}
