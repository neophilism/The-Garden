import {ROLE_CAPABILITIES} from '../../../apps/research/access/roles.mjs';
export const CLASSES=Object.freeze(['unclassified','research','licensed','personal','sealed','government']);
export const STATES=Object.freeze(['active','quarantined','withdrawn']);
export const GRANTS=Object.freeze(['current','missing','revoked']);
export const PROJECTIONS=Object.freeze(['record','snippet','export','notification','collaboration']);
export const BYTE_KINDS=Object.freeze(['download','media','tile']);
export const SURFACES=Object.freeze([...PROJECTIONS,'search-results','search-count','search-facets',...BYTE_KINDS,'head','audit','worker','ai','index','public-projection']);
export function validateMatrix(registry){
 const same=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 if(registry?.version!==1||!same(registry.roles,Object.keys(ROLE_CAPABILITIES))||!same(registry.classifications,CLASSES)||!same(registry.states,STATES)||!same(registry.grants,GRANTS)||!same(Object.keys(registry.surfaces??{}),SURFACES))throw Error('Incomplete policy matrix');
 for(const name of SURFACES)if(registry.surfaces[name]!==(['ai','index','public-projection'].includes(name)?'disabled-not-implemented':'implemented-unmounted'))throw Error('False surface activation');
 if(!Array.isArray(registry.routes)||registry.routes.some(r=>!Array.isArray(r.methods)||r.methods.length<1||!r.case||!r.test||!r.access)||new Set(registry.routes.map(r=>r.file)).size!==registry.routes.length)throw Error('Invalid route registration');
 return registry;
}
/** Independent expected-outcome model; it does not query implementation policy. */
export function recordVisible({classification,state,grant,memberActive=true,consent=true}){
 if(!CLASSES.includes(classification)||!STATES.includes(state)||!GRANTS.includes(grant)||typeof memberActive!=='boolean'||typeof consent!=='boolean')throw Error('Invalid matrix coordinate');
 return classification==='research'&&state==='active'&&grant==='current'&&memberActive&&consent;
}
export function matrixCases(registry){
 validateMatrix(registry);
 return registry.roles.flatMap(role=>CLASSES.flatMap(classification=>STATES.flatMap(state=>GRANTS.map(grant=>Object.freeze({role,classification,state,grant,visible:recordVisible({classification,state,grant})})))));
}
