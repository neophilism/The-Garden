import {createHash,timingSafeEqual} from 'node:crypto';

/** Integrity of a supplied chain is not proof that its operator is truthful.
 * An external checkpoint must arrive through a separately trusted channel.
 * No signing key, recovered account secret or arbitrary research text is used.
 */
export const GENESIS = '0'.repeat(64);
export const AUDIT_SCHEMA = 1;
export const MAX_PAGE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const INTEGER = /^(0|[1-9][0-9]{0,18})$/;
const MAX_SEQUENCE = 9223372036854775807n;
const ACTIONS = Object.freeze({
 'encryption.persist':['record','succeeded','encrypted-content-persisted'],
 'encryption.rewrap':['record','succeeded','encrypted-content-rewrapped'],
 'encryption.key-policy':['workspace','succeeded','encryption-key-policy-changed'],
 'encryption.key-version':['workspace','succeeded','encryption-key-version-changed'],
 'record.create':['record','succeeded','record-created'],
 'record.revise':['record','succeeded','record-revised'],
 'consent.policy':['record','succeeded','policy-revised'],
 'consent.grant':['grant','succeeded','permission-recorded'],
 'consent.withdraw':['grant','succeeded','permission-withdrawn'],
 'consent.use':['record','allowed','permission-checked'],
 'review.scope':['review','succeeded','review-scope-created'],
 'review.decision':['review','succeeded','scoped-decision-recorded'],
 'review.reopen':['review','succeeded','scoped-review-reopened'],
 'review.import':['review','succeeded','imported-status-preserved'],
 'review.assign':['review','succeeded','reviewer-assigned'],
 'membership.change':['identity','succeeded','membership-changed'],
 'role.change':['role','succeeded','role-changed'],
 'workspace.change':['workspace','succeeded','workspace-changed'],
 'record.access':['record','succeeded','record-access-changed'],
 'identity.access':['identity','succeeded','identity-access-changed'],
 'audit.export':['request','allowed','audit-authorized'],
 'access.allow':['request','allowed','authorization-allowed'],
 'access.deny':['request','denied','authorization-denied']
});
export class AuditError extends Error {constructor(){super('Audit evidence unavailable or invalid');this.code='audit_unavailable';}}
const fail=()=>{throw new AuditError();};
export function auditUUID(value){if(typeof value!=='string'||!UUID.test(value))fail();return value;}
export function auditSequence(value,{zero=true}={}){if(typeof value!=='string'||!INTEGER.test(value)||BigInt(value)>MAX_SEQUENCE||(!zero&&value==='0'))fail();return value;}
function hash(value){if(typeof value!=='string'||!HASH.test(value))fail();return value;}
function exact(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))fail();}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)||!Number.isFinite(Date.parse(value)))fail();
 if(new Date(value).toISOString()!==value.slice(0,23)+'Z')fail();
}
export function validateAuditEvent(value){
 exact(value,['schemaVersion','eventId','workspaceId','sequence','requestId','occurredAt','actor','subject','action','outcome','reasonCode']);
 if(value.schemaVersion!==AUDIT_SCHEMA)fail();
 for(const key of ['eventId','workspaceId','requestId'])auditUUID(value[key]);
 auditSequence(value.sequence,{zero:false});timestamp(value.occurredAt);
 exact(value.actor,['kind','reference']);if(!['subject','database-role'].includes(value.actor.kind))fail();auditUUID(value.actor.reference);
 exact(value.subject,['kind','reference','version']);auditUUID(value.subject.reference);if(value.subject.version!==null)auditSequence(value.subject.version,{zero:false});
 const rule=Object.hasOwn(ACTIONS,value.action)?ACTIONS[value.action]:null;
 if(!rule||value.subject.kind!==rule[0]||value.outcome!==rule[1]||value.reasonCode!==rule[2])fail();
 if(['audit.export','access.allow','access.deny'].includes(value.action)&&value.subject.reference!==value.requestId)fail();
 return Object.freeze({...value,actor:Object.freeze({...value.actor}),subject:Object.freeze({...value.subject})});
}
export function auditHash(workspace,sequence,previousHash,eventText){
 auditUUID(workspace);auditSequence(sequence,{zero:false});hash(previousHash);
 if(typeof eventText!=='string'||Buffer.byteLength(eventText,'utf8')>4096)fail();
 return createHash('sha256').update('garden-audit-v1\n'+workspace+'\n'+sequence+'\n'+previousHash+'\n'+eventText,'utf8').digest('hex');
}
export function validateCheckpoint(value){
 exact(value,['workspaceId','sequence','hash']);auditUUID(value.workspaceId);auditSequence(value.sequence);hash(value.hash);
 if(value.sequence==='0'&&value.hash!==GENESIS)fail();return Object.freeze({...value});
}
/** Verify a bounded contiguous page from a caller-trusted previous checkpoint.
 * Never obtain that starting checkpoint from the same untrusted export header.
 * DB jsonb text is preserved exactly; consumers must not reserialize before hashing.
 */
export function verifyAuditPage(rows,start){
 const initial=validateCheckpoint(start);if(!Array.isArray(rows)||rows.length>MAX_PAGE)fail();
 let previous={...initial};const events=[];const seen=new Set();
 for(const row of rows){
  exact(row,['workspaceId','sequence','previousHash','hash','eventText']);auditUUID(row.workspaceId);auditSequence(row.sequence,{zero:false});hash(row.previousHash);hash(row.hash);
  if(row.workspaceId!==initial.workspaceId||BigInt(row.sequence)!==BigInt(previous.sequence)+1n||row.previousHash!==previous.hash)fail();
  if(typeof row.eventText!=='string'||Buffer.byteLength(row.eventText,'utf8')>4096)fail();
  let parsed;try{parsed=JSON.parse(row.eventText);}catch{fail();}const event=validateAuditEvent(parsed);
  // Detect overwritten duplicate keys or alternative scalar encodings; audit
  // producers emit fixed ASCII identifiers/codes, never free-form escaped text.
  let compact='',quoted=false,escaped=false;
  for(const ch of row.eventText){if(quoted){compact+=ch;if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;}else if(ch==='"'){quoted=true;compact+=ch;}else if(!' \r\n\t'.includes(ch))compact+=ch;}
  if(JSON.stringify(parsed)!==compact)fail();
  if(event.workspaceId!==row.workspaceId||event.sequence!==row.sequence||seen.has(event.eventId))fail();
  if(!timingSafeEqual(Buffer.from(auditHash(row.workspaceId,row.sequence,row.previousHash,row.eventText),'hex'),Buffer.from(row.hash,'hex')))fail();
  seen.add(event.eventId);events.push(event);previous={workspaceId:row.workspaceId,sequence:row.sequence,hash:row.hash};
 }
 return Object.freeze({checkpoint:validateCheckpoint(previous),events:Object.freeze(events),internallyConsistent:true,externallyAnchored:false,completeHistory:false});
}
export function verifyExternalCheckpoint(observed,trusted){
 const a=validateCheckpoint(observed),b=validateCheckpoint(trusted);
 if(a.workspaceId!==b.workspaceId||a.sequence!==b.sequence||!timingSafeEqual(Buffer.from(a.hash,'hex'),Buffer.from(b.hash,'hex')))fail();
 return Object.freeze({matchesTrustedCheckpoint:true,authenticityOfCheckpoint:'caller-responsibility',operatorTruthfulnessVerified:false});
}
export function auditPageOptions(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['after','limit','through'].includes(k)))fail();
 const after=auditSequence(value.after??'0'),limit=value.limit??100;
 if(!Number.isSafeInteger(limit)||limit<1||limit>MAX_PAGE)fail();return Object.freeze({after,limit,...(value.through===undefined?{}:{through:validateCheckpoint(value.through)})});
}
export function auditActions(){return Object.keys(ACTIONS);}
