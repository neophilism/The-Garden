import {validateSourceRecord,validateSourceGraph,preserveCatalogAssertions,compareSourceLineages} from '../../../packages/domain/src/historical/sources.mjs';
import {uuid,reject} from '../../../packages/domain/src/historical/model.mjs';
import {PolicyError} from '../access/policy-context.mjs';
const deny=()=>{throw new PolicyError();};
const version=value=>{if(typeof value!=='string'||!/^[1-9][0-9]{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)reject();};
/** All graph nodes pass the same current-membership and record-grant RLS. */
export function createSourceRepository(executor){
 if(typeof executor?.run!=='function')reject();
 async function load(c,workspace,id,lock=false){
  const r=(await c.query('SELECT payload,version::text FROM garden_private.record_envelopes WHERE workspace_id=$1::uuid AND id=$2::uuid'+(lock?' FOR UPDATE':''),[workspace,id])).rows[0];
  if(!r)deny();return r;
 }
 const graph=(c,w,v)=>validateSourceGraph(v,async id=>(await load(c,w,id)).payload);
 async function write(headers,w,id,expected,input,initial){
  uuid(w);uuid(id);version(expected);const value=validateSourceRecord(input);if(value.id!==id)reject();
  return executor.run(headers,{workspaceId:w,action:'write'},async c=>{
   // Lock before row acquisition. SQL triggers repeat the same guard for raw writes.
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended('garden/source-graph/'||$1::text,0))",[w]);
   const before=await load(c,w,id,true);if(before.version!==expected)deny();
   if(initial){if(Object.keys(before.payload).length)deny();}else preserveCatalogAssertions(before.payload,value);
   await graph(c,w,value);
   const r=(await c.query('UPDATE garden_private.record_envelopes SET payload=$4::jsonb WHERE workspace_id=$1::uuid AND id=$2::uuid AND version=$3::bigint RETURNING payload,version::text',[w,id,expected,JSON.stringify(value)])).rows[0];
   if(!r)deny();return {record:validateSourceRecord(r.payload),revision:r.version};
  });
 }
 return Object.freeze({
  initialize:(h,w,id,v,input)=>write(h,w,id,v,input,true),
  revise:(h,w,id,v,input)=>write(h,w,id,v,input,false),
  async read(h,w,id){uuid(w);uuid(id);return executor.run(h,{workspaceId:w},async c=>{const r=await load(c,w,id);return {record:await graph(c,w,r.payload),revision:r.version};});},
  async compareLineages(h,w,ids){uuid(w);return executor.run(h,{workspaceId:w},c=>compareSourceLineages(ids,async id=>(await load(c,w,id)).payload));},
  async history(h,w,id,{beforeRevision=null,limit=50}={}){
   uuid(w);uuid(id);if(beforeRevision!==null)version(beforeRevision);if(!Number.isInteger(limit)||limit<1||limit>100)reject();
   return executor.run(h,{workspaceId:w},async c=>{
    await graph(c,w,(await load(c,w,id)).payload);
    const rows=(await c.query('SELECT version::text,payload,changed_at FROM garden_private.record_revisions WHERE workspace_id=$1::uuid AND record_id=$2::uuid AND ($3::bigint IS NULL OR version<$3::bigint) ORDER BY version DESC LIMIT $4::integer',[w,id,beforeRevision,limit+1])).rows;
    const versions=[];
    for(const row of rows.slice(0,limit))versions.push({revision:row.version,record:row.payload.recordType?await graph(c,w,row.payload):null,changedAt:row.changed_at});
    return {versions,nextBeforeRevision:rows.length>limit?versions.at(-1).revision:null};
   });
  }
 });
}
