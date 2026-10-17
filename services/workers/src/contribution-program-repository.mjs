/** Private synthetic/pilot ledger. There is no public data path, identity
 * provisioner, mailer, enrollment writer, or interview collector here. */
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {lstatSync,realpathSync,mkdirSync,chmodSync} from 'node:fs';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {exact,uuid,text,reject,validateProgramVersion,validateProgramAuthority,programTermsDigest,acknowledgmentInput,submissionInput,interestInput,validateSubmissionSource,PARTICIPATION_LIMITS} from '../../../packages/domain/src/community/program.mjs';

const SOURCE_ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const require=condition=>{if(!condition)reject();};
const schema=`
CREATE TABLE contribution_program_versions (
 workspace_id TEXT NOT NULL,program_id TEXT NOT NULL,version INTEGER NOT NULL,
 terms_digest TEXT NOT NULL,terms_json TEXT NOT NULL,authority_json TEXT NOT NULL,
 PRIMARY KEY(workspace_id,program_id,version));
CREATE TABLE program_acknowledgments (
 acknowledgment_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,program_id TEXT NOT NULL,
 version INTEGER NOT NULL,subject_id TEXT NOT NULL,terms_digest TEXT NOT NULL,
 FOREIGN KEY(workspace_id,program_id,version) REFERENCES contribution_program_versions(workspace_id,program_id,version));
CREATE INDEX acknowledgments_owner ON program_acknowledgments(workspace_id,program_id,subject_id,version);
CREATE TABLE contribution_submissions (
 submission_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,program_id TEXT NOT NULL,
 version INTEGER NOT NULL,subject_id TEXT NOT NULL,acknowledgment_id TEXT NOT NULL REFERENCES program_acknowledgments(acknowledgment_id),upload_id TEXT NOT NULL,
 UNIQUE(workspace_id,program_id,subject_id,upload_id));
CREATE INDEX submissions_owner ON contribution_submissions(workspace_id,program_id,subject_id);
CREATE TABLE program_interests (
 interest_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,program_id TEXT NOT NULL,
 version INTEGER NOT NULL,subject_id TEXT NOT NULL,acknowledgment_id TEXT NOT NULL REFERENCES program_acknowledgments(acknowledgment_id));
CREATE INDEX interests_owner ON program_interests(workspace_id,program_id,subject_id);
CREATE TABLE program_interest_withdrawals (
 withdrawal_id TEXT PRIMARY KEY,interest_id TEXT NOT NULL UNIQUE REFERENCES program_interests(interest_id),
 workspace_id TEXT NOT NULL,subject_id TEXT NOT NULL);
CREATE TABLE program_events (
 event_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,program_id TEXT NOT NULL,
 subject_id TEXT NOT NULL,kind TEXT NOT NULL,decision_id TEXT NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX events_owner ON program_events(workspace_id,program_id,subject_id);
${['contribution_program_versions','program_acknowledgments','contribution_submissions','program_interests','program_interest_withdrawals','program_events'].map(table=>`
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable program record'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable program record'); END;`).join('')}
`;
function privateRoot(root){
 require(typeof root==='string'&&isAbsolute(root));const path=resolve(root),rel=relative(SOURCE_ROOT,path);
 require(rel==='..'||rel.startsWith('../')||rel.startsWith('..\\'));
 if(!stat(path))mkdirSync(path,{mode:0o700,recursive:false});
 const st=lstatSync(path);require(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&(st.mode&0o077)===0&&realpathSync(path)===path);return path;
}
function stat(path){try{return lstatSync(path);}catch(error){if(error?.code==='ENOENT')return null;reject();}}
function privateFile(st){require(st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&st.nlink===1&&(st.mode&0o077)===0);}
function principal(f){exact(f,['subjectId','workspaceId','requestId']);uuid(f.workspaceId);uuid(f.requestId);text(f.subjectId);return [f.workspaceId,f.subjectId];}
function publicTerms(row){const v=validateProgramVersion(JSON.parse(row.terms_json));require(v.version===row.version&&v.programId===row.program_id&&programTermsDigest(v)===row.terms_digest);return {...v,termsDigest:row.terms_digest};}

export function createPrivateContributionProgramRepository({root,now=Date.now}){
 require(typeof now==='function');const path=join(privateRoot(root),'contribution-program.sqlite3');
 const original=stat(path),fresh=original===null;
 if(original)privateFile(original);
 // SQLite may open sidecars during recovery before our PRAGMA statements.
 // Reject WAL/SHM for this DELETE-journal ledger and unsafe rollback journals,
 // including dangling symlinks that existsSync would miss.
 require(stat(path+'-wal')===null&&stat(path+'-shm')===null);
 const journal=stat(path+'-journal');if(journal){require(!fresh);privateFile(journal);}
 const db=new DatabaseSync(path,{enableForeignKeyConstraints:true});chmodSync(path,0o600);
 try{
  db.exec('PRAGMA journal_mode=DELETE;PRAGMA synchronous=FULL;PRAGMA foreign_keys=ON;PRAGMA trusted_schema=OFF;PRAGMA busy_timeout=1000');
  const version=db.prepare('PRAGMA user_version').get().user_version;require(fresh?version===0:version===1);
  if(fresh){db.exec('BEGIN IMMEDIATE');db.exec(schema);db.exec('PRAGMA user_version=1;COMMIT');}
  const expected=new DatabaseSync(':memory:');
  try{expected.exec(schema);const inspect=c=>c.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();require(JSON.stringify(inspect(db))===JSON.stringify(inspect(expected)));}
  finally{expected.close();}
  require(db.prepare('PRAGMA foreign_keys').get().foreign_keys===1);
 }catch{db.close();reject();}
 function transact(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch{try{db.exec('ROLLBACK');}catch{}reject();}}
 function current(f,programId){principal(f);uuid(programId);const row=db.prepare('SELECT * FROM contribution_program_versions WHERE workspace_id=? AND program_id=? ORDER BY version DESC LIMIT 1').get(f.workspaceId,programId);require(row);publicTerms(row);return row;}
 function exactVersion(f,input,purpose){
  const row=current(f,input.programId);require(row.version===input.version&&row.terms_digest===input.termsDigest);
  const v=JSON.parse(row.terms_json);validateProgramAuthority(JSON.parse(row.authority_json),v,f.workspaceId,now());
  if(purpose)require(v.permittedPurposes.includes(purpose));return row;
 }
 function acknowledgment(f,input,purpose){
  exactVersion(f,input,purpose);const a=db.prepare('SELECT * FROM program_acknowledgments WHERE acknowledgment_id=? AND workspace_id=? AND program_id=? AND subject_id=? AND version=? AND terms_digest=?').get(input.acknowledgmentId,f.workspaceId,input.programId,f.subjectId,input.version,input.termsDigest);require(a);
 }
 function event(f,programId,id,kind){db.prepare('INSERT INTO program_events(event_id,workspace_id,program_id,subject_id,kind,decision_id) VALUES(?,?,?,?,?,?)').run(id,f.workspaceId,programId,f.subjectId,kind,f.requestId);}
 function submissionReceipt(row){return {submissionId:row.submission_id,programId:row.program_id,version:row.version,uploadId:row.upload_id,state:'pending-review',interestRegistered:false,consentReviewed:false,rightsReviewed:false,...PARTICIPATION_LIMITS};}
 function interestReceipt(row){const w=db.prepare('SELECT withdrawal_id FROM program_interest_withdrawals WHERE interest_id=?').get(row.interest_id);return {interestId:row.interest_id,programId:row.program_id,version:row.version,state:w?'withdrawn':'registered',purpose:'program-interest',submissionCreated:false,notificationSent:false,...PARTICIPATION_LIMITS};}
 return Object.freeze({
  /** Server-only authority material; never return this object to a client. */
  program(f,programId){const row=current(f,programId);return {version:JSON.parse(row.terms_json),authority:JSON.parse(row.authority_json)};},
  installVersion(f,input,authority){
   principal(f);const v=validateProgramVersion(input),a=validateProgramAuthority(authority,v,f.workspaceId,now()),digest=programTermsDigest(v);
   return transact(()=>{
    const prior=db.prepare('SELECT * FROM contribution_program_versions WHERE workspace_id=? AND program_id=? ORDER BY version DESC LIMIT 1').get(f.workspaceId,v.programId);
    if(prior?.version===v.version){require(prior.terms_digest===digest&&prior.authority_json===JSON.stringify(a));return publicTerms(prior);}
    require(v.version===(prior?.version??0)+1);
    db.prepare('INSERT INTO contribution_program_versions(workspace_id,program_id,version,terms_digest,terms_json,authority_json) VALUES(?,?,?,?,?,?)').run(f.workspaceId,v.programId,v.version,digest,JSON.stringify(v),JSON.stringify(a));
    event(f,v.programId,randomUUID(),'program-version-installed');return {...v,termsDigest:digest};
   });
  },
  status(f,programId){
   const row=current(f,programId),args=[f.workspaceId,programId,f.subjectId];
   const ack=db.prepare('SELECT acknowledgment_id FROM program_acknowledgments WHERE workspace_id=? AND program_id=? AND subject_id=? AND version=? ORDER BY rowid DESC LIMIT 1').get(...args,row.version);
   const submissions=db.prepare('SELECT * FROM contribution_submissions WHERE workspace_id=? AND program_id=? AND subject_id=? ORDER BY rowid DESC LIMIT 21').all(...args);
   const interests=db.prepare('SELECT * FROM program_interests WHERE workspace_id=? AND program_id=? AND subject_id=? ORDER BY rowid DESC LIMIT 21').all(...args);
   return {program:publicTerms(row),acknowledgmentId:ack?.acknowledgment_id??null,submissions:submissions.slice(0,20).map(submissionReceipt),interests:interests.slice(0,20).map(interestReceipt),hasOlderSubmissions:submissions.length>20,hasOlderInterests:interests.length>20,...PARTICIPATION_LIMITS};
  },
  acknowledge(f,input){
   principal(f);const a=acknowledgmentInput(input);
   return transact(()=>{
    exactVersion(f,a);const old=db.prepare('SELECT * FROM program_acknowledgments WHERE acknowledgment_id=?').get(a.acknowledgmentId);
    if(old)require(old.workspace_id===f.workspaceId&&old.subject_id===f.subjectId&&old.program_id===a.programId&&old.version===a.version&&old.terms_digest===a.termsDigest);
    else{db.prepare('INSERT INTO program_acknowledgments(acknowledgment_id,workspace_id,program_id,version,subject_id,terms_digest) VALUES(?,?,?,?,?,?)').run(a.acknowledgmentId,f.workspaceId,a.programId,a.version,f.subjectId,a.termsDigest);event(f,a.programId,a.acknowledgmentId,'program-acknowledged');}
    return {acknowledgmentId:a.acknowledgmentId,version:a.version,termsDigest:a.termsDigest,consentGranted:false,...PARTICIPATION_LIMITS};
   });
  },
  submit(f,input,source){
   principal(f);const s=submissionInput(input);validateSubmissionSource(source,{...f,uploadId:s.uploadId});
   return transact(()=>{
    acknowledgment(f,s,'research-submission');const old=db.prepare('SELECT * FROM contribution_submissions WHERE submission_id=?').get(s.submissionId);
    if(old){require(old.workspace_id===f.workspaceId&&old.subject_id===f.subjectId&&old.program_id===s.programId&&old.version===s.version&&old.acknowledgment_id===s.acknowledgmentId&&old.upload_id===s.uploadId);return submissionReceipt(old);}
    db.prepare('INSERT INTO contribution_submissions(submission_id,workspace_id,program_id,version,subject_id,acknowledgment_id,upload_id) VALUES(?,?,?,?,?,?,?)').run(s.submissionId,f.workspaceId,s.programId,s.version,f.subjectId,s.acknowledgmentId,s.uploadId);
    event(f,s.programId,s.submissionId,'source-submitted');return submissionReceipt(db.prepare('SELECT * FROM contribution_submissions WHERE submission_id=?').get(s.submissionId));
   });
  },
  registerInterest(f,input){
   principal(f);const i=interestInput(input);
   return transact(()=>{
    acknowledgment(f,i,'program-interest');const old=db.prepare('SELECT * FROM program_interests WHERE interest_id=?').get(i.interestId);
    if(old){require(old.workspace_id===f.workspaceId&&old.subject_id===f.subjectId&&old.program_id===i.programId&&old.version===i.version&&old.acknowledgment_id===i.acknowledgmentId);return interestReceipt(old);}
    // An explicit retry cannot create duplicate active interests or notifications.
    require(!db.prepare('SELECT 1 FROM program_interests i WHERE workspace_id=? AND program_id=? AND subject_id=? AND NOT EXISTS(SELECT 1 FROM program_interest_withdrawals w WHERE w.interest_id=i.interest_id)').get(f.workspaceId,i.programId,f.subjectId));
    db.prepare('INSERT INTO program_interests(interest_id,workspace_id,program_id,version,subject_id,acknowledgment_id) VALUES(?,?,?,?,?,?)').run(i.interestId,f.workspaceId,i.programId,i.version,f.subjectId,i.acknowledgmentId);
    event(f,i.programId,i.interestId,'interest-registered');return interestReceipt(db.prepare('SELECT * FROM program_interests WHERE interest_id=?').get(i.interestId));
   });
  },
  withdrawInterest(f,input){
   principal(f);exact(input,['programId','interestId','withdrawalId']);uuid(input.programId);uuid(input.interestId);uuid(input.withdrawalId);
   return transact(()=>{
    const i=db.prepare('SELECT * FROM program_interests WHERE interest_id=? AND workspace_id=? AND program_id=? AND subject_id=?').get(input.interestId,f.workspaceId,input.programId,f.subjectId);require(i);
    const old=db.prepare('SELECT * FROM program_interest_withdrawals WHERE interest_id=? OR withdrawal_id=?').all(input.interestId,input.withdrawalId);
    if(old.length)require(old.length===1&&old[0].interest_id===input.interestId&&old[0].withdrawal_id===input.withdrawalId);
    else{db.prepare('INSERT INTO program_interest_withdrawals(withdrawal_id,interest_id,workspace_id,subject_id) VALUES(?,?,?,?)').run(input.withdrawalId,input.interestId,f.workspaceId,f.subjectId);event(f,input.programId,input.withdrawalId,'interest-withdrawn');}
    return interestReceipt(i);
   });
  },
  close(){db.close();}
 });
}
