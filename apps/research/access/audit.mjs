import {randomUUID} from 'node:crypto';
import {AuditError,auditUUID,auditPageOptions,GENESIS,verifyAuditPage,validateCheckpoint} from '../../../packages/domain/src/audit/ledger.mjs';
const fail=()=>{throw new AuditError();};
const CAPS=['garden_context_issuer','garden_audit_reader','garden_audit_writer'];
const ROLE_SQL=`SELECT current_user::text AS current_role,session_user::text AS login_role,
 (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolinherit) AS elevated,
 pg_has_role(session_user,$1,'MEMBER') AS expected,
 EXISTS(SELECT 1 FROM unnest(ARRAY['garden_migrator','garden_public','garden_research','garden_context_issuer','garden_membership_admin','garden_consent_admin','garden_publisher','garden_worker','garden_audit_reader','garden_audit_writer']) n WHERE n<>$1 AND pg_has_role(session_user,n,'MEMBER')) AS conflicting
 FROM pg_roles r WHERE r.rolname=session_user`;
async function role(client,cap){
 if(!CAPS.includes(cap))fail();const r=(await client.query(ROLE_SQL,[cap])).rows;
 if(r?.length!==1||!r[0].login_role||r[0].current_role!==r[0].login_role||r[0].elevated!==false||r[0].expected!==true||r[0].conflicting!==false)fail();
}
function poolExecutor(pool,cap){
 if(typeof pool?.connect!=='function'||!CAPS.includes(cap))fail();
 return async work=>{
  let c,bad=false;
  try{
   c=await pool.connect();try{await role(c,cap);}catch{bad=true;fail();}
   await c.query('BEGIN');await c.query('SET LOCAL ROLE '+cap);
   await c.query("SET LOCAL statement_timeout='5s'; SET LOCAL idle_in_transaction_session_timeout='10s'");
   const result=await work(c);await c.query('COMMIT');return result;
  }catch{try{if(c)await c.query('ROLLBACK');}catch{bad=true;}fail();}finally{c?.release(bad);}
 };
}
function subject(value){
 if(!value||value.verified!==true||typeof value.id!=='string'||!value.id||value.id.length>128)fail();
 return value.id;
}
function checkpoint(row,workspace){if(!row)fail();return validateCheckpoint({workspaceId:workspace,sequence:row.sequence,hash:row.hash});}
const ROWS=`SELECT workspace_id::text AS "workspaceId",sequence::text AS sequence,previous_hash AS "previousHash",hash,event_text AS "eventText" FROM garden_control.audit_events`;
/** No HTTP route is mounted here. The issuer and read pools must use distinct,
 * noninheriting logins. SQL requires a current auditor grant independently of
 * the identity service's cryptographic step-up check. Exports contain opaque
 * aliases only; protected identity mappings are never copied into the result.
 */
export function createAuditReader({identity,issuerPool,auditPool,enabled=()=>false}){
 if(typeof identity?.viewer!=='function'||typeof identity?.authorizePrivileged!=='function'||issuerPool===auditPool||typeof enabled!=='function')fail();
 const issuer=poolExecutor(issuerPool,'garden_context_issuer'),reader=poolExecutor(auditPool,'garden_audit_reader');
 async function retirement(token){if(token)await issuer(c=>c.query('SELECT garden_control.invalidate_policy_ticket($1)',[token]));}
 return Object.freeze({
  async page(headers,workspaceId,options={}){
   const workspace=auditUUID(workspaceId),bounds=auditPageOptions(options);
   if(bounds.through&&bounds.through.workspaceId!==workspace)fail();
   let token,actor,finished=false;
   try{
    if(await enabled()!==true)fail();actor=subject(await identity.viewer(headers));
    const admitted=await identity.authorizePrivileged(headers,'audit.inspect',async proof=>{
     if(proof.subjectId!==actor)return false;
     const result=await issuer(c=>c.query('SELECT garden_control.issue_audit_ticket($1::uuid,$2::text) AS token',[workspace,actor]));
     token=result.rows[0]?.token;return typeof token==='string'&&/^[0-9a-f]{64}$/.test(token);
    });
    if(admitted!==true||!token)fail();
    const result=await reader(async c=>{
     await c.query('SELECT garden_control.bind_policy_context($1)',[token]);
     await c.query('SELECT garden_control.record_audit_export($1::uuid)',[workspace]);
     const head=checkpoint((await c.query('SELECT sequence::text,hash FROM garden_control.audit_heads WHERE workspace_id=$1::uuid',[workspace])).rows[0],workspace);
     const through=bounds.through??head;
     if(BigInt(through.sequence)>BigInt(head.sequence)||BigInt(bounds.after)>BigInt(through.sequence))fail();
     async function at(sequence){
      if(sequence==='0')return {workspaceId:workspace,sequence:'0',hash:GENESIS};
      return checkpoint((await c.query('SELECT sequence::text,hash FROM garden_control.audit_events WHERE workspace_id=$1::uuid AND sequence=$2::bigint',[workspace,sequence])).rows[0],workspace);
     }
     if((await at(through.sequence)).hash!==through.hash)fail();
     const from=await at(bounds.after);
     const entries=(await c.query(ROWS+' WHERE workspace_id=$1::uuid AND sequence>$2::bigint AND sequence<=$3::bigint ORDER BY sequence LIMIT $4',[workspace,bounds.after,through.sequence,bounds.limit])).rows;
     const verified=verifyAuditPage(entries,from);
     if(entries.length===0&&bounds.after!==through.sequence)fail();
     if(subject(await identity.viewer(headers))!==actor||await enabled()!==true)fail();
     const final=await identity.authorizePrivileged(headers,'audit.inspect',async proof=>{
      if(proof.subjectId!==actor)return false;
      const current=await issuer(c=>c.query('SELECT garden_control.audit_member($1::uuid,$2::text) AS allowed',[workspace,actor]));
      return current.rows[0]?.allowed===true;
     });
     if(final!==true||(await c.query('SELECT garden_control.audit_may_read($1::uuid) AS allowed',[workspace])).rows[0]?.allowed!==true)fail();
     await c.query('SELECT garden_control.clear_policy_context()');
     return Object.freeze({format:'garden-audit-page-v1',workspaceId:workspace,from,through,observedHead:head,entries,
      nextAfter:verified.checkpoint.sequence===through.sequence?null:verified.checkpoint.sequence,
      internallyConsistent:true,externallyAnchored:false,completeHistory:false,identityMappingIncluded:false});
    });
    finished=true;return result;
   }catch{fail();}finally{try{await retirement(token);}catch{if(finished)fail();}}
  }
 });
}
/** Records a server-owned allow/deny decision, not operation execution. A failed
 * audit write prevents an allowed response. Caller-provided payloads, names,
 * exceptions, bearer tokens and reasons never enter the immutable event.
 */
export function createAuditedDecision({identity,pool,enabled=()=>false}){
 if(typeof identity?.viewer!=='function'||typeof enabled!=='function')fail();
 const write=poolExecutor(pool,'garden_audit_writer');
 return Object.freeze({
  async decide(headers,workspaceId,evaluate){
   const workspace=auditUUID(workspaceId);if(await enabled()!==true||typeof evaluate!=='function')fail();
   let actor=null;const requestId=randomUUID();let allowed=false;
   try{const viewer=await identity.viewer(headers);if(viewer)actor=subject(viewer);if(actor)allowed=(await evaluate(Object.freeze({subjectId:actor,workspaceId:workspace,requestId})))===true;}catch{allowed=false;}
   if(allowed){try{if(subject(await identity.viewer(headers))!==actor)allowed=false;}catch{allowed=false;}}
   await write(c=>c.query('SELECT garden_control.record_audit_decision($1::uuid,$2::text,$3::uuid,$4::boolean)',[workspace,actor,requestId,allowed]));
   return Object.freeze({allowed,requestId,operationPerformed:false});
  }
 });
}
