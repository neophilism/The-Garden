import {readFileSync} from 'node:fs';
const environments=new Set(['local','ci','preview','staging','production']);
export function releaseMetadata(env=process.env){
 let build;
 try{build=JSON.parse(readFileSync(new URL('../../config/build-release.json',import.meta.url),'utf8'));}catch{build={};}
 const sha=build.sha;
 const environment=env.GARDEN_ENV||(env.CI==='true'?'ci':'local');
 if(!environments.has(environment))throw new Error('Unknown deployment environment');
 if((env.RENDER||['staging','production'].includes(environment))&&(!/^[a-f0-9]{40}$/.test(sha??'')||env.RENDER_GIT_COMMIT&&env.RENDER_GIT_COMMIT!==sha))throw new Error('Release source binding unavailable');
 return Object.freeze({project:'The Garden',environment,sha:/^[a-f0-9]{40}$/.test(sha??'')?sha:null});
}
export function liveness(service,env=process.env){
 return {...releaseMetadata(env),service,status:'alive',private_record_access:false};
}
