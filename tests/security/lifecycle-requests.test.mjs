import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  LifecycleRequestError, validateLifecycleRequest, lifecycleRequestFingerprint, lifecycleDecisionFingerprint,
  validateLifecycleSubmission, validateLifecycleCancellation, validateLifecycleDecision,
  submitLifecycleRequest, cancelLifecycleRequest, decideLifecycleRequest, lifecycleRequestReceipt
} from '../../packages/domain/src/lifecycle/requests.mjs';

const id = n => '20000000-0000-4000-8000-' + String(n).padStart(12, '0');
const NOW = Date.parse('2026-10-17T15:00:00.000Z');
const iso = n => new Date(n).toISOString();
const OWNER = {workspaceId:id(1),subjectId:'private-requester-canary'};
const INPUT = {operationId:id(2),requestId:id(3),kind:'delete',claimedRecordId:id(4)};
const cancel = (extra = {}) => ({operationId:id(5),requestId:INPUT.requestId,expectedRevision:'1',...extra});
const review = (extra = {}) => ({operationId:id(6),requestId:INPUT.requestId,expectedRevision:'1',decision:'accepted',reviewEvidenceId:id(7),reviewBy:iso(NOW + 86400000),...extra});
const authority = (input = review(), extra = {}, current = start().request) => ({workspaceId:OWNER.workspaceId,subjectId:'private-operator-canary',action:'lifecycle.administer',
  requestId:input.requestId,operationId:input.operationId,authorizationId:id(8),authorityEvidenceId:id(9),
  validFrom:iso(NOW - 1000),expiresAt:iso(NOW + 10000),
  decisionFingerprint:lifecycleDecisionFingerprint({workspaceId:OWNER.workspaceId,subjectId:'private-operator-canary'},current,input),...extra});
const start = (input = INPUT) => submitLifecycleRequest(OWNER,input,NOW);
const accepted = () => {const command=review();return decideLifecycleRequest(authority(command),start().request,command,NOW + 1);};
const reject = work => assert.throws(work,error => error instanceof LifecycleRequestError && error.code === 'lifecycle_request_unavailable' && error.message === 'Lifecycle request unavailable');
const reverse = value => Object.fromEntries(Object.entries(value).reverse());

test('a submission records an opaque claim without authority, existence or fulfillment assertions', () => {
  for (const kind of ['delete','export']) {
    const input={...INPUT,kind}, first=start(input), receipt=lifecycleRequestReceipt(OWNER,first.request);
    assert.equal(first.request.state,'pending'); assert.equal(first.request.revision,'1'); assert.equal(first.replayed,false);
    assert.equal(receipt.claimedRecordId,input.claimedRecordId); assert.equal(receipt.targetKind,'claimed-record-reference');
    assert.equal(receipt.effectsVerified,false); assert.equal(first.operation.effectsVerified,false);
    for (const field of ['committed','deliveryStopped','removalQueued','targetExists','legalAuthorityVerified','ready','fulfilled','downloadUrl','tombstoneId']) {
      assert.equal(Object.hasOwn(receipt,field),false); assert.equal(Object.hasOwn(first.operation,field),false);
    }
  }
});

test('submission fingerprint matches its independent protocol and canonicalizes property order', () => {
  const expected=createHash('sha256').update('garden-lifecycle-operation-v1\nsubmit\n'+JSON.stringify({
    workspaceId:OWNER.workspaceId,subjectId:OWNER.subjectId,operationId:INPUT.operationId,
    requestId:INPUT.requestId,kind:'delete',claimedRecordId:INPUT.claimedRecordId
  }),'utf8').digest('hex');
  assert.equal(lifecycleRequestFingerprint(OWNER,INPUT),expected);
  assert.equal(lifecycleRequestFingerprint(reverse(OWNER),reverse(INPUT)),expected);
  assert.equal(start().request.submission.fingerprint,expected);
});

test('intent identity binds actor, receiving workspace, operation, request, kind and record claim', () => {
  const original=lifecycleRequestFingerprint(OWNER,INPUT);
  for (const p of [{...OWNER,subjectId:'other-person'},{...OWNER,workspaceId:id(10)}]) assert.notEqual(lifecycleRequestFingerprint(p,INPUT),original);
  for (const input of [{...INPUT,operationId:id(10)},{...INPUT,requestId:id(10)},{...INPUT,kind:'export'},{...INPUT,claimedRecordId:id(10)}]) assert.notEqual(lifecycleRequestFingerprint(OWNER,input),original);
});

test('validated request and decision values are owned deep-frozen copies', () => {
  const p={...OWNER}, input={...INPUT}, first=submitLifecycleRequest(p,input,NOW);
  p.subjectId='changed'; input.kind='export';
  assert.equal(first.request.requesterId,OWNER.subjectId); assert.equal(first.request.kind,'delete');
  const supplied=structuredClone(first.request), owned=validateLifecycleRequest(supplied);
  supplied.submission.fingerprint='0'.repeat(64); assert.notEqual(owned.submission.fingerprint,supplied.submission.fingerprint);
  const command=review(), proof=authority(command), outcome=decideLifecycleRequest(proof,first.request,command,NOW + 1);
  command.reviewEvidenceId=id(99); proof.authorityEvidenceId=id(99);
  assert.equal(outcome.request.resolution.review.reviewEvidenceId,id(7)); assert.equal(outcome.request.resolution.review.authorityEvidenceId,id(9));
  for (const value of [first,first.request,first.request.submission,first.operation,owned,outcome.request.resolution,outcome.request.resolution.review,lifecycleRequestReceipt(OWNER,outcome.request)]) assert.ok(Object.isFrozen(value));
  assert.throws(()=>{outcome.request.resolution.review.reviewBy='changed';},TypeError);
});

test('exported command validators freeze an owned intent before any asynchronous host work', () => {
  for (const [validate,input] of [[validateLifecycleSubmission,{...INPUT}],
    [validateLifecycleCancellation,cancel()],[validateLifecycleDecision,review()]]) {
    const owned=validate(input),originalId=owned.operationId; input.operationId=id(77);
    assert.equal(owned.operationId,originalId); assert.ok(Object.isFrozen(owned));
    reject(()=>validate({...input,subjectId:'injected-actor'}));
    Object.defineProperty(input,'hidden',{value:true}); reject(()=>validate(input));
  }
});

test('caller-supplied ownership, authority and completion flags cannot widen a command', () => {
  for (const field of ['subjectId','workspaceId','owner','verified','authority','legalAuthorityVerified','targetExists','ready','fulfilled','committed','tombstoneId']) {
    reject(()=>submitLifecycleRequest(OWNER,{...INPUT,[field]:true},NOW));
  }
  reject(()=>submitLifecycleRequest({...OWNER,verified:true},INPUT,NOW));
  reject(()=>cancelLifecycleRequest(OWNER,start().request,{...cancel(),undoTombstone:true},NOW + 1));
  reject(()=>decideLifecycleRequest(authority(),start().request,{...review(),physicalErasureVerified:true},NOW + 1));
});

test('symbols, hidden fields, accessors, inherited objects and toJSON are rejected without invocation', () => {
  let invoked=0;
  const additions=[
    value=>Object.defineProperty(value,'hidden',{value:'private-hidden-canary'}),
    value=>Object.defineProperty(value,Symbol('actor'),{value:'other-person'}),
    value=>Object.defineProperty(value,'kind',{enumerable:true,get(){invoked++;return 'delete';}}),
    value=>Object.assign(value,{toJSON(){invoked++;return INPUT;}})
  ];
  for (const mutate of additions) reject(()=>submitLifecycleRequest(OWNER,mutate({...INPUT}),NOW));
  reject(()=>submitLifecycleRequest(Object.create(OWNER),INPUT,NOW));
  reject(()=>submitLifecycleRequest(OWNER,Object.assign(Object.create(null),INPUT),NOW));
  const current=structuredClone(start().request);
  Object.defineProperty(current.submission,'fingerprint',{enumerable:true,get(){invoked++;return '0'.repeat(64);}});
  reject(()=>validateLifecycleRequest(current));
  const proof=authority(); Object.defineProperty(proof,'subjectId',{enumerable:true,get(){invoked++;return OWNER.subjectId;}});
  reject(()=>decideLifecycleRequest(proof,start().request,review(),NOW + 1));
  assert.equal(invoked,0);
});

test('noncanonical UUIDs, invalid actor values and unsupported request kinds fail generically', () => {
  for (const input of [null,[],{}, {...INPUT,requestId:'A0000000-0000-4000-8000-000000000003'},
    {...INPUT,operationId:'not-an-id'},{...INPUT,claimedRecordId:null},{...INPUT,kind:'purge'},
    {...INPUT,kind:'public-display'},{...INPUT,kind:'fulfilled'}]) reject(()=>submitLifecycleRequest(OWNER,input,NOW));
  for (const subjectId of ['',null,'fake\noperator',' ', 'x'.repeat(129), '\ud800']) reject(()=>submitLifecycleRequest({...OWNER,subjectId},INPUT,NOW));
});

test('the explicit server clock must be finite, canonical, nonnegative and within supported dates', () => {
  for (const now of [undefined,null,NaN,Infinity,-1,NOW+0.5,String(NOW),253402300800000]) reject(()=>submitLifecycleRequest(OWNER,INPUT,now));
  assert.equal(submitLifecycleRequest(OWNER,INPUT,0).request.createdAt,'1970-01-01T00:00:00.000Z');
  reject(()=>cancelLifecycleRequest(OWNER,start().request,cancel(),NOW-1));
  reject(()=>decideLifecycleRequest(authority(),start().request,review(),NOW-1));
});

test('an exact submission retry preserves original operation time and fingerprint', () => {
  const first=start(), retry=submitLifecycleRequest(OWNER,reverse(INPUT),NOW + 1000,first.request);
  assert.equal(retry.replayed,true); assert.deepEqual(retry.operation,first.operation); assert.deepEqual(retry.request,first.request);
});

test('a changed submission cannot reuse an existing request or operation binding', () => {
  const current=start().request;
  for (const input of [{...INPUT,operationId:id(11)},{...INPUT,requestId:id(11)},{...INPUT,kind:'export'},{...INPUT,claimedRecordId:id(11)}]) reject(()=>submitLifecycleRequest(OWNER,input,NOW+1,current));
  for (const p of [{...OWNER,subjectId:'other-person'},{...OWNER,workspaceId:id(11)}]) reject(()=>submitLifecycleRequest(p,INPUT,NOW+1,current));
});

test('cancellation is a versioned terminal intent with an immutable idempotent operation receipt', () => {
  const before=start().request, after=cancelLifecycleRequest(OWNER,before,cancel(),NOW+1);
  assert.equal(before.state,'pending'); assert.equal(after.request.state,'cancelled'); assert.equal(after.request.revision,'2');
  assert.equal(after.request.resolution.review,null); assert.equal(after.operation.effectsVerified,false);
  const retry=cancelLifecycleRequest(OWNER,after.request,reverse(cancel()),NOW+100);
  assert.equal(retry.replayed,true); assert.deepEqual(retry.operation,after.operation); assert.deepEqual(retry.request,after.request);
});

test('request status and cancellation are scoped to the original authenticated requester', () => {
  const request=start().request;
  for (const p of [{workspaceId:id(99),subjectId:OWNER.subjectId},{workspaceId:OWNER.workspaceId,subjectId:'other-person'},{workspaceId:OWNER.workspaceId,subjectId:'private-operator-canary'}]) {
    reject(()=>lifecycleRequestReceipt(p,request)); reject(()=>cancelLifecycleRequest(p,request,cancel(),NOW+1));
  }
  assert.equal(lifecycleRequestReceipt(OWNER,request).requestId,INPUT.requestId);
});

test('numeric, noncanonical, stale and overflowing expected revisions are rejected', () => {
  for (const expectedRevision of [1,0,'0','01','1.0','-1','2','9223372036854775808']) {
    reject(()=>cancelLifecycleRequest(OWNER,start().request,cancel({expectedRevision}),NOW+1));
    const input=review({expectedRevision}); reject(()=>decideLifecycleRequest(authority(input),start().request,input,NOW+1));
  }
});

test('an operation ID cannot be reassigned from submission to cancellation or review', () => {
  const current=start().request;
  reject(()=>cancelLifecycleRequest(OWNER,current,cancel({operationId:INPUT.operationId}),NOW+1));
  const input=review({operationId:INPUT.operationId}); reject(()=>decideLifecycleRequest(authority(input),current,input,NOW+1));
  const cancelled=cancelLifecycleRequest(OWNER,current,cancel(),NOW+1).request;
  const reinterpreted=review({operationId:cancel().operationId}); reject(()=>decideLifecycleRequest(authority(reinterpreted),cancelled,reinterpreted,NOW+2));
});

test('review requires current exact operation, request, workspace and registered-action authority', () => {
  const current=start().request, input=review();
  for (const proof of [null,OWNER,{...authority(input),action:'consent.administer'},
    {...authority(input),action:'lifecycle.purge'},{...authority(input),workspaceId:id(44)},
    {...authority(input),requestId:id(44)},{...authority(input),operationId:id(44)},
    {...authority(input),authorizationId:null},{...authority(input),authorityEvidenceId:null},
    {...authority(input),validFrom:iso(NOW+2)},{...authority(input),expiresAt:iso(NOW+1)},
    {...authority(input),expiresAt:iso(NOW-2000)},{...authority(input),verified:true}]) reject(()=>decideLifecycleRequest(proof,current,input,NOW+1));
  assert.equal(current.state,'pending');
});

test('review evidence and review date are explicit, bounded dates rather than inferred retention periods', () => {
  for (const patch of [{reviewEvidenceId:null},{reviewBy:null},{reviewBy:iso(NOW+1)},
    {reviewBy:'2026-02-30T00:00:00.000Z'},{reviewBy:'2026-10-19'},
    {reviewBy:'2026-10-18T00:00:00+00:00'},{retentionDays:30},{decision:'ready'},{decision:'fulfilled'}]) {
    const input=review(patch); reject(()=>decideLifecycleRequest(authority(input),start().request,input,NOW+1));
  }
  const input=review(), outcome=decideLifecycleRequest(authority(input),start().request,input,NOW+1);
  assert.equal(outcome.request.resolution.review.reviewBy,input.reviewBy);
  assert.equal(Object.hasOwn(outcome.request.resolution.review,'retentionDays'),false);
});

test('accepted and declined are request decisions, with no verified deletion or export outcome', () => {
  for (const kind of ['delete','export']) for (const state of ['accepted','declined']) {
    const first=start({...INPUT,kind}), input=review({decision:state});
    const outcome=decideLifecycleRequest(authority(input,{},first.request),first.request,input,NOW+1), receipt=lifecycleRequestReceipt(OWNER,outcome.request);
    assert.equal(outcome.request.state,state); assert.equal(receipt.state,state); assert.equal(receipt.effectsVerified,false);
    assert.equal(outcome.operation.effectsVerified,false); assert.equal(Object.hasOwn(receipt,'ready'),false); assert.equal(Object.hasOwn(receipt,'fulfilled'),false);
  }
});

test('exact review replay is stable while every changed decision, evidence or authority conflicts', () => {
  const outcome=accepted(), input=review();
  const repeated=decideLifecycleRequest(reverse(authority(input)),outcome.request,reverse(input),NOW+100);
  assert.equal(repeated.replayed,true); assert.deepEqual(repeated.operation,outcome.operation);
  for (const changed of [review({decision:'declined'}),review({reviewEvidenceId:id(40)}),review({reviewBy:iso(NOW+172800000)})]) reject(()=>decideLifecycleRequest(authority(changed),outcome.request,changed,NOW+100));
  for (const proof of [authority(input,{subjectId:'another-operator'}),authority(input,{authorizationId:id(40)}),authority(input,{authorityEvidenceId:id(40)}),authority(input,{expiresAt:iso(NOW+20000)})]) reject(()=>decideLifecycleRequest(proof,outcome.request,input,NOW+100));
});

test('one admitted proof cannot authorize a changed decision before any transition is stored', () => {
  const current=start().request, input=review({decision:'declined'}), proof=authority(input);
  assert.equal(decideLifecycleRequest(proof,current,input,NOW+1).request.state,'declined');
  for (const changed of [review({decision:'accepted'}),{...input,reviewEvidenceId:id(90)},
    {...input,reviewBy:iso(NOW+172800000)},{...input,expectedRevision:'2'},
    {...input,operationId:id(90)},{...input,requestId:id(90)}]) reject(()=>decideLifecycleRequest(proof,current,changed,NOW+1));
  const differentClaim=start({...INPUT,claimedRecordId:id(90)}).request;
  reject(()=>decideLifecycleRequest(proof,differentClaim,input,NOW+1));
  const differentKind=start({...INPUT,kind:'export'}).request;
  reject(()=>decideLifecycleRequest(proof,differentKind,input,NOW+1));
  reject(()=>decideLifecycleRequest({...proof,subjectId:'different-operator'},current,input,NOW+1));
  reject(()=>decideLifecycleRequest({...proof,decisionFingerprint:'0'.repeat(64)},current,input,NOW+1));
  assert.equal(current.state,'pending');
});

test('decision intent has its own canonical protocol without recursively hashing the proof', () => {
  const current=start().request, input=review(), operator={workspaceId:OWNER.workspaceId,subjectId:'private-operator-canary'};
  const expected=createHash('sha256').update('garden-lifecycle-operation-v1\nreview-intent\n'+JSON.stringify({
    workspaceId:operator.workspaceId,subjectId:operator.subjectId,requestId:current.requestId,
    requestFingerprint:current.submission.fingerprint,operationId:input.operationId,
    expectedRevision:'1',decision:'accepted',reviewEvidenceId:input.reviewEvidenceId,reviewBy:input.reviewBy
  }),'utf8').digest('hex');
  assert.equal(lifecycleDecisionFingerprint(operator,current,input),expected);
  assert.equal(lifecycleDecisionFingerprint(reverse(operator),reverse(current),reverse(input)),expected);
  assert.equal(authority(input).decisionFingerprint,expected);
});

test('expired review admission cannot be reused; historical requester receipt remains readable', () => {
  const outcome=accepted(), input=review();
  reject(()=>decideLifecycleRequest(authority(input),outcome.request,input,NOW+10000));
  const renewed=authority(input,{authorizationId:id(80),validFrom:iso(NOW+10000),expiresAt:iso(NOW+20000)});
  reject(()=>decideLifecycleRequest(renewed,outcome.request,input,NOW+10001));
  assert.equal(lifecycleRequestReceipt(OWNER,outcome.request).state,'accepted');
  assert.deepEqual(validateLifecycleRequest(structuredClone(outcome.request)),outcome.request);
});

test('submission replay after a decision returns its original receipt while status reports the latest state', () => {
  const original=start(), latest=accepted().request;
  const retry=submitLifecycleRequest(OWNER,INPUT,NOW+100,latest);
  assert.deepEqual(retry.operation,original.operation); assert.equal(retry.operation.state,'pending');
  assert.equal(retry.request.state,'accepted'); assert.equal(lifecycleRequestReceipt(OWNER,retry.request).state,'accepted');
});

test('cancellation versus acceptance requires one current version and cannot reverse the winner', () => {
  const pending=start().request, input=review();
  const cancelled=cancelLifecycleRequest(OWNER,pending,cancel(),NOW+1).request;
  reject(()=>decideLifecycleRequest(authority(input),cancelled,input,NOW+2));
  const approved=decideLifecycleRequest(authority(input),pending,input,NOW+1).request;
  reject(()=>cancelLifecycleRequest(OWNER,approved,cancel(),NOW+2));
  reject(()=>cancelLifecycleRequest(OWNER,approved,cancel({expectedRevision:'2'}),NOW+2));
  assert.equal(approved.state,'accepted'); assert.equal(approved.resolution.fingerprint,accepted().request.resolution.fingerprint);
});

test('terminal request states cannot be reopened or replaced by another operation', () => {
  for (const state of ['accepted','declined','cancelled']) {
    const input=review({decision:state==='cancelled'?'accepted':state});
    const current=state==='cancelled'?cancelLifecycleRequest(OWNER,start().request,cancel(),NOW+1).request:
      decideLifecycleRequest(authority(input),start().request,input,NOW+1).request;
    reject(()=>cancelLifecycleRequest(OWNER,current,cancel({operationId:id(88),expectedRevision:'2'}),NOW+2));
    const second=review({operationId:id(89),expectedRevision:'2'}); reject(()=>decideLifecycleRequest(authority(second),current,second,NOW+2));
  }
});

test('private receipt contains no requester identity, operator identity or authority/evidence records', () => {
  const current=accepted().request, receipt=lifecycleRequestReceipt(OWNER,current);
  assert.deepEqual(Object.keys(receipt),['schemaVersion','requestId','kind','claimedRecordId','targetKind','revision','state','submittedAt','updatedAt','effectsVerified']);
  const serialized=JSON.stringify(receipt);
  for (const secret of [OWNER.subjectId,'private-operator-canary',id(7),id(8),id(9),current.submission.fingerprint,current.resolution.fingerprint]) assert.equal(serialized.includes(secret),false);
  assert.equal(Object.hasOwn(receipt,'workspaceId'),false); assert.equal(Object.hasOwn(receipt,'hold'),false);
});

test('snapshot state, actor, intent and review tampering cannot retain a valid operation fingerprint', () => {
  const original=accepted().request;
  const mutations=[r=>{r.kind='export';},r=>{r.claimedRecordId=id(44);},r=>{r.requesterId='other-person';},
    r=>{r.state='cancelled';},r=>{r.revision='1';},r=>{r.schemaVersion=2;},r=>{r.resolution=null;},
    r=>{r.resolution.subjectId='other-operator';},r=>{r.resolution.operationId=r.submission.operationId;},
    r=>{r.resolution.review.authorityEvidenceId=id(44);},r=>{r.resolution.review.expiresAt=r.resolution.recordedAt;},
    r=>{r.resolution.review.reviewBy=r.resolution.recordedAt;},r=>{r.resolution.review.extra='secret';}];
  for (const mutate of mutations) {const value=structuredClone(original);mutate(value);reject(()=>validateLifecycleRequest(value));}
});

test('nested symbol, non-enumerable and accessor additions cannot survive snapshot validation', () => {
  let invoked=0;
  for (const decorate of [value=>Object.defineProperty(value,Symbol('override'),{value:true}),
    value=>Object.defineProperty(value,'secret',{value:true}),
    value=>Object.defineProperty(value,'reviewBy',{enumerable:true,get(){invoked++;return iso(NOW+100000);}})]) {
    const value=structuredClone(accepted().request); decorate(value.resolution.review); reject(()=>validateLifecycleRequest(value));
  }
  assert.equal(invoked,0);
});
