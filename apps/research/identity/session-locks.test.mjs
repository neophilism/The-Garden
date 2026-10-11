import test from 'node:test';
import assert from 'node:assert/strict';
import {accountLocks} from './session-locks.mjs';
const target={db:'neondb',schema:'identity',host:'127.0.0.1',port:5432,role:'auth'};
function fixture(patch={},failure=''){
 const calls=[],releases=[];
 const client={async query(sql,values){calls.push([sql,values]);if(sql.includes('current_database'))return{rows:[{...target,...patch}]};if(failure&&sql.includes(failure))throw Error('synthetic database failure');return{rows:[]};},release(destroy){releases.push(destroy??false);}};
 const db={async query(){return{rows:[target]};}};
 const locks={async connect(){return client;}};return{db,locks,calls,releases};
}
test('lock requires a distinct pool',()=>{const f=fixture();assert.throws(()=>accountLocks(f.db,f.db));assert.throws(()=>accountLocks(f.db,{}));});
test('locks bind full identity target and release exactly once',async()=>{const f=fixture();const release=await accountLocks(f.db,f.locks)('u');await release();await release();assert.equal(f.calls.filter(([sql])=>sql==='COMMIT').length,1);assert.equal(f.releases.length,1);assert.deepEqual(f.calls.find(([sql])=>sql.includes('pg_advisory'))[1],['u']);});
for(const key of Object.keys(target))test('mismatched '+key+' fails before lock',async()=>{const f=fixture({[key]:'wrong'});await assert.rejects(()=>accountLocks(f.db,f.locks)('u'));assert.equal(f.calls.some(([sql])=>sql.includes('pg_advisory')),false);assert.deepEqual(f.releases,[true]);});
test('lock timeout rolls back and destroys uncertain connection',async()=>{const f=fixture({},'pg_advisory');await assert.rejects(()=>accountLocks(f.db,f.locks)('u'));assert.ok(f.calls.some(([sql])=>sql==='ROLLBACK'));assert.deepEqual(f.releases,[true]);});
test('failed release does not return a broken connection',async()=>{const f=fixture({},'COMMIT');const release=await accountLocks(f.db,f.locks)('u');await assert.rejects(release);assert.deepEqual(f.releases,[true]);});
test('malformed subjects do not acquire connections',async()=>{const f=fixture();for(const subject of ['',null,'x'.repeat(2049)])await assert.rejects(()=>accountLocks(f.db,f.locks)(subject));assert.equal(f.calls.length,0);});
