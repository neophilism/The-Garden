import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {RESEARCH_CHARTER,validateProgramVersion,programTermsDigest,acknowledgmentInput,interestInput,validateSubmissionSource} from '../../packages/domain/src/community/program.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const version={schemaVersion:1,programId:id(1),version:1,title:'Synthetic program',responsibleInstitution:'Synthetic test institution',charter:'Preserve originals.\nResearch only; no endorsement.',permittedPurposes:['program-interest','research-submission'],researchCharter:RESEARCH_CHARTER,newInterviews:false};
test('original research charter bytes, version and cutoff stay pinned',()=>{
 const raw=readFileSync(new URL('../../docs/sources/research-charter.md',import.meta.url));
 assert.equal(createHash('sha256').update(raw).digest('hex'),RESEARCH_CHARTER.sha256);assert.equal(RESEARCH_CHARTER.cutoff,'2026-09-25');
 assert.match(raw.toString(),/no new interviews are undertaken/);
});
test('exact version fingerprint covers charter, institution, purposes and version',()=>{
 const first=programTermsDigest(version);
 for(const patch of [{charter:'Different consent terms'},{responsibleInstitution:'Different institution'},{permittedPurposes:['research-submission']},{version:2},{title:'New program title'}])assert.notEqual(programTermsDigest({...version,...patch}),first);
 assert.equal(programTermsDigest({...version,permittedPurposes:[...version.permittedPurposes].reverse()}),first);
 assert.equal(programTermsDigest(Object.fromEntries(Object.entries(version).reverse())),first);
});
for(const [name,patch] of Object.entries({interviews:{newInterviews:true},rewrittenCutoff:{researchCharter:{...RESEARCH_CHARTER,cutoff:'2026-10-17'}},rewrittenScope:{researchCharter:{...RESEARCH_CHARTER,sha256:'a'.repeat(64)}},politicalPurpose:{permittedPurposes:['promotional-endorsement']},enrollment:{permittedPurposes:['enrollment']},duplicates:{permittedPurposes:['program-interest','program-interest']},noPurpose:{permittedPurposes:[]},badVersion:{version:0},mutableApproval:{approved:true},oversizeTerms:{charter:'x'.repeat(12001)},nulTerms:{charter:'Text\u0000bad'}}))test(`program refuses ${name}`,()=>assert.throws(()=>validateProgramVersion({...version,...patch}),/Contribution request unavailable/));
test('acknowledgment must be affirmative and exact; no implicit interest',()=>{
 const input={programId:id(1),version:1,termsDigest:programTermsDigest(version),acknowledgmentId:id(3),acknowledged:true};
 assert.equal(acknowledgmentInput(input).acknowledged,true);
 for(const patch of [{acknowledged:false},{acknowledged:'true'},{requestProgramUpdates:true},{policyEndorsement:true},{termsDigest:'A'.repeat(64)}])assert.throws(()=>acknowledgmentInput({...input,...patch}));
 const i={programId:id(1),version:1,termsDigest:programTermsDigest(version),acknowledgmentId:id(3),interestId:id(5),requestProgramUpdates:true};
 for(const patch of [{requestProgramUpdates:false},{enroll:true},{subjectId:'other'}])assert.throws(()=>interestInput({...i,...patch}));
});
test('existing uploads must have trusted collection classification; new interviews are closed',()=>{
 const context={workspaceId:id(1),subjectId:'synthetic',uploadId:id(2)};
 const source={...context,state:'complete-quarantined',bytesVerified:true,publiclyAccessible:false,collectionKind:'existing-material'};
 assert.equal(validateSubmissionSource(source,context).bytesVerified,true);
 for(const patch of [{collectionKind:'new-interview'},{collectionKind:'unknown'},{collectionKind:undefined},{workspaceId:id(4)},{subjectId:'other'},{uploadId:id(7)},{state:'receiving'},{publiclyAccessible:true},{bytesVerified:false},{consent:true}])assert.throws(()=>validateSubmissionSource({...source,...patch},context));
});
