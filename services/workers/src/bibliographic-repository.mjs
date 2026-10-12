/** Private, durable, owner-scoped citation candidates; no public view or API. */
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {existsSync,lstatSync,realpathSync,chmodSync,mkdirSync} from 'node:fs';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SOURCE_ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIGEST=/^[0-9a-f]{64}$/;
function reject(){throw new Error('Garden bibliographic repository rejected');}
function require(condition){if(!condition)reject();}
function safeRoot(path){
 require(typeof path==='string'&&isAbsolute(path));
 const canonical=resolve(path),relativePath=relative(SOURCE_ROOT,canonical);
 require(relativePath==='..'||relativePath.startsWith('../')||relativePath.startsWith('..\\'));
 if(!existsSync(canonical))mkdirSync(canonical,{recursive:false,mode:0o700});
 const st=lstatSync(canonical);require(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&(st.mode&0o077)===0);
 require(realpathSync(canonical)===canonical);return canonical;
}
const schema=`
CREATE TABLE IF NOT EXISTS submissions(
 workspace_id TEXT NOT NULL,subject_id TEXT NOT NULL,submission_id TEXT NOT NULL,
 source_sha256 TEXT NOT NULL,format TEXT NOT NULL,item_count INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(workspace_id,subject_id,submission_id));
CREATE TABLE IF NOT EXISTS acquisition_candidates(
 candidate_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,subject_id TEXT NOT NULL,
 submission_id TEXT NOT NULL,item_ordinal INTEGER NOT NULL,format TEXT NOT NULL,
 original_sha256 TEXT NOT NULL,original TEXT NOT NULL,normalized TEXT NOT NULL,
 attribution TEXT NOT NULL,review TEXT NOT NULL CHECK(review='discovery-only'),
 rights TEXT NOT NULL CHECK(rights='unreviewed'),publication_approved INTEGER NOT NULL CHECK(publication_approved=0),
 recorded_decision_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(workspace_id,subject_id,submission_id,item_ordinal),
 FOREIGN KEY(workspace_id,subject_id,submission_id) REFERENCES submissions(workspace_id,subject_id,submission_id));
CREATE INDEX IF NOT EXISTS candidates_owner ON acquisition_candidates(workspace_id,subject_id,candidate_id);
CREATE TABLE IF NOT EXISTS duplicate_decisions(
 event_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,subject_id TEXT NOT NULL,
 first_id TEXT NOT NULL,second_id TEXT NOT NULL,decision TEXT NOT NULL CHECK(decision IN ('duplicate','distinct','unresolved')),
 reason TEXT NOT NULL,previous_event_id TEXT,recorded_decision_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS pair_history ON duplicate_decisions(workspace_id,subject_id,first_id,second_id);
CREATE TRIGGER IF NOT EXISTS candidate_no_update BEFORE UPDATE ON acquisition_candidates BEGIN SELECT RAISE(ABORT,'immutable candidate'); END;
CREATE TRIGGER IF NOT EXISTS candidate_no_delete BEFORE DELETE ON acquisition_candidates BEGIN SELECT RAISE(ABORT,'immutable candidate'); END;
CREATE TRIGGER IF NOT EXISTS decision_no_update BEFORE UPDATE ON duplicate_decisions BEGIN SELECT RAISE(ABORT,'immutable decision'); END;
CREATE TRIGGER IF NOT EXISTS decision_no_delete BEFORE DELETE ON duplicate_decisions BEGIN SELECT RAISE(ABORT,'immutable decision'); END;
`;
const copy=row=>({id:row.candidate_id,ordinal:row.item_ordinal,format:row.format,
 original:row.original,sha256:row.original_sha256,
 normalized:JSON.parse(row.normalized),sourceAttribution:JSON.parse(row.attribution),
 review:row.review,rights:row.rights,publicationApproved:false,createdAt:row.created_at});
function identity(f){require(typeof f?.workspaceId==='string'&&ID.test(f.workspaceId)&&typeof f.subjectId==='string'&&f.subjectId.length>0&&f.subjectId.length<=128&&typeof f.requestId==='string'&&ID.test(f.requestId));}
function scope(f){return [f.workspaceId,f.subjectId];}
export function createPrivateBibliographicRepository({root}){
 const dir=safeRoot(root),dbfile=join(dir,'bibliographic-intake.sqlite3');
 if(existsSync(dbfile)){
  const st=lstatSync(dbfile);require(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.uid===process.getuid()&&(st.mode&0o077)===0);
 }
 const existed=existsSync(dbfile);
 const db=new DatabaseSync(dbfile,{enableForeignKeyConstraints:true});
 chmodSync(dbfile,0o600);db.exec('PRAGMA journal_mode=DELETE;PRAGMA synchronous=FULL;PRAGMA foreign_keys=ON;');
 const version=db.prepare('PRAGMA user_version').get().user_version;
 if((existed&&version!==1)||(!existed&&version!==0)){db.close();reject();}
 db.exec(schema);
 if(!existed)db.exec('PRAGMA user_version=1');
 // Reject incompatible/tampered schema rather than trusting CREATE IF NOT EXISTS.
 const shapes={submissions:7,acquisition_candidates:15,duplicate_decisions:10};
 for(const [name,count] of Object.entries(shapes)){
  const columns=db.prepare(`PRAGMA table_info(${name})`).all();
  if(columns.length!==count){db.close();reject();}
 }
 if(db.prepare('PRAGMA foreign_keys').get().foreign_keys!==1){db.close();reject();}
 // No journal-side content leaves the private directory. No direct public read adapter.
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){try{db.exec('ROLLBACK');}catch{}reject();}}
 function own(f,id){
  require(ID.test(id));const row=db.prepare('SELECT * FROM acquisition_candidates WHERE workspace_id=? AND subject_id=? AND candidate_id=?').get(...scope(f),id);
  require(row);return row;
 }
 return Object.freeze({
  submit(f,submissionId,format,sourceSha,entries){
   identity(f);require(ID.test(submissionId)&&DIGEST.test(sourceSha)&&['ris','bibtex','csl-json','manual'].includes(format)&&Array.isArray(entries)&&entries.length>0&&entries.length<=32);
   return transaction(()=>{
    const old=db.prepare('SELECT * FROM submissions WHERE workspace_id=? AND subject_id=? AND submission_id=?').get(...scope(f),submissionId);
    if(old)require(old.source_sha256===sourceSha&&old.format===format&&old.item_count===entries.length);
    else db.prepare('INSERT INTO submissions(workspace_id,subject_id,submission_id,source_sha256,format,item_count) VALUES(?,?,?,?,?,?)').run(...scope(f),submissionId,sourceSha,format,entries.length);
    const get=db.prepare('SELECT * FROM acquisition_candidates WHERE workspace_id=? AND subject_id=? AND submission_id=? AND item_ordinal=?');
    const put=db.prepare('INSERT INTO acquisition_candidates(candidate_id,workspace_id,subject_id,submission_id,item_ordinal,format,original_sha256,original,normalized,attribution,review,rights,publication_approved,recorded_decision_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const output=[];
    for(const e of entries){
     let row=get.get(...scope(f),submissionId,e.ordinal);
     if(row){require(row.original_sha256===e.sha256&&row.original===e.original&&row.format===format&&row.normalized===JSON.stringify(e.normalized)&&row.attribution===JSON.stringify(e.sourceAttribution));}
     else{const id=randomUUID();put.run(id,...scope(f),submissionId,e.ordinal,format,e.sha256,e.original,JSON.stringify(e.normalized),JSON.stringify(e.sourceAttribution),'discovery-only','unreviewed',0,f.requestId);row=get.get(...scope(f),submissionId,e.ordinal);}
     output.push(copy(row));
    }
    return {candidates:output,stored:'private-discovery-only',publicationApproved:false};
   });
  },
  detail(f,candidateId){identity(f);return copy(own(f,candidateId));},
  list(f,{afterId=null,limit=25}={}){
   identity(f);require((afterId===null||ID.test(afterId))&&Number.isInteger(limit)&&limit>=1&&limit<=50);
   const rows=db.prepare('SELECT * FROM acquisition_candidates WHERE workspace_id=? AND subject_id=? AND (? IS NULL OR candidate_id>?) ORDER BY candidate_id LIMIT ?').all(...scope(f),afterId,afterId,limit+1);
   return {candidates:rows.slice(0,limit).map(copy),nextAfterId:rows.length>limit?rows[limit-1].candidate_id:null};
  },
  decision(f,{eventId,firstId,secondId,decision,reason,supersedes}){
   identity(f);require([eventId,firstId,secondId].every(x=>typeof x==='string'&&ID.test(x))&&firstId!==secondId&&['duplicate','distinct','unresolved'].includes(decision)&&typeof reason==='string'&&reason.trim()&&reason.length<=1000&&(supersedes===null||ID.test(supersedes)));
   const [a,b]=[firstId,secondId].sort();
   return transaction(()=>{
    own(f,a);own(f,b);
    const oldEvent=db.prepare('SELECT * FROM duplicate_decisions WHERE workspace_id=? AND subject_id=? AND event_id=?').get(...scope(f),eventId);
    if(oldEvent){require(oldEvent.first_id===a&&oldEvent.second_id===b&&oldEvent.decision===decision&&oldEvent.reason===reason&&oldEvent.previous_event_id===supersedes);return {...oldEvent,publicationApproved:false};}
    const latest=db.prepare('SELECT * FROM duplicate_decisions WHERE workspace_id=? AND subject_id=? AND first_id=? AND second_id=? ORDER BY rowid DESC LIMIT 1').get(...scope(f),a,b);
    require((latest?.event_id??null)===supersedes);
    db.prepare('INSERT INTO duplicate_decisions(event_id,workspace_id,subject_id,first_id,second_id,decision,reason,previous_event_id,recorded_decision_id) VALUES(?,?,?,?,?,?,?,?,?)').run(eventId,...scope(f),a,b,decision,reason,supersedes,f.requestId);
    return {...db.prepare('SELECT * FROM duplicate_decisions WHERE event_id=?').get(eventId),publicationApproved:false};
   });
  },
  history(f,firstId,secondId){
   identity(f);own(f,firstId);own(f,secondId);require(firstId!==secondId);const [a,b]=[firstId,secondId].sort();
   const rows=db.prepare('SELECT * FROM duplicate_decisions WHERE workspace_id=? AND subject_id=? AND first_id=? AND second_id=? ORDER BY rowid ASC LIMIT 100').all(...scope(f),a,b);
   return rows.map(row=>({...row,publicationApproved:false}));
  },
  close(){db.close();}
 });
}
