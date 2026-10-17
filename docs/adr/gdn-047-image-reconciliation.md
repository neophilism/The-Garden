# GDN-047 decision: separate per-edition media evidence from publication

Status: implementation candidate; local source-bound verification recorded separately from deployment.

The image migration uses a read-only DOCX scanner, a deterministic evidence projection and an append-only private offline journal. It does not infer a global latest asset count from one legacy table. Documents, media members, distinct image bytes, stored image references, rendered placements and review receipts are separate units.

Actual current-document inspection showed why this distinction matters: CP-021 edition 1.33-alpha contains 607 media members and 630 stored placements, differing from both older count pairs in the approved plan. The approved acceptance criteria remain useful regression cases and are tested with explicitly synthetic fixtures. They do not freeze future manuscript counts.

Read-only comparison of the actual CP-017 and CP-021 databases found all 567 old image byte assets within the current document, plus 40 current members without a legacy asset row. CP-021's 1,221 stored placement rows belong to editions 1.18-alpha and 1.32-alpha. None binds the registered 1.33-alpha document digest. Preserving this discrepancy prevents an apparently plausible count match from silently changing provenance.

An exact SHA-256/length match links bytes across editions; it cannot resolve a caption, origin, depicted identity, rights claim, generated/archival status or placement. Exact placement correspondence requires the same document digest and an unambiguous source coordinate. All four legacy tables and every supplied annotation remain preserved with dispositions and unresolved findings.

The offline boundary fits the existing GDN-045 staging architecture and keeps originals and restricted metadata away from public surfaces while runtime integration proceeds. It provides a concrete scanner and report journal now, with trusted registry and operational asset-table adapters remaining explicitly pending. No new cloud schema, provider resource, paid service or public route is introduced.

Unknown rights deny public bytes by construction. A separate default-disabled, trusted byte guard requires fresh exact-version review and checks again after reading; it cannot treat inherited labels as authoritative review. Existing storage, delivery, purpose and encryption controls still apply when this guard is integrated. The report is evidence for review, not an authorization to publish.

See [the runbook](../runbooks/image-reconciliation.md) for contracts, limits, source custody, adversarial tests, deployment prerequisites and preservation-based rollback.
