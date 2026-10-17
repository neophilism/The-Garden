import test from 'node:test';
import assert from 'node:assert/strict';
import {controlOwned,controlMethodIntent,lifecycleControlIntentFingerprint,lifecycleControlCommandFingerprint,
 buildControlCommit,controlRecovery,validateControlResult,validateControlStatus,lifecycleControlResultFingerprint,
 validateControlDelivery,validateControlPreparation} from '../../packages/domain/src/lifecycle/control-storage.mjs';
import {proposeRetentionRule,proposeHold,proposeHoldRelease} from '../../packages/domain/src/lifecycle/retention.mjs';

const id=n=>'70000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const NOW=Date.parse('2026-10-17T15:00:00.000Z'),iso=n=>new Date(n).toISOString();
const scope={workspaceId:id(1),recordId:id(2),recordRevision:'1',classification:'restricted_research'};
const p={workspaceId:scope.workspaceId,subjectId:'reviewer'};
const rule=()=>({operationId:id(3),ruleId:id(4),revision:'1',scope,retentionClass:'case_and_rights_policy',basis:'policy',evidenceId:id(5),effectiveAt:iso(NOW-1000),expiresAt:iso(NOW+100000),reviewBy:iso(NOW+90000),retainUntil:iso(NOW+10000),disposeBy:iso(NOW+80000)});
const intent=()=>controlMethodIntent('putRule',{command:rule(),expectedControlRevision:'0',expectedFingerprint:null});
function prepared(principal,i){
 const grant={grantId:id(6),revision:'1',evidenceId:id(7),evidenceRevision:'1',validFrom:iso(NOW-10000),expiresAt:iso(NOW+100000)};
 return {scope:i.scope,controlRevision:'0',current:null,grant,authority:{workspaceId:principal.workspaceId,subjectId:principal.subjectId,action:i.action,operationId:i.command.operationId,authorizationId:i.command.operationId,authorityEvidenceId:grant.evidenceId,authorityRevision:grant.revision,validFrom:grant.validFrom,expiresAt:grant.expiresAt,commandFingerprint:lifecycleControlCommandFingerprint(principal,i)},intentFingerprint:lifecycleControlIntentFingerprint(principal,i)};
}
function result(c){
 const record=proposeRetentionRule(c.authority,c.intent.command,NOW).record;
 return {record,operation:c,receipt:{operationId:c.intent.command.operationId,fingerprint:c.fingerprint,action:c.intent.action,scope:c.intent.scope,controlId:c.intent.command.ruleId,revision:'1',controlRevision:'1',recordFingerprint:record.fingerprint,auditSequence:'1',recordedAt:iso(NOW),committed:true,effectsVerified:false}};
}
const deny=fn=>assert.throws(fn,error=>error.code==='lifecycle_control_unavailable');

test('private result digest has an independent Unicode/escaping vector and ignores object insertion order only',()=>{
 const a={z:['雪','quote"slash\\','\u2028'],a:{number:1,bool:true,empty:null}},b={a:{empty:null,bool:true,number:1},z:[...a.z]};
 // Generated independently with Python json.dumps(sort_keys=True,
 // ensure_ascii=False,separators=(',',':')) and hashlib.sha256.
 assert.equal(lifecycleControlResultFingerprint(a),'cc8729e28a17894373104d3d0dfb9f8f55230bb462e9f19d16c83aa2337e51c3');
 assert.equal(lifecycleControlResultFingerprint(a),lifecycleControlResultFingerprint(b));
 assert.notEqual(lifecycleControlResultFingerprint(a),lifecycleControlResultFingerprint({...a,z:[...a.z].reverse()}));
});
test('owned protocol rejects hostile proxies, getters, hidden data, sparse arrays and forged serialization before access',()=>{
 let effects=0;const traps=new Proxy({}, {getPrototypeOf(){effects++;return Object.prototype;},ownKeys(){effects++;return[];}});
 const getter={};Object.defineProperty(getter,'secret',{enumerable:true,get(){effects++;return'private';}});
 const hidden={visible:true};Object.defineProperty(hidden,'secret',{value:'private'});
 const sparse=[];sparse.length=2;sparse[1]=true;
 for(const value of [traps,{nested:traps},getter,hidden,sparse,{toJSON(){effects++;return{};}},{[Symbol('secret')]:true},Object.assign(Object.create(null),{safe:true})])deny(()=>controlOwned(value));
 assert.equal(effects,0);
});
test('operation identity binds current scope generation and independently established grant proof',()=>{
 const i=intent(),a=buildControlCommit(p,i,prepared(p,i),NOW);
 const newScopeGeneration={...i,expectedControlRevision:'1'},b=buildControlCommit(p,newScopeGeneration,prepared(p,newScopeGeneration),NOW);
 assert.notEqual(a.intentFingerprint,b.intentFingerprint);assert.notEqual(a.fingerprint,b.fingerprint);
 const changed=prepared(p,i);changed.grant.grantId=id(99);const c=buildControlCommit(p,i,changed,NOW);
 assert.notEqual(a.fingerprint,c.fingerprint);assert.equal(a.proposalFingerprint,c.proposalFingerprint);
 const moved={...i,scope:{...scope,recordRevision:'2'},command:{...i.command,scope:{...scope,recordRevision:'2'}}};
 assert.notEqual(a.intentFingerprint,lifecycleControlIntentFingerprint(p,moved));
});
test('recovery verifies the complete immutable operation rather than trusting a supplied receipt hash',()=>{
 const i=intent(),a=buildControlCommit(p,i,prepared(p,i),NOW),valid=result(a);assert.deepEqual(validateControlResult(p,controlRecovery(a),valid,a),valid);
 const other={...i,command:{...i.command,retainUntil:iso(NOW+20000)}},b=buildControlCommit(p,other,prepared(p,other),NOW),changed=result(b);
 deny(()=>validateControlResult(p,controlRecovery(a),{...changed,receipt:{...changed.receipt,fingerprint:a.fingerprint},operation:a}));
 deny(()=>validateControlResult(p,controlRecovery(a),{...changed,receipt:{...changed.receipt,fingerprint:a.fingerprint}}));
});
test('private delivery wrapper cannot substitute a different valid result or extend the host with free fields',()=>{
 const i=intent(),c=buildControlCommit(p,i,prepared(p,i),NOW),value=result(c),admission={expiresAt:iso(NOW+1000),resultFingerprint:lifecycleControlResultFingerprint(value)};
 const checked=validateControlDelivery({value,admission});assert.ok(Object.isFrozen(checked.value.operation.authority));assert.ok(Object.isFrozen(checked.admission));
 deny(()=>validateControlDelivery({value:{...value,receipt:{...value.receipt,auditSequence:'2'}},admission}));
 deny(()=>validateControlDelivery({value,admission:{...admission,authorityVerified:true}}));
});
test('a held control cannot be prepared as a retention rule under the same object identity',()=>{
 const i=intent(),r=prepared(p,i),place={operationId:id(30),holdId:i.command.ruleId,scope,reason:'legal-hold',evidenceId:id(31),effectiveAt:iso(NOW-10000),expiresAt:iso(NOW+100000),reviewBy:iso(NOW+90000)};
 const holdIntent=controlMethodIntent('placeHold',{command:place,expectedControlRevision:'0'}),a=prepared(p,holdIntent).authority;
 r.current=proposeHold(a,place,NOW).record;deny(()=>validateControlPreparation(p,i,r));
});
test('64 fully released holds with maximum subject and revision widths fit the owned status and delivery budgets',()=>{
 const wide={...scope,recordRevision:'9223372036854775807'},operator={workspaceId:wide.workspaceId,subjectId:'界'.repeat(128)},records=[];
 for(let n=0;n<64;n++){
  const place={operationId:id(1000+n),holdId:id(2000+n),scope:wide,reason:'preservation-hold',evidenceId:id(3000+n),effectiveAt:'0001-01-01T00:00:00.000Z',expiresAt:'9999-12-31T23:59:59.999Z',reviewBy:'9999-12-31T23:59:59.998Z'};
  const hi=controlMethodIntent('placeHold',{command:place,expectedControlRevision:'9223372036854775806'}),a=prepared(operator,hi).authority;
  a.authorityRevision='9223372036854775807';a.validFrom=place.effectiveAt;a.expiresAt=place.expiresAt;
  const held=proposeHold(a,place,NOW-1).record;
  const command={operationId:id(4000+n),holdId:place.holdId,expectedRevision:'1',holdFingerprint:held.fingerprint,evidenceId:id(5000+n),reviewBy:place.reviewBy};
  const ri=controlMethodIntent('releaseHold',{scope:wide,command,expectedControlRevision:'9223372036854775806'}),ra=prepared(operator,ri).authority;
  ra.authorityRevision=a.authorityRevision;ra.validFrom=a.validFrom;ra.expiresAt=a.expiresAt;
  records.push(proposeHoldRelease(ra,held,command,NOW).record);
 }
 const value=validateControlStatus(wide,{scope:wide,controlRevision:'9223372036854775807',records,effectsVerified:false});
 const wrapper={value,admission:{expiresAt:iso(NOW+1000),resultFingerprint:lifecycleControlResultFingerprint(value)}};
 assert.equal(validateControlDelivery(wrapper).value.records.length,64);
 assert.ok(Buffer.byteLength(JSON.stringify(wrapper),'utf8')<262144);
});
