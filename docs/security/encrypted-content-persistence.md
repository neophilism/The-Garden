# Encrypted content persistence

This GDN-026 follow-up adds a private PostgreSQL sidecar and a host service around the existing trusted encryption component. Both factories default to disabled. They are not mounted into an application route, and no deployment/provider configuration is activated by importing them. Existing record payloads and historical originals are not rewritten or encrypted by this change.

**Authorized application processes, provider operators with the necessary custody, and application operators can access plaintext. This is not end-to-end encryption.** The database catalog is metadata, not proof of a working or approved KMS. The original [crypto component contract](trusted-processing-encryption.md) continues to govern algorithm, key ownership, provider cancellation, and key-use authorization/audit obligations.

## Identity and scope

`encrypted_content_versions.content_version_id` is a server-minted UUID. Its `(workspace_id, record_id, record_revision)` foreign key points to an actual numeric PostgreSQL record revision. One bounded content slot is admitted per exact revision/environment/class/purpose. `objectId` in authenticated crypto context equals the record UUID; `versionId` equals this content UUID. They are never inferred from upload IDs, a source filename, row order, or a numeric revision cast to a UUID.

This bridge accepts only actual record classification `research`, state `active`, and purpose `research`, mapped explicitly to `restricted_research`. The parent record's current numeric version must still equal the bound revision on preparation, commit, load, and receipt recovery. A parent edit therefore denies access to the older sidecar through this bridge, even if that edit retains research visibility. General encrypted history access needs a separate reviewed contract.

Environment is checked against `garden_control.deployment_binding`, including repository, environment and current database. Only the existing `ci` and `staging` foundation is supported. Personal, operational-security, sealed, public and governmental persistence is not enabled by this mapping. The component's larger class list does not widen SQL policy.

## Data structures

| Structure | Purpose | Runtime writes |
| --- | --- | --- |
| `garden_control.encryption_key_versions` | Exact provider/ref/version handles, read/write flags, validity and revocation | None; controlled metadata administration only |
| `garden_control.encryption_key_bindings` | Repository/environment/class binding, write version and policy generation | None; controlled metadata administration only |
| `garden_private.encrypted_content_versions` | Immutable UUID-to-record-revision mapping | Append through commit function |
| `garden_private.encrypted_envelope_revisions` | Immutable operation, request hash, predecessor, generation, key handle, actor and audit reference | Append through commit function |
| `garden_private.encrypted_material` | Ciphertext, nonce, authentication tag and wrapped DEK for one generation | Append through commit function |
| `garden_private.encrypted_content_heads` | Current generation and canonical digest | Compare-and-swap through commit function |

All six content/key tables force row-level security and grant no table operations to the encryption runtime. Private material is a child of immutable receipts; receipts do not require material to remain forever. A future GDN-032 remover can target a precise material generation without rewriting successful commit history. This change contains no purge function or grant that authorizes runtime deletion or truncation. Backups may still contain material, and deleting a shared class wrapping key is not per-record erasure.

Key metadata starts empty. Operators must not seed real key handles until the actual provider contract, isolated custody, credentials, authorization and recovery have been accepted. Metadata changes use closed audit actions without key values. Key-version identities cannot be reassigned or deleted; access is withdrawn using policy/revocation. Binding updates advance their policy generation. A binding generation covers its binding row; key-version read/write/revocation/validity is also checked directly on every operation.

## Fixed repository API

`apps/research/access/encryption-persistence.mjs` exports `createEncryptionPersistence`, `createEncryptedContentService`, `encryptionRequestDigest`, `encryptionDeliveryFingerprint`, and `EncryptionPersistenceError`.

Construct the repository with `{identity, issuerPool, encryptionPool, environment, enabled}`. The issuer and encryption pools must have distinct verified noninheriting logins. The environment is `ci` or `staging`; `enabled` must synchronously return literal `true`. Async/truthy predicates do not enable work. The module captures dependency methods and validates plain objects, exact fields, canonical lowercase UUIDs, decimal-string revisions, hashes and bounded envelopes before sending SQL.

| Method | Input after `headers` | Result |
| --- | --- | --- |
| `prepare` | `{workspaceId, recordId, recordRevision, contentVersionId?}` | Private delivery wrapper around current metadata; mints the UUID if omitted, without creating a content mapping |
| `load` | `{workspaceId, recordId, recordRevision, contentVersionId}` | Private delivery wrapper around metadata, envelope and head after fresh read authorization |
| `commit` | Exact candidate described below | Private delivery wrapper around an immutable receipt after COMMIT, fresh database completion validation and cleanup |
| `receipt` | `{workspaceId, recordId, operationId, requestDigest}` | Private delivery wrapper around an exact historical receipt after current write authority and actor matching |
| `verifyIdentity` | Expected subject ID | Same subject after a fresh verified-identity read; it cannot widen SQL authority |

Each of the four data methods returns exactly `{value, admission: {subjectId, expiresAt, resultFingerprint}}`. This private wrapper is required; an old raw result or missing deadline is rejected. `expiresAt` is an exact UTC millisecond instant and the canonical result fingerprint binds the entire validated value. The service strips this metadata before returning a public value. An optional third `expectedSubject` argument narrows each method to a principal already established by the service; it cannot authorize an unverified identity.

The preparation/load `value` contains exactly `{workspaceId, recordId, recordRevision, contentVersionId, context, keyBinding, keyPolicyGeneration, head, envelope}`. `head` is `null` for a new identity or `{generation, digest}` for an existing one. `envelope` is null only for a new identity. The key binding contains repository, environment, provider ID, data class, key reference, write version and allowed read versions. This is not a bearer capability and must not be cached as permission.

The commit request contains exactly:

```js
{
  operationId, workspaceId, recordId, recordRevision, contentVersionId,
  keyPolicyGeneration, expectedGeneration, expectedDigest, envelope
}
```

Revisions and generations are canonical decimal strings. Initial insertion requires expected generation `"0"` and digest `null`. Rotation requires both the previous generation and previous canonical digest. SQL rejects mismatches, changed context, a different target key, same-key no-op rotations, and alterations to ciphertext, nonce or tag. Rewrap preparation must already have authenticated the old ciphertext; SQL cannot establish GCM authenticity from the shape of JSON. The raw repository is trusted internal server code, never a request-facing arbitrary-envelope API.

The request hash is SHA-256 over UTF-8 of the following values joined with a single newline, without a trailing newline:

```js
[
  'garden-encrypted-content-request-v1', operationId, workspaceId, recordId,
  recordRevision, contentVersionId, keyPolicyGeneration, expectedGeneration,
  expectedDigest === null ? 'none' : expectedDigest, envelopeDigest(envelope)
]
```

JavaScript and SQL use the crypto component's fixed envelope field order, strict JSON value types and canonical base64url. They do not hash `jsonb::text` as if it were the JavaScript serialization. PostgreSQL JSONB key reordering preserves the digest; unknown/extended fields, type coercions and alternative scalar encodings are rejected. A digest identifies a candidate; it does not authorize its use.

## Host service and buffer ownership

Construct `createEncryptedContentService({repository, encryption, enabled})` with the fixed repository and an appropriately configured `createTrustedEncryption` component. The latter must retain its real current `decisions`, `authorize`, `resolveTarget` and durable key-use audit dependencies. This service does not approve a provider, turn synthetic fixtures into production adapters, or replace those gates with membership alone.

The service exposes:

- `store(headers, {workspaceId, recordId, recordRevision, operationId, contentVersionId?}, plaintextBuffer, {signal?})`: prepares authoritative metadata, copies the bounded plaintext, encrypts through the trusted component, pins the exact resulting envelope, then commits. An existing head is not silently overwritten.
- `decrypt(headers, {workspaceId, recordId, recordRevision, contentVersionId}, {signal?})`: loads current material, authenticates/decrypts through the component, then loads again and requires the same context, head generation/digest, and key policy. Permission loss or a changed head denies release. The component-returned owned plaintext is cleared on every exit; success returns a separate caller-owned buffer.
- `rewrap(headers, {workspaceId, recordId, recordRevision, contentVersionId, operationId}, {signal?})`: prepares the existing head, uses the component's authenticated rewrap result and verified predecessor/successor receipt, then commits the exact generation/digest CAS.
- `recover(headers, {workspaceId, recordId, operationId, requestDigest})`: looks up a prior receipt without re-encrypting or making a provider call.

No provider or component decision/audit callback executes inside the mutation transaction. Prepared crypto may finish and subsequently fail CAS or authorization; its key-use completion is not a storage success. Provider/key loss never causes a plaintext fallback. A successful caller-owned plaintext buffer remains the caller's responsibility. Clearing reachable JavaScript buffers cannot erase provider copies, native crypto memory, backups, logs or crash dumps.

The service pins the subject from its first private wrapper and requires every later wrapper and identity verification to match. It takes the minimum of all captured database deadlines; later validation cannot extend an earlier deadline. It verifies identity again after the final repository await, then checks subject, feature/cancellation state and deadline synchronously before return. On decrypt it clears the crypto-owned plaintext before the last fence and clears the newly allocated return buffer if that fence fails.

The last database revocation point is the final completion transaction's COMMIT. The final verified-identity read is a separate observation; neither is an atomic lease on future HTTP bytes. Natural expiry remains bounded through the service's final fence, assuming synchronized host/database clocks. No HTTP stream, downstream release channel or transport is implemented here. A later database revocation cannot be detected without another database observation. Mounted delivery must preserve current policy and bounded buffering at its own boundary.

## Authorization, locks and audit

The dedicated `garden_encryption` role is `NOLOGIN NOINHERIT NOBYPASSRLS` without administrative attributes. The deployment uses its own noninheriting login and disjoint pool. The existing role-graph and object-ownership guard runs before role activation and again before commit; extra reachable capabilities, inherited privileges, owners or elevated roles are rejected. A connection with a failed privilege check or rollback is discarded.

SQL takes the existing workspace consent advisory lock `(144729, hashtext(workspace_id::text))` before locking the actual workspace, member, record grant, record, and selected role. It then locks deployment/key metadata and the envelope head. Grant/status/key rows use `FOR SHARE`, which blocks non-key updates as well as deletion. Current classification/state come from the locked record, never from arguments passed to `may_access_record`. The current numeric revision and live inherited consent are required.

`clock_timestamp()` is read after waits. Captured ticket/grant/role/key deadlines and current consent are checked after the audit wait, by a final fixed commit check, and by a deferred constraint trigger in the executor's COMMIT. The executor sets constraints deferred and does not expose caller SQL. A compromised SQL login could issue `SET CONSTRAINTS` itself and change trigger timing; this design does not claim an unchangeable final-instant lease against arbitrary transaction statements. Database owners remain an explicit trust boundary.

The audit head is acquired last. `encryption.persist` / `encryption.rewrap` uses outcome `succeeded`, references the actual record/revision, and shares the operation UUID with the immutable private receipt. Material, head, receipt and audit event all commit or roll back together. The domain audit validator and SQL append function both include these actions; export can verify the resulting pages. Raw/wrapped keys, ciphertext, plaintext and arbitrary provider messages are not audit fields.

Never call `createAuditedDecision` through its separate pool after this transaction holds the workspace audit head. It can wait on the caller's own lock. Similarly, policy-ticket invalidation through the issuer pool runs only after COMMIT/ROLLBACK because binding locks the ticket row. Repository activation, pinned identity and captured deadlines are checked after the asynchronous completion/cleanup tail. Closure before main COMMIT prevents the write; closure after an attempted or completed COMMIT preserves exact uncertain-write recovery information.

## Additive delivery completion (0016)

`0016_encrypted_delivery.sql` preserves all earlier migration bytes, content rows and successful audit/receipt semantics. It adds two forced-RLS, owner-only tables: `encrypted_delivery_contexts` stores only the original policy-token hash, main PID/xid, actor, phase, scope, operation/result digests, key metadata and deadline; `encrypted_delivery_checks` is transient final-transaction metadata. Neither stores plaintext, ciphertext or wrapped keys. No new runtime role or broad table privilege is introduced.

The encryption capability exposes `prepare_encrypted_delivery`, `load_encrypted_delivery`, `commit_encrypted_delivery`, `recover_encrypted_delivery`, `encrypted_delivery_admission` and `clear_encrypted_delivery`. Its old direct prepare/load/commit/receipt/check/clear grants are revoked; owner-defined wrappers still call the immutable 0013 functions. The issuer receives only fixed finish/invalidate entry points. Role, RLS and owned fixed-query boundaries remain in force.

The main executor takes the existing workspace advisory lock before binding the policy token. Every successful data operation records a completion bound to that actual main PID/xid and exact token. It checks the returned result fingerprint and captured deadline, keeps the policy context until a deferred read/write COMMIT gate has executed, and checks identity after clear immediately before COMMIT. SQL captures the minimum of the ticket, record grant, selected role, relevant key-policy/version and inherited-consent deadlines. The consent calculation reuses the verified bounded 0015 helper, including alternative grants, required subjects and representative expiry.

After the main connection has released its locks, `finish_encrypted_delivery(token, resultFingerprint)` derives actor/scope/phase only from a committed closed completion. It takes the workspace lock, issues and binds a **fresh** policy token on the issuer's own PID/xid, rechecks current authority, and recomputes the exact current result. Preparation/load require the same current content head and key metadata; commit acknowledgment requires its pinned key policy and exact immutable receipt. Historical recovery requires current record/revision/write/consent authority and the original actor, but no current head equality, readable key or provider call.

The finish transaction retires original and fresh tokens and deletes its transient check row. A deferred trigger still holds the captured deadline and checks current consent at COMMIT. Grant/status/key/head locks remain held to that point. No provider, separate-pool decision or audit callback runs while these locks are held. The original mutation's semantic success audit stays atomic with its content/head/receipt.

A lost ticket-issuance acknowledgment retains the captured token for cleanup. Any connection with an uncertain COMMIT is discarded; successful main COMMIT followed by failed completion, identity or delivery does not become a fictitious rollback. Retirement failure cannot release protected output and can leave a closed completion and its ticket until a successful cleanup retry. The isolated CI journey includes a case for that retained state, exact operation recovery under a fresh ticket, and explicit cleanup retry. Expired leftover completion metadata is unusable; this change does not introduce or verify an automatic cleanup scheduler.

The fixed executors always set constraints deferred and never accept caller SQL. PostgreSQL allows a compromised SQL login to change constraint timing, and database owners remain trusted. The new gates are not a claim of protection against arbitrary transaction statements, whole-database rollback or malicious provider custody.

## Uncertain commit and retries

The normal fixed error has code `encrypted_content_unavailable` and exposes no SQL/provider details. If COMMIT was attempted, or the mutation completed but final delivery/cleanup failed, it may additionally carry:

```js
{
  commitOutcome: 'unconfirmed',
  recovery: {workspaceId, recordId, operationId, requestDigest}
}
```

Use `recover`/`receipt` with that exact binding and a fresh authenticated identity. Receipt lookup requires current record/revision permission and the original actor. It confirms a past operation; it does not grant material delivery or prove that the head is still that generation. A known rollback does not become a successful receipt. A different candidate under the same operation UUID fails even if its plaintext happens to be identical.

Identical-candidate repository retries can return the existing receipt after current checks. Calling `store` again re-encrypts with new randomness and, when omitted, a new content UUID. That is not the same candidate. The service does not silently compare plaintext digests, replay an old success, or retry uncertain mutations automatically.

## Migration, test and rollout limits

Migrations `0013_encrypted_content.sql` and `0016_encrypted_delivery.sql` are additive and checksum locked. The original 0013 preserves migrations 0001–0012 and copies the effective 0011 audit append behavior with only four added closed actions. The 0016 delivery addition preserves migrations 0001–0015 and does not replace any audit function. The migration seeds no key binding, content, credential, or provider. Existing staging is verified separately; applying this file is not proof of a working encryption service.

The new local tests use generated keys and bytes. The explicit `encryption-persistence.ci.mjs` journey runs against the existing disposable PostgreSQL CI service, exercising actual SQL/RLS/locking/CAS/audit and serialized ciphertext recovery. Source-bound evidence distinguishes tests executed locally, pending remote CI, and any later isolated staging migration verification. The disposable CI role/seed/teardown fixture must not run against the retained staging database.

Rollback disables the service and uses an earlier compatible artifact while preserving sidecar rows, consent withdrawals, key policy, heads and receipts. No destructive down migration is supplied. Restoring a database backup does not establish current consent or retention state, restore missing wrapping keys, or establish an independently anchored generation. A future retention/hold inserter must serialize under the same workspace advisory lock or a reviewed stable record control lock; absence of a row cannot itself be locked. Current deletion/consent state must be restored before subsequent delivery. No independent rollback anchor, live recovery drill or key-retirement claim is made here.

## Primary references

- [PostgreSQL 18 JSON types](https://www.postgresql.org/docs/18/datatype-json.html): JSONB does not preserve object key order.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html): row-lock modes and transaction lifetime.
- [PostgreSQL 18 date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html): actual clock time differs from statement-start time.
- [PostgreSQL 18 SET CONSTRAINTS](https://www.postgresql.org/docs/18/sql-set-constraints.html): transaction-controlled deferred constraint timing.
- [Prior canonical-standard reconciliation and crypto limits](trusted-processing-encryption.md): pinned standard and Node crypto sources; no added certification or provider approval.
