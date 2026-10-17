import {STAGING_ACCESS_TOKEN} from '../services/runtime/private-staging.mjs';
import {verifyPrivateStaging} from '../services/runtime/private-staging-verification.mjs';
const [origin,sha,surface,...extra]=process.argv.slice(2);
if(extra.length)throw new Error('Expected HTTPS origin, exact source SHA and public/research surface');
const token=process.env[STAGING_ACCESS_TOKEN];delete process.env[STAGING_ACCESS_TOKEN];
try{console.log(JSON.stringify(await verifyPrivateStaging({origin,sha,surface,token}),null,2));}
catch{console.error('Private staging verification failed; no acceptance recorded.');process.exitCode=1;}
