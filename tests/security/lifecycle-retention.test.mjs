import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RetentionError,RETENTION_CLASSES,retentionRuleCommandFingerprint,holdPlacementCommandFingerprint,
 holdReleaseCommandFingerprint,proposeRetentionRule,proposeHold,proposeHoldRelease,validateRetentionRule,
 validateHoldRecord,evaluateRetention} from '../../packages/domain/src/lifecycle/retention.mjs';

const NOW=Date.parse('2026-10-17T14:00:00.000Z'),iso=n=>new Date(n).toISOString();
const id=n=>'10000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const SCOPE={workspaceId:id(1),recordId:id(2),recordRevision:'1',classification:'restricted_research'};
const clone=v=>structuredClone(v),reverse=v=>Object.fromEntries(Object.entries(v).reverse());
const operator=command=>({workspaceId:command?.scope?.workspaceId??SCOPE.workspaceId,subjectId:'synthetic-reviewer'});
const reject=f=>assert.throws(f,e=>e instanceof RetentionError&&e.code==='retention_control_unavailable'&&e.message==='Retention control unavailable');
function ruleCommand(patch={}){return{operationId:id(10),ruleId:id(11),revision:'1',scope:clone(SCOPE),retentionClass:'case_and_rights_policy',basis:'policy',evidenceId:id(12),
 effectiveAt:iso(NOW-10000),expiresAt:iso(NOW+100000),reviewBy:iso(NOW+90000),retainUntil:iso(NOW+10000),disposeBy:iso(NOW+80000),...patch};}
function holdCommand(patch={}){return{operationId:id(20),holdId:id(21),scope:clone(SCOPE),reason:'legal-hold',evidenceId:id(22),effectiveAt:iso(NOW-10000),expiresAt:iso(NOW+70000),reviewBy:iso(NOW+50000),...patch};}
function proof(action,command,fingerprint,patch={}){return{workspaceId:command.scope?.workspaceId??SCOPE.workspaceId,subjectId:'synthetic-reviewer',action,operationId:command.operationId,
 authorizationId:id(action==='lifecycle.retention-rule'?30:action==='lifecycle.hold-place'?31:32),authorityEvidenceId:id(33),authorityRevision:'1',
 validFrom:iso(NOW-60000),expiresAt:iso(NOW+200000),commandFingerprint:fingerprint,...patch};}
const ruleProof=(command,patch)=>proof('lifecycle.retention-rule',command,retentionRuleCommandFingerprint(operator(command),command),patch);
const holdProof=(command,patch)=>proof('lifecycle.hold-place',command,holdPlacementCommandFingerprint(operator(command),command),patch);
const releaseProof=(hold,command,patch)=>proof('lifecycle.hold-release',command,holdReleaseCommandFingerprint(operator(hold.placement.command),hold,command),patch);
const rule=(command=ruleCommand(),at=NOW)=>proposeRetentionRule(ruleProof(command),command,at).record;
const hold=(command=holdCommand(),at=NOW)=>proposeHold(holdProof(command),command,at).record;
function releaseCommand(h,patch={}){return{operationId:id(40),holdId:h.placement.command.holdId,expectedRevision:'1',holdFingerprint:h.fingerprint,evidenceId:id(41),reviewBy:iso(NOW+90000),...patch};}
function released(h=hold(),at=NOW+1){const command=releaseCommand(h);return proposeHoldRelease(releaseProof(h,command),h,command,at).record;}
function snapshot({rules=[rule()],holds=[],at=NOW}={}){
 const authorities=[...rules.map(r=>r.event.authority),...holds.map(h=>h.release?.authority??h.placement.authority)];
 return{schemaVersion:1,scope:clone(SCOPE),revision:'1',observedAt:iso(at),validUntil:iso(at+60000),controlsState:'complete',rules,holds,
  ruleHeads:rules.map(r=>({id:r.event.command.ruleId,revision:r.event.command.revision,fingerprint:r.fingerprint})),
  holdHeads:holds.map(h=>({id:h.placement.command.holdId,revision:h.revision,fingerprint:h.fingerprint})),
  authorities:[...new Map(authorities.map(a=>[a.authorizationId,{authority:clone(a),state:'current'}])).values()],
  inventory:{scope:clone(SCOPE),revision:'1',state:'complete',evidenceId:id(50),materials:[{contentVersionId:id(51),generation:'1',envelopeDigest:'a'.repeat(64)}]}};
}
const expected=()=>({scope:clone(SCOPE),controlRevision:'1',inventoryRevision:'1'});
const evaluate=(current=snapshot(),now=NOW,wanted=expected())=>evaluateRetention(wanted,current,now);
function review(current,now=NOW,wanted=expected(),reason){const result=evaluate(current,now,wanted);assert.equal(result.status,'review-required');assert.equal(result.effectsVerified,false);if(reason)assert.ok(result.reasonCodes.includes(reason),JSON.stringify(result.reasonCodes));return result;}

test('rule and hold proposals are owned immutable canonical objects with no verified effects',()=>{
 const command=ruleCommand(),authority=ruleProof(command),result=proposeRetentionRule(authority,command,NOW);
 assert.equal(result.effectsVerified,false);assert.equal(result.operation.effectsVerified,false);assert.equal(result.replayed,false);
 command.scope.recordId=id(90);authority.subjectId='changed';
 assert.equal(result.record.event.command.scope.recordId,SCOPE.recordId);assert.equal(result.record.event.authority.subjectId,'synthetic-reviewer');
 for(const value of [result,result.record,result.record.event,result.record.event.command,result.record.event.command.scope,result.record.event.authority,result.operation])assert.equal(Object.isFrozen(value),true);
 assert.deepEqual(validateRetentionRule(reverse(clone(result.record))),result.record);
 const placed=hold();assert.equal(Object.isFrozen(placed.placement.command.scope),true);assert.deepEqual(validateHoldRecord(clone(placed)),placed);
 assert.equal(Object.isFrozen(RETENTION_CLASSES),true);
});

test('canonical command fingerprints ignore property insertion order without coercing values',()=>{
 const command=ruleCommand(),reordered=reverse({...command,scope:reverse(command.scope)});
 assert.equal(retentionRuleCommandFingerprint(operator(command),command),retentionRuleCommandFingerprint(reverse(operator(command)),reordered));
 assert.deepEqual(proposeRetentionRule(reverse(ruleProof(command)),reordered,NOW).record,rule(command));
 const placed=hold(),input=releaseCommand(placed);
 assert.equal(holdReleaseCommandFingerprint(operator(),placed,input),holdReleaseCommandFingerprint(reverse(operator()),reverse(clone(placed)),reverse(input)));
 reject(()=>retentionRuleCommandFingerprint(operator(),{...command,revision:1}));
});

test('each retention class is explicit and bound to its configured classification without default periods',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../../docs/security/data-classification.json',import.meta.url),'utf8'));
 const mappings=Object.fromEntries(catalog.classification.map(c=>[c.id,c.retention]));
 assert.deepEqual(RETENTION_CLASSES,Object.values(mappings));
 for(const [classification,retentionClass] of Object.entries(mappings)){
  const command=ruleCommand({scope:{...SCOPE,classification},retentionClass});assert.equal(rule(command).event.command.retentionClass,retentionClass);
 }
 reject(()=>rule(ruleCommand({retentionClass:'keep-forever'})));
 reject(()=>rule(ruleCommand({retentionClass:'bounded_audit_policy'})));
 reject(()=>rule(ruleCommand({scope:{...SCOPE,classification:'unclassified'}})));
});

test('scope, evidence, effective, expiry, review and finite retention boundaries are mandatory',()=>{
 for(const key of ['scope','evidenceId','effectiveAt','expiresAt','reviewBy','retainUntil','disposeBy','retentionClass']){
  const input=ruleCommand();delete input[key];reject(()=>rule(input));
 }
 for(const key of ['evidenceId','effectiveAt','expiresAt','reviewBy']){const input=holdCommand();delete input[key];reject(()=>hold(input));}
 for(const patch of [{reviewBy:null},{disposeBy:null},{retainUntil:'indefinite'},{expiresAt:'2026-02-30T00:00:00.000Z'},{effectiveAt:'2026-10-17'},{reviewBy:iso(NOW)},{retentionDays:30}])reject(()=>rule(ruleCommand(patch)));
 for(const patch of [{retainUntil:iso(NOW+90000)},{disposeBy:iso(NOW-20000)},{reviewBy:iso(NOW+110000)},{expiresAt:iso(NOW-10000)}])reject(()=>rule(ruleCommand(patch)));
});

test('shape validation rejects accessors, symbols, hidden fields, inherited values and toJSON without invoking them',()=>{
 let calls=0;
 const changes=[v=>Object.defineProperty(v,'scope',{enumerable:true,get(){calls++;return SCOPE;}}),
  v=>Object.defineProperty(v,'hidden',{value:'private-canary'}),v=>Object.defineProperty(v,Symbol('authority'),{value:true}),
  v=>Object.assign(v,{toJSON(){calls++;return {};}})];
 for(const change of changes)reject(()=>retentionRuleCommandFingerprint(operator(),change(ruleCommand())));
 reject(()=>retentionRuleCommandFingerprint(operator(),Object.create(ruleCommand())));
 reject(()=>retentionRuleCommandFingerprint(operator(),Object.assign(Object.create(null),ruleCommand())));
 const current=snapshot();Object.defineProperty(current.inventory.materials,'0',{enumerable:true,get(){calls++;return {};}});review(current);
 const list=snapshot();list.holds.extra=true;review(list);
 const sparse=snapshot();sparse.holds=new Array(1);review(sparse);
 assert.equal(calls,0);
});

test('authority binds every valid changed command before the first rule or hold proposal',()=>{
 const command=ruleCommand(),authority=ruleProof(command);
 for(const patch of [{operationId:id(90)},{ruleId:id(90)},{revision:'2'},{scope:{...SCOPE,recordId:id(90)}},{basis:'preservation-exception'},{evidenceId:id(90)},
  {effectiveAt:iso(NOW-9000)},{expiresAt:iso(NOW+110000)},{reviewBy:iso(NOW+85000)},{retainUntil:iso(NOW+9000)},{disposeBy:iso(NOW+75000)}]){
  reject(()=>proposeRetentionRule(authority,{...command,...patch},NOW));
 }
 const held=holdCommand(),heldProof=holdProof(held);
 for(const patch of [{holdId:id(90)},{scope:{...SCOPE,recordRevision:'2'}},{reason:'preservation-hold'},{evidenceId:id(90)},{reviewBy:iso(NOW+55000)}])reject(()=>proposeHold(heldProof,{...held,...patch},NOW));
});

function proposalCase(kind){
 if(kind==='rule'){const command=ruleCommand();return{command,authority:ruleProof(command),fingerprint:p=>retentionRuleCommandFingerprint(p,command),run:a=>proposeRetentionRule(a,command,NOW)};}
 if(kind==='place'){const command=holdCommand();return{command,authority:holdProof(command),fingerprint:p=>holdPlacementCommandFingerprint(p,command),run:a=>proposeHold(a,command,NOW)};}
 const current=hold(),command=releaseCommand(current);return{command,authority:releaseProof(current,command),fingerprint:p=>holdReleaseCommandFingerprint(p,current,command),run:a=>proposeHoldRelease(a,current,command,NOW+1)};
}
for(const kind of ['rule','place','release'])test(kind+' intent rejects an operator substitution before the first proposal',()=>{
 const example=proposalCase(kind),original=example.run(example.authority),other={...operator(),subjectId:'another-operator'};
 reject(()=>example.run({...example.authority,subjectId:other.subjectId}));
 assert.notEqual(example.fingerprint(other),example.authority.commandFingerprint);
 const separatelyBound={...example.authority,subjectId:other.subjectId,commandFingerprint:example.fingerprint(other)};
 const second=example.run(separatelyBound);assert.notEqual(second.operation.fingerprint,original.operation.fingerprint);assert.notEqual(second.operation.commandFingerprint,original.operation.commandFingerprint);
 reject(()=>example.fingerprint({...operator(),workspaceId:id(99)}));
 reject(()=>example.fingerprint({...operator(),role:'administrator'}));
});

test('operation receipts bind the full authority proof as well as the actor-bound command',()=>{
 for(const kind of ['rule','place','release']){
  const example=proposalCase(kind),first=example.run(example.authority);
  for(const patch of [{authorizationId:id(90)},{authorityEvidenceId:id(90)},{authorityRevision:'2'},{validFrom:iso(NOW-50000)},{expiresAt:iso(NOW+210000)}]){
   const next=example.run({...example.authority,...patch});
   assert.equal(next.operation.commandFingerprint,first.operation.commandFingerprint);
   assert.notEqual(next.operation.fingerprint,first.operation.fingerprint);
  }
 }
});

test('wrong workspace, action, version representation, missing evidence and expired authority reject',()=>{
 const command=ruleCommand(),a=ruleProof(command);
 for(const patch of [{workspaceId:id(90)},{action:'lifecycle.hold-release'},{operationId:id(90)},{authorizationId:null},{authorityEvidenceId:null},
  {authorityRevision:'01'},{authorityRevision:'9223372036854775808'},{validFrom:iso(NOW+1)},{expiresAt:iso(NOW)},{commandFingerprint:'b'.repeat(64)},{verified:true}])reject(()=>proposeRetentionRule({...a,...patch},command,NOW));
 for(const now of [undefined,null,NaN,Infinity,-1,NOW+0.5,String(NOW),253402300800000])reject(()=>proposeRetentionRule(a,command,now));
});

test('strict retained snapshots reject forged command, authority, scope, revision and fingerprint changes',()=>{
 const original=rule();
 for(const mutate of [r=>r.event.command.scope.recordId=id(90),r=>r.event.command.revision='2',r=>r.event.authority.subjectId='other',r=>r.fingerprint='0'.repeat(64)]){
  const r=clone(original);mutate(r);reject(()=>validateRetentionRule(r));review(snapshot({rules:[r]}));
 }
 const held=hold();for(const mutate of [h=>h.revision='2',h=>h.placement.command.scope.classification='operational_security',h=>h.placement.command.expiresAt=iso(NOW+80000),h=>h.fingerprint='0'.repeat(64)]){
  const h=clone(held);mutate(h);reject(()=>validateHoldRecord(h));
 }
});

test('retention window boundaries produce review proposals only and exact expiry requires review',()=>{
 assert.equal(evaluate(snapshot({at:NOW+9999}),NOW+9999).status,'retain');
 const due=evaluate(snapshot({at:NOW+10000}),NOW+10000);assert.equal(due.status,'review-disposal');assert.equal(due.effectsVerified,false);
 assert.equal(evaluate(snapshot({at:NOW+79999}),NOW+79999).status,'review-disposal');
 review(snapshot({at:NOW+80000}),NOW+80000,expected(),'retention-deadline-overdue');
 review(snapshot({at:NOW+100000}),NOW+100000,expected(),'rule-expired');
 assert.equal(Object.hasOwn(due,'purgeAuthorized'),false);assert.equal(Object.hasOwn(due,'deliveryAllowed'),false);assert.equal(Object.hasOwn(due,'erased'),false);
});

test('future, expired or overdue rules never become disposal permission',()=>{
 const future=rule(ruleCommand({effectiveAt:iso(NOW+5000)}));review(snapshot({rules:[future]}),NOW,expected(),'rule-not-effective');
 const overdue=rule(ruleCommand({reviewBy:iso(NOW+12000)}));review(snapshot({rules:[overdue],at:NOW+12000}),NOW+12000,expected(),'rule-review-overdue');
 const stale=snapshot({at:NOW});review(stale,NOW+60000,expected(),'stale-snapshot');
 review(snapshot({at:NOW+1}),NOW,expected(),'stale-snapshot');
});

test('authoritative target, record revision, classification and inventory scope must all match exactly',()=>{
 for(const field of ['workspaceId','recordId','recordRevision','classification']){
  const next=field==='classification'?'operational_security':field==='recordRevision'?'2':id(90);
  const wanted=expected();wanted.scope[field]=next;review(snapshot(),NOW,wanted,'scope-mismatch');
  const current=snapshot();current.scope[field]=next;review(current,NOW,expected(),'scope-mismatch');
  const inventory=snapshot();inventory.inventory.scope[field]=next;review(inventory,NOW,expected(),'scope-mismatch');
 }
 const other=hold(holdCommand({scope:{...SCOPE,recordId:id(90)}}));review(snapshot({holds:[other]}),NOW,expected(),'scope-mismatch');
});

test('stale overall, policy, hold, inventory and authority versions require fresh review',()=>{
 const changes=[s=>s.revision='2',s=>s.ruleHeads[0].revision='2',s=>s.ruleHeads[0].fingerprint='b'.repeat(64),
  s=>s.inventory.revision='2',s=>s.authorities[0].authority.authorityRevision='2',s=>s.authorities[0].authority.subjectId='another-reviewer',
  s=>s.authorities[0].authority.commandFingerprint='b'.repeat(64),s=>s.authorities[0].state='revoked'];
 for(const change of changes){const s=snapshot();change(s);review(s);}
 const s=snapshot({holds:[hold()]});s.holdHeads[0].revision='2';review(s,NOW,expected(),'stale-hold-version');
});

test('missing, incomplete, unknown and duplicate control or material facts require review',()=>{
 for(const value of [null,{},[],{...snapshot(),extra:true}])review(value);
 const changes=[s=>s.rules=[],s=>s.ruleHeads=[],s=>s.authorities=[],s=>s.controlsState='incomplete',s=>s.controlsState='unresolved',s=>s.controlsState='unknown',
  s=>s.inventory.state='incomplete',s=>s.inventory.materials=[],s=>s.inventory.materials.push(clone(s.inventory.materials[0])),
  s=>s.ruleHeads.push(clone(s.ruleHeads[0])),s=>s.rules.push(clone(s.rules[0])),s=>s.authorities[0].state='unresolved',s=>delete s.inventory.evidenceId,
  s=>s.authorities.push({authority:{...s.authorities[0].authority,authorizationId:id(99)},state:'unresolved'})];
 for(const change of changes){const s=snapshot();change(s);review(s);}
 const h=hold(),removed=snapshot({holds:[h]});removed.holds=[];review(removed,NOW,expected(),'unresolved-hold-heads');
 const staleAuthority=snapshot({at:NOW+200000});review(staleAuthority,NOW+200000,expected(),'authority-not-current');
});

test('consistent periods intersect conservatively while contradictory periods require review',()=>{
 const a=rule(),command=ruleCommand({operationId:id(110),ruleId:id(111),retainUntil:iso(NOW+20000),disposeBy:iso(NOW+70000)});
 const b=proposeRetentionRule(ruleProof(command,{authorizationId:id(130)}),command,NOW).record;
 assert.equal(evaluate(snapshot({rules:[a,b],at:NOW+15000}),NOW+15000).status,'retain');
 assert.equal(evaluate(snapshot({rules:[b,a],at:NOW+25000}),NOW+25000).status,'review-disposal');
 const conflictCommand={...command,retainUntil:iso(NOW+90000),disposeBy:iso(NOW+95000)};
 const conflict=proposeRetentionRule(ruleProof(conflictCommand,{authorizationId:id(130)}),conflictCommand,NOW).record;
 review(snapshot({rules:[a,conflict],at:NOW+15000}),NOW+15000,expected(),'conflicting-retention-periods');
});

test('active holds block physical-disposal proposals without granting any other permission',()=>{
 const result=evaluate(snapshot({holds:[hold()],at:NOW+20000}),NOW+20000);
 assert.equal(result.status,'retain');assert.deepEqual(result.reasonCodes,['active-hold']);assert.equal(result.effectsVerified,false);
 for(const field of ['read','decrypt','export','publish','deliveryAllowed','tombstoneRemoved','purgeAuthorized'])assert.equal(Object.hasOwn(result,field),false);
 for(const patch of [{reason:'allow-read'},{readAllowed:true},{exportAllowed:true},{tombstoneRemoved:true}])reject(()=>hold(holdCommand(patch)));
});

test('hold review and expiry edges require explicit review, never automatic release',()=>{
 const h=hold();
 assert.equal(evaluate(snapshot({holds:[h],at:NOW+49999}),NOW+49999).status,'retain');
 review(snapshot({holds:[h],at:NOW+50000}),NOW+50000,expected(),'hold-review-overdue');
 review(snapshot({holds:[h],at:NOW+70000}),NOW+70000,expected(),'hold-expired-unreleased');
 assert.equal(validateHoldRecord(h).release,null);assert.equal(h.revision,'1');
 const future=hold(holdCommand({effectiveAt:iso(NOW+1000)}));review(snapshot({holds:[future]}),NOW,expected(),'hold-not-effective');
});

test('an active hold cannot silently turn a conflicting overdue disposition deadline into indefinite retention',()=>{
 const r=rule(ruleCommand({disposeBy:iso(NOW+15000)}));
 review(snapshot({rules:[r],holds:[hold()],at:NOW+20000}),NOW+20000,expected(),'retention-deadline-overdue');
});

test('an expired hold can be explicitly released under new current authority and retains its original immutable history',()=>{
 const h=hold(),command=releaseCommand(h),result=proposeHoldRelease(releaseProof(h,command),h,command,NOW+70001);
 assert.equal(result.record.revision,'2');assert.deepEqual(result.record.placement,h.placement);assert.equal(h.release,null);
 assert.equal(result.effectsVerified,false);assert.equal(result.record.release.command.holdFingerprint,h.fingerprint);
 assert.equal(evaluate(snapshot({holds:[result.record],at:NOW+70001}),NOW+70001).status,'review-disposal');
});

test('release proof binds exact original hold, scope, expected revision and all supplied release evidence',()=>{
 const h=hold(),command=releaseCommand(h),a=releaseProof(h,command);
 for(const patch of [{operationId:id(90)},{holdId:id(90)},{expectedRevision:'2'},{holdFingerprint:'b'.repeat(64)},{evidenceId:id(90)},{reviewBy:iso(NOW+85000)}])reject(()=>proposeHoldRelease(a,h,{...command,...patch},NOW+1));
 for(const patch of [{workspaceId:id(90)},{action:'lifecycle.hold-place'},{expiresAt:iso(NOW+1)},{authorityRevision:1},{commandFingerprint:'b'.repeat(64)}])reject(()=>proposeHoldRelease({...a,...patch},h,command,NOW+1));
 reject(()=>proposeHoldRelease(a,h,{...command,operationId:h.placement.command.operationId},NOW+1));
 const changedScope=hold(holdCommand({scope:{...SCOPE,recordRevision:'2'}}));reject(()=>proposeHoldRelease(a,changedScope,command,NOW+1));
});

test('exact release replay preserves the original event while changed authority or operation intent rejects',()=>{
 const h=hold(),command=releaseCommand(h),a=releaseProof(h,command),first=proposeHoldRelease(a,h,command,NOW+1);
 const retry=proposeHoldRelease(reverse(a),reverse(clone(first.record)),reverse(command),NOW+2);
 assert.equal(retry.replayed,true);assert.deepEqual(retry.operation,first.operation);assert.deepEqual(retry.record,first.record);
 for(const patch of [{subjectId:'other-reviewer'},{authorizationId:id(90)},{authorityEvidenceId:id(90)},{authorityRevision:'2'},{expiresAt:iso(NOW+210000)}])reject(()=>proposeHoldRelease({...a,...patch},first.record,command,NOW+2));
 const changed={...command,evidenceId:id(90)};reject(()=>proposeHoldRelease(releaseProof(first.record,changed),first.record,changed,NOW+2));
 reject(()=>proposeHoldRelease(a,first.record,command,NOW));
});

test('released holds remain in the current inventory and stale release heads or authority cannot waive them',()=>{
 const h=released(),s=snapshot({holds:[h],at:NOW+20000});assert.equal(evaluate(s,NOW+20000).status,'review-disposal');
 const oldHead=clone(s);oldHead.holdHeads[0].revision='1';review(oldHead,NOW+20000,expected(),'stale-hold-version');
 const removed=clone(s);removed.holds=[];review(removed,NOW+20000,expected(),'unresolved-hold-heads');
 const revoked=clone(s);revoked.authorities.find(x=>x.authority.action==='lifecycle.hold-release').state='revoked';review(revoked,NOW+20000,expected(),'authority-not-current');
 const expired=clone(s);expired.authorities.find(x=>x.authority.action==='lifecycle.hold-release').authority.expiresAt=iso(NOW+20000);review(expired,NOW+20000,expected(),'authority-not-current');
});

test('future placement or release events cannot be smuggled into an earlier authoritative snapshot',()=>{
 const futureRule=rule(ruleCommand(),NOW+1000);review(snapshot({rules:[futureRule]}),NOW,expected(),'future-control-event');
 const futureHold=hold(holdCommand(),NOW+1000);review(snapshot({holds:[futureHold]}),NOW,expected(),'future-control-event');
 const futureRelease=released(hold(),NOW+1000);review(snapshot({holds:[futureRelease]}),NOW,expected(),'future-control-event');
});

test('reordered current facts produce the same immutable dry-run fingerprint without retaining inputs',()=>{
 const s=snapshot({holds:[released()],at:NOW+20000}),first=evaluate(s,NOW+20000);
 const reordered=reverse({...s,scope:reverse(s.scope),rules:s.rules.map(reverse),authorities:s.authorities.slice().reverse(),inventory:reverse({...s.inventory,scope:reverse(s.inventory.scope)})});
 assert.deepEqual(evaluate(reordered,NOW+20000),first);
 s.scope.recordId=id(99);s.inventory.materials[0].envelopeDigest='b'.repeat(64);
 assert.equal(first.scope.recordId,SCOPE.recordId);assert.equal(Object.isFrozen(first),true);assert.equal(Object.isFrozen(first.scope),true);assert.equal(Object.isFrozen(first.reasonCodes),true);
});

test('malformed input produces a fixed review result without private authority or source text',()=>{
 const s=snapshot();s.privateSource='PRIVATE-RETENTION-CANARY';const result=review(s);
 assert.equal(JSON.stringify(result).includes('PRIVATE-RETENTION-CANARY'),false);assert.equal(Object.hasOwn(result,'authority'),false);
 for(const now of [undefined,null,-1,NaN,Infinity,NOW+0.5,253402300800000])assert.equal(evaluateRetention(expected(),snapshot(),now).status,'review-required');
 review(snapshot(),NOW,{...expected(),verified:true});
});

test('future governmental classification stays review-required even with otherwise coherent synthetic controls',()=>{
 const target={...SCOPE,classification:'future_governmental'},command=ruleCommand({scope:target,retentionClass:'requires_future_statute_and_operator'}),s=snapshot({rules:[rule(command)],at:NOW+20000});
 s.scope=target;s.inventory.scope=target;
 review(s,NOW+20000,{...expected(),scope:target},'conditional-classification');
});
