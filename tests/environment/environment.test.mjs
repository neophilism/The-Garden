import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRegistry,resolveConfiguration,authorizeProvisioning,ConfigurationError} from '../../config/environment.ts';
const real=JSON.parse(readFileSync(new URL('../../config/resource-registry.json',import.meta.url),'utf8'));
const fixture=()=>{
 const r=structuredClone(real);r.research_activation_review='synthetic-test-review-not-production';
 r.environments.production.role='garden_research_app';
 r.environments.staging={...r.environments.production,branch_id:'br-test-staging',hosts:['staging.invalid']};return r;
};
const connection=(host=real.environments.production.hosts[0])=>'postgresql://garden_research_app:'+encodeURIComponent('synthetic-test-value')+'@'+host+'/neondb?sslmode=verify-full';
const active=(name='production')=>({GARDEN_ENV:name,ENABLE_RESEARCH:'true',NEON_PROJECT_ID:real.neon_project_id,['GARDEN_'+name.toUpperCase()+'_RESEARCH_DATABASE_URL']:connection(name==='staging'?'staging.invalid':undefined)});
const reject=(fn,code)=>assert.throws(fn,e=>e instanceof ConfigurationError&&(!code||e.code===code));
test('current registry is valid and keeps activation/resources unassigned',()=>{validateRegistry(real);assert.equal(real.research_activation_review,null);assert.deepEqual(real.spending_authorizations,[]);});
test('public local build works without credentials',()=>assert.equal(resolveConfiguration({},real,'public').environment,'local'));
test('CI infers only its isolated environment',()=>assert.equal(resolveConfiguration({CI:'true'},real,'public').environment,'ci'));
test('Render cannot infer production from NODE_ENV or CI',()=>reject(()=>resolveConfiguration({RENDER:'true',CI:'true'},real,'public'),'managed_environment_not_explicit'));
test('Render public preview works with explicit scope and no credentials',()=>assert.equal(resolveConfiguration({RENDER:'true',GARDEN_ENV:'preview'},real,'public').environment,'preview'));
test('unknown environment rejected',()=>reject(()=>resolveConfiguration({GARDEN_ENV:'prod'},real,'public')));
test('secret values cannot enter public build',()=>reject(()=>resolveConfiguration({GARDEN_ENV:'production',GARDEN_PRODUCTION_RESEARCH_DATABASE_URL:connection()},real,'public')));
test('public-prefixed secret rejected',()=>reject(()=>resolveConfiguration({NEXT_PUBLIC_PROVIDER_KEY:'synthetic'},real,'public')));
test('production cannot inherit staging credentials',()=>reject(()=>resolveConfiguration({...active(),GARDEN_STAGING_RESEARCH_DATABASE_URL:connection()},fixture(),'research'),'cross_environment_credential'));
test('staging cannot inherit production credentials',()=>reject(()=>resolveConfiguration({...active('staging'),GARDEN_PRODUCTION_RESEARCH_DATABASE_URL:connection()},fixture(),'research'),'cross_environment_credential'));
test('generic managed secret aliases rejected',()=>reject(()=>resolveConfiguration({...active(),DATABASE_URL:connection()},fixture(),'research'),'unscoped_managed_credential'));
test('disabled researcher service has no credential dependency',()=>assert.equal(resolveConfiguration({GARDEN_ENV:'production'},real,'research').research_enabled,false));
test('credentials cannot be silently ignored in a disabled service',()=>reject(()=>resolveConfiguration({GARDEN_ENV:'production',GARDEN_PRODUCTION_RESEARCH_DATABASE_URL:connection()},real,'research'),'disabled_service_has_credentials'));
test('unreviewed research activation rejected',()=>reject(()=>resolveConfiguration(active(),real,'research'),'research_activation_not_reviewed'));
test('preview researcher activation rejected even with review fixture',()=>reject(()=>resolveConfiguration({GARDEN_ENV:'preview',ENABLE_RESEARCH:'true'},fixture(),'research')));
test('malformed booleans rejected',()=>reject(()=>resolveConfiguration({ENABLE_RESEARCH:'yes'},real,'public'),'invalid_boolean'));
for(const key of ['ENABLE_GOVERNMENT','ENABLE_DONATIONS','ENABLE_ASSISTANT'])test('unauthorized capability '+key,()=>reject(()=>resolveConfiguration({[key]:'true'},real,'public'),'capability_not_authorized'));
test('properly bound synthetic production config returns no credential bytes',()=>{const result=resolveConfiguration(active(),fixture(),'research');assert.equal(result.research_enabled,true);assert.ok(!JSON.stringify(result).includes('synthetic-test-value'));assert.ok(!JSON.stringify(result).includes('postgresql://'));});
test('wrong provider project rejected',()=>reject(()=>resolveConfiguration({...active(),NEON_PROJECT_ID:'another-project'},fixture(),'research'),'project_environment_mismatch'));
for(const [name,uri] of [
 ['host',connection('unrelated.invalid')],
 ['role',connection().replace('garden_research_app','neondb_owner')],
 ['TLS',connection().replace('verify-full','require')],
 ['duplicate TLS',connection()+'&sslmode=disable'],
 ['database',connection().replace('/neondb?','/other?')],
 ['query injection',connection()+'&options=unsafe'],
 ['port',connection().replace('/neondb?',':5433/neondb?')],
 ['URI','not-a-url']
])test('database boundary rejects '+name,()=>reject(()=>resolveConfiguration({...active(),GARDEN_PRODUCTION_RESEARCH_DATABASE_URL:uri},fixture(),'research')));
test('registry cannot assign production branch to staging',()=>{const r=fixture();r.environments.staging.branch_id=r.production_branch_id;reject(()=>validateRegistry(r),'production_branch_reuse');});
test('registry cannot substitute provider project',()=>reject(()=>validateRegistry({...real,neon_project_id:'another'}),'unauthorized_project'));
test('registry cannot omit an environment',()=>{const r=fixture();delete r.environments.preview;reject(()=>validateRegistry(r));});
const request=()=>({provider:'render',parent_id:real.render_project_id,environment:'preview',action:'create',additional_usd:0});
test('inspection is a read-only permission, not provisioning',()=>assert.equal(authorizeProvisioning(real,{...request(),action:'inspect',additional_usd:null}).kind,'read_only'));
test('unconfirmed workspace rejects provisioning',()=>reject(()=>authorizeProvisioning(real,request()),'render_workspace_not_confirmed'));
test('unknown costs rejected before mutation',()=>reject(()=>authorizeProvisioning({...real,render_workspace_confirmed:true},{...request(),additional_usd:null}),'unknown_incremental_cost'));
test('free tier cannot be assumed',()=>reject(()=>authorizeProvisioning({...real,render_workspace_confirmed:true},request()),'free_allowance_not_verified'));
test('unapproved new spending rejected',()=>reject(()=>authorizeProvisioning({...real,render_workspace_confirmed:true},{...request(),additional_usd:7}),'incremental_spend_not_authorized'));
test('wrong project provisioning rejected',()=>reject(()=>authorizeProvisioning(real,{...request(),parent_id:'other'}),'provisioning_parent_mismatch'));
test('unknown existing service cannot be deployed',()=>reject(()=>authorizeProvisioning({...real,render_workspace_confirmed:true},{...request(),action:'deploy_existing',service_id:'srv-test'}),'unverified_existing_service'));
test('expired and insufficient synthetic budgets rejected',()=>{
 const r={...real,render_workspace_confirmed:true,spending_authorizations:[{id:'synthetic',provider:'render',parent_id:real.render_project_id,environment:'preview',actions:['create'],maximum_usd:5,expires_at:'2027-01-01T00:00:00Z',reference:'unit-test-only'}]};
 reject(()=>authorizeProvisioning(r,{...request(),additional_usd:7,authorization_id:'synthetic'},new Date('2026-10-10')));
 reject(()=>authorizeProvisioning(r,{...request(),additional_usd:1,authorization_id:'synthetic'},new Date('2027-02-01')));
});
test('passing synthetic dry run is not a budget reservation',()=>{
 const r={...real,render_workspace_confirmed:true,free_provisioning_evidence:[{provider:'render',environment:'preview',expires_at:'2027-01-01T00:00:00Z',reference:'synthetic-unit-test-only'}]};
 const result=authorizeProvisioning(r,request(),new Date('2026-10-10'));assert.equal(result.kind,'dry_run_only');assert.equal(result.budget_reservation,false);
});
test('error objects do not reveal a rejected secret',()=>{
 try{resolveConfiguration({...active(),GARDEN_PRODUCTION_RESEARCH_DATABASE_URL:'postgresql://sensitive-user:secret-value@unknown.invalid/db'},fixture(),'research');assert.fail('must reject');}
 catch(e){assert.ok(!String(e).includes('secret-value'));assert.ok(!String(e).includes('sensitive-user'));}
});
test('malformed percent encoding is a redacted configuration error',()=>reject(()=>resolveConfiguration({...active(),GARDEN_PRODUCTION_RESEARCH_DATABASE_URL:connection().replace('garden_research_app','%zz')},fixture(),'research'),'database_uri_encoding'));
test('CI cannot be assigned the production branch',()=>{const r=fixture();r.environments.ci.branch_id=r.production_branch_id;reject(()=>validateRegistry(r),'production_branch_reuse');});
test('invalid authorization clock cannot defeat expiry',()=>reject(()=>authorizeProvisioning(real,request(),new Date('bad')),'invalid_authorization_clock'));
test('expired free-tier evidence is not authorization',()=>{const r={...real,render_workspace_confirmed:true,free_provisioning_evidence:[{provider:'render',environment:'preview',reference:'synthetic-only',expires_at:'2026-01-01T00:00:00Z'}]};reject(()=>authorizeProvisioning(r,request(),new Date('2026-10-10')),'free_allowance_not_verified');});
test('budget cannot be reused for another environment or operation',()=>{
 const r={...real,render_workspace_confirmed:true,spending_authorizations:[{id:'synthetic',provider:'render',parent_id:real.render_project_id,environment:'preview',actions:['create'],maximum_usd:5,expires_at:'2027-01-01T00:00:00Z',reference:'test-only'}]};
 for(const change of [{environment:'production'},{action:'resize'}])reject(()=>authorizeProvisioning(r,{...request(),...change,additional_usd:1,authorization_id:'synthetic'},new Date('2026-10-10')),'incremental_spend_not_authorized');
});
test('configuration guard is invoked by both Next configuration modules',async()=>{
 const {existsSync}=await import('node:fs');const root=new URL('../..',import.meta.url);
 for(const app of ['public','research']){
  const url=new URL('apps/'+app+'/next.config.mjs',root);assert.ok(existsSync(url),'Next config exists');
  const text=readFileSync(url,'utf8');
  assert.match(text,/import \{ assertProcessConfiguration \} from '\.\.\/\.\.\/config\/validate-process\.mjs'/);
  assert.ok(text.includes("assertProcessConfiguration('"+app+"')"));
 }
});
