/** Fixed PostgreSQL requester repository. The trusted host supplies a freshly
 * authenticated principal and admission callback; no credentials, arbitrary
 * query callback, research permission, record resolver or worker is accepted.
 * This component is unmounted and disabled until a host configures it.
 */
import {createHash,randomUUID} from 'node:crypto';
import {
 validateLifecycleSubmission,validateLifecycleCancellation,validateLifecycleRequest,
 lifecycleRequestFingerprint
} from '../../../packages/domain/src/lifecycle/requests.mjs';
import {assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
const XID=/^[1-9][0-9]{0,19}$/;
const XID_MAX=18446744073709551615n;

export class LifecycleRequestRepositoryError extends Error {
 constructor(recovery=null){
  super('Lifecycle request unavailable');this.name='LifecycleRequestRepositoryError';this.code='lifecycle_request_unavailable';
  if(recovery){this.commitOutcome='unconfirmed';this.recovery=Object.freeze({operationId:recovery.operationId,fingerprint:recovery.fingerprint});}
 }
}
const fail=()=>{throw new LifecycleRequestRepositoryError();};
function exact(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(descriptors);
 if(actual.length!==keys.length||actual.some(key=>typeof key!=='string'||!keys.includes(key)))fail();
 const copy={};for(const key of keys){const p=descriptors[key];if(!p?.enumerable||!Object.hasOwn(p,'value'))fail();copy[key]=p.value;}
 return copy;
}
function uuid(value){if(typeof value!=='string'||!UUID.test(value))fail();return value;}
function hash(value){if(typeof value!=='string'||!HASH.test(value))fail();return value;}
function principal(value,workspace){
 const p=exact(value,['workspaceId','subjectId']);uuid(p.workspaceId);
 if(p.workspaceId!==workspace||typeof p.subjectId!=='string'||!p.subjectId.length||p.subjectId.length>128||!p.subjectId.isWellFormed()||/[\x00-\x20\x7f]/.test(p.subjectId))fail();
 return Object.freeze(p);
}
function digest(prefix,action,value){return createHash('sha256').update(prefix+'\n'+action+'\n'+JSON.stringify(value),'utf8').digest('hex');}
function cancelFingerprint(p,c){
 return digest('garden-lifecycle-operation-v1','cancel',{workspaceId:p.workspaceId,subjectId:p.subjectId,
  requestId:c.input.requestId,requestFingerprint:c.requestFingerprint,operationId:c.input.operationId,
  expectedRevision:c.input.expectedRevision,state:'cancelled',review:null});
}
function statusFingerprint(p,requestId,operationId){
 return digest('garden-lifecycle-read-v1','status',{workspaceId:p.workspaceId,subjectId:p.subjectId,requestId,operationId});
}
function commandFor(action,value,p){
 if(action==='submit'){
  const c=exact(value,['input','fingerprint']);c.input=validateLifecycleSubmission(c.input);hash(c.fingerprint);
  if(c.fingerprint!==lifecycleRequestFingerprint(p,c.input))fail();return Object.freeze(c);
 }
 if(action==='cancel'){
  const c=exact(value,['input','requestFingerprint','fingerprint']);c.input=validateLifecycleCancellation(c.input);hash(c.requestFingerprint);hash(c.fingerprint);
  if(c.fingerprint!==cancelFingerprint(p,c))fail();return Object.freeze(c);
 }
 if(action==='status'){const c=exact(value,['requestId']);uuid(c.requestId);return Object.freeze(c);}
 if(action==='recover'){const c=exact(value,['operationId','fingerprint']);uuid(c.operationId);hash(c.fingerprint);return Object.freeze(c);}
 fail();
}
function admission(value){
 if(typeof value!=='function')fail();
 const d=Object.getOwnPropertyDescriptor(value,'isAvailable');
 if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')fail();
 return Object.freeze({admit:value,available:d.value});
}
function active(value){
 // Async predicates are never admitted. Intrinsic rejection observation also
 // covers foreign promises, thenables and an overridden catch method without
 // letting a rejected configuration escape the sanitized boundary.
 if(value!==null&&(typeof value==='object'||typeof value==='function')){
  try{void Promise.prototype.then.call(Promise.resolve(value),undefined,()=>{});}catch{}
 }
 if(value!==true)fail();
}
function rows(value){if(!Array.isArray(value?.rows)||value.rows.length!==1)fail();return value.rows[0];}
function session(value){
 const p=exact(value,['backend_pid','transaction_id']);
 if(!Number.isSafeInteger(p.backend_pid)||p.backend_pid<=0||p.backend_pid>2147483647||typeof p.transaction_id!=='string'||!XID.test(p.transaction_id)||BigInt(p.transaction_id)>XID_MAX)fail();
 return Object.freeze(p);
}
function checkedRequest(value,p,c,action){
 const r=validateLifecycleRequest(value);
 if(r.workspaceId!==p.workspaceId||r.requesterId!==p.subjectId||!['pending','cancelled'].includes(r.state))fail();
 if(action==='submit'){
  if(r.requestId!==c.input.requestId||r.submission.operationId!==c.input.operationId||r.submission.fingerprint!==c.fingerprint||r.kind!==c.input.kind||r.claimedRecordId!==c.input.claimedRecordId)fail();
 }else if(action==='cancel'){
  if(r.requestId!==c.input.requestId||r.submission.fingerprint!==c.requestFingerprint||r.resolution?.action!=='cancel'||r.resolution.operationId!==c.input.operationId||r.resolution.fingerprint!==c.fingerprint||r.resolution.expectedRevision!==c.input.expectedRevision)fail();
 }else if(action==='status'){if(r.requestId!==c.requestId)fail();}
 else if(!((r.submission.operationId===c.operationId&&r.submission.fingerprint===c.fingerprint)||(r.resolution?.operationId===c.operationId&&r.resolution.fingerprint===c.fingerprint)))fail();
 return r;
}

export function createLifecycleRequestRepository({issuerPool,requesterPool,workspaceId,environment,isEnabled=()=>false}){
 const workspace=uuid(workspaceId);
 if(!['ci','staging'].includes(environment)||issuerPool===requesterPool||typeof issuerPool?.connect!=='function'||typeof requesterPool?.connect!=='function'||typeof isEnabled!=='function')fail();
 const issuerConnect=issuerPool.connect.bind(issuerPool),requesterConnect=requesterPool.connect.bind(requesterPool);

 // Only these two fixed issuer operations exist. Retirement intentionally
 // remains available after feature closure and after the requester TX ends.
 async function issuer(kind,args,capture){
  let c,bad=false,login,attempted=false,completed=false;
  try{
   c=await issuerConnect();login=await assertDatabaseCapability(c,'garden_context_issuer');
   await c.query('BEGIN');await c.query('SET LOCAL ROLE garden_context_issuer');await c.query("SET LOCAL statement_timeout='5s'");
   if(kind==='issue'){
    const r=rows(await c.query('SELECT garden_control.issue_lifecycle_request_ticket($1::uuid,$2::text,$3::text,$4::text,$5::uuid,$6::uuid,$7::text,$8::integer,$9::xid8) AS ticket',args));
    const token=exact(r,['ticket']).ticket;hash(token);capture(token);
   }else await c.query('SELECT garden_control.invalidate_lifecycle_request_ticket($1::text)',args);
   await assertDatabaseCapability(c,'garden_context_issuer',{activeRole:true,login});
   attempted=true;await c.query('COMMIT');completed=true;
  }catch(error){
   if(error instanceof DatabaseCapabilityError||(attempted&&!completed))bad=true;
   if(!completed)try{if(c)await c.query('ROLLBACK');}catch{bad=true;}
   fail();
  }finally{
   try{c?.release(bad);}catch{fail();}
  }
 }
 async function run(p,c,action,permission){
  const write=action==='submit'||action==='cancel';
  const operationId=write?c.input.operationId:action==='recover'?c.operationId:randomUUID();
  const fingerprint=action==='status'?statusFingerprint(p,c.requestId,operationId):c.fingerprint;
  const requestId=write?c.input.requestId:action==='status'?c.requestId:null;
  const recovery=write?Object.freeze({operationId,fingerprint}):null;
  const fence=()=>{active(isEnabled());active(permission.available());};
  const recheck=async()=>{fence();active(await permission.admit());fence();};
  let db,ticket,login,value,bad=false,attempted=false,completed=false;
  const unavailable=()=>new LifecycleRequestRepositoryError(attempted?recovery:null);
  try{
   await recheck();
   db=await requesterConnect();fence();login=await assertDatabaseCapability(db,'garden_lifecycle_requester');fence();
   await db.query('BEGIN');await db.query('SET LOCAL ROLE garden_lifecycle_requester');
   await db.query("SET LOCAL statement_timeout='5s'");await db.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
   await db.query('SET CONSTRAINTS ALL DEFERRED');fence();
   const binding=session(rows(await db.query('SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')));fence();
   // Mint is committed against this exact already-open TX. No case, ticket
   // redemption or audit-head lock has been taken by the requester yet.
   await issuer('issue',[workspace,p.subjectId,environment,action,requestId,operationId,fingerprint,binding.backend_pid,binding.transaction_id],token=>{ticket=token;});fence();
   await db.query('SELECT garden_control.bind_lifecycle_request_context($1::text)',[ticket]);fence();
   let result;
   if(action==='submit')result=await db.query('SELECT garden_control.submit_lifecycle_request($1::jsonb) AS result',[JSON.stringify(c)]);
   else if(action==='cancel')result=await db.query('SELECT garden_control.cancel_lifecycle_request($1::jsonb) AS result',[JSON.stringify(c)]);
   else if(action==='status')result=await db.query('SELECT garden_control.lifecycle_request_status($1::uuid) AS result',[c.requestId]);
   else result=await db.query('SELECT garden_control.recover_lifecycle_request($1::uuid,$2::text) AS result',[c.operationId,c.fingerprint]);
   fence();value=checkedRequest(exact(rows(result),['result']).result,p,c,action);
   await recheck();
   await assertDatabaseCapability(db,'garden_lifecycle_requester',{activeRole:true,login});fence();
   if(exact(rows(await db.query('SELECT garden_control.check_lifecycle_request_context() AS admitted')),['admitted']).admitted!==true)fail();fence();
   await db.query('SELECT garden_control.clear_lifecycle_request_context()');fence();
   // Current identity is rechecked after all preceding DB awaits; the
   // synchronous availability fence is immediately adjacent to COMMIT.
   await recheck();fence();attempted=true;await db.query('COMMIT');completed=true;fence();
  }catch(error){
   if(error instanceof DatabaseCapabilityError||(attempted&&!completed))bad=true;
   if(!completed)try{if(db)await db.query('ROLLBACK');}catch{bad=true;}
   throw unavailable();
  }finally{
   let cleanupFailed=false;try{db?.release(bad);}catch{cleanupFailed=true;}
   // Even rollback may leave a minted token. Its PID+xid binding prevents
   // later redemption; retirement removes it without holding the main TX.
   if(ticket)try{await issuer('retire',[ticket]);}catch{cleanupFailed=true;}
   if(cleanupFailed&&completed)throw unavailable();
   // recheck itself is asynchronous. A queued closure can run between its
   // final internal check and this continuation, so fence again at return.
   if(completed)try{await recheck();fence();}catch{throw unavailable();}
  }
  return value;
 }
 const call=action=>async(context,input,admit)=>{
  let p,c,permission;
  try{p=principal(context,workspace);c=commandFor(action,input,p);permission=admission(admit);}catch{fail();}
  return run(p,c,action,permission);
 };
 return Object.freeze({submit:call('submit'),status:call('status'),cancel:call('cancel'),recover:call('recover')});
}
