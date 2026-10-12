import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const component=new URL('../../../apps/research/components/UploadReceiptPanel.tsx',import.meta.url);
const emitted=ts.transpileModule(readFileSync(component,'utf8'),{fileName:component.pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const compiled=emitted.replace(/from\s+(['"])([^'"]+)\1/g,(_match,_q,spec)=>{
 if(!['react','react/jsx-runtime'].includes(spec))throw Error('Unexpected upload component import');
 return 'from '+JSON.stringify(import.meta.resolve(spec));
});
const {UploadReceiptPanel}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function receipt(state='receiving'){
 const complete=state==='complete-quarantined',purged=state==='purged';
 return {uploadId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',state,expectedBytes:2097152,receivedBytes:purged?0:complete?2097152:1048576,
  receivedChunks:purged?0:complete?2:1,totalChunks:2,bytesVerified:complete,historicalReview:'unreviewed',rights:'unreviewed',publiclyAccessible:false,publicationApproved:false};
}
function markup(r){return '<!doctype html><html lang="en"><head><title>Synthetic upload receipt</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:1rem;line-height:1.6;color:#163627;background:#fff}h1{font-size:1.8rem}</style></head><body><main><h1>Source upload</h1>'+renderToStaticMarkup(React.createElement(UploadReceiptPanel,{receipt:r}))+'</main></body></html>';}
for(const state of ['receiving','paused','complete-quarantined','aborted','expired-retained','purged'])test(`upload receipt ${state} remains a private intake status`,async({page},info)=>{
 await page.setContent(markup(receipt(state)),{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{level:2})).toBeVisible();await expect(page.locator('main')).toContainText('Uploading does not establish historical accuracy or permission to publish.');
 if(state==='complete-quarantined')await expect(page.locator('main')).toContainText('private and awaiting inspection');
 if(state==='purged')await expect(page.getByRole('progressbar')).toHaveCount(0);else await expect(page.getByRole('progressbar',{name:'Upload bytes received'})).toHaveCount(1);
 await expect(page.locator('a,button,input,form')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
 await info.attach('upload-receipt-axe',{body:JSON.stringify(axe),contentType:'application/json'});expect(axe.violations).toEqual([]);
});
test('contradictory and forged upload statuses are refused',()=>{
 for(const patch of [{bytesVerified:true},{historicalReview:'verified'},{publiclyAccessible:true},{receivedBytes:9999999},{state:'published'},{uploadId:'<img onerror=alert(1)>'}])expect(()=>markup({...receipt(),...patch})).toThrow('Invalid upload receipt');
 expect(()=>markup({...receipt('complete-quarantined'),receivedChunks:1})).toThrow('Invalid upload receipt');
});
