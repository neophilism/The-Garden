# GDN-005: threat model and data classification

## Trust boundaries
Anonymous site -> published read model only; authorized researcher -> application policy and restricted database/private store; contributor -> case service and separate consent controls; verified endpoint -> sealed ciphertext relay (not a plaintext processor); operator -> redacted audit/telemetry. The optional AI assistant sees only already-cleared public research until a separately reviewed retrieval and vendor contract exists. Official enrollment is disabled until law/authorization.

Classification is a policy contract, not a running access-control engine. Actual services must enforce deny-by-default at database, API, object, index, cache, worker and exports, and independent tests must demonstrate isolation. Public rights can be withdrawn in the controlled system, but external copies cannot be guaranteed erased.

## Attacker and failure model
Malicious uploaders, misidentified evidence, insiders, credential leakage across services, source-poisoning, stale derivative caches, browser-build tampering, false historical or fiscal assertions, AI prompt injection, data brokers and operators with overbroad access. The versioned JSON register assigns thirteen explicit threats to planned tests and PR owners.

## Security constraints
Server-managed research encryption is not end-to-end encryption; clients trusted for sealed content must be independently assessed and keys never supplied to an AI service or public index. No unreviewed private family material is accepted in production. Staff authorizations and provenance must remain distinct from consent and approval to publish.

## Release gates
Public read-only content requires editorial/legal/fiscal reviews; private collaboration requires privacy and access-control verification; sealed storage additionally requires independent cryptographic assessment; governmental tools additionally require enacted authority and a new, isolated assessment. No security certification or review is asserted here.

See `data-classification.json`, `standard-crosswalk.json`, and `tests/architecture/test_data_classification.py`. These define implementable acceptance boundaries for subsequent PRs.
