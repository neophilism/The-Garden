import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readdir,readFile,stat} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {requestObservation} from './telemetry.mjs';

const mime={'.html':'text/html; charset=utf-8','.txt':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};
const baseline={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
 'X-Robots-Tag':'noindex, nofollow, noarchive','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin'
};
function csp(html){
 const hashes=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(x=>x[1]).map(x=>"'sha256-"+createHash('sha256').update(x[1]).digest('base64')+"'");
 return "default-src 'none'; script-src 'self' "+hashes.join(' ')+"; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
}
/** Index only the built export. Requests never become filesystem paths. */
export async function publicServer({root,release,write,access}){
 const files=new Map();
 async function scan(relative=''){
  for(const item of await readdir(join(root,relative),{withFileTypes:true})){
   if(item.isSymbolicLink()||item.name.startsWith('.'))continue;
   const path=join(relative,item.name);
   if(item.isDirectory()){await scan(path);continue;}
   if(!item.isFile()||!mime[extname(path)])continue;
   const absolute=join(root,path),size=(await stat(absolute)).size;
   const html=extname(path)==='.html';
   const file={absolute,size,type:mime[extname(path)],csp:html?csp(await readFile(absolute,'utf8')):undefined};
   files.set('/'+path,file);
   if(path==='index.html')files.set('/',file);
   else if(path.endsWith('/index.html')){files.set('/'+path.slice(0,-10),file);files.set('/'+path.slice(0,-11),file);}
  }
 }
 await scan();if(!files.has('/'))throw new Error('Public export is missing');
 let draining=false;
 const server=createServer({maxHeaderSize:16384,requestTimeout:10000,headersTimeout:10000,shouldUpgradeCallback:()=>false},async(req,res)=>{
  if(access&&!access(req,res))return;
  const observation=requestObservation('public',write);let route='not_found';
  res.on('finish',()=>observation.complete(route,res.statusCode));
  res.on('close',()=>observation.complete(route,res.writableFinished?res.statusCode:499));
  for(const [key,value]of Object.entries(baseline))res.setHeader(key,value);
  res.setHeader('X-Request-ID',observation.requestId);
  function json(value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:JSON.stringify(value));}
  if(!['GET','HEAD'].includes(req.method)){route='method_denied';res.setHeader('Allow','GET, HEAD');return json({error:'method_not_allowed'},405);}
  // Reject encoded/noncanonical segments before URL normalization can erase them.
  const path=(req.url??'').split('?')[0];
  if(path.length>2048||!path.startsWith('/')||path.startsWith('//')||/[\\%\x00-\x20]/.test(path)||path.split('/').some(s=>s==='.'||s==='..'))return json({error:'not_found'},404);
  if(path==='/api/live'||path==='/api/health'){route='liveness';return json({...release,service:'public',status:'alive',private_record_access:false});}
  if(path==='/api/ready'){route='readiness';return json({...release,service:'public',status:draining?'draining':'ready',dependencies:{public_export:'available',database:'not_required',identity:'not_required'}},draining?503:200);}
  const file=files.get(path);
  if(!file)return json({error:'not_found'},404);
  route=file.type.startsWith('text/html')?'public_page':'public_asset';
  res.setHeader('Content-Type',file.type);res.setHeader('Content-Length',file.size);
  if(file.csp)res.setHeader('Content-Security-Policy',file.csp);
  if(req.method==='HEAD'){res.end();return;}
  try{await pipeline(createReadStream(file.absolute),res);}catch{res.destroy();}
 });
 server.keepAliveTimeout=5000;
 return Object.freeze({server,drain(){draining=true;server.close();server.closeIdleConnections();}});
}
