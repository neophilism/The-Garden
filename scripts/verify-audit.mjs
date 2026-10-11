#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {AuditError,GENESIS,validateCheckpoint,verifyAuditPage,verifyExternalCheckpoint} from '../packages/domain/src/audit/ledger.mjs';
const fail=()=>{throw new AuditError();};
/** Offline verifier: never resolves URLs, runs SQL or emits private audit rows.
 * Checkpoint authenticity must be established separately from this export.
 */
export function verifyExport(rows,reference,start=null){
 const trusted=validateCheckpoint(reference);
 let point=start===null?{workspaceId:trusted.workspaceId,sequence:'0',hash:GENESIS}:validateCheckpoint(start);
 if(!Array.isArray(rows)||rows.length>10000||point.workspaceId!==trusted.workspaceId)fail();
 const ids=new Set();
 for(let n=0;n<rows.length;n+=1000){
  const page=verifyAuditPage(rows.slice(n,n+1000),point);
  for(const event of page.events){if(ids.has(event.eventId))fail();ids.add(event.eventId);}
  point=page.checkpoint;
 }
 verifyExternalCheckpoint(point,trusted);
 return {format:'garden-audit-verification-v1',eventsChecked:rows.length,checkpoint:point,matchesSuppliedCheckpoint:true,
  checkpointAuthenticity:'must-be-established-independently',operatorTruthfulnessVerified:false,fullHistoricalCoverageVerified:false};
}
async function readJSON(path,maximum){
 if(typeof path!=='string'||path.includes('://'))fail();
 const file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{const stat=await file.stat();if(!stat.isFile()||stat.size>maximum)fail();
  const bytes=Buffer.alloc(maximum+1);let size=0;
  while(size<bytes.length){const {bytesRead}=await file.read(bytes,size,bytes.length-size,null);if(!bytesRead)break;size+=bytesRead;}
  if(size>maximum)fail();return JSON.parse(bytes.subarray(0,size).toString('utf8'));
 }finally{await file.close();}
}
export async function main(args){
 if(args.length!==4&&args.length!==6)fail();const values={};
 for(let n=0;n<args.length;n+=2){if(!['--export','--checkpoint','--start'].includes(args[n])||Object.hasOwn(values,args[n]))fail();values[args[n]]=args[n+1];}
 if(!values['--export']||!values['--checkpoint'])fail();
 const [rows,checkpoint,start]=await Promise.all([readJSON(values['--export'],48*1024*1024),readJSON(values['--checkpoint'],4096),values['--start']?readJSON(values['--start'],4096):null]);
 return verifyExport(rows,checkpoint,start);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await main(process.argv.slice(2)),null,2));}
 catch{console.error('Audit verification failed. Use --export rows.json --checkpoint independently-trusted.json [--start independently-trusted-start.json]. No event contents were printed.');process.exitCode=1;}
}
