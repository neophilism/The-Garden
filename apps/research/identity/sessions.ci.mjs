import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import pg from 'pg';
import {getMigrations} from 'better-auth/db/migration';
import {chromium} from '../../../tools/quality/node_modules/playwright/index.mjs';
import {createResearchIdentity} from './server.mjs';
if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw Error('Refuse security journey outside ephemeral CI');
const base={host:'127.0.0.1',port:5432,database:'neondb',user:'postgres',password:process.env.PGPASSWORD};
const admin=new pg.Pool({...base,max:3});let migration,runtime,locks,app,browser,http;
const mailbox=[],checks=[],record=name=>{checks.push({name,result:'pass'});console.log('CHECK '+checks.length+': '+name);};
// WebAuthn RP IDs are domain names, not IP literals; networking stays loopback.
const origin='http://localhost:3118',secret=randomBytes(48).toString('base64url'),rolePassword=randomBytes(24).toString('hex');
const account={email:'passkey-'+randomBytes(5).toString('hex')+'@example.invalid',password:randomBytes(24).toString('base64url')};
let permit=false,suspended=false;
const cookieHeader=cookies=>cookies.map(c=>c.name+'='+c.value).join('; ');
const nodeRequest=async(path,body,cookie='')=>app.handle(new Request(origin+'/api/auth'+path,{method:body===undefined?'GET':'POST',headers:{origin,'x-garden-request':'1','content-type':'application/json',...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
const view=async(context)=>app.viewer(new Headers({cookie:cookieHeader(await context.cookies())}));
const fetchOn=async(page,path,body)=>page.evaluate(async({path,body})=>{
 const response=await fetch('/api/auth'+path,{method:body===undefined?'GET':'POST',headers:{'x-garden-request':'1',...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});return{status:response.status,body:await response.json()};
},{path,body});
const clientCall=async(page,method,args=[])=>page.evaluate(async({method,args})=>{const {createSessionClient}=await import('/session-client.mjs');const client=createSessionClient();try{return await client[method](...args,AbortSignal.timeout(15000));}finally{client.dispose();}},{method,args});
const authenticate=async(page,patch={})=>page.evaluate(async patch=>{
 const opts=await fetch('/api/auth/passkey/generate-authenticate-options',{headers:{'x-garden-request':'1'},signal:AbortSignal.timeout(15000)}).then(r=>r.json());
 const key=await navigator.credentials.get({publicKey:PublicKeyCredential.parseRequestOptionsFromJSON({...opts,...patch}),signal:AbortSignal.timeout(15000)});return key.toJSON();
},patch);
const addAuthenticator=async(page)=>{const cdp=await page.context().newCDPSession(page);await cdp.send('WebAuthn.enable');const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});return{cdp,id:authenticatorId};};
try{
 await admin.query('CREATE SCHEMA garden_passkey_ci');
 await admin.query(`CREATE ROLE garden_passkey_ci LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${rolePassword}'`);
 migration=new pg.Pool({...base,max:3,options:'-c search_path=garden_passkey_ci'});
 const migrationLocks=new pg.Pool({...base,max:1,options:'-c search_path=garden_passkey_ci'});
 const pending=createResearchIdentity({database:migration,sessionLockDatabase:migrationLocks,secret,baseURL:origin,environment:'ci',deliverMail:async()=>{},isSuspended:async()=>false});
 const schema=await getMigrations(pending.options);assert.equal(schema.unsafeChanges.length,0);await schema.runMigrations();
 await mkdir('identity-evidence',{recursive:true});await writeFile('identity-evidence/session-schema.sql',await schema.compileMigrations());
 assert.equal((await getMigrations(pending.options)).toBeCreated.length,0);await migrationLocks.end();record('additive identity assurance schema and idempotent generation');
 await admin.query('REVOKE ALL ON SCHEMA garden_passkey_ci FROM PUBLIC; GRANT USAGE ON SCHEMA garden_passkey_ci TO garden_passkey_ci; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA garden_passkey_ci TO garden_passkey_ci; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA garden_passkey_ci TO garden_passkey_ci;');
 const config={...base,user:'garden_passkey_ci',password:rolePassword,options:'-c search_path=garden_passkey_ci'};
 runtime=new pg.Pool({...config,max:3});locks=new pg.Pool({...config,max:2});
 app=createResearchIdentity({database:runtime,sessionLockDatabase:locks,secret,baseURL:origin,environment:'ci',deliverMail:async value=>{mailbox.push(value);},isSuspended:async()=>suspended});
 const peer=createResearchIdentity({database:runtime,sessionLockDatabase:locks,secret,baseURL:origin,environment:'ci',deliverMail:async value=>{mailbox.push(value);},isSuspended:async()=>suspended});
 const files=new Map([['/session-client.mjs',new URL('./session-client.mjs',import.meta.url)],['/security-panel.mjs',new URL('./security-panel.mjs',import.meta.url)],['/security-panel.css',new URL('../components/security-panel.css',import.meta.url)]]);
 http=createServer(async(req,res)=>{
  try{
   if(req.headers.host!=='localhost:3118'){res.writeHead(400);res.end();return;}
   if(req.url==='/'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Synthetic Garden security acceptance</title><link rel="stylesheet" href="/security-panel.css"></head><body><main><h1>Research account</h1><section id="security" class="security-panel" aria-label="Account security"></section></main><script type="module">import {mountSecurityPanel} from "/security-panel.mjs";mountSecurityPanel(document.getElementById("security"));</script></body></html>');return;
   }
   if(files.has(req.url)&&req.method==='GET'){res.writeHead(200,{'Content-Type':req.url.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-store'});res.end(await readFile(files.get(req.url)));return;}
   if(!req.url?.startsWith('/api/auth/')){res.writeHead(404);res.end();return;}
   const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
   const response=await app.handle(request);res.writeHead(response.status,{...Object.fromEntries(response.headers.entries()),'set-cookie':response.headers.getSetCookie()});res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Synthetic fixture unavailable');}
 });
 await new Promise(resolve=>http.listen(3118,'127.0.0.1',resolve));
 assert.equal((await nodeRequest('/sign-up/email',{name:'Synthetic researcher',...account})).status,200);
 const verify=mailbox.find(m=>m.kind==='verify-email'&&m.to===account.email);assert.ok(verify);assert.ok((await app.handle(new Request(verify.url,{headers:{origin}}))).status<400);
 browser=await chromium.launch({headless:true});
 const first=await browser.newContext(),second=await browser.newContext();const page=await first.newPage(),other=await second.newPage();await page.goto(origin);await other.goto(origin);
 const device=await addAuthenticator(page);
 assert.equal((await fetchOn(page,'/sign-in/email',account)).status,200);
 const oldCookie=cookieHeader(await first.cookies());let current=await view(first);const userId=current.id;
 assert.equal(current.privilegedAssurance,false);record('password session cannot perform privileged work');
 let basicLifecycleAuthorityCalls=0;
 assert.equal(await app.authorizePrivileged(new Headers({cookie:oldCookie}),'lifecycle.administer',async()=>{basicLifecycleAuthorityCalls++;return true;}),false);
 assert.equal(basicLifecycleAuthorityCalls,0);record('lifecycle review cannot use password-only authority admission');
 await clientCall(page,'enroll',['Primary key']);assert.equal((await view(first)).privilegedAssurance,false);record('user-verified enrollment is not an authentication upgrade');
 await clientCall(page,'stepUp');current=await view(first);assert.equal(current.privilegedAssurance,true);assert.equal(await app.viewer(new Headers({cookie:oldCookie})),null);record('real browser assertion verifies signature and rotates the prior session token');
 assert.equal(await peer.viewer(new Headers({cookie:cookieHeader(await first.cookies())})).then(v=>v.privilegedAssurance),true);record('second identity instance reads live assurance without process-local trust');
 const privilegedHeaders=new Headers({cookie:cookieHeader(await first.cookies())});
 assert.equal(await app.authorizePrivileged(privilegedHeaders,'publication.release',async()=>permit),false);permit=true;
 assert.equal(await app.authorizePrivileged(privilegedHeaders,'publication.release',async()=>permit),true);
 assert.equal(await app.authorizePrivileged(privilegedHeaders,'unregistered-action',async()=>true),false);record('fresh passkey assurance and separate action authority are both required');
 let lifecycleAuthorityCalls=0;
 assert.equal(await app.authorizePrivileged(privilegedHeaders,'lifecycle.administer',async context=>{
  lifecycleAuthorityCalls++;assert.deepEqual(context,{subjectId:userId,sessionId:current.sessionId,action:'lifecycle.administer'});assert.ok(Object.isFrozen(context));return context.action==='consent.administer';
 }),false);
 assert.equal(await app.authorizePrivileged(privilegedHeaders,'lifecycle.administer',async context=>{
  lifecycleAuthorityCalls++;assert.equal(context.action,'lifecycle.administer');return true;
 }),true);
 for(const action of ['lifecycle.submit','lifecycle.status','lifecycle.cancel','lifecycle.erase','lifecycle.export','lifecycle.*'])assert.equal(await app.authorizePrivileged(privilegedHeaders,action,async()=>{lifecycleAuthorityCalls++;return true;}),false);
 assert.equal(lifecycleAuthorityCalls,2);record('lifecycle operator admission requires its own current authority and cannot authorize requester actions or physical erasure');
 let keys=await clientCall(page,'passkeys');const primary=keys.passkeys[0].id;
 assert.equal((await fetchOn(page,'/passkey/remove',{id:primary})).status,403);record('last enrolled passkey cannot be removed');
 assert.equal((await fetchOn(other,'/sign-in/email',account)).status,200);
 assert.equal((await fetchOn(other,'/passkey/generate-register-options')).status,403);record('password login cannot replace an existing factor');
 assert.equal((await fetchOn(other,'/passkey/verify-authentication',{privilegedAssurance:true,response:{}})).status,403);
 assert.equal((await fetchOn(other,'/session/revoke',{id:current.sessionId,role:'administrator'})).status,403);record('client-supplied assurance and role fields fail closed');
 const sessions=await clientCall(page,'sessions');assert.ok(sessions.sessions.length>=2);assert.ok(!JSON.stringify(sessions).match(/token|ipAddress|userAgent|publicKey/));
 const restored=await fetchOn(page,'/get-session');assert.ok(!Object.hasOwn(restored.body.session,'token'));record('session inventory and restoration do not disclose bearer tokens or device tracking');
 const foreign=await nodeRequest('/sign-up/email',{name:'Other synthetic',email:'other-'+randomBytes(5).toString('hex')+'@example.invalid',password:account.password});assert.equal(foreign.status,200);
 const foreignMail=mailbox.filter(m=>m.kind==='verify-email').at(-1);await app.handle(new Request(foreignMail.url,{headers:{origin}}));
 const foreignLogin=await nodeRequest('/sign-in/email',{email:foreignMail.to,password:account.password});const foreignCookie=foreignLogin.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');const foreignViewer=await app.viewer(new Headers({cookie:foreignCookie}));
 assert.equal((await fetchOn(other,'/session/revoke',{id:foreignViewer.sessionId})).status,403);assert.ok(await app.viewer(new Headers({cookie:foreignCookie})));record('session revocation cannot target another identity');
 const tab=await first.newPage();await tab.goto(origin);await tab.getByRole('status').filter({hasText:'Passkey verified'}).waitFor();
 await clientCall(page,'signOut');await tab.getByRole('status').filter({hasText:'Signed out'}).waitFor();assert.equal(await view(first),null);record('logout reaches another real browser tab without broadcasting credentials');
 assert.equal((await fetchOn(page,'/sign-in/email',account)).status,200);
 const proof=await authenticate(page);assert.equal((await fetchOn(page,'/passkey/verify-authentication',{response:proof})).status,200);
 assert.ok((await fetchOn(page,'/passkey/verify-authentication',{response:proof})).status>=400);record('consumed authentication challenge cannot be replayed');
 const badOrigin=await authenticate(page);const clientData=JSON.parse(Buffer.from(badOrigin.response.clientDataJSON,'base64url').toString());clientData.origin='https://attacker.invalid';badOrigin.response.clientDataJSON=Buffer.from(JSON.stringify(clientData)).toString('base64url');
 assert.ok((await fetchOn(page,'/passkey/verify-authentication',{response:badOrigin})).status>=400);record('forged WebAuthn origin and signed client data are rejected');
 const badRP=await authenticate(page);const bytes=Buffer.from(badRP.response.authenticatorData,'base64url');bytes[0]^=1;badRP.response.authenticatorData=bytes.toString('base64url');
 assert.ok((await fetchOn(page,'/passkey/verify-authentication',{response:badRP})).status>=400);record('tampered relying-party hash is rejected');
 current=await view(first);await runtime.query('UPDATE "session" SET "assuranceVerifiedAt"=CURRENT_TIMESTAMP-interval \'6 minutes\' WHERE id=$1',[current.sessionId]);assert.equal((await view(first)).privilegedAssurance,false);
 assert.equal(await app.authorizePrivileged(new Headers({cookie:cookieHeader(await first.cookies())}),'publication.release',async()=>true),false);record('expired assurance never slides with ordinary session activity');
 await device.cdp.send('WebAuthn.setUserVerified',{authenticatorId:device.id,isUserVerified:false});
 const noUV=await authenticate(page,{userVerification:'discouraged'});assert.ok((await fetchOn(page,'/passkey/verify-authentication',{response:noUV})).status>=400);assert.equal((await view(first)).privilegedAssurance,false);record('valid signed possession without user verification cannot upgrade a session');
 await device.cdp.send('WebAuthn.setUserVerified',{authenticatorId:device.id,isUserVerified:true});await clientCall(page,'stepUp');
 await device.cdp.send('WebAuthn.removeVirtualAuthenticator',{authenticatorId:device.id});const replacement=await addAuthenticator(page);
 await clientCall(page,'enroll',['Second key']);keys=await clientCall(page,'passkeys');assert.equal(keys.passkeys.length,2);record('fresh verified factor can authorize enrollment on a second device');
 await clientCall(page,'remove',[primary]);assert.equal(await view(first),null);assert.equal((await view(second)).privilegedAssurance,false);record('removing a factor revokes every session whose assurance depended on it');
 assert.equal((await fetchOn(page,'/sign-in/email',account)).status,200);await clientCall(page,'stepUp');assert.equal((await view(first)).privilegedAssurance,true);
 await nodeRequest('/request-password-reset',{email:account.email,redirectTo:origin+'/reset'});let reset=mailbox.filter(m=>m.kind==='password-reset'&&m.to===account.email).at(-1);const newPassword=randomBytes(24).toString('base64url');
 assert.equal((await nodeRequest('/reset-password',{token:reset.token,newPassword})).status,200);assert.equal(await view(first),null);assert.equal(await view(second),null);
 assert.equal((await runtime.query('SELECT count(*)::integer AS count FROM "passkey" WHERE "userId"=$1',[userId])).rows[0].count,1);record('lost-device password recovery revokes all devices and preserves MFA enrollment');
 account.password=newPassword;assert.equal((await fetchOn(other,'/sign-in/email',account)).status,200);assert.equal((await view(second)).privilegedAssurance,false);assert.equal((await fetchOn(other,'/passkey/generate-register-options')).status,403);record('recovered password session cannot bypass or reset the existing passkey requirement');
 assert.equal((await fetchOn(page,'/sign-in/email',account)).status,200);await clientCall(page,'stepUp');
 let freshHeaders=new Headers({cookie:cookieHeader(await first.cookies())});
 assert.equal(await app.authorizePrivileged(freshHeaders,'consent.administer',async()=>{suspended=true;return true;}),false);suspended=false;record('suspension between authorization checks fails closed');
 await clientCall(other,'revokeAll');assert.equal(await view(first),null);assert.equal(await view(second),null);record('all-device revocation removes sessions across identity instances');
 await nodeRequest('/request-password-reset',{email:account.email,redirectTo:origin+'/reset'});reset=mailbox.filter(m=>m.kind==='password-reset'&&m.to===account.email).at(-1);
 const latestPassword=randomBytes(24).toString('base64url');const [racingLogin,racingReset]=await Promise.all([nodeRequest('/sign-in/email',account),nodeRequest('/reset-password',{token:reset.token,newPassword:latestPassword})]);assert.equal(racingReset.status,200);
 const racingCookie=racingLogin.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.equal(await app.viewer(new Headers({cookie:racingCookie})),null);record('concurrent old-password login and recovery leave no surviving pre-reset session');
 account.password=latestPassword;assert.equal((await fetchOn(page,'/sign-in/email',account)).status,200);await clientCall(page,'stepUp');
 await page.reload();await page.getByRole('status').filter({hasText:'Passkey verified'}).waitFor();
 await page.addScriptTag({path:new URL('../../../tools/quality/node_modules/axe-core/axe.min.js',import.meta.url).pathname});
 const axe=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(axe.violations.map(v=>v.id),[]);record('actual account security panel passes automated WCAG A/AA checks');
 await page.screenshot({path:'identity-evidence/security-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'identity-evidence/security-mobile.png',fullPage:true});record('security controls fit a narrow viewport');
 const locked=await locks.query('SELECT current_user');assert.equal(locked.rows[0].current_user,'garden_passkey_ci');await assert.rejects(()=>locks.query('CREATE TABLE forbidden(id int)'),e=>e.code==='42501');record('identity lock pool has no migration authority');
 await writeFile('identity-evidence/session-results.json',JSON.stringify({tested_sha:process.env.GITHUB_SHA,checks,pass:checks.length,synthetic_only:true,virtual_authenticator:true,physical_device_tested:false,emails_sent_externally:0,production_verified:false},null,2)+'\n');
 console.log('PASS: '+checks.length+' real-browser session, passkey and recovery checks on ephemeral PostgreSQL. No production or physical-device certification.');
 await replacement.cdp.send('WebAuthn.removeVirtualAuthenticator',{authenticatorId:replacement.id});
}finally{
 if(browser)await browser.close();if(http)await new Promise(resolve=>http.close(resolve));if(runtime)await runtime.end();if(locks)await locks.end();if(migration)await migration.end();await admin.end();
}
