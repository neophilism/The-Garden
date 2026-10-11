/** Regression fixture shared by all three real-PostgreSQL revision readers. */
import assert from 'node:assert/strict';
export async function exerciseNumericHistory(repo,headers,workspace,id){
 let current=await repo.read(headers,workspace,id);
 while(BigInt(current.revision)<15n) current=await repo.revise(headers,workspace,id,current.revision,current.record);
 const expected=Array.from({length:Number(current.revision)},(_,i)=>String(BigInt(current.revision)-BigInt(i)));
 const first=await repo.history(headers,workspace,id,{limit:3});
 assert.deepEqual(first.versions.map(r=>r.revision),expected.slice(0,3));
 // An edit between pages must not leak above the earlier page's keyset boundary.
 await repo.revise(headers,workspace,id,current.revision,current.record);
 let page=first;const seen=[];
 for(let pages=0;pages<10;pages++){
  seen.push(...page.versions.map(r=>r.revision));
  if(page.nextBeforeRevision===null)break;
  page=await repo.history(headers,workspace,id,{limit:3,beforeRevision:page.nextBeforeRevision});
 }
 assert.deepEqual(seen,expected);assert.equal(new Set(seen).size,seen.length);
 const crossing=await repo.history(headers,workspace,id,{limit:3,beforeRevision:'11'});
 assert.deepEqual(crossing.versions.map(r=>r.revision),['10','9','8']);
 assert.equal(crossing.nextBeforeRevision,'8');
 const tail=await repo.history(headers,workspace,id,{limit:3,beforeRevision:'2'});
 assert.deepEqual(tail.versions.map(r=>r.revision),['1']);assert.equal(tail.nextBeforeRevision,null);
}
