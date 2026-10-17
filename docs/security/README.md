# Security assurance baseline and canonical-standard gap

The canonical End-To-End-Everywhere standard has now been located and pinned to Git commit `ddfbd40c47d13890ebb81ea91c81fe329417058e`. See [canonical reconciliation](canonical-reconciliation.md) and the [machine-readable crosswalk](standard-crosswalk.json). Existing controls below are **proposed application requirements**, not conformance, assessed cryptographic profiles, or certification. The upstream standard is undergoing Audit v2 remediation; GDN-190 independently assesses implementation before sensitive production.

The seven concrete classes, permission/processor boundaries, thirteen risk scenarios, and fail-closed release expectations are now specified in [data classification](data-classification.json) and the [threat model](threat-model.md). These are static specifications, not deployed security controls or third-party assurance.

## SEC-01 - Identity and assurance

Verified issuer/audience, secure session lifecycle, step-up for privileged operations.

PRs: GDN-021,GDN-022. Required evidence: Login, recovery, session fixation and revoked-device tests.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-02 - Authorization everywhere

Default deny at data/API/storage/search/media/export/notification/worker/collaboration layers.

PRs: GDN-024,GDN-025,GDN-031. Required evidence: All-role data-class matrix with cross-user canaries.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-03 - Data and key separation

Project/environment isolation, runtime versus migration roles, managed key lifecycle.

PRs: GDN-012,GDN-013,GDN-026. Required evidence: Wrong-project, pool contamination, rotation, KMS outage and restore tests.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-04 - Sealed E2EE

Recipient-controlled keys, ciphertext server storage, no server plaintext search or AI.

PRs: GDN-027,GDN-028. Required evidence: Browser/server egress canaries and independent crypto assessment.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-05 - Purpose and consent

Research, preservation, display, identity and endorsement permissions are separate.

PRs: GDN-029,GDN-139. Required evidence: Consent matrix, publication race and derivative withdrawal tests.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-06 - Untrusted archival inputs

Quarantine and sandbox file parsing, no network/macro execution, bounded resources.

PRs: GDN-041,GDN-077,GDN-079. Required evidence: ZIP bomb, path traversal, XML entity, SSRF and converter timeout tests.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-07 - Publication and retraction

Independent state gates, public projection and deny-first withdrawal.

PRs: GDN-034,GDN-043,GDN-126. Required evidence: Stale index/CDN/export/preview resurrection tests.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-08 - Integrity and audit

Tamper-evident action records, immutable source lineage, actor and reason attribution.

PRs: GDN-030,GDN-048. Required evidence: Hash-chain/recovery, missing-row and reclassification audits.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-09 - Sensitive contributions

Restricted defaults, complete redaction and explicit legal/ethical safeguards.

PRs: GDN-136,GDN-138,GDN-145. Required evidence: Hidden text/EXIF/media track and insider access tests.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-10 - AI boundaries

Read-only tools, permission-first retrieval, no sealed data, bounded provider handling.

PRs: GDN-166,GDN-168,GDN-170. Required evidence: Prompt injection, cross-user retrieval, secret egress and cost ceiling tests.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-11 - Supply chain and deployment

Least-privilege CI, checked artifacts, actual merge policy and environment isolation.

PRs: GDN-010,GDN-011,GDN-018,GDN-020. Required evidence: Fork secret denial, exact-SHA checks and failed migration drills.

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## SEC-12 - Retention and recovery

Purpose-based lifecycle, scoped holds, restorable backups and deletion replay.

PRs: GDN-032,GDN-183,GDN-184. Required evidence: Restore after withdrawal, key loss and truncated component tests.

The partial GDN-032 implementation includes [strict request state transitions](lifecycle-requests.md), an [authenticated requester host](lifecycle-request-host.md), [transaction-bound PostgreSQL request receipts](lifecycle-request-storage.md), and [scoped retention and hold contracts](retention-policy.md). Request intake is distinct from authorized deletion or export. Operator decisions, current delivery tombstones, complete derivative inventory, durable hold controls and physical disposal still require implementation and verification; the pure dry run grants no purge authority. The [retained dependency inventory](lifecycle-dependencies.md) adds bounded typed metadata closure against a supplied manifest and denies completeness when evidence is missing or exceeds bounds. Exact candidate tests, actual requester CI, isolated staging and deployment limits are in [GDN-032 evidence](../evidence/GDN-032/acceptance.json).

Canonical mapping: pinned subject-area documents only; requirement-level mapping, implementation and independent verification remain pending.

## Explicit trust limits

TLS and storage encryption do not make a service operator unable to read server-processed data. Sealed mode must say what metadata is visible, who controls keys, what a compromised endpoint can expose and what lost keys mean. Revoking a recipient cannot erase plaintext already read or copied. An ordinary browser-served E2EE client also trusts the delivered client code; pinning, integrity, update controls and independent review must address that threat honestly. No claim of absolute anonymity, irreversible erasure from public copies, unbreakable encryption or perfect security belongs in the product.
