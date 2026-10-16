import {fileURLToPath} from 'node:url';
import {assertProcessConfiguration} from '../config/validate-process.mjs';
import {releaseMetadata} from '../services/runtime/release.mjs';
import {publicServer} from '../services/runtime/public-server.mjs';
assertProcessConfiguration('public');
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid listening port');
const app=await publicServer({root:fileURLToPath(new URL('../apps/public/out',import.meta.url)),release:releaseMetadata()});
app.server.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'service_started',service:'public'})));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
 app.drain();setTimeout(()=>app.server.closeAllConnections(),10000).unref();
});
