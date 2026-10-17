# ADR 0017: explicit authority and canonical routes for source acquisition

Date: 12 October 2026. Status: GDN-085 merged implementation; production acceptance pending.

## Decision

Implement an **offline, private, default-disabled** acquisition workflow on top of GDN-078's bibliographic discovery leads and the existing identity, consent and archived-source foundations. Require immutable task records, a canonical repository/item route independently resolved by trusted code, named authorizations scoped to the request, and append-only access-denial and contact-receipt ledgers. Do not add an outbound mailer, archive crawler, paid API, accounts, payment processor or automation. The public policy Git repository must not become a private research correspondence store.

A user-provided route alone is not a reliable deduplication key: changing an alias could evade prior denials or contact receipts. The server must resolve a stable route from currently authorized protected repository/item identifiers. Approved correspondence is an **authorization state**, not proof of actual contact; a contact receipt is a separate, manually attested record. A quoted price is not a payment instruction. Grant evidence must come from an independently trusted operator verifier, never client-supplied `approved=true` or a newly invented signer label. The approval requires a second person and matches the exact action, budget bound, route, workspace, subject and current expiration.

An access-denied, robots-disallowed or paywalled observation is an immutable route barrier. `catalog-not-found` and deferred offline access must never be relabeled as historical nonexistence. No retry-to-evade API is included. A future reviewed route-unblocking protocol, if legitimate, must preserve the original refusal, provider terms, new authority and audit events before any new contact. Same-route repeated contacts are prevented by workspace-scoped unique storage constraints, not only process-local flags.

## Trade-offs

SQLite gives a small, durable, local synthetic implementation without allocating cloud resources or inventing live RLS. It is not a secure multi-party production collaboration database. A future server adapter must preserve authorization and auditing at every read, response, database revision and external delivery path; adding a production route is a separate gated implementation. A multi-source alias can still be dangerous if the trusted route resolver is incorrectly implemented; independent source identity reconciliation, provider policies and regression tests are release gates.

## Acceptance

The immutable storage/checksum and 85 synthetic tests cover stated local invariants; actual provider identities, human grant verification, recovery, contact permission and real deployment remain open. This work is not a review of any historical claim and performs no outbound operation. See [operating and activation contract](../data/source-acquisition-queue.md).
