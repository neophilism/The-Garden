import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fixture} from '../../../tests/data/editorial-fixtures.mjs';
const require=createRequire(import.meta.url);
const component=new URL('../../../apps/research/components/StructuredContentPreview.tsx',import.meta.url);
const emitted=ts.transpileModule(readFileSync(component,'utf8'),{fileName:component.pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const compiled=emitted.replace(/from\s+(['"])([^'"]+)\1/g,(_m,_q,spec)=>{
 if(!['react','react/jsx-runtime','../../../packages/domain/src/editorial/content.mjs'].includes(spec))throw Error('Unexpected editorial component import');
 return 'from '+JSON.stringify(spec.startsWith('.')?new URL(spec,component).href:import.meta.resolve(spec));
});
const {StructuredContentPreview}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function markup(x){return '<!doctype html><html lang="en"><head><title>Synthetic editorial fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:1rem/1.6 system-ui;margin:1rem;max-width:65rem;color:#182c23;background:white}a{color:#164f3b}a:focus-visible{outline:3px solid #164f3b;outline-offset:3px}dd{margin-left:1rem}</style></head><body><main>'+renderToStaticMarkup(React.createElement(StructuredContentPreview,x))+'</main></body></html>';}
test('editorial semantics, exact draft and scoped evidence are readable and accessible',async({page},info)=>{
 await page.setContent(markup(fixture()));
 await expect(page.getByRole('heading',{name:'Synthetic editorial page',level:1})).toBeVisible();
 await expect(page.locator('article')).toContainText('Policy advocacy interpretation');
 await expect(page.locator('article')).toContainText('Scoped evidence review recorded');
 await expect(page.locator('article')).toContainText('This draft is not enacted law.');
 await expect(page.getByRole('region',{name:'Draft policy figure'})).toContainText('12.5 percent');
 await expect(page.getByRole('region',{name:'Draft provision II.3'})).toContainText('Synthetic policy draft A');
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Synthetic source citation'})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));
 await info.attach('editorial-axe',{body:JSON.stringify(axe),contentType:'application/json'});expect(axe.violations).toEqual([]);
 await page.screenshot({path:info.outputPath('editorial-preview.png'),fullPage:true});
});
test('malicious prose, citation labels and policy text remain literal text',async({page})=>{
 const x=fixture(),attack='<img src="https://example.org/leak" onerror="window.editorialLeak=1"><script>window.editorialLeak=2</script>';
 x.page.blocks[0].content=[{type:'text',text:attack}];x.bundle.policyVersion.provisions[0].text=attack;x.page.blocks[5].label=attack;
 const requests=[];page.on('request',r=>requests.push(r.url()));await page.setContent(markup(x));
 await expect(page.locator('script,img,iframe,form')).toHaveCount(0);expect(await page.evaluate(()=>window.editorialLeak)).toBeUndefined();expect(requests).toEqual([]);
 expect(await page.locator('article').textContent()).toContain(attack);
});
test('stale scoped evidence is visibly qualified',async({page})=>{
 const x=fixture();x.bundle.reviews[0].currentRevision='3';await page.setContent(markup(x));
 await expect(page.locator('article')).toContainText('Review concerns an earlier revision');
 await expect(page.locator('article')).not.toContainText('Scoped evidence review recorded');
});
