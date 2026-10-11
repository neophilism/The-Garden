# GDN-029: consent, purposes and derivative limits

## Actual boundary

This implementation is a server/domain/PostgreSQL foundation. It does not open a contribution form, claim an individual's legal capacity, verify guardianship, or publish an archive. Consent administration and pipeline admission are unmounted and disabled by default. Their trusted authorizers must check workspace scope and, for human privileged operations, recent step-up under GDN-022 before activation. Synthetic CI authorizers are not actual MFA.

Consent is independent of membership/access, copyright/licensing, research verification, editorial approval and lawful administrative authority. A successful use receipt deliberately says `publicationApproved: false`. The public research projection and retraction systems remain separate work items.

## Five separate purposes

`preservation`, `research`, `public-display`, `name-attribution` and `promotional-endorsement` are distinct. Grants contain exactly one purpose, a represented subject, an authenticated grantor reference, exact immutable terms ID/version/digest, an evidence digest, an effective interval, and an explicit derivatives permission. A grant is not a way to enroll in The Garden or express political support by default.

A self grant must identify the same grantor and represented subject. A guardian grant must identify a distinct grantor, an authority evidence digest and an independently enforced authority expiry. The software checks these structures; an authorized reviewer must actually evaluate the evidence. No biometric, racial or ancestry inference establishes authority.

For a resource representing multiple subjects, **all** required subjects must have a matching current grant. Research does not imply preservation; preservation does not imply publication; publication does not imply permission to name a living contributor or reuse their account as an endorsement. Terms upgrades require matching new evidence. Terms cannot silently roll back to revive older permissions.

## Fail-closed resource policies

Every research record requires a reviewed use-policy entry before it is visible through forced RLS. Missing/unreviewed policies deny access even if membership and record grants are valid. There is no automatic backfill of consent for existing data. An older staging corpus must remain withheld until its policies have actually been reviewed.

A policy may require consent, record an explicit purpose-limited determination that consent is not required, or inherit its limits from declared inputs. An exemption requires an evidence/reason digest and does not grant licensing or publication clearance. It cannot grant promotional endorsement. Only the dedicated consent administrator can register policies; a researcher cannot self-label a contribution exempt.

An input graph is scoped to one workspace, bounded to 32 levels and 256 visited path references, and checked for cycles. Each derivative inherits the intersection of the permissions of its inputs, including the `derivativesAllowed` flag. Dependencies cannot later be removed to evade a withdrawal. A consent-required resource cannot be converted to an exemption or have required subjects silently deleted.

The registry covers explicitly declared incorporation/derivation, not a magical detector of copied prose or identity. Importers, transcribers, image processors and publication builders must declare all source inputs before a use policy is granted. Scholarly association is not automatically a derivative license. GDN-039/041/043/139 must verify actual lineage, rights and published attributes against these declarations. Until that integration is tested, sensitive ingestion/publication stays off.

A consent-bearing source's payload cannot be replaced in place. Redaction, alternate media and materially changed submissions receive new derivative identities; immutable originals and the original consent record remain distinguishable.

## Withdrawal and expiration

Withdrawal identifies a subject/resource/purpose through a grant ID and withdraws all grants already recorded for that purpose. This prevents an older overlapping grant from resurfacing after the newest grant is withdrawn. It leaves other purposes alone. Repeating the same withdrawal is idempotent and does not cancel a later, newly evidenced consent.

Grant and guardian expiry are checked at each authoritative decision. Existing pooled research contexts see a committed withdrawal on their next statement. Search results, counts, facets, historical revisions and the existing authorized delivery repository inherit the restrictive RLS boundary. Delivery additionally reauthorizes after reading bytes before returning them.

This does not erase plaintext already obtained, prevent a recipient from retaining a copy, or retract copies already on the public internet. CDN/index/export retraction, contributor-facing requests and retention/legal-hold processes remain GDN-032/034/126/139/185 obligations, not capabilities claimed by this PR.

## Transactional pipeline admission

`createPermittedUseTransactions` requires a dedicated publisher or preservation-worker pool, a trusted authorizer, and explicit activation. The publisher can request only display/attribution/endorsement; the preservation worker has a fixed preservation purpose. Neither may query raw private records through the consent functions.

The use gate, grant/term-policy updates and withdrawal acquire the same workspace transaction lock. A withdrawal that wins admission first causes the later operation to fail. A use transaction already admitted serializes ahead of withdrawal. The wrapper rechecks both authority and current consent after its database-only callback, immediately before commit; expiry during the callback rolls back staged writes.

The decision is linearized at the authoritative database admission check, not promised to remain valid forever after commit. The callback may only write through its supplied database transaction. It must not perform external publishing, storage uploads or notifications: those cannot be rolled back and need the later publication/retraction protocol. An old receipt is an audit reference, not a signed URL, reusable authorization token, or substitute for current permission.

## Administration, history and credentials

`garden_consent_admin` is a NOLOGIN/NOINHERIT/NOBYPASSRLS capability role. Its login must be disjoint from query, context issuer, membership, publisher, worker and migrator capabilities. The ordinary research executor now rejects a login also holding this role. Mutation functions take fixed typed arguments, not caller SQL. Tables are not granted directly to runtime principals.

Consent terms, grants, withdrawals, dependency edges, use decisions and policy revisions are append-only under ordinary DML. Mutable heads point to preserved policy versions. These controls are not a defense against a database owner who can disable triggers or replace functions. Tamper-evident independent audit anchoring is GDN-030/048; no certification is asserted here.

Requirements, never values: a distinct `GARDEN_CONSENT_ADMIN_DATABASE_URL`, the verified identity/privilege authorizer, scoped publisher/worker pools and protected storage for consent/guardian evidence. No new secret is provisioned by this PR. Do not store evidence plaintext in logs or public metadata; hashes and opaque IDs are not publication clearance.

## Verification and rollout

Run framework-free consent, administration, pipeline and policy-executor tests with the project Node 24 runtime. `apps/research/access/consent.ci.mjs` exercises real PostgreSQL under five separate login roles using synthetic subjects, inputs and expiring grants. It tests live RLS, the permission matrix, stale policies, derivatives, guardian expiry, history immutability and concurrent withdrawal/admission. Existing RLS/data fixtures explicitly register a synthetic no-personal-consent research basis; the helper refuses non-CI or cloud hosts.

Migration `0009_purpose_consent.sql` is additive and checksum-locked. It intentionally withholds older records lacking a use policy; no consent is guessed. Apply only through the authorized staging migration workflow after CI and restore planning. No Neon migration, cloud service, real contributor or production release is asserted by source-code completion.

Use receipts pin all relevant policy revisions. An idempotent retry must revalidate current permission and match the original policy-version set; a changed policy needs a new request ID. Receipts are audit evidence, not transferable use tokens.
