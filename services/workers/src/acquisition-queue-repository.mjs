/** GDN-085: offline source-requests ledger. Never executes contact or payment. */
import {DatabaseSync} from 'node:sqlite';
import {existsSync,lstatSync,realpathSync,mkdirSync,chmodSync} from 'node:fs';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {UUID,exact,uuid,text,reject,validateAcquisitionDraft,validateAcquisitionEvent,validateTrustedAuthority,classifyFinding,acquisitionIdempotencyDigest} from '../../../packages/domain/src/historical/acquisition-tasks.mjs';

const SOURCE_ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const require=condition=>{if(!condition)reject();};
const schema=`
CREATE TABLE tasks (
 task_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,subject_id TEXT NOT NULL,
 repository_id TEXT NOT NULL,route_key TEXT NOT NULL,raw_sha256 TEXT NOT NULL,
 original TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX tasks_owner ON tasks(workspace_id,subject_id,task_id);
CREATE TABLE task_events (
 event_id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(task_id),
 workspace_id TEXT NOT NULL,subject_id TEXT NOT NULL,previous_event_id TEXT,
 kind TEXT NOT NULL,original TEXT NOT NULL,decision_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX events_task ON task_events(task_id);
CREATE TABLE denied_routes (
 workspace_id TEXT NOT NULL,route_key TEXT NOT NULL,event_id TEXT NOT NULL UNIQUE,
 reason TEXT NOT NULL,PRIMARY KEY(workspace_id,route_key));
CREATE TABLE contact_ledger (
 workspace_id TEXT NOT NULL,route_key TEXT NOT NULL,task_id TEXT NOT NULL UNIQUE,
 event_id TEXT NOT NULL UNIQUE,PRIMARY KEY(workspace_id,route_key));
CREATE TRIGGER tasks_no_update BEFORE UPDATE ON tasks BEGIN SELECT RAISE(ABORT,'immutable original'); END;
CREATE TRIGGER tasks_no_delete BEFORE DELETE ON tasks BEGIN SELECT RAISE(ABORT,'immutable original'); END;
CREATE TRIGGER events_no_update BEFORE UPDATE ON task_events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
CREATE TRIGGER events_no_delete BEFORE DELETE ON task_events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
CREATE TRIGGER barriers_no_update BEFORE UPDATE ON denied_routes BEGIN SELECT RAISE(ABORT,'immutable denial'); END;
CREATE TRIGGER barriers_no_delete BEFORE DELETE ON denied_routes BEGIN SELECT RAISE(ABORT,'immutable denial'); END;
CREATE TRIGGER contacts_no_update BEFORE UPDATE ON contact_ledger BEGIN SELECT RAISE(ABORT,'immutable contact'); END;
CREATE TRIGGER contacts_no_delete BEFORE DELETE ON contact_ledger BEGIN SELECT RAISE(ABORT,'immutable contact'); END;
`;
function privateRoot(root){
 require(typeof root==='string'&&isAbsolute(root));const path=resolve(root),rel=relative(SOURCE_ROOT,path);
 require(rel==='..'||rel.startsWith('../')||rel.startsWith('..\\'));
 if(!existsSync(path))mkdirSync(path,{mode:0o700,recursive:false});
 const st=lstatSync(path);require(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&(st.mode&0o077)===0&&realpathSync(path)===path);
 return path;
}
function principal(f){
 exact(f,['subjectId','workspaceId','requestId']);uuid(f.workspaceId);uuid(f.requestId);text(f.subjectId,128);
 return [f.workspaceId,f.subjectId];
}
const decode=row=>({task:JSON.parse(row.original),id:row.task_id,workspaceId:row.workspace_id,subjectId:row.subject_id,routeKey:row.route_key});
export function createPrivateAcquisitionQueueRepository({root}){
 const dir=privateRoot(root),dbpath=join(dir,'source-acquisition.sqlite3');
 if(existsSync(dbpath)){
  const st=lstatSync(dbpath);require(st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&st.nlink===1&&(st.mode&0o077)===0);
 }
 const fresh=!existsSync(dbpath);
 const db=new DatabaseSync(dbpath,{enableForeignKeyConstraints:true});chmodSync(dbpath,0o600);
 db.exec('PRAGMA journal_mode=DELETE;PRAGMA synchronous=FULL;PRAGMA foreign_keys=ON;PRAGMA trusted_schema=OFF');
 const version=db.prepare('PRAGMA user_version').get().user_version;
 if(fresh?version!==0:version!==1){db.close();reject();}
 if(fresh){db.exec(schema);db.exec('PRAGMA user_version=1');}
 // Validate the exact schema, indices and triggers, not only table names.
 const expected=new DatabaseSync(':memory:',{enableForeignKeyConstraints:true});
 expected.exec(schema);
 const inspect=c=>c.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 try{require(JSON.stringify(inspect(db))===JSON.stringify(inspect(expected)));}
 finally{expected.close();}
 require(db.prepare('PRAGMA foreign_keys').get().foreign_keys===1);
 function transact(fn){db.exec('BEGIN IMMEDIATE');try{const output=fn();db.exec('COMMIT');return output;}catch{try{db.exec('ROLLBACK');}catch{}reject();}}
 function requireTask(f,taskId){
  uuid(taskId);const row=db.prepare('SELECT * FROM tasks WHERE workspace_id=? AND subject_id=? AND task_id=?').get(...principal(f).slice(0,2),taskId);
  require(row);return decode(row);
 }
 function eventsFor(taskId){return db.prepare('SELECT * FROM task_events WHERE task_id=? ORDER BY rowid').all(taskId).map(r=>({...r,original:JSON.parse(r.original)}));}
 function view(f,taskId){
  const task=requireTask(f,taskId),events=eventsFor(taskId),last=events.at(-1);
  return {id:task.id,task:task.task,currentStatus:last.kind,revision:last.event_id,
   acquisitionOnly:true,contactAutomaticallySent:false,paymentAutomaticallyExecuted:false,
   accessFinding:last.kind==='access-observed'?last.original.finding:null,
   historyLength:events.length};
 }
 function append(f,taskId,eventId,previousEventId,kind,payload){
  const existing=db.prepare('SELECT * FROM task_events WHERE event_id=?').get(eventId);
  if(existing){require(existing.task_id===taskId&&existing.kind===kind&&existing.original===JSON.stringify(payload));return false;}
  const latest=db.prepare('SELECT event_id FROM task_events WHERE task_id=? ORDER BY rowid DESC LIMIT 1').get(taskId);
  require(latest?.event_id===previousEventId);
  db.prepare('INSERT INTO task_events(event_id,task_id,workspace_id,subject_id,previous_event_id,kind,original,decision_id) VALUES(?,?,?,?,?,?,?,?)').run(eventId,taskId,f.workspaceId,f.subjectId,previousEventId,kind,JSON.stringify(payload),f.requestId);
  return true;
 }
 function checkRoute(task){const found=db.prepare('SELECT event_id FROM denied_routes WHERE workspace_id=? AND route_key=?').get(task.workspaceId,task.routeKey);require(!found);}
 function approved(taskId){
  const e=db.prepare("SELECT original FROM task_events WHERE task_id=? AND kind='approved' ORDER BY rowid DESC LIMIT 1").get(taskId);
  require(e);return JSON.parse(e.original).authority;
 }
 function sameGrant(a,b){return JSON.stringify(a)===JSON.stringify(b);}
 return Object.freeze({
  draft(f,input){principal(f);const source=validateAcquisitionDraft(input);
   return transact(()=>{
    const prior=db.prepare('SELECT * FROM tasks WHERE task_id=?').get(source.taskId);
    if(prior){require(prior.workspace_id===f.workspaceId&&prior.subject_id===f.subjectId&&prior.original===JSON.stringify(source));return view(f,source.taskId);}
    db.prepare('INSERT INTO tasks(task_id,workspace_id,subject_id,repository_id,route_key,raw_sha256,original) VALUES(?,?,?,?,?,?,?)').run(source.taskId,f.workspaceId,f.subjectId,source.repositoryId,source.routeKey,acquisitionIdempotencyDigest(source),JSON.stringify(source));
    db.prepare('INSERT INTO task_events(event_id,task_id,workspace_id,subject_id,previous_event_id,kind,original,decision_id) VALUES(?,?,?,?,?,?,?,?)').run(source.taskId,source.taskId,f.workspaceId,f.subjectId,null,'draft',JSON.stringify(source),f.requestId);
    return view(f,source.taskId);
   });
  },
  detail(f,id){return view(f,id);},
  list(f,{afterId=null,limit=25}={}){
   principal(f);require((afterId===null||UUID.test(afterId))&&Number.isInteger(limit)&&limit>=1&&limit<=50);
   const ids=db.prepare('SELECT task_id FROM tasks WHERE workspace_id=? AND subject_id=? AND (? IS NULL OR task_id>?) ORDER BY task_id LIMIT ?').all(f.workspaceId,f.subjectId,afterId,afterId,limit+1);
   return {tasks:ids.slice(0,limit).map(row=>view(f,row.task_id)),nextAfterId:ids.length>limit?ids[limit-1].task_id:null};
  },
  observe(f,input){principal(f);const e=validateAcquisitionEvent(input,'observe');const task=requireTask(f,e.taskId);
   return transact(()=>{
    const current=eventsFor(task.id);require(!current.some(v=>['finished','contact-recorded'].includes(v.kind)));
    const added=append(f,e.taskId,e.eventId,e.previousEventId,'access-observed',e);
    if(added&&classifyFinding(e.finding).barrier)db.prepare('INSERT OR IGNORE INTO denied_routes(workspace_id,route_key,event_id,reason) VALUES(?,?,?,?)').run(task.workspaceId,task.routeKey,e.eventId,e.finding);
    return view(f,e.taskId);
   });
  },
  approve(f,input,authority){principal(f);const e=validateAcquisitionEvent(input,'approve'),task=requireTask(f,e.taskId);
   const verified=validateTrustedAuthority(authority, {...task.task,workspaceId:task.workspaceId},f.subjectId);
   require(e.authorizationId===verified.authorizationId);
   return transact(()=>{
    checkRoute(task);const old=eventsFor(task.id);require(!old.some(v=>v.kind==='contact-recorded'||v.kind==='finished'));
    append(f,e.taskId,e.eventId,e.previousEventId,'approved',{...e,authority:verified});return view(f,e.taskId);
   });
  },
  recordContact(f,input,authority){principal(f);const e=validateAcquisitionEvent(input,'recordContact'),task=requireTask(f,e.taskId);
   const verified=validateTrustedAuthority(authority,{...task.task,workspaceId:task.workspaceId},f.subjectId);
   require(e.authorizationId===verified.authorizationId);
   return transact(()=>{
    const old=eventsFor(task.id).find(v=>v.event_id===e.eventId);
    if(old){require(old.kind==='contact-recorded'&&old.original.input&&JSON.stringify(old.original.input)===JSON.stringify(e)&&sameGrant(old.original.authority,verified));return view(f,e.taskId);}
    checkRoute(task);const grant=approved(task.id);require(sameGrant(grant,verified));
    const present=db.prepare('SELECT event_id FROM contact_ledger WHERE workspace_id=? AND route_key=?').get(task.workspaceId,task.routeKey);require(!present);
    append(f,e.taskId,e.eventId,e.previousEventId,'contact-recorded',{input:e,authority:verified});
    db.prepare('INSERT INTO contact_ledger(workspace_id,route_key,task_id,event_id) VALUES(?,?,?,?)').run(task.workspaceId,task.routeKey,task.id,e.eventId);
    return view(f,e.taskId);
   });
  },
  finish(f,input){principal(f);const e=validateAcquisitionEvent(input,'finish'),task=requireTask(f,e.taskId);
   return transact(()=>{
    const old=eventsFor(task.id).find(v=>v.event_id===e.eventId);
    if(old){require(old.kind==='finished'&&JSON.stringify(old.original)===JSON.stringify(e));return view(f,e.taskId);}
    const current=eventsFor(task.id);require(!current.some(v=>v.kind==='finished'));
    const last=current.at(-1);require(last?.kind==='contact-recorded'||e.outcome==='deferred-offline'||e.outcome==='withdrawn'||e.outcome==='inaccessible'||e.outcome==='catalog-not-found');
    append(f,e.taskId,e.eventId,e.previousEventId,'finished',e);
    if(e.outcome==='inaccessible')db.prepare('INSERT OR IGNORE INTO denied_routes(workspace_id,route_key,event_id,reason) VALUES(?,?,?,?)').run(task.workspaceId,task.routeKey,e.eventId,e.outcome);
    return view(f,e.taskId);
   });
  },
  history(f,taskId){requireTask(f,taskId);return eventsFor(taskId).map(e=>({id:e.event_id,kind:e.kind,previousEventId:e.previous_event_id,recordedDecisionId:e.decision_id,details:e.original}));},
  close(){db.close();}
 });
}
