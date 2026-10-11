import {validateClaimRecord,preserveClaimKind,collectAffectedPlacements,dependencyIds} from '../../../packages/domain/src/historical/claims.mjs';
import {validateLocator,revision} from '../../../packages/domain/src/historical/locators.mjs';
import {validateSource,validateSourceGraph} from '../../../packages/domain/src/historical/sources.mjs';
import {uuid,reject} from '../../../packages/domain/src/historical/model.mjs';
import {PolicyError} from '../access/policy-context.mjs';
const deny=()=>{throw new PolicyError();};
export function createClaimRepository(executor){
 if(typeof executor?.run!=='function')reject();
 async function current(c,w,id,lock=false){const row=(await c.query('SELECT payload,version::text FROM garden_private.record_envelopes WHERE workspace_id=$1::uuid AND id=$2::uuid'+(lock?' FOR UPDATE':''),[w,id])).rows[0];if(!row)deny();return row;}
 async function pinned(c,w,r){const row=(await c.query('SELECT payload,version::text FROM garden_private.record_revisions WHERE workspace_id=$1::uuid AND record_id=$2::uuid AND version=$3::bigint',[w,r.id,r.revision])).rows[0];if(!row)deny();return row;}
 function reader(c,w){
  const done=new Set(),active=new Set(),cache=new Map();
  async function get(id,v=null){const key=id+':'+(v??'current');if(!cache.has(key)){if(cache.size>=512)deny();cache.set(key,v===null?await current(c,w,id):await pinned(c,w,{id,revision:v}));}return cache.get(key);}
  async function inspect(input,depth=0){
   if(depth>64)deny();const key=JSON.stringify(input);if(active.has(key))deny();if(done.has(key))return;active.add(key);
   if(input.recordType==='locator'){
    const v=validateLocator(input),source=validateSource((await get(v.source.id,v.source.revision)).payload);
    if(source.form!=='digital-representation'||source.representation.sha256!==v.resourceSha256)deny();
    await validateSourceGraph(source,async id=>(await get(id)).payload);
   }else if(['source','archival-unit'].includes(input.recordType))await validateSourceGraph(input,async id=>(await get(id)).payload);
   else{
    const v=validateClaimRecord(input);
    if(v.recordType==='claim'&&v.attribution){const loc=validateLocator((await get(v.attribution.locatorId)).payload);await inspect(loc,depth+1);}
    if(v.recordType==='evidence-link'){
     const claim=validateClaimRecord((await get(v.claim.id,v.claim.revision)).payload);if(claim.recordType!=='claim')deny();await inspect(claim,depth+1);
     await inspect(validateLocator((await get(v.locatorId)).payload),depth+1);
    }
    if(v.recordType==='claim-placement')for(const r of v.dependencies)await inspect(validateClaimRecord((await get(r.id,r.revision)).payload),depth+1);
   }
   active.delete(key);done.add(key);
  }
  return {get,inspect};
 }
 async function write(h,w,id,expected,input,initial){
  uuid(w);uuid(id);revision(expected);const v=validateClaimRecord(input);if(v.id!==id)reject();
  return executor.run(h,{workspaceId:w,action:'write'},async c=>{
   const old=await current(c,w,id,true);if(old.version!==expected)deny();
   if(initial){if(Object.keys(old.payload).length)deny();}else preserveClaimKind(old.payload,v);
   await reader(c,w).inspect(v);
   const row=(await c.query('UPDATE garden_private.record_envelopes SET payload=$4::jsonb WHERE workspace_id=$1::uuid AND id=$2::uuid AND version=$3::bigint RETURNING payload,version::text',[w,id,expected,JSON.stringify(v)])).rows[0];
   if(!row)deny();return {record:validateClaimRecord(row.payload),revision:row.version};
  });
 }
 return Object.freeze({
  initialize:(h,w,id,v,input)=>write(h,w,id,v,input,true),
  revise:(h,w,id,v,input)=>write(h,w,id,v,input,false),
  async read(h,w,id){uuid(w);uuid(id);return executor.run(h,{workspaceId:w},async c=>{const row=await current(c,w,id),v=validateClaimRecord(row.payload);await reader(c,w).inspect(v);return {record:v,revision:row.version};});},
  async history(h,w,id,{beforeRevision=null,limit=50}={}){
   uuid(w);uuid(id);if(beforeRevision!==null)revision(beforeRevision);if(!Number.isInteger(limit)||limit<1||limit>100)reject();
   return executor.run(h,{workspaceId:w},async c=>{
    const r=reader(c,w);await r.inspect(validateClaimRecord((await r.get(id)).payload));
    const rows=(await c.query('SELECT version::text,payload,changed_at FROM garden_private.record_revisions AS revisions WHERE workspace_id=$1::uuid AND record_id=$2::uuid AND ($3::bigint IS NULL OR revisions.version<$3::bigint) ORDER BY revisions.version DESC LIMIT $4::integer',[w,id,beforeRevision,limit+1])).rows;
    const versions=[];for(const row of rows.slice(0,limit)){const v=row.payload.recordType?validateClaimRecord(row.payload):null;if(v)await r.inspect(v);versions.push({revision:row.version,record:v,changedAt:row.changed_at});}
    return {versions,nextBeforeRevision:rows.length>limit?versions.at(-1).revision:null};
   });
  },
  async affectedPlacements(h,w,ids,options={}){
   uuid(w);if(!Array.isArray(ids))reject();for(const id of ids)uuid(id);
   return executor.run(h,{workspaceId:w},async c=>{
    const r=reader(c,w);for(const id of ids)await r.inspect((await r.get(id)).payload);
    const maxRecords=options.maxRecords??512;
    if(!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>512)reject();
    // One recursive statement sees one PostgreSQL MVCC snapshot. UNION terminates
    // duplicate paths/cycles; the executor's timeout and output bound fail closed.
    const rows=(await c.query(`WITH RECURSIVE affected(id) AS (
      SELECT unnest($2::uuid[]) UNION
      SELECT d.id FROM affected a CROSS JOIN LATERAL (
       SELECT r.id FROM garden_private.record_envelopes r WHERE r.workspace_id=$1::uuid
       AND garden_control.claim_dependency_ids(r.payload) @> ARRAY[a.id]
       UNION SELECT (e.payload#>>'{claim,id}')::uuid FROM garden_private.record_envelopes e
       WHERE e.workspace_id=$1::uuid AND e.id=a.id AND e.payload->>'recordType'='evidence-link'
      ) d
    ) SELECT r.payload,r.version::text FROM garden_private.record_envelopes r JOIN affected a ON a.id=r.id
    WHERE r.workspace_id=$1::uuid AND NOT r.id=ANY($2::uuid[]) ORDER BY r.id LIMIT $3::integer`,[w,ids,maxRecords+1])).rows;
    if(rows.length>maxRecords)deny();
    const candidates=[];for(const row of rows){await r.inspect(row.payload);candidates.push({record:row.payload,revision:row.version});}
    return collectAffectedPlacements(ids,async frontier=>candidates.filter(row=>dependencyIds(row.record).some(id=>frontier.includes(id))),options);
   });
  }
 });
}
