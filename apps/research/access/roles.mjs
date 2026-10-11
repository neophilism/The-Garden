/** Server-side capability vocabulary. A role is never a publication approval. */
const all = ['workspace.enter', 'profile.self', 'training.self'];
const matrix = {
  contributor: [...all, 'source.submit'],
  transcriber: [...all, 'source.submit', 'transcription.edit'],
  translator: [...all, 'source.submit', 'translation.edit'],
  researcher: [...all, 'source.submit', 'claim.draft'],
  reviewer: [...all, 'review.research'],
  editor: [...all, 'source.submit', 'claim.draft', 'task.assign'],
  rights_reviewer: [...all, 'review.rights'],
  community_adviser: [...all, 'review.community'],
  moderator: [...all, 'moderation.act'],
  administrator: [...all, 'membership.manage', 'task.assign']
};
export const ROLE_CAPABILITIES = Object.freeze(Object.fromEntries(
  Object.entries(matrix).map(([key, value]) => [key, Object.freeze(value)])
));
export const TRAINING_TASKS = Object.freeze(['source-integrity', 'consent-and-rights', 'research-conduct']);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SHA256 = /^[0-9a-f]{64}$/;
export function capabilities(membership, now = Date.now()) {
  if (!Number.isFinite(now) || !membership || membership.state !== 'active' || !Array.isArray(membership.roles)) return [];
  const actions = new Set();
  for (const grant of membership.roles) {
    if (!grant || !Object.hasOwn(ROLE_CAPABILITIES, grant.role) || grant.revoked !== false ||
        !Number.isSafeInteger(grant.version) || grant.version < 1 ||
        typeof grant.expiresAt !== 'string' || !Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= now) continue;
    for (const action of ROLE_CAPABILITIES[grant.role]) actions.add(action);
  }
  return [...actions].sort();
}
export function can(membership, action, now = Date.now()) {
  return typeof action === 'string' && capabilities(membership, now).includes(action);
}
export function expertiseClaim(value) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 400 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error('Invalid expertise claim');
  return Object.freeze({statement: value.trim(), status: 'self_reported', verified: false});
}
export function reviewerAssignment({issuer, reviewer, authorId, reviewerId, kind}, now = Date.now()) {
  const action = {research: 'review.research', rights: 'review.rights', community: 'review.community'}[kind];
  if (!action || !can(issuer, 'task.assign', now) || !can(reviewer, action, now) ||
      typeof authorId !== 'string' || !authorId || typeof reviewerId !== 'string' || !reviewerId || authorId === reviewerId) throw new Error('Reviewer assignment denied');
  return Object.freeze({authorId, reviewerId, kind, status: 'assigned', reviewCompleted: false});
}
