import {useId} from 'react';

const STATES={
 receiving:['Upload in progress','You can pause and return with this upload receipt.'],
 paused:['Upload paused','The received parts are saved. Resume this upload to continue.'],
 'complete-quarantined':['Upload received','The file’s size and checksum match. The source is private and awaiting inspection.'],
 aborted:['Upload cancelled','No source was accepted. Received parts remain private until the retention period ends.'],
 'expired-retained':['Upload expired','This upload can no longer resume. Unaccepted parts remain private until authorized cleanup.'],
 purged:['Upload expired','Abandoned parts have been removed. Start a new upload to send this file.'],
} as const;
function bytes(n:number){return n<1024?`${n} bytes`:`${(n/1024/1024).toLocaleString('en',{maximumFractionDigits:2})} MiB`;}
/** Render only an already-authorized receipt. No fetching, upload controls,
 * provider identifiers or source contents are exposed by this component.
 */
export function UploadReceiptPanel({receipt}:{receipt:unknown}){
 const heading=useId(),hint=useId();
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))throw Error('Invalid upload receipt');
 const r=receipt as Record<string,unknown>;
 const state=r.state as keyof typeof STATES;
 if(!Object.hasOwn(STATES,state)||typeof r.uploadId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.uploadId)||
  typeof r.expectedBytes!=='number'||!Number.isSafeInteger(r.expectedBytes)||r.expectedBytes<1||r.expectedBytes>16*1024**3||
  typeof r.receivedBytes!=='number'||!Number.isSafeInteger(r.receivedBytes)||r.receivedBytes<0||r.receivedBytes>r.expectedBytes||
  typeof r.receivedChunks!=='number'||!Number.isSafeInteger(r.receivedChunks)||r.receivedChunks<0||
  typeof r.totalChunks!=='number'||r.totalChunks!==Math.ceil(r.expectedBytes/(1024*1024))||r.receivedChunks>r.totalChunks||
  r.bytesVerified!==(state==='complete-quarantined')||r.historicalReview!=='unreviewed'||r.rights!=='unreviewed'||
  r.publiclyAccessible!==false||r.publicationApproved!==false||
  (state==='complete-quarantined'&&(r.receivedBytes!==r.expectedBytes||r.receivedChunks!==r.totalChunks))||
  (state==='purged'&&(r.receivedBytes!==0||r.receivedChunks!==0))||
  (r.duplicateOfUploadId!=null&&(state!=='complete-quarantined'||typeof r.duplicateOfUploadId!=='string'||
   !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.duplicateOfUploadId))))throw Error('Invalid upload receipt');
 const [title,notice]=STATES[state];
 return <section aria-labelledby={heading} style={{border:'1px solid #c3d0c7',borderRadius:12,padding:'1.25rem',maxWidth:'38rem',overflowWrap:'anywhere'}}>
  <h2 id={heading}>{title}</h2><p>{notice}</p>
  {state!=='purged'&&<><progress aria-label="Upload bytes received" aria-describedby={hint} max={r.expectedBytes} value={r.receivedBytes} style={{width:'100%'}}/><p id={hint}>{bytes(r.receivedBytes)} of {bytes(r.expectedBytes)} received · {r.receivedChunks} of {r.totalChunks} parts</p></>}
  <p>Receipt <code>{r.uploadId}</code></p>
  {r.duplicateOfUploadId!=null&&<p>These bytes match another upload you submitted in this workspace: <code>{r.duplicateOfUploadId}</code>. This is not a historical verification.</p>}
  <p>Uploading does not establish historical accuracy or permission to publish.</p>
 </section>;
}
