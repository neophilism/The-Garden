/** Restricted, append-only offline image reconciliation snapshots.
 * This is not the operational PostgreSQL assets or publication registry.
 */
import {DatabaseSync} from 'node:sqlite';
import {existsSync,lstatSync,realpathSync,mkdirSync,chmodSync} from 'node:fs';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {IMAGE_RECONCILIATION_PROFILE,HASH,UUID,exact,imageEvidenceDigest,reject} from '../../../packages/domain/src/historical/image-reconciliation.mjs';

const sourceRoot=fileURLToPath(new URL('../../../',import.meta.url));
const schema=`
CREATE TABLE snapshots (
 workspace_id TEXT NOT NULL,subject_id TEXT NOT NULL,bundle_id TEXT NOT NULL,
 input_digest TEXT NOT NULL,report_digest TEXT NOT NULL,payload TEXT NOT NULL,
 PRIMARY KEY(workspace_id,subject_id,bundle_id,input_digest));
CREATE TABLE runs (
 run_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,subject_id TEXT NOT NULL,
 bundle_id TEXT NOT NULL,input_digest TEXT NOT NULL,report_digest TEXT NOT NULL,
 FOREIGN KEY(workspace_id,subject_id,bundle_id,input_digest)
 REFERENCES snapshots(workspace_id,subject_id,bundle_id,input_digest));
CREATE TABLE attempts (
 decision_id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(run_id),
 report_digest TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TRIGGER snapshots_no_update BEFORE UPDATE ON snapshots BEGIN SELECT RAISE(ABORT,'immutable snapshot'); END;
CREATE TRIGGER snapshots_no_delete BEFORE DELETE ON snapshots BEGIN SELECT RAISE(ABORT,'immutable snapshot'); END;
CREATE TRIGGER runs_no_update BEFORE UPDATE ON runs BEGIN SELECT RAISE(ABORT,'immutable run'); END;
CREATE TRIGGER runs_no_delete BEFORE DELETE ON runs BEGIN SELECT RAISE(ABORT,'immutable run'); END;
CREATE TRIGGER attempts_no_update BEFORE UPDATE ON attempts BEGIN SELECT RAISE(ABORT,'immutable attempt'); END;
CREATE TRIGGER attempts_no_delete BEFORE DELETE ON attempts BEGIN SELECT RAISE(ABORT,'immutable attempt'); END;
`;
function require(value){if(!value)reject();}
function principal(f){exact(f,['workspaceId','subjectId','requestId']);require(UUID.test(f.workspaceId)&&UUID.test(f.requestId)&&typeof f.subjectId==='string'&&f.subjectId.length>0&&f.subjectId.length<=128);}
function safeFile(path){const st=lstatSync(path);require(st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&st.nlink===1&&(st.mode&0o077)===0);}
function safeRoot(root){
 require(typeof root==='string'&&isAbsolute(root));const path=resolve(root),rel=relative(sourceRoot,path);require(rel==='..'||rel.startsWith('../'));
 if(!existsSync(path))mkdirSync(path,{mode:0o700,recursive:false});
 const st=lstatSync(path);require(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&(st.mode&0o077)===0&&realpathSync(path)===path);return path;
}
function validReport(report){
 require(report?.profile===IMAGE_RECONCILIATION_PROFILE&&HASH.test(report.inputDigest)&&report.classification==='restricted_research'&&report.historicalReview==='unreviewed'&&report.publiclyAccessible===false&&report.publicationApproved===false&&Array.isArray(report.editions));
 const payload=JSON.stringify(report);require(Buffer.byteLength(payload)<=64*1024**2);return payload;
}
function summary(row,report){return Object.freeze({profile:IMAGE_RECONCILIATION_PROFILE,bundleId:row.bundle_id,inputDigest:row.input_digest,reportDigest:row.report_digest,status:'complete-unreviewed',
 editions:report.editions.map(e=>({document:e.document,counts:e.counts})),legacyCounts:report.legacyCounts,findings:report.findings.length,publiclyAccessible:false,publicationApproved:false});}

export function createPrivateImageReconciliationRepository({root}){
 const directory=safeRoot(root),path=join(directory,'image-reconciliation.sqlite3');
 for(const suffix of ['','-journal','-wal','-shm'])if(existsSync(path+suffix))safeFile(path+suffix);
 require(!existsSync(path+'-wal')&&!existsSync(path+'-shm'));
 const fresh=!existsSync(path),db=new DatabaseSync(path,{enableForeignKeyConstraints:true});chmodSync(path,0o600);
 try{
  db.exec('PRAGMA journal_mode=DELETE;PRAGMA synchronous=FULL;PRAGMA foreign_keys=ON;PRAGMA trusted_schema=OFF');
  const version=db.prepare('PRAGMA user_version').get().user_version;require(fresh?version===0:version===1);
  if(fresh){db.exec('BEGIN IMMEDIATE');db.exec(schema);db.exec('PRAGMA user_version=1');db.exec('COMMIT');}
  const reference=new DatabaseSync(':memory:');reference.exec(schema);
  const inspect=c=>c.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  try{require(JSON.stringify(inspect(db))===JSON.stringify(inspect(reference)));}finally{reference.close();}
 }catch{db.close();reject();}
 function readRow(f,bundleId,inputDigest){
  principal(f);require(UUID.test(bundleId)&&HASH.test(inputDigest));
  const row=db.prepare('SELECT * FROM snapshots WHERE workspace_id=? AND subject_id=? AND bundle_id=? AND input_digest=?').get(f.workspaceId,f.subjectId,bundleId,inputDigest);require(row);
  const report=JSON.parse(row.payload);validReport(report);require(report.inputDigest===inputDigest&&imageEvidenceDigest(report)===row.report_digest);return {row,report};
 }
 return Object.freeze({
  commit(f,{runId,bundleId,report}){
   principal(f);require(UUID.test(runId)&&UUID.test(bundleId));const payload=validReport(report),reportDigest=imageEvidenceDigest(report);
   db.exec('BEGIN IMMEDIATE');
   try{
    const prior=db.prepare('SELECT * FROM runs WHERE run_id=?').get(runId);
    if(prior)require(prior.workspace_id===f.workspaceId&&prior.subject_id===f.subjectId&&prior.bundle_id===bundleId&&prior.input_digest===report.inputDigest&&prior.report_digest===reportDigest);
    const priorSnapshot=db.prepare('SELECT * FROM snapshots WHERE workspace_id=? AND subject_id=? AND bundle_id=? AND input_digest=?').get(f.workspaceId,f.subjectId,bundleId,report.inputDigest);
    if(priorSnapshot)require(priorSnapshot.report_digest===reportDigest&&imageEvidenceDigest(JSON.parse(priorSnapshot.payload))===reportDigest);
    else db.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?,?)').run(f.workspaceId,f.subjectId,bundleId,report.inputDigest,reportDigest,payload);
    if(!prior)db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?)').run(runId,f.workspaceId,f.subjectId,bundleId,report.inputDigest,reportDigest);
    const attempt=db.prepare('SELECT * FROM attempts WHERE decision_id=?').get(f.requestId);
    if(attempt)require(attempt.run_id===runId&&attempt.report_digest===reportDigest);
    else db.prepare('INSERT INTO attempts(decision_id,run_id,report_digest) VALUES(?,?,?)').run(f.requestId,runId,reportDigest);
    db.exec('COMMIT');return summary({bundle_id:bundleId,input_digest:report.inputDigest,report_digest:reportDigest},report);
   }catch{try{db.exec('ROLLBACK');}catch{}reject();}
  },
  read(f,{bundleId,inputDigest}){const {report}=readRow(f,bundleId,inputDigest);return structuredClone(report);},
  close(){db.close();}
 });
}
