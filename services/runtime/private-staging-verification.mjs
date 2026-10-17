import {randomBytes} from 'node:crypto';
import {validStagingToken} from './private-staging.mjs';

function fail(code){throw new Error('Private staging verification failed: '+code);}

/** Shared local/external shell check. Never returns response bodies or credentials. */
export async function verifyPrivateStaging({origin,sha,surface,token,allowLoopback=false,fetchImpl=fetch}){
 let url;try{url=new URL(origin);}catch{fail('origin');}
 const loopback=allowLoopback&&url.protocol==='http:'&&url.hostname==='127.0.0.1';
 if((url.protocol!=='https:'&&!loopback)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail('origin');
 if(!/^[a-f0-9]{40}$/.test(sha??'')||!['public','research'].includes(surface)||!validStagingToken(token))fail('inputs');
 const basic='Basic '+Buffer.from('garden:'+token).toString('base64');
 const bearer='Bearer '+token;
 let wrongToken;do{wrongToken=randomBytes(32).toString('base64');}while(wrongToken===token);
 const checks=[];
 async function get(path,status,authorization,method='GET',additionalHeaders={}){
  let response,body;
  try{
   const headers={...additionalHeaders};
   if(authorization)headers.authorization=authorization;
   if(loopback)headers['x-forwarded-proto']='https';
   response=await fetchImpl(new URL(path,url),{method,headers,redirect:'error',signal:AbortSignal.timeout(60000)});
   body=await response.text();
  }catch{fail('request');}
  if(response.status!==status)fail('status');
  const cache=(response.headers.get('cache-control')??'').toLowerCase().split(',').map(x=>x.trim());
  if(!cache.includes('no-store')||!cache.includes('private')||cache.includes('public'))fail('cache');
  if(response.headers.get('set-cookie'))fail('unexpected_cookie');
  if(body.includes(token)||body.includes(basic))fail('credential_disclosure');
  if(status===401&&!/^Basic /i.test(response.headers.get('www-authenticate')??''))fail('challenge');
  checks.push({path,method,authenticated:authorization===basic||authorization===bearer,status:response.status});
  return body;
 }
 function json(body){try{return JSON.parse(body);}catch{fail('json');}}
 const health=json(await get('/api/live',200));
 if(Object.keys(health).sort().join(',')!=='status'||health.status!=='alive')fail('anonymous_health_disclosure');
 for(const path of ['/','/api/ready','/api/health','/api/auth/get-session','/_next/static/guard-probe.js'])await get(path,401);
 await get('/',401,undefined,'GET',{'x-middleware-subrequest':'middleware:middleware:middleware:middleware:middleware'});
 await get('/',401,'Bearer '+wrongToken);
 await get('/api/live',401,'Bearer '+wrongToken);
 const live=json(await get('/api/live',200,bearer));
 if(live.sha!==sha||live.environment!=='staging'||live.service!==surface||live.project!=='The Garden'||live.private_record_access!==false)fail('source_binding');
 const home=await get('/',200,basic);
 if(!home.includes(surface==='public'?'History deserves':'Researcher'))fail('shell');
 await get('/',200,bearer,'HEAD');
 const assets=[...new Set([...home.matchAll(/(?:src|href)="([^"<>]+\.(?:js|css)(?:\?[^"<>]*)?)"/g)].map(x=>x[1]))].slice(0,2);
 if(!assets.length)fail('assets_missing');
 for(const asset of assets){
  const assetUrl=new URL(asset,url);
  if(assetUrl.origin!==url.origin||assetUrl.username||assetUrl.password||assetUrl.hash)fail('asset_origin');
  const path=assetUrl.pathname+assetUrl.search;
  await get(path,401);await get(path,200,bearer);
 }
 const ready=json(await get('/api/ready',surface==='public'?200:503,bearer));
 if(surface==='public'?(ready.status!=='ready'||ready.dependencies?.database!=='not_required'):(ready.status!=='not_ready'||ready.private_record_access!==false||ready.dependencies?.database!=='not_connected'))fail('readiness');
 await get('/api/auth/get-session',404,bearer);
 await get('/config/resource-registry.json',404,bearer);
 await get('/',405,bearer,'POST');
 return {checked_at:new Date().toISOString(),origin:url.origin,sha,surface,checks,result:'pass',scope:loopback?'local guarded shell; external HTTPS unverified':'external HTTPS owner-private shell',limits:'No research activation, corpus import, production acceptance or security certification.'};
}
