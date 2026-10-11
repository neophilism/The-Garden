import {createHash, createHmac} from 'node:crypto';
import {UUID, SHA256, TRAINING_TASKS, capabilities, expertiseClaim} from './roles.mjs';
const deny = () => new Error('Membership request denied');
function exactObject(value, allowed) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(key => !allowed.includes(key))) throw deny();
}
function workspace(value) { if (typeof value !== 'string' || !UUID.test(value)) throw deny(); return value.toLowerCase(); }
function digest(value) { if (typeof value !== 'string' || !SHA256.test(value)) throw deny(); return value; }
export function inviteTokenHash(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) || Buffer.from(token, 'base64url').length !== 32 || Buffer.from(token, 'base64url').toString('base64url') !== token) throw deny();
  return createHash('sha256').update(token, 'ascii').digest('hex');
}
export function invitationEmailHash(email, secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32 || new Set(secret).size < 8 || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) throw deny();
  // Match the verified identity provider's case-folding. Never remove dots or +suffixes.
  return createHmac('sha256', secret).update(email.trim().toLowerCase(), 'utf8').digest('hex');
}
/** Trusted dependencies are server-owned. HTTP callers never provide a viewer or role. */
export function createMembershipService({identity, repository, invitationSecret}) {
  if (typeof identity?.viewer !== 'function' || typeof repository?.read !== 'function' || typeof repository?.request !== 'function' || typeof repository?.attest !== 'function' || typeof repository?.accept !== 'function') throw new Error('Missing membership dependencies');
  invitationEmailHash('configuration@example.invalid', invitationSecret);
  async function viewer(headers) {
    const actor = await identity.viewer(headers);
    if (!actor || actor.verified !== true || typeof actor.id !== 'string' || !actor.id || actor.id.length > 128 || typeof actor.email !== 'string') throw deny();
    return actor;
  }
  async function read(actor, id) {
    const membership = await repository.read(id, actor.id);
    if (!membership) return {state: 'not_requested', roles: [], capabilities: [], canPublish: false};
    return {state: membership.state, version: membership.version, roles: membership.roles, training: membership.training,
      expertise: membership.expertise, capabilities: capabilities(membership), canPublish: false};
  }
  return Object.freeze({
    async status(headers, id) { const actor = await viewer(headers); return read(actor, workspace(id)); },
    async request(headers, input) {
      exactObject(input, ['workspaceId', 'policyDigest', 'expertise']);
      const id = workspace(input.workspaceId), policy = digest(input.policyDigest);
      const claim = input.expertise === undefined ? null : expertiseClaim(input.expertise);
      const actor = await viewer(headers);
      await repository.request(id, actor.id, policy, claim?.statement ?? null);
      return read(actor, id);
    },
    async attest(headers, input) {
      exactObject(input, ['workspaceId', 'policyDigest', 'task']);
      const id = workspace(input.workspaceId), policy = digest(input.policyDigest);
      if (!TRAINING_TASKS.includes(input.task)) throw deny();
      const actor = await viewer(headers);
      await repository.attest(id, actor.id, policy, input.task);
      return read(actor, id);
    },
    async accept(headers, input) {
      exactObject(input, ['token', 'policyDigest']);
      const tokenHash = inviteTokenHash(input.token), policy = digest(input.policyDigest);
      const actor = await viewer(headers);
      const id = await repository.accept(actor.id, invitationEmailHash(actor.email, invitationSecret), tokenHash, policy);
      return read(actor, workspace(id));
    }
  });
}
/** Adapter consumes a verified-session service. Intentionally not mounted publicly yet. */
export function createMembershipHandler({service, origin}) {
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.origin !== origin) throw new Error('Invalid membership origin');
  return async request => {
    const reply = (body, status) => Response.json(body, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
    try {
      const url = new URL(request.url);
      if (url.origin !== origin || request.method !== 'POST' || request.headers.get('origin') !== origin ||
          request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || url.search) return reply({error: 'request_denied'}, 403);
      const name = {'/api/research/membership/request':'request','/api/research/membership/attest':'attest','/api/research/membership/accept':'accept'}[url.pathname];
      if (!name) return reply({error: 'request_denied'}, 403);
      const reader = request.body?.getReader();
      if (!reader) return reply({error:'request_denied'}, 403);
      const parts = []; let bytes = 0;
      try { for (;;) { const {done,value}=await reader.read(); if(done) break; bytes+=value.byteLength; if(bytes>4096){await reader.cancel();throw deny();} parts.push(value); } }
      finally { reader.releaseLock(); }
      const body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts.map(x=>Buffer.from(x)),bytes)));
      return reply(await service[name](request.headers, body), 200);
    } catch { return reply({error: 'request_denied'}, 403); }
  };
}
