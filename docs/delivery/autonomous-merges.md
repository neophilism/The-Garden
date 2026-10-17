# Checked revision merge protocol

GDN-011 provides a read-only merge-evidence evaluator and a source receipt in every required CI job. It does not grant GitHub permissions, edit protection, merge a PR, run an unattended worker, or replace substantive source review. The repository's standing authorization to continue engineering remains in AGENTS.md. Outside human security review is deferred; an actual blocking repository review is still respected.

## Current provider observation

On 17 October 2026, main was `f80a2373aa5825e20aee666eeb1f984a58072fcd`. The branch summary reported `protected: false`, and visible repository rulesets were empty. The detailed branch-protection endpoint returned HTTP 403, `Resource not accessible by integration`; branch-rules inspection was outside the connector's allowed endpoint set. Those are separate observations. No protection was installed or weakened.

The current provider is a user-owned repository. GitHub documents merge queues for organization-owned repositories, so checked-revision sequential merging is the current operational path. Merge-group workflows and fixtures are supported for a future eligible configuration, but no queue is claimed active.

The ten required-policy candidates in `merge-policy.json` were all observed from GitHub Actions app ID 15368. The E2EESA status-record job previously used path filters and lacked `merge_group`; this patch makes it report on every PR, main push and merge group. Record integrity continues to be distinct from product certification.

**Full GDN-011 configuration acceptance is pending.** A local policy cannot establish server enforcement. The evaluator declines affirmative unattended eligibility while strict remote branch protection is absent, unreadable, or unsupported. This does not prohibit the owner-authorized interactive agent from reviewing source, running checks, checking GitHub's current mergeability and making the existing guarded GitHub merge request; it prevents describing that process as fully server-enforced or race-free.

A later read-only capability check on the same date observed main `269f62d8f8c99ec74cdbaec2d04d3303df1eb87f`, again with protection disabled, no visible rulesets and a 403 from the detailed protection endpoint. All ten main-push checks came from app 15368 and all seven workflows succeeded. The 89 currently exposed GitHub tools include no branch-protection/ruleset mutation or generic write request. The fetch tool is GET-only and documents that managed App connections exclude Administration access. The repository's separate `permissions.admin: true` metadata does not resolve either limitation. [The capability observation](../evidence/GDN-011/server-capability-observation-20261017.json) records the scope and endpoints; these main-push results are not a fresh PR merge receipt.

GitHub's [classic protection API](https://docs.github.com/en/rest/branches/branch-protection) requires Administration permission to read or update protection. The documented GET representation has `enforce_admins: { enabled: true }` and app-bound `required_status_checks.checks` entries. A configuration request's bare `enforce_admins: true` is not provider readback. Classic protection is available for public repositories on GitHub Free, so a paid plan is not established as necessary for this repository. Configuring it still needs a supported authorized mutation method and permission; no configuration was attempted here.

The evaluator now verifies that every trusted policy check is actually required by the server with the same positive app ID, and that administrator enforcement is explicitly enabled. Green local checks cannot fill missing server requirements. Empty or partial required-check sets, wildcard/null/missing app bindings, duplicate check contexts and malformed collections produce denial receipts. A legacy `contexts` array may be empty when every app-bound requirement is present; it cannot replace the app bindings. Known extra legacy contexts still require successful evidence, and unsupported extra check/app requirements remain denied. [The component evidence](../evidence/GDN-011/enforcement-completeness.json) preserves the pre-fix failures and the identical test suite passing after the change.

## Operating sequence

1. Run the evaluator and read `merge-policy.json` from an already reviewed, trusted base checkout. Never run candidate PR code with credentials or let a candidate choose its own required tests. Preserve the policy SHA-256 returned in the receipt. Changes to the evaluator or policy need explicit source review against the previous trusted policy.
2. Read the current PR and the target branch independently. Keep head `H`, actual target tip `B`, and GitHub's computed test merge `M` distinct. The PR's `base.sha` alone can be stale. Read the test merge commit and require its two parents to be `[B, H]`. For a merge group, evaluate the current group SHA and actual base/membership, using group checks rather than old PR checks.
3. Collect every relevant page of check runs, workflow runs, commit statuses, reviews, review threads and rules. Read failures, unavailable endpoints and unknown rules as unresolved. The convenience workflow wrapper that only returns PR-triggered first-page runs cannot prove full coverage.
4. Map check-run IDs to the actual workflow run using GitHub's workflow-job/check-run URLs; do not infer a workflow from the check's display name. Keep the latest attempt of each workflow run. The highest provider run ID for the exact workflow/event/source supersedes older executions, even when an old execution finishes later. Within that run, select the newest effective check ID; retained successful jobs from earlier attempts are allowed only within that same successful run and source revision.
5. Read `GARDEN_CI_SOURCE=` from each selected job's authenticated log. `scripts/record_ci_source.py` records the actual checkout and parents, including shallow-checkout parents, with repository, workflow ref, run, attempt and job. Associate it with that exact job/check using GitHub metadata. A receipt printed at job start is not success: the selected check and workflow must subsequently complete successfully. Never copy one job's receipt to another job or infer that head-associated checks tested the current merge revision.
6. Verify strict up-to-date protection, the complete trusted check/app bindings, and `enforce_admins.enabled: true` from provider readback. Preserve all remotely required checks and reviews in addition to Garden's policy. Unknown extra check/app requirements or active rulesets are unsupported by this evaluator and cause denial. Basic classic branch protection, approval counts and resolved conversations are supported. Code-owner and last-push conditions require GitHub's authoritative current review decision. A later comment does not erase a request for changes.
7. Re-read the PR, independent branch tip, merge/group revision, checks, workflows, source evidence, review state and rules. Any changed digest or source invalidates the receipt. Snapshot freshness is capped at five minutes; perform the final read immediately before a mutation. Refresh rather than treating an expired success as authorization.
8. When the reviewed change is eligible, use the normal GitHub merge operation with `expected_head_sha: H`, without bypass. A denial, conflict or head mismatch means re-evaluate. Verify GitHub's `merged` result, merge SHA and resulting main state before updating the project ledger. Merge one PR at a time, then assess the next against the new target tip.

The synchronous merge API's expected head is a head lease, not an atomic base lease. A strict server up-to-date requirement or supported merge queue is needed to close the base-change window. A local reread alone cannot provide that guarantee. No unchecked homemade merge or force update to main is an alternative.

## Snapshot and CLI contract

```sh
node scripts/check-merge-readiness.mjs /absolute/path/merge-snapshot.json
```

The input is bounded to 4 MiB; it contains provider evidence, not credentials. Exit 0 means eligible for a guarded request under this evaluator's supported contract, 1 means an explicit non-eligible receipt, and 2 means malformed input or policy. All outputs have `mergePerformed: false` and `serverAcceptanceRequired: true`. This is an operator tool, not a client-facing authorization API; JSON booleans and digests do not authenticate their origin.

The complete fixture constructor in `tests/runtime/merge-readiness.test.mjs` demonstrates the version-1 schema. Its data is synthetic. Required sections are:

| Field | Required source and meaning |
| --- | --- |
| `schemaVersion`, `repository`, `observedAt` | Version 1, exact repository, UTC collection start |
| `subject` | Kind, PR number where applicable, base ref, independent `headSha`/`baseSha`, actual `testedSha` and ordered `testedParents` |
| `github` | Open/draft/mergeable state; author; authoritative review decision when relevant |
| `complete` | Explicit completed pagination/inspection for checks, workflows, statuses, reviews, threads and rules |
| `workflowRuns` | Actual IDs, paths, events, head SHA, latest attempt, final status/conclusion |
| `checkRuns` | Actual IDs, name, app ID, head SHA, completion state/time, and verified `workflow_run_id` association |
| `sourceEvidence` | Per-check job-log receipt: `check_run_id`, run ID, actual attempt, checkout SHA, ordered parents |
| `statuses` | All current-reference statuses with actual ID, context, state and queried `sha`; the collector adds that queried SHA because individual status payloads may omit it |
| `reviews`, `threads` | Complete authenticated review state and resolved-thread state |
| `rules` | Inspection status, independent base SHA, protected flag, raw classic `branchProtection`, visible `rulesets`, bypass requirement and digest |
| `confirmation` | Final UTC observation, same source/PR state, `rulesDigest` and `evidenceDigest` computed from the final complete reread |

`rulesDigest()` and `evidenceDigest()` are exported helpers. Preserve deterministic collection order between reads. Compute confirmation digests from freshly re-read provider evidence, not simply from the first snapshot. Digests detect changes within the recorded review; they are not signatures or proof of GitHub origin.

## Validation and rollback

The 55 initial adversarial fixtures cover stale heads/bases/merge groups, newer pending or failed reruns, app and event substitution, source receipts, status/check collisions, unknown protection, required reviews, incomplete collection, CLI denials and workflow coverage. New CLI tests run through the ordinary application suite. CI source capture is read-only and contains no token, request body, research value or secret.

Rollback disables use of the evaluator while retaining evidence. Do not remove existing checks or change GitHub protections merely to unblock a failing PR. The added CI receipt can be removed independently if it breaks a provider environment; ordinary checks and truthful merge observations remain required.

## Primary references

- GitHub merge API and `sha` condition: https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
- Queue availability and merge-group workflows: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- Check-run enumeration: https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference
- Commit statuses: https://docs.github.com/en/rest/commits/statuses#get-the-combined-status-for-a-specific-reference
- Current branch observation: https://api.github.com/repos/neophilism/The-Garden/branches/main
- Ruleset observation: https://api.github.com/repos/neophilism/The-Garden/rulesets?includes_parents=true

References and account state were inspected on 17 October 2026. Re-inspect changeable provider behavior before extending this protocol.
