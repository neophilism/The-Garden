# Lifecycle request domain contracts

This is the independent pure-domain part of GDN-032. It defines request intent,
review proposals, canonical operation fingerprints and a private receipt. It
does not mount a feature, authenticate a person, query a record, verify legal
authority, persist a decision or tombstone, erase material, prepare an export,
or satisfy GDN-032's database/deployment acceptance criteria.

## Trust and scope

The host supplies a freshly authenticated `{workspaceId, subjectId}` principal.
The workspace is the receiving workspace configured by that host. Neither field
comes from an HTTP request's claimed actor or authority. Shape validation is not
authentication. No research membership, consent, or collection flag is accepted
by the pure module: own receipt and cancellation access must not depend on those
permissions. Host authentication and account revocation remain necessary.

A submission contains `operationId`, `requestId`, `kind` (`delete` or `export`)
and `claimedRecordId`. A valid UUID is an opaque claim. It establishes neither
record existence nor custody, represented-person identity, or legal authority.
The module performs no target lookup. A future receiver must not disclose source
existence through intake or let a pending request mutate the source.

## API

All functions are synchronous and perform no external I/O. Returned objects are
owned immutable snapshots; exceptions expose only `lifecycle_request_unavailable`.

| Function | Result and requirement |
|---|---|
| `validateLifecycleSubmission(input)` | Owned immutable submission command, for snapshotting before identity awaits. |
| `validateLifecycleCancellation(input)` | Owned immutable cancellation command. |
| `validateLifecycleDecision(input)` | Owned immutable decision command; live authority/time are checked when applying it. |
| `lifecycleRequestFingerprint(principal, input)` | Canonical submission-intent digest, including trusted workspace and actor. |
| `lifecycleDecisionFingerprint(operator, current, input)` | Exact reviewed-intent digest to approve before issuing a scoped authority proof. |
| `submitLifecycleRequest(principal, input, now, previous = null)` | Proposed pending request or exact submission replay. |
| `cancelLifecycleRequest(principal, current, input, now)` | Proposed cancellation of the requester's current pending request. |
| `decideLifecycleRequest(authority, current, input, now)` | Proposed accepted/declined review under exact trusted authority scope. |
| `validateLifecycleRequest(snapshot)` | Checks closed structure, history consistency and canonical intent fingerprints. |
| `lifecycleRequestReceipt(principal, current)` | Minimal current status for that request's original requester. |

`now` is an explicit nonnegative integer Unix time in milliseconds, supplied by
the server. Stored instants use exact millisecond UTC ISO strings with four-digit
years. Revisions are canonical positive decimal strings bounded to signed bigint.
This two-stage request model uses revision `1` while pending and `2` after its
single terminal transition.

Cancellation input is `{operationId, requestId, expectedRevision}`. Review input
adds `decision`, `reviewEvidenceId` and an explicit future `reviewBy` date. Review
authority is a separate trusted object with exactly `workspaceId`, `subjectId`,
`action: "lifecycle.administer"`, `requestId`, `operationId`, `authorizationId`,
`authorityEvidenceId`, `validFrom`, `expiresAt` and `decisionFingerprint`. Its
interval must contain the operation time. The fingerprint binds the exact reviewed
command: operator, workspace, immutable request fingerprint, operation/request IDs,
expected revision, accepted/declined decision, evidence and review date. A proof
for declining one request cannot authorize accepting or changing its evidence
before persistence. The host must independently verify action-specific, scoped
authority and current step-up; a record owner or a submitted evidence UUID is not
that proof. No default legal period, retention rule, hold, preservation exception
or purge permission is introduced here.

## Transitions and retries

Pending requests can become `cancelled`, `declined` or `accepted`. All three are
terminal in this request record. Cancellation cannot reverse an accepted deletion
or imply that an existing tombstone should be removed. A later change of intent
requires a separately authorized operation outside this terminal request; this
module provides no resurrection path.

Mutating functions return `{request, operation, replayed}`. `request` is a proposed
domain snapshot, not a committed database result. `operation` is the stable
original operation receipt. An exact submission replay after a review therefore
returns the original pending submission receipt alongside the supplied current
request state; `lifecycleRequestReceipt` returns that current state. Reusing a
request or operation with different actor, workspace, intent, evidence, decision,
or expected revision rejects. Original event times are retained on exact replay.

Review fingerprints bind the full scoped authority reference and its validity
interval. An exact review replay is admitted only while that original authority
and supplied review date remain current. Renewing authority changes the operation
fingerprint; it is not a way to replay the same decision ID. Recovery after proof
expiry must use a separately authenticated durable operation readback in the
future host. Historical requester receipts remain readable after review authority
expires. This module does not implement database recovery/readback.

The host must atomically enforce current revision and global operation uniqueness.
Two pure evaluations of the same old snapshot can each propose a different valid
transition; they are not a concurrency lock. The database must choose one winner
and reject the other's stale revision. Per-request fingerprints do not prevent
global operation-ID reuse without that persistence constraint.

## Serialization and privacy

Inputs require exact enumerable own data properties on ordinary objects. Symbols,
hidden properties, getters/setters, inherited shapes, `toJSON`, unsupported kinds,
noncanonical identifiers and extra authority/completion flags reject. Validated
primitives are copied in fixed field order before hashing; output never retains
the caller's mutable objects.

Digests are SHA-256 of `garden-lifecycle-operation-v1`, a newline, the fixed action,
a newline, and the canonical JSON object. Submission binds workspace, actor,
operation, request, kind and claim. Terminal operations also bind the original
submission fingerprint and expected revision; review binds the supplied evidence
and scoped authority. These are deterministic intent fingerprints, not signatures,
an independent audit anchor, or protection against an entirely rewritten history.

Requester receipts contain only request ID, kind, claimed record reference, fixed
`targetKind: "claimed-record-reference"`, revision, state and event dates. They
always include `effectsVerified: false`. They contain no requester/operator IDs,
authority or review evidence, raw audit events, storage paths, source text, hold
details, or other people's data. Operational hashes and internal snapshots remain
private metadata; they are not anonymous or suitable for public analytics.

Acceptance is a request decision. Neither operation nor requester receipt asserts
`committed`, `deliveryStopped`, `removalQueued`, erasure, export readiness or export
fulfillment. The later host must establish actual target and authority, then commit
an accepted deletion with its tombstone, delivery denial, removal queue and audit
atomically. It must report verified physical outcomes separately. Holds can block
physical purge without authorizing reads; no material eraser is supplied here.

## Verification

Run `node --test tests/security/lifecycle-requests.test.mjs`. Tests exercise
cross-requester/workspace denial, independent canonical encoding, strict immutable
serialization, state and revision conflicts, cancellation versus acceptance,
exact versus changed replay, expired review admission with retained own receipts,
and absence of target-existence, legal-authority and fulfillment assertions.
There is no database, provider, browser or live-deployment claim in these tests.
