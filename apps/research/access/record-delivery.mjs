import {createHash} from 'node:crypto';
import {UUID} from './roles.mjs';
import {PolicyError} from './policy-context.mjs';
import {validDeliverySelector} from './delivery-capabilities.mjs';
const fail=()=>{throw new PolicyError();};
const channels=new Set(['record','snippet','export','notification','collaboration']);
const kinds=new Set(['person','polity','people','language','place','port','institution','voyage','event','source']);
const plain=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
function validRow(row){if(!row||!UUID.test(row.id)||!UUID.test(row.workspace_id)||typeof row.version!=='string'||!(/^[1-9][0-9]{0,18}$/).test(row.version)||!row.payload||Object.getPrototypeOf(row.payload)!==Object.prototype)fail();return row;}
export function recordProjection(row,channel='record'){
 validRow(row);if(!channels.has(channel))fail();
 const title=plain(row.payload.title,300)?row.payload.title:'Untitled working record';
 const base={id:row.id,revision:row.version,title,kind:kinds.has(row.payload.kind)?row.payload.kind:'unspecified',reviewStatus:'unreviewed'};
 if(channel==='snippet')return {...base,snippet:plain(row.payload.summary,1000)?row.payload.summary.slice(0,240):''};
 if(channel==='notification'||channel==='collaboration')return {id:base.id,revision:base.revision,title:base.title};
 return base;
}
export function createRecordRepository(executor){
 if(typeof executor?.run!=='function')fail();
 return Object.freeze({
  async find(headers,workspace,record){return executor.run(headers,{workspaceId:workspace,recordId:record},async c=>{
   const rows=(await c.query('SELECT id::text,workspace_id::text,version::text,payload FROM garden_private.record_envelopes WHERE workspace_id=$1::uuid AND id=$2::uuid',[workspace,record])).rows;
   if(rows.length!==1)fail();return validRow(rows[0]);
  });},
  async search(headers,workspace,{query='',limit=20}={}){
   if(!plain(query,128)||!Number.isInteger(limit)||limit<1||limit>50)fail();
   return executor.run(headers,{workspaceId:workspace},async c=>{
    // RLS applies before pagination, count and facet aggregation. One statement
    // uses one READ COMMITTED snapshot for these related observations.
    const result=(await c.query(`WITH visible AS MATERIALIZED (
      SELECT id,workspace_id,version,payload,CASE WHEN payload->>'kind' IN ('person','polity','people','language','place','port','institution','voyage','event','source') THEN payload->>'kind' ELSE 'unspecified' END AS kind
      FROM garden_private.record_envelopes WHERE workspace_id=$1::uuid AND strpos(lower(COALESCE(payload->>'title','')),lower($2::text))>0
     ), page AS (SELECT * FROM visible ORDER BY id LIMIT $3::integer), facets AS (SELECT kind,count(*)::text AS total FROM visible GROUP BY kind)
     SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'workspace_id',workspace_id,'version',version::text,'payload',payload) ORDER BY id) FROM page),'[]') AS records,
      (SELECT count(*)::text FROM visible) AS total,COALESCE((SELECT jsonb_object_agg(kind,total) FROM facets),'{}') AS facets`,[workspace,query,limit])).rows[0];
    if(!result||!Array.isArray(result.records)||!/^[0-9]+$/.test(result.total)||!result.facets||Object.entries(result.facets).some(([k,v])=>(!kinds.has(k)&&k!=='unspecified')||typeof v!=='string'||!/^[0-9]+$/.test(v)))fail();
    return {records:result.records.map(x=>recordProjection(x,'snippet')),total:result.total,facets:result.facets,query,limit};
   });
  }
 });
}
function asset(row,kind,selector){
 validRow(row);if(!validDeliverySelector(kind,selector))fail();
 const key=kind==='tile'?'tile:'+selector:kind;
 const item=row.payload.assets?.[key],ref=item?.ref;
 if(!item||!ref||ref.sourceId!==row.id||!['original','derivative'].includes(ref.kind)||!UUID.test(ref.version)||!(/^[a-f0-9]{64}$/).test(ref.sha256)||!Number.isSafeInteger(ref.size)||ref.size<1||ref.size>8*1024*1024)fail();
 const allowed={download:['application/octet-stream','application/pdf','text/plain','image/png','image/jpeg','image/webp','audio/mpeg','audio/ogg','video/mp4'],media:['audio/mpeg','audio/ogg','video/mp4'],tile:['image/png','image/jpeg','image/webp']};
 if(!allowed[kind].includes(item.mediaType))fail();
 return {ref:Object.freeze({...ref}),mediaType:item.mediaType,revision:row.version};
}
export function byteRange(header,size){
 if(!Number.isSafeInteger(size)||size<1||size>8*1024*1024)fail();
 if(header===null)return {start:0,end:size-1,partial:false};
 if(typeof header!=='string'||!/^bytes=[0-9]{1,12}-[0-9]{0,12}$/.test(header))fail();
 const [a,b]=header.slice(6).split('-'),start=Number(a),end=b===''?size-1:Number(b);
 if(!Number.isSafeInteger(size)||size<1||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>=size)fail();
 return {start,end,partial:true};
}
export function createRecordDelivery({identity,repository,archiveStore,capabilities,origin,enabled=()=>false}){
 if(typeof identity?.viewer!=='function'||typeof repository?.find!=='function'||typeof repository?.search!=='function'||typeof archiveStore?.read!=='function'||typeof capabilities?.issue!=='function'||typeof capabilities?.verify!=='function'||typeof enabled!=='function')fail();
 const base=new URL(origin);if(base.origin!==origin||base.protocol!=='https:')fail();
 async function actor(headers){if(await enabled()!==true)fail();const a=await identity.viewer(headers);if(!a||a.verified!==true||typeof a.id!=='string'||!a.id)fail();return a;}
 async function current(headers,a,workspace,record){if((await actor(headers)).id!==a.id)fail();return repository.find(headers,workspace,record);}
 return Object.freeze({
  async project(headers,{workspace,record,channel='record'}){const a=await actor(headers),row=await current(headers,a,workspace,record);return recordProjection(row,channel);},
  async search(headers,workspace,options){await actor(headers);return repository.search(headers,workspace,options);},
  async issue(headers,{workspace,record,kind,selector=null,range=null}){
   const a=await actor(headers),row=await current(headers,a,workspace,record),item=asset(row,kind,selector);byteRange(range,item.ref.size);
   const token=capabilities.issue({subjectId:a.id,workspace,record,revision:row.version,assetVersion:item.ref.version,kind,selector,range});
   const url=new URL('/api/research/workspaces/'+workspace+'/records/'+record+'/'+kind,origin);url.searchParams.set('cap',token);if(selector!==null)url.searchParams.set('selector',selector);
   return {url:url.toString(),expiresInSeconds:30,requiresAuthenticatedSession:true,publicStorageUrl:false};
  },
  async bytes(headers,{workspace,record,kind,selector=null,range=null,token}){
   const a=await actor(headers),claim=capabilities.verify(token,{subjectId:a.id,workspace,record,kind,selector,range});
   const row=await current(headers,a,workspace,record),item=asset(row,kind,selector);
   if(claim.revision!==row.version||claim.assetVersion!==item.ref.version)fail();
   const selected=byteRange(range,item.ref.size);
   // Internal archive transport validates endpoint, key and complete original hash.
   // Never return its S3 URL. Buffer is bounded; unreviewed large streaming is off.
   const bytes=await archiveStore.read(Object.freeze({subjectId:a.id,workspace,record,headers}),item.ref);
   if(!(bytes instanceof Uint8Array)||bytes.byteLength!==item.ref.size||createHash('sha256').update(bytes).digest('hex')!==item.ref.sha256)fail();
   const after=await current(headers,a,workspace,record),afterAsset=asset(after,kind,selector);
   capabilities.verify(token,{subjectId:a.id,workspace,record,kind,selector,range});
   if(after.version!==row.version||afterAsset.ref.version!==item.ref.version||afterAsset.ref.sha256!==item.ref.sha256||afterAsset.mediaType!==item.mediaType)fail();
   return {bytes:bytes.slice(selected.start,selected.end+1),mediaType:item.mediaType,total:item.ref.size,...selected};
  }
 });
}
const safeHeaders=()=>({'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox; frame-ancestors 'none'"});
export function createDeliveryHandler({service,origin}){
 return async request=>{
  const json=(value,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(value),{status,headers:{...safeHeaders(),'Content-Type':'application/json; charset=utf-8'}});
  try{
   const url=new URL(request.url);if(url.origin!==origin||request.headers.has('origin')&&request.headers.get('origin')!==origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site')))throw new PolicyError();
   const parts=url.pathname.match(/^\/api\/research\/workspaces\/([a-f0-9-]+)\/(search|records)(?:\/([a-f0-9-]+)(?:\/([a-z]+))?)?$/);
   if(!parts||!UUID.test(parts[1]))throw new PolicyError();
   const [,workspace,mode,record,channel='record']=parts;
   if(mode==='search'){
    if(record||!['GET','HEAD'].includes(request.method)||[...url.searchParams.keys()].some(k=>!['q','view'].includes(k))||url.searchParams.getAll('q').length>1||url.searchParams.getAll('view').length>1)throw new PolicyError();
    const view=url.searchParams.get('view')??'results';if(!['results','count','facets'].includes(view))throw new PolicyError();
    const found=await service.search(request.headers,workspace,{query:url.searchParams.get('q')??''});
    return json(view==='count'?{total:found.total}:view==='facets'?{facets:found.facets}:found);
   }
   if(!UUID.test(record))throw new PolicyError();
   if(channel==='capability'){
    if(request.method!=='POST'||request.headers.get('origin')!==origin||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||url.search)throw new PolicyError();
    const reader=request.body?.getReader();if(!reader)throw new PolicyError();const chunks=[];let size=0;
    try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new PolicyError();}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
    const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size)));
    if(!body||Object.getPrototypeOf(body)!==Object.prototype||Object.keys(body).some(k=>!['kind','selector','range'].includes(k)))throw new PolicyError();
    return json(await service.issue(request.headers,{workspace,record,...body}));
   }
   if(!['GET','HEAD'].includes(request.method))throw new PolicyError();
   if(['download','media','tile'].includes(channel)){
    if([...url.searchParams.keys()].some(k=>!['cap','selector'].includes(k))||url.searchParams.getAll('cap').length!==1||url.searchParams.getAll('selector').length>1)throw new PolicyError();
    const value=await service.bytes(request.headers,{workspace,record,kind:channel,selector:url.searchParams.get('selector'),range:request.headers.get('range'),token:url.searchParams.get('cap')});
    const headers={...safeHeaders(),'Content-Type':value.mediaType,'Content-Length':String(value.bytes.byteLength),'Accept-Ranges':'bytes','Content-Disposition':channel==='download'?'attachment; filename="research-record.bin"':'inline'};
    if(value.partial)headers['Content-Range']='bytes '+value.start+'-'+value.end+'/'+value.total;
    return new Response(request.method==='HEAD'?null:value.bytes,{status:value.partial?206:200,headers});
   }
   if(!channels.has(channel)||url.search)throw new PolicyError();
   const projected=await service.project(request.headers,{workspace,record,channel});
   if(channel==='export')return new Response(request.method==='HEAD'?null:JSON.stringify(projected),{headers:{...safeHeaders(),'Content-Type':'application/json','Content-Disposition':'attachment; filename="research-record.json"'}});
   return json(projected);
  }catch{return json({error:'not_available'},404);}
 };
}
