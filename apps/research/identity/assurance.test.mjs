import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedCredential,sessionAssurance,mayEnrollPasskey,redactAuthPayload,sameAssurance,ASSURANCE_LIFETIME_MS,PRIVILEGED_ACTIONS} from './assurance.mjs';
const now=Date.parse('2026-10-11T12:00:00Z');
const row=()=>({id:'session-one',userId:'subject-one',authenticationMethod:'passkey-uv',assuranceVerifiedAt:new Date(now-1000),expiresAt:new Date(now+10000),createdAt:new Date(now-10000),assuranceCredentialId:'key-one',activeCredentialId:'key-one',credentialUserId:'subject-one'});
test('only an authenticated UV flag and matching verifier credential are accepted',()=>{
 assert.equal(verifiedCredential({verified:true,authenticationInfo:{userVerified:true,credentialID:'key'}},'authentication','key'),'key');
 assert.equal(verifiedCredential({verified:true,registrationInfo:{userVerified:true,credential:{id:'key'}}},'registration','key'),'key');
});
for(const [name,proof,kind,id] of [
 ['unverified assertion',{verified:false,authenticationInfo:{userVerified:true,credentialID:'key'}},'authentication','key'],
 ['no user verification',{verified:true,authenticationInfo:{userVerified:false,credentialID:'key'}},'authentication','key'],
 ['string verification',{verified:'true',authenticationInfo:{userVerified:true,credentialID:'key'}},'authentication','key'],
 ['string UV',{verified:true,authenticationInfo:{userVerified:'true',credentialID:'key'}},'authentication','key'],
 ['different credential',{verified:true,authenticationInfo:{userVerified:true,credentialID:'other'}},'authentication','key'],
 ['no registration UV',{verified:true,registrationInfo:{credential:{id:'key'}}},'registration','key'],
 ['swapped ceremony',{verified:true,registrationInfo:{userVerified:true,credential:{id:'key'}}},'authentication','key'],
 ['unknown ceremony',{verified:true},'other','key'],['missing proof',null,'authentication','key'],
 ['unbounded identifier',{verified:true,authenticationInfo:{userVerified:true,credentialID:'x'.repeat(2049)}},'authentication','x'.repeat(2049)]
])test(name+' cannot establish passkey assurance',()=>assert.throws(()=>verifiedCredential(proof,kind,id)));
test('current bound SQL session and credential admit fresh assurance',()=>assert.equal(sessionAssurance(row(),'subject-one','session-one',now),true));
for(const [name,patch] of [
 ['password',{authenticationMethod:'password'}],['arbitrary method',{authenticationMethod:'mfa'}],
 ['wrong subject',{userId:'subject-two'}],['wrong session',{id:'session-two'}],
 ['deleted passkey',{activeCredentialId:null}],['different passkey',{activeCredentialId:'key-two'}],
 ['other owner',{credentialUserId:'subject-two'}],['empty credential',{assuranceCredentialId:''}],
 ['future proof',{assuranceVerifiedAt:new Date(now+1)}],['expired proof',{assuranceVerifiedAt:new Date(now-ASSURANCE_LIFETIME_MS)}],
 ['expired session',{expiresAt:new Date(now)}],['invalid timestamp',{assuranceVerifiedAt:'not-a-date'}],
 ['untyped timestamp',{assuranceVerifiedAt:now}],['invalid expiry',{expiresAt:{}}]
])test(name+' denies assurance',()=>assert.equal(sessionAssurance({...row(),...patch},'subject-one','session-one',now),false));
test('no row and invalid clock deny',()=>{assert.equal(sessionAssurance(null,'u','s',now),false);assert.equal(sessionAssurance(row(),'subject-one','session-one',NaN),false);});
test('first enrollment needs a fresh password session, not legacy or merely verified email',()=>{
 const r={...row(),authenticationMethod:'password'};
 assert.equal(mayEnrollPasskey(r,'subject-one','session-one',0,now),true);
 assert.equal(mayEnrollPasskey({...r,authenticationMethod:'unverified'},'subject-one','session-one',0,now),false);
 assert.equal(mayEnrollPasskey({...r,createdAt:new Date(now-600000)},'subject-one','session-one',0,now),false);
 assert.equal(mayEnrollPasskey({...r,createdAt:new Date(now+1)},'subject-one','session-one',0,now),false);
});
test('existing factors cannot be replaced using a password-reset login',()=>{
 assert.equal(mayEnrollPasskey({...row(),authenticationMethod:'password'},'subject-one','session-one',1,now),false);
 assert.equal(mayEnrollPasskey(row(),'subject-one','session-one',1,now),true);
 assert.equal(mayEnrollPasskey({...row(),assuranceVerifiedAt:new Date(now-300000)},'subject-one','session-one',1,now),false);
});
for(const count of [-1,1.2,'0',NaN,Infinity])test('invalid factor count '+String(count)+' denies enrollment',()=>assert.equal(mayEnrollPasskey(row(),'subject-one','session-one',count,now),false));
test('authentication responses do not expose bearer tokens or raw assurance inputs',()=>{
 const before={token:'secret',user:{id:'u'},session:{token:'secret',id:'s',ipAddress:'private',userAgent:'private',authenticationMethod:'passkey-uv',assuranceCredentialId:'k',assuranceVerifiedAt:'date'}};
 const actual=redactAuthPayload(before);assert.deepEqual(actual,{user:{id:'u'},session:{id:'s'}});assert.equal(before.token,'secret');assert.equal(before.session.token,'secret');
});
test('assurance comparison binds subject, session, credential and timestamp',()=>{
 const a={id:'u',sessionId:'s',assuranceCredentialId:'k',lastStepUpAt:'t',privilegedAssurance:true};assert.ok(sameAssurance(a,{...a}));
 for(const key of ['id','sessionId','assuranceCredentialId','lastStepUpAt','privilegedAssurance'])assert.equal(sameAssurance(a,{...a,[key]:'wrong'}),false);
 assert.equal(sameAssurance(a,null),false);assert.ok(Object.isFrozen(PRIVILEGED_ACTIONS));
});
test('lifecycle review is a distinct privileged action without a requester or physical-erasure bypass',()=>{
 assert.ok(PRIVILEGED_ACTIONS.includes('lifecycle.administer'));
 assert.ok(PRIVILEGED_ACTIONS.includes('consent.administer'));
 for(const action of ['lifecycle.submit','lifecycle.status','lifecycle.cancel','lifecycle.erase','lifecycle.export','lifecycle.*','consent.administer.lifecycle'])assert.equal(PRIVILEGED_ACTIONS.includes(action),false);
 assert.equal(new Set(PRIVILEGED_ACTIONS).size,PRIVILEGED_ACTIONS.length);
 assert.throws(()=>PRIVILEGED_ACTIONS.push('lifecycle.erase'),TypeError);
});
