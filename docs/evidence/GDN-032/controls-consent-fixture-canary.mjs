import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [mode,sourcePath,repositoryPath]=process.argv.slice(2);
assert.ok(['red','green'].includes(mode));
assert.ok(sourcePath&&repositoryPath);
const source=readFileSync(sourcePath,'utf8');
const protocolPath=resolve(repositoryPath,'packages/domain/src/consent/purpose.mjs');
const {validateUsePolicy,validateConsentGrant,evaluatePermittedUse}=await import(pathToFileURL(protocolPath).href);
const sha=value=>createHash('sha256').update(value).digest('hex');
const start=source.indexOf('async function personalConsent('),end=source.indexOf('async function reviseAuthority(',start);
assert.ok(start>0&&end>start);
const helperSource=source.slice(start,end);
const iso=value=>new Date(value).toISOString();
const scope={workspaceId:randomUUID(),recordId:randomUUID(),recordRevision:'1',classification:'restricted_research'};
const observations=[];

async function runFixture(guardian,{denyPositive=false}={}){
 const now=Date.now(),deadline=iso(now+2000),calls=[];
 let policy,grant;
 const admin={query:async(sql,args)=>{
  if(sql.includes('register_consent_terms')){calls.push('terms');assert.equal(args.length,3);return {rows:[]};}
  if(sql.includes('set_use_policy')){
   calls.push('policy');assert.equal(args[0],scope.workspaceId);
   policy=validateUsePolicy(JSON.parse(args[1]));return {rows:[{set_use_policy:'2'}]};
  }
  if(sql.includes('record_consent_grant')){
   calls.push('grant');assert.equal(args[0],scope.workspaceId);
   grant=validateConsentGrant(JSON.parse(args[1]));return {rows:[{record_consent_grant:grant.id}]};
  }
  if(sql.includes('consent_allows')){
   calls.push('positive');assert.deepEqual(args,[scope.workspaceId,scope.recordId]);
   assert.match(sql,/'research',clock_timestamp\(\)/);
   const allowed=evaluatePermittedUse({recordId:scope.recordId,purpose:'research',policies:[policy],grants:[grant],withdrawnGrantIds:[],now:Date.now()}).allowed;
   return {rows:[{allowed:denyPositive?false:allowed}]};
  }
  throw Error('Unexpected fixture SQL');
 }};
 const helper=new Function('admin','randomUUID','iso','CANARY','assert','validateUsePolicy','validateConsentGrant',
  helperSource+'return personalConsent;')(admin,randomUUID,iso,'synthetic-controls',assert,validateUsePolicy,validateConsentGrant);
 if(mode==='red'){
  await assert.rejects(()=>helper(scope,{guardian,deadline}),error=>error.code==='use_not_available');
  assert.deepEqual(calls,['terms','policy']);
  observations.push({guardian,invalidNumericTermsRejected:true,calls});return;
 }
 if(denyPositive){
  await assert.rejects(()=>helper(scope,{guardian,deadline}),error=>error.code==='ERR_ASSERTION'&&error.message.includes('synthetic consent setup must allow research before expiry'));
  assert.deepEqual(calls,['terms','policy','grant','positive']);
  observations.push({guardian,deniedPositiveSetupRejected:true,calls});return;
 }
 const result=await helper(scope,{guardian,deadline});
 assert.deepEqual(calls,['terms','policy','grant','positive']);
 assert.equal(policy.terms.version,'1');assert.equal(grant.terms.version,'1');
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.terms));
 const snapshot={recordId:scope.recordId,purpose:'research',policies:[policy],grants:[grant],withdrawnGrantIds:[],now};
 assert.equal(evaluatePermittedUse(snapshot).allowed,true);
 assert.equal(evaluatePermittedUse({...snapshot,now:Date.parse(deadline)-1}).allowed,true);
 assert.equal(evaluatePermittedUse({...snapshot,now:Date.parse(deadline)}).allowed,false);
 assert.equal(evaluatePermittedUse({...snapshot,now:Date.parse(deadline)+1}).allowed,false);
 observations.push({guardian,canonicalTermsAccepted:true,positiveSetupObserved:true,allowedBeforeDeadline:true,deniedAtAndAfterDeadline:true,calls});
}

for(const guardian of [false,true]){
 await runFixture(guardian);
 if(mode==='green')await runFixture(guardian,{denyPositive:true});
}
console.log(JSON.stringify({schemaVersion:1,mode,sourceSha256:sha(source),helperSha256:sha(helperSource),protocolSha256:sha(readFileSync(protocolPath)),
 extractedActualSource:true,postgresExecution:false,observations},null,2));
