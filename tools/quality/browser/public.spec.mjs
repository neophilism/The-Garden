import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require=createRequire(import.meta.url);
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const routes=['/','/how-it-works/','/history/','/research/','/funding/','/legislation/','/questions/','/participate/','/about/'];
async function scan(page){
 // Execute the test instrumentation through the debugger; do not weaken the
 // deployed CSP just to allow an inline accessibility scanner.
 await page.evaluate(axeSource);
 return page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
}
for(const route of routes)test('public route '+route,async({page,context},info)=>{
 const errors=[];const unexpected=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{const u=new URL(r.url());if(!['127.0.0.1','localhost'].includes(u.hostname)&&u.protocol!=='data:')unexpected.push(u.origin);});
 const response=await page.goto(route);
 expect(response.status()).toBe(200);
 await expect(page.locator('h1')).toHaveCount(1);
 await expect(page.locator('main')).toHaveCount(1);
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
 await expect(page.locator('form,input[type="file"]')).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Primary'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 const hrefs=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
 for(const href of hrefs){
  expect(href).not.toContain('chatgpt.com/api/library');
  if(href.startsWith('#'))expect(await page.evaluate(id=>!!document.getElementById(id),href.slice(1))).toBe(true);
  else if(href.startsWith('/'))expect(routes).toContain(href);
 }
 const result=await scan(page);
 await info.attach('axe-'+route.replaceAll('/','_'),{body:JSON.stringify(result,null,2),contentType:'application/json'});
 await page.screenshot({path:info.outputPath('page.png'),fullPage:true});
 expect(result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 expect(errors).toEqual([]);
 expect(unexpected).toEqual([]);
 expect(await context.cookies()).toEqual([]);
});
test('keyboard skip link works and navigation reaches relevant destinations',async({page})=>{
 await page.goto('/');await page.keyboard.press('Tab');
 await expect(page.getByRole('link',{name:'Skip to main content'})).toBeFocused();
 await page.keyboard.press('Enter');await expect(page).toHaveURL(/#main$/);
 await page.getByRole('link',{name:'Understand the proposal'}).click();await expect(page).toHaveURL(/\/how-it-works\/$/);
 await page.getByRole('navigation',{name:'Further information'}).getByRole('link',{name:'Funding & risk'}).click();
 await expect(page.locator('h1')).toContainText('cost-recovery');
 await page.locator('a.sign-in').click();await expect(page).toHaveURL(/\/research\/$/);
 await expect(page.locator('main')).toContainText('No public historical index is live');
});
test('small viewport reflows without hiding primary routes',async({page})=>{
 await page.setViewportSize({width:320,height:640});await page.goto('/funding/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await expect(page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'How it works',exact:true})).toBeVisible();
});
test('accessibility canary detects an unlabeled control',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{const b=document.createElement('button');b.id='synthetic-unlabelled-canary';document.querySelector('main').append(b);});
 const result=await scan(page);
 expect(result.violations.some(v=>v.id==='button-name')).toBe(true);
});
test('research liveness identifies the build without granting access',async({request})=>{
 const response=await request.get('http://127.0.0.1:4174/api/live');
 expect(response.status()).toBe(200);
 const data=await response.json();
 expect(data.sha).toMatch(/^[a-f0-9]{40}$/);expect(data.private_record_access).toBe(false);
 expect(data.status).toBe('alive');expect(data.service).toBe('research');
 expect(response.headers()['cache-control']).toBe('no-store');
 expect(Object.keys(data).sort()).toEqual(['environment','private_record_access','project','service','sha','status']);
});
test('research readiness reports unavailable dependencies without data',async({request})=>{
 const response=await request.get('http://127.0.0.1:4174/api/ready');
 expect(response.status()).toBe(503);
 expect(await response.json()).toEqual({service:'research',status:'not_ready',dependencies:{identity:'not_configured',database:'not_connected',storage:'not_connected'},private_record_access:false});
 expect(response.headers()['cache-control']).toBe('no-store');
});
test('research health fails closed and does not expose credentials',async({request})=>{
 const response=await request.get('http://127.0.0.1:4174/api/health');
 expect(response.status()).toBe(503);
 expect(response.headers()['cache-control']).toContain('no-store');
 const data=await response.json();
 expect(data.private_record_access).toBe(false);expect(data.identity_configured).toBe(false);
 expect(JSON.stringify(data)).not.toMatch(/postgres(?:ql)?:\/\/|password|token|secret/i);
 const unknown=await request.get('http://127.0.0.1:4174/api/upload');expect(unknown.status()).toBe(404);
});

test('disabled research health exposes no account or private record data',async({request})=>{
 const response=await request.get('http://127.0.0.1:4174/api/health');
 expect(response.status()).toBe(503);
 expect(response.headers()['cache-control']).toContain('no-store');
 expect(await response.json()).toEqual({project:'The Garden',service:'research',status:'restricted_not_enabled',private_record_access:false,identity_configured:false});
 for(const route of ['/api/research/ai','/api/research/index','/api/publication/records','/api/research/workspaces/00000000-0000-4000-8000-000000000031/records/00000000-0000-4000-8000-000000000032/export']){
  const absent=await request.get('http://127.0.0.1:4174'+route);expect(absent.status()).toBe(404);
  expect((await absent.text())).not.toContain('PRIVATE-MATRIX-CANARY');
 }
});
