# Requester lifecycle host boundary

The unmounted requester service in `apps/research/access/lifecycle-requests.mjs`
accepts deletion or export requests for review. It returns the requester's own
receipt. It does not establish ownership or existence of the claimed record,
legal authority, a completed export, stopped delivery, queued removal or erasure.
The pure request contract remains in [lifecycle-requests.md](lifecycle-requests.md).

## Trusted configuration and input

The host fixes one receiving workspace and captures the identity reader and
repository methods at construction. A client command cannot supply a workspace,
requester, role, classification, authority or outcome flag. It is copied through
the pure module's exact-property validator and frozen before the first identity
await. The service owns a copy of the original request headers; repository
methods never receive those credentials. Current identity must include an owned
verified subject and session identifier. A different subject or session during
admission is denied.

The service defaults to disabled. `isIntakeEnabled` controls new submissions;
`isEnabled` controls availability of the service. Closing intake preserves
authenticated status, cancellation and recovery for existing requests. These
paths do not depend on a research membership, research grant, consent policy or
operator passkey. Revoked identity still denies them. Operator review is a
separate privileged action and is not exposed by this requester service.

Availability predicates and the clock are synchronous configuration. Promise or
thenable results are denied; their rejections are observed without awaiting or
admitting them. The clock is checked before mutation admission as well as when a
returned operation is validated. An async configuration error cannot produce an
unhandled private callback error or a knowingly invalid-clock write.

## Fixed repository contract

The injected repository is trusted server code. The fixed PostgreSQL implementation
in `lifecycle-request-repository.mjs` and its additive migration are described in
[the storage boundary](lifecycle-request-storage.md). It is not a user-selectable
adapter or an arbitrary SQL callback. It implements the following four methods:

| Method | Immutable command after trusted principal |
| --- | --- |
| `submit` | `{input: {operationId, requestId, kind, claimedRecordId}, fingerprint}` |
| `status` | `{requestId}` |
| `cancel` | `{input: {operationId, requestId, expectedRevision}, requestFingerprint, fingerprint}` |
| `recover` | `{operationId, fingerprint}` |

Each method receives an owned principal `{workspaceId, subjectId}`, the command,
and an admission callback. The repository must bind that principal to a narrow
transaction context, independently enforce exact operation identity and request
ownership, and commit the operation and its audit evidence atomically. It must
await admission and then call `admission.isAvailable()` synchronously immediately
before issuing COMMIT. The callback verifies current identity and current
service/intake availability. It does not grant any record access or SQL capability.

The repository returns the stored request snapshot only after commit
acknowledgement, role verification, connection cleanup and ticket retirement.
Transactions that fail before commit must roll back. A transport failure at
COMMIT must not be described as proof of rollback. The host validates the stored
snapshot, exact original request or cancellation operation, and current identity
again after the repository returns. It checks availability synchronously after
that final await. Only the limited requester receipt and operation projection
leave the boundary; internal actors, authority evidence, raw errors and database
metadata do not.

A repository returning a pending row for cancellation does not acknowledge a
cancellation. The host requires an exact stored terminal cancellation before
returning that operation's receipt. A concurrent accepted or declined decision
cannot be overwritten. Replaying a submission after a later cancellation returns
the original submission operation separately from the current request state.

## Uncertain write recovery

Once a repository write is attempted, a later exception, invalid response,
identity change or feature closure can leave the caller unable to know whether
it committed. The service raises `lifecycle_request_outcome_unknown` with an
immutable `{operationId, fingerprint}` recovery binding. It never retries the
write automatically. The binding is not a bearer capability, commit proof or
rollback proof. Readback requires current authentication for the original
requester and exact workspace, operation and fingerprint. Wrong or inaccessible
requests fail with the same generic unavailable error.

Cancellation computes its fingerprint from the current owned request before the
write, then pins that original request fingerprint and revision for repository
CAS. Missing or stale requests fail before a cancellation write is attempted.
Any eventual physical deletion or export builder must be integrated separately;
all current receipt projections preserve `effectsVerified: false`.

## Current verification boundary

The host tests use an in-memory transaction fixture with explicit admission and
post-commit cleanup barriers. They cover frozen intent and credentials,
cross-subject/workspace denial, exact retries, intake closure, identity/session
changes, concurrent cancellation/review, sanitized errors and uncertain-write
readback. These tests are not PostgreSQL concurrency, durable audit, ticket
isolation, live identity, hosted API or deletion verification. The fixed database
repository has separate unit tests and a real PostgreSQL CI journey. Exact
observations are recorded under `docs/evidence/GDN-032/`; those additional checks
and hosted identity/privacy acceptance are required before this host can be
mounted or used with actual requests.
