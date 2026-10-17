import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {privateStagingConfiguration,STAGING_ACCESS_TOKEN,hardenStagingServer} from '../services/runtime/private-staging.mjs';

const [surface,...extra]=process.argv.slice(2);
if(extra.length)throw new Error('Expected public or research surface');
const {access}=privateStagingConfiguration(surface);
delete process.env[STAGING_ACCESS_TOKEN];
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid listening port');
const hostname=process.env.RENDER?'0.0.0.0':'127.0.0.1';
const {releaseMetadata}=await import('../services/runtime/release.mjs');
const release=releaseMetadata();
let server,drain;
if(surface==='public'){
 const {publicServer}=await import('../services/runtime/public-server.mjs');
 const app=await publicServer({root:fileURLToPath(new URL('../apps/public/out',import.meta.url)),release,access});
 server=app.server;drain=app.drain;
}else{
 const {default:next}=await import('next');
 // A custom server puts the boundary ahead of every Next route and asset. No
 // second listener, middleware matcher, header shortcut or public proxy target.
 const app=next({dev:false,dir:fileURLToPath(new URL('../apps/research',import.meta.url)),hostname,port,quiet:true});
 await app.prepare();
 const handler=app.getRequestHandler();let draining=false;
 server=createServer({maxHeaderSize:16384,requestTimeout:10000,headersTimeout:10000,shouldUpgradeCallback:()=>false},async(req,res)=>{
  if(!access(req,res))return;
  if(draining){res.writeHead(503);res.end();return;}
  try{await handler(req,res);}catch{
   if(res.headersSent)res.destroy();else{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"request_failed"}');}
  }
 });
 drain=()=>{draining=true;server.close(()=>app.close());server.closeIdleConnections();};
}
hardenStagingServer(server);
server.listen(port,hostname,()=>console.log(JSON.stringify({event:'service_started',service:surface,access:'owner_private_staging'})));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
 drain();setTimeout(()=>server.closeAllConnections(),10000).unref();
});
