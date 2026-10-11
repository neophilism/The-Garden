import {validateHistorical, validateEntity, mergeEntities, unmergeEntity, preserveSourceIdentities, uuid, reject} from '../../../packages/domain/src/historical/model.mjs';
import {PolicyError} from '../access/policy-context.mjs';
const fields = 'id::text,workspace_id::text,version::text,payload';
const denied = () => { throw new PolicyError(); };
function expected(value) { if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) reject(); }
export function createHistoricalRepository(executor) {
  if (typeof executor?.run !== 'function') reject();
  async function load(c, workspace, id, lock = false) {
    const row = (await c.query(`SELECT ${fields} FROM garden_private.record_envelopes WHERE workspace_id=$1::uuid AND id=$2::uuid${lock ? ' FOR UPDATE' : ''}`, [workspace,id])).rows[0];
    if (!row) denied(); return row;
  }
  async function references(c, workspace, value) {
    const refs = value.recordType === 'relationship' ? [[value.fromId,value.fromKind],[value.toId,value.toKind]] : value.redirect ? [[value.redirect.targetId,value.kind]] : [];
    for (const [id,kind] of refs) {
      const target = validateEntity((await load(c,workspace,id)).payload);
      if (target.kind !== kind) denied();
    }
  }
  async function save(c, workspace, id, version, value) {
    expected(version); if (value.id !== id) reject();
    const result = await c.query(`UPDATE garden_private.record_envelopes SET payload=$4::jsonb WHERE workspace_id=$1::uuid AND id=$2::uuid AND version=$3::bigint RETURNING ${fields}`, [workspace,id,version,JSON.stringify(value)]);
    if (result.rows.length !== 1) denied();
    return {record: validateHistorical(result.rows[0].payload), revision: result.rows[0].version};
  }
  return Object.freeze({
    async read(headers,workspace,id) {
      uuid(workspace);uuid(id);
      return executor.run(headers,{workspaceId:workspace,recordId:id},async c=>{
        const row=await load(c,workspace,id),value=validateHistorical(row.payload);await references(c,workspace,value);return {record:value,revision:row.version};
      });
    },
    async initialize(headers,workspace,id,version,input) {
      uuid(workspace);uuid(id);expected(version);const value=validateHistorical(input);
      return executor.run(headers,{workspaceId:workspace,action:'write'},async c=>{
        const current=await load(c,workspace,id,true);
        if(Object.keys(current.payload).length!==0||current.version!==version)denied();
        await references(c,workspace,value);return save(c,workspace,id,version,value);
      });
    },
    async revise(headers,workspace,id,version,input) {
      uuid(workspace);uuid(id);expected(version);const value=validateHistorical(input);
      return executor.run(headers,{workspaceId:workspace,action:'write'},async c=>{
        const row=await load(c,workspace,id,true),old=validateHistorical(row.payload);
        if(row.version!==version||old.recordType!==value.recordType)denied();
        if(old.recordType==='entity'){
          preserveSourceIdentities(old,value);
          if(JSON.stringify(old.redirect)!==JSON.stringify(value.redirect))denied();
        }
        await references(c,workspace,value);return save(c,workspace,id,version,value);
      });
    },
    async merge(headers,workspace,sourceId,targetId,sourceRevision,targetRevision,decision) {
      uuid(workspace);uuid(sourceId);uuid(targetId);expected(sourceRevision);expected(targetRevision);
      if(sourceId===targetId)reject();
      return executor.run(headers,{workspaceId:workspace,action:'write'},async c=>{
        // A deterministic lock order serializes opposite-direction merges.
        const found=new Map();
        for(const id of [sourceId,targetId].sort()){
          const row=await load(c,workspace,id,true);
          const ok=(await c.query("SELECT garden_control.may_access_record($1::uuid,$2::uuid,'research','active','write') AS allowed",[workspace,id])).rows[0];
          if(ok?.allowed!==true)denied();found.set(id,row);
        }
        const source=found.get(sourceId),target=found.get(targetId);
        if(source.version!==sourceRevision||target.version!==targetRevision)denied();
        return save(c,workspace,sourceId,sourceRevision,mergeEntities(source.payload,target.payload,decision));
      });
    },
    async unmerge(headers,workspace,id,version) {
      uuid(workspace);uuid(id);expected(version);
      return executor.run(headers,{workspaceId:workspace,recordId:id,action:'write'},async c=>{
        const row=await load(c,workspace,id,true);if(row.version!==version)denied();
        return save(c,workspace,id,version,unmergeEntity(row.payload));
      });
    },
    async history(headers,workspace,id,{beforeRevision=null,limit=50}={}) {
      uuid(workspace);uuid(id);if(beforeRevision!==null)expected(beforeRevision);if(!Number.isInteger(limit)||limit<1||limit>100)reject();
      return executor.run(headers,{workspaceId:workspace,recordId:id},async c=>{
        validateHistorical((await load(c,workspace,id)).payload);
        const rows=(await c.query('SELECT version::text,payload,changed_at FROM garden_private.record_revisions WHERE workspace_id=$1::uuid AND record_id=$2::uuid AND ($3::bigint IS NULL OR version<$3::bigint) ORDER BY version DESC LIMIT $4::integer',[workspace,id,beforeRevision,limit+1])).rows;
        const output=[];for(const row of rows.slice(0,limit)){const value=row.payload.recordType?validateHistorical(row.payload):null;if(value)await references(c,workspace,value);output.push({revision:row.version,record:value,changedAt:row.changed_at});}return {versions:output,nextBeforeRevision:rows.length>limit?output.at(-1).revision:null};
      });
    }
  });
}
