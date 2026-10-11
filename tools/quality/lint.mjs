import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const errors=[];
function scan(dir){for(const name of readdirSync(join(root,dir))){
 if(['node_modules','.next','out'].includes(name))continue;
 const path=join(dir,name);
 if(statSync(join(root,path)).isDirectory()){scan(path);continue;}
 if(!/\.(?:tsx?|[cm]?js)$/.test(name)||name==='next-env.d.ts')continue;
 const text=readFileSync(join(root,path),'utf8');
 const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 for(const diagnostic of source.parseDiagnostics)errors.push(path+': '+ts.flattenDiagnosticMessageText(diagnostic.messageText,' '));
 function visit(node){
  if(node.kind===ts.SyntaxKind.AnyKeyword)errors.push(path+': explicit any requires a typed boundary');
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='eval')errors.push(path+': eval forbidden');
  if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='Function')errors.push(path+': dynamic Function forbidden');
  if(ts.isJsxAttribute(node)&&node.name.getText(source)==='dangerouslySetInnerHTML')errors.push(path+': unreviewed raw HTML sink');
  if(path.startsWith('apps/public/')&&ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
    const spec=node.moduleSpecifier.text;
    if(/(?:research|workers|node:fs|node:child_process)/.test(spec))errors.push(path+': public/private import boundary');
    if(spec.startsWith('.')&&!resolve(root,dir,spec).startsWith(join(root,'apps/public')+'/'))errors.push(path+': relative import leaves public app');
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
}}
for(const dir of ['apps','packages','services'])scan(dir);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('TypeScript syntax, explicit-any and public-import/sink lint passed (narrow scope).');
