# ADR 0019: private encrypted content revisions and atomic persistence

Date: 17 October 2026. Status: implemented follow-up; real PostgreSQL CI and deployment are recorded separately in source-bound evidence.

## Decision

Add an encrypted sidecar for a bounded content slot belonging to an exact canonical working-record revision. A server-generated UUID content version maps through a composite foreign key to `(workspace_id, record_id, record_revisions.version)`. The numeric database revision is not a crypto UUID, an upload version, a row position, or an inferred historical identity.

The first persistence bridge admits only an actual `research`, `active` record under current research purpose permission. It maps that classification to `restricted_research` and admits only the database's existing `ci` or `staging` deployment binding. It requires the selected numeric revision to equal the parent's current revision. A subsequent parent revision makes the old sidecar unavailable through this bridge. This deliberately narrow behavior does not provide a general encrypted revision-history browser.

Key version and binding tables contain provider handles and policy, never key bytes. No catalog row establishes a provider's custody, approval, identity, or key availability. A separate `garden_encryption` capability exposes fixed functions; its runtime login must be noninheriting, nonowning, and disjoint from the policy-ticket issuer and every other runtime capability.

Crypto preparation completes outside the mutation transaction. The host-facing service generates or authenticates the actual envelope through the GDN-026 crypto component, then pins that result. SQL verifies exact representation and context, the current key policy, actual record authority, and a generation-plus-digest compare-and-swap. It appends an immutable receipt and a semantic `encryption.persist` or `encryption.rewrap` success event in the same transaction as the material and head change. A successful allow decision or key-use attempt is not a committed-storage receipt.

Immutable content mappings and envelope receipts are separate from erasable ciphertext/wrapped-key material. The material child references the receipt, so a later reviewed retention implementation can remove material while retaining the audit and generation chain. This change provides no deletion executor, legal-hold authority, backup erasure, shared-class-key retirement, or claim of immediate cryptographic erasure.

## Transaction and recovery boundaries

The executor obtains a scoped policy ticket using a separate issuer login. Within its fixed transaction, SQL takes the existing consent advisory lock, then workspace, member, record grant, authoritative record, selected role, deployment/key metadata and envelope-head locks; audit-head acquisition comes last. `FOR SHARE` prevents non-key revocation updates from passing the captured authority rows. Clock-based expiry and consent are rechecked after waits. No provider call or separate-pool audit decision is made while the mutation transaction holds the audit head.

The host pins the transaction's constraint mode and a deferred constraint trigger checks expiry and consent at its commit. PostgreSQL lets a SQL caller change constraint timing; this is a guarantee of the fixed trusted executor, not an unchangeable boundary against a compromised login issuing arbitrary transaction statements. The host performs a further fixed current-commit check before clearing context and committing. It never accepts caller SQL or transaction callbacks.

Ticket retirement follows COMMIT or ROLLBACK because ticket binding locks its row. A lost COMMIT response or failure in post-commit cleanup can leave a durable write despite an exception. The fixed error then carries only an exact operation/request-digest recovery binding. Freshly authorized receipt lookup resolves that uncertainty. Changed candidates sharing an operation ID are rejected. Re-encrypting identical plaintext generates different ciphertext, so a caller must not treat a new `store` invocation as an automatic idempotent replay.

## Consequences

The database now provides persistent key-version metadata, revision identity, atomic envelope rotation, and storage audit semantics for this narrow bridge. Existing record JSON, original corpus bytes and historical plaintext are unchanged. The modules remain disabled and unmounted. Real provider authentication, current key-use authorization/audit adapters, production binding, transport, deployed recovery, current retention/hold policy, and an independent anti-rollback anchor remain separate integration work. Authorized processes and operators can access plaintext; this is trusted server processing, not end-to-end encryption or certification.

See [operating contract](../security/encrypted-content-persistence.md) and [persistence evidence](../evidence/GDN-026/persistence.json). The earlier [component ADR](0018-trusted-encryption-boundary.md) and its evidence retain their original scope and test history.
