import {assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';
import {UUID} from './roles.mjs';
export class PolicyError extends Error { constructor(){super('Research access denied');this.code='access_denied';} }
const deny=()=>{throw new PolicyError();};
function subject(value){if(!value||value.verified!==true||typeof value.id!=='string'||value.id.length<1||value.id.length>128)deny();return value.id;}
function uuid(value){if(typeof value!=='string'||!UUID.test(value))deny();return value.toLowerCase();}
async function checkRole(client,kind,activeRole=false,login=null) {
 return assertDatabaseCapability(client,kind==='issuer'?'garden_context_issuer':'garden_research',{activeRole,login});
}
/** These pools must have different login credentials and disjoint SET ROLE capabilities. */
export function createPolicyExecutor({identity,issuerPool,researchPool}) {
 if(typeof identity?.viewer!=='function'||typeof issuerPool?.connect!=='function'||typeof researchPool?.connect!=='function'||issuerPool===researchPool)throw new Error('Separate identity, issuer and research dependencies required');
 async function verified(headers){try{return subject(await identity.viewer(headers));}catch{deny();}}
 async function issuerOperation(sql,args){let c,bad=false,login;try{c=await issuerPool.connect();try{login=await checkRole(c,'issuer');}catch{bad=true;deny();}await c.query('BEGIN');await c.query('SET LOCAL ROLE garden_context_issuer');await c.query("SET LOCAL statement_timeout='5s'");const r=await c.query(sql,args);await checkRole(c,'issuer',true,login);await c.query('COMMIT');return r;}catch(error){if(error instanceof DatabaseCapabilityError)bad=true;try{if(c)await c.query('ROLLBACK');}catch{bad=true;}deny();}finally{c?.release(bad);}}
 return Object.freeze({
  async run(headers,{workspaceId,action='read',recordId=null},work){
   const workspace=uuid(workspaceId),scope=recordId===null?null:uuid(recordId);
   if(!['read','write'].includes(action)||typeof work!=='function')deny();
   const actor=await verified(headers);
   const result=await issuerOperation('SELECT garden_control.issue_policy_ticket($1::uuid,$2::text,$3::text,$4::uuid) AS ticket',[workspace,actor,action,scope]);
   const ticket=result.rows[0]?.ticket;if(typeof ticket!=='string'||!/^[0-9a-f]{64}$/.test(ticket))deny();
   let c,bad=false,completed=false,login,value;
   try{
    c=await researchPool.connect();try{login=await checkRole(c,'research');}catch{bad=true;deny();}await c.query('BEGIN');await c.query('SET LOCAL ROLE garden_research');
    await c.query("SET LOCAL statement_timeout='5s'");await c.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
    // The issuer has committed. Take the common consent/review workspace gate
    // before binding locks the ticket row or repository code locks graph/records.
    // COMMIT/ROLLBACK releases this transaction lock before issuer retirement.
    await c.query('SELECT pg_advisory_xact_lock(144729,hashtext($1::text))',[workspace]);
    await c.query('SELECT garden_control.bind_policy_context($1::text)',[ticket]);
    // Only trusted repository code receives this connection, never a request-provided query.
    value=await work(c);
    if(await verified(headers)!==actor)deny();
    await c.query('SELECT garden_control.clear_policy_context()');await checkRole(c,'research',true,login);
    // Context cleanup and the role probe are awaited boundaries too. Refresh
    // identity after them before admitting COMMIT.
    if(await verified(headers)!==actor)deny();
    await c.query('COMMIT');completed=true;
   }catch(error){if(error instanceof DatabaseCapabilityError)bad=true;try{if(c)await c.query('ROLLBACK');}catch{bad=true;}deny();}
   finally{
    c?.release(bad);
    // Also retires a token after rollback, so it cannot authorize a later transaction.
    try{await issuerOperation('SELECT garden_control.invalidate_policy_ticket($1::text)',[ticket]);}
    catch{if(completed)deny();}
   }
   // COMMIT, connection release and issuer retirement can outlive the earlier
   // proof. Deny delivery on closure without pretending a committed write rolled back.
   if(await verified(headers)!==actor)deny();
   return value;
  }
 });
}
