# Durable retention rules and scoped holds

Migration `0015_lifecycle_controls.sql` and the unmounted lifecycle-control host
persist independently authorized retention rules, hold placements and explicit
hold releases. They add an auditable, revisioned control record. A receipt always
has `effectsVerified: false`: it does not accept a requester case, stop delivery,
create an export, enumerate encrypted material, remove a copy or erase a key.
GDN-032's integrated lifecycle acceptance remains incomplete.

The [pure retention contract](retention-policy.md) defines the exact commands,
historical proofs and review semantics. This storage bridge enforces current
authority, durable revisions, operation uniqueness and transactional audit for
those commands. It does not run the pure disposition evaluator or interpret its
result as permission to remove anything.

## Supported authority and target

The trusted host fixes a workspace and derives the operator solely from the
current authenticated identity. Every operation requires fresh, user-verified
passkey assurance for `lifecycle.administer`, including private status and
recovery. The repository then independently resolves and locks the real record.
The supported target is an **active research record at its current numeric
revision**, represented by this exact scope:

```json
{
  "workspaceId": "<UUID>",
  "recordId": "<UUID>",
  "recordRevision": "<positive decimal bigint>",
  "classification": "restricted_research"
}
```

Active research membership and terms, an exact record-read grant, an applicable
research role and current research-purpose consent are additional prerequisites.
A research write grant is not required. An ownership field, claimant-supplied
UUID, membership, consent, fresh passkey or evidence identifier alone cannot
establish independent lifecycle authority.

Each write needs a current, separately maintained grant for exactly one action:
`lifecycle.retention-rule`, `lifecycle.hold-place` or
`lifecycle.hold-release`. Status and recovery require the distinct
`lifecycle.inspect` grant over the exact scope. A placement grant does not imply
release authority or generic inspection of another operator's controls.

Unknown classifications, nonactive state, an old source revision, withdrawn
consent or lost research access deny all these operations generically. Stored
rules and holds remain retained; denial never releases a hold or makes disposal
permissible. This is a deliberately bounded bridge. Administration after research
withdrawal needs a future, explicitly authorized metadata-only lifecycle path.
The requester intake/status/cancellation path remains separate and keeps its
[independent purpose](lifecycle-request-storage.md).

## Establishing durable authority

No authority or identity is seeded by the migration. Two owner-only maintenance
functions append evidence and operator-grant revisions:

| Function | Exact JSON fields |
| --- | --- |
| `record_lifecycle_evidence(jsonb, text)` | `operationId`, `evidenceId`, `revision`, `expectedFingerprint`, `scope`, `action`, `authorityKind`, `authorityReference`, `reviewerReference`, `validFrom`, `expiresAt`, `reviewBy`, `state` |
| `record_lifecycle_operator_grant(jsonb, text)` | `operationId`, `grantId`, `revision`, `expectedFingerprint`, `scope`, `subjectId`, `action`, `evidenceId`, `evidenceRevision`, `validFrom`, `expiresAt`, `reviewBy`, `state` |

The text argument is the maintenance boundary's actor attribution; it is not an
identity verifier. These functions have no runtime EXECUTE grant. The trusted
maintenance operator must establish the appointment, legal review or preservation
review and its cited evidence before recording it. Syntactically valid UUIDs and
an audit entry do not prove that the underlying authority exists.

Evidence uses `policy-appointment`, `legal-review` or `preservation-review` and
state `verified` or `revoked`. Grants use state `active` or `revoked`. Revision 1
has a null predecessor fingerprint; each subsequent revision must match the
current predecessor revision and fingerprint. Revocation is a new immutable
revision. An immutable grant revision pins an exact evidence ID **and revision**;
moving or revoking that evidence head does not silently update the old grant.

Scope metadata in these maintenance records is an assertion, so it has no foreign
key that would imply an already verified source record. Runtime admission always
resolves the real record through the current research boundary. The resulting
control event references the exact retained source revision.

Dates are supplied explicitly. No legal retention period, jurisdictional rule,
reviewer qualification or indefinite exception is invented. The durable proof's
validity is the intersection of the selected grant and evidence validity/review
windows. It is separate from the short transaction ticket and the five-minute
passkey-assurance lifetime. Each command uses its own `authorizationId`, equal to
its operation UUID; the immutable operation separately pins `grantId` and
`grantRevision`. Reusing one grant for several operations therefore does not
conflate their historical authorization records.

## Fixed host and storage protocol

`createLifecycleControlService` takes `identity`, `repository`, `workspaceId`,
synchronous `isEnabled`, synchronous `isAdministrationEnabled` and a trusted
clock. Both availability flags default to false. Closing administration denies
writes while existing inspection can remain available under its independent
current authority. Closing the service or repository denies every operation.

| Service method | Exact input after headers |
| --- | --- |
| `putRule` | `{command, expectedControlRevision, expectedFingerprint}` |
| `placeHold` | `{command, expectedControlRevision}` |
| `releaseHold` | `{scope, command, expectedControlRevision}` |
| `status` | `{scope}` |
| `recover` | `{scope, operationId, fingerprint}` |

Commands use the pure contract's explicit operation ID, control ID, revision,
evidence and dates. A scope's `expectedControlRevision` is a decimal string and
starts at `"0"`. Rule updates additionally bind the current record fingerprint;
release binds the entire original placement and expected hold revision. The
host owns and freezes commands, copies headers, and captures callable methods
before its first identity await. Accessors, proxies, inherited or hidden fields, symbols,
`toJSON`, sparse arrays and noncanonical encodings reject. Async configuration
values are denied and their rejections observed without admitting or awaiting
them as configuration.

`createLifecycleControlRepository` takes two disjoint pools, `issuerPool` and
`adminPool`, one workspace, `ci` or `staging`, and a synchronous availability
predicate. Its fixed methods are `prepare`, `commit`, `status` and `recover`.
Only the host supplies the immutable `{workspaceId, subjectId}` principal and
current admission callback. No headers, credentials, SQL fragments or arbitrary
transaction callbacks are accepted by the repository.

Preparation returns only the relevant current control plus the selected grant,
proof and exact intent fingerprint. The complete commit contains `intent`,
`intentFingerprint`, `grantId`, `grantRevision`, `authority`,
`proposalFingerprint` and `fingerprint`. The intent binds action, exact scope,
complete command, aggregate expected control revision and expected fingerprint.
The final operation fingerprint also binds the full durable proof and grant
revision. SQL and JavaScript construct fixed-order canonical encodings rather
than relying on JSONB object order.

A mutation or recovery value is `{record, receipt, operation}`. The complete
immutable operation is returned internally with the record so validation can
recompute its fingerprint and prove that the event's command and authority match
the original intent. A valid but different record cannot borrow another receipt's
hash. Recovery returns the historical operation's original record revision and
timestamp. Status alone returns current heads for the requested scope.

Every repository reply has a private wrapper:

```text
{ value, admission: { expiresAt, resultFingerprint } }
```

The digest binds the exact value using independently sorted schema keys. The host
retains the absolute minimum admission deadline through its final awaited
identity check, checks it synchronously immediately before returning, and strips
the wrapper. Caller-visible values contain no ticket, admission deadline or
transport fingerprint.

## Transactions, locks and final delivery

The new `garden_lifecycle_admin` capability is NOLOGIN, NOINHERIT and
non-elevated. A dedicated, noninheriting runtime login may assume only this role;
the issuer uses a separate login/pool. The closed capability verifier rejects
mixed runtime roles, inherited capability and unexpected active roles. The admin
role has eight fixed function grants, the issuer three, and neither has raw
access to the new tables or authority-maintenance functions.

1. The admin connection opens a transaction, fixes its role and deferred
   constraints, and reads its actual backend PID and full `xid8` transaction ID.
   Before any record, control or audit lock, a separate committed issuer
   transaction mints the control ticket already bound to that pair.
2. The control ticket binds actor, workspace, deployment environment, exact
   scope, phase, action, operation, complete request and fingerprint. It is paired
   with an internal exact-record research-read policy ticket. The new binding
   validates PID/transaction and the pair before redeeming ordinary policy
   context. The admin has no direct ordinary policy-context binding grant.
3. The shared consent/workspace advisory lock precedes canonical research
   record and permission locks. The existing global lifecycle-operation lock
   precedes operation registration. Exact current grant/evidence and control
   locks precede the audit head. No separate-pool audit or grant lookup is awaited
   while the operation transaction holds the audit lock.
4. A mutation writes immutable event, private payload, current control head,
   scope generation, global operation entry and succeeded audit atomically.
   Reads and exact retries also retain the current admission guard through
   COMMIT. The host fixes constraint timing and exposes no arbitrary SQL callback.
5. After the main transaction is acknowledged and released, one fixed issuer
   transaction validates the completed context and exact result fingerprint. It
   obtains fresh internal research policy context, rechecks the **same selected
   grant/evidence revisions**, current research permission and consent, then
   retires both original tokens and the temporary policy context in that
   transaction. A deferred check retains the captured deadline and consent
   requirement through this final COMMIT.
6. The repository and service refresh current identity/assurance after their
   awaits. Both enforce current availability and the captured SQL deadline
   synchronously before releasing the private value.

The minimum deadline includes lifecycle grant/evidence/review windows, research
role and exact record-read grant, current consent and representative-authority
expiry, original ticket and user-verification admission. Where several currently
eligible consent grants cover the same subject/path, coverage can last through
the latest eligible alternative; every required subject/path must remain covered.
The existing bounded consent dependency walk still rejects unknown, cyclic or
oversized closure.

SQL evaluates time with the database clock. JavaScript compares the returned
absolute UTC deadline with the trusted host clock. This relies on host/database
clock synchronization and a trustworthy host clock; it is not an independently
authenticated transport lease. The final validation transaction's COMMIT is the
last database authority/revocation point. A subsequent database revocation cannot
atomically recall data between that point and future network delivery. No claim
of atomic authorization with network delivery is made.

Prebinding makes the original control token unusable in a later transaction,
even on the same reused backend after rollback or failed retirement. The host's
fixed deferred-trigger execution is a different boundary from an arbitrary SQL
login that can issue `SET CONSTRAINTS`; the latter can change trigger timing.
Neither database checks nor user verification make a compromised issuer or
arbitrary privileged SQL executor trustworthy.

## Durable state, recovery and privacy

The migration adds a shared lifecycle operation registry, evidence/grant revision
histories and heads, control events/private payloads/current heads/scope heads,
and short-lived ticket/context/delivery-check tables. All twelve new tables enable
and force RLS with owner-only internal policies. Immutable histories reject
UPDATE, DELETE and TRUNCATE. Original `0001`–`0014` migration bytes are unchanged.
The additive requester event registry/FK preserves old receipts while preventing
cross-workspace or cross-action reuse of an operation UUID.

Composite predecessor and head constraints pin record revision, control kind and
fingerprint. A rule cannot replace a hold under the same control ID; a control
cannot move to another target. Current reconstruction rejects an older head while
newer retained history remains. Missing or tampered private payload denies
reconstruction and exact replay cannot recreate it. This is not an independent
rollback anchor against restoration of an entire stale database.

The persisted scope holds at most **64 distinct control IDs**, including released
holds. A 65th creation is rejected before operation/audit effects. Revisions and
releases of existing controls remain available at the cap. This stricter storage
bound reserves the owned-snapshot byte/node budget for the eventual released form
of every hold; the pure evaluator's general array bound remains 256. The API does
not return a truncated inventory labeled complete.

Exact concurrent retries converge on the same immutable receipt. Changed intent,
stale aggregate generation, conflicting predecessor or reused operation IDs deny.
Old operation recovery requires fresh independent inspect authority and returns
the original operation after validating its immutable event and private payload.
It does not present that historical record as the current control head; current
scope reconstruction is a separate status/preparation/mutation check.
Refreshing short admission tickets does not rewrite durable proof dates or the
operation fingerprint. If the original write grant/proof is no longer current,
use authenticated recovery rather than attempting to rebuild an operation with
changed authority.

A lost COMMIT acknowledgement, failed postcommit validation, failed cleanup or
late write-delivery denial returns an outcome-unknown error with exact
`{scope, operationId, fingerprint}` recovery. It does not return buffered state or
claim rollback. The service never automatically retries a mutation. Read failures
are generic `lifecycle_control_unavailable`; SQL errors, grant existence and
private evidence are not echoed.

Five closed audit actions distinguish authority-evidence maintenance, grant
maintenance, rule persistence, hold placement and hold release. Audit append
failure rolls the mutation and every associated event/head/registry change back.
Audit subjects are opaque `lifecycle-authority` or `lifecycle-control` references,
with separate operation request identity and fixed reason codes. Raw commands,
proofs, subject links, evidence references, source text, credentials and provider
material are excluded from the audit event. Stored controls, hashes and aliases
remain private metadata; none are proof of anonymization or completed erasure.

## Verification and remaining integration

The focused protocol, host and repository tests cover strict ownership, complete
operation/result binding, current identity and deadlines after asynchronous
boundaries, uncertain writes, and the private admission wrapper. The independent
PostgreSQL journey is `apps/research/access/lifecycle-controls.ci.mjs`; it runs
only against the disposable loopback database in the data workflow. Its synthetic
authority/identity fixtures, altered deadlines, mutation probes and teardown must
never run against retained staging or a live corpus.

Exact source hashes and observed results belong under `docs/evidence/GDN-032/`.
A source or syntax check is not a PostgreSQL execution result. Migration presence
is not a mounted feature or a provisioned operator. Hosted activation still needs
verified identity, disjoint pools, explicit legitimate authority establishment,
correct deployment binding and private hosting acceptance. Initial staging
authority and control state must be empty except for any registry backfill of
previously retained requester operations.

Requester decisions, always-enforced tombstones, material/dependency inventories,
removal queues, administration after research withdrawal, current-control restore
reconciliation and any eraser/export worker remain separate work. Existing rules
and holds carry no permission to read, publish, export, release a tombstone, erase
a shared class key or dispose of protected material.
