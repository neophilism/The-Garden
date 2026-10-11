# Scoped review states - GDN-039

## What is implemented

Seven independent dimensions describe acquisition, transcription, evidentiary review, rights, consent, accessibility and publication. `rules.json` is the explicit version-1 vocabulary; migration 0011 installs the identical closed graph in PostgreSQL. Tests compare the two. There is no VERIFIED badge, probability, score or whole-work completion inferred from one dimension.

`createReviewRepository` is an unmounted server boundary using the existing identity/policy executor. PostgreSQL independently binds the actor from a one-use transaction ticket, current membership/grants and purpose permission. Request bodies cannot select an actor, role, reviewer authority or publication capability. No account, research or governmental route is activated by this implementation.

An editor registers an exact typed `record_revisions` revision. The scope records all known authors up to that revision plus its owner. Nonempty revisions lacking attributed authors make authorship incomplete, preventing independent outcomes. A scope covers precisely one record revision, not a book, archive, community or wider set of sources. Sections/pages must first be represented as properly scoped records with locators; an imported interval never certifies unexamined material.

The scope digest profile is **postgres-jsonb-text-sha256**, computed by PostgreSQL over the stored working payload. This is not the immutable original-file digest used by archival storage, not a cross-engine canonical JSON claim and not a credential. A changed record version requires a separate scope and cannot inherit the old release recommendation.

## Decisions, assignments and independence

Every action checks the expected global board version and prior state, under row locks. A positive independent review requires a current reviewer assignment, complete recorded authorship, no recorded author conflict, accessible evidence pinned to exact revisions, and the required actual database role. A stale assigner/reviewer membership or grant version invalidates the assignment receipt.

The existing foundational `assign_reviewer` routine remains available for compatibility, but its output alone has no GDN-039 decision authority. A separately protected receipt is issued only by `assign_scoped_reviewer`, which derives the issuing editor from the bound context. Directly creating an old-style assignment cannot create this receipt or bypass the author conflict set. Non-assignment stages cannot attach unrelated assignment IDs as apparent proof.

This prevents known self-review; it does not reveal undisclosed coauthorship or prove a person's expertise. Credential checking, external expert review, editorial governance and the independent release gate remain separate work.

## Consent, rights and publication

The consent dimension records that a basis was reviewed; it grants no permission. Positive consent states require current actual permission for `public-display` with a compatible basis. The purpose-permission engine is rechecked for every returned snapshot. A withdrawal can therefore invalidate release eligibility without rewriting an earlier consent observation. Rights and consent are separate dimensions.

A publication state of `ready-for-release-review` requires all six other dimensions, current content, complete authorship, an independent editor and live public-display permission. It is a recommendation for a **separate release decision**, not a public write. `publicationReleased` and the presentation model's `publicationApproved` remain false. No public projection, permission grant, legal eligibility or government status is created.

## History, imports and disputes

Events and scope definitions are append-only. A read-authorized participant may append a reasoned dispute to an existing decision; the old event remains visible and the relevant dimension becomes `disputed`. Retesting returns through the explicit graph, never edits or deletes a past review. Concurrent writes on one expected version produce exactly one success.

Imported labels retain the exact namespace and verbatim text, including labels such as VERIFIED or an unknown vocabulary. They append observations but do not alter states. Imported original status is evidence about the source's assertion, not an endorsed conclusion.

History is numeric-keyset paginated and rechecks access to its parent and cited evidence. Losing access to evidence fails the dependent snapshot/history closed rather than revealing hidden citations. A user unable to read decision evidence must use a separately authorized editorial process; this API does not substitute a secret bypass for that process.

The server's audit ledger receives closed action codes and opaque identifiers. Review rationale, imported labels and personally meaningful source text are not copied into general audit events. Database-role immutability is not independent external anchoring or a guarantee against a malicious database owner.

## Display and evidence

`ReviewStatusPanel` renders an already authorized snapshot as an accessible definition list with a separate heading per instance. It clearly shows earlier-revision reviews and invalidated release recommendations. It contains no score or implicit publish action. Browser fixtures compile and render the actual component and test partial, ready, stale and withdrawn-permission states in desktop Chromium, mobile Chromium and Firefox, with axe results retained by the existing workflow.

Unit/property tests enumerate all state edges, author conflicts, role/assignment failures, strict versions, unknown imports, partial displays, malformed responses and history pagination. `reviews.ci.mjs` uses real ephemeral PostgreSQL, separate isolated capability logins and synthetic identities/records. It exercises SQL guards, concurrent changes, raw-write denial, scoped history, current permission, revoked assignments, changed source revisions and the audit chain. Until CI succeeds, these are candidate tests, not successful execution claims.

## Rollout and rollback

Migration 0011 is additive, immutable in the migration ledger and applied only through the existing target-bound runner. Nothing in this change authorizes applying it to production or uploading the historical corpus. On a failed rollout, keep the endpoints disabled and revert the application artifact while preserving review events, original records, withdrawals and audit history. No destructive down migration or reclassification of imported reviews is permitted.
