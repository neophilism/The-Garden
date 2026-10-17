# GDN-032 requester and retention candidate review — 17 October 2026

This document preserves the original pre-publication review checkpoint below. Later [actual PostgreSQL and CI results](requester-ci-observation.json), [verified PR66 merge](requester-merge-observation.json), and [isolated staging 0014 rollout](requester-staging-observation.json) supersede its pending execution/deployment observations. The [retained dependency component evidence](dependencies-observation.json) is a separate later source-bound check. GDN-032 remains partial and unmounted.

GDN-032 remains a **partial engineering contribution**. The candidate implements a
default-disabled requester host and fixed PostgreSQL repository for pending and
cancelled deletion/export requests, pure request and retention proposals, and the
existing session-assurance policy's `lifecycle.administer` action. No actual
deletion, export, delivery tombstone, removal queue, persisted retention rule or
hold enforcement is provided. All request and proposal receipts retain
`effectsVerified: false`.

## Exact source and evidence boundary

The full local check tested commit `968574abd351af7d645b1021c4cea0a6876c68f4`, tree
`a14f8424a859f2182be15e004dbe8853e93b1356`, based on verified PR65 merge
`bff5048543ee336162ff01e306cf56d3a656e36c`. All 23 candidate source/test/workflow/document hashes
are retained in [tests.json](tests.json) and were compared with both disk and the
exact commit. This evidence-only follow-up does not relabel those observations
as tests of a later evidence commit or as future GitHub results.

The implementing and coordinating agents and separate read-only AI peers reviewed
request ownership, current identity, canonical intent, asynchronous boundaries,
role isolation, ticket transaction binding, immutable history and dry-run policy
semantics. This was AI-assisted source review, not an independent human security
audit, legal determination, E2EESA conformance assessment or certification. External
human review remains deferred under the owner policy in `AGENTS.md`.

## Concrete findings and corrections

| Finding | Correction and observed scope |
| --- | --- |
| An operator review proof bound only the operation identifier, allowing changed decision or evidence before first use. | The pure request decision fingerprint binds the authenticated operator and complete canonical command. Changed target, revision, decision or evidence is a different intent. Local domain regressions pass; this is not a persisted operator grant or accepted-request workflow. |
| Retention command fingerprints omitted the operator, and command-only identity did not pin the complete authority revision. | Rule, hold placement and release fingerprints bind the trusted operator and entire command; operation fingerprints additionally bind the full authority proof. A separate peer reproduced the original actor-substitution issue and verified all three corrected proposal types. The final 29 retention tests are included in the full suite. |
| Async host availability/clock callbacks could escape rejection handling or admit work with an invalid configured clock. | Async configuration always denies; intrinsic Promise observation prevents rejected callbacks from escaping, and invalid clock detection precedes mutation admission. The separate peer reran the corrected 45 host tests. |
| The repository's final awaited recheck left a continuation gap where queued closure could still return status or acknowledge a write. | A synchronous availability fence follows the final awaited cleanup recheck. Actual host plus mocked-pool canaries now deny status and report outcome-unknown after a simulated acknowledged submit commit. No committed write is falsely relabeled rolled back. |
| Cross-realm rejected Promises, overridden catch methods and rejecting thenables from synchronous configuration could produce unhandled rejections. | Intrinsic Promise resolution/observation consumes rejection without awaiting or admitting async configuration. The repository regressions include six rejecting-predicate forms. Independent original canaries now deny with zero unhandled rejections. |
| SQL CHECK branches could rely on nullable predecessor/result fields, and cancellation attempted to qualify a DECLARE-local through the implicit function label. | Predecessor and completed-result arms explicitly require non-null fields. The final cancellation local is `op_fingerprint`, avoiding ambiguous/invalid qualification. These SQL corrections are source-reviewed; their actual PostgreSQL execution remains pending. |

The independent 117-test rerun used the earlier draft SQL hash
`8a275cab75814179f5aee76c5b3a73691682c6f7cf7f3cf5d1f5a0d33b638408`.
The final SQL hash is
`c793c2816ead6ce800d95cc2fde612d3360939b6230d25ba8cc45eadf6cc257c`,
which matches the manifest. Reverting only seven cancellation-local references
and restoring the prior qualification reconstructs the earlier SQL bytes exactly.
This narrow source comparison does not claim that the earlier 117 JavaScript
tests executed either SQL version.

## Reviewed contracts

The [request domain](../../security/lifecycle-requests.md) owns immutable canonical
commands and makes claimed record identity distinct from established authority.
The [requester host](../../security/lifecycle-request-host.md) fixes its receiving
workspace and repository, owns input/header copies, and revalidates the same
verified subject and session through admission and delivery. Closing intake
preserves authenticated own-request status, cancellation and exact recovery.
These requester operations intentionally do not require research membership,
record access, ordinary research consent or an operator passkey. Identity or
service revocation still denies them.

The [storage contract](../../security/lifecycle-request-storage.md) defines six
forced-RLS tables: cases, separately held payloads, events, heads, tickets and
contexts. The issuer and requester capabilities have separate fixed functions
and disjoint runtime pools. A ticket is minted for the actual already-open
requester backend PID and full transaction ID as well as purpose, action, actor,
workspace, case, operation and canonical intent. A rollback or failed retirement
does not make that ticket valid in a later transaction on the same backend.

Operation serialization precedes case serialization. Successful request changes
and semantic audit append occur in one transaction; audit acquisition is last.
Issuer retirement follows COMMIT or ROLLBACK, so it does not wait on a ticket lock
held by its own still-open requester transaction. Final identity and synchronous
availability checks follow cleanup. A failed/lost COMMIT acknowledgement or failed
post-commit cleanup exposes only an exact recovery binding; a fresh authenticated
read must establish the outcome. That binding grants no bearer authority.

Composite predecessor/head foreign keys and snapshot reconstruction bind immutable
request history. A later retained event prevents an older head from being treated
as current. Missing separately held payload denies status, retry and recovery and
cannot be silently recreated. Hashes and opaque references remain private metadata,
not proof of anonymization. Whole-database rollback resistance is not implemented.

The fixed executor keeps its deferred freshness constraint deferred through
COMMIT. An arbitrary SQL caller can change deferrable constraint timing; this is
not claimed as an unconditional last-instant gate against that different threat
model. Current identity, the issuer and the fixed host executor remain trusted.
SQL/JavaScript canonical parity, real lock waits, role grants, expiry, audit
rollback and uncertain commit behavior still require the authored PostgreSQL CI.

The [retention contract](../../security/retention-policy.md) validates explicit
finite authority, scope, evidence and dates without inventing legal periods.
Missing, stale, unresolved, conflicting or incomplete controls/material facts
produce review-required. Expired or overdue holds are not silently released;
release requires a separately authorized exact event. Holds constrain disposal
only and cannot authorize reading, decryption, export or publication or lift a
tombstone. `review-disposal` is an internal proposal, never a purge capability.
These properties rely on independently established current facts at a future
host boundary; shape-valid caller JSON cannot establish completeness or authority.

## Observed verification

| Run | Source scope | Result |
| --- | --- | --- |
| Full `npm run check` | Exact commit `968574a` | **1,717 passed**, zero failures/skips; all four workspace typechecks plus root config, public and research Next16.4 builds passed. |
| Separate identity assurance | Same exact commit | **37 passed**, zero failures/skips. This existing suite includes the lifecycle operator assurance rule and is outside the normal check glob. |
| Earlier requester/audit/role focus | Original draft HEAD `50b9ea7` plus explicitly recorded uncommitted hashes | **375 passed**; no builds or actual PostgreSQL. Those recorded files match the final candidate. |
| Independent requester peer | Original draft HEAD `2a9ebf9` plus recorded hashes, prior SQL version | **117 passed**: 44 repository, 45 host, 28 domain; no actual PostgreSQL. |

These runs overlap; their counts are not distinct coverage totals. Commands,
precise timestamps, environment names, source hashes and raw-log hashes are in
`tests.json`. The full check used only HOME, PATH and the three nonsecret production
build controls. The configuration guard was preserved, and child-process tests
used the authorized escalated executor. Both Next-generated declaration diffs
were inspected and restored; source HEAD/tree were unchanged and the worktree was
clean afterward. Raw logs and private working-session metadata are not copied.

## Pending integration and operational limits

The disposable PostgreSQL18.6 journey has **22 authored assertion groups** in
`apps/research/access/lifecycle-requests.ci.mjs`, explicitly wired into the data
workflow. Its final source hash is
`d76b59bbf3e8a554564f22d81a10d6f5445d71eed938866c30c881a53f9442d5`.
No passing result is claimed yet. All ten required GitHub checks and seven
source-receipt workflows also remain pending for the eventual published head.
The disposable seed/role/teardown journey must never run on retained staging.

Migration0014 is not applied to staging or production. The preceding0013 schema
observation belongs to GDN-026 and does not establish requester deployment. This
capability is unmounted and default-disabled; no hosted workflow, real request,
source record, actual key or provider mutation was used for this contribution.

AC01 (stop delivery and queue removal) and AC03 (restore current deletions and
consent) remain unimplemented. AC02 has a pure validated proposal contract but no
persisted hold/current-grant/material-control integration. No actual export,
retention schedule, erasure, per-record key retirement, backup expiry or public-copy
removal is claimed. The existing totals remain **37 mapped engineering units and
0 production-verified units**; this partial contribution adds no completed unit.
See [acceptance.json](acceptance.json), [deployment.json](deployment.json) and
[live-verification.json](live-verification.json) for the corresponding false and
pending activation flags.
