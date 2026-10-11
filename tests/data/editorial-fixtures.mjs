import {initialReviewStates} from '../../packages/domain/src/review/states.mjs';
export const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
export function fixture(){
 const policy={recordType:'policy-version',schemaVersion:1,id:id(1),label:'Synthetic policy draft A',document:{id:id(2),sha256:'a'.repeat(64)},draftDate:'2026-10-11',supersedes:null,
  provisions:[{id:'founding',number:'II.3',heading:'Synthetic founding provision',text:'An illustrative proposed provision.'}],
  figures:[{id:'share',display:'12.5',unit:'percent',provisionId:'founding',context:'Synthetic test value; not a Garden policy figure.'}]};
 const claim={recordType:'claim',schemaVersion:1,id:id(3),assertionType:'historical-interpretation',proposition:{subject:'Synthetic vessel',predicate:'visited',object:'Synthetic harbor'},wording:'A synthetic source describes a harbor visit.',attribution:null,notes:null};
 const locator={recordType:'locator',schemaVersion:1,id:id(4),source:{id:id(5),revision:'2'},resourceSha256:'b'.repeat(64),originalIdentifiers:[],page:null,selector:{type:'whole'},description:null};
 const edge={recordType:'evidence-link',schemaVersion:1,id:id(6),claim:{id:claim.id,revision:'2'},locatorId:locator.id,relation:'supports',rationale:'Synthetic evidence link.'};
 const review={schemaVersion:1,scope:{id:id(7),recordId:claim.id,revision:'2',digest:'c'.repeat(64),digestProfile:'postgres-jsonb-text-sha256',coverage:'exact-record-revision',authorshipComplete:true},version:'2',currentRevision:'2',states:{...initialReviewStates(),'evidentiary-review':'reviewed'},publicUseAllowed:false,publicationReleased:false};
 const page={recordType:'content-page',schemaVersion:1,id:id(8),version:'1',slug:'synthetic-preview',title:'Synthetic editorial page',language:'en',explanationLevel:'overview',policyVersionId:policy.id,
  blocks:[{id:'intro',kind:'paragraph',purpose:'orientation',content:[{type:'text',text:'A synthetic editorial fixture.'}]},
   {id:'mechanism',kind:'heading',level:2,text:'Proposed mechanism'},
   {id:'provision',kind:'policy-provision',policyVersionId:policy.id,referenceId:'founding'},
   {id:'number',kind:'policy-figure',policyVersionId:policy.id,referenceId:'share'},
   {id:'claim',kind:'research-claim',claim:{id:claim.id,revision:'2'},evidence:[{id:edge.id,revision:'2'}],scopeId:review.scope.id},
   {id:'source',kind:'citation',locator:{id:locator.id,revision:'2'},label:'Synthetic source citation',href:'https://example.org/source'},
   {id:'argument',kind:'paragraph',purpose:'advocacy-interpretation',content:[{type:'emphasis',text:'This argument is an interpretation.'}]},
   {id:'terms',kind:'definition',term:'Draft',content:[{type:'text',text:'A proposed text.'}]},
   {id:'uncertain',kind:'callout',tone:'uncertainty',title:'Open question',content:[{type:'link',text:'Research status',href:'/research/'}]}]};
 return {page,bundle:{policyVersion:policy,claims:[{record:claim,revision:'2'}],evidence:[{record:edge,revision:'2'}],locators:[{record:locator,revision:'2'}],reviews:[review]}};
}
