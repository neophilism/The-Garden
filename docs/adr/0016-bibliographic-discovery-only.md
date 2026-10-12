# ADR 0016 — bibliographic leads are not archival source records

Status: proposed; GDN-078 implementation under review (12 October 2026).

Do not conflate a citation, an archive catalog entry or a DOI record with a directly inspected source or an independently verified historical claim. Model an `acquisition_candidate` separately from GDN-036 archival units/sources and GDN-037 claims. Keep submitted raw metadata, normalized search hints, exact SHA-256, and provider/license/access/locator claims. Never automatically merge same-title or matching-DOI editions. Require human reversible decisions with append-only history.

Preserve a deny-first, default-disabled boundary for new research intake. Use the established audited decision/identity bridge and an owner/workspace-scoped, local durable SQLite service outside application and repository roots. The new service does not assume that the public GitHub repository or GDN-077 quarantine upload grants anyone permission to ingest, cite or republish third-party archives. No provider network adapter is enabled; a trusted DOI-only callback must enforce its own terms, robots/access and egress policy. Report refusal/timeout as unknown discovery status, not negative historical evidence.

SQLite is selected for bounded local acceptance with no additional infrastructure or budget, rather than pretending new cross-user Neon migration and provider staging were accepted. Production shared research, backup/restore and long-lived permission-scoped collaboration remain activation work. Future promotion from a bibliographic candidate to an archival-source record must be a separate audited review transition that keeps the source's original identity and provenance.

Trade-off: strict format parsing intentionally rejects some legitimate complex BibTeX macros and unusual RIS/CSL fields. Raw original metadata is preserved for later curator interpretation; automatic normalization never guesses away ambiguities. The public orientation app remains unchanged by this internal candidate service. Rollback disables it without deleting the append-only original and decision data. See [implementation and tests](../data/bibliographic-intake.md).
