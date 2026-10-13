# GDN-078 — repository links and bibliographic intake

Status: merged in PR #48; unmounted/default disabled, not independently accepted. Date: 12 October 2026.

## Purpose and provenance

A bibliographic record, catalog entry or DOI lookup is a **discovery lead**, not an inspected archival object or an independently verified historical claim. This feature keeps the original per-item metadata (and exact SHA-256), selected normalized search fields and explicit attribution together. The submission-level SHA-256 identifies retries of the entire import. It never upgrades a lead to a `source`/`archival-unit` (GDN-036), a verified atomic claim, a reviewed right, or public content.

The domain parser is `packages/domain/src/historical/bibliography.mjs`. It supports RIS, a bounded literal-only subset of BibTeX, CSL JSON and a single manual CSL-like record. It rejects macros, malformed/oversize input, forbidden URLs and unsupported formats rather than guessing. Normalization is deliberately narrow: title, type, authors, publication year, edition, container title, publisher, DOI, citation URL and language. It leaves unmatched fields and uncertain spellings in the original record rather than inventing values. Year is a search aid, not a validated date. DOI/citation URLs remain **inert strings**; never supply them directly to a server-side fetcher.

The attribution envelope records provider, repository ID (nullable), exact locator, stated license, access category and retrieval timestamp (nullable). Input authors can assert these statements, but they are not independently validated rights determinations. Unknown license is explicit, not silently deemed open. RIS/BibTeX/citation providers retain distinct original raw records; same-title/same-DOI decisions never merge records automatically. Editions and witnesses remain independent until a named, reversible human decision establishes a proposed correspondence.

## Security and durability boundary

`services/workers/src/bibliographic-intake.mjs` requires the existing durable audited `decisions.decide` interface, trusted current-workspace authorization, a private repository and an explicit `enabled` gate that defaults to **false**. It rechecks the observed subject/workspace and record permission at admission, before mutation and before delivery. The client cannot supply subject identity or filesystem path. Access to a candidate is scoped to its submitting subject and workspace; cross-owner reads and duplicate decisions are rejected. Future reviewer sharing requires a separate role-and-grant design, not a broad SQL query.

`createPrivateBibliographicRepository` stores `submissions`, immutable `acquisition_candidates`, and append-only `duplicate_decisions` in a private SQLite file outside the source/web tree. It requires a real owner-controlled 0700 directory, rejects symlinks and weak mode, uses 0600 database permissions and `synchronous=FULL`, checks migration schema version and uses serial write transactions. A stable submission UUID plus the exact payload SHA-256 prevents changed-content replays. Duplicate decisions are recorded as separate, superseding events; no original metadata is rewritten. SQL triggers deny updates/deletions of candidate and decision rows. Receipt IDs are the audited decision IDs; these are not claims of independently certified tamper resistance.

For provider lookups the optional `createDoiLeadResolver` only passes a validated DOI to a **trusted injected provider adapter** configured by the operator. The module does not make HTTP requests, follow arbitrary catalog URLs, evade robots rules, or create subscriptions; the adapter must enforce its own network allowlist, provider access terms and caching restrictions. Timeout, access denial, robots refusal, rate limiting and missing results are reported as failures/unavailable leads. They do not create candidate records, infer that a source is absent or return remote metadata as verified evidence.

## API (trusted unmounted adapter only)

- `submit(headers, workspaceId, {submissionId,format,raw,attribution})`: creates owner-scoped private leads, idempotent with unchanged bytes.
- `list(headers, workspaceId, {afterId,limit})` and `detail(headers, workspaceId, {candidateId})`: currently only the original submitting subject, never a public endpoint.
- `lookupDoi(headers, workspaceId, {submissionId,provider,doi})`: uses an explicitly configured trusted provider adapter; metadata is stored as unreviewed CSL discovery leads only on authorized success.
- `decide(headers, workspaceId, {eventId,firstId,secondId,decision,reason,supersedes})`: records `duplicate`, `distinct` or `unresolved` decisions. New decisions must supersede the latest event rather than rewrite it. `history` lists the append-only decision chain.

Every method fails closed when disabled, unauthorized, incorrectly scoped, cancelled, malformed or unaudited. There are **no mounted public endpoints, provider network credentials, real-provider tests, archival-source promotions, production writes, data migrations or live deployment** in this implementation. It is a local durable integration with synthetic acceptance fixtures.

## Rollout/rollback and verification

1. Verify a real private storage directory, backups and encrypted volume, operational audit service, current identity/context permission adapter, maintenance/quotas, provider access agreement, and repository-specific privacy policy. Obtain authorization before new costs. Never use a public repository directory for source metadata.
2. Add a versioned operational interface for cross-process SQLite coordination and backup/snapshot restore; consider the existing protected PostgreSQL research context if collaboration at scale requires server-side shared workflows.
3. Wire only an approved authenticated research route after negative-access, rights, cancellation, malformed-file, duplicate and actual catalog-network tests pass. Keep the feature disabled until independently accepted.
4. For rollback disable `enabled`, stop accepting new sources, preserve the append-only stored decisions and originals, and restore tested backups. Do not destructively roll back user metadata or label existing leads as verified.
5. Reproduce local synthetic checks: `node --test tests/data/bibliography.test.mjs tests/storage/bibliographic-intake.test.mjs`. The established CI tests include these through the data and storage globs. CI evidence is recorded for an **exact Git SHA**. Live verification and independent review are separate acceptance tasks.

GDN-078 acceptance mapping: AC01 discovery leads remain unreviewed; AC02 license/access statements remain explicit and provider errors cannot become successes; AC03 duplicate decisions are reversible append-only. Tests address malformed format, same-title/different-edition, timeout/robots/access denial, per-subject denial, digest replay, SQLite restart and schema drift.
