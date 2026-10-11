/** Historical working records. Validation is not historical verification. */
export class HistoricalModelError extends Error {
  constructor() { super('Historical record is invalid or incompatible'); this.code = 'invalid_historical_record'; }
}
export const ENTITY_KINDS = Object.freeze(['person', 'polity', 'people', 'language', 'place', 'port', 'institution', 'voyage', 'event']);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const predicates = Object.freeze({
  located_in: [ENTITY_KINDS.filter(x => x !== 'language'), ['place']],
  used_language: [['person', 'people', 'polity', 'institution'], ['language']],
  member_of: [['person'], ['people', 'polity', 'institution']],
  participated_in: [['person', 'people', 'polity', 'institution'], ['event', 'voyage']],
  departed_from: [['voyage'], ['place', 'port']],
  arrived_at: [['voyage'], ['place', 'port']],
  succeeded_by: [['polity', 'institution'], ['polity', 'institution']],
  related_to: [ENTITY_KINDS, ENTITY_KINDS]
});
export const reject = () => { throw new HistoricalModelError(); };
export function object(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) reject();
}
export function text(value, max, nullable = false) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) reject();
  // Preserve spelling and Unicode exactly, but do not accept malformed strings.
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) { const d = value.charCodeAt(++i); if (!(d >= 0xdc00 && d <= 0xdfff)) reject(); }
    else if (c >= 0xdc00 && c <= 0xdfff) reject();
  }
}
export function uuid(value) { if (typeof value !== 'string' || !UUID.test(value)) reject(); }
export function list(value, max, check) {
  if (!Array.isArray(value) || value.length > max) reject();
  for (let i = 0; i < value.length; i++) { if (!(i in value)) reject(); check(value[i]); }
}
export function provenance(value) {
  list(value, 100, ref => { object(ref, ['sourceId', 'locator']); uuid(ref.sourceId); text(ref.locator, 1000); });
}
export function temporal(value) {
  object(value, ['verbatim', 'earliestYear', 'latestYear', 'calendar']);
  text(value.verbatim, 500, true); text(value.calendar, 80, true);
  for (const n of [value.earliestYear, value.latestYear]) if (n !== null && (!Number.isSafeInteger(n) || n < -999999 || n > 999999)) reject();
  if (value.earliestYear !== null && value.latestYear !== null && value.earliestYear > value.latestYear) reject();
  // Bounds are editorial astronomical-year coordinates, never inferred dates.
  if ((value.earliestYear !== null || value.latestYear !== null) && value.verbatim === null) reject();
}
export function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function bounded(value) {
  try { if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 131072) reject(); } catch { reject(); }
}
export function validateEntity(value) {
  object(value, ['recordType', 'schemaVersion', 'id', 'kind', 'title', 'summary', 'names', 'sourceIdentities', 'temporal', 'redirect']);
  if (value.recordType !== 'entity' || value.schemaVersion !== 1 || !ENTITY_KINDS.includes(value.kind)) reject();
  uuid(value.id); text(value.title, 300, true); text(value.summary, 4000, true); temporal(value.temporal);
  const names = new Set();
  list(value.names, 200, name => {
    object(name, ['id', 'value', 'language', 'script', 'usage', 'provenance']);
    uuid(name.id); if (names.has(name.id)) reject(); names.add(name.id);
    text(name.value, 300); text(name.language, 80, true); text(name.script, 80, true);
    if (!['historical', 'preferred', 'alternate', 'catalogued'].includes(name.usage)) reject();
    provenance(name.provenance);
  });
  const identities = new Set();
  list(value.sourceIdentities, 200, ref => {
    object(ref, ['namespace', 'identifier']); text(ref.namespace, 300); text(ref.identifier, 1000);
    const key = JSON.stringify([ref.namespace, ref.identifier]); if (identities.has(key)) reject(); identities.add(key);
  });
  if (value.redirect !== null) {
    object(value.redirect, ['targetId', 'reason', 'evidence']); uuid(value.redirect.targetId);
    if (value.redirect.targetId === value.id) reject(); text(value.redirect.reason, 2000); provenance(value.redirect.evidence);
    if (!value.redirect.evidence.length) reject();
  }
  bounded(value); return freeze(structuredClone(value));
}
export function validateRelationship(value) {
  object(value, ['recordType', 'schemaVersion', 'id', 'title', 'predicate', 'fromId', 'fromKind', 'toId', 'toKind', 'assessment', 'explanation', 'evidence', 'temporal']);
  if (value.recordType !== 'relationship' || value.schemaVersion !== 1) reject();
  for (const v of [value.id, value.fromId, value.toId]) uuid(v);
  if (new Set([value.id, value.fromId, value.toId]).size !== 3) reject();
  const pair = predicates[value.predicate];
  if (!Object.hasOwn(predicates, value.predicate) || !pair[0].includes(value.fromKind) || !pair[1].includes(value.toKind) || (value.predicate === 'succeeded_by' && value.fromKind !== value.toKind)) reject();
  if (!['unreviewed', 'contested'].includes(value.assessment)) reject();
  text(value.title, 300, true); text(value.explanation, 4000); provenance(value.evidence); temporal(value.temporal);
  bounded(value); return freeze(structuredClone(value));
}
export function validateHistorical(value) {
  if (value?.recordType === 'entity') return validateEntity(value);
  if (value?.recordType === 'relationship') return validateRelationship(value);
  reject();
}
export function mergeEntities(source, target, {reason, evidence}) {
  source = validateEntity(source); target = validateEntity(target);
  if (source.id === target.id || source.kind !== target.kind || source.redirect !== null || target.redirect !== null) reject();
  // Do not collapse names, source identifiers or relationships into a winner.
  return validateEntity({...source, redirect: {targetId: target.id, reason, evidence}});
}
export function unmergeEntity(source) {
  source = validateEntity(source); if (source.redirect === null) reject();
  return validateEntity({...source, redirect: null});
}
export function preserveSourceIdentities(before, after) {
  before = validateEntity(before); after = validateEntity(after);
  if (before.id !== after.id || before.kind !== after.kind) reject();
  const keys = new Set(after.sourceIdentities.map(x => JSON.stringify([x.namespace,x.identifier])));
  if (before.sourceIdentities.some(x => !keys.has(JSON.stringify([x.namespace,x.identifier])))) reject();
  return after;
}
