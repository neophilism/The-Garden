import { createHash } from 'node:crypto';

const isSha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const isId = value => Number.isSafeInteger(value) && value > 0;
const stamp = value => typeof value === 'string' ? Date.parse(value) : NaN;
const newest = values => values.reduce((best, value) => !best || value.id > best.id ? value : best, null);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function evidenceDigest(snapshot) {
  return hash(Object.fromEntries(['repository', 'subject', 'github', 'complete', 'checkRuns', 'workflowRuns',
    'sourceEvidence', 'statuses', 'reviews', 'threads', 'rules'].map(key => [key, snapshot[key]])));
}

export function rulesDigest(rules) {
  return hash(Object.fromEntries(['inspection', 'baseSha', 'protected', 'branchProtection', 'rulesets', 'bypassRequired']
    .map(key => [key, rules?.[key]])));
}

/** Read-only assessment of authenticated operator-collected evidence, never a merge executor. */
export function assessMerge(snapshot, policy, now = Date.now()) {
  const reasons = [];
  const deny = (code, detail) => reasons.push({ code, detail });
  const result = () => ({
    schemaVersion: 1,
    repository: policy?.repository ?? null,
    subject: snapshot?.subject ?? null,
    policySha256: createHash('sha256').update(JSON.stringify(policy ?? null)).digest('hex'),
    evaluatedAt: new Date(now).toISOString(),
    eligible: reasons.length === 0,
    decision: reasons.length ? 'not_eligible' : 'eligible_for_guarded_github_request',
    reasons,
    mergePerformed: false,
    serverAcceptanceRequired: true,
  });
  if (!Number.isFinite(now) || !policy || policy.schemaVersion !== 1 ||
      policy.repository !== 'neophilism/The-Garden' || policy.baseRef !== 'main' ||
      !Number.isInteger(policy.maxSnapshotAgeSeconds) || policy.maxSnapshotAgeSeconds < 1 ||
      policy.maxSnapshotAgeSeconds > 300 || !Array.isArray(policy.checks) || !policy.checks.length ||
      policy.checks.some(c => !c?.name || !isId(c.appId) || !/^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(c.workflow)) ||
      new Set(policy.checks.map(c => c.name)).size !== policy.checks.length) {
    throw new Error('Invalid trusted merge policy');
  }
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.repository !== policy.repository) {
    deny('snapshot_invalid', 'Expected the target repository and snapshot schema.'); return result();
  }
  const observed = stamp(snapshot.observedAt);
  if (!Number.isFinite(observed) || observed > now || now - observed > policy.maxSnapshotAgeSeconds * 1000)
    deny('snapshot_stale', 'Collect fresh evidence; future-dated or expired observations are unusable.');
  const subject = snapshot.subject;
  if (!subject || !['pull_request', 'merge_group'].includes(subject.kind) ||
      subject.baseRef !== policy.baseRef || !isSha(subject.headSha) || !isSha(subject.baseSha) ||
      !isSha(subject.testedSha) || (subject.kind === 'pull_request' && !isId(subject.number))) {
    deny('subject_invalid', 'Bind the repository, event, PR, current head, actual base tip and tested revision.'); return result();
  }
  if (subject.kind === 'pull_request' && !equal(subject.testedParents, [subject.baseSha, subject.headSha]))
    deny('merge_source_changed', 'The test merge must have the independently read base tip and PR head as parents.');
  if (subject.kind === 'merge_group' &&
      (subject.headSha !== subject.testedSha || !Array.isArray(subject.testedParents) || !subject.testedParents.includes(subject.baseSha)))
    deny('merge_group_changed', 'Evaluate the current group revision and its actual base, not individual PR checks.');
  const expectedCheckSha = subject.kind === 'pull_request' ? subject.headSha : subject.testedSha;
  const final = snapshot.confirmation;
  if (!final || !Number.isFinite(stamp(final.observedAt)) || stamp(final.observedAt) < observed || stamp(final.observedAt) > now ||
      final.headSha !== subject.headSha || final.baseSha !== subject.baseSha || final.testedSha !== subject.testedSha)
    deny('confirmation_changed', 'A final authenticated read must confirm the same head, current base and tested revision.');
  if (final?.evidenceDigest !== evidenceDigest(snapshot))
    deny('evidence_changed', 'The final read must also confirm unchanged check, workflow, review, thread and rule evidence.');
  for (const state of [snapshot.github, final]) {
    if (!state || state.state !== 'open' || state.draft !== false || state.mergeable !== true || state.mergeableState !== 'clean')
      deny('github_not_ready', 'GitHub must confirm a non-draft open change with clean, computed mergeability.');
  }
  if (!snapshot.complete || ['checks', 'workflows', 'statuses', 'reviews', 'threads', 'rules'].some(key => snapshot.complete[key] !== true))
    deny('collection_incomplete', 'All relevant pages and rule/review sources must be collected.');
  for (const key of ['checkRuns', 'workflowRuns', 'sourceEvidence', 'statuses', 'reviews', 'threads']) {
    if (!Array.isArray(snapshot[key])) { deny('collection_invalid', `Missing ${key} collection.`); return result(); }
  }
  if (snapshot.checkRuns.some(c => !isId(c.id)) || snapshot.workflowRuns.some(r => !isId(r.id) || !isId(r.run_attempt)) ||
      snapshot.statuses.some(s => !isId(s.id)) || snapshot.reviews.some(r => !isId(r.id))) {
    deny('collection_invalid', 'Provider IDs and attempts must be positive safe integers.'); return result();
  }
  for (const key of ['checkRuns', 'workflowRuns', 'statuses', 'reviews']) {
    if (new Set(snapshot[key].map(item => item.id)).size !== snapshot[key].length)
      deny('duplicate_provider_id', `Conflicting or repeated IDs in ${key}.`);
  }
  const selected = new Map();
  for (const required of policy.checks) {
    const run = newest(snapshot.workflowRuns.filter(r => r.path === required.workflow &&
      r.event === subject.kind && r.head_sha === expectedCheckSha));
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
      deny('workflow_not_successful', required.workflow); continue;
    }
    const check = newest(snapshot.checkRuns.filter(c => c.name === required.name && c.app?.id === required.appId &&
      c.head_sha === expectedCheckSha && c.workflow_run_id === run.id));
    if (!check || check.status !== 'completed' || check.conclusion !== 'success' ||
        !Number.isFinite(stamp(check.completed_at)) || stamp(check.completed_at) > now) {
      deny('check_not_successful', required.name); continue;
    }
    selected.set(required.name, check);
    const evidence = snapshot.sourceEvidence.filter(e => e.check_run_id === check.id);
    if (evidence.length !== 1 || evidence[0].workflow_run_id !== run.id ||
        !isId(evidence[0].run_attempt) || evidence[0].run_attempt > run.run_attempt ||
        evidence[0].tested_sha !== subject.testedSha || !equal(evidence[0].parent_shas, subject.testedParents))
      deny('tested_source_unverified', required.name);
  }
  // Do not collapse checks and commit statuses into one namespace. A failed status cannot hide behind a green check.
  const currentStatuses = new Map();
  for (const status of snapshot.statuses) {
    if (status.sha !== expectedCheckSha || typeof status.context !== 'string' || !status.context)
      deny('status_unbound', 'Commit statuses need the queried SHA and context.');
    if (!currentStatuses.has(status.context) || currentStatuses.get(status.context).id < status.id)
      currentStatuses.set(status.context, status);
  }
  for (const status of currentStatuses.values()) if (status.state !== 'success') deny('status_not_successful', status.context);

  const rules = snapshot.rules;
  const protection = rules?.branchProtection;
  const requirements = protection?.required_status_checks;
  if (rules?.inspection !== 'verified' || rules?.baseSha !== subject.baseSha || rules?.protected !== true ||
      !Array.isArray(rules?.rulesets) || rules.rulesets.length !== 0 || !protection || requirements?.strict !== true)
    deny('server_rules_unverified', 'Unattended eligibility requires verified strict branch enforcement; unreadable or unsupported rules remain unknown.');
  if (rules?.bypassRequired !== false) deny('bypass_forbidden', 'No bypass may be needed or requested.');
  if (protection?.enforce_admins?.enabled !== true)
    deny('admin_enforcement_unverified', 'The provider readback must enforce branch restrictions for administrators.');
  if (rules?.digest !== rulesDigest(rules)) deny('rules_digest_invalid', 'Rules evidence must match its recorded digest.');
  const knownProtectionKeys = new Set(['url', 'required_status_checks', 'required_pull_request_reviews', 'restrictions',
    'required_signatures', 'enforce_admins', 'required_linear_history', 'allow_force_pushes', 'allow_deletions',
    'block_creations', 'required_conversation_resolution', 'lock_branch', 'allow_fork_syncing']);
  if (protection && Object.keys(protection).some(key => !knownProtectionKeys.has(key)))
    deny('remote_rule_unsupported', 'An unrecognized classic protection field requires explicit implementation and review.');
  if (protection?.lock_branch?.enabled) deny('branch_locked', 'The target branch is locked.');
  if (protection?.required_signatures?.enabled || protection?.required_linear_history?.enabled ||
      protection?.block_creations?.enabled || protection?.restrictions)
    deny('remote_rule_unsupported', 'Signature, history, creation or actor restrictions require a supported provider proof.');
  if (Array.isArray(requirements?.checks)) {
    const remoteChecks = new Map();
    for (const check of requirements.checks) {
      if (!check || typeof check.context !== 'string' || !check.context || !isId(check.app_id) || remoteChecks.has(check.context)) {
        deny('remote_requirement_unverified', 'Required checks need unique contexts and explicit positive GitHub App IDs.');
        continue;
      }
      remoteChecks.set(check.context, check.app_id);
      const observedCheck = selected.get(check.context);
      if (!observedCheck || check.app_id !== observedCheck.app.id)
        deny('remote_requirement_unverified', check.context);
    }
    // Green local checks do not prove that GitHub requires those checks or their trusted app.
    for (const required of policy.checks)
      if (remoteChecks.get(required.name) !== required.appId) deny('server_policy_incomplete', required.name);
  } else if (protection) deny('remote_requirement_unverified', 'Required check/app bindings were not read.');
  if (!Array.isArray(requirements?.contexts) || requirements.contexts.some(context => typeof context !== 'string' || !context))
    deny('remote_requirement_unverified', 'The provider legacy-context collection must be an array of nonempty names.');
  else for (const context of requirements.contexts)
    if (!selected.has(context) && currentStatuses.get(context)?.state !== 'success') deny('remote_requirement_unverified', context);
  const reviews = new Map();
  for (const review of [...snapshot.reviews].sort((a, b) => a.id - b.id)) {
    if (!review.user?.login || !['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED', 'COMMENTED', 'PENDING'].includes(review.state)) {
      deny('review_invalid', 'Unknown reviewer or review state.'); continue;
    }
    // A comment is not a withdrawal of an earlier request for changes.
    if (!['COMMENTED', 'PENDING'].includes(review.state)) reviews.set(review.user.login, review);
  }
  if ([...reviews.values()].some(r => r.state === 'CHANGES_REQUESTED')) deny('changes_requested', 'Resolve the actual blocking review.');
  const reviewRule = protection?.required_pull_request_reviews;
  if (reviewRule) {
    if (!Number.isInteger(reviewRule.required_approving_review_count) || reviewRule.required_approving_review_count < 0)
      deny('review_rule_invalid', 'Unknown required approval count.');
    const approvals = [...reviews.values()].filter(r => r.state === 'APPROVED' && r.user.login !== snapshot.github?.authorLogin &&
      (!reviewRule.dismiss_stale_reviews || r.commit_id === subject.headSha));
    if (approvals.length < reviewRule.required_approving_review_count) deny('approval_missing', 'Required current approvals are missing.');
    if ((reviewRule.required_approving_review_count > 0 || reviewRule.require_code_owner_reviews || reviewRule.require_last_push_approval) &&
        snapshot.github?.reviewDecision !== 'APPROVED')
      deny('github_review_required', 'GitHub must confirm approval authority and all applicable review requirements.');
  }
  if (['CHANGES_REQUESTED', 'REVIEW_REQUIRED'].includes(snapshot.github?.reviewDecision)) deny('github_review_required', snapshot.github.reviewDecision);
  if (protection?.required_conversation_resolution?.enabled && snapshot.threads.some(t => t.isResolved !== true))
    deny('unresolved_conversation', 'Required review threads must be resolved.');
  if (final?.rulesDigest !== rules?.digest || typeof rules?.digest !== 'string' || !/^[a-f0-9]{64}$/.test(rules.digest))
    deny('rules_changed', 'Final read must bind the same complete rules evidence.');
  return result();
}
