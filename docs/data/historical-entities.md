# Historical entities and relationships (GDN-035)

## Scope and trust

This is a working-research data kernel and RLS-backed repository, not a public atlas, an entity-resolution oracle, an accepted historical interpretation, or a live Neon migration. Research routes remain unmounted. Tests use synthetic subjects, names, and sources; no family or historical corpus data is imported.

Nine explicit entity kinds distinguish person, polity, people, language, place, port, institution, voyage, and event. UUIDs do not change when names change. A port is not silently treated as a people or nation; a catalog label is not an ancestry determination. Supported relationship predicates constrain the kinds of both endpoints and preserve a proposed or contested assessment separately from a claim of historical truth.

## Canonical representation

`packages/domain/src/historical/model.mjs` validates closed objects and makes immutable returned copies. Unknown values must be explicit nulls. Names retain exact Unicode, original spelling, language/script labels where known, usage and source-locator references. Normalization is not applied to canonical source text. Temporal bounds are explicitly authored astronomical-year coordinates with the original date text and calendar retained; bounds do not manufacture a precise date. No `verified` field is accepted.

The model preserves append-only source identities. Normal name corrections create a new version; a merge never moves or discards aliases, external source IDs or relationships. Merge is an explicit redirect decision with rationale and evidence. It requires two same-kind canonical entities and write access to both. Unmerge removes the current redirect, not the prior decision from history. Same-name records are never automatically unified.

References currently use stable source UUIDs and verbatim locators. Source/witness existence and exact-content locators belong to GDN-036 and GDN-038. A structurally valid reference is not a verified or publication-cleared citation.

## Persistence and API boundary

`createHistoricalRepository(executor)` in `apps/research/data/historical-repository.mjs` implements `read`, `initialize`, `revise`, `merge`, `unmerge`, and paginated `history`. The executor is the existing server-bound, short-lived, disjoint-login policy executor; do not replace it with caller-provided subject or role fields. Every mutation supplies an expected decimal-string revision. Merges take both revisions, acquire row locks in stable UUID order, and fail closed on conflicts. Unknown/denied resources are not distinguished to callers.

Intake must first create a classified record envelope and explicit grants through an authorized workflow. This repository deliberately cannot create its own privileges or envelopes. It can initialize a previously empty writable envelope. It cannot activate quarantined, sealed, personal, licensed or governmental records under the present research-only policy.

The additive `0005_historical_records.sql` migration adds database core-shape/type/reference guards and a version journal. Existing envelope UUIDs, workspace boundaries and permissions remain authoritative. The `entities`, `names`, `relationship_assertions`, and `redirects` views use security-invoker/security-barrier options, so the base-table RLS remains effective. Relationship/redirect delivery checks endpoint access again; history is subject to present access, not former grants. Pagination returns `nextBeforeRevision`; it does not claim the first 50 versions are the complete history.

`record_revisions` is append-only for the runtime. A trigger records the actual bound subject, version and payload in the same transaction as each insert/update. It is not cryptographically tamper-evident against the schema administrator and is not GDN-030 security-audit completion. Owner/admin capabilities and retention policy need their later independent controls. No existing record is backfilled or declared reviewed by this migration.

## Verification and deployment

Run the 49 domain fixtures with `node --test tests/data/*.test.mjs`. The data workflow runs the exact locked Node 24 environment and PostgreSQL 18, applies the migration twice, exercises real least-privilege logins, concurrent opposite merges, alias restoration, source-identity preservation, journal write denial, endpoint revocation, and paginated history. Existing identity, delivery, storage, application, accessibility/browser and security-policy checks remain required.

The container only has Node 22; local all-application tests pass using `--experimental-strip-types`, but exact Node 24 acceptance must come from CI. No independent security or historical review is asserted. No Render service is deployed. No production or staging Neon migration is applied by this PR.

## Rollback

Disable/unmount the repository and revert the application change while retaining record envelopes and the additive version table. Do not delete source histories, replay historical corpus migrations, or introduce a destructive down migration. Restore and publication activation remain separate release gates.
