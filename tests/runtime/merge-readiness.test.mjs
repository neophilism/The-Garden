import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assessMerge, evidenceDigest, rulesDigest } from '../../tools/delivery/merge-readiness.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const policy = JSON.parse(readFileSync(new URL('../../docs/delivery/merge-policy.json', import.meta.url), 'utf8'));
const now = Date.parse('2026-10-17T12:40:00Z');
const H = '1'.repeat(40), B = '2'.repeat(40), M = '3'.repeat(40), OLD = '4'.repeat(40);

function confirm(s) {
  s.rules.digest = rulesDigest(s.rules);
  s.confirmation = { observedAt: '2026-10-17T12:39:59Z', headSha: s.subject.headSha,
    baseSha: s.subject.baseSha, testedSha: s.subject.testedSha, state: 'open', draft: false,
    mergeable: true, mergeableState: 'clean', rulesDigest: s.rules.digest, evidenceDigest: evidenceDigest(s) };
  return s;
}
function fixture(kind = 'pull_request') {
  const paths = [...new Set(policy.checks.map(c => c.workflow))];
  const subject = { kind, number: 57, baseRef: 'main', headSha: kind === 'pull_request' ? H : M,
    baseSha: B, testedSha: M, testedParents: kind === 'pull_request' ? [B, H] : [B, OLD] };
  const workflowRuns = paths.map((path, i) => ({ id: 100 + i, path, event: kind,
    head_sha: subject.headSha, run_attempt: 1, status: 'completed', conclusion: 'success' }));
  const checkRuns = policy.checks.map((c, i) => ({ id: 1000 + i, name: c.name, app: { id: c.appId },
    head_sha: subject.headSha, workflow_run_id: workflowRuns.find(r => r.path === c.workflow).id,
    status: 'completed', conclusion: 'success', completed_at: '2026-10-17T12:39:00Z' }));
  return confirm({ schemaVersion: 1, repository: policy.repository, observedAt: '2026-10-17T12:39:30Z', subject,
    github: { state: 'open', draft: false, mergeable: true, mergeableState: 'clean', authorLogin: 'author', reviewDecision: null },
    complete: { checks: true, workflows: true, statuses: true, reviews: true, threads: true, rules: true },
    workflowRuns, checkRuns,
    sourceEvidence: checkRuns.map(c => ({ check_run_id: c.id, workflow_run_id: c.workflow_run_id,
      run_attempt: 1, tested_sha: M, parent_shas: subject.testedParents })),
    statuses: [], reviews: [], threads: [],
    rules: { inspection: 'verified', baseSha: B, protected: true, rulesets: [], bypassRequired: false,
      branchProtection: { required_status_checks: { strict: true,
        contexts: policy.checks.map(c => c.name), checks: policy.checks.map(c => ({ context: c.name, app_id: c.appId })) },
        required_pull_request_reviews: null, required_conversation_resolution: { enabled: true } } },
  });
}
const assess = s => assessMerge(s, policy, now);
function denied(s, code) {
  const r = assess(confirm(s));
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some(reason => reason.code === code), JSON.stringify(r.reasons));
}

test('current PR and complete successful source-bound checks qualify only for guarded GitHub request', () => {
  const r = assess(fixture()); assert.equal(r.eligible, true); assert.equal(r.mergePerformed, false);
  assert.equal(r.serverAcceptanceRequired, true); assert.match(r.policySha256, /^[a-f0-9]{64}$/);
});
test('merge-group checks use the exact current group SHA', () => assert.equal(assess(fixture('merge_group')).eligible, true));
test('a rebuilt merge group invalidates older group checks', () => {
  const s = fixture('merge_group'); s.subject.headSha = OLD; denied(s, 'merge_group_changed');
});
test('old head greens never authorize a new head', () => {
  const s = fixture(); s.subject.headSha = OLD; s.subject.testedParents = [B, OLD]; denied(s, 'workflow_not_successful');
});
test('current base comes from independent branch read, not stale PR.base.sha', () => {
  const s = fixture(); s.subject.baseSha = OLD; denied(s, 'merge_source_changed');
});
test('current head with checks from old test-merge source is denied', () => {
  const s = fixture(); s.sourceEvidence[0].tested_sha = OLD; denied(s, 'tested_source_unverified');
});
test('source receipt needs actual test-merge parents', () => {
  const s = fixture(); s.sourceEvidence[0].parent_shas = [OLD, H]; denied(s, 'tested_source_unverified');
});
for (const [mergeable, mergeableState] of [[null, 'unknown'], [false, 'dirty'], [true, 'unstable'], [true, 'blocked'], [true, 'behind']]) {
  test(`GitHub ${mergeable}/${mergeableState} never qualifies`, () => {
    const s = fixture(); Object.assign(s.github, { mergeable, mergeableState }); denied(s, 'github_not_ready');
  });
}
test('draft or closed pull request is denied', () => {
  for (const mutation of [{ draft: true }, { state: 'closed' }]) {
    const s = fixture(); Object.assign(s.github, mutation); denied(s, 'github_not_ready');
  }
});
test('future-dated and old observations are rejected', () => {
  for (const observedAt of ['2026-10-17T12:30:00Z', '2026-10-17T13:30:00Z', 'bad']) {
    const s = fixture(); s.observedAt = observedAt; denied(s, 'snapshot_stale');
  }
});
test('moved head after evaluation invalidates the decision', () => {
  const s = fixture(); s.confirmation.headSha = OLD; assert.ok(assess(s).reasons.some(r => r.code === 'confirmation_changed'));
});
test('changed CI, review, or rule evidence after confirmation invalidates it', () => {
  const s = fixture(); s.reviews.push({ id: 1, user: { login: 'reviewer' }, state: 'COMMENTED', commit_id: H });
  assert.ok(assess(s).reasons.some(r => r.code === 'evidence_changed'));
});
for (const key of ['checks', 'workflows', 'statuses', 'reviews', 'threads', 'rules']) {
  test(`incomplete ${key} pagination is unknown`, () => {
    const s = fixture(); s.complete[key] = false; denied(s, 'collection_incomplete');
  });
}
test('a newer queued, running, failed, or cancelled workflow supersedes old success even if old run finished later', () => {
  for (const [status, conclusion] of [['queued', null], ['in_progress', null], ['completed', 'failure'], ['completed', 'cancelled']]) {
    const s = fixture(); s.workflowRuns.push({ ...s.workflowRuns[0], id: 500, status, conclusion });
    denied(s, 'workflow_not_successful');
  }
});
test('jobs cannot be borrowed from a different successful workflow execution', () => {
  const s = fixture(); s.workflowRuns.push({ ...s.workflowRuns[0], id: 500 }); denied(s, 'check_not_successful');
});
test('effective successful jobs can survive a partial rerun of the same workflow execution', () => {
  const s = fixture(); s.workflowRuns[0].run_attempt = 2;
  assert.equal(assess(confirm(s)).eligible, true);
});
test('newer failed retry of the same named check supersedes old green', () => {
  const s = fixture(); s.checkRuns.push({ ...s.checkRuns[0], id: 2000, conclusion: 'failure' }); denied(s, 'check_not_successful');
});
test('source receipt cannot claim a future run attempt', () => {
  const s = fixture(); s.sourceEvidence[0].run_attempt = 2; denied(s, 'tested_source_unverified');
});
test('same check name from another GitHub App does not qualify', () => {
  const s = fixture(); s.checkRuns[0].app.id = 999; denied(s, 'check_not_successful');
});
test('unrelated workflow dispatch cannot satisfy PR testing', () => {
  const s = fixture(); s.workflowRuns[0].event = 'workflow_dispatch'; denied(s, 'workflow_not_successful');
});
for (const conclusion of ['skipped', 'neutral', 'cancelled', 'failure', 'timed_out', 'action_required', null]) {
  test(`required job ${conclusion} is not substantive success`, () => {
    const s = fixture(); s.checkRuns[0].conclusion = conclusion; denied(s, 'check_not_successful');
  });
}
test('a failed same-name status cannot hide behind successful checks', () => {
  const s = fixture(); s.statuses.push({ id: 1, sha: H, context: policy.checks[0].name, state: 'failure' }); denied(s, 'status_not_successful');
});
test('newest status replaces an older failed status for the same context', () => {
  const s = fixture(); s.statuses.push({ id: 2, sha: H, context: 'external', state: 'success' }, { id: 1, sha: H, context: 'external', state: 'failure' });
  assert.equal(assess(confirm(s)).eligible, true);
});
test('commit statuses must bind the queried SHA', () => {
  const s = fixture(); s.statuses.push({ id: 2, sha: OLD, context: 'external', state: 'success' }); denied(s, 'status_unbound');
});
test('missing or inaccessible remote protection never becomes affirmative unattended eligibility', () => {
  for (const mutation of [{ inspection: 'unavailable' }, { protected: false }, { rulesets: [{}] }]) {
    const s = fixture(); Object.assign(s.rules, mutation); denied(s, 'server_rules_unverified');
  }
});
test('base-change race needs actual server strict-up-to-date enforcement', () => {
  const s = fixture(); s.rules.branchProtection.required_status_checks.strict = false; denied(s, 'server_rules_unverified');
});
test('bypass requests cannot qualify', () => {
  const s = fixture(); s.rules.bypassRequired = true; denied(s, 'bypass_forbidden');
});
test('unknown additional remote check requirements are preserved', () => {
  const s = fixture(); s.rules.branchProtection.required_status_checks.checks.push({ context: 'legal-approval', app_id: 999 });
  denied(s, 'remote_requirement_unverified');
});
test('comment after changes-requested does not erase that review', () => {
  const s = fixture(); s.reviews = [
    { id: 1, user: { login: 'reviewer' }, state: 'CHANGES_REQUESTED', commit_id: H },
    { id: 2, user: { login: 'reviewer' }, state: 'COMMENTED', commit_id: H },
  ]; denied(s, 'changes_requested');
});
test('stale, dismissed and self approvals do not satisfy a fresh-approval requirement', () => {
  for (const [state, login, commit] of [['APPROVED', 'reviewer', OLD], ['DISMISSED', 'reviewer', H], ['APPROVED', 'author', H]]) {
    const s = fixture(); s.rules.branchProtection.required_pull_request_reviews = { required_approving_review_count: 1, dismiss_stale_reviews: true };
    s.reviews.push({ id: 1, user: { login }, state, commit_id: commit }); denied(s, 'approval_missing');
  }
});
test('current reviewer approval satisfies basic remote review count', () => {
  const s = fixture(); s.rules.branchProtection.required_pull_request_reviews = { required_approving_review_count: 1, dismiss_stale_reviews: true };
  s.reviews.push({ id: 1, user: { login: 'reviewer' }, state: 'APPROVED', commit_id: H });
  s.github.reviewDecision = 'APPROVED';
  assert.equal(assess(confirm(s)).eligible, true);
});
test('unverified outsider approval cannot satisfy a required review', () => {
  const s = fixture(); s.rules.branchProtection.required_pull_request_reviews = { required_approving_review_count: 1 };
  s.reviews.push({ id: 1, user: { login: 'outsider' }, state: 'APPROVED', commit_id: H });
  denied(s, 'github_review_required');
});
test('locked target branch cannot qualify', () => {
  const s = fixture(); s.rules.branchProtection.lock_branch = { enabled: true }; denied(s, 'branch_locked');
});
test('unknown and unsupported active classic protection rules cannot be silently ignored', () => {
  for (const mutation of [{ required_signatures: { enabled: true } }, { required_linear_history: { enabled: true } },
    { restrictions: { users: [{ login: 'different-operator' }] } }, { future_policy: { enabled: true } }]) {
    const s = fixture(); Object.assign(s.rules.branchProtection, mutation); denied(s, 'remote_rule_unsupported');
  }
});
test('code-owner or latest-push requirements need GitHub authoritative decision', () => {
  const s = fixture(); s.rules.branchProtection.required_pull_request_reviews = { required_approving_review_count: 0, require_code_owner_reviews: true };
  denied(s, 'github_review_required');
});
test('required unresolved conversations cannot be skipped', () => {
  const s = fixture(); s.threads.push({ isResolved: false }); denied(s, 'unresolved_conversation');
});
test('duplicate provider IDs and contradictory source proofs are rejected', () => {
  const s = fixture(); s.checkRuns.push({ ...s.checkRuns[0] }); denied(s, 'duplicate_provider_id');
  const t = fixture(); t.sourceEvidence.push({ ...t.sourceEvidence[0] }); denied(t, 'tested_source_unverified');
});
test('CLI emits a denial receipt and performs no mutation for incomplete evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'garden-merge-'));
  try {
    const s = fixture(); s.observedAt = new Date().toISOString(); s.rules.inspection = 'unavailable';
    const path = join(dir, 'snapshot.json'); writeFileSync(path, JSON.stringify(s));
    const run = spawnSync(process.execPath, ['scripts/check-merge-readiness.mjs', path], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 1); const receipt = JSON.parse(run.stdout); assert.equal(receipt.eligible, false); assert.equal(receipt.mergePerformed, false);
    writeFileSync(path, '{bad JSON');
    const malformed = spawnSync(process.execPath, ['scripts/check-merge-readiness.mjs', path], { cwd: root, encoding: 'utf8' });
    assert.equal(malformed.status, 2); assert.match(malformed.stderr, /invalid JSON/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('every required workflow has unfiltered PR/merge-group triggers and per-job source receipts', () => {
  for (const workflow of new Set(policy.checks.map(c => c.workflow))) {
    const text = readFileSync(join(root, workflow), 'utf8');
    assert.match(text, /\n  pull_request:\n/); assert.match(text, /\n  merge_group:\n/); assert.doesNotMatch(text, /\n\s+(?:paths|paths-ignore):/);
    assert.equal((text.match(/persist-credentials: false/g) || []).length, (text.match(/run: python3 scripts\/record_ci_source.py/g) || []).length);
  }
});
test('CI source recorder handles shallow checkout parent metadata and rejects mismatched environment SHA', () => {
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }); assert.equal(git.status, 0);
  const sha = git.stdout.trim();
  const run = spawnSync('python3', ['scripts/record_ci_source.py'], { cwd: root, env: { ...process.env, GITHUB_SHA: sha }, encoding: 'utf8' });
  assert.equal(run.status, 0); const r = JSON.parse(run.stdout.trim().replace('GARDEN_CI_SOURCE=', ''));
  assert.equal(r.tested_sha, sha); assert.ok(r.parent_shas.length > 0);
  const bad = spawnSync('python3', ['scripts/record_ci_source.py'], { cwd: root, env: { ...process.env, GITHUB_SHA: OLD }, encoding: 'utf8' });
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /does not match/);
});
