import {useId} from 'react';

export interface ContributorProgramSummary {
 title:string;responsibleInstitution:string;version:number;termsDigest:string;charter:string;
 permittedPurposes:('research-submission'|'program-interest')[];
 researchCharter:{version:'1.0';cutoff:'2026-09-25';sha256:string};newInterviews:false;
}
export interface ContributorActivity {
 acknowledgmentVersion:number|null;
 submissions:{submissionId:string;version:number;state:'pending-review'}[];
 interests:{interestId:string;version:number;state:'registered'|'withdrawn'}[];
}
const identifier=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash=/^[0-9a-f]{64}$/;
function validText(value:unknown,max:number){return typeof value==='string'&&!!value.trim()&&value.length<=max;}

/** Presentation only: activity must already belong to the verified viewer.
 * This component cannot create consent, submit files, subscribe, or enroll.
 * The callable service is intentionally not mounted in the application shell.
 */
export function ContributorProgramPanel({program=null,activity=null}:{program?:ContributorProgramSummary|null;activity?:ContributorActivity|null}){
 const heading=useId(),terms=useId();
 if(program&&(!validText(program.title,120)||!validText(program.responsibleInstitution,200)||!validText(program.charter,12000)||!Number.isSafeInteger(program.version)||program.version<1||!hash.test(program.termsDigest)||program.newInterviews!==false||program.researchCharter?.cutoff!=='2026-09-25'||program.researchCharter.version!=='1.0'||!hash.test(program.researchCharter.sha256)||!Array.isArray(program.permittedPurposes)||!program.permittedPurposes.length||program.permittedPurposes.some(p=>!['research-submission','program-interest'].includes(p))))throw Error('Invalid contributor summary');
 if(activity&&(!program||!Array.isArray(activity.submissions)||activity.submissions.length>20||!Array.isArray(activity.interests)||activity.interests.length>20||(activity.acknowledgmentVersion!==null&&(!Number.isSafeInteger(activity.acknowledgmentVersion)||activity.acknowledgmentVersion<1||activity.acknowledgmentVersion>program.version))||activity.submissions.some(s=>!identifier.test(s.submissionId)||s.state!=='pending-review'||!Number.isSafeInteger(s.version)||s.version<1||s.version>program.version)||activity.interests.some(i=>!identifier.test(i.interestId)||!['registered','withdrawn'].includes(i.state)||!Number.isSafeInteger(i.version)||i.version<1||i.version>program.version)))throw Error('Invalid contributor activity');
 return <section aria-labelledby={heading} style={{border:'1px solid #adbfb3',borderRadius:16,padding:'clamp(1rem,4vw,2rem)',overflowWrap:'anywhere',lineHeight:1.65}}>
  <p style={{fontSize:'.8rem',letterSpacing:'.08em'}}>OPTIONAL CONTRIBUTION PROGRAM</p>
  <h2 id={heading}>Bring a source. Keep your choices.</h2>
  <p>Your knowledge, a document you hold, or a correction may help future research. You can take part without endorsing The Garden’s policy proposal.</p>
  <p><strong>Contributor intake is not enabled in this application.</strong> You can read the guidance here. No file or personal information is collected on this page.</p>
  <dl>
   <dt><strong>Submit existing material</strong></dt><dd>A private research submission starts a review. It does not register interest, grant publication rights, or establish a historical claim.</dd>
   <dt><strong>Register interest separately</strong></dt><dd>When available, an optional request for program updates will be a separate choice you can withdraw. Submitting a source will not subscribe you.</dd>
   <dt><strong>Membership and enrollment</strong></dt><dd>Neither action creates researcher membership, citizenship, eligibility, or official enrollment.</dd>
   <dt><strong>Endorsement</strong></dt><dd>Reading terms, contributing, and registering interest do not endorse the policy or authorize promotional use.</dd>
  </dl>
  <h3>Before you prepare a contribution</h3>
  <ol>
   <li>Keep the original unchanged. Note where the item came from and any identifiers already attached to it.</li>
   <li>Record what you know and what remains uncertain. A name or photograph alone cannot establish identity, ancestry, or nation.</li>
   <li>Check whether the item includes living people, private correspondence, or restrictions. Do not place those details on a public page.</li>
   <li>Wait for an authorized private intake route and read its responsible institution, permitted uses, and exact charter version.</li>
  </ol>
  {program?<>
   <h3 id={terms}>{program.title} · version {program.version}</h3>
   <p>Responsible institution: <strong>{program.responsibleInstitution}</strong></p>
   <p>Permitted program purposes: {program.permittedPurposes.map(p=>p==='research-submission'?'receive existing material for research review':'record an optional request for program updates').join('; ')}.</p>
   <div aria-labelledby={terms} style={{whiteSpace:'pre-wrap',padding:'1rem',background:'#edf2ee',borderRadius:8}}>{program.charter}</div>
   <details><summary>Exact version fingerprint</summary><p><code>{program.termsDigest}</code></p><p>An acknowledgment applies only to these terms and this scope. A changed version requires a new acknowledgment.</p></details>
  </>:<p><strong>No authorized program version has been configured for this page.</strong> A future active charter must name the responsible institution, authorization, purposes, response capacity, and withdrawal process.</p>}
  {activity&&<>
   <h3>Your contribution activity</h3>
   <p>{activity.acknowledgmentVersion===program?.version?`You acknowledged version ${program.version}. This acknowledgment is not a consent grant.`:activity.acknowledgmentVersion?`You acknowledged version ${activity.acknowledgmentVersion}. Read and acknowledge the current version before any new submission.`:'You have not acknowledged the current program version.'}</p>
   {activity.submissions.length?<ul>{activity.submissions.map(s=><li key={s.submissionId}>Submission <code>{s.submissionId}</code> · version {s.version} · private, pending review</li>)}</ul>:<p>No submission receipts are shown.</p>}
   {activity.interests.length?<ul>{activity.interests.map(i=><li key={i.interestId}>Program interest <code>{i.interestId}</code> · version {i.version} · {i.state==='registered'?'registered separately':'withdrawn'}</li>)}</ul>:<p>No program interest registrations are shown.</p>}
  </>}
  <h3>New interviews need a separate consent process</h3>
  <p>This page does not authorize interviews, family outreach, or new recordings. The future consent-led program must have program authority, response capacity, and specific participant consent before new collection begins.</p>
  <p>The original online research charter remains version 1.0, with its <strong>25 September 2026</strong> completion cutoff and exclusion of new interviews. New contributions remain a separate, dated intake; they do not silently rewrite that scope.</p>
 </section>;
}
