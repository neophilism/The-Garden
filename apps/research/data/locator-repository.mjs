import {validateLocator,validateLocatorRecord,revision} from '../../../packages/domain/src/historical/locators.mjs';
import {validateSource,validateSourceGraph} from '../../../packages/domain/src/historical/sources.mjs';
import {uuid,reject} from '../../../packages/domain/src/historical/model.mjs';
import {PolicyError} from '../access/policy-context.mjs';
const deny=()=>{throw new PolicyError();};
/** Locator payloads and reanchor proposals are immutable; use a new record for a new anchor. */
export function createLocatorRepository(executor) {
  if(typeof executor?.run!=='function') reject();
  async function current(c,w,id,lock=false) {
    const row=(await c.query('SELECT payload,version::text FROM garden_private.record_envelopes WHERE workspace_id=$1::uuid AND id=$2::uuid'+(lock?' FOR UPDATE':''),[w,id])).rows[0];
    if(!row) deny(); return row;
  }
  async function target(c,w,v) {
    const row=(await c.query('SELECT payload FROM garden_private.record_revisions WHERE workspace_id=$1::uuid AND record_id=$2::uuid AND version=$3::bigint',[w,v.source.id,v.source.revision])).rows[0];
    if(!row) deny(); const source=validateSource(row.payload);
    if(source.form!=='digital-representation'||source.representation.sha256!==v.resourceSha256) deny();
    const mime=source.representation.mediaType;
    if(v.selector.type==='image'&&!(mime.startsWith('image/')||mime==='application/pdf'&&v.page!==null)) deny();
    if(v.selector.type==='time'&&!/^(audio|video)\//.test(mime)) deny();
    await validateSourceGraph(source,async id=>(await current(c,w,id)).payload);
  }
  async function references(c,w,v) {
    if(v.recordType==='locator') return target(c,w,v);
    for(const id of [v.fromLocatorId,v.toLocatorId]) await target(c,w,validateLocator((await current(c,w,id)).payload));
  }
  return Object.freeze({
    async initialize(h,w,id,expected,input) {
      uuid(w);uuid(id);revision(expected);const v=validateLocatorRecord(input);if(v.id!==id) reject();
      return executor.run(h,{workspaceId:w,action:'write'},async c=>{
        const old=await current(c,w,id,true);
        if(old.version!==expected||Object.keys(old.payload).length) deny();
        await references(c,w,v);
        const row=(await c.query('UPDATE garden_private.record_envelopes SET payload=$4::jsonb WHERE workspace_id=$1::uuid AND id=$2::uuid AND version=$3::bigint RETURNING payload,version::text',[w,id,expected,JSON.stringify(v)])).rows[0];
        if(!row) deny();return {record:validateLocatorRecord(row.payload),revision:row.version};
      });
    },
    async read(h,w,id) {
      uuid(w);uuid(id);return executor.run(h,{workspaceId:w},async c=>{
        const row=await current(c,w,id),v=validateLocatorRecord(row.payload);await references(c,w,v);return {record:v,revision:row.version};
      });
    }
  });
}
