import {randomUUID} from 'node:crypto';
import {ReviewError,reviewId,reviewVersion,validateReviewTransition,validateReviewReopening,validateImportedReview,validateReviewSnapshot,validateReviewHistory} from '../../../packages/domain/src/review/states.mjs';
const fail=()=>{throw new ReviewError();};
/** Only server-owned policy executors enter the DB. There is no subject/role
 * argument and no mounted HTTP endpoint. PostgreSQL independently checks the
 * current context, exact revision, assignment receipt, evidence and consent. */
export function createReviewRepository(executor){
 if(typeof executor?.run!=='function')fail();
 async function run(headers,w,sql,args,check){
  reviewId(w);try{return await executor.run(headers,{workspaceId:w},async c=>{
   const r=await c.query(sql,args);if(r.rows.length!==1)fail();return check(r.rows[0].value);
  });}catch{fail();}
 }
 function boundSnapshot(scope,value){const s=validateReviewSnapshot(value);if(s.scope.id!==scope)fail();return s;}
 async function record(headers,w,scope,kind,input){
  reviewId(scope);const value=kind==='transition'?validateReviewTransition(input):kind==='reopen'?validateReviewReopening(input):validateImportedReview(input);
  return run(headers,w,'SELECT garden_control.record_scoped_status($1::uuid,$2::uuid,$3::text,$4::jsonb) AS value',[w,scope,kind,JSON.stringify(value)],v=>boundSnapshot(scope,v));
 }
 return Object.freeze({
  async register(headers,w,recordId,revision){reviewId(recordId);reviewVersion(revision);return run(headers,w,'SELECT garden_control.register_review_scope($1::uuid,$2::uuid,$3::uuid,$4::bigint)::text AS value',[w,randomUUID(),recordId,revision],reviewId);},
  async assign(headers,w,scope,reviewer,kind){
   reviewId(scope);if(typeof reviewer!=='string'||!reviewer.trim()||reviewer.length>128||!reviewer.isWellFormed()||/[\x00-\x1f\x7f]/.test(reviewer)||!['research','rights','community'].includes(kind))fail();
   return run(headers,w,'SELECT garden_control.assign_scoped_reviewer($1::uuid,$2::uuid,$3::text,$4::text)::text AS value',[w,scope,reviewer,kind],reviewId);
  },
  async snapshot(headers,w,scope){reviewId(scope);return run(headers,w,'SELECT garden_control.scoped_review_snapshot($1::uuid,$2::uuid) AS value',[w,scope],v=>boundSnapshot(scope,v));},
  transition:(h,w,s,v)=>record(h,w,s,'transition',v),reopen:(h,w,s,v)=>record(h,w,s,'reopen',v),importObservation:(h,w,s,v)=>record(h,w,s,'import-observation',v),
  async history(headers,w,scope,options={}){
   reviewId(scope);if(!options||Object.getPrototypeOf(options)!==Object.prototype||Object.keys(options).some(k=>!['after','limit'].includes(k)))fail();
   const after=options.after??'0',limit=options.limit??50;reviewVersion(after,{zero:true});if(!Number.isInteger(limit)||limit<1||limit>100)fail();
   return run(headers,w,'SELECT garden_control.scoped_review_history($1::uuid,$2::uuid,$3::bigint,$4::integer) AS value',[w,scope,after,limit],v=>{const h=validateReviewHistory(v);if(h.events.length>limit||h.events.some(e=>e.scopeId!==scope||BigInt(e.sequence)<=BigInt(after)))fail();return h;});
  }
 });
}
