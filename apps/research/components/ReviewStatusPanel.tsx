import {useId} from 'react';
import {presentReview} from '../../../packages/domain/src/review/states.mjs';
/** Receives an already authorized snapshot. This does not fetch or publish data. */
export function ReviewStatusPanel({snapshot}:{snapshot:unknown}){
 const view=presentReview(snapshot),heading=useId();
 return <section aria-labelledby={heading}><h2 id={heading}>Review of this record revision</h2><p>{view.notice}</p><p>Revision {view.scope.revision}. These findings do not certify the whole collection.</p><dl>{view.rows.map(row=><div key={row.axis}><dt>{row.label}</dt><dd>{row.description}<span> · {row.scope}</span>{!row.current&&<strong> · Earlier revision</strong>}</dd></div>)}</dl><p><strong>{view.eligibleForReleaseReview?'Eligible for a separate release decision.':'Not eligible for a release decision.'}</strong> No publication has been authorized by this panel.</p></section>;
}
