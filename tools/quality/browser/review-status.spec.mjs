import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {snapshot} from '../../../tests/review/fixtures.mjs';
import {REVIEW_RULES} from '../../../packages/domain/src/review/states.mjs';
const require=createRequire(import.meta.url);
// Compile the committed component, not a duplicated test implementation. Only
// its three known imports are resolved; no fetched code or user source is run.
const component=new URL('../../../apps/research/components/ReviewStatusPanel.tsx',import.meta.url);
const emitted=ts.transpileModule(readFileSync(component,'utf8'),{fileName:component.pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const compiled=emitted.replace(/from\s+(['"])([^'"]+)\1/g,(_match,_q,spec)=>{
 if(!['react','react/jsx-runtime','../../../packages/domain/src/review/states.mjs'].includes(spec))throw Error('Unexpected review component import');
 const resolved=spec.startsWith('.')?new URL(spec,component).href:import.meta.resolve(spec);
 return 'from '+JSON.stringify(resolved);
});
const {ReviewStatusPanel}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function markup(values){return '<!doctype html><html lang="en"><head><title>Scoped review fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:1rem;line-height:1.6;max-width:60rem}dt{font-weight:700}dd{margin:0 0 1rem}</style></head><body><main><h1>Synthetic review display</h1>'+renderToStaticMarkup(React.createElement(React.Fragment,null,...values.map((s,i)=>React.createElement(ReviewStatusPanel,{key:i,snapshot:s}))))+'</main></body></html>';}
for(const variant of ['partial','stale','permission-withdrawn','ready'])test('scoped review display '+variant+' is not whole-work verification',async({page},info)=>{
 const s=snapshot();if(variant!=='partial')for(const rule of REVIEW_RULES.axes)s.states[rule.id]=rule.passing[0];else s.states.transcription='checked';
 if(variant==='stale')s.currentRevision='3';if(variant==='permission-withdrawn')s.publicUseAllowed=false;
 await page.setContent(markup([s]),{waitUntil:'domcontentloaded'});
 await expect(page.locator('dt')).toHaveCount(7);await expect(page.getByRole('heading',{name:'Review of this record revision'})).toBeVisible();
 await expect(page.locator('main')).toContainText('These findings do not certify the whole collection.');await expect(page.locator('main')).toContainText('No publication has been authorized by this panel.');
 if(variant==='partial'){await expect(page.locator('dl')).toContainText('Scoped check recorded');expect(await page.locator('dd').filter({hasText:'Not assessed'}).count()).toBe(5);}
 if(variant==='stale')await expect(page.locator('main')).toContainText('These reviews concern an earlier revision');
 if(variant==='ready')await expect(page.locator('main')).toContainText('Eligible for a separate release decision.');else await expect(page.locator('main')).toContainText('Not eligible for a release decision.');
 await expect(page.locator('form,button,input,progress,[role="progressbar"]')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
 await info.attach('review-axe',{body:JSON.stringify(axe),contentType:'application/json'});await page.screenshot({path:info.outputPath('review-'+variant+'.png'),fullPage:true});expect(axe.violations).toEqual([]);
});
test('multiple scoped panels have separate accessible heading references',async({page})=>{await page.setContent(markup([snapshot(),snapshot()]));const ids=await page.locator('section').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-labelledby')));expect(new Set(ids).size).toBe(2);for(const id of ids)expect(await page.locator('[id]').evaluateAll((nodes,x)=>nodes.filter(n=>n.id===x).length,id)).toBe(1);});
