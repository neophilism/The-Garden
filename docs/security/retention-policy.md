# Retention rules, holds and disposition review

This is a pure, private domain component of GDN-032. It validates retention
rules and narrowly scoped holds, proposes an explicit hold release, and evaluates
supplied current facts for a dry-run review. All returned proposals carry
`effectsVerified: false`. There is no database, provider call, mounted endpoint,
delivery authorization, tombstone, removal queue, material eraser or key-retirement
operation in this component. GDN-032's integrated acceptance remains incomplete.

The separately default-off [durable controls bridge](lifecycle-controls.md)
persists these rules and hold transitions under current scoped operator and
research authority. Its receipts still establish no physical disposal or
delivery effects; the evaluator below remains a pure supplied-facts contract.

## Authority and source of facts

The host must independently resolve the canonical record and its current numeric
revision, establish the caller's action-specific authority, verify the cited
evidence and obtain complete current control and material inventories. A submitted
record UUID, research membership, record ownership or evidence UUID is not proof
of any of those facts. The request module's `claimedRecordId` must not be passed
through as an established target without that resolution.

This component checks the representation and consistency of supplied facts. It
cannot establish legal capacity, applicable law, completeness of a database read,
the latest state of an external authority, or the authenticity of a caller-made
snapshot. A host must never accept authority objects, current control heads,
`controlsState: "complete"`, or the material inventory from an untrusted request.
Version and fingerprint comparison cannot detect a complete rollback of all
supplied facts, expected versions and history together.

No legal timeline is chosen here. Every effective date, expiry, review date,
minimum retention boundary and disposition deadline is explicitly supplied with
evidence and authority. Tests use invented synthetic dates only. A preservation
exception also requires finite dates and current evidence; it is not an indefinite
retention default. Conflicting requirements return a review result without choosing
which authority should prevail.

## Canonical target and classes

Every rule and hold has the exact scope:

```js
{ workspaceId, recordId, recordRevision, classification }
```

Workspace and record IDs are canonical lowercase UUIDs, versions 1–5. Numeric
record/control/authority/material revisions are positive decimal strings bounded
to signed PostgreSQL bigint. The host reads the actual record classification and
maps it through the application contract; this pure module does not query that
row or silently expand the existing research database's supported classes.

The explicitly selected retention class must match the existing classification
catalog in `docs/security/data-classification.json`:

| Classification | Retention class |
|---|---|
| `public_policy` | `versioned_public_policy` |
| `public_verified_research` | `versioned_with_corrections` |
| `restricted_research` | `case_and_rights_policy` |
| `sensitive_contributor` | `consent_and_legal_hold_policy` |
| `sealed_ciphertext` | `cryptographic_key_and_policy_lifecycle` |
| `operational_security` | `bounded_audit_policy` |
| `future_governmental` | `requires_future_statute_and_operator` |

These names select no actual duration and activate no processing mode. Governmental
scope always requires review. Sealed metadata handling grants no server plaintext
access. A changed workspace, record, numeric revision or classification requires
new current target/control resolution; an old scoped rule or hold cannot be moved.

## Rule and hold proposal API

All APIs are synchronous and have no external I/O. `now` is an explicit,
nonnegative, integral Unix timestamp in milliseconds from the trusted server.
Stored instants use exactly `YYYY-MM-DDTHH:mm:ss.SSSZ` with valid four-digit years.
No clock, timezone, date or missing field receives an inferred fallback.

| Function | Purpose |
|---|---|
| `retentionRuleCommandFingerprint(operator, input)` | Canonical digest of the trusted operator and complete rule command. |
| `holdPlacementCommandFingerprint(operator, input)` | Canonical digest of the trusted operator and complete hold placement. |
| `holdReleaseCommandFingerprint(operator, current, input)` | Operator-bound release digest after checking the exact original hold binding. |
| `proposeRetentionRule(authority, input, now)` | Owned, immutable rule proposal. |
| `proposeHold(authority, input, now)` | Owned, immutable hold placement at revision `1`. |
| `proposeHoldRelease(authority, current, input, now)` | Explicit release at revision `2`, or an exact release replay. |
| `validateRetentionRule(record)` | Structural, historical-time and canonical fingerprint validation. |
| `validateHoldRecord(record)` | Placement/release history and immutable scope validation. |
| `evaluateRetention(expected, current, now)` | Internal dry-run review result from current host-established facts. |

Rule input contains exactly `operationId`, `ruleId`, `revision`, `scope`,
`retentionClass`, `basis`, `evidenceId`, `effectiveAt`, `expiresAt`, `reviewBy`,
`retainUntil` and `disposeBy`. `basis` is `policy` or `preservation-exception`.
The interval is finite: `effectiveAt < expiresAt`,
`effectiveAt < reviewBy <= expiresAt`, and
`effectiveAt <= retainUntil <= disposeBy <= expiresAt`.

Hold placement contains exactly `operationId`, `holdId`, `scope`, `reason`,
`evidenceId`, `effectiveAt`, `expiresAt` and `reviewBy`. `reason` is `legal-hold`
or `preservation-hold`; that code alone proves neither claim. The same finite
effective/expiry/review rules apply. A future-effective control can be recorded,
but the evaluator requires review until it is effective. Expired or already
review-overdue placements cannot be proposed as fresh controls.

Authority contains exactly `workspaceId`, `subjectId`, `action`, `operationId`,
`authorizationId`, `authorityEvidenceId`, `authorityRevision`, `validFrom`,
`expiresAt` and `commandFingerprint`. Subjects are opaque, well-formed strings of
at most 128 characters without ASCII whitespace/control characters. The closed
actions are `lifecycle.retention-rule`, `lifecycle.hold-place` and
`lifecycle.hold-release`. Workspace, operation, action and complete command digest
must match; its interval must include the proposal time, with exclusive expiry.
The fingerprint APIs take an independently authenticated operator with exactly
`{workspaceId, subjectId}`. The digest covers that operator and every command
field, including dates, evidence, scope and expected version. Proof validation
recomputes it from the proof's operator. Changing the operator while keeping an
old fingerprint rejects even before the first proposal. Binding only an operation
UUID or a payload without its operator would be insufficient.

Proposal output is `{record, operation, replayed, effectsVerified: false}`.
The operation also explicitly has unverified effects. Its `commandFingerprint`
identifies the operator-bound command, and its separate `fingerprint` additionally
binds the entire authority proof. Changed authority evidence, revision or validity
dates therefore cannot retain the same operation identity. Rule records contain the
canonical command, event time, full authority reference and record fingerprint.
Hold records retain their original placement and a separate release event. A
shape-valid historical record remains valid after authority expiry; that fact
does not make its authority current for a new operation or disposition review.

## Holds and explicit release

A hold constrains physical disposal only. It grants no read, decryption, export,
publication, research membership or consent permission. It cannot lift a deletion
tombstone, undo withdrawal or resume delivery. Those denials continue through
their independent current authorization and delivery controls.

Passing the hold's review or expiry date returns `review-required`. The hold
does not vanish from the inventory and is never silently released. An overdue
retention disposition deadline also requires review even if an active hold blocks
disposal. This records the conflict instead of inventing an indefinite exception.

Release input is exactly `operationId`, `holdId`, `expectedRevision`,
`holdFingerprint`, `evidenceId` and `reviewBy`. The expected revision must be `1`;
the fingerprint binds the entire original placement, including scope, dates,
evidence and placement authority. Release uses its own current, explicitly
versioned `lifecycle.hold-release` authority and future review date. An expired
hold can be released through this explicit proposal. Its immutable placement is
retained, and the resulting revision is `2`.

Exact replay must repeat the original release command and complete authority
reference, while authority and review dates are still current. It retains the
original event time and returns `replayed: true`. Changing evidence, actor,
authority revision, authority validity dates, operation, target or expected hold
binding is not the same replay. Renewal or changed intent needs a separately
authorized workflow; this component has no in-place hold extension or resurrection
transition. Released holds remain in current control inventory with their revision
and fingerprint. Removing one from the array while retaining its current head
requires review.

## Evaluating current facts

`expected` has exactly `scope`, `controlRevision` and `inventoryRevision`. The
host obtains these expectation bindings from the operation's independently
established current target. `current` contains exactly:

- `schemaVersion: 1`, `scope`, `revision`, `observedAt`, `validUntil`;
- `controlsState`, `rules`, `holds`, `ruleHeads`, `holdHeads`, `authorities`;
- `inventory`.

`controlsState` is `complete`, `incomplete` or `unresolved`. Each rule/hold head
is `{id, revision, fingerprint}`. Every supplied rule and hold must match exactly
one corresponding current head, including released holds; missing or extra heads
require review. Each operative authority has one current entry
`{authority, state}`, with `state` equal to `current`, `revoked` or `unresolved`.
The complete current authority must match the record's operative proof. A released
hold uses its release authority; its original placement remains historical
evidence. Missing, extra, changed, revoked, unresolved, future or expired operative
authority requires review.

Inventory is exactly `{scope, revision, state, evidenceId, materials}`. Its state
uses the same complete/incomplete/unresolved values. Each managed encrypted
material reference is `{contentVersionId, generation, envelopeDigest}`. UUID,
positive generation and lowercase SHA256 encodings are checked, duplicate material
references reject, and at least one material is required for disposition review.
These references identify the declared sidecar inventory; they do not enumerate
every backup, public copy, key, derivative or recipient-held copy in existence.
The host must treat absent relevant custody information as incomplete and must not
claim worldwide inventory completeness from this bounded representation.

The current scope and both revisions must match `expected`. The snapshot must
already have been observed, with `now < validUntil`. A rule, placement or release
event cannot be later than the snapshot observation or evaluation time. Record
scope must match in each rule, hold and inventory. The evaluator rejects incomplete
or unknown encodings rather than dropping unrecognized controls.

All arrays are bounded to 256 entries and must be complete for the represented
target; truncating or paging an inventory and labeling that fragment complete is
invalid host behavior. If a target cannot fit this bounded contract, route it to
review. This bound supplies no permission to omit an older control or generation.

| Result | Meaning |
|---|---|
| `retain` | Current coherent supplied facts contain an active hold or a minimum retention period still in effect. No access is granted. |
| `review-required` | Missing, malformed, stale, future, overdue, unresolved, conditional or conflicting facts prevent a normal disposition proposal. Material remains protected. |
| `review-disposal` | The intersection of all current supplied retention windows has been reached and no current hold remains active. This is a review proposal, not purge authority. |

For multiple coherent rules, the latest minimum retention time and earliest
disposition deadline define their intersection. A contradictory intersection
requires review. The minimum is inclusive for entering disposition review;
the deadline is exclusive, so equality with a deadline, authority expiry, control
expiry or review date requires review. No priority between conflicting legal
authorities is inferred.

Output has a fixed `retention-dry-run` kind, target scope, sorted reason codes,
evaluation time, a canonical snapshot fingerprint and `effectsVerified: false`.
Malformed facts return a fixed review reason without echoing evidence, private
source text or authority objects. This is an internal, sensitive review output,
not a requester receipt or public status response. Its fingerprint is not an
authorization token and must never be accepted by an erasure worker.

## Persistence, recovery and copy limits

All copies are constructed from exact enumerable own data properties in fixed
field order. Accessors, hidden/symbol properties, inherited shapes, `toJSON`,
sparse arrays, unsupported fields and noncanonical scalar types reject. The
module owns and recursively freezes returned records. Digests are SHA256 of
`garden-retention-v1`, newline, a fixed action/record kind, newline and canonical
JSON. Command JSON is `{workspaceId, subjectId, command}` in that fixed order;
operation JSON is `{command, authority}` and includes the complete canonical
authority proof. Sorted array inventories make input insertion order irrelevant. These
digests detect representational drift; they are not signatures or an independent
anchor against a rewritten history.

A future persistence host must atomically enforce current record/control versions,
immutable history, unique operation and control identifiers, current authority,
complete inventory and a semantic commit audit. Rule revisions are explicit
proposals; this module does not advance a database version or implement a rule
update CAS. Two evaluations of an old snapshot can both produce proposals. Only a
real current-state transaction can choose a winner. No exception or returned
proposal is evidence that a database write committed. Recovery needs authenticated
durable operation readback and current controls.

Restores must reapply current consent, withdrawals, deletions and holds before
delivery. Backup success does not authorize access. The pinned canonical
[backup/recovery standard](https://github.com/neophilism/End-To-End-Everywhere-Security-Architecture-Standard/blob/ddfbd40c47d13890ebb81ea91c81fe329417058e/spec/backup-recovery.md)
separates recovery from authorization, requires rollback checks, and requires
erasure claims to identify remaining copies and key material. This component
implements none of that cryptographic recovery protocol and claims no E2EE,
certification or conformance.

Deleting one sidecar would not remove already delivered plaintext, public copies,
offline recipient copies or retained backups. Destroying a class-wide wrapping key
is not per-record deletion and could destroy unrelated records. No such operation
is provided or proposed here. Actual retention schedules, lawful preservation
exceptions, copy removal, backup expiry and erasure evidence remain separate,
explicitly authorized integration work.
