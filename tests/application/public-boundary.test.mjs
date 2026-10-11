import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const read=(p)=>readFileSync(join(process.cwd(),p),"utf8");
test("workspace packages and pinned Next/React versions",()=>{
 const root=JSON.parse(read("package.json"));
 const web=JSON.parse(read("apps/public/package.json"));
 const research=JSON.parse(read("apps/research/package.json"));
 assert.equal(root.engines.node,">=24 <25");
 assert.equal(web.dependencies.next,"16.4.0");
 assert.equal(web.dependencies.react,"19.3.0");
 assert.equal(research.dependencies.next,web.dependencies.next);
 assert.deepEqual(new Set(root.workspaces),new Set(["apps/public","apps/research","packages/domain","services/workers"]));
});
test("public output is static and contains no runtime database references",()=>{
 assert.match(read("apps/public/next.config.mjs"),/output: 'export'/);
 for(const name of ["apps/public/app/layout.tsx","apps/public/app/page.tsx","apps/public/app/[section]/page.tsx","packages/domain/src/index.ts"]){
  const src=read(name);
  assert.doesNotMatch(src,/DATABASE_URL|process\.env\.(?!NEXT_PUBLIC)|RESEARCH_DATABASE_URL|GARDEN_.*SECRET|private-data\//);
 }
});
test("routes are constrained to declared stable slugs",()=>{
 const contract=read("packages/domain/src/index.ts");
 for(const slug of ["how-it-works","history","research","funding","legislation","questions","participate","about"]){
  assert.ok(contract.includes('slug:"'+slug+'"'));
 }
 assert.match(read("apps/public/app/[section]/page.tsx"),/dynamicParams = false/);
 assert.match(read("apps/public/app/[section]/page.tsx"),/generateStaticParams/);
});
test("private research shell is disabled and isolated",()=>{
 assert.match(read("apps/research/app/api/health/route.ts"),/status:503/);
 assert.match(read("apps/research/app/page.tsx"),/not enabled/);
 assert.doesNotMatch(read("apps/research/app/page.tsx"),/<form|action=/);
});
test("public funding and status remain accurate",()=>{
 const source=read("packages/domain/src/index.ts");
 assert.match(source,/zero taxpayer cost/);
 assert.match(source,/not assured/);
 assert.match(source,/No public historical index is live/);
 assert.match(source,/No upload, identity verification/);
});
test("preview is nonindexable, no external tracking libraries or user intake",()=>{
 assert.match(read("apps/public/app/robots.ts"),/disallow:"\/"/);
 assert.doesNotMatch(read("apps/public/app/layout.tsx"),/google-analytics|gtag|pixel|posthog|<script|<form/i);
 assert.ok(existsSync("apps/public/app/globals.css"));
});
test("public navigation does not point to private Library records or missing sign-in anchors",()=>{
 assert.doesNotMatch(read("packages/domain/src/index.ts"),/chatgpt\.com\/api\/library/);
 const layout=read("apps/public/app/layout.tsx");
 assert.doesNotMatch(layout,/href="#workspace-notice"/);
 assert.match(layout,/href="\/research\/" aria-label="Researcher access: sign-in not yet available"/);
 assert.match(read("apps/public/app/[section]/page.tsx"),/page.sourceNote/);
});
