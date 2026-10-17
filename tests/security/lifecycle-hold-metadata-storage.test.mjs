import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 HoldMetadataError,HOLD_METADATA_PURPOSE,HOLD_METADATA_PROJECTION_VERSION,
 validateHoldMetadataDescriptor,holdMetadataDescriptorFingerprint,validateHoldMetadataTarget,
 projectHoldMetadata,holdMetadataAuthorityFingerprint,buildHoldMetadataAuthorityOperation,
 validateHoldMetadataAuthorityOperation,validateHoldMetadataAuthorityRevision,
 validateHoldMetadataAuthorityReplay,validateHoldMetadataReleaseCommit,validateHoldMetadataReleaseReplay,
} from '../../packages/domain/src/lifecycle/hold-metadata-storage.mjs';
import {
 controlMethodIntent,lifecycleControlCommandFingerprint,lifecycleControlIntentFingerprint,
 buildControlCommit,validateControlCommit,controlRecovery,
} from '../../packages/domain/src/lifecycle/control-storage.mjs';
import {proposeHold,proposeHoldRelease} from '../../packages/domain/src/lifecycle/retention.mjs';

const id=n=>'81000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const NOW=Date.parse('2026-10-17T15:00:00.000Z'),iso=n=>new Date(n).toISOString();
const SCOPE={workspaceId:id(1),recordId:id(2),recordRevision:'7',classification:'restricted_research'};
const MAINTAINER={workspaceId:id(1),subjectId:'reviewer"\\雪\u2028'};
const OPERATOR={workspaceId:id(1),subjectId:'release-operator-private'};
const clone=value=>structuredClone(value);
const deny=fn=>assert.throws(fn,error=>error instanceof HoldMetadataError&&error.code==='hold_metadata_unavailable'&&error.message==='Hold metadata unavailable');
function proof(p,intent){return {
 workspaceId:p.workspaceId,subjectId:p.subjectId,action:intent.action,operationId:intent.command.operationId,
 authorizationId:intent.command.operationId,authorityEvidenceId:id(13),authorityRevision:'2',
 validFrom:iso(NOW-10000),expiresAt:iso(NOW+100000),commandFingerprint:lifecycleControlCommandFingerprint(p,intent),
};}
function hold(change={}){
 const command={operationId:id(3),holdId:id(4),scope:clone(SCOPE),reason:'legal-hold',evidenceId:id(5),
  effectiveAt:iso(NOW-5000),expiresAt:iso(NOW+120000),reviewBy:iso(NOW+90000),...change};
 const intent=controlMethodIntent('placeHold',{command,expectedControlRevision:'5'});
 const operator={workspaceId:command.scope.workspaceId,subjectId:'placement-author-private'};
 return proposeHold(proof(operator,intent),command,NOW).record;
}
function descriptor(h=hold()) {return {
 purpose:HOLD_METADATA_PURPOSE,projectionVersion:HOLD_METADATA_PROJECTION_VERSION,scope:clone(h.placement.command.scope),
 holdId:h.placement.command.holdId,placementFingerprint:h.release?.command.holdFingerprint??h.fingerprint,
};}
function release(h=hold(),change={}){
 const command={operationId:id(8),holdId:h.placement.command.holdId,expectedRevision:'1',
  holdFingerprint:h.release?.command.holdFingerprint??h.fingerprint,evidenceId:id(9),reviewBy:iso(NOW+85000),...change};
 const intent=controlMethodIntent('releaseHold',{scope:h.placement.command.scope,command,expectedControlRevision:'6'});
 const p={...OPERATOR,workspaceId:intent.scope.workspaceId},authority=proof(p,intent);
 const prepared={scope:intent.scope,controlRevision:'6',current:h,grant:{grantId:id(12),revision:'2',evidenceId:id(13),
  evidenceRevision:'1',validFrom:authority.validFrom,expiresAt:authority.expiresAt},authority,
  intentFingerprint:lifecycleControlIntentFingerprint(p,intent)};
 const commit=buildControlCommit(p,intent,prepared,NOW+1000);
 return {principal:p,commit,record:proposeHoldRelease(authority,h,command,NOW+1000).record};
}
function target(h=hold()) {return {
 descriptor:descriptor(h),hold:h,currentRecord:{workspaceId:h.placement.command.scope.workspaceId,
  recordId:h.placement.command.scope.recordId,version:'11',classification:'research',state:'withdrawn'},controlRevision:'9',
};}
function evidence(change={}){return {
 operationId:id(20),evidenceId:id(21),revision:'1',expectedFingerprint:null,scope:clone(SCOPE),action:'lifecycle.hold-release',
 authorityKind:'legal-review',authorityReference:id(22),reviewerReference:id(23),
 validFrom:iso(NOW-60000),expiresAt:iso(NOW+600000),reviewBy:iso(NOW+300000),state:'verified',...change,
};}
function grant(change={}){return {
 operationId:id(30),grantId:id(31),revision:'1',expectedFingerprint:null,scope:clone(SCOPE),subjectId:OPERATOR.subjectId,
 action:'lifecycle.hold-release',evidenceId:id(21),evidenceRevision:'1',
 validFrom:iso(NOW-60000),expiresAt:iso(NOW+600000),reviewBy:iso(NOW+300000),state:'active',...change,
};}
function operation(kind='grant',command=null,h=hold(),d=descriptor(h),maintainer=MAINTAINER){
 return buildHoldMetadataAuthorityOperation(maintainer,kind,{descriptor:d,hold:h,command:command??(kind==='grant'?grant():evidence())});
}
const reverse=value=>value===null||typeof value!=='object'?value:Array.isArray(value)?value.map(reverse):Object.fromEntries(Object.entries(value).reverse().map(([key,v])=>[key,reverse(v)]));
function resignV1(principal,value){
 const c=clone(value),hash=(profile,input)=>createHash('sha256').update(profile+'\n'+JSON.stringify(input)).digest('hex');
 c.intentFingerprint=lifecycleControlIntentFingerprint(principal,c.intent);
 c.authority.operationId=c.intent.command.operationId;c.authority.authorizationId=c.intent.command.operationId;
 c.authority.commandFingerprint=lifecycleControlCommandFingerprint(principal,c.intent);
 c.proposalFingerprint=hash('garden-retention-v1\noperation',{command:c.intent.command,authority:c.authority});
 c.fingerprint=hash('garden-lifecycle-control-operation-v1',{intentFingerprint:c.intentFingerprint,grantId:c.grantId,
  grantRevision:c.grantRevision,authority:c.authority,proposalFingerprint:c.proposalFingerprint});return c;
}

test('descriptor and authority hashes have independent Python vectors including Unicode and JSON escaping',()=>{
 // Python hashlib.sha256 over independently assembled fixed-order dictionaries,
 // json.dumps(ensure_ascii=False,separators=(',',':')); no module-generated hash.
 const h=hold(),d=descriptor(h);
 assert.equal(h.fingerprint,'b0fdfefc59c018f78260bd41afa93889fc0037a056d07fc0520d6a0024f77963');
 assert.equal(holdMetadataDescriptorFingerprint(d),'1acdef8b5381b3c1f272139562fc7df1c7464bb4bbd4c8b04eacceb69bb93ccc');
 assert.equal(operation('grant').fingerprint,'e690471e662fa9224f888610f5a7842dc01ed31fe4f5fdc56df0f5d1b81192b7');
 assert.equal(operation('evidence').fingerprint,'4b051867f3e26d338b6a3c0978894bd2e8f43cebb9bdd88cad76408453eb02fb');
});
test('canonical encoding owns field order and preserves scalar spelling rather than normalizing identities',()=>{
 const a=operation(),b=buildHoldMetadataAuthorityOperation(reverse(MAINTAINER),'grant',reverse({descriptor:descriptor(),hold:hold(),command:grant()}));
 assert.deepEqual(a,b);
 assert.equal(holdMetadataDescriptorFingerprint(reverse(descriptor())),holdMetadataDescriptorFingerprint(descriptor()));
 const decomposed={workspaceId:id(1),subjectId:'reviewer-e\u0301'},composed={...decomposed,subjectId:'reviewer-é'};
 assert.notEqual(operation('grant',grant(),hold(),descriptor(),decomposed).fingerprint,operation('grant',grant(),hold(),descriptor(),composed).fingerprint);
});
test('owned inputs and every returned level remain independent and frozen after caller mutation',()=>{
 const h=clone(hold()),d=descriptor(h),command=grant(),maintainer=clone(MAINTAINER);
 const o=buildHoldMetadataAuthorityOperation(maintainer,'grant',{descriptor:d,hold:h,command}),saved=clone(o);
 d.scope.recordId=id(80);h.placement.command.reason='preservation-hold';command.subjectId='changed';maintainer.subjectId='changed';
 assert.deepEqual(o,saved);
 for(const value of [o,o.maintainer,o.descriptor,o.descriptor.scope,o.command,o.command.scope])assert.ok(Object.isFrozen(value));
 const t=target(),projected=projectHoldMetadata(t);t.currentRecord.state='active';t.descriptor.scope.recordRevision='8';
 assert.equal(projected.currentRecord.state,'withdrawn');assert.equal(projected.originalScope.recordRevision,'7');
 assert.ok(Object.isFrozen(projected.currentRecord));assert.ok(Object.isFrozen(projected.hold));
});

const hostileCases={
 proxy:(value,count)=>new Proxy(value,{getPrototypeOf(){count.calls++;return Object.prototype;},ownKeys(){count.calls++;return Reflect.ownKeys(value);}}),
 getter:(value,count)=>{const v=clone(value);Object.defineProperty(v,'purpose',{enumerable:true,get(){count.calls++;return HOLD_METADATA_PURPOSE;}});return v;},
 symbol:value=>({...clone(value),[Symbol('hidden')]:true}),
 hidden:value=>{const v=clone(value);Object.defineProperty(v,'private',{value:'owner-private'});return v;},
 toJSON:(value,count)=>({...clone(value),toJSON(){count.calls++;return value;}}),
 nullPrototype:value=>Object.assign(Object.create(null),clone(value)),
 inherited:value=>Object.assign(Object.create({owner:'owner-private'}),clone(value)),
 sparse:value=>{const v=clone(value);v.extra=Array(2);v.extra[1]=true;return v;},
};
for(const [name,make] of Object.entries(hostileCases))test('hostile '+name+' input denies without invoking caller behavior',()=>{
 const count={calls:0},value=make(descriptor(),count);deny(()=>validateHoldMetadataDescriptor(value));
 deny(()=>projectHoldMetadata({...target(),descriptor:value}));
 deny(()=>buildHoldMetadataAuthorityOperation(MAINTAINER,'grant',{descriptor:value,hold:hold(),command:grant()}));
 assert.equal(count.calls,0);
});
test('nested accessors, proxies, array decorations, cycles, malformed Unicode and excessive input cannot reach serialization',()=>{
 let calls=0;const h=clone(hold());Object.defineProperty(h.placement.authority,'subjectId',{enumerable:true,get(){calls++;return'private';}});
 deny(()=>projectHoldMetadata({...target(),hold:h}));
 const cmd=grant();cmd.scope=new Proxy(SCOPE,{ownKeys(){calls++;return Reflect.ownKeys(SCOPE);}});deny(()=>operation('grant',cmd));
 const circular=descriptor();circular.scope=circular;deny(()=>validateHoldMetadataDescriptor(circular));
 const array=[1];array.private=true;deny(()=>projectHoldMetadata({...target(),currentRecord:array}));
 for(const subjectId of ['bad\ud800','owner private','x'.repeat(129),'x'.repeat(262145)])deny(()=>operation('grant',grant({subjectId})));
 assert.equal(calls,0);
});
test('descriptor requires the one affirmative purpose and exact projection version, with no legacy or truthy fallback',()=>{
 for(const purpose of [undefined,null,true,'research','hold-administration','hold-administration-v2']){
  const d={...descriptor(),purpose};deny(()=>validateHoldMetadataDescriptor(d));
 }
 for(const projectionVersion of [1,0,'01','2',null])deny(()=>validateHoldMetadataDescriptor({...descriptor(),projectionVersion}));
 const missing=descriptor();delete missing.purpose;deny(()=>validateHoldMetadataDescriptor(missing));
 for(const key of ['authorityVerified','consentExempt','ownerSubjectId','payload'])deny(()=>validateHoldMetadataDescriptor({...descriptor(),[key]:true}));
});
test('a correctly hashed different hold, placement, original record, or retained revision cannot satisfy another descriptor',()=>{
 const original=descriptor(),cases=[hold({holdId:id(55)}),hold({reason:'preservation-hold'}),
  hold({scope:{...SCOPE,recordId:id(56)}}),hold({scope:{...SCOPE,recordRevision:'8'}})];
 for(const other of cases)deny(()=>validateHoldMetadataTarget({...target(other),descriptor:original}));
 const released=release().record;assert.equal(validateHoldMetadataTarget(target(released)).descriptor.placementFingerprint,original.placementFingerprint);
 deny(()=>validateHoldMetadataTarget({...target(released),descriptor:{...original,placementFingerprint:released.fingerprint}}));
});
test('original retained scope remains separate while only a bounded actual current tuple is representable',()=>{
 for(const state of ['active','quarantined','withdrawn']){
  const t=target();t.currentRecord.state=state;const p=projectHoldMetadata(t);
  assert.equal(p.originalScope.recordRevision,'7');assert.equal(p.originalScope.classification,'restricted_research');
  assert.equal(p.currentRecord.version,'11');assert.equal(p.currentRecord.classification,'research');assert.equal(p.currentRecord.state,state);
 }
 for(const [field,value] of [['workspaceId',id(60)],['recordId',id(61)],['version','6'],['version',11],['version','011'],['version','9223372036854775808'],['classification','sealed'],['classification','restricted_research'],['state','deleted']]){
  const t=target();t.currentRecord[field]=value;deny(()=>validateHoldMetadataTarget(t));
 }
 for(const controlRevision of ['0',0,'01','9223372036854775808'])deny(()=>validateHoldMetadataTarget({...target(),controlRevision}));
 deny(()=>validateHoldMetadataTarget({...target(release().record),controlRevision:'1'}));
});
test('projection explicitly excludes placement/release actors, proof/grant details, operation IDs and raw record data',()=>{
 const {record}=release(),p=projectHoldMetadata(target(record));
 assert.deepEqual(Object.keys(p),['schemaVersion','kind','purpose','projectionVersion','originalScope','currentRecord','controlRevision','hold','effectsVerified']);
 assert.deepEqual(Object.keys(p.currentRecord),['workspaceId','recordId','version','classification','state']);
 assert.deepEqual(Object.keys(p.hold),['holdId','revision','fingerprint','placementFingerprint','reason','evidenceId','effectiveAt','expiresAt','reviewBy','recordedAt','release']);
 assert.deepEqual(Object.keys(p.hold.release),['evidenceId','reviewBy','recordedAt']);
 const serialized=JSON.stringify(p);
 for(const privateValue of ['placement-author-private','release-operator-private',id(3),id(8),id(12),id(13)])assert.ok(!serialized.includes(privateValue));
 for(const key of ['payload','ownerSubjectId','author','wholeRow','admission']){
  const t=target(record);t.currentRecord[key]='sensitive-'+key;deny(()=>projectHoldMetadata(t));
 }
 assert.equal(p.effectsVerified,false);assert.equal(p.hold.revision,'2');
 assert.ok(!Object.hasOwn(p,'committed'));assert.ok(!Object.hasOwn(p.hold,'canRelease'));assert.ok(!Object.hasOwn(p,'canRead'));
});
test('elapsed dates do not silently discard a retained hold or turn it into permission',()=>{
 const old=hold({effectiveAt:iso(NOW-5000),expiresAt:iso(NOW+2),reviewBy:iso(NOW+1)});
 const p=projectHoldMetadata(target(old));
 assert.equal(p.hold.revision,'1');assert.equal(p.hold.expiresAt,iso(NOW+2));assert.equal(p.hold.release,null);
 assert.equal(p.effectsVerified,false);assert.ok(!Object.hasOwn(p.hold,'active'));assert.ok(!Object.hasOwn(p,'disposalAllowed'));
});

test('authority commands require exact metadata actions, canonical identifiers/revisions and bounded explicit review dates',()=>{
 const changes=[{action:'lifecycle.hold-place'},{action:'lifecycle.retention-rule'},{action:'lifecycle.administer'},
  {scope:{...SCOPE,recordRevision:'8'}},{operationId:'not-a-uuid'},{evidenceRevision:1},{revision:'01'},
  {revision:'2',expectedFingerprint:null},{revision:'1',expectedFingerprint:'a'.repeat(64)},
  {reviewBy:iso(NOW-60000)},{reviewBy:iso(NOW+600001)},{validFrom:'2026-02-30T00:00:00.000Z'},
  {expiresAt:'2026-10-17T15:10:00Z'},{state:'true'}];
 for(const change of changes)deny(()=>operation('grant',grant(change)));
 for(const change of [{authorityKind:'owner'},{authorityReference:'paper'},{reviewerReference:null},{state:'active'}])deny(()=>operation('evidence',evidence(change)));
 deny(()=>operation('other'));
 assert.equal(operation('grant',grant({action:'lifecycle.inspect'})).command.action,'lifecycle.inspect');
 assert.equal(operation('evidence',evidence({action:'lifecycle.inspect'})).command.action,'lifecycle.inspect');
});
test('creation fingerprint binds maintainer identity and every evidence/grant field before any prior state is committed',()=>{
 for(const kind of ['evidence','grant']){
  const base=kind==='grant'?grant():evidence(),a=operation(kind,base),changes={operationId:id(71),evidenceId:id(72),
   revision:'2',expectedFingerprint:'a'.repeat(64),action:'lifecycle.inspect',validFrom:iso(NOW-59000),
   expiresAt:iso(NOW+599999),reviewBy:iso(NOW+299999),state:'revoked',
   ...(kind==='grant'?{grantId:id(73),subjectId:'other-operator',evidenceRevision:'2'}:{authorityKind:'policy-appointment',authorityReference:id(74),reviewerReference:id(75)})};
  for(const [field,value] of Object.entries(changes)){
   const change=field==='revision'||field==='expectedFingerprint'?{revision:'2',expectedFingerprint:'a'.repeat(64)}:{[field]:value};
   assert.notEqual(operation(kind,{...base,...change}).fingerprint,a.fingerprint,kind+' '+field);
  }
  assert.notEqual(operation(kind,base,hold(),descriptor(),{...MAINTAINER,subjectId:'another-maintainer'}).fingerprint,a.fingerprint);
  deny(()=>validateHoldMetadataAuthorityOperation(hold(),{...a,maintainer:{...MAINTAINER,subjectId:'another-maintainer'}}));
 }
});
test('a different valid target requires a new authority fingerprint and cannot replay under a retained operation',()=>{
 const a=operation(),other=hold({holdId:id(81),operationId:id(82)}),b=operation('grant',grant(),other,descriptor(other));
 assert.notEqual(a.fingerprint,b.fingerprint);
 deny(()=>validateHoldMetadataAuthorityOperation(hold(),b));
 deny(()=>validateHoldMetadataAuthorityReplay(other,a,b));
 const moved=hold({scope:{...SCOPE,workspaceId:id(83)}}),movedPrincipal={...MAINTAINER,workspaceId:id(83)};
 deny(()=>operation('grant',grant(),moved,descriptor(moved),movedPrincipal));
 assert.notEqual(operation('grant',grant({scope:moved.placement.command.scope}),moved,descriptor(moved),movedPrincipal).fingerprint,a.fingerprint);
});
test('exact replay accepts fresh owned copies with canonical order and rejects both stale hash and rehashed substitutions',()=>{
 const a=operation();assert.deepEqual(validateHoldMetadataAuthorityReplay(hold(),a,reverse(a)),a);
 const changed=operation('grant',grant({reviewBy:iso(NOW+250000)}));
 deny(()=>validateHoldMetadataAuthorityReplay(hold(),a,changed));
 deny(()=>validateHoldMetadataAuthorityReplay(hold(),a,{...changed,fingerprint:a.fingerprint}));
 for(const key of ['fingerprint','descriptor','effectsVerified']){const missing=clone(a);delete missing[key];deny(()=>validateHoldMetadataAuthorityOperation(hold(),missing));}
 deny(()=>validateHoldMetadataAuthorityOperation(hold(),{...a,effectsVerified:true}));
 deny(()=>validateHoldMetadataAuthorityOperation(hold(),{...a,committed:true}));
});
test('new-profile predecessor validation pins identity, original purpose/scope, action and subject while allowing reviewed revisions',()=>{
 for(const kind of ['evidence','grant']){
  const a=operation(kind),command={...a.command,operationId:id(91),revision:'2',expectedFingerprint:a.fingerprint,state:'revoked'};
  const b=operation(kind,command,hold(),descriptor(),{...MAINTAINER,subjectId:'next-maintainer'});
  assert.deepEqual(validateHoldMetadataAuthorityRevision(hold(),a,b),b);
  for(const change of [{operationId:a.command.operationId},{revision:'3'},{expectedFingerprint:'f'.repeat(64)},
   {action:'lifecycle.inspect'},...(kind==='grant'?[{grantId:id(92)},{subjectId:'other-operator'}]:[{evidenceId:id(93)}])]){
   const other=operation(kind,{...command,...change});deny(()=>validateHoldMetadataAuthorityRevision(hold(),a,other));
  }
  deny(()=>validateHoldMetadataAuthorityRevision(hold(),a.command,b));
  deny(()=>validateHoldMetadataAuthorityRevision(hold(),{...a,kind:'legacy-authority-operation'},b));
 }
});
test('metadata history validation is not a claim of fresh evidence, identity birth, authority, or admission',()=>{
 const revoked=operation('grant',grant({state:'revoked'}));
 assert.equal(validateHoldMetadataAuthorityOperation(hold(),revoked).command.state,'revoked');
 assert.equal(revoked.effectsVerified,false);assert.ok(!Object.hasOwn(revoked,'authorityVerified'));assert.ok(!Object.hasOwn(revoked,'committed'));
 // Reusing a syntactically valid ID is representable here. Storage must prove
 // that this ID was born under the new profile and is currently authorized.
 const reused=operation('grant',grant({grantId:id(12)}));assert.equal(reused.command.grantId,id(12));
});

test('the metadata wrapper preserves every original v1 release field and its independent fixed hash',()=>{
 const h=hold(),{principal,commit}=release(h),checked=validateHoldMetadataReleaseCommit(principal,{descriptor:descriptor(h),hold:h,commit});
 assert.equal(commit.fingerprint,'a0ec919193eabd2a81f79b956fe102f04993f4d532ee095ca10580f9033fa0e0');
 assert.deepEqual(checked,validateControlCommit(principal,commit));assert.deepEqual(controlRecovery(checked),controlRecovery(commit));
 assert.equal(JSON.stringify(checked),JSON.stringify(commit));assert.ok(Object.isFrozen(checked.intent.command));
});
test('current state changes affect only the admission projection, never original authority or release hashes',()=>{
 const a=target(),b=clone(a);b.currentRecord.version='12';b.currentRecord.state='quarantined';
 assert.notDeepEqual(projectHoldMetadata(a),projectHoldMetadata(b));assert.deepEqual(projectHoldMetadata(a).originalScope,projectHoldMetadata(b).originalScope);
 const {principal,commit}=release(a.hold);
 assert.equal(validateHoldMetadataReleaseCommit(principal,{descriptor:a.descriptor,hold:a.hold,commit}).fingerprint,
  validateHoldMetadataReleaseCommit(principal,{descriptor:b.descriptor,hold:b.hold,commit}).fingerprint);
 assert.equal(holdMetadataAuthorityFingerprint(MAINTAINER,'grant',{descriptor:a.descriptor,command:grant()}),
  holdMetadataAuthorityFingerprint(MAINTAINER,'grant',{descriptor:b.descriptor,command:grant()}));
});
test('release wrapper requires the exact purpose, placement, original revision, actor, and hold kind around v1',()=>{
 const h=hold(),{principal,commit}=release(h),value={descriptor:descriptor(h),hold:h,commit};
 deny(()=>validateHoldMetadataReleaseCommit(principal,commit));
 deny(()=>validateHoldMetadataReleaseCommit({...principal,subjectId:'different-operator'},value));
 deny(()=>validateHoldMetadataReleaseCommit(principal,{...value,descriptor:{...value.descriptor,purpose:'research'}}));
 deny(()=>validateHoldMetadataReleaseCommit(principal,{...value,descriptor:{...value.descriptor,scope:{...SCOPE,recordRevision:'11'}}}));
 const other=hold({operationId:id(98),reason:'preservation-hold'});
 deny(()=>validateHoldMetadataReleaseCommit(principal,{...value,descriptor:descriptor(other),hold:other}));
 const changed=clone(commit);changed.intent.command.operationId=h.placement.command.operationId;
 const reused=resignV1(principal,changed);
 // Generic v1 representation validation has no hold; this wrapper supplies
 // the retained placement needed to reject cross-action operation-ID reuse.
 assert.deepEqual(validateControlCommit(principal,reused),reused);
 deny(()=>validateHoldMetadataReleaseCommit(principal,{...value,commit:reused}));
});
test('released history checks placement and recorded command/proof compatibility without claiming full-operation replay',()=>{
 const h=hold(),{principal,commit,record}=release(h),value={descriptor:descriptor(record),hold:record,commit};
 assert.deepEqual(validateHoldMetadataReleaseCommit(principal,value),commit);
 const changed=release(h,{operationId:id(99)}).commit;
 deny(()=>validateHoldMetadataReleaseCommit(principal,{...value,commit:changed}));
 const evidenceChanged=release(h,{evidenceId:id(100)}).commit;
 deny(()=>validateHoldMetadataReleaseCommit(principal,{...value,commit:evidenceChanged}));
 assert.equal(record.revision,'2');assert.deepEqual(record.placement,h.placement);
});
test('full release replay canonicalizes owned copies and preserves the original v1 bytes and fingerprint',()=>{
 const {principal,commit,record}=release(),expectedCommit=clone(commit),receivedCommit=reverse(commit);
 const value=reverse({descriptor:descriptor(record),hold:clone(record),expectedCommit,receivedCommit});
 const checked=validateHoldMetadataReleaseReplay(reverse(principal),value);
 assert.equal(JSON.stringify(checked),JSON.stringify(commit));
 assert.equal(checked.fingerprint,'a0ec919193eabd2a81f79b956fe102f04993f4d532ee095ca10580f9033fa0e0');
 assert.deepEqual(controlRecovery(checked),controlRecovery(commit));
 for(const node of [checked,checked.intent,checked.intent.scope,checked.intent.command,checked.authority])assert.ok(Object.isFrozen(node));
 value.expectedCommit.grantId=id(110);value.receivedCommit.intent.expectedControlRevision='7';value.hold.release.command.evidenceId=id(111);
 assert.deepEqual(checked,commit);
});
for(const [field,change] of [
 ['grant identity',c=>{c.grantId=id(112);}],
 ['aggregate control revision',c=>{c.intent.expectedControlRevision='7';}],
])test('full release replay rejects a valid independently rehashed '+field+' substitution',()=>{
 const {principal,commit,record}=release(),changed=clone(commit);change(changed);
 const rehashed=resignV1(principal,changed),base={descriptor:descriptor(record),hold:record};
 assert.deepEqual(validateControlCommit(principal,rehashed),rehashed);
 // The retained hold contains neither field. Placement/command/proof
 // compatibility remains useful, but cannot establish exact operation replay.
 assert.deepEqual(validateHoldMetadataReleaseCommit(principal,{...base,commit:rehashed}),rehashed);
 assert.notEqual(rehashed.fingerprint,commit.fingerprint);
 deny(()=>validateHoldMetadataReleaseReplay(principal,{...base,expectedCommit:commit,receivedCommit:rehashed}));
 deny(()=>validateHoldMetadataReleaseReplay(principal,{...base,expectedCommit:rehashed,receivedCommit:commit}));
});
test('full release replay requires released history, exact target and principal, and two independently valid commits',()=>{
 const {principal,commit,record}=release(),value={descriptor:descriptor(record),hold:record,expectedCommit:commit,receivedCommit:commit};
 deny(()=>validateHoldMetadataReleaseReplay(principal,{...value,hold:hold()}));
 deny(()=>validateHoldMetadataReleaseReplay({...principal,subjectId:'another-operator'},value));
 deny(()=>validateHoldMetadataReleaseReplay(principal,{...value,descriptor:{...value.descriptor,purpose:'research'}}));
 deny(()=>validateHoldMetadataReleaseReplay(principal,{...value,descriptor:{...value.descriptor,scope:{...SCOPE,recordRevision:'8'}}}));
 for(const key of ['descriptor','hold','expectedCommit','receivedCommit']){
  const missing=clone(value);delete missing[key];deny(()=>validateHoldMetadataReleaseReplay(principal,missing));
 }
 deny(()=>validateHoldMetadataReleaseReplay(principal,{...value,committed:true}));
 for(const key of ['expectedCommit','receivedCommit']){
  const malformed=clone(value);malformed[key].fingerprint='f'.repeat(64);deny(()=>validateHoldMetadataReleaseReplay(principal,malformed));
  const wrongCommand=release(hold(),{operationId:id(113)}).commit;
  deny(()=>validateHoldMetadataReleaseReplay(principal,{...value,[key]:wrongCommand}));
 }
 const malformed={...commit,fingerprint:'f'.repeat(64)},wrongCommand=release(hold(),{operationId:id(114)}).commit;
 for(const incompatible of [malformed,wrongCommand])deny(()=>validateHoldMetadataReleaseReplay(principal,{
  ...value,expectedCommit:incompatible,receivedCommit:incompatible,
 }));
});
test('full release replay rejects hostile snapshots and principals without invoking caller behavior',()=>{
 const {principal,commit,record}=release(),value={descriptor:descriptor(record),hold:record,expectedCommit:commit,receivedCommit:commit};
 let calls=0;
 for(const key of ['descriptor','hold','expectedCommit','receivedCommit']){
  const proxy=new Proxy(value[key],{ownKeys(){calls++;return Reflect.ownKeys(value[key]);}});
  deny(()=>validateHoldMetadataReleaseReplay(principal,{...value,[key]:proxy}));
  const accessor=clone(value);Object.defineProperty(accessor,key,{enumerable:true,get(){calls++;return value[key];}});
  deny(()=>validateHoldMetadataReleaseReplay(principal,accessor));
 }
 const actor=clone(principal);Object.defineProperty(actor,'subjectId',{enumerable:true,get(){calls++;return principal.subjectId;}});
 deny(()=>validateHoldMetadataReleaseReplay(actor,value));
 assert.equal(calls,0);
});
