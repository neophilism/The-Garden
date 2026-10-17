/** Closed runtime capability boundary. These are database roles, not researcher
 * roles. A deployment must use distinct logins; a verified email is irrelevant
 * to this check. No credential, role name or query error is returned to callers.
 */
export const RUNTIME_DATABASE_CAPABILITIES = Object.freeze([
 'garden_public','garden_research','garden_context_issuer','garden_membership_admin',
 'garden_consent_admin','garden_publisher','garden_worker','garden_audit_reader','garden_audit_writer','garden_encryption',
 'garden_lifecycle_requester','garden_lifecycle_admin'
]);
export class DatabaseCapabilityError extends Error {
 constructor(){super('Database capability unavailable');this.code='database_capability_unavailable';}
}
const fail=()=>{throw new DatabaseCapabilityError();};
// Inspect the entire reachable role graph, not a blacklist that becomes stale
// when a new capability is added. MEMBER deliberately catches SET FALSE edges
// too; USAGE catches inherited grants even on a NOINHERIT login. Object owners
// and elevated capability roles cannot be admitted as ordinary runtimes.
export const DATABASE_CAPABILITY_QUERY = `SELECT current_user::text AS current_role,session_user::text AS login_role,
 r.rolcanlogin AS login_enabled,
 (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolinherit) AS elevated,
 pg_has_role(session_user,$1::text,'MEMBER') AS expected,
 pg_has_role(session_user,$1::text,'SET') AS can_set,
 pg_has_role(session_user,$1::text,'USAGE') AS inherited,
 EXISTS(SELECT 1 FROM pg_roles other WHERE other.rolname::text NOT IN (session_user::text,$1::text) AND pg_has_role(session_user,other.oid,'MEMBER')) AS conflicting,
 (cap.rolcanlogin OR cap.rolsuper OR cap.rolbypassrls OR cap.rolcreaterole OR cap.rolcreatedb OR cap.rolreplication OR cap.rolinherit) AS unsafe_capability,
 (EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspowner=r.oid) OR
  EXISTS(SELECT 1 FROM pg_class c WHERE c.relowner=r.oid) OR
  EXISTS(SELECT 1 FROM pg_proc p WHERE p.proowner=r.oid) OR
  EXISTS(SELECT 1 FROM pg_database d WHERE d.datdba=r.oid)) AS owns_objects
 FROM pg_roles r JOIN pg_roles cap ON cap.rolname::text=$1::text WHERE r.rolname=session_user`;
export function validateDatabaseCapability(rows,capability,{activeRole=false,login=null}={}){
 if(!RUNTIME_DATABASE_CAPABILITIES.includes(capability)||typeof activeRole!=='boolean'||
    (login!==null&&(typeof login!=='string'||!login))||!Array.isArray(rows)||rows.length!==1)fail();
 const r=rows[0];
 if(!r||typeof r.login_role!=='string'||!r.login_role||r.login_role===capability||
    (login!==null&&r.login_role!==login)||r.current_role!==(activeRole?capability:r.login_role)||
    r.login_enabled!==true||r.elevated!==false||r.expected!==true||r.can_set!==true||
    r.inherited!==false||r.conflicting!==false||r.unsafe_capability!==false||r.owns_objects!==false)fail();
 return r.login_role;
}
export async function assertDatabaseCapability(client,capability,options={}){
 if(!RUNTIME_DATABASE_CAPABILITIES.includes(capability)||typeof client?.query!=='function')fail();
 try{return validateDatabaseCapability((await client.query(DATABASE_CAPABILITY_QUERY,[capability])).rows,capability,options);}
 catch{fail();}
}
