import {randomUUID} from 'node:crypto';
export const unknown=()=>({verbatim:null,earliestYear:null,latestYear:null,calendar:null});
export const evidence=()=>[{sourceId:randomUUID(),locator:'Original folio 3 verso; working locator, not yet verified'}];
export function entity(kind='person',id=randomUUID()) {return {recordType:'entity',schemaVersion:1,id,kind,title:null,summary:null,names:[],sourceIdentities:[],temporal:unknown(),redirect:null};}
export function named(kind='person') {const e=entity(kind);e.names=[{id:randomUUID(),value:'A\u0301mina \u{1d11e}',language:null,script:null,usage:'historical',provenance:evidence()}];e.sourceIdentities=[{namespace:'synthetic-repository',identifier:randomUUID()}];return e;}
export function relationship(fromKind='voyage',toKind='port',predicate='departed_from') {return {recordType:'relationship',schemaVersion:1,id:randomUUID(),title:null,predicate,fromId:randomUUID(),fromKind,toId:randomUUID(),toKind,assessment:'unreviewed',explanation:'Synthetic hypothesis for a fixture, not a historical assertion.',evidence:evidence(),temporal:unknown()};}
