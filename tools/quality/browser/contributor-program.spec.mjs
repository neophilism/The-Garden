import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const file=new URL('../../../apps/research/components/ContributorProgramPanel.tsx',import.meta.url);
const emitted=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file.pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const compiled=emitted.replace(/from\s+(['"])([^'"]+)\1/g,(_m,_q,spec)=>{
 if(!['react','react/jsx-runtime'].includes(spec))throw Error('Unexpected contributor component import');return 'from '+JSON.stringify(import.meta.resolve(spec));
});
const {ContributorProgramPanel}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const program={title:'Synthetic contribution program',responsibleInstitution:'Synthetic institution',version:2,termsDigest:'b'.repeat(64),charter:'Read this exact synthetic charter.\nNo endorsement is required.',permittedPurposes:['research-submission','program-interest'],researchCharter:{version:'1.0',cutoff:'2026-09-25',sha256:'1ada36ab20b492b894091e827f3caab90cc2a1a524fc870674af561ff3d75b5d'},newInterviews:false};
function markup(props){return '<!doctype html><html lang="en"><head><title>Synthetic contributor guidance</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:1rem;line-height:1.6;color:#173229;background:#f7f7f3}main{max-width:760px;margin:auto}a{color:#173229}</style></head><body><main><h1>Contributing to The Garden</h1>'+renderToStaticMarkup(React.createElement(ContributorProgramPanel,props))+'</main></body></html>';}
async function accessible(page,info){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const result=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
 await info.attach('contributor-accessibility',{body:JSON.stringify(result),contentType:'application/json'});expect(result.violations).toEqual([]);
}
test('contributor route explains choices without collecting private data',async({page,request},info)=>{
 const base=process.env.GARDEN_RESEARCH_TEST_URL??'http://127.0.0.1:4174';
 await page.goto(base+'/contribute');await expect(page.getByRole('heading',{name:'Help the research grow.',level:1})).toBeVisible();
 await expect(page.locator('main')).toContainText('No authorized program version has been configured');
 for(const text of ['register interest','official enrollment','endorse the policy','25 September 2026','New interviews need a separate consent process'])await expect(page.locator('main')).toContainText(text);
 await expect(page.locator('form,input,textarea,select,button')).toHaveCount(0);
 const response=await request.post(base+'/api/research/contribution/submit',{data:{workspaceId:id(1)}});expect(response.status()).toBe(404);
 await accessible(page,info);await info.attach('contributor-guidance-page',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.getByRole('link',{name:'Research workspace',exact:true}).click();await expect(page.getByRole('heading',{name:'Researcher access is not enabled.'})).toBeVisible();
});
test('exact terms are readable by keyboard and old acknowledgments do not carry forward',async({page},info)=>{
 await page.setContent(markup({program,activity:{acknowledgmentVersion:1,submissions:[{submissionId:id(1),version:1,state:'pending-review'}],interests:[{interestId:id(2),version:1,state:'withdrawn'}]}}));
 await expect(page.locator('main')).toContainText('Read and acknowledge the current version before any new submission');
 await expect(page.locator('main')).toContainText('private, pending review');await expect(page.locator('main')).toContainText('withdrawn');
 const summary=page.locator('summary');await summary.focus();await page.keyboard.press('Enter');await expect(page.locator('details code')).toBeVisible();
 await expect(page.locator('details')).toContainText(program.termsDigest);await expect(page.locator('input,button,form')).toHaveCount(0);await accessible(page,info);
});
test('authorized current acknowledgment is distinct from content consent and optional interest',async({page})=>{
 await page.setContent(markup({program,activity:{acknowledgmentVersion:2,submissions:[],interests:[]}}));
 await expect(page.locator('main')).toContainText('This acknowledgment is not a consent grant');await expect(page.locator('main')).toContainText('No program interest registrations are shown');
});
test('HTML in charter content remains text and contradictory activity is rejected',async({page})=>{
 await page.setContent(markup({program:{...program,charter:'<img src=x onerror=alert(1)> synthetic text'}}));await expect(page.locator('img')).toHaveCount(0);
 for(const bad of [{...program,newInterviews:true},{...program,researchCharter:{...program.researchCharter,cutoff:'2027-01-01'}},{...program,version:0}])expect(()=>markup({program:bad})).toThrow('Invalid contributor summary');
 expect(()=>markup({program,activity:{acknowledgmentVersion:3,submissions:[],interests:[]}})).toThrow('Invalid contributor activity');
 expect(()=>markup({program,activity:{acknowledgmentVersion:2,submissions:[{submissionId:id(1),version:1,state:'published'}],interests:[]}})).toThrow('Invalid contributor activity');
});
