'use client';
import {useEffect,useRef} from 'react';
import './security-panel.css';
import {mountSecurityPanel} from '../identity/security-panel.mjs';
/** Unmounted until the research origin and identity service are activated. */
export function SecurityPanel(){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(root.current)return mountSecurityPanel(root.current);},[]);
 return <section aria-label="Account security" className="security-panel"><div ref={root}><h2>Your account security</h2><p>Sign in to manage sessions and verify a passkey. Sensitive actions always require a fresh server check.</p></div></section>;
}
