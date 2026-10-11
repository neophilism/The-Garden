import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AuditError,GENESIS,auditHash,validateAuditEvent,verifyAuditPage,verifyExternalCheckpoint,auditPageOptions,auditSequence} from '../../packages/domain/src/audit/ledger.mjs';
const W='10000000-0000-4000-8000-000000000001';
const point=(sequence='0',hash=GENESIS)=>({workspaceId:W,sequence,hash});
const event=(sequence='1')=>({schemaVersion:1,eventId:randomUUID(),workspaceId:W,sequence,requestId:randomUUID(),occurredAt:'2026-10-11T12:30:01.123456Z',actor:{kind:'subject',reference:randomUUID()},subject:{kind:'record',reference:randomUUID(),version:'2'},action:'record.revise',outcome:'succeeded',reasonCode:'record-revised'});
function row(e=event(),previousHash=GENESIS){const eventText=JSON.stringify(e);return{workspaceId:e.workspaceId,sequence:e.sequence,previousHash,hash:auditHash(e.workspaceId,e.sequence,previousHash,eventText),eventText};}
test('a bounded hash chain retains exact text and does not claim external authenticity',()=>{const a=row(),b=row(event('2'),a.hash),r=verifyAuditPage([a,b],point());assert.equal(r.checkpoint.hash,b.hash);assert.equal(r.internallyConsistent,true);assert.equal(r.externallyAnchored,false);assert.equal(r.completeHistory,false);assert.equal(r.events.length,2);});
test('trusted continuation preserves chain across pages',()=>{const a=row(),b=row(event('2'),a.hash);assert.equal(verifyAuditPage([b],verifyAuditPage([a],point()).checkpoint).checkpoint.hash,b.hash);assert.throws(()=>verifyAuditPage([b],point()),AuditError);});
for(const [name,change] of [
 ['email',e=>({...e,email:'secret@example.invalid'})],['payload',e=>({...e,payload:{secret:'record-text'}})],
 ['actor text',e=>({...e,actor:{...e.actor,name:'private'}})],['session bearer',e=>({...e,actor:{...e.actor,token:'secret'}})],
 ['invalid actor',e=>({...e,actor:{...e.actor,reference:'secret@example.invalid'}})],['string schema',e=>({...e,schemaVersion:'1'})],
 ['unknown action',e=>({...e,action:'publication.fake'})],['false success',e=>({...e,outcome:'allowed'})],['freeform reason',e=>({...e,reasonCode:'PRIVATE TEXT'})],
 ['wrong subject',e=>({...e,subject:{...e.subject,kind:'identity'}})],['numeric sequence',e=>({...e,sequence:1})],['zero sequence',e=>({...e,sequence:'0'})],
 ['float version',e=>({...e,subject:{...e.subject,version:'1.5'}})],['bad date',e=>({...e,occurredAt:'2026-02-31T12:30:01.123456Z'})],
 ['date without UTC',e=>({...e,occurredAt:'2026-10-11T12:30:01.123456'})],['timestamp number',e=>({...e,occurredAt:12})],
 ['uppercase UUID',e=>({...e,eventId:'ABCDEFAB-0000-4000-8000-000000000001'})],['extra null',e=>({...e,unused:null})]
])test(name+' is rejected from immutable event data',()=>assert.throws(()=>validateAuditEvent(change(event())),AuditError));
test('decision event binds subject to request, not a potentially secret object name',()=>{const e=event();e.action='access.deny';e.reasonCode='authorization-denied';e.outcome='denied';e.subject={kind:'request',reference:e.requestId,version:null};assert.ok(validateAuditEvent(e));e.subject.reference=randomUUID();assert.throws(()=>validateAuditEvent(e),AuditError);});
for(const [name,change] of [
 ['hash edit',r=>({...r,hash:'1'.repeat(64)})],['previous hash edit',r=>({...r,previousHash:'1'.repeat(64)})],
 ['content edit',r=>({...r,eventText:r.eventText.replace('record-revised','record-created')})],['sequence gap',r=>({...r,sequence:'2'})],
 ['cross workspace',r=>({...r,workspaceId:randomUUID()})],['outer payload',r=>({...r,payload:'SECRET'})],['invalid JSON',r=>({...r,eventText:'{oops'})]
])test(name+' fails page verification',()=>assert.throws(()=>verifyAuditPage([change(row())],point()),AuditError));
test('reordered or duplicate entries fail',()=>{const a=row(),b=row(event('2'),a.hash);assert.throws(()=>verifyAuditPage([b,a],point()),AuditError);assert.throws(()=>verifyAuditPage([a,a],point()),AuditError);});
test('even a recomputed chain cannot meet a separately trusted original checkpoint',()=>{const original=row();const changed=row({...JSON.parse(original.eventText),subject:{kind:'record',reference:randomUUID(),version:'2'}});const observed=verifyAuditPage([changed],point()).checkpoint;assert.throws(()=>verifyExternalCheckpoint(observed,point('1',original.hash)),AuditError);});
test('truncation fails against a trusted later head, including an empty export',()=>{const a=row(),b=row(event('2'),a.hash);assert.throws(()=>verifyExternalCheckpoint(verifyAuditPage([a],point()).checkpoint,point('2',b.hash)),AuditError);assert.throws(()=>verifyExternalCheckpoint(point(),point('1',a.hash)),AuditError);});
test('matched checkpoint does not become a claim that the operator told the truth',()=>{const a=row(),result=verifyExternalCheckpoint(point('1',a.hash),point('1',a.hash));assert.equal(result.matchesTrustedCheckpoint,true);assert.equal(result.operatorTruthfulnessVerified,false);});
test('spacing in the recorded PostgreSQL text is covered by the hash',()=>{const a=row();const spaced={...a,eventText:a.eventText.replaceAll(':',': ')};assert.throws(()=>verifyAuditPage([spaced],point()),AuditError);});
test('a malformed event cannot become valid by recomputing its hash',()=>{const a=row({...event(),privateNote:'SECRET'});assert.throws(()=>verifyAuditPage([a],point()),AuditError);});
for(const n of [-1,1,'-1','01','1e2','1.2','9223372036854775808','9'.repeat(100),null])test('invalid sequence '+String(n)+' fails',()=>assert.throws(()=>auditSequence(n),AuditError));
test('bigint sequence strings remain exact beyond JavaScript safe integers',()=>assert.equal(auditSequence('9007199254740993'),'9007199254740993'));
for(const options of [{limit:0},{limit:1001},{limit:'10'},{after:1},{after:'-1'},{token:'SECRET'},[],null])test('invalid page bound '+JSON.stringify(options),()=>assert.throws(()=>auditPageOptions(options),AuditError));
test('default page is bounded and validates export size',()=>{assert.deepEqual(auditPageOptions(),{after:'0',limit:100});assert.throws(()=>verifyAuditPage(Array(1001).fill(row()),point()),AuditError);});
test('a bad genesis hash cannot be treated as a trusted starting root',()=>assert.throws(()=>verifyAuditPage([],point('0','1'.repeat(64))),AuditError));
test('overwritten duplicate fields cannot hide private text in an otherwise valid hash',()=>{const a=row();a.eventText=a.eventText.replace('"reasonCode":','"reasonCode":"PRIVATE-RECORD","reasonCode":');a.hash=auditHash(W,'1',GENESIS,a.eventText);assert.throws(()=>verifyAuditPage([a],point()),AuditError);});
test('oversized entry text is bounded before JSON parsing',()=>{const a=row();a.eventText=' '.repeat(4097)+a.eventText;assert.throws(()=>verifyAuditPage([a],point()),AuditError);});
test('a selected through checkpoint is a bound, not a fabricated authority field',()=>{assert.deepEqual(auditPageOptions({through:point()}).through,point());assert.throws(()=>auditPageOptions({through:{...point(),trusted:true}}),AuditError);});
