/** Narrow, fail-closed CI and package policy. Not a security certification. */
const actionPins = new Set([
  'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
  'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
  'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'
]);
export function assertWorkflow(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw Error('Workflow object required');
  if (JSON.stringify(doc).match(/secrets\s*[.\[]|pull_request_target|workflow_run/)) throw Error('Privileged event or secret reference forbidden in verification CI');
  const events = typeof doc.on === 'string' ? [doc.on] : Array.isArray(doc.on) ? doc.on : Object.keys(doc.on || {});
  if (!events.length || events.some(e => !['push', 'pull_request', 'merge_group'].includes(e))) throw Error('Unapproved event');
  function readOnly(permissions) {
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) throw Error('Explicit read-only permission map required');
    if (Object.keys(permissions).some(k => k !== 'contents') || permissions.contents !== 'read') throw Error('Verification token must be contents: read only');
  }
  readOnly(doc.permissions);
  if (!doc.jobs || !Object.keys(doc.jobs).length) throw Error('No jobs');
  for (const job of Object.values(doc.jobs)) {
    if (job.permissions !== undefined) readOnly(job.permissions);
    if (job['continue-on-error']) throw Error('Job cannot ignore failure');
    if (!Number.isInteger(job['timeout-minutes']) || job['timeout-minutes'] > 30 || job['timeout-minutes'] < 1) throw Error('Bounded job timeout required');
    if (!Array.isArray(job.steps) || !job.steps.length) throw Error('Executable steps required');
    for (const step of job.steps) {
      if (step['continue-on-error']) throw Error('Step cannot ignore failure');
      if (step.uses && !actionPins.has(step.uses)) throw Error('Action must use a reviewed immutable pin');
      if (step.uses?.startsWith('actions/checkout@') && step.with?.['persist-credentials'] !== false) throw Error('Checkout must not persist credentials');
      if (typeof step.run === 'string' && /\$\{\{[^}]*github\.event\.(?:pull_request\.(?:title|body)|issue|comment)/.test(step.run)) throw Error('Untrusted event input in shell');
      if (typeof step.run === 'string' && /(?:\|\|\s*true|continue-on-error|exit\s+0\b)/.test(step.run)) throw Error('Suppressed failure in verification shell');
    }
  }
}
export function assertLock(lock) {
  if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages['']) throw Error('npm v3 lock required');
  for (const [name, pkg] of Object.entries(lock.packages)) {
    if (!name || !name.includes('node_modules/')) continue;
    if (pkg.link === true) {
      if (!/^(?:apps|packages|services)\/[a-z-]+$/.test(pkg.resolved)) throw Error('Workspace link escapes allowed roots');
      continue;
    }
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version || '')) throw Error('Unpinned resolved version');
    const uri = new URL(pkg.resolved);
    if (uri.protocol !== 'https:' || uri.hostname !== 'registry.npmjs.org' || uri.username || uri.password) throw Error('Untrusted registry or credentials');
    if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.integrity || '')) throw Error('Missing SHA-512 package integrity');
  }
}
export function assertManifests(manifest) {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] || {})) {
      if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) && !/^file:\.\.\/\.\.\/packages\/[a-z-]+$/.test(version)) throw Error('Non-exact dependency: ' + name);
    }
  }
}
export function credentialFindings(text) {
  const patterns = [
    ['database-password', /postgres(?:ql)?:\/\/[^\s:'"/]+:[^\s@'"/]+@/g],
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['provider-token', /\b(?:ghp_|github_pat_|sk_live_|rk_live_)[A-Za-z0-9_]{16,}/g]
  ];
  // Return rule identities, never matched credential bytes.
  return patterns.filter(([, re]) => re.test(text)).map(([rule]) => rule);
}
