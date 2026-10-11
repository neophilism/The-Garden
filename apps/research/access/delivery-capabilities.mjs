import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {UUID} from './roles.mjs';
import {PolicyError} from './policy-context.mjs';
const fail=()=>{throw new PolicyError();};
const kinds=new Set(['download','media','tile']);
const fields=['assetVersion','expiresAt','issuedAt','keyId','kind','nonce','purpose','range','record','revision','selector','subject','version','workspace'].sort();
const integerString=value=>typeof value==='string'&&/^[1-9][0-9]{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
export function validDeliverySelector(kind,selector){
 if(!kinds.has(kind))return false;
 if(kind==='tile')return typeof selector==='string'&&/^[0-9]{1,6}:[0-9]{1,2}:[0-9]{1,6}:[0-9]{1,6}$/.test(selector);
 return selector===null;
}
export function createDeliveryCapabilities({keys,activeKeyId,now=Date.now}){
 if(!keys||Object.getPrototypeOf(keys)!==Object.prototype||Object.keys(keys).length<1||Object.keys(keys).length>3||typeof now!=='function')fail();
 const ring=new Map();
 for(const [id,key] of Object.entries(keys)){
  if(!/^[a-zA-Z0-9_-]{1,32}$/.test(id)||!(key instanceof Uint8Array)||key.byteLength<32||key.byteLength>64||new Set(key).size<8)fail();
  ring.set(id,Buffer.from(key));
 }
 if(!ring.has(activeKeyId))fail();
 const mac=(key,value)=>createHmac('sha256',key).update(value,'utf8').digest();
 const actor=(key,id)=>{if(typeof id!=='string'||!id||id.length>128)fail();return mac(key,'garden/delivery-subject/v1\0'+id).toString('base64url');};
 const clock=()=>{const n=now();if(!Number.isSafeInteger(n)||n<0)fail();return n;};
 function valid(c){return c&&Object.getPrototypeOf(c)===Object.prototype&&JSON.stringify(Object.keys(c).sort())===JSON.stringify(fields)&&c.version===1&&c.purpose==='research'&&ring.has(c.keyId)&&UUID.test(c.workspace)&&UUID.test(c.record)&&UUID.test(c.assetVersion)&&integerString(c.revision)&&validDeliverySelector(c.kind,c.selector)&&(c.range===null||typeof c.range==='string'&&/^bytes=[0-9]{1,12}-[0-9]{0,12}$/.test(c.range))&&typeof c.subject==='string'&&/^[A-Za-z0-9_-]{43}$/.test(c.subject)&&typeof c.nonce==='string'&&/^[A-Za-z0-9_-]{22}$/.test(c.nonce)&&Number.isSafeInteger(c.issuedAt)&&Number.isSafeInteger(c.expiresAt)&&c.issuedAt>=0&&c.expiresAt>c.issuedAt&&c.expiresAt-c.issuedAt<=30000;}
 return Object.freeze({
  issue({subjectId,workspace,record,revision,assetVersion,kind,selector=null,range=null}){
   const issuedAt=clock(),key=ring.get(activeKeyId);
   const claims={version:1,purpose:'research',keyId:activeKeyId,subject:actor(key,subjectId),workspace,record,revision,assetVersion,kind,selector,range,issuedAt,expiresAt:issuedAt+30000,nonce:randomBytes(16).toString('base64url')};
   if(!valid(claims))fail();
   const encoded=Buffer.from(JSON.stringify(claims)).toString('base64url');
   return encoded+'.'+mac(key,'garden/delivery-capability/v1\0'+encoded).toString('base64url');
  },
  verify(token,expected){
   try{
    if(typeof token!=='string'||token.length>4096||!expected)fail();
    const parts=token.split('.');if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))fail();
    const raw=Buffer.from(parts[0],'base64url');if(raw.toString('base64url')!==parts[0])fail();
    const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));if(!valid(c))fail();
    const key=ring.get(c.keyId),tag=Buffer.from(parts[1],'base64url'),wanted=mac(key,'garden/delivery-capability/v1\0'+parts[0]);
    if(tag.length!==wanted.length||tag.toString('base64url')!==parts[1]||!timingSafeEqual(tag,wanted))fail();
    const t=clock();if(t<c.issuedAt||t>=c.expiresAt||c.subject!==actor(key,expected.subjectId))fail();
    for(const field of ['workspace','record','kind','selector','range'])if(c[field]!==expected[field])fail();
    return Object.freeze(c);
   }catch{fail();}
  }
 });
}
