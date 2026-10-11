import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyExport,main} from '../../scripts/verify-audit.mjs';
import {AuditError,GENESIS,auditHash} from '../../packages/domain/src/audit/ledger.mjs';
const W=randomUUID(),actor=randomUUID();
function fixture(total=2){let hash=GENESIS;const rows=[];
 for(let i=1;i<=total;i++){const event={schemaVersion:1,eventId:randomUUID(),workspaceId:W,sequence:String(i),requestId:randomUUID(),occurredAt:'2026-10-11T12:00:00.000000Z',actor:{kind:'subject',reference:actor},subject:{kind:'record',reference:randomUUID(),version:String(i)},action:'record.revise',outcome:'succeeded',reasonCode:'record-revised'};const text=JSON.stringify(event);rows.push({workspaceId:W,sequence:String(i),previousHash:hash,hash:auditHash(W,String(i),hash,text),eventText:text});hash=rows.at(-1).hash;}
 return {rows,checkpoint:{workspaceId:W,sequence:String(total),hash}};
}
test('export verification is bounded, offline and checkpoint-bound',()=>{const f=fixture(1001),r=verifyExport(f.rows,f.checkpoint);assert.equal(r.eventsChecked,1001);assert.equal(r.matchesSuppliedCheckpoint,true);assert.equal(r.operatorTruthfulnessVerified,false);assert.equal(r.fullHistoricalCoverageVerified,false);assert.ok(!JSON.stringify(r).includes('actor'));});
test('truncated export cannot match the expected terminal checkpoint',()=>{const f=fixture();assert.throws(()=>verifyExport(f.rows.slice(0,1),f.checkpoint),AuditError);});
test('missing prefix requires an independently supplied starting checkpoint',()=>{const f=fixture();assert.throws(()=>verifyExport(f.rows.slice(1),f.checkpoint),AuditError);assert.equal(verifyExport(f.rows.slice(1),f.checkpoint,{workspaceId:W,sequence:'1',hash:f.rows[0].hash}).eventsChecked,1);});
test('empty history is valid only at a genesis checkpoint',()=>{assert.equal(verifyExport([],{workspaceId:W,sequence:'0',hash:GENESIS}).eventsChecked,0);assert.throws(()=>verifyExport([],fixture().checkpoint));});
test('checkpoint from another workspace is not accepted',()=>{const f=fixture();assert.throws(()=>verifyExport(f.rows,{...f.checkpoint,workspaceId:randomUUID()}));});
test('oversized row inventory is rejected before inspecting rows',()=>assert.throws(()=>verifyExport(Array(10001),fixture().checkpoint),AuditError));
test('duplicate event identity across page boundaries fails even with a recomputed chain',()=>{const f=fixture(1001);const last=f.rows.at(-1),p=JSON.parse(last.eventText);p.eventId=JSON.parse(f.rows[0].eventText).eventId;last.eventText=JSON.stringify(p);last.hash=auditHash(W,last.sequence,last.previousHash,last.eventText);assert.throws(()=>verifyExport(f.rows,{...f.checkpoint,hash:last.hash}),AuditError);});
test('local command accepts valid files and rejects links, URLs, oversized input and unknown options',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'garden-audit-'));try{
  const f=fixture(),rows=join(directory,'rows.json'),checkpoint=join(directory,'checkpoint.json'),alias=join(directory,'alias.json');await writeFile(rows,JSON.stringify(f.rows));await writeFile(checkpoint,JSON.stringify(f.checkpoint));
  assert.equal((await main(['--export',rows,'--checkpoint',checkpoint])).eventsChecked,2);
  await symlink(rows,alias);await assert.rejects(()=>main(['--export',alias,'--checkpoint',checkpoint]));
  await assert.rejects(()=>main(['--export','https://example.invalid/rows','--checkpoint',checkpoint]));
  await assert.rejects(()=>main(['--export',rows,'--checkpoint',checkpoint,'--execute','x']));
  await assert.rejects(()=>main(['--export',rows,'--export',checkpoint]));
  await writeFile(checkpoint,' '.repeat(4097));await assert.rejects(()=>main(['--export',rows,'--checkpoint',checkpoint]));
 }finally{await rm(directory,{recursive:true,force:true});}
});
