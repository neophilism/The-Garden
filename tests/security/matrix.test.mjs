import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMatrix,matrixCases,recordVisible,SURFACES} from './policy-matrix/model.mjs';
const registry=JSON.parse(readFileSync(new URL('./policy-matrix/registry.json',import.meta.url)));
test('matrix covers each explicit researcher role, class, state and grant exactly once',()=>{
 const cases=matrixCases(registry);
 assert.equal(cases.length,11*6*3*3);
 assert.equal(new Set(cases.map(r=>[r.role,r.classification,r.state,r.grant].join('/'))).size,cases.length);
 assert.equal(cases.filter(r=>r.visible).length,11);
});
for(const axis of ['roles','classifications','states','grants'])test('missing '+axis+' entry fails the matrix gate',()=>{
 const bad=structuredClone(registry);bad[axis].pop();assert.throws(()=>validateMatrix(bad));
});
for(const surface of SURFACES)test('surface cannot silently lose policy tests: '+surface,()=>{
 const bad=structuredClone(registry);delete bad.surfaces[surface];assert.throws(()=>validateMatrix(bad));
});
for(const surface of ['ai','index','public-projection'])test(surface+' remains explicitly unavailable rather than falsely implemented',()=>{
 const bad=structuredClone(registry);bad.surfaces[surface]='implemented-unmounted';assert.throws(()=>validateMatrix(bad));
});
for(const memberActive of [false,true])for(const consent of [false,true])test('membership and purpose consent are independent '+memberActive+'/'+consent,()=>{
 assert.equal(recordVisible({classification:'research',state:'active',grant:'current',memberActive,consent}),memberActive&&consent);
});
test('unknown and truthy-string matrix coordinates fail closed',()=>{
 for(const patch of [{classification:'public'},{state:'published'},{grant:'all'},{consent:'true'},{memberActive:1}])assert.throws(()=>recordVisible({classification:'research',state:'active',grant:'current',...patch}));
});
