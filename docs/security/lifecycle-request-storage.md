# Durable requester lifecycle storage

The requester repository and migration `0014_lifecycle_requests.sql` persist
deletion or export **requests for review**. The supported database transition is
`pending` revision 1 to `cancelled` revision 2. Intake neither resolves the claimed
record nor establishes authority over it. Every requester receipt retains
`effectsVerified: false`.

This is a partial GDN-032 contribution. Operator acceptance, delivery tombstones,
material inventories, retention-rule and hold persistence, export construction,
and actual removal require subsequent integrations. The pure request and retention
modules model those intentions without establishing their physical effects.

## Identity, purpose and configuration

`createLifecycleRequestRepository` accepts fixed issuer/requester pools, one
receiving workspace, `ci` or `staging`, and a synchronous availability predicate.
It implements the four methods documented in [the requester host contract](lifecycle-request-host.md).
Only the trusted host supplies the authenticated principal and admission callback;
HTTP clients cannot select a database role, workspace, requester or SQL callback.

The host separately controls intake and existing-request access. Closing intake
stops new submissions while preserving authenticated status, cancellation and
exact recovery. These operations do not require researcher membership, ordinary
research consent, record read access or an operator passkey. The receiving
workspace must exist in the exact deployed database binding. Its research-enabled
flag does not control an individual's own request receipts. Revoked identity,
service closure, and repository closure still deny access.

The new `garden_lifecycle_requester` capability is NOLOGIN, NOINHERIT and
non-elevated. A dedicated, non-inheriting runtime login may assume only that
capability. The existing context issuer remains a separate login/pool. The
closed database-role verifier rejects mixed runtime membership or an unexpected
active role. No requester role has raw access to lifecycle tables, research
payloads, encrypted material, audit storage or administrative grants.

## Data and integrity

| Structure | Responsibility |
| --- | --- |
| `lifecycle_request_cases` | Immutable receiving workspace/case identity, original operation and submission fingerprint, opaque requester reference, original time |
| `lifecycle_request_payloads` | Separately held requester link, request kind and claimed record UUID |
| `lifecycle_request_events` | Append-only operation identity, state/revision, predecessor fingerprint, opaque requester reference and succeeded audit sequence |
| `lifecycle_request_heads` | Current event revision and fingerprint, bound by a composite foreign key |
| `lifecycle_request_tickets` | Short-lived, purpose/action/intent-scoped admission already bound to one database backend and transaction |
| `lifecycle_request_contexts` | One redemption, completed result binding and closed state retained through COMMIT |

All six tables enable and force row-level security, with owner-only internal
policies and explicit runtime revocations. Cases/events reject UPDATE, DELETE
and TRUNCATE. The current head must match a retained event, and reconstruction
rejects an older head when a later immutable event remains. Cancellation's
predecessor fields are explicitly non-null and reference the exact original
event. A full rewrite or rollback of the whole database is outside that guarantee.

Operation IDs are globally unique, including across workspaces and requesters.
Fingerprints bind the trusted workspace/actor, complete command, original request
fingerprint and expected revision. SQL constructs the same scalar JSON encoding
as the JavaScript contract; JSONB key order is not used as an operation identity.
Identifiers, bigint revisions, Unicode subject length and millisecond UTC dates
are validated against the domain representation.

Raw requester/claim material is kept outside the immutable event history. A
future separately authorized disposition can remove that material, but this
slice supplies no eraser. Missing payload material fails reconstruction and an
exact retry cannot recreate it. Retained hashes and aliases are private metadata,
not proof of anonymization, complete deletion or safe public release.

## Fixed transaction boundary

1. Copy and validate the command, principal and admission callback, then refresh
   current identity and availability before using either pool.
2. Verify the requester login, open its transaction, assume the narrow role,
   and obtain the actual backend PID and full `xid8` transaction identity.
3. In the separate issuer transaction, mint and commit a ticket bound to that
   PID/transaction, purpose, environment, workspace, actor, action, case, operation
   and complete intent digest. No requester case or audit lock is held yet.
4. Redeem the ticket and execute one fixed submit, status, cancel or recovery
   function. Global operation serialization precedes case serialization. Current
   case/event/head state is checked before the workspace audit head is acquired.
5. For mutation, write the case/payload/event/head and succeeded semantic audit
   together. Refresh identity, role, time and current result binding after the
   database awaits. Close the context while retaining its COMMIT guard.
6. Refresh admission and apply an adjacent synchronous availability fence before
   issuing COMMIT. A deferred constraint checks the current ticket deadline at
   COMMIT for new writes, reads and exact retries alike.
7. Release the requester transaction connection before retiring its ticket using
   the issuer pool. Refresh identity again after cleanup, then apply a final
   synchronous fence immediately after that await before returning the snapshot.

The ticket is prebound to the already-open requester transaction. Rolling back
ticket redemption does not make it valid for a later transaction, even on the
same reused backend and even if retirement fails. The technical ticket lifetime
is an execution deadline, not a legal retention period. Expiry is evaluated with
the current database clock after lock waits and again at COMMIT.

The repository supplies no arbitrary query or savepoint callback. Its fixed SQL
keeps the freshness constraint deferred. A compromised arbitrary-SQL caller can
change deferrable constraint timing; this is not claimed as an unconditional
deadline boundary against that different threat model. The actual identity
reader, purpose issuer and fixed host executor remain trusted components.

Configuration predicates are synchronous. Promise/thenable values are denied,
and their rejections are observed through intrinsic Promise operations without
awaiting or admitting them. A queued closure between an asynchronous recheck and
its caller continuation is caught by the adjacent synchronous return fence.

## Audit, retry and uncertain outcomes

`lifecycle.request.submit` and `lifecycle.request.cancel` are closed semantic
actions with the distinct `lifecycle-request` subject kind. The case UUID is the
subject, while the operation UUID supplies the audit request identity. This
preserves the existing meaning of unrelated `request` audit subjects. The audit
contains opaque actor references, case/revision/operation identifiers and fixed
reason codes; it excludes the raw claimed record, requester link, source payload,
credentials, private hold evidence and provider material.

An audit insertion failure rolls the whole request mutation back. An exact
submission retry returns the original submission identity together with the
current request state, including a later cancellation. Concurrent exact retries
converge; competing cancellations have one winner. Changed intent with a reused
operation, wrong actors, missing cases and inaccessible cases all fail generically.

A failed or lost COMMIT acknowledgement does not prove rollback. The host's
uncertain-outcome error carries only the original operation ID and fingerprint;
it does not automatically retry a mutation. Recovery requires fresh authentication
for the original requester and exact operation binding. It reads the retained
operation and current case in its own newly authorized transaction. The recovery
binding is neither a bearer capability nor evidence that a request committed.

Receipts describe the state observed by their completed transaction. They do not
grant source access or promise that no later cancellation occurred after that
transaction. Current identity and service availability are checked again before
delivery. No implementation can recall a response already released beyond its
final authorization boundary.

## Verification and activation

The focused host/repository suites test strict ownership and serialization,
configuration rejection, transaction ordering, cleanup closure, sanitized errors
and uncertain-result recovery. The independent PostgreSQL journey in
`apps/research/access/lifecycle-requests.ci.mjs` exercises actual migrations,
constraints, lock waits, COMMIT expiry, forced audit failure, concurrent writes,
role isolation, old-head restoration, missing material and exact readback. It
runs only against the disposable loopback PostgreSQL service in the data workflow.
Never run its synthetic seed/role/teardown operations against retained staging.

Use `docs/evidence/GDN-032/` for exact source hashes and observed test outcomes.
A locally checked script is not proof that its PostgreSQL journey passed. This
repository remains default-disabled and unmounted until actual identity,
dedicated pools, deployment binding, durable database behavior and hosted privacy
boundaries are independently verified. No real requests or source records are
processed by the synthetic tests.
