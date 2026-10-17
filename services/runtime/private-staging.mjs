import {createHash,timingSafeEqual} from 'node:crypto';
import {assertProcessConfiguration} from '../../config/validate-process.mjs';

export const STAGING_ACCESS_TOKEN='GARDEN_STAGING_PREVIEW_ACCESS_TOKEN';
const protectedHeaders={
 'cache-control':'private, no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-frame-options':'DENY',
 'x-robots-tag':'noindex, nofollow, noarchive',
 'permissions-policy':'camera=(), microphone=(), geolocation=()',
 'cross-origin-resource-policy':'same-origin'
};
const digest=value=>createHash('sha256').update(value).digest();

/** Exactly 256 random bits, using Render's standard base64 or base64url format. */
export function validStagingToken(value){
 if(typeof value!=='string')return false;
 const encoding=/^[A-Za-z0-9+/]{43}=$/.test(value)?'base64':/^[A-Za-z0-9_-]{43}$/.test(value)?'base64url':null;
 if(!encoding)return false;
 const bytes=Buffer.from(value,encoding);
 return bytes.length===32&&bytes.toString(encoding)===value;
}

function reject(code){throw new Error('Private staging configuration rejected: '+code);}

/**
 * The ingress owns one credential. Application/build children receive none of it.
 * All other environment entries still pass through the existing isolation guard.
 */
export function privateStagingConfiguration(surface,env=process.env){
 if(!['public','research'].includes(surface))reject('surface');
 if(env.GARDEN_ENV!=='staging')reject('environment');
 if(!validStagingToken(env[STAGING_ACCESS_TOKEN]))reject('access_token');
 if(env.ENABLE_RESEARCH&&!['false'].includes(env.ENABLE_RESEARCH))reject('research_must_remain_disabled');
 const applicationEnv={...env};delete applicationEnv[STAGING_ACCESS_TOKEN];
 assertProcessConfiguration(surface,applicationEnv);
 const access=createAccess(digest(env[STAGING_ACCESS_TOKEN]),Boolean(env.RENDER));
 return Object.freeze({applicationEnv:Object.freeze(applicationEnv),access});
}

function authorization(req){
 const values=[];
 for(let i=0;i<req.rawHeaders.length;i+=2)if(req.rawHeaders[i].toLowerCase()==='authorization')values.push(req.rawHeaders[i+1]);
 if(values.length!==1||values[0].length>256)return '';
 const bearer=/^Bearer ([A-Za-z0-9_+\/-]+={0,2})$/i.exec(values[0]);
 if(bearer)return bearer[1];
 const basic=/^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(values[0]);
 if(!basic)return '';
 const bytes=Buffer.from(basic[1],'base64');
 if(bytes.toString('base64')!==basic[1])return '';
 const value=bytes.toString('utf8');
 return value.startsWith('garden:')?value.slice(7):'';
}

/** Preserve no-store even if a framework or static asset handler replaces headers. */
function protectResponse(res){
 for(const [key,value]of Object.entries(protectedHeaders))res.setHeader(key,value);
 const writeHead=res.writeHead;
 res.writeHead=function(status,message,headers){
  const supplied=typeof message==='string'?headers:message;
  const combined={...this.getHeaders()};
  if(Array.isArray(supplied)){
   for(let i=0;i<supplied.length;i+=2)combined[supplied[i].toLowerCase()]=supplied[i+1];
  }else if(supplied){for(const [key,value]of Object.entries(supplied))combined[key.toLowerCase()]=value;}
  Object.assign(combined,protectedHeaders);
  const vary=String(combined.vary??'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!vary.some(x=>x.toLowerCase()==='authorization'))vary.push('Authorization');
  combined.vary=vary.join(', ');
  return typeof message==='string'?writeHead.call(this,status,message,combined):writeHead.call(this,status,combined);
 };
}

function reply(req,res,status,value){
 res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
 res.end(req.method==='HEAD'?undefined:JSON.stringify(value));
 return false;
}

function createAccess(expectedDigest,requireForwardedHttps){
 return function access(req,res){
  protectResponse(res);
  if(Object.hasOwn(req.headers,'upgrade')){
   res.setHeader('Connection','close');return reply(req,res,400,{error:'upgrade_not_supported'});
  }
  const candidate=authorization(req);
  const matches=timingSafeEqual(digest(candidate),expectedDigest)&&validStagingToken(candidate);
  // Render's health monitor cannot send credentials. This is the only anonymous
  // success response: exact path, GET/HEAD, no build, service, source or app data.
  if(req.url==='/api/live'&&['GET','HEAD'].includes(req.method)&&!Object.hasOwn(req.headers,'authorization'))return reply(req,res,200,{status:'alive'});
  if(!matches){
   res.setHeader('WWW-Authenticate','Basic realm="Private staging", charset="UTF-8"');
   return reply(req,res,401,{error:'authentication_required'});
  }
  if(requireForwardedHttps&&req.headers['x-forwarded-proto']!=='https')return reply(req,res,403,{error:'https_required'});
  if(!['GET','HEAD'].includes(req.method)){
   res.setHeader('Allow','GET, HEAD');return reply(req,res,405,{error:'method_not_allowed'});
  }
  // A shell must never receive the ingress password, including raw header access.
  // Materialize both Node header views before shrinking rawHeaders: Node retains
  // its original raw-header count for lazy headersDistinct construction.
  const distinct=req.headersDistinct;
  delete req.headers.authorization;delete req.headers['proxy-authorization'];
  delete distinct.authorization;delete distinct['proxy-authorization'];
  const raw=[];
  for(let i=0;i<req.rawHeaders.length;i+=2)if(!['authorization','proxy-authorization'].includes(req.rawHeaders[i].toLowerCase()))raw.push(req.rawHeaders[i],req.rawHeaders[i+1]);
  req.rawHeaders=raw;
  return true;
 };
}

/** One listening server; no alternate upgrade/tunnel route reaches application code. */
export function hardenStagingServer(server){
 server.on('upgrade',(_req,socket)=>socket.destroy());
 server.on('connect',(_req,socket)=>socket.destroy());
 server.on('checkContinue',(req,res)=>server.emit('request',req,res));
 server.on('checkExpectation',(req,res)=>server.emit('request',req,res));
 server.on('clientError',(_error,socket)=>socket.destroy());
 server.keepAliveTimeout=5000;
}
