# GDN-085 — private archival source-acquisition queue

**State:** implementation merged in PR #50, unmounted and disabled by default. This is an offline research-workflow foundation, not an email sender, payment processor, network crawler, record-verification engine or hosted research service.

## Purpose

Before researchers contact a repository or pay to obtain a manuscript, they should be able to preserve a specific acquisition lead, repository/item identities, the exact intended route, a purpose, an access finding, the source of their finding, a cost estimate, and the approval that will be needed. A scan request, catalog request, permissions request, research correspondence, lawful offline lead and paid copy are separate kinds of work. Their creation does not itself initiate any activity.

The service is `services/workers/src/acquisition-queue.mjs`; validation lives at `packages/domain/src/historical/acquisition-tasks.mjs`. The default-disabled `createAcquisitionQueue` requires existing audited `decisions.decide`, current `authorize`, an independently trusted `resolveRoute`, a verified `verifyAuthority`, and a private local repository. There are **no HTTP endpoints, no provider adapters, no background jobs, no outbound email, no payments and no automated scans**. Activation requires separately approved identity, private storage, operator roles, legal access and operating review. No new costs or subscriptions are authorized by implementing the queue.

## Immutable data and status semantics

A draft preserves `taskId`, `repositoryId`, optional `itemId` and `candidateId`, one canonical `routeKey`, `requestKind`, exact title/notes, research purpose and quoted USD cost in integer minor units. Quoted cost is informational, **not payment authorization**. The route is an inert key, not a fetchable URL; it is independently resolved from protected repository metadata by the server-owned `resolveRoute` callback before a draft can persist, and checked again immediately before mutation. If there is no canonical route, fail closed. Changing a route string cannot silently sidestep an earlier denial or previous contact receipt.

The SQL store keeps immutable original tasks and append-only events, with a stable UUID per event and explicit predecessor revision. It does not edit or delete originals. Events represent a draft, access observation, verified approval, a separately performed contact recorded by a researcher, and a terminal outcome. A state change from `draft` to `approved` **does not** send any request. The `recordContact` method does not send either: it records a manually attested past action using evidence and a timestamp. Contact receipts or evidence are not independently verified by this repository alone. No exposed function authorizes or executes a payment.

Access states are deliberately non-equivalent:

| Finding | Meaning | Automatic contact |
| --- | --- | --- |
| `access-denied`, `robots-disallowed`, `paywalled` | A specific route is barred, and the barrier is durably retained | No; a new task for the same canonical route cannot evade it |
| `catalog-not-found` | Search did not return the item; absence and nonexistence are not proved | No automatic attempt; further approved human research is possible |
| `accessible` | Operator-reported access, not proof of rights to redistribute | None |
| `deferred-offline` | Recorded work remains to be performed with lawful offline access | None |

A terminal `inaccessible` outcome also creates a route barrier. The immutable denial ledger and the unique contact ledger are workspace-scoped, and their protected, canonical route identity prevents a second send for that same route through a new task ID. Barriers cannot be deleted by ordinary application operations. If access terms change, a separately designed independent-review/unblocking workflow must preserve the old refusal and establish genuine authority before any new attempt; this PR does **not** implement bypasses.

## Human contact and spending authority

An approval is not an editable client flag. The caller may provide only an opaque authorization UUID; the trusted verifier must return a second-person signed/verified scope bound to the current workspace, task, canonical route, kind, research purpose, currency, maximum estimated cost, and expiration (at most 90 days). `approvedBy` cannot equal the submitting subject. An authorized `recordContact` verifies the same scope again at the time of recording, checks the exact prior approval and the workspace-wide canonical route/contact uniqueness constraint, then writes one append-only receipt. A grant with less cost authority than the *quoted* estimate is rejected. The service never charges money; an actual purchase would require a separate properly reviewed payment integration and budget authority.

The authorization adapter must be operator-implemented using current membership, purpose, direct repository/item/candidate grants, and approval records. The library cannot claim cryptographically verified approvals merely because a test callback returned a shape that passed validation. Workspace membership alone must not confer broad rights to all source records. The queue does not permit an unverified user to rewrite task ownership or suppress evidence from another researcher.

## Storage and operational security

`services/workers/src/acquisition-queue-repository.mjs` uses SQLite `DatabaseSync` with a root directory outside the source and web roots, mode 0700, and database mode 0600. It refuses symlink roots, alternate filesystem owners, weak permissions, hard-linked database files and migration/version/schema drift. Transactions use `BEGIN IMMEDIATE`, journal mode `DELETE`, `synchronous=FULL`, foreign keys and immutable-row triggers. The store is partitioned by workspace and the original submitting subject on every read/write. Identical retried task/event IDs return immutable receipts; mutated replays and cross-owner reads fail closed. Audit/identity/authorization is rechecked before work, before mutation and before delivery; authorization failures never become evidence of a source's absence.

SQLite durability testing in a local synthetic harness is **not** a managed-production PostgreSQL migration, encryption-at-rest attestation, disaster-recovery certification or multi-region collaboration promise. Real operator access, backups, key management, retention/redaction, rate limiting, notification and independent assessment remain prerequisites. Do not put private queue DB files or personally sensitive repository correspondence into this public GitHub repo or public static export.

## Tests, acceptance and rollback

Run:

```sh
node --test tests/data/acquisition-tasks.test.mjs tests/storage/acquisition-queue.test.mjs
```

The suite tests: exact immutable draft replay, malformed fields/URLs/Unicode and wrong purpose; distinct access findings, no historical nonexistence inference; audited identity revocation, cross-owner/workspace and disabled-service denial; unauthorised or self-approved contact and insufficient budget; permanent denied-route barrier including alias resistance; duplicate contacts across tasks; idempotent receipt replay; append-only outcomes; SQLite permissions and tampered-schema rejection. Real provider and live security tests remain unperformed.

**AC01:** Tasks retain named owner, status history, evidence and verified contact/budget authority before a receipt. **AC02:** Inaccessible, catalog-not-found and genuinely unavailable are not conflated. **AC03:** Canonical routes plus denial and unique contact ledgers reject repeated attempts to sidestep access controls. A fixture cannot prove actual provider compliance.

To roll back, unmount/disable the service without deleting the original tasks, denials, approvals, or contact evidence. Any future schema migration must be additive, version-pinned and rehearsed on isolated backups; do not run destructive down migrations. An operator must reconcile work before replaying external actions.
