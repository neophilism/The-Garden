## 20. Source register and verification limits

Sources are cited in the plan with stable bracketed IDs. Public technical references were consulted on 10 October 2026; pin and revalidate implementation versions before development. Library links may require authorized account access. No link grants reuse rights.

### P01 - Garden Act version 1.0, 28 September 2026

Location: `https://chatgpt.com/api/library/files/libfile_7407f777de7c8191a7bea622cfc52dd0/download`

Scope: Complete TEX text read through Files; proposed legislation, not enacted law. Particularly sections 201, 301, 401, 501, 801 and 1101-1102.

### P02 - Garden Act Source and Drafting Notes version 1.0

Location: `https://chatgpt.com/api/library/files/libfile_6ba7a0a59a788191aac8fb2d57a07b93/download`

Scope: Read/materialized; identifies numerical drafting defaults, legal uncertainty and fiscal qualifications.

### P03 - Current Documents registry and master latest index, CP-017

Location: `Library paths /Not-From-Nowhere_Current-Documents.json and /guide_Not-From-Nowhere_LATEST.html`

Scope: Read current versions 18 and 19 respectively before this plan; preserve research checkpoint on adding software-plan links.

### P04 - Not From Nowhere Work Log v1.17, 9 October 2026

Location: `https://chatgpt.com/api/library/files/libfile_2527a2e529888191bed399150b694b10/download`

Scope: Read complete work log. Recorded historic review/recovery claims are baseline reports, except separately repeated V01 checks.

### P05 - Corpus 1.17 CORE and component manifest

Location: `https://chatgpt.com/api/library/files/libfile_b2791b7ec790819190a1dcb5a58ecba5/download`

Scope: CORE materialized and verified. Other component sizes/hashes were read from current registry; not independently revalidated this turn.

### P06 - Not From Nowhere CHARTER.md, adopted 25 September 2026

Location: `docs/sources/research-charter.md`

Scope: Exact file extracted from verified CORE bundle; read in full. Included in handoff package, not silently rewritten.

### V01 - Local CORE/schema verification for this plan

Location: `docs/migration/source-schema-inventory.json`

Scope: Read-only immutable database inspection; 106 tables, 186 indexes, zero triggers, 923292 rows; integrity_check ok and no foreign-key violations. Not historical verification.

### S01 - Next.js self-hosting guide

Location: `https://nextjs.org/docs/app/guides/self-hosting`

Scope: Primary framework guidance; recheck supported version and hosting behavior when implementation begins.

### S02 - Next.js authentication guide

Location: `https://nextjs.org/docs/app/guides/authentication`

Scope: Primary guidance, not a substitute for selecting and verifying an actual identity engine.

### S03 - Node.js previous releases and support status

Location: `https://nodejs.org/en/about/previous-releases`

Scope: Node 24 LTS selected as planning baseline; pin current supported patched release at bootstrap.

### S04 - Render deploys documentation

Location: `https://render.com/docs/deploys`

Scope: Pre-deploy behavior and service availability are provider/plan-specific; verify actual entitlement. Failed deploy does not undo database changes.

### S05 - Render preview environments

Location: `https://render.com/docs/preview-environments`

Scope: Isolation, blueprint behavior and costs must be checked against authorized account resources.

### S06 - PostgreSQL 18 row security policies

Location: `https://www.postgresql.org/docs/18/ddl-rowsecurity.html`

Scope: Owners and BYPASSRLS roles require special consideration; application role tests are mandatory.

### S07 - Neon: PgBouncer and prepared statements

Location: `https://neon.com/blog/pgbouncer-the-one-with-prepared-statements`

Scope: Primary provider discussion of pooling; direct docs fetch was unsupported in this environment. Actual pool mode and limitations must be verified at bootstrap.

### S08 - IIIF Presentation API 3.0

Location: `https://iiif.io/api/presentation/3.0/`

Scope: Interoperability requirements limited to explicitly chosen supported profiles, not every optional IIIF feature.

### S09 - W3C Web Annotation Data Model

Location: `https://www.w3.org/TR/annotation-model/`

Scope: Selector and annotation model reference; exact content/version binding is still required.

### S10 - Yjs documentation

Location: `https://docs.yjs.dev/`

Scope: Collaborative data model reference; CRDT convergence does not itself implement authorization, encryption or durability.

### S11 - OWASP Application Security Verification Standard

Location: `https://owasp.org/projects/asvs`

Scope: ASVS 5.0.0 used as proposed supplementary baseline; not the missing user-specific canonical standard.

### S12 - OWASP Cryptographic Storage Cheat Sheet

Location: `https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html`

Scope: Use reviewed libraries, appropriate threat model and key separation; avoid custom crypto.

### S13 - OWASP Key Management Cheat Sheet

Location: `https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html`

Scope: Key lifecycle and recovery guidance; end-to-end mode has different operator capabilities.

### S14 - GitHub managing a merge queue

Location: `https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue`

Scope: Exact merge-group checks and account-plan availability must be verified for the target repository.

### S15 - W3C WCAG 2.2

Location: `https://www.w3.org/TR/WCAG22/`

Scope: AA is a proposed acceptance scope requiring complete-process and manual assessment, not automated certification.

