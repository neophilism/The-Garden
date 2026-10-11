import {assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';
import {validateConsentGrant,validateUsePolicy,ConsentError} from '../../../packages/domain/src/consent/purpose.mjs';
import {UUID,SHA256} from './roles.mjs';
const fail=()=>{throw new ConsentError();};
function uuid(value){if(typeof value!=='string'||!UUID.test(value)||value!==value.toLowerCase())fail();return value;}
function digest(value){if(typeof value!=='string'||!SHA256.test(value))fail();return value;}
function version(value,{zero=false}={}){if(typeof value!=='string'||!(zero?/^(0|[1-9][0-9]{0,17})$/:/^[1-9][0-9]{0,17}$/).test(value))fail();return value;}
/** Unmounted administration boundary. The trusted authorizer must independently
 * verify privilege, workspace scope and recent step-up (GDN-022), not infer them
 * from ordinary verified email or a client-provided administrator flag. */
export function createConsentAdministration({pool,authorize,enabled=()=>false}){
 if(typeof pool?.connect!=='function'||typeof authorize!=='function'||typeof enabled!=='function')fail();
 async function identity(headers,workspace,operation){
  if(await enabled()!==true)fail();const actor=await authorize(headers,{workspaceId:workspace,operation});
  if(!actor||actor.verified!==true||actor.privilegedAssurance!==true||actor.workspaceId!==workspace||actor.operation!==operation||typeof actor.id!=='string'||!actor.id||actor.id.length>128)fail();
  return actor.id;
 }
 async function run(headers,workspace,operation,work){
  workspace=uuid(workspace);let actor,c,login,bad=false;
  try{
   actor=await identity(headers,workspace,operation);c=await pool.connect();login=await assertDatabaseCapability(c,'garden_consent_admin');
   await c.query('BEGIN');await c.query('SET LOCAL ROLE garden_consent_admin');await c.query("SET LOCAL statement_timeout='5s'");await c.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
   const result=await work(c,actor);if(await identity(headers,workspace,operation)!==actor)fail();await assertDatabaseCapability(c,'garden_consent_admin',{activeRole:true,login});await c.query('COMMIT');return result;
  }catch(error){if(error instanceof DatabaseCapabilityError)bad=true;try{if(c)await c.query('ROLLBACK');}catch{bad=true;}fail();}finally{c?.release(bad);}
 }
 return Object.freeze({
  async registerTerms(headers,workspace,terms){
   if(!terms||Object.keys(terms).sort().join('|')!=='digest|id|version')fail();uuid(terms.id);version(terms.version);digest(terms.digest);
   return run(headers,workspace,'consent.terms',async(c,actor)=>{await c.query('SELECT garden_control.register_consent_terms($1::uuid,$2::bigint,$3::text,$4::text)',[terms.id,terms.version,terms.digest,actor]);return {recorded:true,termsId:terms.id,version:terms.version};});
  },
  async setPolicy(headers,workspace,policy,expectedVersion){
   const value=validateUsePolicy(policy);version(expectedVersion,{zero:true});
   return run(headers,workspace,'consent.policy',async(c,actor)=>{const r=(await c.query('SELECT garden_control.set_use_policy($1::uuid,$2::jsonb,$3::bigint,$4::text)::text AS version',[workspace,JSON.stringify(value),expectedVersion,actor])).rows;if(r.length!==1)fail();version(r[0].version);return {recordId:value.recordId,version:r[0].version};});
  },
  async recordGrant(headers,workspace,grant){
   const value=validateConsentGrant(grant);
   return run(headers,workspace,'consent.grant',async(c,actor)=>{const r=(await c.query('SELECT garden_control.record_consent_grant($1::uuid,$2::jsonb,$3::text)::text AS id',[workspace,JSON.stringify(value),actor])).rows;if(r.length!==1||r[0].id!==value.id)fail();return {grantId:value.id,recorded:true,legalAuthorityVerified:false};});
  },
  async withdraw(headers,workspace,grantId,reasonDigest){
   uuid(grantId);digest(reasonDigest);
   return run(headers,workspace,'consent.withdraw',async(c,actor)=>{await c.query('SELECT garden_control.withdraw_consent_grant($1::uuid,$2::uuid,$3::text,$4::text)',[workspace,grantId,reasonDigest,actor]);return {withdrawn:true,grantId,scope:'subject-record-purpose',erasesPublishedCopies:false};});
  }
 });
}
