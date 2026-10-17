/** Pure lifecycle request records. This module does not authenticate a caller,
 * resolve a record, establish legal authority, persist a tombstone, remove
 * material, or prepare an export. The host supplies trusted context and time.
 */
import {createHash} from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const REVISION = /^[1-9][0-9]{0,18}$/;
const INSTANT = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const MAX_REVISION = 9223372036854775807n;
const REQUEST_KEYS = ['schemaVersion','requestId','workspaceId','requesterId','kind','claimedRecordId','createdAt','revision','state','submission','resolution'];
const REVIEW_KEYS = ['authorizationId','authorityEvidenceId','validFrom','expiresAt','decisionFingerprint','reviewEvidenceId','reviewBy'];

export class LifecycleRequestError extends Error {
  constructor() {
    super('Lifecycle request unavailable');
    this.name = 'LifecycleRequestError';
    this.code = 'lifecycle_request_unavailable';
  }
}
const fail = () => { throw new LifecycleRequestError(); };

// Inspect own data properties before copying. Accessors, inherited fields,
// symbols, hidden fields and toJSON are not alternate command encodings.
function exact(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) fail();
  const copy = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
    copy[key] = descriptor.value;
  }
  return copy;
}
function uuid(value) { if (typeof value !== 'string' || !UUID.test(value)) fail(); return value; }
function hash(value) { if (typeof value !== 'string' || !HASH.test(value)) fail(); return value; }
function subject(value) {
  if (typeof value !== 'string' || !value.length || value.length > 128 || !value.isWellFormed() || /[\x00-\x20\x7f]/.test(value)) fail();
  return value;
}
function revision(value) {
  if (typeof value !== 'string' || !REVISION.test(value) || BigInt(value) > MAX_REVISION) fail();
  return value;
}
function instant(value) {
  if (typeof value !== 'string' || !INSTANT.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail();
  return Date.parse(value);
}
function clock(now) {
  if (!Number.isSafeInteger(now) || now < 0) fail();
  const value = new Date(now).toISOString();
  instant(value);
  return value;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function principal(value) {
  const p = exact(value, ['workspaceId','subjectId']);
  uuid(p.workspaceId); subject(p.subjectId);
  return p;
}
function submission(value) {
  const p = exact(value, ['operationId','requestId','kind','claimedRecordId']);
  uuid(p.operationId); uuid(p.requestId); uuid(p.claimedRecordId);
  if (!['delete','export'].includes(p.kind)) fail();
  return p;
}
function cancellation(value) {
  const p = exact(value, ['operationId','requestId','expectedRevision']);
  uuid(p.operationId); uuid(p.requestId); revision(p.expectedRevision);
  return p;
}
function decision(value) {
  const p = exact(value, ['operationId','requestId','expectedRevision','decision','reviewEvidenceId','reviewBy']);
  uuid(p.operationId); uuid(p.requestId); revision(p.expectedRevision); uuid(p.reviewEvidenceId); instant(p.reviewBy);
  if (!['accepted','declined'].includes(p.decision)) fail();
  return p;
}
function authority(value, request, input, now) {
  const a = exact(value, ['workspaceId','subjectId','action','requestId','operationId','authorizationId','authorityEvidenceId','validFrom','expiresAt','decisionFingerprint']);
  principal({workspaceId:a.workspaceId, subjectId:a.subjectId});
  for (const key of ['requestId','operationId','authorizationId','authorityEvidenceId']) uuid(a[key]);
  hash(a.decisionFingerprint);
  const start = instant(a.validFrom), end = instant(a.expiresAt);
  if (a.action !== 'lifecycle.administer' || a.requestId !== input.requestId || a.operationId !== input.operationId || start > now || end <= now || start >= end || a.decisionFingerprint !== decisionDigest(a,request,input)) fail();
  return a;
}
function digest(action, value) {
  // Every value here was copied into fixed field order and contains only
  // validated primitives or newly constructed plain objects.
  return createHash('sha256').update('garden-lifecycle-operation-v1\n' + action + '\n' + JSON.stringify(value), 'utf8').digest('hex');
}
function submitDigest(p, input) {
  return digest('submit', {workspaceId:p.workspaceId, subjectId:p.subjectId, operationId:input.operationId,
    requestId:input.requestId, kind:input.kind, claimedRecordId:input.claimedRecordId});
}
function decisionDigest(p, request, input) {
  if (p.workspaceId !== request.workspaceId || input.requestId !== request.requestId) fail();
  return digest('review-intent', {workspaceId:p.workspaceId,subjectId:p.subjectId,
    requestId:request.requestId,requestFingerprint:request.submission.fingerprint,
    operationId:input.operationId,expectedRevision:input.expectedRevision,decision:input.decision,
    reviewEvidenceId:input.reviewEvidenceId,reviewBy:input.reviewBy});
}
function terminalDigest(request, resolution) {
  return digest(resolution.action, {workspaceId:request.workspaceId, subjectId:resolution.subjectId,
    requestId:request.requestId, requestFingerprint:request.submission.fingerprint,
    operationId:resolution.operationId, expectedRevision:resolution.expectedRevision,
    state:resolution.state, review:resolution.review});
}
function boundRequester(p, request) {
  if (p.workspaceId !== request.workspaceId || p.subjectId !== request.requesterId) fail();
}
function checkTime(request, now) {
  const recorded = clock(now);
  if (now < instant(request.createdAt) || (request.resolution && now < instant(request.resolution.recordedAt))) fail();
  return recorded;
}
function snapshot(value) {
  const r = exact(value, REQUEST_KEYS);
  if (r.schemaVersion !== 1) fail();
  uuid(r.requestId); uuid(r.workspaceId); subject(r.requesterId); uuid(r.claimedRecordId);
  if (!['delete','export'].includes(r.kind)) fail();
  const created = instant(r.createdAt);
  revision(r.revision);
  r.submission = exact(r.submission, ['operationId','fingerprint']);
  uuid(r.submission.operationId); hash(r.submission.fingerprint);
  if (r.submission.fingerprint !== submitDigest({workspaceId:r.workspaceId,subjectId:r.requesterId},
    {operationId:r.submission.operationId,requestId:r.requestId,kind:r.kind,claimedRecordId:r.claimedRecordId})) fail();
  if (r.resolution === null) {
    if (r.revision !== '1' || r.state !== 'pending') fail();
    return freeze(r);
  }
  const e = exact(r.resolution, ['action','operationId','fingerprint','subjectId','expectedRevision','state','recordedAt','review']);
  uuid(e.operationId); hash(e.fingerprint); subject(e.subjectId); revision(e.expectedRevision);
  const recorded = instant(e.recordedAt);
  if (r.revision !== '2' || e.expectedRevision !== '1' || r.state !== e.state || recorded < created || e.operationId === r.submission.operationId) fail();
  if (e.action === 'cancel') {
    if (e.state !== 'cancelled' || e.subjectId !== r.requesterId || e.review !== null) fail();
  } else if (e.action === 'review') {
    if (!['accepted','declined'].includes(e.state)) fail();
    e.review = exact(e.review, REVIEW_KEYS);
    for (const key of ['authorizationId','authorityEvidenceId','reviewEvidenceId']) uuid(e.review[key]);
    hash(e.review.decisionFingerprint);
    const start = instant(e.review.validFrom), end = instant(e.review.expiresAt), reviewBy = instant(e.review.reviewBy);
    if (start > recorded || end <= recorded || start >= end || reviewBy <= recorded) fail();
    if (e.review.decisionFingerprint !== decisionDigest({workspaceId:r.workspaceId,subjectId:e.subjectId},r,
      {requestId:r.requestId,operationId:e.operationId,expectedRevision:e.expectedRevision,decision:e.state,
        reviewEvidenceId:e.review.reviewEvidenceId,reviewBy:e.review.reviewBy})) fail();
  } else fail();
  if (e.fingerprint !== terminalDigest(r, e)) fail();
  r.resolution = e;
  return freeze(r);
}
function operationReceipt(request, resolution = null) {
  return freeze({operationId:resolution?.operationId ?? request.submission.operationId,
    fingerprint:resolution?.fingerprint ?? request.submission.fingerprint,
    requestId:request.requestId, revision:resolution ? '2' : '1', state:resolution?.state ?? 'pending',
    recordedAt:resolution?.recordedAt ?? request.createdAt, effectsVerified:false});
}
function result(request, resolution, replayed) {
  return freeze({request, operation:operationReceipt(request, resolution), replayed});
}
function finish(request, resolution) {
  if (request.state !== 'pending' || request.revision !== resolution.expectedRevision || resolution.operationId === request.submission.operationId) fail();
  return snapshot({...request, revision:'2', state:resolution.state, resolution});
}

/** Validate and take an owned immutable snapshot. Fingerprints detect structural
 * drift; they are not signatures or protection against a rewritten whole log.
 */
export function validateLifecycleRequest(value) {
  try { return snapshot(value); } catch { fail(); }
}

/** Snapshot client intent before the host's first asynchronous identity call. */
export function validateLifecycleSubmission(value) {
  try { return freeze(submission(value)); } catch { fail(); }
}
export function validateLifecycleCancellation(value) {
  try { return freeze(cancellation(value)); } catch { fail(); }
}
export function validateLifecycleDecision(value) {
  try { return freeze(decision(value)); } catch { fail(); }
}

/** Submission intent includes the server-established principal. A valid UUID
 * remains an unverified claim; this function performs no record lookup.
 */
export function lifecycleRequestFingerprint(context, input) {
  try { return submitDigest(principal(context), submission(input)); } catch { fail(); }
}

/** The trusted authorizer approves this exact reviewed intent before issuing
 * its scoped proof. Computing a digest does not itself grant permission.
 */
export function lifecycleDecisionFingerprint(context, current, input) {
  try { return decisionDigest(principal(context),snapshot(current),decision(input)); } catch { fail(); }
}

export function submitLifecycleRequest(context, input, now, previous = null) {
  try {
    const p = principal(context), command = submission(input), recordedAt = clock(now);
    const fingerprint = submitDigest(p, command);
    if (previous !== null) {
      const request = snapshot(previous);
      boundRequester(p, request); checkTime(request, now);
      if (request.requestId !== command.requestId || request.submission.operationId !== command.operationId || request.submission.fingerprint !== fingerprint) fail();
      return result(request, null, true);
    }
    const request = snapshot({schemaVersion:1,requestId:command.requestId,workspaceId:p.workspaceId,
      requesterId:p.subjectId,kind:command.kind,claimedRecordId:command.claimedRecordId,createdAt:recordedAt,
      revision:'1',state:'pending',submission:{operationId:command.operationId,fingerprint},resolution:null});
    return result(request, null, false);
  } catch { fail(); }
}

export function cancelLifecycleRequest(context, current, input, now) {
  try {
    const p = principal(context), request = snapshot(current), command = cancellation(input);
    boundRequester(p, request);
    const recordedAt = checkTime(request, now);
    if (request.requestId !== command.requestId) fail();
    const resolution = {action:'cancel',operationId:command.operationId,fingerprint:'',subjectId:p.subjectId,
      expectedRevision:command.expectedRevision,state:'cancelled',recordedAt,review:null};
    resolution.fingerprint = terminalDigest(request, resolution);
    if (request.resolution?.operationId === command.operationId) {
      if (request.resolution.fingerprint !== resolution.fingerprint) fail();
      return result(request, request.resolution, true);
    }
    const next = finish(request, resolution);
    return result(next, next.resolution, false);
  } catch { fail(); }
}

/** Authority is already independently verified by trusted host code. These
 * checks enforce its exact action/request/operation/workspace/time scope, not
 * a real-world signer's legal capacity or existence of the claimed record.
 */
export function decideLifecycleRequest(trustedAuthority, current, input, now) {
  try {
    const request = snapshot(current), command = decision(input);
    const recordedAt = checkTime(request, now), a = authority(trustedAuthority, request, command, now);
    if (a.workspaceId !== request.workspaceId || command.requestId !== request.requestId || instant(command.reviewBy) <= now) fail();
    const resolution = {action:'review',operationId:command.operationId,fingerprint:'',subjectId:a.subjectId,
      expectedRevision:command.expectedRevision,state:command.decision,recordedAt,
      review:{authorizationId:a.authorizationId,authorityEvidenceId:a.authorityEvidenceId,validFrom:a.validFrom,
        expiresAt:a.expiresAt,decisionFingerprint:a.decisionFingerprint,reviewEvidenceId:command.reviewEvidenceId,reviewBy:command.reviewBy}};
    resolution.fingerprint = terminalDigest(request, resolution);
    if (request.resolution?.operationId === command.operationId) {
      if (request.resolution.fingerprint !== resolution.fingerprint) fail();
      return result(request, request.resolution, true);
    }
    const next = finish(request, resolution);
    return result(next, next.resolution, false);
  } catch { fail(); }
}

/** Requester-only projection, deliberately independent of research membership,
 * consent or intake settings. The caller still must authenticate afresh.
 */
export function lifecycleRequestReceipt(context, current) {
  try {
    const p = principal(context), request = snapshot(current);
    boundRequester(p, request);
    return freeze({schemaVersion:1,requestId:request.requestId,kind:request.kind,
      claimedRecordId:request.claimedRecordId,targetKind:'claimed-record-reference',
      revision:request.revision,state:request.state,submittedAt:request.createdAt,
      updatedAt:request.resolution?.recordedAt ?? request.createdAt,effectsVerified:false});
  } catch { fail(); }
}
