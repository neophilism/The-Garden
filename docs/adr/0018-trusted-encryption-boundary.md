# ADR 0018: server-processed envelopes with explicit key-service custody

Date: 17 October 2026. Status: implemented component; provider integration pending.

Use native AES-256-GCM per bounded restricted object/version, with unique content keys and an injected, authenticated key-wrapping client. Bind class, tenant, environment, purpose and immutable source version as associated data. Reuse the existing audited-decision contract, and require durable key-use receipts and current authorization checks. Exclude sealed records rather than treating server encryption as E2EE.

The inspected Federal Encryption Compliance README describes a compliance policy client and supplies no verified key-wrapping contract. Do not invent a live wrapping endpoint or reuse its credentials. A factory-created adapter with pinned request/reply metadata permits implementation/testing now while real provider custody, IAM and storage remain explicit integration work.

Canonical schema-specific serialization survives reordered JSON objects, including the order changes permitted by PostgreSQL JSONB. Current permission/context are rechecked after asynchronous audit tails, and a synchronous enable/cancellation fence precedes provider dispatch and result return. Hosts remain responsible for transactional authorization/version binding at persistence and downstream delivery. A timeout never releases the capacity of provider work that has not settled; late key replies are discarded and cleared where reachable.

Rotation preparation returns immutable predecessor/successor digests and requires atomic host persistence. It does not retire keys or claim independent anti-rollback protection. Rewrap preserves ciphertext; suspected content-key compromise needs new content encryption. Provider outages and audit/authorization failures deny delivery without returning plaintext. Existing keys, ciphertext and receipts survive code rollback.

See [the operational contract](../security/trusted-processing-encryption.md). Generated-fixture cryptographic and adversarial tests do not establish managed-provider operation, historical verification or standards conformance.
