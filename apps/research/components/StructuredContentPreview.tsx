import {useId} from 'react';
import {compileEditorialPreview,type Inline} from '../../../packages/domain/src/editorial/content.mjs';
function RichText({nodes}:{nodes:Inline[]}){
 return <>{nodes.map((n,i)=>n.type==='link'?<a key={i} href={n.href} rel="noreferrer noopener" referrerPolicy="no-referrer">{n.text}</a>:n.type==='strong'?<strong key={i}>{n.text}</strong>:n.type==='emphasis'?<em key={i}>{n.text}</em>:<span key={i}>{n.text}</span>)}</>;
}
/** Already-authorized editorial inputs only. No data fetching or public release. */
export function StructuredContentPreview({page,bundle}:{page:unknown;bundle:unknown}){
 const view=compileEditorialPreview(page,bundle),prefix=useId();
 return <article lang={view.page.language} aria-labelledby={prefix+'-title'} style={{overflowWrap:'anywhere'}}>
  <h1 id={prefix+'-title'}>{view.page.title}</h1>
  <p><strong>Editorial preview</strong> · {view.page.explanationLevel} · Revision {view.page.version}</p>
  <p>This preview does not authorize publication or certify historical accuracy.</p>
  {view.policyVersion&&<p>Proposed policy draft: <strong>{view.policyVersion.label}</strong>. {view.policyVersion.draftDate??'Draft date not recorded'}. This draft is not enacted law.</p>}
  {view.blocks.map(b=>{
   const id=prefix+'-'+b.id;
   switch(b.kind){
    case 'heading':return b.level===2?<h2 key={id} id={id}>{b.text}</h2>:<h3 key={id} id={id}>{b.text}</h3>;
    case 'paragraph':return <div key={id} id={id}>{b.purpose==='advocacy-interpretation'&&<p><strong>Policy advocacy interpretation</strong></p>}<p><RichText nodes={b.content}/></p></div>;
    case 'callout':return <aside key={id} id={id} aria-label={b.title}><p><strong>{b.title}</strong></p><p><RichText nodes={b.content}/></p></aside>;
    case 'definition':return <dl key={id} id={id}><dt><dfn>{b.term}</dfn></dt><dd><RichText nodes={b.content}/></dd></dl>;
    case 'policy-provision':return <section key={id} id={id} aria-label={'Draft provision '+b.value.number}><p><strong>{b.value.number} · {b.value.heading}</strong></p><p>{b.value.text}</p><p>From {b.policyLabel}; provision numbers apply to this version.</p></section>;
    case 'policy-figure':return <section key={id} id={id} aria-label="Draft policy figure"><p><strong>{b.value.display} {b.value.unit}</strong></p><p>{b.value.context}</p><p>From {b.policyLabel}, provision {b.value.provisionId}. This is a draft value, not a guaranteed outcome.</p></section>;
    case 'research-claim':return <section key={id} id={id} aria-label="Versioned research assertion"><p><strong>{b.assertionType==='source-testimony'?'Source testimony':'Historical interpretation'}</strong>{b.attribution?.agentLabel&&' · '+b.attribution.agentLabel}</p><p>{b.wording}</p><p>Claim revision {b.claim.revision}. {b.reviewState==='reviewed'?'Scoped evidence review recorded':b.reviewState==='earlier-revision'?'Review concerns an earlier revision':'Evidence review: '+b.reviewState}. No whole-work verification is implied.</p><ul>{b.evidenceRelations.map(e=><li key={e.id}>Evidence relationship: {e.relation}. Locator {e.locatorId}.</li>)}</ul></section>;
    case 'citation':return <p key={id} id={id}>{b.href?<a href={b.href} rel="noreferrer noopener" referrerPolicy="no-referrer">{b.label}</a>:b.label} · Locator revision {b.locator.revision}</p>;
   }
  })}
 </article>;
}
