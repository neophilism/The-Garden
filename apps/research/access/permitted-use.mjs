import {assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';
import {ConsentError} from '../../../packages/domain/src/consent/purpose.mjs';
import {UUID} from './roles.mjs';
const deny=()=>{throw new ConsentError();};
const roles={publication:'garden_publisher',preservation:'garden_worker'};
/** Transactional admission gate for trusted pipeline code, not an HTTP API.
 * work must only write through the provided transaction. External publishing,
 * object copying or notifications cannot be rolled back and must not occur here.
 * Authorization/rights/research review are independent caller-owned gates. */
export function createPermittedUseTransactions({pool,kind,authorize,enabled=()=>false}){
 if(!Object.hasOwn(roles,kind)||typeof pool?.connect!=='function'||typeof authorize!=='function'||typeof enabled!=='function')deny();
 const role=roles[kind];
 return Object.freeze({
  async run(context,{workspaceId,recordId,requestId,purposes},work){
   if([workspaceId,recordId,requestId].some(x=>typeof x!=='string'||!UUID.test(x)||x!==x.toLowerCase())||typeof work!=='function'||!Array.isArray(purposes)||purposes.length<1||purposes.length>3||new Set(purposes).size!==purposes.length)deny();
   if(kind==='preservation'?(purposes.length!==1||purposes[0]!=='preservation'):purposes.some(x=>!['public-display','name-attribution','promotional-endorsement'].includes(x)))deny();
   const scope=Object.freeze({workspaceId,recordId,requestId,purposes:Object.freeze([...purposes].sort())});
   const check=async()=>{if(await enabled()!==true||await authorize(context,scope)!==true)deny();};
   let c,login,bad=false;
   try{
    await check();c=await pool.connect();
    login=await assertDatabaseCapability(c,role);
    await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);await c.query("SET LOCAL statement_timeout='5s'");await c.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
    const admit=async()=>{
     const result=(await c.query(kind==='publication'?'SELECT garden_control.admit_publication_use($1::uuid,$2::uuid,$3::uuid,$4::text[]) AS receipt':'SELECT garden_control.admit_preservation_use($1::uuid,$2::uuid,$3::uuid) AS receipt',kind==='publication'?[workspaceId,recordId,requestId,scope.purposes]:[workspaceId,recordId,requestId])).rows;
     if(result.length!==1||result[0].receipt?.allowed!==true||result[0].receipt?.requestId!==requestId||result[0].receipt?.publicationApproved!==false)deny();
    };
    await admit();const value=await work(c);await check();await admit();await assertDatabaseCapability(c,role,{activeRole:true,login});await c.query('COMMIT');return value;
   }catch(error){if(error instanceof DatabaseCapabilityError)bad=true;try{if(c)await c.query('ROLLBACK');}catch{bad=true;}deny();}finally{c?.release(bad);}
  }
 });
}
