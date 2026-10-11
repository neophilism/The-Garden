import {test} from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_AXES,REVIEW_RULES,ReviewError,ruleFor,initialReviewStates,reviewVersion,validateReviewEvidence,validateReviewTransition,validateReviewReopening,validateImportedReview,reviewTransitionAllowed,validateReviewSnapshot,presentReview,validateReviewHistory} from '../../packages/domain/src/review/states.mjs';
import {A,S,R,snapshot,transition,authority,evidence,event} from './fixtures.mjs';
const clone=structuredClone;
test('seven axes and roles have a closed consistent immutable graph',()=>{
 assert.equal(REVIEW_AXES.length,7);assert.equal(new Set(REVIEW_AXES).size,7);
 for(const r of REVIEW_RULES.axes){assert(r.states.includes(r.initial));assert.equal(new Set(r.states).size,r.states.length);for(const[from,tos]of Object.entries(r.transitions)){assert(r.states.includes(from));for(const to of tos){assert(r.states.includes(to));if(to!=='disputed')assert(r.roles[to].length>0);}}for(const state of r.passing)assert(r.states.includes(state));}
 assert(Object.isFrozen(REVIEW_RULES.axes));assert.throws(()=>{REVIEW_RULES.axes[0].passing.push('verified');});
});
for(const r of REVIEW_RULES.axes){
 for(const from of r.states)for(const to of r.states){
  test(r.id+': '+from+' -> '+to+' only allowed edges or explicit reopen',()=>{
   const value=transition(r.id,from,to),legal=(r.transitions[from]??[]).includes(to);
   if(to==='disputed'){if(legal)assert(validateReviewReopening({axis:r.id,fromState:from,expectedVersion:'0',evidence:evidence(),rationale:'Specific disagreement.'}));else assert.throws(()=>validateReviewReopening({axis:r.id,fromState:from,expectedVersion:'0',evidence:[],rationale:'Dispute'}),ReviewError);assert.throws(()=>validateReviewTransition(value),ReviewError);}
   else if(legal)assert(validateReviewTransition(value));else assert.throws(()=>validateReviewTransition(value),ReviewError);
  });
 }
 for(const target of r.independentStates)test(r.id+' '+target+' rejects every recorded author and incomplete authorship',()=>{
  const from=r.states.find(s=>r.transitions[s]?.includes(target)),v=transition(r.id,from,target),a=authority(r.roles[target][0],r.assignmentKind);if(r.id==='consent')a.consentBasis=target==='documented'?'consent-required':'no-consent-required';
  assert(reviewTransitionAllowed(v,a));for(const author of a.authors)assert.equal(reviewTransitionAllowed(v,{...a,subjectId:author}),false);
  assert.equal(reviewTransitionAllowed(v,{...a,authorshipComplete:false}),false);assert.equal(reviewTransitionAllowed(v,{...a,currentRevision:false}),false);
  if(r.assignmentKind){for(const field of ['scopeCurrent','active'])assert.equal(reviewTransitionAllowed(v,{...a,assignment:{...a.assignment,[field]:false}}),false);assert.equal(reviewTransitionAllowed(v,{...a,assignment:{...a.assignment,reviewer:'other'}}),false);assert.equal(reviewTransitionAllowed(v,{...a,assignment:{...a.assignment,kind:'wrong'}}),false);}
 });
 test(r.id+' partial status never certifies a work or changes another axis',()=>{
  const s=snapshot();s.states[r.id]=r.passing[0];const view=presentReview(s);assert.equal(view.rows.length,7);assert.equal(view.rows.find(x=>x.axis===r.id).state,r.passing[0]);assert.equal(view.wholeWorkVerified,false);assert.equal(view.publicationApproved,false);assert.equal(view.eligibleForReleaseReview,false);assert.equal(view.rows.filter(x=>x.state!==ruleFor(x.axis).initial).length,1);
 });
}
test('untrusted role or authority flags cannot grant review authority',()=>{
 const v=transition(),a=authority();for(const role of ['administrator','editor','contributor','auditor','root'])assert.equal(reviewTransitionAllowed(v,{...a,roles:[role]}),false);
 for(const flag of ['authorshipComplete','currentRevision','publicUseAllowed','otherAxesPassing'])assert.equal(reviewTransitionAllowed(v,{...a,[flag]:'true'}),false);
 assert.equal(reviewTransitionAllowed(v,{...a,roles:['reviewer','unknown']}),false);assert.equal(reviewTransitionAllowed(v,{...a,consentBasis:'unknown'}),false);assert.equal(reviewTransitionAllowed(v,{...a,verified:true}),false);
});
test('consent state never replaces the actual purpose permission',()=>{
 const a=authority('editor',null);assert(reviewTransitionAllowed(transition('consent','in-review','not-required'),a));
 assert.equal(reviewTransitionAllowed(transition('consent','in-review','documented'),a),false);
 assert.equal(reviewTransitionAllowed(transition('consent','in-review','not-required'),{...a,publicUseAllowed:false}),false);
 assert(reviewTransitionAllowed(transition('consent','in-review','documented'),{...a,consentBasis:'consent-required'}));
 assert.equal(reviewTransitionAllowed(transition('consent','in-review','withdrawn'),a),false);assert(reviewTransitionAllowed(transition('consent','in-review','withdrawn'),{...a,publicUseAllowed:false}));
});
test('publication recommendation depends on every dimension and is not publication approval',()=>{
 const a=authority('editor',null),v=transition('publication','in-review','ready-for-release-review');assert(reviewTransitionAllowed(v,a));
 for(const flag of ['otherAxesPassing','publicUseAllowed','currentRevision','authorshipComplete'])assert.equal(reviewTransitionAllowed(v,{...a,[flag]:false}),false);
 const s=snapshot();for(const axis of REVIEW_AXES)s.states[axis]=ruleFor(axis).passing[0];assert(presentReview(s).eligibleForReleaseReview);
 for(const flag of ['publicUseAllowed'])assert.equal(presentReview({...s,[flag]:false}).eligibleForReleaseReview,false);
 assert.equal(presentReview({...s,currentRevision:'3'}).eligibleForReleaseReview,false);assert.equal(presentReview({...s,scope:{...s.scope,authorshipComplete:false}}).eligibleForReleaseReview,false);
 const v1=presentReview(s);assert.equal(v1.wholeWorkVerified,false);assert.equal(v1.publicationApproved,false);assert.equal('score' in v1,false);assert.equal('percentage' in v1,false);
});
for(const label of ['VERIFIED','cleared','Approved','unknown/outdated source state','\n Claimed verified\nby somebody \n'])test('import '+JSON.stringify(label)+' remains verbatim, not a transition',()=>{
 const v={axis:'rights',expectedVersion:'0',namespace:'historical-source',verbatim:label,evidence:evidence()};assert.equal(validateImportedReview(v).verbatim,label);assert.equal('toState' in validateImportedReview(v),false);assert.throws(()=>validateImportedReview({...v,toState:'cleared'}));
});
for(const bad of [0,1,NaN,'01','0','-1','1e1','1.0',' 1','9223372036854775808',null])test('inexact or out-of-range review version '+String(bad)+' rejected',()=>assert.throws(()=>reviewVersion(bad),ReviewError));
test('version zero is explicit; upper bigint remains exact',()=>{assert.equal(reviewVersion('0',{zero:true}),'0');assert.equal(reviewVersion('9223372036854775807'),'9223372036854775807');});
test('evidence is bounded, unique, immutable and exact revision-specific',()=>{
 assert.throws(()=>validateReviewEvidence([...evidence(),...evidence()]));assert.throws(()=>validateReviewEvidence(Array(33).fill(evidence()[0])));assert.throws(()=>validateReviewEvidence([{...evidence()[0],revision:2}]));assert.throws(()=>validateReviewEvidence([{...evidence()[0],role:'editor'}]));const value=validateReviewEvidence(evidence());assert(Object.isFrozen(value[0]));
});
test('positive decisions require evidence and required independent assignment',()=>{assert.throws(()=>validateReviewTransition({...transition(),assignmentId:null}));assert.throws(()=>validateReviewTransition({...transition(),evidence:[]}));});
for(const extra of ['subjectId','role','verified','workspaceId','confidence','published'])test('client authority field '+extra+' rejected',()=>assert.throws(()=>validateReviewTransition({...transition(),[extra]:'injected'})));
test('bad text and prototypes fail without silently normalizing originals',()=>{
 for(const rationale of ['', ' ', 'a'.repeat(2001),'line\nnext','bad\u0000',String.fromCharCode(0xd800)])assert.throws(()=>validateReviewTransition({...transition(),rationale}));
 assert.throws(()=>validateReviewTransition(Object.assign(Object.create({subjectId:'admin'}),transition())));
});
test('snapshot requires exact states, digest scope and never published=true',()=>{
 const s=snapshot();assert(validateReviewSnapshot(s));for(const patch of [{publicationReleased:true},{schemaVersion:2},{currentRevision:2},{publicUseAllowed:'true'},{states:{...s.states,verified:true}}])assert.throws(()=>validateReviewSnapshot({...s,...patch}));
 for(const patch of [{coverage:'whole-work'},{digestProfile:'archival-original-sha256'},{authorshipComplete:'true'},{digest:'x'.repeat(64)}])assert.throws(()=>validateReviewSnapshot({...s,scope:{...s.scope,...patch}}));
 const view=presentReview({...s,currentRevision:'3'});assert.equal(view.current,false);assert.match(view.notice,/earlier revision/);assert(view.rows.every(r=>r.current===false));
});
test('history retains ascending exact sequence, partial page cursor and immutable observations',()=>{
 const a=event('9'),b=event('10'),v={events:[a,b],nextAfter:'10',wholeWorkVerified:false};assert(validateReviewHistory(v));
 for(const patch of [{events:[b,a]},{events:[a,event('11')]},{events:[a,a]},{nextAfter:'9'},{wholeWorkVerified:true}])assert.throws(()=>validateReviewHistory({...v,...patch}));
 const imported={...event(),kind:'import-observation',toState:'unassessed',rationale:null,actor:{subjectId:'editor',role:'editor'},imported:{namespace:'legacy',verbatim:'\nVERIFIED\n'}};
 assert.equal(validateReviewHistory({events:[imported],nextAfter:null,wholeWorkVerified:false}).events[0].imported.verbatim,'\nVERIFIED\n');
 assert.throws(()=>validateReviewHistory({events:[{...imported,toState:'recorded'}],nextAfter:null,wholeWorkVerified:false}));
});
for(const recordedAt of ['2026-02-30T18:00:00.123456Z','2026-10-11','bad',null])test('history rejects malformed timestamp '+recordedAt,()=>assert.throws(()=>validateReviewHistory({events:[{...event(),recordedAt}],nextAfter:null,wholeWorkVerified:false})));
