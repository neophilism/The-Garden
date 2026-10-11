import {UUID} from './roles.mjs';
export class PolicyError extends Error { constructor(){super('Research access denied');this.code='access_denied';} }
const deny=()=>{throw new PolicyError();};
function subject(value){if(!value||value.verified!==true||typeof value.id!=='string'||value.id.length<1||value.id.length>128)deny();return value.id;}
function uuid(value){if(typeof value!=='string'||!UUID.test(value))deny();return value.toLowerCase();}
const ROLE_CHECK = `SELECT current_user::text AS current_role,session_user::text AS login_role,
 (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolinherit) AS elevated,
 pg_has_role(session_user,'garden_migrator','MEMBER') AS migration_member,
 pg_has_role(session_user,'garden_context_issuer','MEMBER') AS issuer_member,
 pg_has_role(session_user,'garden_research','MEMBER') AS research_member,
 pg_has_role(session_user,'garden_membership_admin','MEMBER') AS membership_admin_member,
 pg_has_role(session_user,'garden_publisher','MEMBER') AS publisher_member,
 pg_has_role(session_user,'garden_worker','MEMBER') AS worker_member,
 pg_has_role(session_user,'garden_consent_admin','MEMBER') AS consent_admin_member
 FROM pg_roles r WHERE r.rolname=session_user`;
async function checkRole(client,kind) {
 const rows=(await client.query(ROLE_CHECK)).rows;if(rows?.length!==1)deny();const r=rows[0];
 if(typeof r.login_role!=='string'||!r.login_role||r.current_role!==r.login_role||r.elevated!==false||r.migration_member!==false||r.membership_admin_member!==false||r.publisher_member!==false||r.worker_member!==false||r.consent_admin_member!==false||r.issuer_member!==(kind==='issuer')||r.research_member!==(kind==='research'))deny();
}
/** These pools must have different login credentials and disjoint SET ROLE capabilities. */
export function createPolicyExecutor({identity,issuerPool,researchPool}) {
 if(typeof identity?.viewer!=='function'||typeof issuerPool?.connect!=='function'||typeof researchPool?.connect!=='function'||issuerPool===researchPool)throw new Error('Separate identity, issuer and research dependencies required');
 async function verified(headers){try{return subject(await identity.viewer(headers));}catch{deny();}}
 async function issuerOperation(sql,args){let c,bad=false;try{c=await issuerPool.connect();try{await checkRole(c,'issuer');}catch{bad=true;deny();}await c.query('BEGIN');await c.query('SET LOCAL ROLE garden_context_issuer');await c.query("SET LOCAL statement_timeout='5s'");const r=await c.query(sql,args);await c.query('COMMIT');return r;}catch{try{if(c)await c.query('ROLLBACK');}catch{bad=true;}deny();}finally{c?.release(bad);}}
 return Object.freeze({
  async run(headers,{workspaceId,action='read',recordId=null},work){
   const workspace=uuid(workspaceId),scope=recordId===null?null:uuid(recordId);
   if(!['read','write'].includes(action)||typeof work!=='function')deny();
   const actor=await verified(headers);
   const result=await issuerOperation('SELECT garden_control.issue_policy_ticket($1::uuid,$2::text,$3::text,$4::uuid) AS ticket',[workspace,actor,action,scope]);
   const ticket=result.rows[0]?.ticket;if(typeof ticket!=='string'||!/^[0-9a-f]{64}$/.test(ticket))deny();
   let c,bad=false,completed=false;
   try{
    c=await researchPool.connect();try{await checkRole(c,'research');}catch{bad=true;deny();}await c.query('BEGIN');await c.query('SET LOCAL ROLE garden_research');
    await c.query("SET LOCAL statement_timeout='5s'");await c.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
    await c.query('SELECT garden_control.bind_policy_context($1::text)',[ticket]);
    // Only trusted repository code receives this connection, never a request-provided query.
    const value=await work(c);
    if(await verified(headers)!==actor)deny();
    await c.query('SELECT garden_control.clear_policy_context()');await c.query('COMMIT');completed=true;return value;
   }catch{try{if(c)await c.query('ROLLBACK');}catch{bad=true;}deny();}
   finally{
    c?.release(bad);
    // Also retires a token after rollback, so it cannot authorize a later transaction.
    try{await issuerOperation('SELECT garden_control.invalidate_policy_ticket($1::text)',[ticket]);}
    catch{if(completed)deny();}
   }
  }
 });
}
