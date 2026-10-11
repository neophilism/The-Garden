import { randomUUID } from 'node:crypto';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** The query dependency uses parameterized SQL on a scoped worker connection.
 * Handlers receive opaque references only, never queue-embedded source bytes.
 */
export function createJobWorker({query,authorize,handlers,workerId=randomUUID()}){
 if(typeof query!=='function'||typeof authorize!=='function'||!handlers||!UUID.test(workerId))throw new Error('Invalid Garden worker configuration');
 return Object.freeze({async tick(){
  let job;
  try{
   const claimed=await query('SELECT * FROM garden_control.claim_jobs($1,$2,$3)',[workerId,1,60]);
   job=claimed.rows[0];if(!job)return {status:'idle'};
   const context=Object.freeze({jobId:job.job_id,contentRef:job.content_ref,subjectId:job.subject_id,scopeId:job.scope_id,classification:job.classification,traceId:job.trace_id,grantVersion:job.grant_version});
   if((await authorize(context))!==true){await query('SELECT garden_control.fail_job($1,$2,$3,$4)',[job.job_id,workerId,job.lease_epoch,'revoked']);return {status:'denied'};}
   const handler=Object.hasOwn(handlers,job.kind)?handlers[job.kind]:null;
   if(typeof handler!=='function'){await query('SELECT garden_control.fail_job($1,$2,$3,$4)',[job.job_id,workerId,job.lease_epoch,'corrupt']);return {status:'unsupported'};}
   const output=await handler(context,{signal:AbortSignal.timeout(45000)});
   if(!output||!UUID.test(output.resultRef))throw new Error('invalid result reference');
   if((await authorize(context))!==true){await query('SELECT garden_control.fail_job($1,$2,$3,$4)',[job.job_id,workerId,job.lease_epoch,'revoked']);return {status:'denied'};}
   const done=await query('SELECT garden_control.complete_job($1,$2,$3,$4,$5) AS committed',[job.job_id,workerId,job.lease_epoch,randomUUID(),output.resultRef]);
   return {status:done.rows[0]?.committed===true?'committed':'fenced'};
  }catch{
   if(!job)return {status:'unavailable'};
   try{await query('SELECT garden_control.fail_job($1,$2,$3,$4)',[job.job_id,workerId,job.lease_epoch,'transient']);return {status:'retry_scheduled_or_fenced'};}
   catch{return {status:'lease_unconfirmed'};}
  }
 }});
}
/** A consumer's database side effect and receipt share ONE transaction.
 * External effects require independent idempotency; no exactly-once claim.
 */
export async function consumeOnce({transaction,eventId,consumer,apply}){
 if(!UUID.test(eventId)||!/^[a-z][a-z0-9_-]{0,63}$/.test(consumer)||typeof transaction!=='function'||typeof apply!=='function')throw new Error('Invalid Garden consumer');
 return transaction(async tx=>{
  const result=await tx.query('SELECT garden_control.consume_event($1,$2) AS first',[eventId,consumer]);
  if(result.rows[0]?.first!==true)return {applied:false};
  await apply(tx,eventId);return {applied:true};
 });
}
