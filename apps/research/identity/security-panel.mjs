import {createSessionClient} from './session-client.mjs';
/** The host mounts this only inside an independently activated research app.
 * Text is never interpreted as HTML. The same module is exercised by the
 * real-browser, real-PostgreSQL acceptance journey in CI.
 */
export function mountSecurityPanel(root,{client=createSessionClient()}={}){
 const doc=root.ownerDocument,abort=new AbortController();let generation=0,closed=false,busy=false,notice='';
 const el=(name,text)=>{const item=doc.createElement(name);if(text!==undefined)item.textContent=text;return item;};
 const title=el('h2','Your account security');
 const note=el('p','A verified passkey is required for sensitive actions. Password recovery does not replace a passkey or grant permission to publish research.');
 const status=el('p','Checking your session...');status.tabIndex=-1;status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const controls=el('div');controls.className='security-controls';
 const content=el('div');content.className='security-content';
 root.replaceChildren(title,note,status,controls,content);
 function button(text,operation){const item=el('button',text);item.type='button';item.disabled=busy;item.addEventListener('click',()=>run(operation));return item;}
 async function run(operation){
  if(busy||closed)return;busy=true;root.setAttribute('aria-busy','true');
  for(const button of root.querySelectorAll('button'))button.disabled=true;
  try{await operation();if(!closed)notice='Your security settings were updated.';}catch(error){if(!closed)notice=error.name==='NotAllowedError'?'Passkey request cancelled. Your settings were not changed.':error.message;}
  finally{busy=false;root.removeAttribute('aria-busy');await refresh();}
 }
 function render(state,sessionRows,keyRows){
  controls.replaceChildren();content.replaceChildren();
  status.textContent=state.privilegedAssurance?'Passkey verified. Sensitive-action verification expires after five minutes.':'Signed in. Verify a passkey before a sensitive action.';
  if(notice){status.textContent+=' '+notice;notice='';status.focus();}
  controls.append(button('Verify passkey',()=>client.stepUp(abort.signal)),button('Sign out this session',()=>client.signOut(abort.signal)),button('Sign out all devices',()=>client.revokeAll(abort.signal)));
  const label=el('label','Passkey name');const input=el('input');input.id='garden-passkey-name';input.maxLength=80;input.autocomplete='off';label.htmlFor=input.id;
  const add=button('Add passkey',()=>client.enroll(input.value,abort.signal));
  if(!client.supportsPasskeys()){add.disabled=true;controls.firstChild.disabled=true;controls.append(el('p','This browser cannot perform passkey verification. No weaker fallback is enabled.'));}
  const enrollment=el('div');enrollment.append(label,input,add);content.append(enrollment,el('h3','Passkeys'));
  const keys=el('ul');
  for(const row of keyRows.passkeys){const item=el('li');item.append(el('span',row.name||'Unnamed passkey'),doc.createTextNode(' '));const remove=button('Remove '+(row.name||'passkey'),()=>client.remove(row.id,abort.signal));remove.disabled=busy||keyRows.passkeys.length<2||!state.privilegedAssurance;item.append(remove);keys.append(item);}
  content.append(keys,el('p',keyRows.passkeys.length<2?'Keep at least one passkey. Add a second device before removing your last key.':'Removing a passkey also revokes sessions authenticated by that key.'),el('h3','Active sessions'));
  const sessions=el('ul');
  for(const row of sessionRows.sessions){const item=el('li');const stamp=new Date(row.createdAt).toLocaleString();item.append(el('span',(row.current?'This session':'Another session')+' - '+stamp+' - '+row.method),doc.createTextNode(' '),button(row.current?'Revoke this session':'Revoke session',()=>client.revoke(row.id,abort.signal)));sessions.append(item);}
  content.append(sessions);
  if(sessionRows.truncated||keyRows.truncated)content.append(el('p','This view shows at most 100 entries. Sign out all devices to revoke every active session.'));
 }
 async function refresh(){
  const turn=++generation;if(closed)return;
  try{const state=await client.session(abort.signal);const [sessions,keys]=await Promise.all([client.sessions(abort.signal),client.passkeys(abort.signal)]);if(turn!==generation||closed)return;render(state,sessions,keys);}
  catch{if(turn!==generation||closed)return;status.textContent='Signed out or account controls unavailable. Sign in again to manage security.';controls.replaceChildren();content.replaceChildren();}
 }
 const unsubscribe=client.subscribe(()=>{void refresh();});
 const focus=()=>{void refresh();};globalThis.addEventListener?.('focus',focus);
 // Freshness is always server-enforced; this local refresh only corrects display.
 const timer=globalThis.setInterval(()=>{if(doc.visibilityState==='visible')void refresh();},60000);
 void refresh();
 return()=>{closed=true;generation++;abort.abort();unsubscribe();client.dispose();globalThis.removeEventListener?.('focus',focus);globalThis.clearInterval(timer);root.replaceChildren();};
}
