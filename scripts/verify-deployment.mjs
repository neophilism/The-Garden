/** Read-only external smoke. Supply a public HTTPS origin and the exact expected SHA. */
const [origin,sha,surface='public']=process.argv.slice(2);
const url=new URL(origin);
if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!['public','research'].includes(surface)||!/^[a-f0-9]{40}$/.test(sha??''))throw new Error('Expected HTTPS origin, exact source SHA and public/research surface');
const checks=[];
async function get(path,status){
 const response=await fetch(new URL(path,url),{redirect:'error',signal:AbortSignal.timeout(60000)});
 if(response.status!==status)throw new Error('Unexpected status for '+path);
 checks.push({path,status:response.status});return response;
}
const live=await (await get('/api/live',200)).json();
if(live.sha!==sha||live.environment!=='staging'||live.service!==surface||live.private_record_access!==false)throw new Error('Live deployment identity mismatch');
const home=await get('/',200);if(!(await home.text()).includes(surface==='public'?'History deserves':'Researcher'))throw new Error('User-facing shell is missing');
await get('/api/ready',surface==='public'?200:503);
await get('/api/auth/get-session',404);
if(surface==='public'){
 await get('/history/',200);await get('/funding/',200);
 const hidden=await get('/config/resource-registry.json',404);if(hidden.headers.get('set-cookie'))throw new Error('Public endpoint sets a cookie');
}
console.log(JSON.stringify({checked_at:new Date().toISOString(),origin:url.origin,sha,surface,checks,result:'pass',limits:'Shell deployment only; no claim of active private research, corpus publication or production acceptance.'},null,2));
