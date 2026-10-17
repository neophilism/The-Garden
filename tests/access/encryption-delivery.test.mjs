import test from 'node:test';
import assert from 'node:assert/strict';
import {Buffer as NodeBuffer} from 'node:buffer';
import {deliveryFixture,deliveryFingerprint,isDeliveryError} from '../security/encryption-delivery-fixture.mjs';
import {PERSISTENCE_CANARY} from '../security/encryption-persistence-fixture.mjs';

const denied=work=>assert.rejects(work,isDeliveryError);
const cleared=f=>assert.ok(f.owned.length>0&&f.owned.every(b=>b.every(x=>x===0)));
const recovery=r=>({workspaceId:r.workspaceId,recordId:r.recordId,operationId:r.operationId,requestDigest:r.requestDigest});

test('actual composed encryption success strips private admission and clears owned plaintext',async t=>{
 const f=await deliveryFixture();t.after(f.close);const output=await f.decrypt();
 assert.deepEqual(output,PERSISTENCE_CANARY);cleared(f);output.fill(0);
 assert.equal(f.completions.size,0);assert.equal(f.state.finishes,2);
 assert.equal(f.state.verifyCalls,2);
});

for(const point of ['main.clear','issuer.finish.after'])test('identity closes at '+point+' of final load: no plaintext',async t=>{
 const f=await deliveryFixture({onEvent:async(name,s,extra)=>{
  if(s.loads===2&&((name===point&&extra.phase==='load')||(point==='issuer.finish.after'&&name==='issuer.retire')))s.identityValid=false;
 }});t.after(f.close);await denied(()=>f.decrypt());cleared(f);
 assert.equal(f.state.commits,point==='main.clear'?1:2);
});

test('identity closure after write clear is a known rollback, not an uncertain committed write',async t=>{
 const f=await deliveryFixture({stored:false,onEvent:async(name,s,extra)=>{if(name==='main.clear'&&extra.phase==='commit')s.identityValid=false;}});t.after(f.close);
 await assert.rejects(()=>f.store(),e=>isDeliveryError(e)&&e.commitOutcome===undefined&&e.recovery===undefined);
 assert.equal(f.state.durableWrites,0);assert.equal(f.state.commits,1);assert.equal(f.state.rollbacks,1);
});

test('identity closure after durable write retains exact recovery and cannot return normal success',async t=>{
 const f=await deliveryFixture({stored:false,onEvent:async(name,s,extra)=>{if((name==='issuer.finish.after'&&extra.phase==='commit')||(name==='issuer.retire'&&s.durableWrites===1))s.identityValid=false;}});t.after(f.close);
 let error;await assert.rejects(()=>f.store(),e=>{error=e;return isDeliveryError(e)&&e.commitOutcome==='unconfirmed';});
 assert.equal(f.state.durableWrites,1);assert.ok(Object.isFrozen(error.recovery));
 assert.deepEqual(error.recovery,recovery(f.receipts.get(f.input.operationId)));
 f.state.identityValid=true;const providerCalls=f.keys.calls.length;
 assert.deepEqual(await f.service.recover(f.headers,error.recovery),f.receipts.get(f.input.operationId));
 assert.equal(f.keys.calls.length,providerCalls);assert.equal(f.state.durableWrites,1);
});

for(const point of ['main.clear','issuer.finish.after','issuer.commit.before','host.verify.after'])test('captured SQL deadline denies decrypt at '+point,async t=>{
 let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 const f=await deliveryFixture({onEvent:async(name,s,extra)=>{
  if(s.loads===2&&name===point&&(point!=='issuer.commit.before'||extra.action==='finish'))clock=s.deadline;
 }});t.after(f.close);await denied(()=>f.decrypt());cleared(f);
});

test('deadline through last service identity await denies an already committed write with recovery',async t=>{
 let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 const f=await deliveryFixture({stored:false,onEvent:async(name,s)=>{if(name==='host.verify.after'&&s.durableWrites===1)clock=s.deadline;}});t.after(f.close);
 let error;await assert.rejects(()=>f.store(),e=>{error=e;return isDeliveryError(e)&&e.commitOutcome==='unconfirmed';});
 assert.equal(f.state.durableWrites,1);assert.deepEqual(error.recovery,recovery(f.receipts.get(f.input.operationId)));
});

test('deadline through last service identity await denies historical receipt delivery',async t=>{
 let clock=Date.now(),armed=false;t.mock.method(Date,'now',()=>clock);
 const f=await deliveryFixture({stored:false,onEvent:async(name,s)=>{if(armed&&name==='host.verify.after')clock=s.deadline;}});t.after(f.close);
 const r=await f.store();armed=true;await denied(()=>f.service.recover(f.headers,recovery(r)));
 assert.equal(f.state.durableWrites,1);
});

for(const kind of ['load','commit'])test('final fresh SQL revocation denies '+kind+' delivery',async t=>{
 const f=await deliveryFixture({stored:kind==='load',onEvent:async(name,s)=>{
  if(name==='issuer.finish.before'&&(kind==='load'?s.loads===2:s.durableWrites===1))s.sqlAllowed=false;
 }});t.after(f.close);
 if(kind==='load'){await denied(()=>f.decrypt());cleared(f);}
 else await assert.rejects(()=>f.store(),e=>isDeliveryError(e)&&e.commitOutcome==='unconfirmed');
 assert.equal(f.completions.size,0);
});

for(const field of ['subjectId','resultFingerprint','expiresAt'])test('untrusted SQL admission '+field+' cannot authorize output',async t=>{
 const f=await deliveryFixture({onEvent:async(name,s,extra)=>{
  if(name==='main.admission')s.hookResult={...extra.value,[field]:field==='subjectId'?'different-verified-actor':field==='resultFingerprint'?'f'.repeat(64):'2026-10-17T01:00:00Z'};
 }});t.after(f.close);await denied(()=>f.repository.load(f.headers,f.scope));assert.equal(f.state.commits,0);
});

test('final issuer admission cannot extend the earlier main deadline',async t=>{
 let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 const f=await deliveryFixture({onEvent:async(name,s,extra)=>{
  if(name==='issuer.finish.after'&&s.loads===2){s.hookResult={...extra.value,expiresAt:new Date(s.deadline+3600000).toISOString()};clock=s.deadline;}
 }});t.after(f.close);await denied(()=>f.decrypt());cleared(f);
});

for(const operation of ['decrypt','store'])test('a different valid principal cannot replace the first '+operation+' authority',async t=>{
 const f=await deliveryFixture({stored:operation==='decrypt'});t.after(f.close);
 f.keys.beforeCall(()=>{f.state.subjectId='second-verified-researcher';});
 await denied(()=>operation==='decrypt'?f.decrypt():f.store());
 assert.equal(f.state.durableWrites,0);
 if(operation==='decrypt')cleared(f);
});

test('expected principal is a narrowing condition and cannot invent verified identity',async t=>{
 const f=await deliveryFixture();t.after(f.close);
 await denied(()=>f.repository.load(f.headers,f.scope,'other-subject'));
 assert.equal(f.state.issueAttempts,0);
 f.state.identityValid=false;await denied(()=>f.repository.verifyIdentity(f.headers,f.state.subjectId));
});

for(const kind of ['main','finish'])test('lost '+kind+' COMMIT acknowledgement preserves durable recovery and discards uncertain connection',async t=>{
 let fault=true;
 const f=await deliveryFixture({stored:false,onEvent:async(name,s,extra)=>{
  if(fault&&((kind==='main'&&name==='main.commit.after'&&extra.phase==='commit')||(kind==='finish'&&name==='issuer.commit.after'&&extra.action==='finish'&&extra.phase==='commit'))){fault=false;throw Error('Lost synthetic COMMIT acknowledgement');}
 }});t.after(f.close);
 let error;await assert.rejects(()=>f.store(),e=>{error=e;return isDeliveryError(e)&&e.commitOutcome==='unconfirmed';});
 assert.equal(f.state.durableWrites,1);
 assert.ok(f.calls.some(e=>e.event===(kind==='main'?'encryption.release':'issuer.release')&&e.bad===true));
 const before=f.keys.calls.length;assert.deepEqual(await f.service.recover(f.headers,error.recovery),f.receipts.get(f.input.operationId));
 assert.equal(f.keys.calls.length,before);assert.equal(f.state.durableWrites,1);
});

test('lost ticket-issuance acknowledgement still retires the captured token',async t=>{
 let fault=true;const f=await deliveryFixture({onEvent:async(name,s,extra)=>{
  if(fault&&name==='issuer.commit.after'&&extra.action==='issue'){fault=false;throw Error('Lost ticket ACK');}
 }});t.after(f.close);await denied(()=>f.repository.load(f.headers,f.scope));
 assert.equal(f.state.retirements,1);assert.equal(f.state.loads,0);
 assert.ok(f.calls.some(e=>e.event==='issuer.release'&&e.bad===true));
});

test('final main connection release precedes issuer finish and no original token is rebound',async t=>{
 const f=await deliveryFixture();t.after(f.close);await f.repository.load(f.headers,f.scope);
 const released=f.calls.findIndex(e=>e.event==='encryption.release'&&e.completed);
 const finished=f.calls.findIndex(e=>e.event==='issuer.finish.before');assert.ok(released>=0&&finished>released);
 assert.equal(f.calls.filter(e=>e.kind==='issuer'&&e.sql?.includes('bind_policy_context')).length,0,'fresh context is internal to the fixed SQL function');
});

test('result fingerprint uses canonical ordered JSON independent of SQL object ordering',()=>{
 const a={z:[{b:'two',a:'one'},null,true],a:'first'},b={a:'first',z:[{a:'one',b:'two'},null,true]};
 assert.equal(deliveryFingerprint(a),deliveryFingerprint(b));assert.notEqual(deliveryFingerprint({...a,a:'changed'}),deliveryFingerprint(a));
});

test('failed final output-copy fence clears both reachable plaintext buffers',async t=>{
 let armed=false,copied;const original=NodeBuffer.from;
 const f=await deliveryFixture({serviceEnabled:()=>!armed});t.after(f.close);
 t.mock.method(NodeBuffer,'from',function(...args){
  const value=Reflect.apply(original,NodeBuffer,args);
  if(Buffer.isBuffer(args[0])&&f.owned.includes(args[0])){copied=value;armed=true;}
  return value;
 });
 await denied(()=>f.decrypt());assert.ok(Buffer.isBuffer(copied));assert.ok(copied.every(x=>x===0));cleared(f);
});
