import {validateGeographicAssertion,preserveGeographicIdentity,GeographyError} from '../../../packages/domain/src/historical/geography.mjs';
import {uuid,validateEntity} from '../../../packages/domain/src/historical/model.mjs';
import {revision} from '../../../packages/domain/src/historical/locators.mjs';
import {validateClaimRecord} from '../../../packages/domain/src/historical/claims.mjs';
import {createClaimRepository} from './claim-repository.mjs';
import {createLocatorRepository} from './locator-repository.mjs';
import {PolicyError} from '../access/policy-context.mjs';
const deny=()=>{throw new PolicyError();};
/** Runs inside the existing server-owned transaction; no caller roles or SQL. */
export async function inspectGeographicReferences(client,workspace,value){
 const v=validateGeographicAssertion(value);
 const local={run:(_headers,_scope,work)=>work(client)};
 const claims=createClaimRepository(local),locators=createLocatorRepository(local);
 async function pinned(ref){const row=(await client.query('SELECT payload,version::text FROM garden_private.record_revisions WHERE workspace_id=$1::uuid AND record_id=$2::uuid AND version=$3::bigint',[workspace,ref.id,ref.revision])).rows[0];if(!row)deny();return row;}
 const subject=validateEntity((await pinned(v.subject)).payload);
 if(subject.kind!==v.subject.kind||subject.redirect!==null)deny();
 const claim=validateClaimRecord((await pinned(v.claim)).payload);
 if(claim.recordType!=='claim'||claim.assertionType==='policy-statement')deny();
 // Reuse complete current source/ancestor checks, plus the pinned testimony.
 await claims.read(null,workspace,v.claim.id);
 if(claim.attribution)await locators.read(null,workspace,claim.attribution.locatorId);
 for(const ref of v.evidence){
  const edge=validateClaimRecord((await pinned(ref)).payload);
  if(edge.recordType!=='evidence-link'||edge.claim.id!==v.claim.id||edge.claim.revision!==v.claim.revision)deny();
  await claims.read(null,workspace,ref.id);
 }
}
export function createGeographyRepository(executor){
 if(typeof executor?.run!=='function')throw new GeographyError();
 async function current(c,w,id,lock=false){const r=(await c.query('SELECT payload,version::text FROM garden_private.record_envelopes WHERE workspace_id=$1::uuid AND id=$2::uuid'+(lock?' FOR UPDATE':''),[w,id])).rows[0];if(!r)deny();return r;}
 async function save(h,w,id,expected,input,initial){
  uuid(w);uuid(id);revision(expected);const v=validateGeographicAssertion(input);if(v.id!==id)throw new GeographyError();
  // Sensitive case/location storage and display is deliberately unavailable.
  if(v.sensitivity!=='historical')deny();
  return executor.run(h,{workspaceId:w,action:'write'},async c=>{
   const old=await current(c,w,id,true);if(old.version!==expected)deny();
   if(initial){if(Object.keys(old.payload).length)deny();}else{
    preserveGeographicIdentity(old.payload,v);
   }
   await inspectGeographicReferences(c,w,v);
   const r=(await c.query('UPDATE garden_private.record_envelopes SET payload=$4::jsonb WHERE workspace_id=$1::uuid AND id=$2::uuid AND version=$3::bigint RETURNING payload,version::text',[w,id,expected,JSON.stringify(v)])).rows[0];
   if(!r)deny();return {record:validateGeographicAssertion(r.payload),revision:r.version};
  });
 }
 return Object.freeze({
  initialize:(h,w,id,v,input)=>save(h,w,id,v,input,true),revise:(h,w,id,v,input)=>save(h,w,id,v,input,false),
  async read(h,w,id){uuid(w);uuid(id);return executor.run(h,{workspaceId:w},async c=>{const r=await current(c,w,id),v=validateGeographicAssertion(r.payload);if(v.sensitivity!=='historical')deny();await inspectGeographicReferences(c,w,v);return {record:v,revision:r.version};});},
  async history(h,w,id,{beforeRevision=null,limit=50}={}){
   uuid(w);uuid(id);if(beforeRevision!==null)revision(beforeRevision);if(!Number.isInteger(limit)||limit<1||limit>100)throw new GeographyError();
   return executor.run(h,{workspaceId:w},async c=>{
    const now=validateGeographicAssertion((await current(c,w,id)).payload);if(now.sensitivity!=='historical')deny();await inspectGeographicReferences(c,w,now);
    const rows=(await c.query('SELECT version::text,payload,changed_at FROM garden_private.record_revisions AS revisions WHERE workspace_id=$1::uuid AND record_id=$2::uuid AND ($3::bigint IS NULL OR revisions.version<$3::bigint) ORDER BY revisions.version DESC LIMIT $4::integer',[w,id,beforeRevision,limit+1])).rows;
    const versions=[];for(const r of rows.slice(0,limit)){const v=r.payload.recordType?validateGeographicAssertion(r.payload):null;if(v){if(v.sensitivity!=='historical')deny();await inspectGeographicReferences(c,w,v);}versions.push({record:v,revision:r.version,changedAt:r.changed_at});}
    return {versions,nextBeforeRevision:rows.length>limit?versions.at(-1).revision:null};
   });
  }
 });
}
