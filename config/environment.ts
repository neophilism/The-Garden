/** Server/build-only configuration. Never import into public browser code. */
export const ENVIRONMENTS = ['local','ci','preview','staging','production'] as const;
export type GardenEnvironment = typeof ENVIRONMENTS[number];
export type Surface = 'public' | 'research';
export type EnvironmentValues = Record<string,string|undefined>;
type Binding = {branch_id:string|null;database:string|null;role:string|null;hosts:string[];render_service_id:string|null};
type MutationAction = 'deploy_existing'|'create'|'resize';
type SpendApproval = {id:string;provider:'render'|'neon';parent_id:string;environment:GardenEnvironment;actions:MutationAction[];maximum_usd:number;expires_at:string;reference:string};
export type ResourceRegistry = {
 schema_version:1;repository:string;authorization_reference:string;render_project_id:string;render_workspace_id:string;
 render_workspace_confirmed:boolean;neon_project_id:string;production_branch_id:string;research_activation_review:string|null;
 environments:Record<GardenEnvironment,Binding>;spending_authorizations:SpendApproval[];
 free_provisioning_evidence:{provider:'render'|'neon';environment:GardenEnvironment;expires_at:string;reference:string}[];
};
export class ConfigurationError extends Error {
 readonly code:string;
 constructor(code:string){super('Garden configuration rejected: '+code);this.name='ConfigurationError';this.code=code;}
}
function reject(code:string):never{throw new ConfigurationError(code);}
const nonempty=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0;
const object=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const credentialName=(name:string)=>/(?:DATABASE_URL|API_KEY|ACCESS_KEY|ACCESS_KEY_ID|PROVIDER_KEY|PRIVATE_KEY|SIGNING_KEY|PASSWORD|SECRET|TOKEN)$/.test(name);
const nullableString=(x:unknown)=>x===null||nonempty(x);

export function validateRegistry(value:unknown):asserts value is ResourceRegistry {
 if(!object(value)||value.schema_version!==1||value.repository!=='neophilism/The-Garden')reject('registry_identity');
 if(value.render_project_id!=='prj-db57f92jnfac739ghic0'||value.neon_project_id!=='royal-union-78374030'||value.production_branch_id!=='br-curly-band-b5aatp1e')reject('unauthorized_project');
 if(value.render_workspace_id!=='tea-db23jkks728c73av263g'||typeof value.render_workspace_confirmed!=='boolean'||!nonempty(value.authorization_reference)||!nullableString(value.research_activation_review))reject('registry_authority');
 if(!object(value.environments)||Object.keys(value.environments).sort().join(',')!==[...ENVIRONMENTS].sort().join(','))reject('environment_inventory');
 for(const name of ENVIRONMENTS){
  const b=value.environments[name];
  if(!object(b)||!nullableString(b.branch_id)||!nullableString(b.database)||!nullableString(b.role)||!nullableString(b.render_service_id)||!Array.isArray(b.hosts)||!b.hosts.every(nonempty))reject('invalid_binding');
  if(name!=='production'&&b.branch_id===value.production_branch_id)reject('production_branch_reuse');
 }
 if(!Array.isArray(value.spending_authorizations)||!Array.isArray(value.free_provisioning_evidence))reject('authorization_inventory');
 for(const a of value.spending_authorizations){
  if(!object(a)||!nonempty(a.id)||!['render','neon'].includes(String(a.provider))||!nonempty(a.parent_id)||!ENVIRONMENTS.includes(a.environment as GardenEnvironment)||!Array.isArray(a.actions)||!a.actions.length||a.actions.some(x=>!['create','resize','deploy_existing'].includes(String(x)))||typeof a.maximum_usd!=='number'||!Number.isFinite(a.maximum_usd)||a.maximum_usd<0||!nonempty(a.reference)||!nonempty(a.expires_at)||!Number.isFinite(Date.parse(a.expires_at)))reject('invalid_spending_authorization');
 }
 for(const f of value.free_provisioning_evidence){
  if(!object(f)||!['render','neon'].includes(String(f.provider))||!ENVIRONMENTS.includes(f.environment as GardenEnvironment)||!nonempty(f.reference)||!nonempty(f.expires_at)||!Number.isFinite(Date.parse(f.expires_at)))reject('invalid_free_allowance_evidence');
 }
 if(new Set(value.spending_authorizations.map(a=>a.id)).size!==value.spending_authorizations.length)reject('duplicate_spending_authorization');
}
function flag(env:EnvironmentValues,name:string):boolean {
 const value=env[name];if(value===undefined||value===''||value==='false')return false;
 if(value==='true')return true;return reject('invalid_boolean');
}
function environment(env:EnvironmentValues):GardenEnvironment {
 const value=env.GARDEN_ENV;
 if(!value&&env.RENDER)reject('managed_environment_not_explicit');
 if(!value)return env.CI==='true'?'ci':'local';
 if(!ENVIRONMENTS.includes(value as GardenEnvironment))reject('unknown_environment');
 return value as GardenEnvironment;
}
function validateConnection(raw:string,b:Binding,name:GardenEnvironment):void {
 let uri:URL;try{uri=new URL(raw);}catch{return reject('invalid_database_uri');}
 if(!['postgres:','postgresql:'].includes(uri.protocol)||uri.hash||(uri.port&&uri.port!=='5432'))reject('database_uri_shape');
 if(!b.hosts.includes(uri.hostname))reject('database_host_binding');
 if(name==='local'||name==='ci'){
  if(!['localhost','127.0.0.1','[::1]'].includes(uri.hostname))reject('test_database_not_loopback');
  return;
 }
 if(!b.branch_id||!b.database||!b.role)reject('incomplete_database_binding');
 let path:string,user:string;
 try{path=decodeURIComponent(uri.pathname);user=decodeURIComponent(uri.username);decodeURIComponent(uri.password);}catch{return reject('database_uri_encoding');}
 if(path!=='/'+b.database||user!==b.role||!uri.password)reject('database_role_binding');
 const keys=[...uri.searchParams.keys()];
 if(new Set(keys).size!==keys.length||keys.some(k=>!['sslmode','channel_binding'].includes(k))||uri.searchParams.get('sslmode')!=='verify-full')reject('database_tls_policy');
 if(uri.searchParams.has('channel_binding')&&uri.searchParams.get('channel_binding')!=='require')reject('database_channel_binding');
}

export function resolveConfiguration(env:EnvironmentValues,registry:unknown,surface:Surface){
 validateRegistry(registry);
 if(!['public','research'].includes(surface))reject('unknown_surface');
 const name=environment(env);
 const ownPrefix='GARDEN_'+name.toUpperCase()+'_';
 const populatedCredentials=Object.keys(env).filter(k=>credentialName(k)&&nonempty(env[k]));
 for(const key of populatedCredentials){
  if(/^GARDEN_(?:LOCAL|CI|PREVIEW|STAGING|PRODUCTION)_/.test(key)&&!key.startsWith(ownPrefix))reject('cross_environment_credential');
  if(['staging','production'].includes(name)&&!key.startsWith(ownPrefix))reject('unscoped_managed_credential');
 }
 for(const f of ['ENABLE_ASSISTANT','ENABLE_DONATIONS','ENABLE_GOVERNMENT'])if(flag(env,f))reject('capability_not_authorized');
 if(Object.keys(env).some(k=>k.startsWith('NEXT_PUBLIC_')&&credentialName(k)&&nonempty(env[k])))reject('browser_secret');
 const enabled=flag(env,'ENABLE_RESEARCH');
 if(surface==='public'){
  if(populatedCredentials.length||enabled)reject('public_build_has_private_configuration');
 }else if(!enabled){
  if(populatedCredentials.length)reject('disabled_service_has_credentials');
 }else{
  if(name==='preview'||!registry.research_activation_review)reject('research_activation_not_reviewed');
  const raw=env[ownPrefix+'RESEARCH_DATABASE_URL'];if(!nonempty(raw))reject('missing_environment_credential');
  validateConnection(raw,registry.environments[name],name);
  if(name==='production'&&registry.environments.production.branch_id!==registry.production_branch_id)reject('production_branch_binding');
  if(['staging','production'].includes(name)&&env.NEON_PROJECT_ID!==registry.neon_project_id)reject('project_environment_mismatch');
 }
 // Return only safe metadata. Credential values never become an enumerable config object.
 return Object.freeze({environment:name,surface,research_enabled:enabled,neon_project_id:registry.neon_project_id,render_project_id:registry.render_project_id,database_binding:enabled?Object.freeze({...registry.environments[name],hosts:[...registry.environments[name].hosts]}):null});
}

export type ProvisioningRequest={provider:'render'|'neon';parent_id:string;environment:GardenEnvironment;action:'inspect'|'deploy_existing'|'create'|'resize';additional_usd:number|null;authorization_id?:string;service_id?:string};
export function authorizeProvisioning(registry:unknown,request:ProvisioningRequest,now=new Date()){
 validateRegistry(registry);
 if(!Number.isFinite(now.getTime()))reject('invalid_authorization_clock');
 if(!request||!['render','neon'].includes(request.provider)||!ENVIRONMENTS.includes(request.environment)||!['inspect','deploy_existing','create','resize'].includes(request.action))reject('unknown_provisioning_request');
 if(request.parent_id!==(request.provider==='render'?registry.render_project_id:registry.neon_project_id))reject('provisioning_parent_mismatch');
 if(request.action==='inspect')return {allowed:true,kind:'read_only'} as const;
 if(request.provider==='render'&&!registry.render_workspace_confirmed)reject('render_workspace_not_confirmed');
 if(request.additional_usd===null||typeof request.additional_usd!=='number'||!Number.isFinite(request.additional_usd)||request.additional_usd<0)reject('unknown_incremental_cost');
 if(request.action==='deploy_existing'&&(request.provider!=='render'||!request.service_id||request.service_id!==registry.environments[request.environment].render_service_id))reject('unverified_existing_service');
 if(request.additional_usd>0){
  const a=registry.spending_authorizations.find(a=>a.id===request.authorization_id);
  if(!a||a.provider!==request.provider||a.parent_id!==request.parent_id||a.environment!==request.environment||!a.actions.includes(request.action)||a.maximum_usd<request.additional_usd||Date.parse(a.expires_at)<=now.getTime())reject('incremental_spend_not_authorized');
 }else if(request.action!=='deploy_existing'&&!registry.free_provisioning_evidence.some(e=>e.provider===request.provider&&e.environment===request.environment&&Date.parse(e.expires_at)>now.getTime()))reject('free_allowance_not_verified');
 return {allowed:true,kind:'dry_run_only',budget_reservation:false} as const;
}
