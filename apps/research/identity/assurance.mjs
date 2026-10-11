/** Pure, fail-closed policy. A session claim alone is not cryptographic proof.
 * Inputs here must come from the library verifier and current server-side SQL,
 * never from an HTTP body or a previously returned viewer object.
 */
export const ASSURANCE_LIFETIME_MS = 5 * 60 * 1000;
export const ENROLLMENT_FRESHNESS_MS = 10 * 60 * 1000;
export const PRIVILEGED_ACTIONS = Object.freeze([
  'identity.manage', 'membership.administer', 'consent.administer',
  'publication.release', 'rights.clear', 'audit.inspect'
]);
const date = value => value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 2048;
export function verifiedCredential(verification, ceremony, credentialId) {
  const info = ceremony === 'registration' ? verification?.registrationInfo : ceremony === 'authentication' ? verification?.authenticationInfo : null;
  const actual = ceremony === 'registration' ? info?.credential?.id : info?.credentialID;
  if (verification?.verified !== true || info?.userVerified !== true || !identifier(credentialId) || actual !== credentialId) {
    throw new Error('User-verified passkey ceremony required');
  }
  return credentialId;
}
export function sessionAssurance(row, subjectId, sessionId, now = Date.now()) {
  if (!row || !identifier(subjectId) || !identifier(sessionId) || !Number.isSafeInteger(now) ||
      row.userId !== subjectId || row.id !== sessionId || row.authenticationMethod !== 'passkey-uv' ||
      !identifier(row.assuranceCredentialId) || row.activeCredentialId !== row.assuranceCredentialId ||
      row.credentialUserId !== subjectId) return false;
  const verified = date(row.assuranceVerifiedAt), expires = date(row.expiresAt);
  return Number.isFinite(verified) && Number.isFinite(expires) && verified <= now &&
    now - verified < ASSURANCE_LIFETIME_MS && expires > now;
}
export function mayEnrollPasskey(row, subjectId, sessionId, factorCount, now = Date.now()) {
  if (!Number.isSafeInteger(factorCount) || factorCount < 0 || !row || row.userId !== subjectId || row.id !== sessionId) return false;
  if (factorCount > 0) return sessionAssurance(row, subjectId, sessionId, now);
  const created = date(row.createdAt), expiry = date(row.expiresAt);
  return row.authenticationMethod === 'password' && Number.isSafeInteger(now) &&
    Number.isFinite(created) && created <= now && now - created < ENROLLMENT_FRESHNESS_MS && expiry > now;
}
export function sameAssurance(first, second) {
  return first?.privilegedAssurance === true && second?.privilegedAssurance === true &&
    first.id === second.id && first.sessionId === second.sessionId &&
    first.lastStepUpAt === second.lastStepUpAt && first.assuranceCredentialId === second.assuranceCredentialId;
}
/** Returned JSON is not an authority or a transport for bearer credentials. */
export function redactAuthPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const output = {...value};
  delete output.token;
  if (output.session && typeof output.session === 'object') {
    output.session = {...output.session};
    for (const key of ['token', 'ipAddress', 'userAgent', 'authenticationMethod', 'assuranceVerifiedAt', 'assuranceCredentialId']) delete output.session[key];
  }
  return output;
}
