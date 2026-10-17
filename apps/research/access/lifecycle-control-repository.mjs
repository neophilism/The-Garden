/** Fixed private operator transaction adapter. No credential, dynamic SQL,
 * arbitrary transaction callback or caller-supplied authority is admitted.
 * The two pools must have disjoint, noninherited database capabilities. */
import {randomUUID} from 'node:crypto';
import {
 LifecycleControlError,controlOwned,controlExact,controlFreeze,controlUUID,controlHash,
 controlInstant,controlPrincipal,validateControlScope,validateControlIntent,
 lifecycleControlIntentFingerprint,lifecycleControlReadFingerprint,
 validateControlCommit,validateControlPreparation,validateControlRecovery,
 controlRecovery,validateControlResult,validateControlStatus,lifecycleControlResultFingerprint
} from '../../../packages/domain/src/lifecycle/control-storage.mjs';
import {assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';

export class LifecycleControlRepositoryError extends LifecycleControlError {
 constructor(recovery=null){super();this.name='LifecycleControlRepositoryError';if(recovery){this.commitOutcome='unconfirmed';this.recovery=validateControlRecovery(recovery);}}
}
const fail=()=>{throw new LifecycleControlRepositoryError();};
function active(value){
 if(value!==null&&(typeof value==='object'||typeof value==='function'))try{void Promise.prototype.then.call(Promise.resolve(value),undefined,()=>{});}catch{}
 if(value!==true)fail();
}
function one(value){if(!Array.isArray(value?.rows)||value.rows.length!==1)fail();return value.rows[0];}
function exact(value,keys){return controlExact(controlOwned(value),keys);}
function delivery(value,fingerprint){const result=exact(value,['expiresAt','resultFingerprint']);controlInstant(result.expiresAt);controlHash(result.resultFingerprint);if(result.resultFingerprint!==fingerprint)fail();return controlFreeze(result);}
function admission(value){
 if(typeof value!=='function')fail();
 const ds=Object.getOwnPropertyDescriptors(value),available=ds.isAvailable,expiry=ds.expiresAt;
 if(!available||!Object.hasOwn(available,'value')||typeof available.value!=='function'||!expiry||!Object.hasOwn(expiry,'value'))fail();
 return Object.freeze({admit:value,available:available.value,expiresAt:controlInstant(expiry.value)});
}
function session(value){
 const p=exact(value,['backend_pid','transaction_id']);
 if(!Number.isSafeInteger(p.backend_pid)||p.backend_pid<=0||p.backend_pid>2147483647||typeof p.transaction_id!=='string'||!/^[1-9][0-9]{0,19}$/.test(p.transaction_id)||BigInt(p.transaction_id)>18446744073709551615n)fail();return p;
}
function commandFor(phase,input,p){
 if(phase==='prepare'){
  const c=exact(input,['intent','fingerprint']);c.intent=validateControlIntent(c.intent);
  if(c.fingerprint!==lifecycleControlIntentFingerprint(p,c.intent))fail();return controlFreeze(c);
 }
 if(phase==='commit')return validateControlCommit(p,input);
 if(phase==='recover')return validateControlRecovery(input);
 const c=exact(input,['scope']);c.scope=validateControlScope(c.scope);return controlFreeze(c);
}
export function createLifecycleControlRepository({issuerPool,adminPool,workspaceId,environment,isEnabled=()=>false}){
 const workspace=controlUUID(workspaceId);
 if(!['ci','staging'].includes(environment)||issuerPool===adminPool||typeof issuerPool?.connect!=='function'||typeof adminPool?.connect!=='function'||typeof isEnabled!=='function')fail();
 const issuerConnect=issuerPool.connect.bind(issuerPool),adminConnect=adminPool.connect.bind(adminPool);
 async function issuer(kind,args,capture){
  let db,login,result,bad=false,attempted=false,completed=false;
  try{
   db=await issuerConnect();login=await assertDatabaseCapability(db,'garden_context_issuer');
   await db.query('BEGIN');await db.query('SET LOCAL ROLE garden_context_issuer');await db.query("SET LOCAL statement_timeout='5s'");await db.query('SET CONSTRAINTS ALL DEFERRED');
   if(kind==='issue'){
    const row=exact(one(await db.query('SELECT garden_control.issue_lifecycle_control_ticket($1::uuid,$2::text,$3::text,$4::text,$5::jsonb,$6::timestamptz,$7::integer,$8::xid8) AS result',args)),['result']);
    const tokens=exact(row.result,['ticket','policyTicket']);controlHash(tokens.ticket);controlHash(tokens.policyTicket);capture(controlFreeze(tokens));
   }else if(kind==='finish')result=delivery(exact(one(await db.query('SELECT garden_control.finish_lifecycle_control_delivery($1::text,$2::text) AS admission',args)),['admission']).admission,args[1]);
   else await db.query('SELECT garden_control.invalidate_lifecycle_control_ticket($1::text)',args);
   await assertDatabaseCapability(db,'garden_context_issuer',{activeRole:true,login});attempted=true;await db.query('COMMIT');completed=true;
  }catch(error){
   if(error instanceof DatabaseCapabilityError||attempted&&!completed)bad=true;
   if(!completed)try{if(db)await db.query('ROLLBACK');}catch{bad=true;}fail();
  }finally{try{db?.release(bad);}catch{fail();}}
  return result;
 }
 async function run(p,c,phase,permission){
  const write=phase==='commit',scope=phase==='prepare'?c.intent.scope:write?c.intent.scope:c.scope;
  const request=phase==='status'?controlFreeze({scope,operationId:randomUUID()}):c;
  const scopedRequest=phase==='status'?controlFreeze({...request,fingerprint:lifecycleControlReadFingerprint(p,scope,request.operationId)}):request;
  const recovery=write?controlRecovery(c):null;
  let deliveryDeadline=Date.parse(permission.expiresAt),resultFingerprint=null;
  const fence=()=>{active(isEnabled());active(permission.available());if(Date.now()>=deliveryDeadline)fail();};
  const recheck=async()=>{fence();active(await permission.admit());fence();};
  let db,login,tokens,value,bad=false,attempted=false,completed=false;
  const unavailable=()=>new LifecycleControlRepositoryError(attempted?recovery:null);
  try{
   await recheck();db=await adminConnect();fence();login=await assertDatabaseCapability(db,'garden_lifecycle_admin');fence();
   await db.query('BEGIN');await db.query('SET LOCAL ROLE garden_lifecycle_admin');
   await db.query("SET LOCAL statement_timeout='5s'");await db.query("SET LOCAL idle_in_transaction_session_timeout='10s'");await db.query('SET CONSTRAINTS ALL DEFERRED');fence();
   const binding=session(one(await db.query('SELECT pg_backend_pid() AS backend_pid,pg_current_xact_id()::text AS transaction_id')));fence();
   await issuer('issue',[workspace,p.subjectId,environment,phase,JSON.stringify(scopedRequest),permission.expiresAt,binding.backend_pid,binding.transaction_id],v=>{tokens=v;});fence();
   await db.query('SELECT garden_control.bind_lifecycle_control_context($1::text,$2::text)',[tokens.ticket,tokens.policyTicket]);fence();
   const sql=phase==='prepare'?'SELECT garden_control.prepare_lifecycle_control($1::jsonb) AS result':write?'SELECT garden_control.commit_lifecycle_control($1::jsonb) AS result':phase==='status'?'SELECT garden_control.lifecycle_control_status($1::jsonb) AS result':'SELECT garden_control.recover_lifecycle_control($1::jsonb) AS result';
   const result=exact(one(await db.query(sql,[JSON.stringify(scopedRequest)])),['result']).result;fence();
   value=phase==='prepare'?validateControlPreparation(p,c.intent,result):write?validateControlResult(p,recovery,result,c):phase==='status'?validateControlStatus(scope,result):validateControlResult(p,c,result);
   resultFingerprint=lifecycleControlResultFingerprint(value);
   const firstAdmission=delivery(exact(one(await db.query('SELECT garden_control.lifecycle_control_delivery() AS admission')),['admission']).admission,resultFingerprint);
   deliveryDeadline=Math.min(deliveryDeadline,Date.parse(firstAdmission.expiresAt));fence();
   await recheck();await assertDatabaseCapability(db,'garden_lifecycle_admin',{activeRole:true,login});fence();
   if(exact(one(await db.query('SELECT garden_control.check_lifecycle_control_context() AS admitted')),['admitted']).admitted!==true)fail();fence();
   await db.query('SELECT garden_control.clear_lifecycle_control_context()');fence();
   await recheck();fence();attempted=true;await db.query('COMMIT');completed=true;fence();
  }catch(error){
   if(error instanceof DatabaseCapabilityError||attempted&&!completed)bad=true;
   if(!completed)try{if(db)await db.query('ROLLBACK');}catch{bad=true;}throw unavailable();
  }finally{
   let cleanupFailed=false;try{db?.release(bad);}catch{cleanupFailed=true;}
   // Both tokens are retired only after the main TX releases all locks. A lost
   // issuer acknowledgement still leaves captured prebound tokens to retire.
   if(tokens){
    if(completed&&!cleanupFailed){
     try{
      const finalAdmission=await issuer('finish',[tokens.ticket,resultFingerprint]);
      deliveryDeadline=Math.min(deliveryDeadline,Date.parse(finalAdmission.expiresAt));fence();
     }catch{
      cleanupFailed=true;
      // The original mutation may already be durable. A rejected final
      // validation still attempts retirement and never releases its result.
      try{await issuer('retire',[tokens.ticket]);}catch{}
     }
    }else try{await issuer('retire',[tokens.ticket]);}catch{cleanupFailed=true;}
   }
   if(completed){if(cleanupFailed)throw unavailable();try{await recheck();fence();}catch{throw unavailable();}}
  }
  return controlFreeze({value,admission:{expiresAt:new Date(deliveryDeadline).toISOString(),resultFingerprint}});
 }
 const call=phase=>async(context,input,admit)=>{
  let p,c,permission;try{p=controlPrincipal(context,workspace);c=commandFor(phase,input,p);const scope=phase==='prepare'||phase==='commit'?c.intent.scope:c.scope;if(scope.workspaceId!==workspace)fail();permission=admission(admit);}catch{fail();}
  return run(p,c,phase,permission);
 };
 return Object.freeze({prepare:call('prepare'),commit:call('commit'),status:call('status'),recover:call('recover')});
}
