## 18. Complete pull-request execution catalog

The 210 identifiers below are planned integration units, not opened GitHub PRs. PRs 001-196 form current public/research scope. PRs 197-210 are conditional governmental work. Each acceptance criterion and test has a stable ID in plan.json and its per-PR file. All tests listed in PR specifications are future application tests, not tests reported executed in preparing this plan.

### P00 - Decisions, evidence and execution contracts

#### GDN-001 - Repository charter and complete feature contract

**Status:** planned. **Owner:** Technical lead / product architect. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F01, F24, F38, F41. **Direct dependencies:** None. **External gates:** X01.

**Scope and outcome:** Preserve the 43-function inventory, user standing instructions, research independence and conditional-government scope in versioned repository documents. Separate product, research, engineering and production acceptance.

**Data/API/contract:** docs/product/charter.md and AGENTS.md are governing artifacts, not implementation evidence.

**Acceptance:**

- `GDN-001-AC01`: All 43 features have stable IDs and owners.
- `GDN-001-AC02`: Scope explicitly excludes automatic citizenship and racial persuasion targeting.
- `GDN-001-AC03`: Another agent can find the plan without chat history.

**Tests to implement:**

- `GDN-001-T01`: Feature inventory snapshot test.
- `GDN-001-T02`: Documentation link check.
- `GDN-001-T03`: Scope and standing-rule coverage review.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Documentation-only initial commit; retain the prior charter on revision and record reasons for changes.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-001/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-001-repository-charter-and-complete-feature-contract`.

#### GDN-002 - Baseline evidence and source-access manifest

**Status:** planned. **Owner:** Technical lead / product architect. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F24, F33, F38. **Direct dependencies:** GDN-001. **External gates:** X09.

**Scope and outcome:** Inventory current Garden policy, CP-017 documents, all four corpus components, charter, exact hashes and access limits. Preserve original sources and distinguish inspected bytes from baseline-reported status.

**Data/API/contract:** baseline-artifacts.json records source IDs, versions, hashes, bytes, rights, access and verification depth.

**Acceptance:**

- `GDN-002-AC01`: CORE verification is reproducible.
- `GDN-002-AC02`: Every expected artifact is located or explicitly unresolved.
- `GDN-002-AC03`: No historical assertion is marked verified by archive integrity.

**Tests to implement:**

- `GDN-002-T01`: Checksum and truncated ZIP fixtures.
- `GDN-002-T02`: Database reopen fixture.
- `GDN-002-T03`: Missing-component and stale-version tests.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Read-only inventory; never replace a source or rerun inherited research migrations.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-002/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-002-baseline-evidence-and-source-access-manifest`.

#### GDN-003 - Canonical security-standard reconciliation

**Status:** planned. **Owner:** Technical lead / product architect. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F37, F40. **Direct dependencies:** GDN-001. **External gates:** X02.

**Scope and outcome:** Retrieve the actual End-To-End-Everywhere standard, pin its revision, compare every required data flow and record differences from this proposed security baseline.

**Data/API/contract:** docs/security/standard-crosswalk.json includes canonical source, version and unresolved gaps.

**Acceptance:**

- `GDN-003-AC01`: Canonical requirements are pinned and mapped when accessible; otherwise the delivered gap register explicitly distinguishes the proposed baseline from unverified canonical controls.
- `GDN-003-AC02`: No claim of compliance precedes assessment.
- `GDN-003-AC03`: Missing canonical verification is enforced as an external gate for sensitive production rather than disguised as a passed assessment.

**Tests to implement:**

- `GDN-003-T01`: Crosswalk completeness test.
- `GDN-003-T02`: Unmapped-control failure fixture.
- `GDN-003-T03`: Security architecture review.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** No invented standard; public-only development may proceed with proposed controls while sensitive release stays blocked.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-003/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-003-canonical-security-standard-reconciliation`.

#### GDN-004 - Existing engines and external contract discovery

**Status:** planned. **Owner:** Technical lead / product architect. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F23, F29, F37, F41. **Direct dependencies:** GDN-001. **External gates:** X03, X06.

**Scope and outcome:** Inspect authorized reusable identity, storage, encryption, notification and Engine Room engines before implementing duplicates. Record real APIs, ownership, versions and license constraints.

**Data/API/contract:** integration-inventory.json records verified resource identities and proposed adapters separately.

**Acceptance:**

- `GDN-004-AC01`: Every reused component has an actual contract or explicit pending status.
- `GDN-004-AC02`: Distinct products remain separate repositories.
- `GDN-004-AC03`: No unrelated Neon credentials or databases are reused.

**Tests to implement:**

- `GDN-004-T01`: Consumer-contract fixtures.
- `GDN-004-T02`: Missing-capability fallback tests.
- `GDN-004-T03`: Dependency ownership review.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Keep adapters replaceable; a missing integration is visible and never counted as successful synchronization.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-004/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-004-existing-engines-and-external-contract-discovery`.

#### GDN-005 - Threat model and data classification

**Status:** planned. **Owner:** Technical lead / product architect. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F25, F32, F37, F40. **Direct dependencies:** GDN-001, GDN-003. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Model public, research, sensitive and sealed data flows, attackers, trust boundaries, misuse and retention. Include source poisoning, identity inference, abusive insiders and political targeting.

**Data/API/contract:** docs/security/threat-model.md and data-classification.json govern all later modules.

**Acceptance:**

- `GDN-005-AC01`: Every data class names readers and decryption endpoints.
- `GDN-005-AC02`: Search and AI paths are classified.
- `GDN-005-AC03`: High-risk mitigations have implementer and test assignments.

**Tests to implement:**

- `GDN-005-T01`: Abuse-case tabletop.
- `GDN-005-T02`: Boundary diagram review.
- `GDN-005-T03`: Classification completeness lint.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Update on new flows; an unresolved critical boundary prevents enabling the affected feature.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-005/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-005-threat-model-and-data-classification`.

#### GDN-006 - Public information architecture and design studies

**Status:** planned. **Owner:** Technical lead / product architect. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F01, F02, F03, F04, F39. **Direct dependencies:** GDN-001. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Design six primary navigation areas and prototype newcomer, descendant-contributor and skeptical-investigator journeys. Establish typography, responsive behavior and historical-image treatment.

**Data/API/contract:** Route map, wireframes and component inventory become versioned design inputs.

**Acceptance:**

- `GDN-006-AC01`: A visitor can find what, why, mechanics, funding and evidence without sign-in.
- `GDN-006-AC02`: Public and researcher navigation are distinct.
- `GDN-006-AC03`: Low-bandwidth and keyboard paths exist.

**Tests to implement:**

- `GDN-006-T01`: Moderated comprehension protocol.
- `GDN-006-T02`: Keyboard prototype review.
- `GDN-006-T03`: Small-screen content audit.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Research prototypes only; do not treat untested mockups or synthetic testimonials as user evidence.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-006/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-006-public-information-architecture-and-design-studies`.

#### GDN-007 - Content, expert review and image commissioning plan

**Status:** planned. **Owner:** Technical lead / product architect. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F03, F05, F10, F11, F33, F35. **Direct dependencies:** GDN-002, GDN-006. **External gates:** X07.

**Scope and outcome:** Specify launch texts, exhibits, fiscal/legal review, community consultation and asset review as explicit work with editorial owners and consent boundaries.

**Data/API/contract:** content-deliverables.json links editorial tasks to features, release gates and reviewers.

**Acceptance:**

- `GDN-007-AC01`: Each launch page has source and review requirements.
- `GDN-007-AC02`: Generated images are segregated from evidence.
- `GDN-007-AC03`: Expert availability is tracked independently from engineering.

**Tests to implement:**

- `GDN-007-T01`: Content-source coverage audit.
- `GDN-007-T02`: Rights-missing rejection fixture.
- `GDN-007-T03`: Conflict-of-interest review.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** No new interviews or reuse of testimony without the separate authorized consent-led program.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-007/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-007-content-expert-review-and-image-commissioning-plan`.

#### GDN-008 - Machine-readable plan and release dependency graph

**Status:** planned. **Owner:** Technical lead / product architect. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F38, F41. **Direct dependencies:** GDN-001, GDN-002, GDN-005, GDN-006. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Commit this PR catalog, JSON schema, dependency DAG, feature crosswalk, release closures and evidence-based progress semantics. Include a local validator and handoff instructions.

**Data/API/contract:** plan.json is the planning authority; Engine Room receives a versioned derivative after actual integration.

**Acceptance:**

- `GDN-008-AC01`: No missing or cyclic dependencies.
- `GDN-008-AC02`: Every feature maps to concrete PRs.
- `GDN-008-AC03`: Planned IDs never masquerade as GitHub PR numbers.

**Tests to implement:**

- `GDN-008-T01`: Validator unit tests including cyclic graph and fake-completion cases.
- `GDN-008-T02`: Release closure checks.
- `GDN-008-T03`: Fresh-clone validation.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Freeze baseline weights and scope; revisions preserve denominator history rather than rewriting progress.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-008/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-008-machine-readable-plan-and-release-dependency-graph`.

### P01 - Repository, infrastructure and delivery foundations

#### GDN-009 - Application monorepo and reproducible toolchain

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F23, F40. **Direct dependencies:** GDN-004, GDN-008. **External gates:** X01.

**Scope and outcome:** Scaffold separate public and research apps, shared domain packages and worker services with TypeScript strictness, locked dependencies and local synthetic fixtures. Pin patched Node 24 LTS and compatible stable Next.js at bootstrap.

**Data/API/contract:** apps/public, apps/research, services/workers and packages/domain establish the proposed topology.

**Acceptance:**

- `GDN-009-AC01`: Fresh clone starts documented local services.
- `GDN-009-AC02`: Public app lacks restricted credentials.
- `GDN-009-AC03`: Tool versions and license inventory are recorded.

**Tests to implement:**

- `GDN-009-T01`: Clean install/build/typecheck.
- `GDN-009-T02`: Cross-package boundary test.
- `GDN-009-T03`: No-secret fixture scan.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No production resources; rollback is reverting scaffolding without touching source data.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Fresh clone starts documented local services. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-009/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-009-application-monorepo-and-reproducible-toolchain`.

#### GDN-010 - CI, test harness and supply-chain checks

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F37, F39, F40. **Direct dependencies:** GDN-009. **External gates:** X01.

**Scope and outcome:** Add lint, unit, integration, accessibility, security, build and plan-consistency jobs. Pin external actions by verified commit and scope job permissions minimally.

**Data/API/contract:** CI job names are stable and documented before branch rules reference them.

**Acceptance:**

- `GDN-010-AC01`: Required jobs fail on real defects.
- `GDN-010-AC02`: Fork PRs never receive deployment secrets.
- `GDN-010-AC03`: CI artifacts identify tested commit and environment.

**Tests to implement:**

- `GDN-010-T01`: Intentionally failing fixture.
- `GDN-010-T02`: Fork-event permission test.
- `GDN-010-T03`: Dependency and secret scanner canaries.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Enable read-only checks first; never hide a failed required job with an always-success wrapper.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Required jobs fail on real defects. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-010/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-010-ci-test-harness-and-supply-chain-checks`.

#### GDN-011 - Branch protection and autonomous merge protocol

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F40, F41. **Direct dependencies:** GDN-010. **External gates:** X01.

**Scope and outcome:** Configure actual repository rulesets, required checks, merge queue when available and safe automated PR chaining. Preserve genuine independent review requirements.

**Data/API/contract:** Repository rules evidence and automation permissions are recorded in docs/delivery.

**Acceptance:**

- `GDN-011-AC01`: GitHub confirms mergeability for exact head or merge-group SHA.
- `GDN-011-AC02`: Stale green checks do not authorize merge.
- `GDN-011-AC03`: Protected rules are never bypassed.

**Tests to implement:**

- `GDN-011-T01`: Merge-group event test.
- `GDN-011-T02`: Stale-head and conflict scenarios.
- `GDN-011-T03`: Required-review denial test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** If queue unavailable, use checked-head sequential merge; do not weaken rules to permit self-approval.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: GitHub confirms mergeability for exact head or merge-group SHA. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-011/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-011-branch-protection-and-autonomous-merge-protocol`.

#### GDN-012 - Environment, secret and cost-authorization registry

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F37, F40. **Direct dependencies:** GDN-005, GDN-009. **External gates:** X04, X05, X08.

**Scope and outcome:** Define isolated local, CI, preview, staging and production configuration and required secret names. Inventory existing authorized resources and proposed incremental spending.

**Data/API/contract:** resource-registry.json stores IDs and scope; .env.example contains names and safe placeholders only.

**Acceptance:**

- `GDN-012-AC01`: No credential value enters Git or plan files.
- `GDN-012-AC02`: Every billable resource has authorization reference.
- `GDN-012-AC03`: Production cannot inherit preview credentials.

**Tests to implement:**

- `GDN-012-T01`: Config schema validation.
- `GDN-012-T02`: Secret-leak tests.
- `GDN-012-T03`: Unauthorized provisioning dry-run rejection.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No purchases or new paid capacity without authorization; disabled optional integrations remain explicit.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No credential value enters Git or plan files. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-012/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-012-environment-secret-and-cost-authorization-registry`.

#### GDN-013 - Neon foundation and migration roles

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F24, F37, F40. **Direct dependencies:** GDN-012. **External gates:** X05.

**Scope and outcome:** Provision only authorized project-specific Neon environments. Configure runtime, migration and publication roles, TLS connections, pool-aware transactions and extension verification.

**Data/API/contract:** db/migrations and environment role matrix; direct migration and pooled runtime connections are distinct.

**Acceptance:**

- `GDN-013-AC01`: Runtime roles cannot migrate or bypass row policies.
- `GDN-013-AC02`: Staging is isolated from production.
- `GDN-013-AC03`: Current provider capabilities are verified rather than assumed.

**Tests to implement:**

- `GDN-013-T01`: Least-privilege SQL tests.
- `GDN-013-T02`: Wrong-project URL rejection.
- `GDN-013-T03`: Pool reuse and transaction rollback tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Empty synthetic schema first; snapshot before changes and preserve migration history.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Runtime roles cannot migrate or bypass row policies. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-013/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-013-neon-foundation-and-migration-roles`.

#### GDN-014 - First Render staging deployment

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F40. **Direct dependencies:** GDN-009, GDN-012, GDN-013. **External gates:** X04, X08.

**Scope and outcome:** Deploy minimal public/research service shells to authorized Render resources, verify routing, health endpoints, HTTPS and environment isolation.

**Data/API/contract:** Deployment descriptor references real service IDs only after discovery.

**Acceptance:**

- `GDN-014-AC01`: Actual online health and user-visible shell are tested.
- `GDN-014-AC02`: Build and deployed SHA are recorded.
- `GDN-014-AC03`: No real research or personal data is seeded.

**Tests to implement:**

- `GDN-014-T01`: External HTTPS smoke.
- `GDN-014-T02`: Wrong-environment canary.
- `GDN-014-T03`: Process restart and missing-env tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Keep public feature flags off; failure leaves previous healthy deployment serving.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Actual online health and user-visible shell are tested. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-014/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-014-first-render-staging-deployment`.

#### GDN-015 - Object storage and immutable originals

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F33, F37, F38. **Direct dependencies:** GDN-005, GDN-012. **External gates:** X06, X08.

**Scope and outcome:** Configure authorized S3-compatible object storage with separate quarantine, restricted and public-derivative namespaces. Store checksums, encryption metadata and version identifiers.

**Data/API/contract:** storage adapter supports put-original, verify, authorize-read and publish-derivative with immutable references.

**Acceptance:**

- `GDN-015-AC01`: Unreviewed originals are never public.
- `GDN-015-AC02`: Object ACL changes cannot bypass application access rules.
- `GDN-015-AC03`: Exact bytes survive round trip.

**Tests to implement:**

- `GDN-015-T01`: Cross-bucket authorization tests.
- `GDN-015-T02`: Hash mismatch test.
- `GDN-015-T03`: Interrupted multipart and version restore tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Synthetic objects first; no public listing or implicit provider-managed publicity.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Unreviewed originals are never public. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-015/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-015-object-storage-and-immutable-originals`.

#### GDN-016 - Transactional jobs, outbox and retries

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F29, F34, F40. **Direct dependencies:** GDN-013. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement durable jobs and transactional outbox with idempotency keys, leases, retry policy, dead-letter queue and cancellation. Avoid an extra paid queue until justified.

**Data/API/contract:** jobs, outbox_events and consumer_receipts tables; event schema carries classification and trace IDs.

**Acceptance:**

- `GDN-016-AC01`: Crash between domain write and event delivery loses no event.
- `GDN-016-AC02`: Duplicate delivery does not repeat side effects.
- `GDN-016-AC03`: Access is rechecked at execution.

**Tests to implement:**

- `GDN-016-T01`: Worker kill/restart.
- `GDN-016-T02`: Duplicate/reordered message tests.
- `GDN-016-T03`: Revoked-permission queued-job test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Canary worker with synthetic events; pause queue and retain payload references for safe replay.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Crash between domain write and event delivery loses no event. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-016/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-016-transactional-jobs-outbox-and-retries`.

#### GDN-017 - Observability with content-safe telemetry

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F37, F40, F41. **Direct dependencies:** GDN-014, GDN-016. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add request IDs, metrics, traces, structured redacted logs and error reporting. Separate operational telemetry from reading histories and contributor content.

**Data/API/contract:** telemetry schema lists approved fields and retention; no research content in Engine Room events.

**Acceptance:**

- `GDN-017-AC01`: Logs exclude tokens, family records and raw queries by default.
- `GDN-017-AC02`: A failed job is traceable without source content.
- `GDN-017-AC03`: Health distinguishes dependencies.

**Tests to implement:**

- `GDN-017-T01`: Log redaction canaries.
- `GDN-017-T02`: Trace propagation test.
- `GDN-017-T03`: Dependency failure dashboard test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Start with minimal sampling; disable a leaky exporter without disabling application access controls.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Logs exclude tokens, family records and raw queries by default. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-017/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-017-observability-with-content-safe-telemetry`.

#### GDN-018 - Staged deployment and database migration pipeline

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F24, F38, F40. **Direct dependencies:** GDN-010, GDN-013, GDN-014, GDN-017. **External gates:** X04, X05.

**Scope and outcome:** Build immutable artifacts, execute serialized expand-contract migrations and verify staging before promotion. Document Render pre-deploy entitlement and safe fallback.

**Data/API/contract:** Deployment evidence binds artifact digest, migration IDs, service ID and URL.

**Acceptance:**

- `GDN-018-AC01`: Same artifact digest moves through environments.
- `GDN-018-AC02`: Failed migration cannot trigger incompatible app rollout.
- `GDN-018-AC03`: Rollback procedure distinguishes code from data.

**Tests to implement:**

- `GDN-018-T01`: Migration failure/restart.
- `GDN-018-T02`: N and N-1 compatibility.
- `GDN-018-T03`: Health-check rollback simulation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No destructive automatic down migrations; roll forward or restore only under documented impact control.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Same artifact digest moves through environments. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-018/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-018-staged-deployment-and-database-migration-pipeline`.

#### GDN-019 - Engine Room adapter and reconciliation contract

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F41. **Direct dependencies:** GDN-004, GDN-008, GDN-010, GDN-017. **External gates:** X01, X03.

**Scope and outcome:** Implement against the discovered Engine Room API only after schema/authentication validation. Produce a local intermediate contract while the actual API is unavailable.

**Data/API/contract:** docs/integrations/engine-room-proposed.json is explicitly proposed until actual contract tests pass.

**Acceptance:**

- `GDN-019-AC01`: Repository and plan versions map to stable external IDs.
- `GDN-019-AC02`: Delivery is idempotent and independently acknowledged.
- `GDN-019-AC03`: Sync failure is visible, not reported as completion.

**Tests to implement:**

- `GDN-019-T01`: Consumer contract tests.
- `GDN-019-T02`: Duplicate and replay tests.
- `GDN-019-T03`: Offline queue and reconciliation tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Adapter can be disabled; keep local authoritative progress and reconcile before reporting external registration.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Repository and plan versions map to stable external IDs. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-019/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-019-engine-room-adapter-and-reconciliation-contract`.

#### GDN-020 - Safe preview environments and cleanup

**Status:** planned. **Owner:** Platform engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F37, F40. **Direct dependencies:** GDN-011, GDN-012, GDN-018. **External gates:** X01, X04, X05, X08.

**Scope and outcome:** Create isolated previews using synthetic or specifically sanitized data, scoped secrets and authorized resource limits. Remove resources after PR closure with explicit retention exceptions.

**Data/API/contract:** Preview identity includes repo, PR, commit, TTL and authorization reference.

**Acceptance:**

- `GDN-020-AC01`: Preview cannot access production DB or private buckets.
- `GDN-020-AC02`: Fork PRs get no privileged preview.
- `GDN-020-AC03`: Cleanup leaves no orphaned billable resources.

**Tests to implement:**

- `GDN-020-T01`: Cross-environment attack test.
- `GDN-020-T02`: Preview lifecycle test.
- `GDN-020-T03`: Resource inventory reconciliation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Manual trigger until costs are approved; never branch sensitive production data merely for convenience.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Preview cannot access production DB or private buckets. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-020/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-020-safe-preview-environments-and-cleanup`.

### P02 - Identity, privacy and security boundaries

#### GDN-021 - Identity provider integration and account lifecycle

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F23, F37. **Direct dependencies:** GDN-004, GDN-005, GDN-009, GDN-013. **External gates:** X06.

**Scope and outcome:** Reuse verified identity service or an approved standards-based provider. Implement sign-in, verified account linking, sign-out, suspension and account recovery without bespoke password crypto.

**Data/API/contract:** users and external_identities store minimum identifiers, not ancestry; OIDC callback schema is allowlisted.

**Acceptance:**

- `GDN-021-AC01`: Account linking requires proof of both identities.
- `GDN-021-AC02`: Suspended accounts lose access.
- `GDN-021-AC03`: Public reading requires no account.

**Tests to implement:**

- `GDN-021-T01`: Login/logout/recovery E2E.
- `GDN-021-T02`: Account-link takeover test.
- `GDN-021-T03`: Provider outage behavior.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Synthetic identities first; preserve a tested administrative recovery path without a hidden superuser.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Account linking requires proof of both identities. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-021/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-021-identity-provider-integration-and-account-lifecycle`.

#### GDN-022 - Sessions, passkeys and privileged authentication

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F23, F37, F40. **Direct dependencies:** GDN-021. **External gates:** X06.

**Scope and outcome:** Configure secure session cookies, CSRF protections, session rotation, passkey/MFA support and step-up authentication for sensitive actions.

**Data/API/contract:** Session assurance and last-step-up timestamps are policy inputs with bounded lifetime.

**Acceptance:**

- `GDN-022-AC01`: Session revocation reaches all active devices.
- `GDN-022-AC02`: Privileged actions require current assurance.
- `GDN-022-AC03`: Recovery does not bypass MFA policy.

**Tests to implement:**

- `GDN-022-T01`: Session fixation and CSRF tests.
- `GDN-022-T02`: Lost-device recovery drill.
- `GDN-022-T03`: Cross-tab logout E2E.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Roll out to administrators first; compatibility fallback must meet documented assurance, not silently downgrade.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Session revocation reaches all active devices. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-022/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-022-sessions-passkeys-and-privileged-authentication`.

#### GDN-023 - Roles, membership and researcher onboarding

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F23, F29, F35, F37. **Direct dependencies:** GDN-021. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement organization/workspace membership, role grants, training tasks, expertise claims and accountable reviewer assignments. Community historians need no institutional credential to contribute.

**Data/API/contract:** memberships, role_bindings and onboarding_attempts; separate editor, reviewer, rights and community roles.

**Acceptance:**

- `GDN-023-AC01`: Role grants require authorized issuer and expiry policy.
- `GDN-023-AC02`: Expertise is not auto-verified by self-description.
- `GDN-023-AC03`: Onboarding tasks do not publish research.

**Tests to implement:**

- `GDN-023-T01`: Role transition tests.
- `GDN-023-T02`: Invitation replay/expiry.
- `GDN-023-T03`: Non-institutional contributor onboarding E2E.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Default new users to minimal rights; revoke invitation capabilities independently from accounts.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Role grants require authorized issuer and expiry policy. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-023/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-023-roles-membership-and-researcher-onboarding`.

#### GDN-024 - Database row-level security and policy context

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F37. **Direct dependencies:** GDN-013, GDN-023. **External gates:** X05.

**Scope and outcome:** Enforce tenant/workspace and record policies with non-owner runtime roles and transaction-local identity. Test owner bypass and background-worker contexts explicitly.

**Data/API/contract:** RLS policy functions use validated transaction context; migration credentials never enter web services.

**Acceptance:**

- `GDN-024-AC01`: Default deny applies to unclassified records.
- `GDN-024-AC02`: Pool reuse cannot leak another identity.
- `GDN-024-AC03`: Runtime cannot disable policies or SET privileged roles.

**Tests to implement:**

- `GDN-024-T01`: All-role SQL matrix.
- `GDN-024-T02`: Pooled connection contamination test.
- `GDN-024-T03`: Background job and owner-role denial tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Enable on empty/synthetic data and fail closed before importing restricted records.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Default deny applies to unclassified records. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-024/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-024-database-row-level-security-and-policy-context`.

#### GDN-025 - Unified authorization at every delivery path

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F21, F22, F37. **Direct dependencies:** GDN-015, GDN-024. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Apply authorization to APIs, search facets, counts, snippets, image tiles, media ranges, exports, notifications and collaboration channels.

**Data/API/contract:** Policy decision service returns allow/deny and safe reason codes without disclosing hidden metadata.

**Acceptance:**

- `GDN-025-AC01`: A denied object reveals no title or existence through secondary routes.
- `GDN-025-AC02`: Signed URLs are short-lived and purpose-scoped.
- `GDN-025-AC03`: Revocation invalidates new reads.

**Tests to implement:**

- `GDN-025-T01`: IDOR tests across endpoints.
- `GDN-025-T02`: Range/tile/export denial.
- `GDN-025-T03`: Cache-key cross-user leakage tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No access-control-only-in-UI exceptions; maintain emergency read-denial switch.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: A denied object reveals no title or existence through secondary routes. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-025/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-025-unified-authorization-at-every-delivery-path`.

#### GDN-026 - Key management and trusted-processing encryption

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F32, F37, F38. **Direct dependencies:** GDN-003, GDN-005, GDN-012, GDN-025. **External gates:** X02, X06, X08.

**Scope and outcome:** Implement approved key-provider adapter, envelope encryption, key separation, rotation and access auditing for server-processed restricted material.

**Data/API/contract:** key_versions and encrypted-object metadata; distinguish TLS/at-rest controls from end-to-end encryption.

**Acceptance:**

- `GDN-026-AC01`: Key use is authorized and logged without key values.
- `GDN-026-AC02`: Rotation preserves readability and rollback evidence.
- `GDN-026-AC03`: Provider/operator decryption is disclosed honestly.

**Tests to implement:**

- `GDN-026-T01`: KMS outage/denial.
- `GDN-026-T02`: Rewrap/rotation fixtures.
- `GDN-026-T03`: Backup restore with missing and recovered key tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Use synthetic secrets first; sensitive production blocked until canonical-standard reconciliation and recovery pass.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Key use is authorized and logged without key values. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-026/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-026-key-management-and-trusted-processing-encryption`.

#### GDN-027 - Sealed client-side encryption and recipient keys

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F32, F37. **Direct dependencies:** GDN-022, GDN-025, GDN-026. **External gates:** X02, X06, X08.

**Scope and outcome:** Provide an optional sealed workspace using reviewed client-side cryptographic libraries and explicit recipient-controlled keys. Specify device trust, metadata leakage and unrecoverable-key risks.

**Data/API/contract:** ciphertext envelopes carry algorithm/version and recipient key references; no server plaintext index.

**Acceptance:**

- `GDN-027-AC01`: Service cannot decrypt sealed payloads.
- `GDN-027-AC02`: User sees recovery limitations before creation.
- `GDN-027-AC03`: Search, OCR and AI services receive no plaintext.

**Tests to implement:**

- `GDN-027-T01`: Browser encryption interoperability.
- `GDN-027-T02`: Server/database plaintext canaries.
- `GDN-027-T03`: Lost-key and recipient-removal tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No homemade crypto; security review gate before real use; disable sealed creation without weakening existing ciphertext protection.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Service cannot decrypt sealed payloads. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-027/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-027-sealed-client-side-encryption-and-recipient-keys`.

#### GDN-028 - Encrypted collaboration and controlled disclosure

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F29, F32, F37. **Direct dependencies:** GDN-027. **External gates:** X02, X06.

**Scope and outcome:** Add encrypted document updates, device/recipient changes and deliberate release of selected sealed material into a named trusted or public workflow.

**Data/API/contract:** Sealed update transport stores ciphertext only; disclosure event records selected derivative, consent and destination.

**Acceptance:**

- `GDN-028-AC01`: Removal blocks future keys while disclosing limits on already-read data.
- `GDN-028-AC02`: Export requires deliberate user action.
- `GDN-028-AC03`: Reclassification creates a new auditable derivative.

**Tests to implement:**

- `GDN-028-T01`: Offline recipient and key-epoch tests.
- `GDN-028-T02`: Replay/conflict ciphertext tests.
- `GDN-028-T03`: Accidental plaintext egress canaries.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Sealed collaboration is not enabled until its dedicated audit passes; no silent fallback to plaintext sync.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Removal blocks future keys while disclosing limits on already-read data. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-028/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-028-encrypted-collaboration-and-controlled-disclosure`.

#### GDN-029 - Consent, purpose and permitted-use enforcement

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F14, F32, F35, F37. **Direct dependencies:** GDN-005, GDN-025. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Model separate consent for preservation, research, public display, name attribution and promotional endorsement. Track scope, expiry, guardian authority and withdrawal.

**Data/API/contract:** consent_grants and permitted_uses with versioned terms and evidence references.

**Acceptance:**

- `GDN-029-AC01`: Research consent never grants promotional permission.
- `GDN-029-AC02`: Every derivative inherits enforceable limits.
- `GDN-029-AC03`: Expired/withdrawn permissions block new publication.

**Tests to implement:**

- `GDN-029-T01`: Consent matrix tests.
- `GDN-029-T02`: Mixed-purpose derivative test.
- `GDN-029-T03`: Expiration and withdrawal race tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Initial contributions remain private; no bundled mandatory advocacy consent.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Research consent never grants promotional permission. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-029/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-029-consent-purpose-and-permitted-use-enforcement`.

#### GDN-030 - Tamper-evident audit and sensitive-action ledger

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F28, F34, F36, F37, F40. **Direct dependencies:** GDN-016, GDN-022, GDN-025. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Record authorization, review, publication, consent and administrative events in append-only structured audit with integrity verification and redacted payloads.

**Data/API/contract:** audit_events reference records without copying sensitive content; export limited to authorized auditors.

**Acceptance:**

- `GDN-030-AC01`: Actor, subject, reason and request identity are attributable.
- `GDN-030-AC02`: Audit tampering is detectable.
- `GDN-030-AC03`: Normal editors cannot alter audit history.

**Tests to implement:**

- `GDN-030-T01`: Hash-chain verification.
- `GDN-030-T02`: Concurrent append and restore tests.
- `GDN-030-T03`: Secret/PII audit canaries.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Key/audit roots backed up separately; integrity claims state the operator trust model rather than promising absolute immutability.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Actor, subject, reason and request identity are attributable. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-030/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-030-tamper-evident-audit-and-sensitive-action-ledger`.

#### GDN-031 - Authorization abuse and isolation regression suite

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F37, F40. **Direct dependencies:** GDN-024, GDN-025, GDN-029, GDN-030. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build reusable property-based and E2E policy tests for every role/data-class combination and all non-HTML retrieval surfaces.

**Data/API/contract:** tests/security/policy-matrix generates route coverage and missing-test failures.

**Acceptance:**

- `GDN-031-AC01`: No unauthorized content, counts or timing-obvious preview is exposed in tested cases.
- `GDN-031-AC02`: New endpoint registration requires policy tests.
- `GDN-031-AC03`: Revoked jobs fail safely.

**Tests to implement:**

- `GDN-031-T01`: Denial matrix.
- `GDN-031-T02`: Signed-URL replay.
- `GDN-031-T03`: Search/export/AI/index cross-boundary synthetic canaries.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Make regression suite required before restricted-data imports or public publication.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No unauthorized content, counts or timing-obvious preview is exposed in tested cases. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-031/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-031-authorization-abuse-and-isolation-regression-suite`.

#### GDN-032 - Retention, deletion and legal-hold workflow

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F32, F37, F38. **Direct dependencies:** GDN-026, GDN-029, GDN-030. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement retention classes, review queues, user export/deletion requests, legitimate preservation exceptions and narrowly scoped legal holds. Explain backup and public-copy limits.

**Data/API/contract:** retention_rules, deletion_tombstones and hold_records; no vague indefinite retention default.

**Acceptance:**

- `GDN-032-AC01`: Deletion stops new delivery and queues derivative removal.
- `GDN-032-AC02`: Holds have authority, scope and review date.
- `GDN-032-AC03`: Restores reapply current deletions and consent.

**Tests to implement:**

- `GDN-032-T01`: Tombstone/reindex tests.
- `GDN-032-T02`: Restore-after-withdrawal.
- `GDN-032-T03`: Hold expiry and conflicting-policy tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Dry-run retention reports before deletion; destructive actions require verified authority, not ordinary auto-merge.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Deletion stops new delivery and queues derivative removal. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-032/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-032-retention-deletion-and-legal-hold-workflow`.

#### GDN-033 - Web hardening, dependency defense and secure headers

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F37, F39, F40. **Direct dependencies:** GDN-010, GDN-014, GDN-022. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Configure CSP, safe HTML rendering, CSRF defense, origin checks, rate limits, dependency scanning and upload-viewer sandboxing. Remove uncontrolled third-party scripts.

**Data/API/contract:** Security policy shared by apps while keeping distinct credential scopes.

**Acceptance:**

- `GDN-033-AC01`: Stored XSS cannot execute through descriptions or transcriptions.
- `GDN-033-AC02`: Trusted origins are explicit.
- `GDN-033-AC03`: Security headers work on error and redirect responses.

**Tests to implement:**

- `GDN-033-T01`: XSS/SSRF/CORS fixtures.
- `GDN-033-T02`: CSP browser reports.
- `GDN-033-T03`: Error-page and redirect scans.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Report-only CSP only in synthetic staging; enforce before public launch with documented exceptions.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Stored XSS cannot execute through descriptions or transcriptions. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-033/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-033-web-hardening-dependency-defense-and-secure-headers`.

#### GDN-034 - Publication and retraction safety kernel

**Status:** planned. **Owner:** Security engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F33, F34, F37. **Direct dependencies:** GDN-025, GDN-029, GDN-030, GDN-031, GDN-033. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Require independent checks of research status, rights, consent, privacy, accessibility and release authority before public delivery. Provide deny-first withdrawal across origins and derivatives.

**Data/API/contract:** publication_eligibility and revocation ledger are shared by public API, export and media services.

**Acceptance:**

- `GDN-034-AC01`: Verified research state alone cannot publish.
- `GDN-034-AC02`: Failed approval is actionable.
- `GDN-034-AC03`: Withdrawal immediately denies origin delivery and queues cache/index cleanup.

**Tests to implement:**

- `GDN-034-T01`: State-combination truth table.
- `GDN-034-T02`: Permission-revocation race.
- `GDN-034-T03`: Stale-CDN denial test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Deny by default; rollback never republishes withdrawn or uncleared records.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Verified research state alone cannot publish. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-034/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-034-publication-and-retraction-safety-kernel`.

### P03 - Canonical model and preservation-first migration

#### GDN-035 - Typed historical entities and reversible relationships

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F18, F26. **Direct dependencies:** GDN-013, GDN-024. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Model people, polities, peoples, languages, places, institutions, voyages and events with typed relationships, historical names and provenance.

**Data/API/contract:** entities, names, relationship_assertions and redirects; public UUIDs stable across label changes.

**Acceptance:**

- `GDN-035-AC01`: Port, language and polity are distinct types.
- `GDN-035-AC02`: Unknown values remain unknown.
- `GDN-035-AC03`: Merge/unmerge preserves aliases and source identities.

**Tests to implement:**

- `GDN-035-T01`: Type constraint tests.
- `GDN-035-T02`: Merge-reversal fixtures.
- `GDN-035-T03`: Same-name different-person test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Additive schema; no bulk identity merges based on resemblance.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Port, language and polity are distinct types. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-035/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-035-typed-historical-entities-and-reversible-relationships`.

#### GDN-036 - Sources, repositories and archival hierarchy

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F25, F26. **Direct dependencies:** GDN-013, GDN-024. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Model repositories, collections, series, items, witnesses, editions and digital representations. Preserve conflicting catalog data and source independence links.

**Data/API/contract:** sources, archival_units, witnesses and source_derivations with persistent IDs.

**Acceptance:**

- `GDN-036-AC01`: Source edition and digitization are separate.
- `GDN-036-AC02`: Parent hierarchy is cycle-free.
- `GDN-036-AC03`: Two derivatives of one source do not count as independent evidence.

**Tests to implement:**

- `GDN-036-T01`: Hierarchy cycle tests.
- `GDN-036-T02`: Conflicting date/catalog fixtures.
- `GDN-036-T03`: Edition disambiguation tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Import metadata into reviewable draft state; never infer item rights from collection rights.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Source edition and digitization are separate. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-036/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-036-sources-repositories-and-archival-hierarchy`.

#### GDN-037 - Atomic claims, evidence links and placements

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F26, F28, F34. **Direct dependencies:** GDN-035, GDN-036. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Store atomic source claims, historical interpretations and policy statements separately, with supporting/contradicting evidence and every public placement.

**Data/API/contract:** claims, evidence_links and placements use immutable versions and explicit assertion types.

**Acceptance:**

- `GDN-037-AC01`: Source testimony is not automatically project conclusion.
- `GDN-037-AC02`: Every evidence edge has locator and relation.
- `GDN-037-AC03`: Corrections can find all dependent placements.

**Tests to implement:**

- `GDN-037-T01`: Multi-predicate segmentation fixtures.
- `GDN-037-T02`: Contradictory evidence test.
- `GDN-037-T03`: Dependency traversal completeness.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Legacy text candidates remain unreviewed; no mass promotion by import status.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Source testimony is not automatically project conclusion. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-037/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-037-atomic-claims-evidence-links-and-placements`.

#### GDN-038 - Durable locators and Web Annotation selectors

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F20, F27. **Direct dependencies:** GDN-035, GDN-036. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement edition/page/region/timecode locators, text quotes and positions bound to exact content hashes. Preserve original page labels alongside digital ordinals.

**Data/API/contract:** locator JSON supports text quote/position, image xywh, audio/video time and original source identifiers.

**Acceptance:**

- `GDN-038-AC01`: Annotation resolves to the intended witness/version.
- `GDN-038-AC02`: Reflow does not silently move an anchor.
- `GDN-038-AC03`: Unresolvable anchors are visibly orphaned.

**Tests to implement:**

- `GDN-038-T01`: Page-number mismatch.
- `GDN-038-T02`: Unicode offset and cropped-image fixtures.
- `GDN-038-T03`: Quote reanchoring ambiguity tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** New selector versions are additive; retain old locators and explicit reanchoring records.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Annotation resolves to the intended witness/version. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-038/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-038-durable-locators-and-web-annotation-selectors`.

#### GDN-039 - Independent research, rights and publication states

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F28, F33, F34. **Direct dependencies:** GDN-029, GDN-030, GDN-037. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement separate status axes for acquisition, transcription, evidentiary review, rights, consent, accessibility and publication. Record actor and scope of each review.

**Data/API/contract:** review_decisions and status_events expose scoped evidence, never an unsupported confidence percentage.

**Acceptance:**

- `GDN-039-AC01`: No single VERIFIED badge certifies an entire work.
- `GDN-039-AC02`: Transition guards check role and prior state.
- `GDN-039-AC03`: Disputes can reopen claims without deleting history.

**Tests to implement:**

- `GDN-039-T01`: State-machine property tests.
- `GDN-039-T02`: Self-review conflict.
- `GDN-039-T03`: Partial-review display fixtures.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Preserve imported status verbatim with mapped interpretation and unknown states.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No single VERIFIED badge certifies an entire work. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-039/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-039-independent-research-rights-and-publication-states`.

#### GDN-040 - Structured editorial content and policy versions

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F02, F10, F11. **Direct dependencies:** GDN-006, GDN-007, GDN-037, GDN-039. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Define typed pages, explanation levels, callouts, definitions, policy provisions and citations. Separate advocacy interpretation from research claims and effective draft versions.

**Data/API/contract:** content_nodes, policy_versions and content_claim_bindings feed public pages and later CMS.

**Acceptance:**

- `GDN-040-AC01`: Content cannot reference nonexistent evidence as verified.
- `GDN-040-AC02`: Policy numbers bind to draft version.
- `GDN-040-AC03`: Rich text cannot inject scripts.

**Tests to implement:**

- `GDN-040-T01`: Schema and link validation.
- `GDN-040-T02`: Draft-version mismatch.
- `GDN-040-T03`: Sanitized rich-text tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Start with reviewed structured files; editors get advanced UI later without changing content semantics.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Content cannot reference nonexistent evidence as verified. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-040/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-040-structured-editorial-content-and-policy-versions`.

#### GDN-041 - Import quarantine and content inventory service

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F24, F25. **Direct dependencies:** GDN-015, GDN-016, GDN-030, GDN-036. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build read-only ingestion manifests, content-type verification, malware/quota checks and quarantine. Record source bytes, transformation lineage and denied access.

**Data/API/contract:** import_runs, imported_artifacts and quarantine_decisions with immutable source references.

**Acceptance:**

- `GDN-041-AC01`: Untrusted imports cannot execute macros or external callbacks.
- `GDN-041-AC02`: Oversized/truncated archives are rejected safely.
- `GDN-041-AC03`: Every original has a checksum and disposition.

**Tests to implement:**

- `GDN-041-T01`: ZIP bomb/path traversal.
- `GDN-041-T02`: Mislabeled MIME.
- `GDN-041-T03`: Interrupted upload and malformed database fixtures.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Synthetic inputs first; never parse directly inside public web workers.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Untrusted imports cannot execute macros or external callbacks. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-041/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-041-import-quarantine-and-content-inventory-service`.

#### GDN-042 - Baseline documents and manual-review publication seed

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F10, F24, F38. **Direct dependencies:** GDN-002, GDN-034, GDN-038, GDN-040, GDN-041. **External gates:** X09.

**Scope and outcome:** Register all current research/legislation files and create a small explicitly reviewed public seed with exact provenance and limitations. Preserve restricted originals separately.

**Data/API/contract:** release_seed.json identifies each approved excerpt and excluded material with reason.

**Acceptance:**

- `GDN-042-AC01`: Current documents resolve to correct editions.
- `GDN-042-AC02`: Seed publication requires real review and rights clearance.
- `GDN-042-AC03`: Unreviewed book text stays labeled draft or private.

**Tests to implement:**

- `GDN-042-T01`: Link/hash verification.
- `GDN-042-T02`: Seed publication denial tests.
- `GDN-042-T03`: Stale-filename redirects.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** This permits an early public site without falsely declaring the full corpus publishable.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Current documents resolve to correct editions. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-042/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-042-baseline-documents-and-manual-review-publication-seed`.

#### GDN-043 - Public-only data projection and delivery API

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F15, F16, F20, F37. **Direct dependencies:** GDN-034, GDN-035, GDN-036, GDN-037, GDN-038, GDN-039, GDN-040. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Create a public serving database/projection using only publication-eligible fields and versions, with separate credentials and revocation checks.

**Data/API/contract:** /api/v1/public/* serves release-bound records with cache tags and stable identifiers.

**Acceptance:**

- `GDN-043-AC01`: Public runtime cannot query restricted schema.
- `GDN-043-AC02`: Facets and related-record links contain public data only.
- `GDN-043-AC03`: Deleted/withdrawn versions cannot reappear on rebuild.

**Tests to implement:**

- `GDN-043-T01`: Projection equivalence.
- `GDN-043-T02`: Restricted canaries.
- `GDN-043-T03`: Rebuild and revoked-version tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Atomically switch projection generation after verification; old generation remains denial-aware.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Public runtime cannot query restricted schema. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-043/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-043-public-only-data-projection-and-delivery-api`.

#### GDN-044 - Explicit mapping of all 106 source tables

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F24, F26, F38. **Direct dependencies:** GDN-002, GDN-035, GDN-036, GDN-037, GDN-038, GDN-039, GDN-041. **External gates:** X09.

**Scope and outcome:** Inspect every CP-017 table and map it to raw preservation, normalized destination, legacy snapshot or unresolved recovery status. Define conversion and foreign-key rules.

**Data/API/contract:** migration-map.json retains source schema hash and per-table target rules.

**Acceptance:**

- `GDN-044-AC01`: All 106 tables accounted for without silent drops.
- `GDN-044-AC02`: 923292 source rows have a migration disposition.
- `GDN-044-AC03`: Counts are not represented as unique people or verified claims.

**Tests to implement:**

- `GDN-044-T01`: Coverage and total checks.
- `GDN-044-T02`: Schema-drift fixture.
- `GDN-044-T03`: Missing-table and duplicate-ID tests.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Mapping review precedes import; unresolved lineage remains visibly unresolved rather than reconstructed by guess.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-044/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-044-explicit-mapping-of-all-106-source-tables`.

#### GDN-045 - Idempotent corpus staging importer

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F24, F25, F38. **Direct dependencies:** GDN-041, GDN-044. **External gates:** X05, X09.

**Scope and outcome:** Import exact SQLite and valid export representations into immutable legacy staging, preserving typed cells, NULLs, raw JSON and edition namespaces.

**Data/API/contract:** staging_rows keyed by source snapshot, table and stable row locator; normalized writes are separately versioned.

**Acceptance:**

- `GDN-045-AC01`: Re-running identical input creates no duplicates.
- `GDN-045-AC02`: Import resumes after crash.
- `GDN-045-AC03`: Conflicting same-key sources are quarantined, not overwritten.

**Tests to implement:**

- `GDN-045-T01`: Full schema/row reconciliation.
- `GDN-045-T02`: Null/Unicode/numeric round trip.
- `GDN-045-T03`: Mid-batch crash and duplicate replay tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Read-only source DB; batch checkpoints and rollback by import-run ID, never source mutation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Re-running identical input creates no duplicates. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-045/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-045-idempotent-corpus-staging-importer`.

#### GDN-046 - Manuscript structure, citations and comments migration

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 5 (not a time estimate).

**Features:** F10, F20, F24, F28, F34. **Direct dependencies:** GDN-038, GDN-040, GDN-042, GDN-045. **External gates:** X09.

**Scope and outcome:** Convert DOCX structures, note targets, tables, citations, editorial comments and exact spans without treating comments as source testimony. Preserve edition-local numbering.

**Data/API/contract:** legacy_document_units map to content nodes, locators, citation bindings and editorial-only annotations.

**Acceptance:**

- `GDN-046-AC01`: All 43 companion bindings are accounted for.
- `GDN-046-AC02`: Original comments and old quoted text are not published as current claims.
- `GDN-046-AC03`: Missing anchors enter review queue.

**Tests to implement:**

- `GDN-046-T01`: Repeated note-number fixture.
- `GDN-046-T02`: Nested table and field tests.
- `GDN-046-T03`: Before/after span comparison.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish no converted chapter until editorial checks; retain original downloadable document and mapping manifest.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: All 43 companion bindings are accounted for. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-046/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-046-manuscript-structure-citations-and-comments-migration`.

#### GDN-047 - Image, rights and derivative migration

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F05, F24, F33, F37. **Direct dependencies:** GDN-015, GDN-029, GDN-041, GDN-045. **External gates:** X09.

**Scope and outcome:** Reconcile actual current-document media and placements with legacy asset tables, carry rights/captions/alt text and distinguish archival images from generated illustrations.

**Data/API/contract:** assets and asset_placements preserve per-edition counts and rights evidence, not appearance-based identity guesses.

**Acceptance:**

- `GDN-047-AC01`: Legacy 567 assets/591 placements are not mistaken for newest 591 media/615 placements.
- `GDN-047-AC02`: All mismatches are explicit.
- `GDN-047-AC03`: Unknown rights block public bytes.

**Tests to implement:**

- `GDN-047-T01`: Exact-byte matching.
- `GDN-047-T02`: Duplicate image/placement distinction.
- `GDN-047-T03`: Missing-rights/generated-label tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Keep originals restricted; regenerate only authorized derivatives after comparison review.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Legacy 567 assets/591 placements are not mistaken for newest 591 media/615 placements. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-047/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-047-image-rights-and-derivative-migration`.

#### GDN-048 - Full migration reconciliation and recovery exceptions

**Status:** planned. **Owner:** Data and preservation engineer. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F24, F28, F38. **Direct dependencies:** GDN-045, GDN-046, GDN-047. **External gates:** X05, X09.

**Scope and outcome:** Produce row, hash, source, note, asset and state reconciliation reports. Preserve CP-016 truncation and CP-011 schema-lineage gaps as open exceptions.

**Data/API/contract:** migration_acceptance.json records exact source snapshot, output digest, exceptions and reviewer sign-offs.

**Acceptance:**

- `GDN-048-AC01`: Every source row is imported, preserved or explicitly rejected.
- `GDN-048-AC02`: Provisional rows 152-326 stay provisional and row-223 displacement remains unresolved.
- `GDN-048-AC03`: No recovery gap is called repaired without evidence.

**Tests to implement:**

- `GDN-048-T01`: Cross-artifact count checks.
- `GDN-048-T02`: Missing-row injected defects.
- `GDN-048-T03`: Reopen exported DB and sampled semantic comparisons.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Block full-corpus release on unaccounted loss; allow reviewed bounded publication without claiming comprehensive completion.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Every source row is imported, preserved or explicitly rejected. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-048/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-048-full-migration-reconciliation-and-recovery-exceptions`.

### P04 - Public narrative and accessible orientation

#### GDN-049 - Accessible public shell and navigation

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F39. **Direct dependencies:** GDN-006, GDN-009, GDN-033, GDN-043. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build the public site shell with six primary sections, global search entry, footer identity/status and a separate researcher entry point.

**Data/API/contract:** Public layout components consume published navigation records only.

**Acceptance:**

- `GDN-049-AC01`: All navigation works without sign-in or JavaScript-dependent menus.
- `GDN-049-AC02`: Focus order and landmarks are correct.
- `GDN-049-AC03`: Mobile navigation exposes all primary routes.

**Tests to implement:**

- `GDN-049-T01`: Keyboard and screen-reader smoke.
- `GDN-049-T02`: 320px and 200 percent zoom tests.
- `GDN-049-T03`: Broken-route and no-JS tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Deploy behind public-shell flag; verify real URLs and navigation on staging and production.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: All navigation works without sign-in or JavaScript-dependent menus. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-049/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-049-accessible-public-shell-and-navigation`.

#### GDN-050 - Design system and readable content components

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F02, F05, F39. **Direct dependencies:** GDN-006, GDN-049. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement typography, spacing, accessible controls, callouts, cards, long-form reading, citations and distinct source/interpretation labels.

**Data/API/contract:** Shared UI tokens and documented variants; components do not embed policy copy or unverified statistics.

**Acceptance:**

- `GDN-050-AC01`: Components support long names and multilingual text.
- `GDN-050-AC02`: Contrast and focus pass reviewed states.
- `GDN-050-AC03`: No claim status is conveyed by color alone.

**Tests to implement:**

- `GDN-050-T01`: Component accessibility tests.
- `GDN-050-T02`: Visual regression at mobile/desktop.
- `GDN-050-T03`: Long-text and reduced-motion fixtures.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Establish approved visual snapshots; regressions require inspection, not automatic snapshot replacement.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Components support long names and multilingual text. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-050/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-050-design-system-and-readable-content-components`.

#### GDN-051 - Homepage and first-screen explanation

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F02, F04, F08. **Direct dependencies:** GDN-007, GDN-040, GDN-042, GDN-049, GDN-050. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement the primary definition, public purpose, policy status, optional film, key routes and prominent funding explanation linked to the full caveats.

**Data/API/contract:** Home page schema links policy_version_id, reviewed claim IDs and approved media.

**Acceptance:**

- `GDN-051-AC01`: A newcomer can identify proposal, sponsor and current status.
- `GDN-051-AC02`: Funding wording matches current reviewed draft.
- `GDN-051-AC03`: Page remains meaningful with images/video disabled.

**Tests to implement:**

- `GDN-051-T01`: Newcomer task protocol.
- `GDN-051-T02`: Source-bound copy test.
- `GDN-051-T03`: Mobile LCP and keyboard journey.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Release only reviewed text and cleared media; show proposal status until authoritative legislative evidence changes it.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: A newcomer can identify proposal, sponsor and current status. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-051/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-051-homepage-and-first-screen-explanation`.

#### GDN-052 - Layered overview and guided introduction

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F02, F06. **Direct dependencies:** GDN-040, GDN-049, GDN-050. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide brief, guided and detailed explanations with preserved place, definitions and routes to source provisions. Avoid contradictory summaries.

**Data/API/contract:** explanation_level and topic IDs map summaries to complete provisions and evidence.

**Acceptance:**

- `GDN-052-AC01`: Visitors can switch depth without losing topic.
- `GDN-052-AC02`: Goals, mechanisms and forecasts are labeled.
- `GDN-052-AC03`: All overview levels bind to the same policy revision.

**Tests to implement:**

- `GDN-052-T01`: Cross-level consistency tests.
- `GDN-052-T02`: Resume/URL state E2E.
- `GDN-052-T03`: Readability and assistive-tech review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Feature-flag the guide; no autoplay or forced completion before accessing the legislation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Visitors can switch depth without losing topic. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-052/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-052-layered-overview-and-guided-introduction`.

#### GDN-053 - Human-centered story templates

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F03, F20. **Direct dependencies:** GDN-007, GDN-037, GDN-038, GDN-050. **External gates:** X07, X09.

**Scope and outcome:** Build narrated story pages connecting documented lives, institutions, disruption, survival and evidence without inventing scenes or quotes.

**Data/API/contract:** Story blocks reference claims, objects, sources and editorial interpretation separately.

**Acceptance:**

- `GDN-053-AC01`: Story assertions expose exact support.
- `GDN-053-AC02`: Uncertain or imagined details cannot appear as established history.
- `GDN-053-AC03`: People are not introduced solely through victimhood.

**Tests to implement:**

- `GDN-053-T01`: Claim-binding audit.
- `GDN-053-T02`: Missing-evidence publication denial.
- `GDN-053-T03`: Narrative and sensitivity review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish bounded reviewed stories; preserve draft narratives privately with explicit research gaps.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Story assertions expose exact support. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-053/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-053-human-centered-story-templates`.

#### GDN-054 - Meaning of The Garden and institutional vision

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F04, F06. **Direct dependencies:** GDN-040, GDN-050, GDN-052. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Explain the metaphor and proposed institutional relationships using accessible text and diagrams with equivalent descriptions.

**Data/API/contract:** vision content references policy provisions for voluntary association and Assembly limits.

**Acceptance:**

- `GDN-054-AC01`: Metaphor does not imply centralized authority absent from the draft.
- `GDN-054-AC02`: Coordination differs from control.
- `GDN-054-AC03`: The full explanation works without diagrams.

**Tests to implement:**

- `GDN-054-T01`: Provision-binding test.
- `GDN-054-T02`: Diagram text-equivalence.
- `GDN-054-T03`: Public comprehension review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Version with the policy; withdraw unsupported institutional analogies rather than decorate them as fact.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Metaphor does not imply centralized authority absent from the draft. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-054/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-054-meaning-of-the-garden-and-institutional-vision`.

#### GDN-055 - Image galleries and pose-pair storytelling

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F03, F05, F33. **Direct dependencies:** GDN-034, GDN-042, GDN-050. **External gates:** X09.

**Scope and outcome:** Add paired-image and gallery layouts preserving separate captions, attribution, rights, context and reconstruction labels for each asset. Use the explicitly cleared seed for the first release; full asset migration is added independently under GDN-047.

**Data/API/contract:** pairing records describe curatorial rationale and limits without creating evidence relationships.

**Acceptance:**

- `GDN-055-AC01`: Similar poses never imply the same identity or historical link.
- `GDN-055-AC02`: Generated and archival assets remain distinguishable.
- `GDN-055-AC03`: Graphic-content choices are remembered locally without profiling.

**Tests to implement:**

- `GDN-055-T01`: Mixed-asset label tests.
- `GDN-055-T02`: Keyboard gallery E2E.
- `GDN-055-T03`: Crop/caption association review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Only cleared images enter public galleries; failed identity or rights review removes affected placement.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Similar poses never imply the same identity or historical link. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-055/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-055-image-galleries-and-pose-pair-storytelling`.

#### GDN-056 - Introductory film, audio and transcript experience

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F02, F03, F39. **Direct dependencies:** GDN-029, GDN-034, GDN-050. **External gates:** X06.

**Scope and outcome:** Add optional film/audio with captions, transcripts, audio description where needed, playback controls and low-bandwidth alternatives.

**Data/API/contract:** media_tracks reference language, accessibility review and permitted-use version.

**Acceptance:**

- `GDN-056-AC01`: No autoplay audio.
- `GDN-056-AC02`: Transcript includes relevant visual meaning.
- `GDN-056-AC03`: Consent and media rights cover public playback.

**Tests to implement:**

- `GDN-056-T01`: Caption timing review.
- `GDN-056-T02`: Keyboard media controls.
- `GDN-056-T03`: Slow-network and transcript-only tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Load media on demand; text explanation is available even when hosting or playback fails.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No autoplay audio. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-056/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-056-introductory-film-audio-and-transcript-experience`.

#### GDN-057 - Historical exhibits and curated learning paths

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F03, F15, F19. **Direct dependencies:** GDN-043, GDN-053, GDN-055. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build thematic exhibits mixing subjects, objects and documents with clear curatorial scope and routes to underlying research.

**Data/API/contract:** exhibit_versions and ordered panels reference published record versions.

**Acceptance:**

- `GDN-057-AC01`: Curated sequence preserves source context.
- `GDN-057-AC02`: Evidence is never hidden behind a story-only view.
- `GDN-057-AC03`: Scope and omissions are explicit.

**Tests to implement:**

- `GDN-057-T01`: Exhibit link integrity.
- `GDN-057-T02`: Incomplete-record fallbacks.
- `GDN-057-T03`: Mobile reading-flow review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Editorial preview before release; exhibit rollback respects current withdrawals.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Curated sequence preserves source context. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-057/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-057-historical-exhibits-and-curated-learning-paths`.

#### GDN-058 - Contextual glossary and terminology explanations

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F02, F07, F15, F39. **Direct dependencies:** GDN-035, GDN-040, GDN-050. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide accessible inline definitions, pronunciation where licensed and historic/modern term distinctions. Preserve historical offensive terminology with context rather than silently normalizing evidence.

**Data/API/contract:** glossary_terms version definitions, historical variants and source bindings.

**Acceptance:**

- `GDN-058-AC01`: Definitions are keyboard accessible.
- `GDN-058-AC02`: Historical labels are not treated as present identity.
- `GDN-058-AC03`: Links to source language and usage limits exist.

**Tests to implement:**

- `GDN-058-T01`: Tooltip/dialog accessibility.
- `GDN-058-T02`: Ambiguous-term fixture.
- `GDN-058-T03`: Translation fallback tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Use semantic links with optional enhancement; no hover-only essential information.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Definitions are keyboard accessible. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-058/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-058-contextual-glossary-and-terminology-explanations`.

#### GDN-059 - Public visitor routes and reading continuity

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F02, F15, F21. **Direct dependencies:** GDN-049, GDN-052, GDN-057, GDN-058. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add optional choose-a-topic routes, breadcrumbs, in-page navigation and local reading position. Avoid demographic targeting or compulsory personas.

**Data/API/contract:** Local preference schema contains route/display choices, not ancestry or political attributes.

**Acceptance:**

- `GDN-059-AC01`: Visitors choose interests, not racial/political profiles.
- `GDN-059-AC02`: Direct links bypass guided routes.
- `GDN-059-AC03`: Reading state can be cleared and is not sent to advocacy analytics.

**Tests to implement:**

- `GDN-059-T01`: Privacy storage audit.
- `GDN-059-T02`: Deep-link/back-button E2E.
- `GDN-059-T03`: Cleared-state test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Anonymous by default; account sync requires separate opt-in and appropriate data classification.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Visitors choose interests, not racial/political profiles. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-059/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-059-public-visitor-routes-and-reading-continuity`.

#### GDN-060 - About, ownership and proposal status

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F10, F41. **Direct dependencies:** GDN-040, GDN-049. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Identify the organization, editorial roles, funding disclosures, contact channels and dated legislative status with evidence.

**Data/API/contract:** organization_profile and status_history carry verification timestamp and source.

**Acceptance:**

- `GDN-060-AC01`: No unofficial program appears to be a federal service.
- `GDN-060-AC02`: Status changes require authoritative source and review.
- `GDN-060-AC03`: Operational contacts are real and tested.

**Tests to implement:**

- `GDN-060-T01`: Status-source validation.
- `GDN-060-T02`: Contact delivery sandbox.
- `GDN-060-T03`: Misleading-government-branding review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Keep unverified offices/endorsements absent; archived statuses remain distinguishable from current ones.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No unofficial program appears to be a federal service. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-060/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-060-about-ownership-and-proposal-status`.

#### GDN-061 - Public FAQ and searchable questions

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F02, F07, F11. **Direct dependencies:** GDN-040, GDN-049, GDN-058. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build topic-filtered questions with concise answers, full explanations, dated sources and unresolved-status labels.

**Data/API/contract:** question_pages link policy revision, claim references and response owner.

**Acceptance:**

- `GDN-061-AC01`: Answers cite specific provisions or evidence.
- `GDN-061-AC02`: Unanswered questions can be submitted without forced endorsement.
- `GDN-061-AC03`: Search includes synonyms without altering claims.

**Tests to implement:**

- `GDN-061-T01`: FAQ retrieval relevance.
- `GDN-061-T02`: Source-link test.
- `GDN-061-T03`: Accessible accordion/no-JS test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish only approved answers; changed policy flags all dependent answers for review.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Answers cite specific provisions or evidence. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-061/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-061-public-faq-and-searchable-questions`.

#### GDN-062 - Print, lightweight reading and slow-network modes

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F02, F03, F39. **Direct dependencies:** GDN-049, GDN-050, GDN-052, GDN-053. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add text-first reading, print styles, optional image suppression and robust low-bandwidth fallbacks. Do not cache restricted research offline.

**Data/API/contract:** Public reading preferences are local; downloadable editions derive from named publication snapshot.

**Acceptance:**

- `GDN-062-AC01`: Essential meaning survives without media.
- `GDN-062-AC02`: Printed pages include source/status/version.
- `GDN-062-AC03`: No private content enters public service-worker cache.

**Tests to implement:**

- `GDN-062-T01`: Offline public-cache review.
- `GDN-062-T02`: Slow-network E2E.
- `GDN-062-T03`: Print pagination and private-route exclusion tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No broad service-worker caching; preserve live withdrawal notices where online access exists.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Essential meaning survives without media. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-062/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-062-print-lightweight-reading-and-slow-network-modes`.

#### GDN-063 - Multilingual public content and review freshness

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F02, F13, F39. **Direct dependencies:** GDN-040, GDN-050, GDN-058. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement locale-aware routes, directionality, translation provenance, fallback and stale-translation notices.

**Data/API/contract:** translation_versions bind exact source version and human/machine review state.

**Acceptance:**

- `GDN-063-AC01`: Original/source language remains accessible.
- `GDN-063-AC02`: Corrected original marks translations stale.
- `GDN-063-AC03`: Missing translation never fabricates content.

**Tests to implement:**

- `GDN-063-T01`: RTL/long-string layout.
- `GDN-063-T02`: Locale URL/metadata tests.
- `GDN-063-T03`: Source-correction invalidation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Launch only reviewed languages; label partial coverage and do not present machine output as reviewed translation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Original/source language remains accessible. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-063/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-063-multilingual-public-content-and-review-freshness`.

#### GDN-064 - Public experience acceptance and launch content audit

**Status:** planned. **Owner:** Frontend engineer + public editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F02, F03, F05, F39. **Direct dependencies:** GDN-051, GDN-052, GDN-053, GDN-054, GDN-055, GDN-056, GDN-057, GDN-058, GDN-059, GDN-060, GDN-061, GDN-062, GDN-063. **External gates:** X07.

**Scope and outcome:** Run integrated usability, comprehension, content-source, rights and accessibility checks across newcomer and investigation paths. Create a reproducible acceptance dossier.

**Data/API/contract:** UX evidence distinguishes observations from targets and records consented aggregate findings.

**Acceptance:**

- `GDN-064-AC01`: Planned comprehension threshold is tested with actual participants before claimed.
- `GDN-064-AC02`: Every launch asset and claim has clearance.
- `GDN-064-AC03`: Known limitations remain visible.

**Tests to implement:**

- `GDN-064-T01`: Representative participant task study.
- `GDN-064-T02`: Screen-reader/keyboard audit.
- `GDN-064-T03`: Mobile performance and source-link crawl.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Fix critical comprehension/accessibility failures before launch; do not claim user testing from synthetic personas.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Planned comprehension threshold is tested with actual participants before claimed. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-064/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-064-public-experience-acceptance-and-launch-content-audit`.

### P05 - Policy, funding and legislative explanation

#### GDN-065 - Program-stage explorer and decision authority

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F06, F07. **Direct dependencies:** GDN-040, GDN-050, GDN-052. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement enactment-to-census-to-founding-to-compacts-to-enterprises steps and a who-decides view using versioned conditions rather than assumed dates.

**Data/API/contract:** policy_stage and authority_assignment records bind to specific draft provisions.

**Acceptance:**

- `GDN-065-AC01`: Dependent stages show prerequisites.
- `GDN-065-AC02`: Opportunity to negotiate is not displayed as an award.
- `GDN-065-AC03`: State, nation, Assembly and individual authority stay distinct.

**Tests to implement:**

- `GDN-065-T01`: Stage dependency tests.
- `GDN-065-T02`: Delayed/failure scenarios.
- `GDN-065-T03`: Keyboard diagram equivalent.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Proposal mode only; actual execution dates require independently verified authority and status.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Dependent stages show prerequisites. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-065/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-065-program-stage-explorer-and-decision-authority`.

#### GDN-066 - Rights and informational eligibility guide

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F07, F37. **Direct dependencies:** GDN-040, GDN-050, GDN-058, GDN-065. **External gates:** X07.

**Scope and outcome:** Explain draft criteria, optional affiliation, privacy, appeals and continuing US citizenship. Provide a non-recording local questionnaire for general information.

**Data/API/contract:** Local informational answers are ephemeral and never become researcher/account profile fields.

**Acceptance:**

- `GDN-066-AC01`: No ancestry documents or genetic data are collected.
- `GDN-066-AC02`: Guide does not issue eligibility decisions.
- `GDN-066-AC03`: Selecting a historical affiliation is not proof of ancestry.

**Tests to implement:**

- `GDN-066-T01`: Browser storage/network audit.
- `GDN-066-T02`: Ambiguous-answer and minor scenarios.
- `GDN-066-T03`: Draft-rule version test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Keep clear proposed/nonbinding labels; legal review required for explanations and any later criteria changes.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No ancestry documents or genetic data are collected. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-066/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-066-rights-and-informational-eligibility-guide`.

#### GDN-067 - Legislative reader with provision anchors

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F10, F20. **Direct dependencies:** GDN-038, GDN-040, GDN-042, GDN-050. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Render full legislation as accessible HTML with stable section anchors, source file downloads and commentary clearly separated from operative draft text.

**Data/API/contract:** policy_provisions and original-file references support permanent versioned URLs.

**Acceptance:**

- `GDN-067-AC01`: All 13 titles and 31 sections reconcile to the source version.
- `GDN-067-AC02`: Copy/citation includes version and provision.
- `GDN-067-AC03`: Commentary cannot alter quoted legislative text.

**Tests to implement:**

- `GDN-067-T01`: Full-text hash-normalized comparison.
- `GDN-067-T02`: Anchor and download tests.
- `GDN-067-T03`: Screen-reader heading audit.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Immutable version routes plus current alias; corrected rendering retains provenance and comparison.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: All 13 titles and 31 sections reconcile to the source version. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-067/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-067-legislative-reader-with-provision-anchors`.

#### GDN-068 - Policy version comparison and change notices

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F10, F11, F34. **Direct dependencies:** GDN-037, GDN-040, GDN-067. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Show side-by-side and inline legislative changes, explanatory change logs and downstream content affected by revisions.

**Data/API/contract:** policy_change_sets reference exact old/new versions and impacted content IDs.

**Acceptance:**

- `GDN-068-AC01`: Added/deleted text is accessible beyond color.
- `GDN-068-AC02`: Old versions remain accessible.
- `GDN-068-AC03`: Changed numerical defaults trigger review of models and FAQs.

**Tests to implement:**

- `GDN-068-T01`: Diff fixtures with moved sections.
- `GDN-068-T02`: Stale dependent-content tests.
- `GDN-068-T03`: Keyboard diff navigation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish change notices with revision; never overwrite historic bill text in place.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Added/deleted text is accessible beyond color. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-068/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-068-policy-version-comparison-and-change-notices`.

#### GDN-069 - Deterministic funding calculation library

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F08, F31. **Direct dependencies:** GDN-040, GDN-067. **External gates:** X07.

**Scope and outcome:** Implement draft-specific fiscal calculations using decimal/minor-unit arithmetic, versioned assumptions and separate founding, operating, fee, tax and repayment accounts.

**Data/API/contract:** packages/fiscal-model exposes pure functions and scenario JSON, not financial promises or invented appropriations.

**Acceptance:**

- `GDN-069-AC01`: Fixed 5 percent return is not compounded.
- `GDN-069-AC02`: Repayment uses positive qualifying economic income and is capped at remaining target.
- `GDN-069-AC03`: Nonpayment/failure leaves exposure visible.

**Tests to implement:**

- `GDN-069-T01`: Zero/negative income.
- `GDN-069-T02`: Refunds and final overpayment.
- `GDN-069-T03`: Property tests for caps, sums and monotonic balances.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Test only illustrative inputs; fiscal/legal review before public release; never infer all costs from founding fund recovery.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Fixed 5 percent return is not compounded. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-069/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-069-deterministic-funding-calculation-library`.

#### GDN-070 - Funding center and assumption transparency

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F08, F11, F41. **Direct dependencies:** GDN-050, GDN-069. **External gates:** X07.

**Scope and outcome:** Display cash-flow diagrams, actual-versus-projected distinctions, assumptions, risks, repayment mechanism and downloadable calculation notes.

**Data/API/contract:** fiscal_explanations bind to model version and separately reviewed policy interpretations.

**Acceptance:**

- `GDN-070-AC01`: Intended recovery is prominent but not an unconditional zero-cost claim.
- `GDN-070-AC02`: Administration and tax effects remain separate.
- `GDN-070-AC03`: Every figure has unit, period and source/status.

**Tests to implement:**

- `GDN-070-T01`: Copy-to-model consistency.
- `GDN-070-T02`: Missing-input labels.
- `GDN-070-T03`: Accessible chart/table parity.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Public text remains qualified until actual fiscal assessment; no unsupported savings headline.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Intended recovery is prominent but not an unconditional zero-cost claim. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-070/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-070-funding-center-and-assumption-transparency`.

#### GDN-071 - Fiscal scenario explorer and reproducible exports

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F08, F09, F31. **Direct dependencies:** GDN-069, GDN-070. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add editable scenarios for low income, failure, delays, fees and changing costs with baseline comparison and machine-readable exports.

**Data/API/contract:** scenario_id, model_version, assumptions and results hash form reproducibility contract.

**Acceptance:**

- `GDN-071-AC01`: Inputs/units/ranges are explicit.
- `GDN-071-AC02`: A scenario URL restores the exact model version.
- `GDN-071-AC03`: Exports reproduce displayed results including residual exposure.

**Tests to implement:**

- `GDN-071-T01`: Golden scenarios.
- `GDN-071-T02`: Round-trip export.
- `GDN-071-T03`: Extreme/invalid input and keyboard control tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Rate-limit heavy runs; user-edited scenarios are clearly hypothetical and not official forecasts.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Inputs/units/ranges are explicit. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-071/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-071-fiscal-scenario-explorer-and-reproducible-exports`.

#### GDN-072 - Examples of benefits, choices and failure

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F09, F11. **Direct dependencies:** GDN-040, GDN-050, GDN-065, GDN-070. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Create labeled hypothetical examples of community budgeting, private investment, reinvestment versus distributions and unsuccessful negotiations.

**Data/API/contract:** illustrative_scenarios record assumptions and corresponding provisions, not fabricated personal histories.

**Acceptance:**

- `GDN-072-AC01`: Scenarios promise neither income nor specific public services.
- `GDN-072-AC02`: Hypothetical people are never testimonials.
- `GDN-072-AC03`: Failure examples receive comparable clarity.

**Tests to implement:**

- `GDN-072-T01`: Hypothetical-label audit.
- `GDN-072-T02`: Policy authority checks.
- `GDN-072-T03`: Reviewer comprehension tasks.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish with reviewed caveats; withdraw examples whose enabling provision changes.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Scenarios promise neither income nor specific public services. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-072/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-072-examples-of-benefits-choices-and-failure`.

#### GDN-073 - Objections, alternatives and unresolved analysis

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F11, F20. **Direct dependencies:** GDN-040, GDN-061, GDN-065, GDN-070. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide structured questions, strongest substantive objections, project responses, independent views and comparisons using explicit criteria.

**Data/API/contract:** issue_analyses distinguish argument, evidence, forecast and editorial position.

**Acceptance:**

- `GDN-073-AC01`: Disagreement is not hidden or popularity-ranked as truth.
- `GDN-073-AC02`: Unresolved legal/fiscal questions stay visible.
- `GDN-073-AC03`: Research contributors need not endorse the policy.

**Tests to implement:**

- `GDN-073-T01`: Alternative comparison fairness review.
- `GDN-073-T02`: Citation coverage.
- `GDN-073-T03`: Unresolved-question workflow tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Independent review lane; no suppression of unfavorable findings through promotional permissions.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Disagreement is not hidden or popularity-ranked as truth. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-073/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-073-objections-alternatives-and-unresolved-analysis`.

#### GDN-074 - Legal research, authority and ambiguity register

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F10, F11, F42. **Direct dependencies:** GDN-036, GDN-040, GDN-067, GDN-068. **External gates:** X07.

**Scope and outcome:** Link draft provisions to relevant legal analyses and record questions requiring qualified counsel. Track law/source currency without pretending the proposal is enacted.

**Data/API/contract:** legal_issue records include jurisdiction, reviewed source, limitations and required recheck event.

**Acceptance:**

- `GDN-074-AC01`: Current law, draft text and argument are visibly separate.
- `GDN-074-AC02`: Legal conclusions have reviewer/date/scope.
- `GDN-074-AC03`: No automated legal eligibility determination.

**Tests to implement:**

- `GDN-074-T01`: Source-date and stale-review tests.
- `GDN-074-T02`: Ambiguous-authority fixture.
- `GDN-074-T03`: Counsel review workflow.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Disable implementation-dependent claims when authority is unresolved; legal review is expertise, not routine architectural approval.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Current law, draft text and argument are visibly separate. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-074/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-074-legal-research-authority-and-ambiguity-register`.

#### GDN-075 - Public current-documents registry and downloads

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F10, F21, F38. **Direct dependencies:** GDN-042, GDN-043, GDN-067, GDN-068. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build the stable latest-work page with current versions, status, prior milestones, checked links and rights-respecting downloads. Preserve existing index redirects.

**Data/API/contract:** document_registry carries version, hash, status, owner, saved_at and permanent URL.

**Acceptance:**

- `GDN-075-AC01`: Current alias resolves to verified edition.
- `GDN-075-AC02`: Old checkpoints remain intact.
- `GDN-075-AC03`: Research, legislation and software-plan milestones are separate.

**Tests to implement:**

- `GDN-075-T01`: Link activation and download-byte tests.
- `GDN-075-T02`: Stale-pointer race.
- `GDN-075-T03`: Version rollback and rights withdrawal tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Update alias only after durable save/readback; never point the latest index at an unverified upload.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Current alias resolves to verified edition. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-075/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-075-public-current-documents-registry-and-downloads`.

#### GDN-076 - Policy and fiscal launch integration gate

**Status:** planned. **Owner:** Policy interface engineer + fiscal/legal reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F06, F07, F08, F09, F10, F11. **Direct dependencies:** GDN-065, GDN-066, GDN-067, GDN-068, GDN-069, GDN-070, GDN-071, GDN-072, GDN-073, GDN-074, GDN-075. **External gates:** X07.

**Scope and outcome:** Verify policy walkthrough, bill reader, funding model, examples and objections against one consistent draft revision and the public narrative.

**Data/API/contract:** policy_release_evidence bundles model fixtures, reviewed copy and provision mappings.

**Acceptance:**

- `GDN-076-AC01`: Every material claim is sourced or labeled proposal/inference.
- `GDN-076-AC02`: Fiscal failure scenarios remain accessible.
- `GDN-076-AC03`: No site account confers legal status.

**Tests to implement:**

- `GDN-076-T01`: Full policy journey E2E.
- `GDN-076-T02`: Numeric model independent check.
- `GDN-076-T03`: Misleading-claim editorial audit.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Gate R1 policy publication; unresolved material contradictions block release of affected content.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Every material claim is sourced or labeled proposal/inference. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-076/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-076-policy-and-fiscal-launch-integration-gate`.

### P06 - Source intake and archival viewing

#### GDN-077 - Secure resumable source uploads

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F32, F37. **Direct dependencies:** GDN-015, GDN-016, GDN-025, GDN-029, GDN-041. **External gates:** X06.

**Scope and outcome:** Implement chunked uploads, checksums, quotas, pause/resume and clear contributor receipts for allowed file types.

**Data/API/contract:** upload_sessions and finalize endpoint require expected digest, size and owner.

**Acceptance:**

- `GDN-077-AC01`: Partial uploads cannot appear as complete sources.
- `GDN-077-AC02`: Unauthorized users cannot claim another upload.
- `GDN-077-AC03`: Originals are verified before processing.

**Tests to implement:**

- `GDN-077-T01`: Interrupted network and chunk replay.
- `GDN-077-T02`: Oversize and MIME mismatch.
- `GDN-077-T03`: Cross-user upload takeover tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Quarantine every new source; clean up abandoned chunks under documented retention.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Partial uploads cannot appear as complete sources. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-077/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-077-secure-resumable-source-uploads`.

#### GDN-078 - Repository links and bibliographic intake

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F30. **Direct dependencies:** GDN-036, GDN-041, GDN-077. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add manual repository records and import of common bibliographic formats, DOI/catalog metadata and citations with conservative matching.

**Data/API/contract:** acquisition_candidates store original metadata and normalized fields with source attribution.

**Acceptance:**

- `GDN-078-AC01`: Remote metadata is a discovery lead until reviewed.
- `GDN-078-AC02`: Provider license/access limits are recorded.
- `GDN-078-AC03`: Duplicate candidates require reversible decisions.

**Tests to implement:**

- `GDN-078-T01`: Malformed citation/import.
- `GDN-078-T02`: Same-title different-edition fixture.
- `GDN-078-T03`: Provider timeout and robots/access-denied behavior.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Never bypass repository restrictions; no automatic paid access or unsolicited contact.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Remote metadata is a discovery lead until reviewed. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-078/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-078-repository-links-and-bibliographic-intake`.

#### GDN-079 - Safe document conversion and derivative workers

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F25, F27. **Direct dependencies:** GDN-016, GDN-033, GDN-038, GDN-077. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Sandbox text extraction, image tiling and document conversion with resource limits, disabled macros/network and immutable source references.

**Data/API/contract:** derivative_jobs capture tool/version/parameters/input/output hashes and access class.

**Acceptance:**

- `GDN-079-AC01`: Malicious documents cannot reach private network or filesystem.
- `GDN-079-AC02`: Converter output is not historical verification.
- `GDN-079-AC03`: Errors retain original bytes and actionable diagnostics.

**Tests to implement:**

- `GDN-079-T01`: ZIP bomb/XML entity fixtures.
- `GDN-079-T02`: Timeout/memory limits.
- `GDN-079-T03`: Converter deterministic-output tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Begin with synthetic corpus; OCR remains optional, clearly provisional and used only where needed.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Malicious documents cannot reach private network or filesystem. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-079/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-079-safe-document-conversion-and-derivative-workers`.

#### GDN-080 - Page, text and exact-source viewer

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F20. **Direct dependencies:** GDN-038, GDN-043, GDN-050, GDN-079. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build zoomable page viewer with original page labels, digital page navigation, side-by-side text and linked evidence regions.

**Data/API/contract:** viewer manifest references immutable source/version and authorized derivative locations.

**Acceptance:**

- `GDN-080-AC01`: Deep links open exact page/region.
- `GDN-080-AC02`: Viewer does not misnumber excerpt PDFs.
- `GDN-080-AC03`: Source context and rights remain visible.

**Tests to implement:**

- `GDN-080-T01`: Page/region fixture suite.
- `GDN-080-T02`: Keyboard and screen-reader alternatives.
- `GDN-080-T03`: Large-document progressive loading.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Text/list alternative always available; denied pages do not leak thumbnails or titles.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Deep links open exact page/region. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-080/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-080-page-text-and-exact-source-viewer`.

#### GDN-081 - IIIF manifest and interoperability support

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F21. **Direct dependencies:** GDN-036, GDN-038, GDN-079, GDN-080. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Generate and consume supported IIIF Presentation manifests for eligible images and annotations, maintaining attribution and access controls.

**Data/API/contract:** IIIF adapter implements documented profile, not a claim of all IIIF extensions.

**Acceptance:**

- `GDN-081-AC01`: Manifests validate against chosen supported profile.
- `GDN-081-AC02`: Restricted image services require authorization.
- `GDN-081-AC03`: External viewer failures have local fallback.

**Tests to implement:**

- `GDN-081-T01`: Manifest interoperability fixtures.
- `GDN-081-T02`: Authenticated tile denial.
- `GDN-081-T03`: Invalid/cyclic manifest rejection.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Public manifests contain only cleared assets; snapshot external manifests with access-date provenance.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Manifests validate against chosen supported profile. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-081/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-081-iiif-manifest-and-interoperability-support`.

#### GDN-082 - Audio/video archival viewer and time-linked transcripts

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F27, F32, F39. **Direct dependencies:** GDN-029, GDN-038, GDN-079, GDN-080. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add media segments, synchronized transcripts, captions and speaker labels with consent-scoped delivery.

**Data/API/contract:** media_segments and transcript_cues bind exact media digest and consent.

**Acceptance:**

- `GDN-082-AC01`: Time links resolve to correct recording version.
- `GDN-082-AC02`: Redacted segments are not recoverable from alternate tracks.
- `GDN-082-AC03`: Transcript corrections retain prior readings privately.

**Tests to implement:**

- `GDN-082-T01`: Timecode drift.
- `GDN-082-T02`: Redacted audio/video range tests.
- `GDN-082-T03`: Caption/screen-reader review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No public playback before clearance; stream only authorized renditions, not hidden originals.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Time links resolve to correct recording version. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-082/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-082-audio-video-archival-viewer-and-time-linked-transcripts`.

#### GDN-083 - Document and witness comparison workspace

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F27, F28. **Direct dependencies:** GDN-038, GDN-080, GDN-082. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide synchronized and independent page/time panes, region matching and explicit alignment hypotheses for multiple witnesses.

**Data/API/contract:** alignment_hypotheses link witness locators with review state and rationale.

**Acceptance:**

- `GDN-083-AC01`: Positional similarity never asserts person identity.
- `GDN-083-AC02`: Missing or displaced rows stay visible.
- `GDN-083-AC03`: Alignment changes are reversible and attributed.

**Tests to implement:**

- `GDN-083-T01`: Marinerito row-223 displacement fixture.
- `GDN-083-T02`: Missing-leaf/remarks-column tests.
- `GDN-083-T03`: Unsynchronized page-turn scenarios.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Hypothesis overlays stay provisional until reviewed; no inferred offsets applied to raw transcriptions.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Positional similarity never asserts person identity. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-083/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-083-document-and-witness-comparison-workspace`.

#### GDN-084 - Source annotations and evidence capture

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F20, F27, F29. **Direct dependencies:** GDN-025, GDN-030, GDN-038, GDN-080, GDN-082. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Let researchers annotate image regions, text spans and media segments, attach notes and propose evidence links with visibility controls.

**Data/API/contract:** Web Annotation-compatible records with purpose, body, selector, author and version.

**Acceptance:**

- `GDN-084-AC01`: Private annotations never appear in public manifests.
- `GDN-084-AC02`: Orphaned selectors are flagged.
- `GDN-084-AC03`: Evidence proposal preserves exact quote and locator.

**Tests to implement:**

- `GDN-084-T01`: Annotation permissions.
- `GDN-084-T02`: Quote mismatch.
- `GDN-084-T03`: Concurrent edit and withdrawn-source tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Draft annotations are private to authorized workspace; publication follows separate review.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Private annotations never appear in public manifests. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-084/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-084-source-annotations-and-evidence-capture`.

#### GDN-085 - Source acquisition queue and repository requests

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F30, F35. **Direct dependencies:** GDN-023, GDN-029, GDN-036, GDN-078. **External gates:** X08.

**Scope and outcome:** Track scans, permissions, access barriers, repository correspondence, lawful offline research leads and costs without initiating unauthorized transactions.

**Data/API/contract:** acquisition_tasks reference repository, item, purpose, estimate and authority evidence.

**Acceptance:**

- `GDN-085-AC01`: Requests have owner/status and explicit authorization for contact/spend.
- `GDN-085-AC02`: Inaccessible differs from nonexistent.
- `GDN-085-AC03`: Repeated denied routes are not retried to evade controls.

**Tests to implement:**

- `GDN-085-T01`: Request state transitions.
- `GDN-085-T02`: Duplicate contact prevention.
- `GDN-085-T03`: Cost-authorization guard tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Draft requests can be prepared; actual contact/purchase only within specific authority.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Requests have owner/status and explicit authorization for contact/spend. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-085/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-085-source-acquisition-queue-and-repository-requests`.

#### GDN-086 - Source context, reliability and independence reviews

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F25, F28, F30. **Direct dependencies:** GDN-036, GDN-037, GDN-039, GDN-080. **External gates:** X07.

**Scope and outcome:** Add structured reviews of provenance, author position, witness dependence, translation limits, completeness and competing interpretations.

**Data/API/contract:** source_reviews and derivation_edges feed evidence displays and review tasks.

**Acceptance:**

- `GDN-086-AC01`: Authenticity and factual accuracy are separate assessments.
- `GDN-086-AC02`: Derivative sources are grouped.
- `GDN-086-AC03`: Review scope names inspected pages, not whole-volume inference.

**Tests to implement:**

- `GDN-086-T01`: Same-source derivative fixtures.
- `GDN-086-T02`: Partial-reading status.
- `GDN-086-T03`: Reviewer conflict and contradictory-evidence tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No automatic truth score; independent review can disagree without overwriting prior rationale.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Authenticity and factual accuracy are separate assessments. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-086/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-086-source-context-reliability-and-independence-reviews`.

#### GDN-087 - Source citation, rights-aware download and reuse

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F21, F33. **Direct dependencies:** GDN-025, GDN-029, GDN-036, GDN-038, GDN-080, GDN-081. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Produce citations and authorized source/derivative downloads with complete repository, call-number, edition, locator and license information.

**Data/API/contract:** citation service emits structured metadata plus requested style and snapshot identifier.

**Acceptance:**

- `GDN-087-AC01`: Missing metadata is explicit rather than invented.
- `GDN-087-AC02`: Citation links survive version changes.
- `GDN-087-AC03`: Rights-denied download still provides permitted citation metadata.

**Tests to implement:**

- `GDN-087-T01`: CSL/BibTeX/RIS fixtures.
- `GDN-087-T02`: Restricted download denial.
- `GDN-087-T03`: Permanent link and special-character tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Disable unauthorized binary exports; citation metadata access follows its own classification.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Missing metadata is explicit rather than invented. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-087/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-087-source-citation-rights-aware-download-and-reuse`.

#### GDN-088 - Intake-to-viewer integrated acceptance

**Status:** planned. **Owner:** Archival systems engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F19, F25, F27, F37. **Direct dependencies:** GDN-077, GDN-078, GDN-079, GDN-080, GDN-081, GDN-082, GDN-083, GDN-084, GDN-085, GDN-086, GDN-087. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Exercise full source workflow with hostile files, large scans, missing pages, private media, corrected metadata and lost network sessions.

**Data/API/contract:** Source service evidence records format coverage, known limitations and real online checks.

**Acceptance:**

- `GDN-088-AC01`: No accepted source loses originals or provenance.
- `GDN-088-AC02`: Unauthorized data is absent from every viewer path.
- `GDN-088-AC03`: Recovery resumes from durable checkpoints.

**Tests to implement:**

- `GDN-088-T01`: End-to-end upload/view/cite/revoke.
- `GDN-088-T02`: Parser security battery.
- `GDN-088-T03`: Representative archival specialist review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Gate broader researcher source intake; unsupported formats remain preserved but not falsely rendered.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No accepted source loses originals or provenance. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-088/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-088-intake-to-viewer-integrated-acceptance`.

### P07 - Atlas, search and geographic discovery

#### GDN-089 - Historical subject pages and dossier navigation

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F20, F26. **Direct dependencies:** GDN-035, GDN-037, GDN-039, GDN-043, GDN-050. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build pages for polities, peoples, people, places, institutions, voyages and events with evidence, aliases, scope and uncertainty.

**Data/API/contract:** /atlas/:type/:id uses stable IDs with readable slugs and redirects.

**Acceptance:**

- `GDN-089-AC01`: Entity type and historical period are visible.
- `GDN-089-AC02`: Unknown origins are not invented nations.
- `GDN-089-AC03`: Related subjects are authorized and evidence-linked.

**Tests to implement:**

- `GDN-089-T01`: Type-specific page tests.
- `GDN-089-T02`: Long/ambiguous name fixtures.
- `GDN-089-T03`: Missing evidence and disputed status display.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish reviewed subject summaries first; incomplete dossiers show exactly what is reviewed.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Entity type and historical period are visible. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-089/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-089-historical-subject-pages-and-dossier-navigation`.

#### GDN-090 - Names, aliases and historical terminology resolution

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F16, F26. **Direct dependencies:** GDN-035, GDN-089. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add searchable spelling/transliteration variants, language labels, historical names and explainable suggestions without automatic identity merging.

**Data/API/contract:** name_authorities distinguish preferred display, source form, transliteration and uncertain alias.

**Acceptance:**

- `GDN-090-AC01`: Exact original names remain accessible.
- `GDN-090-AC02`: Suggestions explain why they match.
- `GDN-090-AC03`: Similar names can remain separate entities.

**Tests to implement:**

- `GDN-090-T01`: Diacritics/non-Latin fixtures.
- `GDN-090-T02`: Homonym tests.
- `GDN-090-T03`: Alias reversal and disputed alias scenarios.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Suggestions never change canonical identities without reviewer action.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Exact original names remain accessible. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-090/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-090-names-aliases-and-historical-terminology-resolution`.

#### GDN-091 - Public text index and simple search

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F16, F20. **Direct dependencies:** GDN-043, GDN-089, GDN-090. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build a public-only full-text index with exact/phrase search, excerpt highlighting, type/status filters and useful no-results guidance.

**Data/API/contract:** /api/v1/public/search accepts validated query and returns versioned result/citation payloads.

**Acceptance:**

- `GDN-091-AC01`: Results expose only approved public fields.
- `GDN-091-AC02`: Matches link to exact context.
- `GDN-091-AC03`: No-results does not imply historical absence.

**Tests to implement:**

- `GDN-091-T01`: Relevance judgment set.
- `GDN-091-T02`: Public canaries and facet counts.
- `GDN-091-T03`: Typo/query injection and empty-query tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Atomic index generations; rollback retains revocation filters and public eligibility checks.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Results expose only approved public fields. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-091/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-091-public-text-index-and-simple-search`.

#### GDN-092 - Research search with permission-first retrieval

**Status:** planned. **Owner:** Search and data engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F17, F23, F37. **Direct dependencies:** GDN-025, GDN-031, GDN-035, GDN-036, GDN-037, GDN-038, GDN-091. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add separate researcher indexes and policy filters before ranking, faceting, snippets or aggregation. Exclude sealed content from server indexes.

**Data/API/contract:** /api/v1/research/search is distinct from public search and rechecks record authorization.

**Acceptance:**

- `GDN-092-AC01`: Membership revocation removes results immediately at delivery.
- `GDN-092-AC02`: Workspace boundaries apply to counts.
- `GDN-092-AC03`: Sealed ciphertext is never indexed as text.

**Tests to implement:**

- `GDN-092-T01`: Cross-role search matrix.
- `GDN-092-T02`: Revocation race.
- `GDN-092-T03`: Query/log/embedding plaintext canaries.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No shared public/private index credentials; restricted search blocked until negative-access suite passes.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Membership revocation removes results immediately at delivery. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-092/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-092-research-search-with-permission-first-retrieval`.

#### GDN-093 - Advanced structured query builder

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 5 (not a time estimate).

**Features:** F17. **Direct dependencies:** GDN-038, GDN-050, GDN-091, GDN-092. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement an accessible validated query AST for dates, record types, languages, repositories, review states, relations, exact phrases and missing data.

**Data/API/contract:** SearchQuery v1 JSON compiles to parameterized queries; unsupported operators fail explicitly.

**Acceptance:**

- `GDN-093-AC01`: Event date differs from document/digitization date.
- `GDN-093-AC02`: Query round trips without semantic drift.
- `GDN-093-AC03`: Complexity limits prevent expensive arbitrary SQL.

**Tests to implement:**

- `GDN-093-T01`: AST serialization/property tests.
- `GDN-093-T02`: Date uncertainty and exclusion tests.
- `GDN-093-T03`: Keyboard query-building E2E.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Advanced interface is optional; basic search remains easy and available.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Event date differs from document/digitization date. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-093/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-093-advanced-structured-query-builder`.

#### GDN-094 - Reproducible queries, saved searches and citations

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F17, F21, F31. **Direct dependencies:** GDN-021, GDN-029, GDN-093. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Save or share queries against named public snapshots or authorized workspaces, record result counts and offer opt-in change notifications.

**Data/API/contract:** saved_queries contain AST, corpus snapshot and display preferences, not copied restricted results.

**Acceptance:**

- `GDN-094-AC01`: Shared query cannot grant access to hidden records.
- `GDN-094-AC02`: Historical snapshot is identified.
- `GDN-094-AC03`: Notifications never leak removed/private titles.

**Tests to implement:**

- `GDN-094-T01`: Query replay and snapshot test.
- `GDN-094-T02`: Shared-link permission denial.
- `GDN-094-T03`: Notification consent/withdrawal tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Scheduling exists only for user-enabled subscriptions; no automatic marketing enrollment.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Shared query cannot grant access to hidden records. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-094/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-094-reproducible-queries-saved-searches-and-citations`.

#### GDN-095 - Historical geography and uncertainty data layer

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F18, F26. **Direct dependencies:** GDN-035, GDN-037, GDN-039. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Model sourced geographic assertions, changing names/boundaries and approximate locations without treating modern states as historical polities.

**Data/API/contract:** geographic_assertions store versioned GeoJSON, CRS, temporal extent and evidentiary status.

**Acceptance:**

- `GDN-095-AC01`: Every map geometry has source, date and uncertainty.
- `GDN-095-AC02`: Multiple competing extents can coexist.
- `GDN-095-AC03`: Sensitive living-person locations stay private.

**Tests to implement:**

- `GDN-095-T01`: Geometry validity.
- `GDN-095-T02`: Date-overlap/uncertain extent fixtures.
- `GDN-095-T03`: Coordinate privacy tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Verify available database geospatial support before choosing extension; no unexplained coordinate invention.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Every map geometry has source, date and uncertainty. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-095/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-095-historical-geography-and-uncertainty-data-layer`.

#### GDN-096 - Accessible atlas map and linked list view

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F18, F39. **Direct dependencies:** GDN-043, GDN-050, GDN-089, GDN-095. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build progressive-loading maps with synchronized accessible lists, uncertain-boundary styles and optional modern context.

**Data/API/contract:** Map API serves simplified public geometries with source and date metadata.

**Acceptance:**

- `GDN-096-AC01`: Every essential map action has a non-map path.
- `GDN-096-AC02`: Uncertainty is described in text.
- `GDN-096-AC03`: Default view does not expose precise protected locations.

**Tests to implement:**

- `GDN-096-T01`: Keyboard/list parity.
- `GDN-096-T02`: Large-geometry performance.
- `GDN-096-T03`: Modern/historical layer labeling review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** On-demand map loading; approved tile-provider costs and attribution required before production.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Every essential map action has a non-map path. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-096/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-096-accessible-atlas-map-and-linked-list-view`.

#### GDN-097 - Timelines and temporal investigation

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F18. **Direct dependencies:** GDN-035, GDN-038, GDN-043, GDN-050, GDN-089. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Display events, source dates and interpretations on navigable timelines with uncertain ranges and linked evidence.

**Data/API/contract:** temporal_assertions carry earliest/latest bounds, calendar, precision and provenance.

**Acceptance:**

- `GDN-097-AC01`: Approximate dates are not rendered as exact points.
- `GDN-097-AC02`: BCE/CE and calendars are explicit.
- `GDN-097-AC03`: Source creation and event dates stay distinguishable.

**Tests to implement:**

- `GDN-097-T01`: Interval overlap and unknown-date fixtures.
- `GDN-097-T02`: Keyboard navigation.
- `GDN-097-T03`: Timeline/list equivalence.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Timeline is an interpretation view; conflicting dates remain inspectable rather than averaged.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Approximate dates are not rendered as exact points. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-097/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-097-timelines-and-temporal-investigation`.

#### GDN-098 - Relationship and movement exploration

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F18, F20. **Direct dependencies:** GDN-035, GDN-037, GDN-043, GDN-089, GDN-095. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add relationship and voyage/movement views with source-backed edges, accessible tables and clear hypothesis styling.

**Data/API/contract:** graph responses include relationship type, evidence IDs, confidence description and visibility.

**Acceptance:**

- `GDN-098-AC01`: No line implies certainty absent evidence.
- `GDN-098-AC02`: Person-level movements require identity support.
- `GDN-098-AC03`: Graph depth and node limits preserve usability.

**Tests to implement:**

- `GDN-098-T01`: Unsupported-edge rejection.
- `GDN-098-T02`: Cyclic/large graph stress.
- `GDN-098-T03`: Table/graph semantic parity.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Do not infer ancestry or origin from ports, names or visual resemblance; public only unless explicitly authorized.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No line implies certainty absent evidence. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-098/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-098-relationship-and-movement-exploration`.

#### GDN-099 - Claim evidence drawer and review history

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F28. **Direct dependencies:** GDN-037, GDN-038, GDN-039, GDN-043, GDN-050, GDN-080. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Expose supporting and contradicting evidence, exact passages, review scope, alternative interpretations and correction history beside public claims.

**Data/API/contract:** /claims/:id/evidence returns public review decision versions and authorized source anchors.

**Acceptance:**

- `GDN-099-AC01`: Reader can distinguish source statement from synthesis.
- `GDN-099-AC02`: Partial review never becomes whole-page verification.
- `GDN-099-AC03`: Reviewer role/date and unresolved disputes are visible.

**Tests to implement:**

- `GDN-099-T01`: Evidence-bound claim fixtures.
- `GDN-099-T02`: Superseded review display.
- `GDN-099-T03`: Source-deletion and missing-locator tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Fail closed on private evidence; explain restricted supporting source metadata only when permitted.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Reader can distinguish source statement from synthesis. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-099/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-099-claim-evidence-drawer-and-review-history`.

#### GDN-100 - Reading shelf and private notes

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F21, F37. **Direct dependencies:** GDN-021, GDN-025, GDN-029, GDN-050, GDN-089. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add bookmarks, saved passages, private notes and optional cross-device sync. Keep interests and notes out of advocacy profiling.

**Data/API/contract:** collections, collection_items and personal_notes with separate public-sharing permission.

**Acceptance:**

- `GDN-100-AC01`: Notes default private.
- `GDN-100-AC02`: Account export includes own notes only.
- `GDN-100-AC03`: Public reading remains usable without an account.

**Tests to implement:**

- `GDN-100-T01`: Cross-user note denial.
- `GDN-100-T02`: Sync/offline conflict.
- `GDN-100-T03`: Delete/export/consent tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Local-only option remains; no demographic inferences from reading behavior.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Notes default private. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-100/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-100-reading-shelf-and-private-notes`.

#### GDN-101 - Public curated collections and share controls

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F13, F21, F35. **Direct dependencies:** GDN-034, GDN-087, GDN-089, GDN-100. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Let authorized users publish curated record collections with captions, citations and granular sharing after rights/content review.

**Data/API/contract:** collection_versions bind to permitted record versions; private comments never ride with publication.

**Acceptance:**

- `GDN-101-AC01`: Sharing a collection does not publish restricted members.
- `GDN-101-AC02`: Missing or withdrawn items have safe fallbacks.
- `GDN-101-AC03`: Collection authorship is attributable.

**Tests to implement:**

- `GDN-101-T01`: Mixed-access collection test.
- `GDN-101-T02`: Shared-link revocation.
- `GDN-101-T03`: Member withdrawal propagation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Preview exactly what anonymous readers will see before publication.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Sharing a collection does not publish restricted members. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-101/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-101-public-curated-collections-and-share-controls`.

#### GDN-102 - Dataset and bibliography exports with manifests

**Status:** planned. **Owner:** Search and data engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F17, F21, F31, F38. **Direct dependencies:** GDN-025, GDN-032, GDN-087, GDN-093, GDN-101. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Export rights-permitted query results, citations and structured metadata with schemas, checksums, provenance and snapshot IDs.

**Data/API/contract:** export_manifest records query, snapshot, formats, row counts, exclusions and rights.

**Acceptance:**

- `GDN-102-AC01`: Export authorization is checked at execution and delivery.
- `GDN-102-AC02`: Row limits and completeness are explicit.
- `GDN-102-AC03`: Exports do not claim unique-person counts from registration rows.

**Tests to implement:**

- `GDN-102-T01`: Large streamed export.
- `GDN-102-T02`: Revocation while queued.
- `GDN-102-T03`: Reimport and schema-version tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Expiring downloads for restricted exports; stop jobs on revocation and record already-delivered limits.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Export authorization is checked at execution and delivery. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-102/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-102-dataset-and-bibliography-exports-with-manifests`.

#### GDN-103 - Search relevance, language and load evaluation

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F16, F17, F18, F39. **Direct dependencies:** GDN-090, GDN-091, GDN-092, GDN-093, GDN-094, GDN-096, GDN-097, GDN-098, GDN-099, GDN-102. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build expert-judged query sets across source languages, exact names, uncertainty and common public questions. Measure quality and performance separately.

**Data/API/contract:** search-evaluation.json versions judgments, metrics, exclusions and configuration.

**Acceptance:**

- `GDN-103-AC01`: Evaluation includes hard negatives and marginalized source lanes.
- `GDN-103-AC02`: Results are not tuned to favor pro-policy narratives.
- `GDN-103-AC03`: Performance targets have recorded test conditions.

**Tests to implement:**

- `GDN-103-T01`: Recall and ranking evaluation.
- `GDN-103-T02`: Million-row synthetic benchmark.
- `GDN-103-T03`: Cross-locale/permission regression.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** A target is not a measured result; index changes require regression evidence before swap.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Evaluation includes hard negatives and marginalized source lanes. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-103/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-103-search-relevance-language-and-load-evaluation`.

#### GDN-104 - Public investigation journey acceptance

**Status:** planned. **Owner:** Search and data engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F16, F17, F18, F19, F20, F21. **Direct dependencies:** GDN-064, GDN-088, GDN-089, GDN-091, GDN-093, GDN-096, GDN-097, GDN-098, GDN-099, GDN-100, GDN-101, GDN-102, GDN-103. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Validate story-to-subject-to-claim-to-source-to-citation journeys across public, researcher and assistive-technology paths.

**Data/API/contract:** Release evidence ties findings to actual deployed build and corpus snapshot.

**Acceptance:**

- `GDN-104-AC01`: First-time users can find and cite evidence without researcher jargon.
- `GDN-104-AC02`: Denied evidence never leaks.
- `GDN-104-AC03`: Disputed findings remain understandable.

**Tests to implement:**

- `GDN-104-T01`: Timed task observation.
- `GDN-104-T02`: Citation reproduction by second user.
- `GDN-104-T03`: Public/restricted role-switch E2E.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Gate public research expansion; unresolved usability defects do not block unrelated reviewed public explainers.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: First-time users can find and cite evidence without researcher jargon. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-104/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-104-public-investigation-journey-acceptance`.

### P08 - Transcription, review and researcher collaboration

#### GDN-105 - Diplomatic transcription editor

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F27, F29. **Direct dependencies:** GDN-023, GDN-025, GDN-038, GDN-079, GDN-080, GDN-084. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build line/page-bound transcription with uncertain characters, abbreviations, deletions, ditto marks and original orthography. Preserve machine suggestions separately.

**Data/API/contract:** transcription_versions and transcription_segments reference exact witness locators.

**Acceptance:**

- `GDN-105-AC01`: Original source and literal transcription remain distinguishable.
- `GDN-105-AC02`: Uncertain reading notation survives export.
- `GDN-105-AC03`: Editing never changes source bytes.

**Tests to implement:**

- `GDN-105-T01`: Unicode/diacritic fixtures.
- `GDN-105-T02`: Ditto and uncertain-character round trip.
- `GDN-105-T03`: Permission and page-anchor tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Draft by default; no automatic normalization or AI promotion into reviewed text.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Original source and literal transcription remain distinguishable. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-105/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-105-diplomatic-transcription-editor`.

#### GDN-106 - Structured registers, tables and row alignment

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F26, F27, F28. **Direct dependencies:** GDN-083, GDN-105. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide cell-level transcription, row boundaries, facing-leaf remarks linkage and competing alignment hypotheses for registers.

**Data/API/contract:** register_rows, cells and alignment_decisions carry source coordinates and review state.

**Acceptance:**

- `GDN-106-AC01`: Row position is not person identity.
- `GDN-106-AC02`: Missing leaves/rows remain explicit.
- `GDN-106-AC03`: Alignment changes preserve both originals and rationale.

**Tests to implement:**

- `GDN-106-T01`: Marinerito displacement fixture.
- `GDN-106-T02`: Merged cells/ditto rows.
- `GDN-106-T03`: Facing-page and shifted-column regression.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Provisional rows cannot become accepted through bulk fill or inferred offset.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Row position is not person identity. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-106/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-106-structured-registers-tables-and-row-alignment`.

#### GDN-107 - Translation and normalized-text layers

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F27, F39. **Direct dependencies:** GDN-038, GDN-063, GDN-105. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add distinct diplomatic, normalized and translated layers with language, translator, source-version binding and terminology notes.

**Data/API/contract:** text_layers and translation_reviews reference precise source layer versions.

**Acceptance:**

- `GDN-107-AC01`: Translation never overwrites original wording.
- `GDN-107-AC02`: Source corrections invalidate affected translation review.
- `GDN-107-AC03`: Machine drafts remain clearly marked.

**Tests to implement:**

- `GDN-107-T01`: Source-change invalidation.
- `GDN-107-T02`: RTL and mixed-script fixtures.
- `GDN-107-T03`: Translation export round trip.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish only cleared reviewed layers; original remains accessible when permitted.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Translation never overwrites original wording. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-107/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-107-translation-and-normalized-text-layers`.

#### GDN-108 - Independent second-reading and adjudication queues

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F27, F28. **Direct dependencies:** GDN-023, GDN-039, GDN-086, GDN-105, GDN-106, GDN-107. **External gates:** X07.

**Scope and outcome:** Assign qualified independent reviewers, hide prior readings where useful and preserve disagreements before adjudication.

**Data/API/contract:** review_assignments, reading_comparisons and adjudications record evidence and qualifications.

**Acceptance:**

- `GDN-108-AC01`: Author cannot provide required independent approval.
- `GDN-108-AC02`: Review scope covers exact rows/pages.
- `GDN-108-AC03`: Unresolved readings remain provisional.

**Tests to implement:**

- `GDN-108-T01`: Reviewer conflict tests.
- `GDN-108-T02`: Blinded comparison.
- `GDN-108-T03`: Partial-row approval and reassignment tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No scholarly approval fabricated by the implementation agent; missing reviewer is an explicit content gate.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Author cannot provide required independent approval. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-108/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-108-independent-second-reading-and-adjudication-queues`.

#### GDN-109 - Entity matching proposals and reversible merge UI

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F26, F28. **Direct dependencies:** GDN-023, GDN-035, GDN-039, GDN-090, GDN-106. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide side-by-side evidence for possible identity matches, duplicate entities and aliases with reject/merge/unmerge workflows.

**Data/API/contract:** identity_hypotheses and merge_events preserve source-specific identities and alternatives.

**Acceptance:**

- `GDN-109-AC01`: Name similarity alone cannot establish identity.
- `GDN-109-AC02`: Every merge has evidence and reviewer.
- `GDN-109-AC03`: Unmerge restores citations and relationships coherently.

**Tests to implement:**

- `GDN-109-T01`: False-positive homonyms.
- `GDN-109-T02`: Merge-chain reversal.
- `GDN-109-T03`: Concurrent merge and referenced-record tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Suggestions only; bulk automatic genealogy or nation assignment is prohibited.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Name similarity alone cannot establish identity. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-109/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-109-entity-matching-proposals-and-reversible-merge-ui`.

#### GDN-110 - Atomic claim authoring and evidence linking

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F28, F29. **Direct dependencies:** GDN-037, GDN-038, GDN-039, GDN-084, GDN-086, GDN-105. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Let researchers split compound assertions, classify claim types and attach supporting/contradicting locators and scoped interpretation.

**Data/API/contract:** claim_versions, evidence_edges and placement_dependencies drive review and later corrections.

**Acceptance:**

- `GDN-110-AC01`: Each substantive proposition has an independently reviewable unit.
- `GDN-110-AC02`: Claims can preserve uncertainty without a numeric score.
- `GDN-110-AC03`: Every public placement is tracked.

**Tests to implement:**

- `GDN-110-T01`: Compound-claim fixtures.
- `GDN-110-T02`: Evidence-selector mismatch.
- `GDN-110-T03`: Split/merge placement lineage tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Draft authoring does not publish or certify; prior claims remain recoverable after segmentation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Each substantive proposition has an independently reviewable unit. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-110/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-110-atomic-claim-authoring-and-evidence-linking`.

#### GDN-111 - Peer review, reviewer conflicts and decisions

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F28, F36. **Direct dependencies:** GDN-023, GDN-030, GDN-039, GDN-108, GDN-110. **External gates:** X07.

**Scope and outcome:** Implement review requests, conflict declarations, recommendations, editorial decisions, reasons and appeals with separation of roles.

**Data/API/contract:** review_rounds and decision_records expose scope, version, conflicts and evidence.

**Acceptance:**

- `GDN-111-AC01`: Required reviewer is independent of author.
- `GDN-111-AC02`: Disagreement remains preserved.
- `GDN-111-AC03`: Negative evidence cannot be hidden to protect the policy argument.

**Tests to implement:**

- `GDN-111-T01`: Self-review/collusion-role scenarios.
- `GDN-111-T02`: Decision history.
- `GDN-111-T03`: Appeal/reopen state-machine tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Pending review remains pending; no automatic approval after a timeout.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Required reviewer is independent of author. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-111/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-111-peer-review-reviewer-conflicts-and-decisions`.

#### GDN-112 - Shared writing with durable version history

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 5 (not a time estimate).

**Features:** F27, F29. **Direct dependencies:** GDN-025, GDN-030, GDN-040, GDN-105. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement collaborative rich-text authoring with CRDT or equivalent conflict handling, document versions and typed evidence blocks.

**Data/API/contract:** document_updates and snapshots separate transport state from publishable content versions.

**Acceptance:**

- `GDN-112-AC01`: Concurrent edits converge without lost accepted text.
- `GDN-112-AC02`: Private document content never reaches public channels.
- `GDN-112-AC03`: Pasted scripts and unsafe embeds are rejected.

**Tests to implement:**

- `GDN-112-T01`: Multi-client convergence.
- `GDN-112-T02`: Concurrent delete/restore.
- `GDN-112-T03`: Malicious paste and role-change tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Begin with trusted-processing workspaces; sealed collaboration uses its separate audited path.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Concurrent edits converge without lost accepted text. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-112/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-112-shared-writing-with-durable-version-history`.

#### GDN-113 - Autosave, interruption recovery and handoff checkpoints

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F29, F38. **Direct dependencies:** GDN-016, GDN-112. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add visible save state, retry/backoff, local recovery controls, durable snapshots and exact resume locations for interrupted sessions.

**Data/API/contract:** checkpoint records include document version, pending operations and last durable sequence number.

**Acceptance:**

- `GDN-113-AC01`: Saved indication requires server acknowledgment.
- `GDN-113-AC02`: Offline edits are recoverable with conflict explanation.
- `GDN-113-AC03`: Researcher can resume without conversation history.

**Tests to implement:**

- `GDN-113-T01`: Network drop/browser crash.
- `GDN-113-T02`: Out-of-order acknowledgment.
- `GDN-113-T03`: Storage-full and revoked-user recovery tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Treat two-second save target as measured objective; sensitive local caches follow encryption/retention policy.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Saved indication requires server acknowledgment. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-113/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-113-autosave-interruption-recovery-and-handoff-checkpoints`.

#### GDN-114 - Comments, mentions and review conversations

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F29, F36. **Direct dependencies:** GDN-023, GDN-025, GDN-038, GDN-112. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add anchored comments, threads, resolved states and mentions with visibility inherited from the underlying content and explicit editorial purpose.

**Data/API/contract:** comments, thread_events and mention_targets carry workspace and selector references.

**Acceptance:**

- `GDN-114-AC01`: Comments cannot leak old private text in public export.
- `GDN-114-AC02`: Anchor drift is visible.
- `GDN-114-AC03`: Resolution does not delete disagreement history.

**Tests to implement:**

- `GDN-114-T01`: Mention authorization.
- `GDN-114-T02`: Orphaned thread.
- `GDN-114-T03`: Concurrent resolution and export-exclusion tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Notifications contain only permitted summaries; editorial comments are never silently source testimony.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Comments cannot leak old private text in public export. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-114/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-114-comments-mentions-and-review-conversations`.

#### GDN-115 - Research task boards, assignments and dependencies

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F28, F29, F30, F41. **Direct dependencies:** GDN-008, GDN-023, GDN-037, GDN-085, GDN-110. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build work queues tied to sources, claims, dossiers, languages and review gates, with task dependencies, ownership and handoff notes.

**Data/API/contract:** research_tasks are separate from software PR plan and historical completeness metrics.

**Acceptance:**

- `GDN-115-AC01`: Blocked and in-progress are distinct.
- `GDN-115-AC02`: Done requires task-specific evidence.
- `GDN-115-AC03`: Cycles and duplicate assignments are visible.

**Tests to implement:**

- `GDN-115-T01`: Task dependency validation.
- `GDN-115-T02`: Reassignment/history tests.
- `GDN-115-T03`: Evidence-free completion denial.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Preserve imported task states; do not reset completed research or infer completion from row counts.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Blocked and in-progress are distinct. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-115/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-115-research-task-boards-assignments-and-dependencies`.

#### GDN-116 - Notifications, subscriptions and quiet controls

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F14, F29, F37. **Direct dependencies:** GDN-016, GDN-025, GDN-029, GDN-094, GDN-114, GDN-115. **External gates:** X06, X08.

**Scope and outcome:** Add in-app and authorized email notifications, digest preferences, mentions, task changes and opt-in saved-search updates.

**Data/API/contract:** notification_intents record purpose, recipient eligibility, delivery ID and suppression state.

**Acceptance:**

- `GDN-116-AC01`: No email contains unauthorized record titles.
- `GDN-116-AC02`: Unsubscribe and preferences take effect.
- `GDN-116-AC03`: Duplicate jobs do not send duplicate messages.

**Tests to implement:**

- `GDN-116-T01`: Consent and revocation races.
- `GDN-116-T02`: Bounce/retry tests.
- `GDN-116-T03`: Unsubscribe and digest time-zone E2E.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Use sandbox email until authorized provider/domain configured; no recurring assistant scheduler is created by this plan.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No email contains unauthorized record titles. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-116/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-116-notifications-subscriptions-and-quiet-controls`.

#### GDN-117 - Dossier workspace and evidence completeness

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F28, F30. **Direct dependencies:** GDN-035, GDN-037, GDN-039, GDN-089, GDN-110, GDN-111, GDN-115. **External gates:** X07.

**Scope and outcome:** Create structured dossiers for political existence, institutions, chronology, enslavement relationships, disruption, continuity and competing explanations.

**Data/API/contract:** dossier_sections have explicit evidence needs, review scopes and unresolved questions.

**Acceptance:**

- `GDN-117-AC01`: A complete template is not a complete historical record.
- `GDN-117-AC02`: Unsupported sections remain open.
- `GDN-117-AC03`: Living communities and continuity are not erased by project framing.

**Tests to implement:**

- `GDN-117-T01`: Section requirement checks.
- `GDN-117-T02`: Conflicting-interpretation fixtures.
- `GDN-117-T03`: Scope-limited completion tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Preserve all 104 named candidate dossiers as candidates where appropriate; no automatic admission from migration.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: A complete template is not a complete historical record. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-117/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-117-dossier-workspace-and-evidence-completeness`.

#### GDN-118 - Coverage matrix and research-gap analysis

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F24, F30, F41. **Direct dependencies:** GDN-035, GDN-036, GDN-085, GDN-115, GDN-117. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Track coverage by region, period, language, repository, trade system and evidence type, with explicit searched/not-searched/inaccessible states.

**Data/API/contract:** coverage_cells retain original scope and evidence of search effort; no invented percent-exhaustive claim.

**Acceptance:**

- `GDN-118-AC01`: Empty results differ from unsearched and inaccessible.
- `GDN-118-AC02`: Famous English narratives do not define total coverage.
- `GDN-118-AC03`: Denominator and scope are visible.

**Tests to implement:**

- `GDN-118-T01`: State-distinction fixtures.
- `GDN-118-T02`: Region/language matrix validation.
- `GDN-118-T03`: Imported coverage reconciliation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Dashboards report bounded coverage, not universal historical completion.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Empty results differ from unsearched and inaccessible. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-118/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-118-coverage-matrix-and-research-gap-analysis`.

#### GDN-119 - Search logs and citation-chain discovery

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F30. **Direct dependencies:** GDN-036, GDN-078, GDN-085, GDN-086, GDN-118. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Record source queries, consulted editions, access attempts, backward/forward citations, competing accounts and lawful follow-up leads.

**Data/API/contract:** discovery_logs and citation_leads distinguish acquired, read, page-inspected and adjudicated evidence.

**Acceptance:**

- `GDN-119-AC01`: Search results remain leads until inspected.
- `GDN-119-AC02`: Access denials are preserved without evasion retries.
- `GDN-119-AC03`: Negative findings have precise searched scope.

**Tests to implement:**

- `GDN-119-T01`: Citation-cycle and duplicate lead tests.
- `GDN-119-T02`: Access-denied workflow.
- `GDN-119-T03`: Exact query/source/date preservation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No autonomous contacting or purchasing without authority; preserve source-language research needs.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Search results remain leads until inspected. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-119/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-119-search-logs-and-citation-chain-discovery`.

#### GDN-120 - Reopening findings and research dispute handling

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F28, F34, F36. **Direct dependencies:** GDN-030, GDN-039, GDN-111, GDN-117. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Allow new evidence or credible criticism to reopen claims, freeze affected publication and route independent review without deleting prior decisions.

**Data/API/contract:** disputes, publication_holds and reconsideration_rounds reference exact claim versions.

**Acceptance:**

- `GDN-120-AC01`: Reopening preserves the previous conclusion and reason.
- `GDN-120-AC02`: Critical errors can block public delivery immediately.
- `GDN-120-AC03`: Dispute outcome is attributable and appealable.

**Tests to implement:**

- `GDN-120-T01`: Reopen/publish race.
- `GDN-120-T02`: Affected-placement traversal.
- `GDN-120-T03`: Reviewer recusal and appeal tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Hold first when harm is material; release only after updated evidence and clearance.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Reopening preserves the previous conclusion and reason. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-120/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-120-reopening-findings-and-research-dispute-handling`.

#### GDN-121 - Researcher workbench, onboarding and training

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F23, F27, F28, F29, F30. **Direct dependencies:** GDN-023, GDN-088, GDN-108, GDN-109, GDN-110, GDN-111, GDN-113, GDN-114, GDN-115, GDN-117, GDN-118, GDN-119, GDN-120. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide one coherent researcher dashboard, training cases, assigned work, source tools and exact resume points without overwhelming new contributors.

**Data/API/contract:** Workbench aggregates authorized task summaries and role-specific capabilities only.

**Acceptance:**

- `GDN-121-AC01`: New contributor can complete supervised task without institution login.
- `GDN-121-AC02`: Specialist tools are discoverable progressively.
- `GDN-121-AC03`: Training uses synthetic or cleared records.

**Tests to implement:**

- `GDN-121-T01`: End-to-end novice/transcriber/reviewer tasks.
- `GDN-121-T02`: Accessibility audit.
- `GDN-121-T03`: Handoff to fresh account test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Pilot with a small authorized research cohort; issues feed concrete fixes, not unsupported usability claims.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: New contributor can complete supervised task without institution login. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-121/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-121-researcher-workbench-onboarding-and-training`.

#### GDN-122 - Research collaboration integration gate

**Status:** planned. **Owner:** Research workflow engineer + scholarly reviewer. **Risk:** medium. **Relative weight:** 5 (not a time estimate).

**Features:** F23, F26, F27, F28, F29, F30, F37. **Direct dependencies:** GDN-108, GDN-109, GDN-110, GDN-111, GDN-112, GDN-113, GDN-114, GDN-115, GDN-116, GDN-117, GDN-118, GDN-119, GDN-120, GDN-121. **External gates:** X07.

**Scope and outcome:** Verify intake, transcription, second reading, claim review, dossier work, team handoff and durable save across concurrent users.

**Data/API/contract:** Research release evidence records actual reviewers, tested workflows and unresolved content backlog.

**Acceptance:**

- `GDN-122-AC01`: Provisional and accepted states survive every path.
- `GDN-122-AC02`: Membership changes revoke live access.
- `GDN-122-AC03`: A new researcher can reproduce a reviewed claim from sources.

**Tests to implement:**

- `GDN-122-T01`: Multi-user E2E.
- `GDN-122-T02`: Network/worker failure tests.
- `GDN-122-T03`: Specialist acceptance and negative-access regression.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Gate broad collaboration launch; no research gate is closed merely because software workflows pass.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Provisional and accepted states survive every path. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-122/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-122-research-collaboration-integration-gate`.

### P09 - Editorial publishing and visual assets

#### GDN-123 - Editorial CMS with structured evidence blocks

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F03, F10, F34. **Direct dependencies:** GDN-023, GDN-034, GDN-040, GDN-112. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build editor-facing page composition using approved components, source bindings, previews and versioned drafts rather than unrestricted HTML.

**Data/API/contract:** CMS writes content_nodes and block_versions, not direct public database records.

**Acceptance:**

- `GDN-123-AC01`: Editors cannot bypass publication controls.
- `GDN-123-AC02`: Preview shows exact public state.
- `GDN-123-AC03`: Reused blocks retain claim and rights dependencies.

**Tests to implement:**

- `GDN-123-T01`: Component validation.
- `GDN-123-T02`: Preview/public parity.
- `GDN-123-T03`: Unauthorized embed and stale-claim tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Migrate reviewed structured content without losing anchors; rollback CMS independently from content history.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Editors cannot bypass publication controls. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-123/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-123-editorial-cms-with-structured-evidence-blocks`.

#### GDN-124 - Editorial release workflow and independent sign-offs

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F28, F33, F34. **Direct dependencies:** GDN-034, GDN-039, GDN-111, GDN-123. **External gates:** X07.

**Scope and outcome:** Route releases through evidence, editorial, rights, consent and accessibility review, with documented responsibility and immutable release manifests.

**Data/API/contract:** release_candidates, signoffs and release_manifests bind content and asset digests.

**Acceptance:**

- `GDN-124-AC01`: Required sign-offs apply to exact content versions.
- `GDN-124-AC02`: Editing after approval invalidates relevant sign-offs.
- `GDN-124-AC03`: Author cannot satisfy independent scholarly review.

**Tests to implement:**

- `GDN-124-T01`: Approval-version race.
- `GDN-124-T02`: Partial-signoff denial.
- `GDN-124-T03`: Revert-to-old-content tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Staged publication only after all applicable gates; legitimate emergency withdrawal remains immediate.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Required sign-offs apply to exact content versions. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-124/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-124-editorial-release-workflow-and-independent-sign-offs`.

#### GDN-125 - Preview, scheduled publication and release rollback

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F34, F38, F40. **Direct dependencies:** GDN-016, GDN-018, GDN-043, GDN-124. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Implement preview tokens, approved release scheduling, atomic public updates and rollback to a still-eligible release.

**Data/API/contract:** publication_jobs reference immutable release manifest and eligibility checks at execution.

**Acceptance:**

- `GDN-125-AC01`: Preview tokens are scoped and expire.
- `GDN-125-AC02`: Scheduled jobs recheck consent/rights.
- `GDN-125-AC03`: Rollback cannot resurrect withdrawn records.

**Tests to implement:**

- `GDN-125-T01`: Expired preview.
- `GDN-125-T02`: Schedule/revocation race.
- `GDN-125-T03`: Atomic projection swap and rollback E2E.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Scheduling is an application capability, not an assistant-created recurring task; activate only by authorized editor action.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Preview tokens are scoped and expire. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-125/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-125-preview-scheduled-publication-and-release-rollback`.

#### GDN-126 - Correction dependency graph and impact review

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F10, F20, F33, F34. **Direct dependencies:** GDN-037, GDN-068, GDN-099, GDN-120, GDN-124. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Track claims into pages, translations, exhibits, models, charts, social assets, downloadable editions and assistant retrieval snapshots.

**Data/API/contract:** content_dependencies and correction_impacts record affected version, action and completion evidence.

**Acceptance:**

- `GDN-126-AC01`: Correction finds every registered dependent placement.
- `GDN-126-AC02`: Unknown legacy placement is reported as a gap.
- `GDN-126-AC03`: Critical holds propagate before regeneration.

**Tests to implement:**

- `GDN-126-T01`: Multi-level dependency fixtures.
- `GDN-126-T02`: Cycle handling.
- `GDN-126-T03`: Missing-link and stale-cache tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Deny affected delivery first; publish corrections only after reviewed replacements and verified rebuild.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Correction finds every registered dependent placement. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-126/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-126-correction-dependency-graph-and-impact-review`.

#### GDN-127 - Public correction notices and superseded editions

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F21, F34, F38. **Direct dependencies:** GDN-075, GDN-120, GDN-125, GDN-126. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Display material corrections, qualifications and retractions with dates, reasons, precise affected passages and preserved historical editions when lawful.

**Data/API/contract:** correction_notices reference safe public explanation and underlying restricted decision record.

**Acceptance:**

- `GDN-127-AC01`: Old edition is not mistaken for current.
- `GDN-127-AC02`: Public notice avoids redisclosing removed private information.
- `GDN-127-AC03`: Minor and material corrections are distinguishable.

**Tests to implement:**

- `GDN-127-T01`: Notice/redaction fixtures.
- `GDN-127-T02`: Old URL warning tests.
- `GDN-127-T03`: Correction subscription permissions.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Retain accountability without promising deletion of already-distributed public copies.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Old edition is not mistaken for current. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-127/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-127-public-correction-notices-and-superseded-editions`.

#### GDN-128 - Image asset registry and provenance interface

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F05, F24, F33. **Direct dependencies:** GDN-036, GDN-038, GDN-047, GDN-123. **External gates:** X07.

**Scope and outcome:** Give editors/reviewers exact original, creator, date, repository ID, rights, image identity, caption, alt text, crops and placements in one asset record.

**Data/API/contract:** asset_versions, derivative_transforms and placement_metadata preserve evidence at item level.

**Acceptance:**

- `GDN-128-AC01`: Each derivative traces to exact original.
- `GDN-128-AC02`: Multiple placements do not inflate asset count.
- `GDN-128-AC03`: Unidentified portraits cannot be confidently relabeled.

**Tests to implement:**

- `GDN-128-T01`: Hash/placement reconciliation.
- `GDN-128-T02`: Conflicting caption tests.
- `GDN-128-T03`: Missing repository ID and unknown creator cases.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Unknown identity remains unknown; no race/ancestry inference from appearance.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Each derivative traces to exact original. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-128/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-128-image-asset-registry-and-provenance-interface`.

#### GDN-129 - Licensing requests, restrictions and costs

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F33, F41. **Direct dependencies:** GDN-029, GDN-085, GDN-128. **External gates:** X07, X08, X09.

**Scope and outcome:** Track rights evidence, permission correspondence, allowed uses, territories, credits, expirations and known/unknown fees.

**Data/API/contract:** rights_grants and clearance_reviews with exact license text/source and approval evidence.

**Acceptance:**

- `GDN-129-AC01`: Public access is not publication permission.
- `GDN-129-AC02`: Unknown cost is explicitly unknown.
- `GDN-129-AC03`: Restriction changes invalidate affected placements.

**Tests to implement:**

- `GDN-129-T01`: Expiring license tests.
- `GDN-129-T02`: Collection/item rights conflict.
- `GDN-129-T03`: Permission scope mismatch.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No unauthorized paid license or request; denied imagery gets metadata-only or lawful replacement.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Public access is not publication permission. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-129/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-129-licensing-requests-restrictions-and-costs`.

#### GDN-130 - Generated-image reconstruction and historical review

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F03, F05, F33. **Direct dependencies:** GDN-034, GDN-055, GDN-128, GDN-129. **External gates:** X07, X09.

**Scope and outcome:** Add a separate generated-asset workflow with creation provenance, intended illustrative role, historical checks and conspicuous public labels.

**Data/API/contract:** reconstruction_reviews record assumptions, source support, unresolved elements and reviewer decisions.

**Acceptance:**

- `GDN-130-AC01`: Generated art is never archival evidence.
- `GDN-130-AC02`: Clothing, objects, settings and physical relationships are reviewed.
- `GDN-130-AC03`: Source resemblance does not imply documented identity.

**Tests to implement:**

- `GDN-130-T01`: Missing-label denial.
- `GDN-130-T02`: Inaccurate object/caption fixtures.
- `GDN-130-T03`: Editorial-history review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No new image generation is required by this planning task; existing images must be retrieved and reviewed before reuse.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Generated art is never archival evidence. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-130/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-130-generated-image-reconstruction-and-historical-review`.

#### GDN-131 - Crops, responsive derivatives and alt-text review

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F05, F19, F33, F39. **Direct dependencies:** GDN-050, GDN-079, GDN-128, GDN-129, GDN-130. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Generate responsive image sizes, safe crops and descriptive alternatives preserving historically relevant details, captions and orientation.

**Data/API/contract:** derivative recipes are versioned with source/output digests and review scope.

**Acceptance:**

- `GDN-131-AC01`: Crop cannot hide qualification or change implied context.
- `GDN-131-AC02`: Alt text is reviewed, not merely nonempty.
- `GDN-131-AC03`: Derived files inherit rights and labels.

**Tests to implement:**

- `GDN-131-T01`: Crop-context review.
- `GDN-131-T02`: Responsive layout/performance.
- `GDN-131-T03`: Screen-reader alt/caption redundancy audit.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Cache only cleared derivatives; invalidate all affected sizes on rights withdrawal.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Crop cannot hide qualification or change implied context. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-131/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-131-crops-responsive-derivatives-and-alt-text-review`.

#### GDN-132 - Coordinated web and book edition exports

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F10, F21, F24, F34, F38. **Direct dependencies:** GDN-046, GDN-087, GDN-102, GDN-124, GDN-126, GDN-131. **External gates:** X07, X09.

**Scope and outcome:** Produce coordinated HTML and rights-permitted DOCX/PDF/EPUB/data exports from reviewed content, preserving citations, image licenses and edition identifiers.

**Data/API/contract:** edition_manifest records formats, source snapshot, hashes, excluded assets and QA scope.

**Acceptance:**

- `GDN-132-AC01`: Export content matches named web snapshot.
- `GDN-132-AC02`: Footnotes and internal/external links are tested.
- `GDN-132-AC03`: Rendered pages receive scoped visual/accessibility review.

**Tests to implement:**

- `GDN-132-T01`: Export round trip.
- `GDN-132-T02`: Citation/link activation.
- `GDN-132-T03`: Representative plus all-changed-page visual checks.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Never describe render success as every-page review; full-edition certification requires actual required audit.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Export content matches named web snapshot. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-132/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-132-coordinated-web-and-book-edition-exports`.

#### GDN-133 - Metadata, SEO and safe public discovery

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F15, F16, F37. **Direct dependencies:** GDN-043, GDN-060, GDN-089, GDN-124, GDN-127. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add canonical URLs, public sitemaps, descriptive metadata, structured data and safe social previews for eligible content.

**Data/API/contract:** discovery metadata generated only from public projection and current eligibility.

**Acceptance:**

- `GDN-133-AC01`: Private/draft records never enter sitemaps or previews.
- `GDN-133-AC02`: Search snippets retain correction/status context.
- `GDN-133-AC03`: No unsupported organization/government status markup.

**Tests to implement:**

- `GDN-133-T01`: Public-route crawl.
- `GDN-133-T02`: Metadata leakage canaries.
- `GDN-133-T03`: Canonical/redirect and withdrawn-page tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Robots directives supplement but never replace access controls; purge previews where provider capability allows.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Private/draft records never enter sitemaps or previews. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-133/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-133-metadata-seo-and-safe-public-discovery`.

#### GDN-134 - Editorial and image release acceptance

**Status:** planned. **Owner:** Publishing engineer + rights editor. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F05, F20, F33, F34, F39. **Direct dependencies:** GDN-124, GDN-125, GDN-126, GDN-127, GDN-128, GDN-129, GDN-130, GDN-131, GDN-132, GDN-133. **External gates:** X07.

**Scope and outcome:** Verify author-to-public release and correction journeys, all asset classes and publication reversal with real editorial roles.

**Data/API/contract:** Publishing evidence records actual sign-offs, tested outputs and remaining audit scope.

**Acceptance:**

- `GDN-134-AC01`: Generated/archival distinction survives every output.
- `GDN-134-AC02`: Rights/consent withdrawal reaches pages, media, exports and search.
- `GDN-134-AC03`: Public evidence remains reproducible.

**Tests to implement:**

- `GDN-134-T01`: Full correction drill.
- `GDN-134-T02`: Rights expiry rehearsal.
- `GDN-134-T03`: Editor and accessibility expert acceptance.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Gate unrestricted editorial publishing; unreviewed legacy material remains preserved but not certified.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Generated/archival distinction survives every output. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-134/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-134-editorial-and-image-release-acceptance`.

### P10 - Community contributions, consent and ethics

#### GDN-135 - Contributor portal and separate program charter

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F32, F35. **Direct dependencies:** GDN-007, GDN-023, GDN-029, GDN-077, GDN-085. **External gates:** X07, X08.

**Scope and outcome:** Launch an optional contribution program with explicit scope separate from the original research charter, contributor guidance and non-endorsement participation.

**Data/API/contract:** contribution_program_versions record authority, responsible institution and permitted collection purposes.

**Acceptance:**

- `GDN-135-AC01`: Submission is not enrollment or endorsement.
- `GDN-135-AC02`: New interviews require this consent-led program.
- `GDN-135-AC03`: Existing research cutoff/scope is not silently rewritten.

**Tests to implement:**

- `GDN-135-T01`: Terms/version acknowledgment.
- `GDN-135-T02`: Contribution versus interest-registration test.
- `GDN-135-T03`: Accessibility review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Pilot privately; do not solicit families or conduct interviews without program authorization and capacity.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Submission is not enrollment or endorsement. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-135/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-135-contributor-portal-and-separate-program-charter`.

#### GDN-136 - Family archive submissions and private receipts

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F32, F37. **Direct dependencies:** GDN-025, GDN-029, GDN-032, GDN-077, GDN-135. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide secure file submission, context forms, attribution preferences, visibility selection and an auditable receipt.

**Data/API/contract:** contributions, submission_items and contributor_context separate contact data from research objects.

**Acceptance:**

- `GDN-136-AC01`: Default visibility is restricted.
- `GDN-136-AC02`: Optional ancestry context is not required for unrelated research.
- `GDN-136-AC03`: Receipt reveals no other contributor records.

**Tests to implement:**

- `GDN-136-T01`: Cross-user receipt tests.
- `GDN-136-T02`: Interrupted upload.
- `GDN-136-T03`: Consent/visibility mismatch and delete request.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Verify moderation/storage capacity before opening public intake; no automatic public family tree.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Default visibility is restricted. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-136/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-136-family-archive-submissions-and-private-receipts`.

#### GDN-137 - Oral-history consent and narrator review

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F27, F32. **Direct dependencies:** GDN-029, GDN-082, GDN-107, GDN-135, GDN-136. **External gates:** X07.

**Scope and outcome:** Support interview agreements, media permissions, transcript review, narrator corrections, embargoes and distinct research/promotional uses.

**Data/API/contract:** interview_sessions and narrator_reviews bind recording, transcript, permitted uses and release dates.

**Acceptance:**

- `GDN-137-AC01`: Narrator can review agreed material before publication.
- `GDN-137-AC02`: Consent withdrawal consequences are explained.
- `GDN-137-AC03`: Editing distinguishes transcript correction from historical corroboration.

**Tests to implement:**

- `GDN-137-T01`: Consent-version fixtures.
- `GDN-137-T02`: Transcript/narrator review E2E.
- `GDN-137-T03`: Embargo and restricted segment tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Software supports future authorized interviews; no interviews are claimed conducted by building this feature.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Narrator can review agreed material before publication. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-137/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-137-oral-history-consent-and-narrator-review`.

#### GDN-138 - Redaction, minors and sensitive contributor material

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F32, F37. **Direct dependencies:** GDN-025, GDN-029, GDN-032, GDN-079, GDN-136, GDN-137. **External gates:** X07.

**Scope and outcome:** Implement redaction review for documents/audio/video, guardian/minor permissions and separate restricted originals with public-safe derivatives.

**Data/API/contract:** redaction_plans and approved_derivatives retain original evidence under restricted access.

**Acceptance:**

- `GDN-138-AC01`: Redaction removes content from text layers, thumbnails, metadata and media tracks.
- `GDN-138-AC02`: Public original URL is unavailable.
- `GDN-138-AC03`: Minor consent is reviewed under applicable program rules.

**Tests to implement:**

- `GDN-138-T01`: Recoverable-redaction attack suite.
- `GDN-138-T02`: Hidden EXIF/OCR tests.
- `GDN-138-T03`: Guardian permission expiry scenarios.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Fail closed on incomplete redaction; irreversible public exposure cannot be fixed by merely covering pixels.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Redaction removes content from text layers, thumbnails, metadata and media tracks. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-138/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-138-redaction-minors-and-sensitive-contributor-material`.

#### GDN-139 - Withdrawal, embargo and contributor communication

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F32, F34, F37. **Direct dependencies:** GDN-029, GDN-032, GDN-116, GDN-126, GDN-136, GDN-138. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Let contributors manage permitted visibility, embargo dates, correction requests and withdrawal with clear processing status and limits.

**Data/API/contract:** contributor_requests trigger revocation and derivative tasks with safe receipts.

**Acceptance:**

- `GDN-139-AC01`: New delivery stops promptly after validated withdrawal.
- `GDN-139-AC02`: Downstream affected copies are listed where known.
- `GDN-139-AC03`: No promise to erase copies beyond project control.

**Tests to implement:**

- `GDN-139-T01`: Withdrawal during export/publication.
- `GDN-139-T02`: Embargo time-zone boundary.
- `GDN-139-T03`: Restore and cache reappearance tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Deny first, investigate scope afterward; retain only lawful necessary audit metadata.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: New delivery stops promptly after validated withdrawal. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-139/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-139-withdrawal-embargo-and-contributor-communication`.

#### GDN-140 - Community advisory groups and public participation

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F35, F36. **Direct dependencies:** GDN-023, GDN-029, GDN-035, GDN-060, GDN-135. **External gates:** X07.

**Scope and outcome:** Publish advisory remit, member permissions, meeting records and consultation channels without treating one person as representative of an entire people.

**Data/API/contract:** advisory_groups and consultation_records record mandate, consent and response responsibility.

**Acceptance:**

- `GDN-140-AC01`: Representation claims are consented and scoped.
- `GDN-140-AC02`: Public minutes redact sensitive contributions.
- `GDN-140-AC03`: Participation does not require policy endorsement.

**Tests to implement:**

- `GDN-140-T01`: Role/representation fixtures.
- `GDN-140-T02`: Meeting redaction tests.
- `GDN-140-T03`: Public consultation accessibility.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Membership is editorially verified; no invented endorsement or affiliation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Representation claims are consented and scoped. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-140/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-140-community-advisory-groups-and-public-participation`.

#### GDN-141 - Community annotations and representation concerns

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F20, F35, F36. **Direct dependencies:** GDN-084, GDN-089, GDN-120, GDN-135, GDN-140. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Let communities and readers submit contextual annotations, naming concerns and representation challenges linked to records.

**Data/API/contract:** representation_cases preserve evidence, submitter permissions and resolution history.

**Acceptance:**

- `GDN-141-AC01`: Submission does not directly overwrite scholarly conclusions.
- `GDN-141-AC02`: Community knowledge has visible provenance.
- `GDN-141-AC03`: Responses explain accepted/rejected changes.

**Tests to implement:**

- `GDN-141-T01`: Claim challenge and review routing.
- `GDN-141-T02`: Harassment/spam tests.
- `GDN-141-T03`: Attribution/withdrawal scenarios.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Moderated publication; factual disputes are not resolved by simple popularity voting.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Submission does not directly overwrite scholarly conclusions. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-141/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-141-community-annotations-and-representation-concerns`.

#### GDN-142 - Consultation responses and participation transparency

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F11, F35, F36, F41. **Direct dependencies:** GDN-111, GDN-120, GDN-140, GDN-141. **External gates:** X07.

**Scope and outcome:** Publish consultation questions, material submissions where permitted, reasoned responses, unresolved concerns and resulting changes.

**Data/API/contract:** consultation_response_matrix links public issues to decisions and affected content.

**Acceptance:**

- `GDN-142-AC01`: Dissent is preserved fairly.
- `GDN-142-AC02`: Private testimony is not exposed in transparency reports.
- `GDN-142-AC03`: Response status and responsible team are visible.

**Tests to implement:**

- `GDN-142-T01`: Selective-publication audit.
- `GDN-142-T02`: Redaction and consent tests.
- `GDN-142-T03`: Response-to-change traceability.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Report actual participation and limits; never imply consultation happened from a software demo.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Dissent is preserved fairly. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-142/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-142-consultation-responses-and-participation-transparency`.

#### GDN-143 - Public interviews, conversations and endorsements

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F03, F12, F35. **Direct dependencies:** GDN-029, GDN-056, GDN-137, GDN-140. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Publish consented public conversations and interviews, separating testimony, reflection, analysis and explicit endorsement.

**Data/API/contract:** public_voice_entries require consent for exact excerpt, attribution and promotional use.

**Acceptance:**

- `GDN-143-AC01`: A family story is not labeled endorsement without consent.
- `GDN-143-AC02`: Speaker role/date are accurate.
- `GDN-143-AC03`: Captions/transcripts and use restrictions are available.

**Tests to implement:**

- `GDN-143-T01`: Permission-purpose test.
- `GDN-143-T02`: Speaker attribution review.
- `GDN-143-T03`: Media accessibility audit.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Only real authorized contributions; no synthetic testimonial or demographic persuasion segmentation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: A family story is not labeled endorsement without consent. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-143/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-143-public-interviews-conversations-and-endorsements`.

#### GDN-144 - Moderated public questions and discussions

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F11, F12, F36, F40. **Direct dependencies:** GDN-021, GDN-025, GDN-033, GDN-061, GDN-116, GDN-140. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Add optional moderated Q&A, reporting, rate limits, appeals and clear separation of discussion from reviewed research.

**Data/API/contract:** discussion_posts and moderation_actions preserve audit without indexing restricted removals.

**Acceptance:**

- `GDN-144-AC01`: Public comments never acquire verified status automatically.
- `GDN-144-AC02`: Harassment and personal-data exposure are handled.
- `GDN-144-AC03`: Moderation reasons and appeals exist.

**Tests to implement:**

- `GDN-144-T01`: Abuse/spam simulations.
- `GDN-144-T02`: Doxxing/redaction tests.
- `GDN-144-T03`: Moderator role and appeal E2E.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Open gradually with moderation capacity; read-only Q&A remains available if live discussion is paused.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Public comments never acquire verified status automatically. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-144/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-144-moderated-public-questions-and-discussions`.

#### GDN-145 - Research conduct and confidential misconduct reports

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F28, F36, F37, F40. **Direct dependencies:** GDN-023, GDN-025, GDN-030, GDN-032, GDN-111. **External gates:** X07.

**Scope and outcome:** Provide confidential reporting of fabrication, coercion, harassment, conflicts and data misuse, with segregated case access and recusal.

**Data/API/contract:** ethics_cases use sensitive access class, purpose-bound attachments and restricted audit.

**Acceptance:**

- `GDN-145-AC01`: Subject of report cannot access reporter identity through ordinary admin tools.
- `GDN-145-AC02`: Cases have accountable independent routing.
- `GDN-145-AC03`: Evidence is retained only under stated policy.

**Tests to implement:**

- `GDN-145-T01`: Insider access tests.
- `GDN-145-T02`: Notification leakage.
- `GDN-145-T03`: Recusal and case transfer tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Do not promise absolute anonymity where identifying metadata exists; explain access and disclosure limits.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Subject of report cannot access reporter identity through ordinary admin tools. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-145/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-145-research-conduct-and-confidential-misconduct-reports`.

#### GDN-146 - Authorship, contributor credit and conflicts

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F23, F28, F35, F36. **Direct dependencies:** GDN-023, GDN-030, GDN-111, GDN-124, GDN-140. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Track contribution roles, authorship agreements, affiliations, reviewer credit and declared conflicts across research outputs.

**Data/API/contract:** contribution_roles and conflict_disclosures bind work versions and decisions.

**Acceptance:**

- `GDN-146-AC01`: Credit is not inferred from volume alone.
- `GDN-146-AC02`: Anonymous/pseudonymous contribution choices are honored.
- `GDN-146-AC03`: Conflicts attach to actual decisions.

**Tests to implement:**

- `GDN-146-T01`: Attribution export.
- `GDN-146-T02`: Changed affiliation/privacy.
- `GDN-146-T03`: Conflict-required recusal tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Community and technical contributions remain visible without manufacturing institutional endorsement.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Credit is not inferred from volume alone. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-146/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-146-authorship-contributor-credit-and-conflicts`.

#### GDN-147 - Public appeals and independent dispute review

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F35, F36. **Direct dependencies:** GDN-120, GDN-127, GDN-141, GDN-142, GDN-145. **External gates:** X07.

**Scope and outcome:** Offer accessible routes to challenge historical representation, rights decisions and moderation, with evidence, response windows and impartial reviewer assignment.

**Data/API/contract:** appeal_cases reference decision version and public-safe outcome.

**Acceptance:**

- `GDN-147-AC01`: Review is separate from the original decision maker when required.
- `GDN-147-AC02`: Decisions explain scope/reasons.
- `GDN-147-AC03`: Appeal does not automatically expose private submissions.

**Tests to implement:**

- `GDN-147-T01`: Appeal state machine.
- `GDN-147-T02`: Deadline/time-zone.
- `GDN-147-T03`: Conflict and missing-response escalation tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Research appeal is not a governmental legal appeal; labels and authority remain explicit.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Review is separate from the original decision maker when required. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-147/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-147-public-appeals-and-independent-dispute-review`.

#### GDN-148 - Community contribution acceptance and safeguarding gate

**Status:** planned. **Owner:** Community product engineer + safeguarding lead. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F32, F35, F36, F37. **Direct dependencies:** GDN-135, GDN-136, GDN-137, GDN-138, GDN-139, GDN-140, GDN-141, GDN-142, GDN-143, GDN-144, GDN-145, GDN-146, GDN-147. **External gates:** X07.

**Scope and outcome:** Test contribution, narrator review, representation challenge, withdrawal, moderation and confidential reporting with appropriate reviewers.

**Data/API/contract:** Gate evidence includes program authority, tested consent texts and response-capacity confirmation.

**Acceptance:**

- `GDN-148-AC01`: Real contributors understand permissions and limits.
- `GDN-148-AC02`: Sensitive data cannot escape through search/export/notifications.
- `GDN-148-AC03`: Safeguarding and response ownership exist.

**Tests to implement:**

- `GDN-148-T01`: End-to-end consent/withdrawal drill.
- `GDN-148-T02`: Accessibility and community usability review.
- `GDN-148-T03`: Insider threat scenarios.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Broad public contribution intake remains closed until safeguarding and operational capacity are verified.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Real contributors understand permissions and limits. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-148/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-148-community-contribution-acceptance-and-safeguarding-gate`.

### P11 - Education, participation and public support

#### GDN-149 - Teaching collections and classroom resources

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F13, F21, F39. **Direct dependencies:** GDN-057, GDN-063, GDN-087, GDN-101, GDN-124. **External gates:** X07.

**Scope and outcome:** Build age-appropriate, source-centered teaching collections, activities and teacher guides with content notices and accessible formats.

**Data/API/contract:** learning_resources reference reviewed collection snapshots and permitted media.

**Acceptance:**

- `GDN-149-AC01`: Lessons distinguish evidence from policy advocacy.
- `GDN-149-AC02`: Teachers can use the archive without endorsing the proposal.
- `GDN-149-AC03`: Student activities do not require sensitive profiles.

**Tests to implement:**

- `GDN-149-T01`: Educator review.
- `GDN-149-T02`: Source/citation consistency.
- `GDN-149-T03`: Print/mobile/screen-reader tasks.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No student-data collection by default; curricular claims are reviewed rather than invented.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Lessons distinguish evidence from policy advocacy. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-149/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-149-teaching-collections-and-classroom-resources`.

#### GDN-150 - Source exercises and guided research tutorials

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F13, F23, F27, F28. **Direct dependencies:** GDN-080, GDN-099, GDN-105, GDN-121, GDN-149. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide worked examples of transcription, source criticism, uncertainty, conflicting evidence and citation, using synthetic or cleared training records.

**Data/API/contract:** tutorial_versions separate training datasets from authoritative research records.

**Acceptance:**

- `GDN-150-AC01`: Training answers explain reasoning and limits.
- `GDN-150-AC02`: Completion does not grant reviewer authority automatically.
- `GDN-150-AC03`: Exercise source rights are cleared.

**Tests to implement:**

- `GDN-150-T01`: Tutorial path E2E.
- `GDN-150-T02`: Incorrect-answer and ambiguity fixtures.
- `GDN-150-T03`: Accessibility testing.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Explicit sandbox badges; learner edits cannot enter production evidence accidentally.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Training answers explain reasoning and limits. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-150/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-150-source-exercises-and-guided-research-tutorials`.

#### GDN-151 - Press center and verified media assets

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F13, F33. **Direct dependencies:** GDN-060, GDN-067, GDN-075, GDN-127, GDN-129, GDN-131, GDN-133. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Publish current summaries, approved visuals, spokesperson contacts, policy status, corrections and source packs for journalists.

**Data/API/contract:** press_kit_manifest binds exact policy and research release versions.

**Acceptance:**

- `GDN-151-AC01`: Media kit marks proposed versus established facts.
- `GDN-151-AC02`: Asset licenses and credits accompany downloads.
- `GDN-151-AC03`: Contacts and spokesperson authority are verified.

**Tests to implement:**

- `GDN-151-T01`: Kit/version parity.
- `GDN-151-T02`: Asset license completeness.
- `GDN-151-T03`: Stale-fact and corrected-image invalidation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Remove superseded share assets from current kits; retain dated archives with warnings where lawful.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Media kit marks proposed versus established facts. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-151/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-151-press-center-and-verified-media-assets`.

#### GDN-152 - Shareable explainers and accessible social graphics

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F05, F13, F34. **Direct dependencies:** GDN-040, GDN-055, GDN-068, GDN-070, GDN-126, GDN-131, GDN-151. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Generate reviewed share cards, short explainers and presentations from source-bound content with dates and qualifications.

**Data/API/contract:** share_assets bind template version, claim IDs, policy version and rights clearance.

**Acceptance:**

- `GDN-152-AC01`: Important qualifiers survive crop/format changes.
- `GDN-152-AC02`: Corrections locate every generated asset.
- `GDN-152-AC03`: No racial or political profiling controls message selection.

**Tests to implement:**

- `GDN-152-T01`: Graphic text/source parity.
- `GDN-152-T02`: Alt-text/export checks.
- `GDN-152-T03`: Changed-claim invalidation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** General-public communication only; no targeted persuasion based on protected or inferred attributes.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Important qualifiers survive crop/format changes. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-152/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-152-shareable-explainers-and-accessible-social-graphics`.

#### GDN-153 - Events, public conversations and registration

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F14, F35. **Direct dependencies:** GDN-021, GDN-029, GDN-056, GDN-116, GDN-140. **External gates:** X06, X08.

**Scope and outcome:** Add public event pages, capacity-aware registration, calendar exports, access needs, cancellation and optional recording consent.

**Data/API/contract:** events and registrations store minimal contact information with purpose-specific retention.

**Acceptance:**

- `GDN-153-AC01`: Registration does not subscribe to unrelated advocacy.
- `GDN-153-AC02`: Attendee list stays private by default.
- `GDN-153-AC03`: Time zones and accessibility arrangements are clear.

**Tests to implement:**

- `GDN-153-T01`: Capacity/race tests.
- `GDN-153-T02`: Calendar/time-zone fixtures.
- `GDN-153-T03`: Cancellation and opt-out delivery.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No paid event services without authorization; online meeting integration is verified before promises.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Registration does not subscribe to unrelated advocacy. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-153/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-153-events-public-conversations-and-registration`.

#### GDN-154 - Volunteer opportunities and matching

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F14, F23, F30. **Direct dependencies:** GDN-023, GDN-029, GDN-115, GDN-135, GDN-153. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Publish research, translation, outreach and operational volunteer roles with requirements, training and accountable assignment.

**Data/API/contract:** volunteer_interests are separate from memberships and reviewer qualifications.

**Acceptance:**

- `GDN-154-AC01`: Match uses declared skills/availability, not protected traits.
- `GDN-154-AC02`: Volunteer does not receive unrestricted archive access.
- `GDN-154-AC03`: Role expectations are clear.

**Tests to implement:**

- `GDN-154-T01`: Skill matching tests.
- `GDN-154-T02`: Least-privilege assignment.
- `GDN-154-T03`: Withdrawal and reassignment E2E.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Manual supervised assignment initially; no automatic promotion based on self-reported expertise.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Match uses declared skills/availability, not protected traits. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-154/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-154-volunteer-opportunities-and-matching`.

#### GDN-155 - Public updates and consented subscriptions

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F13, F14, F34, F37. **Direct dependencies:** GDN-029, GDN-116, GDN-127, GDN-153. **External gates:** X06, X08.

**Scope and outcome:** Offer separate project, research-correction, event and general advocacy subscriptions with preference center and confirmed consent.

**Data/API/contract:** audience_preferences never ingest genealogy or private research behavior.

**Acceptance:**

- `GDN-155-AC01`: Each purpose is independently selectable.
- `GDN-155-AC02`: Unsubscribe works without sign-in.
- `GDN-155-AC03`: Suppression prevents accidental resubscription by imports.

**Tests to implement:**

- `GDN-155-T01`: Double-opt-in/confirmation.
- `GDN-155-T02`: Bounce/retry and unsubscribe.
- `GDN-155-T03`: Imported suppression list test.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Sandbox provider until configured; no unsolicited bulk messaging or assistant-created recurring schedule.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Each purpose is independently selectable. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-155/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-155-public-updates-and-consented-subscriptions`.

#### GDN-156 - Representative lookup and user-controlled civic actions

**Status:** planned. **Owner:** Public participation engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F14, F37. **Direct dependencies:** GDN-029, GDN-040, GDN-060, GDN-073, GDN-155. **External gates:** X07, X08, X11.

**Scope and outcome:** Provide optional general-public representative lookup and user-reviewed communications based on accurate district data and current policy materials.

**Data/API/contract:** civic_action adapters require verified provider contract and minimal address handling with explicit deletion.

**Acceptance:**

- `GDN-156-AC01`: Lookup does not collect ancestry or political profiles.
- `GDN-156-AC02`: User deliberately reviews and sends each message.
- `GDN-156-AC03`: No fabricated signatures or automatic mass sending.

**Tests to implement:**

- `GDN-156-T01`: District ambiguity and provider outage.
- `GDN-156-T02`: Review-before-send E2E.
- `GDN-156-T03`: Sensitive-data logging audit.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No submission until user authorization; legal/advocacy compliance reviewed for the actual operating organization.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Lookup does not collect ancestry or political profiles. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-156/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-156-representative-lookup-and-user-controlled-civic-actions`.

#### GDN-157 - Donations and purpose-separated financial records

**Status:** planned. **Owner:** Public participation engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F14, F41. **Direct dependencies:** GDN-012, GDN-029, GDN-060, GDN-116. **External gates:** X07, X08, X11.

**Scope and outcome:** Integrate an authorized payment provider using hosted checkout, separate research/advocacy purposes, receipts, refunds and reconciliation.

**Data/API/contract:** donation ledger stores provider IDs and purpose, not card details; financial access is restricted.

**Acceptance:**

- `GDN-157-AC01`: Card data never enters project systems.
- `GDN-157-AC02`: Donation buys no citizenship or editorial authority.
- `GDN-157-AC03`: Tax status is stated only when verified.

**Tests to implement:**

- `GDN-157-T01`: Signed webhook/replay tests.
- `GDN-157-T02`: Refund/double-payment fixtures.
- `GDN-157-T03`: Receipt and purpose reconciliation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Test mode only until organization, provider, costs and legal disclosures are authorized.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Card data never enters project systems. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-157/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-157-donations-and-purpose-separated-financial-records`.

#### GDN-158 - Public organizational finances and funding disclosures

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F14, F41. **Direct dependencies:** GDN-060, GDN-070, GDN-146, GDN-157. **External gates:** X11.

**Scope and outcome:** Publish the website/research organization's actual finances and funding sources separately from modeled government-program finances.

**Data/API/contract:** financial_reports reference accounting period, reviewed data and disclosure policy.

**Acceptance:**

- `GDN-158-AC01`: Actual and projected amounts cannot be mixed.
- `GDN-158-AC02`: Donor privacy and disclosure obligations are respected.
- `GDN-158-AC03`: Editorial conflicts are visible.

**Tests to implement:**

- `GDN-158-T01`: Ledger-to-report reconciliation.
- `GDN-158-T02`: Missing-period and private-donor tests.
- `GDN-158-T03`: Accessible table review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No invented operating budget or audited status; publish only verified records with scope.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Actual and projected amounts cannot be mixed. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-158/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-158-public-organizational-finances-and-funding-disclosures`.

#### GDN-159 - Public contact, support and accessibility reporting

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F14, F39, F40. **Direct dependencies:** GDN-029, GDN-060, GDN-116, GDN-144. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide clear contact routes for general questions, corrections, press, accessibility and sensitive concerns, with safe routing and delivery receipts.

**Data/API/contract:** support_cases classify purpose and sensitivity before assignment or notification.

**Acceptance:**

- `GDN-159-AC01`: Sensitive reports do not enter public forum or broad mailbox.
- `GDN-159-AC02`: Accessibility reports need no account.
- `GDN-159-AC03`: Response ownership is defined.

**Tests to implement:**

- `GDN-159-T01`: Routing matrix.
- `GDN-159-T02`: Spam/attachment safety.
- `GDN-159-T03`: Delivery failure and inaccessible-form fallback.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Use verified contacts and escalation; do not promise response capacity that is not staffed.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Sensitive reports do not enter public forum or broad mailbox. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-159/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-159-public-contact-support-and-accessibility-reporting`.

#### GDN-160 - Participation and communications acceptance

**Status:** planned. **Owner:** Public participation engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F13, F14, F37, F39, F41. **Direct dependencies:** GDN-149, GDN-150, GDN-151, GDN-152, GDN-153, GDN-154, GDN-155, GDN-156, GDN-157, GDN-158, GDN-159. **External gates:** X07, X11.

**Scope and outcome:** Verify education, press, subscriptions, events, volunteering, civic tools, donations and support with realistic consent and failure cases.

**Data/API/contract:** Release evidence includes provider configuration status and explicit disabled capabilities.

**Acceptance:**

- `GDN-160-AC01`: No participation path creates unintended endorsement or enrollment.
- `GDN-160-AC02`: Real-payment mode remains gated.
- `GDN-160-AC03`: Unsubscribe and correction notices work online.

**Tests to implement:**

- `GDN-160-T01`: End-to-end purpose separation.
- `GDN-160-T02`: Payment sandbox reconciliation.
- `GDN-160-T03`: Public accessibility/usability review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Activate independently verified services only; missing payment or civic provider does not block ordinary public reading.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No participation path creates unintended endorsement or enrollment. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-160/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-160-participation-and-communications-acceptance`.

### P12 - Reproducible analysis and bounded AI

#### GDN-161 - Reproducible research datasets and snapshots

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F24, F31, F38. **Direct dependencies:** GDN-045, GDN-048, GDN-093, GDN-102. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Create immutable analysis snapshots with schemas, source lineage, known gaps and reproducible query/export manifests.

**Data/API/contract:** dataset_snapshots and data_packages include field dictionaries, exclusions and source rights.

**Acceptance:**

- `GDN-161-AC01`: Snapshot identifies exact source and transformations.
- `GDN-161-AC02`: Registration rows are not labeled unique people.
- `GDN-161-AC03`: Restricted or sealed data rules survive snapshotting.

**Tests to implement:**

- `GDN-161-T01`: Dataset hash/schema tests.
- `GDN-161-T02`: Missing-row fixtures.
- `GDN-161-T03`: Access and reimport checks.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Read-only snapshots; no raw sensitive datasets in Git or public examples.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Snapshot identifies exact source and transformations. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-161/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-161-reproducible-research-datasets-and-snapshots`.

#### GDN-162 - Controlled analysis jobs and notebook execution

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F31, F37, F40. **Direct dependencies:** GDN-016, GDN-025, GDN-026, GDN-161. **External gates:** X08.

**Scope and outcome:** Run authorized analytic code in resource-limited, isolated workers with no arbitrary network access, short-lived inputs and versioned dependencies.

**Data/API/contract:** analysis_runs carry image digest, input snapshot, code hash and output classification.

**Acceptance:**

- `GDN-162-AC01`: Code cannot reach production credentials or unrelated data.
- `GDN-162-AC02`: Runtime and outputs are attributable.
- `GDN-162-AC03`: Jobs stop on permission revocation where feasible.

**Tests to implement:**

- `GDN-162-T01`: Sandbox escape/egress tests.
- `GDN-162-T02`: CPU/memory/time limits.
- `GDN-162-T03`: Revoked-job and cleanup tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Synthetic jobs first; no claim of strong isolation without independent testing of actual runtime.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Code cannot reach production credentials or unrelated data. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-162/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-162-controlled-analysis-jobs-and-notebook-execution`.

#### GDN-163 - Data cleaning, reconciliation and reproducible transformations

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F26, F31. **Direct dependencies:** GDN-106, GDN-109, GDN-161, GDN-162. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide versioned transformation recipes for dates, names, tabular joins and deduplication proposals with side-by-side raw data.

**Data/API/contract:** transformation_steps record code, parameters, input/output counts and rejected rows.

**Acceptance:**

- `GDN-163-AC01`: Raw data never overwritten.
- `GDN-163-AC02`: Joins require declared keys and uncertainty.
- `GDN-163-AC03`: Unsupported identity matches remain hypotheses.

**Tests to implement:**

- `GDN-163-T01`: Lossless round trip.
- `GDN-163-T02`: Duplicate/NULL/date fixtures.
- `GDN-163-T03`: False identity join prevention.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Reviewer checks meaning as well as arithmetic; exact reruns must reproduce output digests or explain nondeterminism.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Raw data never overwritten. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-163/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-163-data-cleaning-reconciliation-and-reproducible-transformations`.

#### GDN-164 - Evidence-based charts, statistics and map outputs

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F18, F31, F39. **Direct dependencies:** GDN-095, GDN-097, GDN-102, GDN-161, GDN-162, GDN-163. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build reproducible analysis-to-chart workflows with accessible tables, denominators, uncertainty and source/exclusion notes.

**Data/API/contract:** visualization_specs bind analysis run, data snapshot and rendering version.

**Acceptance:**

- `GDN-164-AC01`: Charts identify coverage limits and units.
- `GDN-164-AC02`: Missing data is not zero.
- `GDN-164-AC03`: Estimates do not look like complete population counts.

**Tests to implement:**

- `GDN-164-T01`: Chart/table numeric parity.
- `GDN-164-T02`: Sampling/denominator tests.
- `GDN-164-T03`: Color-independent accessibility review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish only reviewed analytical outputs through normal rights/evidence gates.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Charts identify coverage limits and units. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-164/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-164-evidence-based-charts-statistics-and-map-outputs`.

#### GDN-165 - Computational review and reproducibility gate

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F28, F31, F34. **Direct dependencies:** GDN-111, GDN-124, GDN-161, GDN-162, GDN-163, GDN-164. **External gates:** X07.

**Scope and outcome:** Require another authorized researcher to rerun important computations and inspect assumptions before publishing results.

**Data/API/contract:** computational_reviews reference exact run/code/input versions and reviewer decision.

**Acceptance:**

- `GDN-165-AC01`: Reviewer reproduces declared outputs.
- `GDN-165-AC02`: Assumptions and exclusions are inspectable.
- `GDN-165-AC03`: Stochastic methods include seeds and uncertainty treatment.

**Tests to implement:**

- `GDN-165-T01`: Fresh-environment rerun.
- `GDN-165-T02`: Deliberate denominator bug.
- `GDN-165-T03`: Dependency-lock and missing-input tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Failed reproduction blocks relevant publication; code merge alone does not validate historical interpretation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Reviewer reproduces declared outputs. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-165/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-165-computational-review-and-reproducibility-gate`.

#### GDN-166 - Assistant retrieval, provider and cost boundary

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F17, F22, F37. **Direct dependencies:** GDN-004, GDN-012, GDN-025, GDN-029, GDN-092, GDN-099, GDN-161. **External gates:** X08, X10.

**Scope and outcome:** Implement an optional assistant gateway over approved public or authorized research material using a verified provider contract, usage limits and data-processing review.

**Data/API/contract:** assistant_requests use opaque source references and classification-aware retrieval; provider credentials stay server-side.

**Acceptance:**

- `GDN-166-AC01`: Sealed content never enters provider calls.
- `GDN-166-AC02`: Authorization precedes retrieval.
- `GDN-166-AC03`: Provider retention and regional handling are recorded.

**Tests to implement:**

- `GDN-166-T01`: Egress canaries.
- `GDN-166-T02`: Per-user budget/limit tests.
- `GDN-166-T03`: Provider failure and permission-change tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Disabled until costs and sensitive-data processing are authorized; search works without AI.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Sealed content never enters provider calls. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-166/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-166-assistant-retrieval-provider-and-cost-boundary`.

#### GDN-167 - Citation-grounded assistant answer interface

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F02, F20, F22. **Direct dependencies:** GDN-038, GDN-050, GDN-099, GDN-166. **External gates:** X10.

**Scope and outcome:** Add question answering with exact supporting passages, distinctions between quote/inference/uncertainty and links to inspect sources.

**Data/API/contract:** answer_payload includes claim-to-citation mapping, corpus snapshot and model/config version.

**Acceptance:**

- `GDN-167-AC01`: Unsupported questions receive explicit insufficiency.
- `GDN-167-AC02`: Answers cannot invent ancestry or historical identities.
- `GDN-167-AC03`: Users can see retrieved evidence and report errors.

**Tests to implement:**

- `GDN-167-T01`: Grounded-answer fixtures.
- `GDN-167-T02`: Unanswerable questions.
- `GDN-167-T03`: Citation span and hallucinated-source tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Begin public-only with limited topics; answers are assistance, not published research or legal determinations.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Unsupported questions receive explicit insufficiency. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-167/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-167-citation-grounded-assistant-answer-interface`.

#### GDN-168 - Prompt-injection and tool isolation defense

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F22, F25, F37, F40. **Direct dependencies:** GDN-033, GDN-162, GDN-166, GDN-167. **External gates:** X10.

**Scope and outcome:** Treat archival text, annotations and uploads as untrusted data. Restrict assistant tools, egress, cross-record access and mutation capabilities.

**Data/API/contract:** Tool broker admits read-only scoped operations with separate policy evaluation.

**Acceptance:**

- `GDN-168-AC01`: Source instructions cannot change authorization or system behavior.
- `GDN-168-AC02`: Assistant cannot publish, email, delete or approve research.
- `GDN-168-AC03`: Private content cannot be exfiltrated through citations.

**Tests to implement:**

- `GDN-168-T01`: Malicious source and indirect prompt tests.
- `GDN-168-T02`: Tool allowlist tests.
- `GDN-168-T03`: Cross-user retrieval attack suite.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Disable risky tool classes; no claim that prompting alone provides security.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Source instructions cannot change authorization or system behavior. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-168/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-168-prompt-injection-and-tool-isolation-defense`.

#### GDN-169 - Assistant evaluation, bias and abstention

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F20, F22, F28. **Direct dependencies:** GDN-103, GDN-165, GDN-167, GDN-168. **External gates:** X07, X10.

**Scope and outcome:** Build expert-reviewed evaluation sets covering conflicts, missing evidence, source dependence, historical slurs, uncertainty and non-English queries.

**Data/API/contract:** evaluation_runs pin model/config/corpus and labeled judgments with review provenance.

**Acceptance:**

- `GDN-169-AC01`: Evaluation distinguishes factual grounding from persuasive appeal.
- `GDN-169-AC02`: Absence of evidence is not described as absence of history.
- `GDN-169-AC03`: Known failure modes are published.

**Tests to implement:**

- `GDN-169-T01`: Adversarial and unanswerable benchmarks.
- `GDN-169-T02`: Citation correctness review.
- `GDN-169-T03`: Sensitive identity inference refusals.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No automated upgrade without regression; only measured capabilities are described publicly.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Evaluation distinguishes factual grounding from persuasive appeal. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-169/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-169-assistant-evaluation-bias-and-abstention`.

#### GDN-170 - Assistant feedback, cost visibility and opt-out

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F22, F37, F41. **Direct dependencies:** GDN-029, GDN-032, GDN-116, GDN-167, GDN-169. **External gates:** X10.

**Scope and outcome:** Add user feedback, answer correction routing, opt-out, usage/cost controls and minimal retained logs.

**Data/API/contract:** assistant_feedback uses sensitivity-aware redaction and bounded retention.

**Acceptance:**

- `GDN-170-AC01`: Feedback does not expose private prompts to broad reviewers.
- `GDN-170-AC02`: Users can avoid AI entirely.
- `GDN-170-AC03`: Cost ceilings fail gracefully without breaking search.

**Tests to implement:**

- `GDN-170-T01`: Log redaction.
- `GDN-170-T02`: Quota/concurrency.
- `GDN-170-T03`: Opt-out and deletion request tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No training on private material without explicit authorization; provider settings must be verified, not assumed.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Feedback does not expose private prompts to broad reviewers. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-170/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-170-assistant-feedback-cost-visibility-and-opt-out`.

#### GDN-171 - Bounded research automation proposals

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F22, F28, F30, F31. **Direct dependencies:** GDN-115, GDN-119, GDN-165, GDN-168, GDN-169, GDN-170. **External gates:** X10.

**Scope and outcome:** Let assistants propose transcription drafts, source leads, claim segmentation and task suggestions with human/scholarly review, never silently apply them as accepted evidence.

**Data/API/contract:** machine_suggestions reference model/config/input hashes and proposed action, not publication status.

**Acceptance:**

- `GDN-171-AC01`: Automated outputs are labeled provisional.
- `GDN-171-AC02`: Source discovery cannot bypass access limits.
- `GDN-171-AC03`: Every accepted change has a real review record.

**Tests to implement:**

- `GDN-171-T01`: Suggested versus accepted state tests.
- `GDN-171-T02`: Fabricated-citation fixtures.
- `GDN-171-T03`: Access-denial and duplicate-task checks.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No autonomous background research is claimed; application jobs require authorized explicit scope and budgets.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Automated outputs are labeled provisional. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-171/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-171-bounded-research-automation-proposals`.

#### GDN-172 - Analysis and assistant controlled-release gate

**Status:** planned. **Owner:** Research computation / AI engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F22, F28, F31, F37. **Direct dependencies:** GDN-161, GDN-162, GDN-163, GDN-164, GDN-165, GDN-166, GDN-167, GDN-168, GDN-169, GDN-170, GDN-171. **External gates:** X07, X10.

**Scope and outcome:** Review reproducibility, provider handling, security, citation accuracy and costs before controlled release of optional analysis/AI capabilities.

**Data/API/contract:** Release evidence separates AI evaluation scores, provider authorization and actual deployment verification.

**Acceptance:**

- `GDN-172-AC01`: Independent security and content tests pass.
- `GDN-172-AC02`: Sealed data remains inaccessible.
- `GDN-172-AC03`: Public limitations and fallback paths are documented.

**Tests to implement:**

- `GDN-172-T01`: End-to-end dataset-to-answer audit.
- `GDN-172-T02`: Prompt injection red team.
- `GDN-172-T03`: Provider outage and budget-exhaustion drill.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** AI remains optional and disabled where prerequisites fail; other research tools stay usable.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Independent security and content tests pass. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-172/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-172-analysis-and-assistant-controlled-release-gate`.

### P13 - Administration, governance and truthful progress

#### GDN-173 - Administrative console and least-privilege operations

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F23, F37, F40. **Direct dependencies:** GDN-023, GDN-025, GDN-030, GDN-115, GDN-144, GDN-145. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Build separate admin views for accounts, roles, imports, queues, publication holds and incidents, with restricted sensitive-case access.

**Data/API/contract:** admin_actions require reason, actor assurance and policy checks; no direct arbitrary SQL console in public app.

**Acceptance:**

- `GDN-173-AC01`: Admin role does not automatically decrypt sealed material.
- `GDN-173-AC02`: Critical actions require step-up and audit.
- `GDN-173-AC03`: Bulk actions show exact scope.

**Tests to implement:**

- `GDN-173-T01`: Privilege escalation tests.
- `GDN-173-T02`: Bulk-action dry run.
- `GDN-173-T03`: Cross-case and sealed-data denial.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Start with read-only operational views; enable mutations after role-specific testing.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Admin role does not automatically decrypt sealed material. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-173/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-173-administrative-console-and-least-privilege-operations`.

#### GDN-174 - Moderation tools, abuse response and appeals

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F12, F36, F40. **Direct dependencies:** GDN-030, GDN-033, GDN-144, GDN-145, GDN-147, GDN-173. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Consolidate spam, harassment, copyright concerns, personal-data leaks and abuse reports with triage, evidence, response and appeal.

**Data/API/contract:** moderation queues use purpose-specific permissions and retention rather than one universal admin inbox.

**Acceptance:**

- `GDN-174-AC01`: Safety actions do not silently alter scholarly claims.
- `GDN-174-AC02`: Sensitive evidence is restricted.
- `GDN-174-AC03`: Moderation capacity and unresolved backlog are visible.

**Tests to implement:**

- `GDN-174-T01`: Abuse scenario drills.
- `GDN-174-T02`: Wrong-moderator access.
- `GDN-174-T03`: Appeal and repeat-offender tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Pause unstaffed public submission channels while keeping reviewed content accessible.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Safety actions do not silently alter scholarly claims. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-174/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-174-moderation-tools-abuse-response-and-appeals`.

#### GDN-175 - Public governance, research standards and independence

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F20, F28, F35, F36, F41. **Direct dependencies:** GDN-060, GDN-111, GDN-140, GDN-142, GDN-145, GDN-146, GDN-147. **External gates:** X07.

**Scope and outcome:** Publish editorial standards, advisory remit, authorship, conflicts, appeals, donor separation and correction procedures with version history.

**Data/API/contract:** governance_documents bind adoption date, responsible authority and superseded versions.

**Acceptance:**

- `GDN-175-AC01`: Policy advocacy cannot overrule evidence review.
- `GDN-175-AC02`: Reviewers' scope and appointment process are clear.
- `GDN-175-AC03`: Governance statements reflect actual adopted practice.

**Tests to implement:**

- `GDN-175-T01`: Policy/document consistency.
- `GDN-175-T02`: Conflict disclosure review.
- `GDN-175-T03`: Accessibility and version link tests.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Proposed policies are labeled proposed until adopted; never imply an advisory body exists before verified.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-175/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-175-public-governance-research-standards-and-independence`.

#### GDN-176 - Accurate research progress and coverage dashboards

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F24, F28, F30, F41. **Direct dependencies:** GDN-039, GDN-048, GDN-115, GDN-117, GDN-118, GDN-124. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Report acquired, read, transcribed, reviewed, rights-cleared and published work separately, with definitions and denominators.

**Data/API/contract:** research_metrics derive from explicit evidence states and snapshot IDs, not activity volume.

**Acceptance:**

- `GDN-176-AC01`: 923292 rows never become 923292 verified facts.
- `GDN-176-AC02`: Review of selected pages is not full visual audit.
- `GDN-176-AC03`: Open research scope has no fabricated percent-complete.

**Tests to implement:**

- `GDN-176-T01`: Counter reconciliation.
- `GDN-176-T02`: Mixed-status and changing-scope tests.
- `GDN-176-T03`: Public/private aggregate checks.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Report bounded counts and uncertainty; do not confuse software progress with scholarly completion.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: 923292 rows never become 923292 verified facts. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-176/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-176-accurate-research-progress-and-coverage-dashboards`.

#### GDN-177 - Software plan, PR and production status reporting

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F38, F40, F41. **Direct dependencies:** GDN-008, GDN-011, GDN-018, GDN-019, GDN-173. **External gates:** X01, X03.

**Scope and outcome:** Track planned, implemented, CI-passed, merged, deployed, production-verified and regressed states with GitHub/Render evidence and Engine Room reconciliation.

**Data/API/contract:** delivery_status records exact commit, PR, checks, environment, deployment and verification timestamp.

**Acceptance:**

- `GDN-177-AC01`: Progress uses frozen scope weights and actual acceptance evidence.
- `GDN-177-AC02`: Merged code is not production-complete.
- `GDN-177-AC03`: Missing integration reports unknown rather than green.

**Tests to implement:**

- `GDN-177-T01`: Webhook replay/out-of-order.
- `GDN-177-T02`: Fake evidence rejection.
- `GDN-177-T03`: Reverted deployment and reopened work tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Baseline starts at zero verified functionality; conditional government scope has its own denominator.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Progress uses frozen scope weights and actual acceptance evidence. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-177/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-177-software-plan-pr-and-production-status-reporting`.

#### GDN-178 - Data stewardship, rights expiry and access reviews

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F33, F37, F40. **Direct dependencies:** GDN-025, GDN-029, GDN-032, GDN-085, GDN-129, GDN-173. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Provide administrator queues for expiring licenses, stale permissions, sensitive data reviews, retention actions and storage access checks.

**Data/API/contract:** stewardship_tasks bind data owner, authority, due date and action evidence.

**Acceptance:**

- `GDN-178-AC01`: Expired rights stop new delivery.
- `GDN-178-AC02`: Dormant privileged access is reviewed.
- `GDN-178-AC03`: Retention tasks distinguish dry run from deletion.

**Tests to implement:**

- `GDN-178-T01`: Expiry/time-zone fixtures.
- `GDN-178-T02`: Stale-role tests.
- `GDN-178-T03`: Rights-withdrawal and storage policy reconciliation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No scheduled destructive operation without verified policy and authorized executor.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Expired rights stop new delivery. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-178/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-178-data-stewardship-rights-expiry-and-access-reviews`.

#### GDN-179 - Content-safe analytics and usability measurement

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F16, F39, F41. **Direct dependencies:** GDN-005, GDN-029, GDN-064, GDN-103, GDN-160, GDN-176. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Measure aggregate task success, search quality, performance and accessibility feedback with minimal collection and no demographic/political targeting.

**Data/API/contract:** analytics events use allowlisted fields and documented retention; no third-party advertising pixels.

**Acceptance:**

- `GDN-179-AC01`: Family histories and private reading are excluded.
- `GDN-179-AC02`: Small-group reports avoid identity leakage.
- `GDN-179-AC03`: Metrics assess understanding, not manipulation.

**Tests to implement:**

- `GDN-179-T01`: Telemetry schema audit.
- `GDN-179-T02`: Consent/opt-out.
- `GDN-179-T03`: Small-cell and query-log privacy tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Begin minimal aggregate metrics; additional collection requires purpose review and actual consent where applicable.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Family histories and private reading are excluded. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-179/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-179-content-safe-analytics-and-usability-measurement`.

#### GDN-180 - Operational dashboards and dependency health

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F25, F38, F40, F41. **Direct dependencies:** GDN-017, GDN-018, GDN-088, GDN-173, GDN-177, GDN-178. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Display service status, queue lag, failed imports, index freshness, broken links, backup age and external integration state.

**Data/API/contract:** health snapshots expose sanitized public status and restricted operational detail separately.

**Acceptance:**

- `GDN-180-AC01`: Unknown dependency health is not green.
- `GDN-180-AC02`: Alerts exclude sensitive content.
- `GDN-180-AC03`: Owner and response procedure exist for each critical signal.

**Tests to implement:**

- `GDN-180-T01`: Dependency outage injection.
- `GDN-180-T02`: Stale heartbeat.
- `GDN-180-T03`: Alert routing and suppression tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Monitoring configuration is versioned; no claim that monitoring runs until deployed and observed.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Unknown dependency health is not green. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-180/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-180-operational-dashboards-and-dependency-health`.

#### GDN-181 - Financial, cost and resource-capacity controls

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F08, F14, F40, F41. **Direct dependencies:** GDN-012, GDN-157, GDN-158, GDN-170, GDN-173, GDN-180. **External gates:** X08.

**Scope and outcome:** Track website operating costs, authorized budgets, AI usage, storage growth and vendor resource limits separately from program fiscal models.

**Data/API/contract:** resource_cost_records use verified provider exports and forecast labels where estimated.

**Acceptance:**

- `GDN-181-AC01`: New billable capacity requires authorization.
- `GDN-181-AC02`: Cost alerts cannot expose donation details.
- `GDN-181-AC03`: Expensive jobs have quotas and cancellation.

**Tests to implement:**

- `GDN-181-T01`: Budget threshold fixtures.
- `GDN-181-T02`: Runaway job and storage growth.
- `GDN-181-T03`: Unauthorized scale-up denial.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Optimize within authorization; no automatic paid upgrades to rescue a performance target.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: New billable capacity requires authorization. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-181/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-181-financial-cost-and-resource-capacity-controls`.

#### GDN-182 - Governance, administration and status acceptance

**Status:** planned. **Owner:** Operations and governance engineer. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F35, F36, F37, F40, F41. **Direct dependencies:** GDN-173, GDN-174, GDN-175, GDN-176, GDN-177, GDN-178, GDN-179, GDN-180, GDN-181. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Verify operational controls, governance truthfulness, progress accuracy, moderation and financial separation with an audit-oriented reviewer.

**Data/API/contract:** Operations acceptance binds actual provider status and outstanding blockers.

**Acceptance:**

- `GDN-182-AC01`: Public dashboards reconcile to source records.
- `GDN-182-AC02`: Administrative access remains least privilege.
- `GDN-182-AC03`: No unverified service or certification is claimed.

**Tests to implement:**

- `GDN-182-T01`: Cross-dashboard reconciliation.
- `GDN-182-T02`: Insider misuse tabletop.
- `GDN-182-T03`: Operational and accessibility review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Gate broad administrative delegation; unresolved high-risk permissions prevent sensitive operation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Public dashboards reconcile to source records. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-182/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-182-governance-administration-and-status-acceptance`.

### P14 - Preservation, hardening and production release

#### GDN-183 - Preservation packages and verifiable backups

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F24, F38. **Direct dependencies:** GDN-015, GDN-026, GDN-032, GDN-048, GDN-102, GDN-132. **External gates:** X06, X08, X09.

**Scope and outcome:** Produce checksummed, size-bounded backups and portable research packages with all manifests, schema, rights, lineage and restore instructions.

**Data/API/contract:** backup_manifest lists byte hashes, logical counts, key requirements and excluded/unrecovered state.

**Acceptance:**

- `GDN-183-AC01`: Each uploaded component is read back and verified.
- `GDN-183-AC02`: Truncation inside an intact ZIP is detected.
- `GDN-183-AC03`: Package excludes data the recipient cannot access.

**Tests to implement:**

- `GDN-183-T01`: Truncated SQLite/export/ZIP tests.
- `GDN-183-T02`: Hash and row validation.
- `GDN-183-T03`: Package reopen and rights-filtered export.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Prefer verified components over oversized single archives; no successful-upload-only backup claims.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Each uploaded component is read back and verified. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-183/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-183-preservation-packages-and-verifiable-backups`.

#### GDN-184 - Restore drills, key recovery and deletion replay

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F37, F38, F40. **Direct dependencies:** GDN-026, GDN-027, GDN-032, GDN-183. **External gates:** X05, X06, X08.

**Scope and outcome:** Restore authorized backups into isolated environments, recover keys according to mode and reapply withdrawals, legal holds and revocations before serving.

**Data/API/contract:** restore_evidence records source backup, checks, elapsed time, RPO/RTO and failed steps.

**Acceptance:**

- `GDN-184-AC01`: Restored data does not republish withdrawn content.
- `GDN-184-AC02`: Sealed keys are not recoverable by an operator unless design explicitly permits it.
- `GDN-184-AC03`: Recovery times/loss windows are measured.

**Tests to implement:**

- `GDN-184-T01`: Full restore rehearsal.
- `GDN-184-T02`: Lost-key and revoked-consent cases.
- `GDN-184-T03`: Corrupt component and partial restore tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Never overwrite production for a drill; restore promotion requires reconciliation and authorized impact control.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Restored data does not republish withdrawn content. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-184/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-184-restore-drills-key-recovery-and-deletion-replay`.

#### GDN-185 - Master current-work index and portable continuation

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F21, F24, F38, F41. **Direct dependencies:** GDN-075, GDN-113, GDN-132, GDN-177, GDN-183. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Maintain stable project-wide current-work index, per-product latest pointers, downloadable checkpoints and resume instructions after each successful durable save.

**Data/API/contract:** current-work.json links research, legislation and software without changing their separate completion states.

**Acceptance:**

- `GDN-185-AC01`: Every pointer identifies version/status/checksum.
- `GDN-185-AC02`: Historical milestones remain accessible.
- `GDN-185-AC03`: Another account can resume from repository and authorized files.

**Tests to implement:**

- `GDN-185-T01`: Broken/stale link injection.
- `GDN-185-T02`: Post-save readback.
- `GDN-185-T03`: Fresh-agent handoff exercise.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Update pointers last and atomically; index never certifies research or production merely by linking a file.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Every pointer identifies version/status/checksum. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-185/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-185-master-current-work-index-and-portable-continuation`.

#### GDN-186 - Portability and repository-only developer handoff

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** medium. **Relative weight:** 3 (not a time estimate).

**Features:** F24, F38, F40. **Direct dependencies:** GDN-008, GDN-044, GDN-173, GDN-177, GDN-183, GDN-185. **External gates:** X01.

**Scope and outcome:** Test that a new developer can clone, validate, run synthetic services, understand architecture, locate required credentials and continue work without chat context.

**Data/API/contract:** README, AGENTS, runbooks and evidence index are mandatory release artifacts.

**Acceptance:**

- `GDN-186-AC01`: No undocumented environment dependency.
- `GDN-186-AC02`: Source/research access limits are explicit.
- `GDN-186-AC03`: Plans, ADRs, API schemas and progress agree.

**Tests to implement:**

- `GDN-186-T01`: Clean-machine setup.
- `GDN-186-T02`: Missing-secret guided failure.
- `GDN-186-T03`: Independent handoff review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No real secrets or restricted research copied into Git to achieve self-containment.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No undocumented environment dependency. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-186/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-186-portability-and-repository-only-developer-handoff`.

#### GDN-187 - Full accessibility and assistive-technology audit

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** medium. **Relative weight:** 5 (not a time estimate).

**Features:** F01, F13, F19, F23, F39. **Direct dependencies:** GDN-064, GDN-076, GDN-104, GDN-122, GDN-134, GDN-148, GDN-160. **External gates:** X07.

**Scope and outcome:** Audit complete public and researcher processes against chosen WCAG 2.2 AA scope using automated and manual checks including source tools and authentication.

**Data/API/contract:** Accessibility evidence lists tested pages, flows, criteria, tools, devices and reviewer scope.

**Acceptance:**

- `GDN-187-AC01`: Essential tasks work with keyboard and screen readers.
- `GDN-187-AC02`: Captions, text alternatives and focus behavior are reviewed.
- `GDN-187-AC03`: Known failures are fixed or affected functionality withheld.

**Tests to implement:**

- `GDN-187-T01`: Browser/AT matrix.
- `GDN-187-T02`: Zoom/reflow/contrast.
- `GDN-187-T03`: Complete login/upload/search/review/publish journeys.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Automated scan pass alone is not certification; maintain public accessibility statement and reporting route.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Essential tasks work with keyboard and screen readers. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-187/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-187-full-accessibility-and-assistive-technology-audit`.

#### GDN-188 - Performance, capacity and resilience testing

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F16, F19, F29, F39, F40. **Direct dependencies:** GDN-020, GDN-103, GDN-113, GDN-164, GDN-180, GDN-181. **External gates:** X04, X05, X08.

**Scope and outcome:** Test real deployment topology under expected/synthetic growth, simultaneous editing, large files, database sleep/restarts and slow networks.

**Data/API/contract:** performance_runs record dataset scale, region, service tier, latency, error rate and cost.

**Acceptance:**

- `GDN-188-AC01`: Published performance targets have measured workloads.
- `GDN-188-AC02`: No load test incurs unauthorized spend.
- `GDN-188-AC03`: Failures degrade safely without data loss or permission bypass.

**Tests to implement:**

- `GDN-188-T01`: Search and 100rps scenario.
- `GDN-188-T02`: 50-editor test.
- `GDN-188-T03`: Large-file and database outage drill.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Tune before scaling; plan and approve new capacity rather than silently upgrade paid resources.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Published performance targets have measured workloads. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-188/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-188-performance-capacity-and-resilience-testing`.

#### GDN-189 - Backup, outage and incident response playbooks

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** medium. **Relative weight:** 1 (not a time estimate).

**Features:** F37, F38, F40. **Direct dependencies:** GDN-017, GDN-030, GDN-032, GDN-174, GDN-180, GDN-184, GDN-188. **External gates:** No additional provider gate beyond inherited requirements.

**Scope and outcome:** Establish incident severity, containment, key compromise response, data-loss recovery, lawful notification review and public status communication.

**Data/API/contract:** runbooks distinguish security, research-correction, vendor outage and legal/privacy incidents.

**Acceptance:**

- `GDN-189-AC01`: Each incident class has owner and evidence-preserving steps.
- `GDN-189-AC02`: Emergency actions do not bypass audit.
- `GDN-189-AC03`: Sensitive incident details remain restricted.

**Tests to implement:**

- `GDN-189-T01`: Tabletop leaked-key/source-corruption scenarios.
- `GDN-189-T02`: Alert-to-response drill.
- `GDN-189-T03`: Status communication review.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Real notification duties require applicable legal review; do not invent universal legal deadlines.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-189/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-189-backup-outage-and-incident-response-playbooks`.

#### GDN-190 - Independent security assessment and canonical crosswalk closure

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F22, F32, F37, F40. **Direct dependencies:** GDN-003, GDN-005, GDN-024, GDN-025, GDN-026, GDN-030, GDN-031, GDN-033, GDN-034, GDN-041, GDN-077, GDN-079, GDN-088, GDN-122, GDN-184. **External gates:** X02, X07, X08.

**Scope and outcome:** Obtain authorized independent security testing of actual components and reconcile canonical-standard controls, penetration findings and cryptographic boundaries. Assess the enabled core research scope first; sealed, community, AI and government capabilities retain their own independent activation assessments in their feature and release PRs, not an assumed blanket pass.

**Data/API/contract:** security_release_report maps findings to fixes, retests and canonical control evidence.

**Acceptance:**

- `GDN-190-AC01`: No unresolved required critical/high failures enter sensitive release.
- `GDN-190-AC02`: Claims of assurance state exact scope/date.
- `GDN-190-AC03`: Sealed/server-readable distinctions are verified.

**Tests to implement:**

- `GDN-190-T01`: Independent penetration and architecture review.
- `GDN-190-T02`: Cross-tenant/egress tests.
- `GDN-190-T03`: Cryptographic/key recovery assessment.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Budget/access gate for external review; do not label proposed controls certified or silently self-certify.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No unresolved required critical/high failures enter sensitive release. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-190/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-190-independent-security-assessment-and-canonical-crosswalk-closure`.

#### GDN-191 - Full-corpus import and public-clearance release audit

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F20, F24, F28, F33, F38. **Direct dependencies:** GDN-048, GDN-117, GDN-118, GDN-122, GDN-134, GDN-183, GDN-184. **External gates:** X07, X09.

**Scope and outcome:** Reconcile all currently available research artifacts, preserve open historical questions and verify what is eligible for public discovery versus restricted preservation.

**Data/API/contract:** corpus_release_manifest lists imported, preserved, rejected, public and restricted counts with reasons.

**Acceptance:**

- `GDN-191-AC01`: No data silently omitted or promoted.
- `GDN-191-AC02`: Every asset/claim has correct review and rights state.
- `GDN-191-AC03`: Scope of full import differs from comprehensive historical completion.

**Tests to implement:**

- `GDN-191-T01`: Whole-import reconciliation.
- `GDN-191-T02`: Representative plus all flagged records review.
- `GDN-191-T03`: Publication-denial regression.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Do not require all history solved to publish reviewed material; unreviewed research remains safely accessible to authorized researchers.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No data silently omitted or promoted. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-191/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-191-full-corpus-import-and-public-clearance-release-audit`.

#### GDN-192 - Public launch deployment and smoke gate

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F01, F02, F06, F07, F08, F10, F38, F39, F40. **Direct dependencies:** GDN-017, GDN-018, GDN-034, GDN-042, GDN-064, GDN-076, GDN-080, GDN-087. **External gates:** X01, X04, X05.

**Scope and outcome:** Launch the reviewed public explanation and document library on authorized production resources with verified DNS/HTTPS, backups and visible status. Verify seed backup/restore, minimal live monitoring and safe metadata here; the full-corpus backup and monitoring suites follow without blocking this bounded release.

**Data/API/contract:** R1 release manifest lists included features, disabled areas, sources and verified production URLs.

**Acceptance:**

- `GDN-192-AC01`: Public newcomer and policy journeys work online.
- `GDN-192-AC02`: Restricted originals are inaccessible.
- `GDN-192-AC03`: Rollback and current-work links are tested.

**Tests to implement:**

- `GDN-192-T01`: External multi-browser smoke.
- `GDN-192-T02`: Anonymous authorization canaries.
- `GDN-192-T03`: Backup/restore and deployment-SHA checks.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Early launch does not require every advanced research PR; only reviewed R1 content and baseline controls are enabled.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Public newcomer and policy journeys work online. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-192/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-192-public-launch-deployment-and-smoke-gate`.

#### GDN-193 - Research beta deployment and real cohort verification

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F15, F19, F23, F24, F27, F28, F29, F32, F37, F40. **Direct dependencies:** GDN-020, GDN-088, GDN-104, GDN-122, GDN-134, GDN-148, GDN-184, GDN-187, GDN-188, GDN-190, GDN-191, GDN-192. **External gates:** X01, X02, X04, X05, X07.

**Scope and outcome:** Release researcher tools to an authorized cohort, import permitted material and verify actual uploads, collaboration, review, publication and withdrawal online.

**Data/API/contract:** R2/R3 beta report separates synthetic tests, real tasks and unverified capabilities.

**Acceptance:**

- `GDN-193-AC01`: Researchers complete real bounded tasks with evidence.
- `GDN-193-AC02`: Sensitive controls and canonical assessment pass.
- `GDN-193-AC03`: No missing provider is reported integrated.

**Tests to implement:**

- `GDN-193-T01`: Live cohort workflow.
- `GDN-193-T02`: Role/permission revocation.
- `GDN-193-T03`: Source-to-public correction and restore drill.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Gradual access grants; pause uploads or editing safely if integrity/security regressions occur.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Researchers complete real bounded tasks with evidence. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-193/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-193-research-beta-deployment-and-real-cohort-verification`.

#### GDN-194 - Complete public/research capability release

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F01, F14, F22, F24, F34, F35, F38, F40, F41. **Direct dependencies:** GDN-160, GDN-172, GDN-182, GDN-185, GDN-186, GDN-187, GDN-188, GDN-189, GDN-190, GDN-191, GDN-193. **External gates:** X01, X02, X03, X04, X05, X07.

**Scope and outcome:** Verify the full non-government feature inventory across providers, documentation, consent, performance and production behavior. Record any intentionally disabled optional capability.

**Data/API/contract:** Complete-release report distinguishes feature implementation from activation and research completion.

**Acceptance:**

- `GDN-194-AC01`: Every active feature meets acceptance evidence.
- `GDN-194-AC02`: Optional blocked features remain visibly unverified and prevent claims of full activation.
- `GDN-194-AC03`: GitHub and Engine Room agree with actual deployment.

**Tests to implement:**

- `GDN-194-T01`: Full feature-to-evidence audit.
- `GDN-194-T02`: Provider integration E2E.
- `GDN-194-T03`: Independent handoff and public journey checks.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Never call the entire application complete while required functionality remains blocked; release bounded increments honestly.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Every active feature meets acceptance evidence. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-194/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-194-complete-public-research-capability-release`.

#### GDN-195 - Production monitoring and release regression controls

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F34, F38, F40, F41. **Direct dependencies:** GDN-177, GDN-180, GDN-181, GDN-189, GDN-194. **External gates:** X01, X03, X04.

**Scope and outcome:** Configure authorized health checks, dependency alerts, security updates, restore exercises and regression-triggered status changes as application operations.

**Data/API/contract:** health evidence and incidents feed Engine Room with timestamps and provenance.

**Acceptance:**

- `GDN-195-AC01`: Regressed features lose verified status until retested.
- `GDN-195-AC02`: Monitoring reaches a responsible operator.
- `GDN-195-AC03`: New spending/deployments respect authorization.

**Tests to implement:**

- `GDN-195-T01`: Deliberate alert and recovery.
- `GDN-195-T02`: Reverted-build progress.
- `GDN-195-T03`: Broken-link/backup-age regression tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No claim of ongoing monitoring before deployed checks are observed; no assistant recurring scheduler is created here.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Regressed features lose verified status until retested. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-195/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-195-production-monitoring-and-release-regression-controls`.

#### GDN-196 - Final non-government acceptance and operational handoff

**Status:** planned. **Owner:** Reliability / security / accessibility leads. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F01, F24, F37, F38, F39, F40, F41. **Direct dependencies:** GDN-186, GDN-194, GDN-195, GDN-028. **External gates:** X01, X02, X03, X04, X07.

**Scope and outcome:** Perform final feature inventory, source preservation, security, accessibility, live deployment and repository-only handoff review. Establish ongoing ownership and unresolved research backlog.

**Data/API/contract:** Final acceptance report names version, scope, date, owners, residual risks and future conditional work.

**Acceptance:**

- `GDN-196-AC01`: All required active scope is production-verified or completion is explicitly withheld.
- `GDN-196-AC02`: Operators can restore and maintain service.
- `GDN-196-AC03`: Research gaps and legal conditions remain accurately disclosed.

**Tests to implement:**

- `GDN-196-T01`: Independent acceptance walkthrough.
- `GDN-196-T02`: Fresh restore/handoff.
- `GDN-196-T03`: Plan/PR/deployment/evidence reconciliation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. Sensitive or sealed operation requires canonical-standard reconciliation and independent assessment; do not substitute transport/at-rest encryption for E2EE.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Completion is an evidenced state, not a milestone label; keep monitoring and ordinary maintenance documented.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: All required active scope is production-verified or completion is explicitly withheld. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-196/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-196-final-non-government-acceptance-and-operational-handoff`.

### P15 - Legally authorized governmental extension

#### GDN-197 - Legal authority and governmental product activation contract

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 1 (not a time estimate).

**Features:** F42, F43. **Direct dependencies:** GDN-074, GDN-175, GDN-190, GDN-196. **External gates:** X07, X12.

**Scope and outcome:** After actual enactment and authorization, retrieve operative law/rules and establish governmental operator, mandate, privacy authority, funding and separate repository contracts.

**Data/API/contract:** government-authority.json requires verified law, agency/operator authorization and security scope.

**Acceptance:**

- `GDN-197-AC01`: No governmental feature activates from a CMS toggle alone.
- `GDN-197-AC02`: Authority covers exact functions and data uses.
- `GDN-197-AC03`: Material differences from draft become new specifications.

**Tests to implement:**

- `GDN-197-T01`: Authority-to-feature mapping.
- `GDN-197-T02`: Activation denial without evidence.
- `GDN-197-T03`: Updated-law discrepancy review.

**Security and privacy:** Do not include secrets or restricted research bytes in documentation; distinguish proposed requirements from verified controls. No permission broadening or new paid service is implicit in this PR.

**Migration:** Version documentation and contracts; preserve superseded decisions and source identifiers.

**Rollout:** Conditional and disabled; not part of current public-site completion denominator.

**Rollback:** Restore the preceding document revision with an explicit correction record; do not erase decision history.

**Verification:** Run repository validation and an independent document/contract review of the exact committed revision. Link actual GitHub PR/check evidence only after it exists; documentation completion is not deployed-feature completion.

**Evidence:** `docs/evidence/GDN-197/acceptance.json` plus tests/review records. **Branch suggestion:** `plan/gdn-197-legal-authority-and-governmental-product-activation-contract`.

#### GDN-198 - Government repository, tenancy and assurance boundary

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F37, F40, F42, F43. **Direct dependencies:** GDN-197. **External gates:** X02, X08, X12.

**Scope and outcome:** Establish separate governmental application/services with authorized identity, isolated data stores/keys, procurement and accessibility/security requirements.

**Data/API/contract:** Separate repo and explicit research-publication API; no direct access to unrestricted research databases.

**Acceptance:**

- `GDN-198-AC01`: Research-site accounts do not become government identities automatically.
- `GDN-198-AC02`: Private research data is not transferred without authority.
- `GDN-198-AC03`: Required assurance is independently assessed.

**Tests to implement:**

- `GDN-198-T01`: Cross-product isolation.
- `GDN-198-T02`: Data-transfer consent tests.
- `GDN-198-T03`: Government identity and service recovery drill.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No resources purchased without funding authority; staging uses synthetic applications only.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Research-site accounts do not become government identities automatically. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-198/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-198-government-repository-tenancy-and-assurance-boundary`.

#### GDN-199 - Official roster publication and administrative record

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F15, F20, F42. **Direct dependencies:** GDN-197, GDN-198. **External gates:** X02, X12.

**Scope and outcome:** Implement official roster versions, evidence, agency decisions, public notice and distinction from independent scholarly dossiers.

**Data/API/contract:** official_roster_entries reference administrative record IDs and public evidence snapshots.

**Acceptance:**

- `GDN-199-AC01`: Official status derives from authorized action.
- `GDN-199-AC02`: Disputed history stays qualified.
- `GDN-199-AC03`: Research corrections do not automatically dissolve a nation.

**Tests to implement:**

- `GDN-199-T01`: Decision authority tests.
- `GDN-199-T02`: Version/notice fixtures.
- `GDN-199-T03`: Separation from independent atlas records.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Publish only after authorized official adoption; private atlas remains independently editable.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Official status derives from authorized action. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-199/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-199-official-roster-publication-and-administrative-record`.

#### GDN-200 - Statutory comments, petitions and reasoned responses

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F35, F36, F42. **Direct dependencies:** GDN-198, GDN-199. **External gates:** X02, X12.

**Scope and outcome:** Support legally specified comment windows, correction petitions, accessible filing, docketing and reasoned decisions with required retention.

**Data/API/contract:** administrative_dockets and filings bind authority, receipt time and applicable rules.

**Acceptance:**

- `GDN-200-AC01`: Deadlines reflect operative law and verified dates.
- `GDN-200-AC02`: Filing receipt is durable.
- `GDN-200-AC03`: Private petition evidence is not automatically public.

**Tests to implement:**

- `GDN-200-T01`: Deadline/time-zone tests.
- `GDN-200-T02`: Duplicate/resumed filing.
- `GDN-200-T03`: Public docket redaction and appeals preservation.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Legal process requirements supersede draft assumptions; no silent denial for missing historical records.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Deadlines reflect operative law and verified dates. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-200/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-200-statutory-comments-petitions-and-reasoned-responses`.

#### GDN-201 - Enrollment evidence submission and private casework

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F07, F32, F37, F42. **Direct dependencies:** GDN-197, GDN-198, GDN-200. **External gates:** X02, X12.

**Scope and outcome:** Build authorized identity/evidence submission, case assignment and secure family-record handling under adopted standards.

**Data/API/contract:** enrollment_cases are separate from research memberships and use dedicated retention/key controls.

**Acceptance:**

- `GDN-201-AC01`: No genetic testing or race inference is added by software.
- `GDN-201-AC02`: Evidence use is restricted to lawful enrollment purposes.
- `GDN-201-AC03`: Caseworkers see only assigned/authorized records.

**Tests to implement:**

- `GDN-201-T01`: Sensitive upload and access matrix.
- `GDN-201-T02`: Missing-record scenarios.
- `GDN-201-T03`: Case reassignment/audit tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No real applications until legal/privacy/security and staffing gates pass; informational interest lists are not migrated as citizenship rolls.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No genetic testing or race inference is added by software. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-201/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-201-enrollment-evidence-submission-and-private-casework`.

#### GDN-202 - Duplicate enrollment, minors and affiliation changes

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F07, F37, F42. **Direct dependencies:** GDN-198, GDN-201. **External gates:** X02, X12.

**Scope and outcome:** Implement legally authorized duplicate detection with privacy-preserving identifiers, guardian/minor processes and allowed founding-period affiliation corrections.

**Data/API/contract:** enrollment_identity_links and affiliation_events expose minimum cross-nation confirmation data.

**Acceptance:**

- `GDN-202-AC01`: No genealogy is publicly exposed for deduplication.
- `GDN-202-AC02`: Ambiguous matches require review.
- `GDN-202-AC03`: Closed-roll rules follow operative law and preserve timely appeals.

**Tests to implement:**

- `GDN-202-T01`: False duplicate tests.
- `GDN-202-T02`: Conflicting guardian cases.
- `GDN-202-T03`: Closure and pending-appeal boundary scenarios.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Do not invent matching criteria or cross-agency data sharing; independent review before negative decisions.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No genealogy is publicly exposed for deduplication. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-202/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-202-duplicate-enrollment-minors-and-affiliation-changes`.

#### GDN-203 - Eligibility decisions, notices and impartial appeals

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F07, F36, F42. **Direct dependencies:** GDN-200, GDN-201, GDN-202. **External gates:** X02, X12.

**Scope and outcome:** Support human-authorized decisions, reasons, evidence requests, impartial appeals and final status under adopted rules.

**Data/API/contract:** adjudication_events and appeal_cases retain exact rules/version and responsible officials.

**Acceptance:**

- `GDN-203-AC01`: Software does not autonomously adjudicate eligibility.
- `GDN-203-AC02`: Adverse decisions have notice and independent review.
- `GDN-203-AC03`: Timely appeals preserve legally required rights.

**Tests to implement:**

- `GDN-203-T01`: Decision-role separation.
- `GDN-203-T02`: Notice delivery failures.
- `GDN-203-T03`: Appeal/deadline and missing-evidence tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Government legal review required; research evidence uncertainty is not automatically a citizenship denial.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Software does not autonomously adjudicate eligibility. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-203/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-203-eligibility-decisions-notices-and-impartial-appeals`.

#### GDN-204 - Nation certification and public instruments

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F42, F43. **Direct dependencies:** GDN-198, GDN-203. **External gates:** X02, X12.

**Scope and outcome:** Accept authorized founding instruments and publish certification status, constitutions, public laws and budgets with verified signatures and redaction.

**Data/API/contract:** nation_certifications and public_instruments reference official records and effective dates.

**Acceptance:**

- `GDN-204-AC01`: The platform does not prescribe one constitution.
- `GDN-204-AC02`: Recognition requires actual authorized decision.
- `GDN-204-AC03`: Public instruments exclude personal roll data.

**Tests to implement:**

- `GDN-204-T01`: Authority/signature verification.
- `GDN-204-T02`: Redaction tests.
- `GDN-204-T03`: Denial/revision/version workflow.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No certification from an ordinary admin click without legal authority and prescribed process.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: The platform does not prescribe one constitution. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-204/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-204-nation-certification-and-public-instruments`.

#### GDN-205 - Official opportunity register and equal access

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F06, F43. **Direct dependencies:** GDN-197, GDN-198, GDN-204. **External gates:** X02, X12.

**Scope and outcome:** Publish verified governmental offers, districts, conditions, existing rights, readiness requirements and deadlines for every eligible nation, including non-Assembly participants.

**Data/API/contract:** official_opportunities bind offering authority, operative law and versioned terms.

**Acceptance:**

- `GDN-205-AC01`: Offer is not an award.
- `GDN-205-AC02`: Conditions and rights assessments are visible.
- `GDN-205-AC03`: Equal access is not conditioned on unrelated Assembly membership.

**Tests to implement:**

- `GDN-205-T01`: Offer eligibility and deadline tests.
- `GDN-205-T02`: Nonmember access.
- `GDN-205-T03`: Withdrawn/changed offer notices.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Only lawful authorized offers; no automated creation of commercial rights.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Offer is not an award. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-205/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-205-official-opportunity-register-and-equal-access`.

#### GDN-206 - Sealed preferences and auditable closing process

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F37, F43. **Direct dependencies:** GDN-198, GDN-204, GDN-205. **External gates:** X02, X07, X12.

**Scope and outcome:** Implement externally reviewed sealed submissions, immutable receipts, authorized common deadlines, controlled key custody and auditable opening ceremony.

**Data/API/contract:** preference_envelopes and opening_events use independently reviewed protocol, not novel custom cryptography.

**Acceptance:**

- `GDN-206-AC01`: Administrator cannot read submissions early under the approved trust model.
- `GDN-206-AC02`: Amendments/withdrawals follow published rules.
- `GDN-206-AC03`: Receipt does not reveal rankings.

**Tests to implement:**

- `GDN-206-T01`: Early-access/red-team tests.
- `GDN-206-T02`: Deadline race.
- `GDN-206-T03`: Key-loss and opening quorum rehearsal.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Conditional expert cryptographic and legal gate; no claim of cryptographic time-lock guarantees without verified implementation.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Administrator cannot read submissions early under the approved trust model. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-206/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-206-sealed-preferences-and-auditable-closing-process`.

#### GDN-207 - Voluntary negotiation and compact workspaces

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F29, F43. **Direct dependencies:** GDN-204, GDN-205, GDN-206. **External gates:** X02, X12.

**Scope and outcome:** Provide authorized negotiation records, draft agreements, conflicts, invitations and voluntary joint proposals without giving the Assembly power to impose outcomes.

**Data/API/contract:** negotiation_cases and compact_drafts preserve parties, consent and authority boundaries.

**Acceptance:**

- `GDN-207-AC01`: All parties deliberately agree to shared content and results.
- `GDN-207-AC02`: Nonagreement does not fabricate an award.
- `GDN-207-AC03`: Legal terms remain reviewed by authorized participants.

**Tests to implement:**

- `GDN-207-T01`: Participant permissions.
- `GDN-207-T02`: Concurrent draft/version.
- `GDN-207-T03`: Rejected agreement and unauthorized allocation tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No automatic signatures or compelled allocation; valid decisions remain external authorized acts recorded by software.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: All parties deliberately agree to shared content and results. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-207/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-207-voluntary-negotiation-and-compact-workspaces`.

#### GDN-208 - Government public finance and compact reporting

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F08, F41, F43. **Direct dependencies:** GDN-198, GDN-204, GDN-207. **External gates:** X02, X12.

**Scope and outcome:** Publish authorized audited budgets, enterprise reporting, fee/repayment calculations and compact compliance with confidential fields segregated.

**Data/API/contract:** government_financial_reports reference authority, accounting standards, independent audits and revision history.

**Acceptance:**

- `GDN-208-AC01`: Actual data is not substituted by old hypothetical models.
- `GDN-208-AC02`: Repayment follows enacted rules.
- `GDN-208-AC03`: Citizen/investor tax outcomes are not promised.

**Tests to implement:**

- `GDN-208-T01`: Ledger/audit reconciliation.
- `GDN-208-T02`: Rule-version and rounding.
- `GDN-208-T03`: Confidential commercial-data tests.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** No money movement or regulated financial operation implied; add such capabilities only under separately approved scope.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Actual data is not substituted by old hypothetical models. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-208/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-208-government-public-finance-and-compact-reporting`.

#### GDN-209 - Nation portals and government service boundaries

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 3 (not a time estimate).

**Features:** F39, F42, F43. **Direct dependencies:** GDN-198, GDN-204, GDN-208. **External gates:** X02, X12.

**Scope and outcome:** Provide linked public portals for laws, budgets, notices and service directories, with clear service owners and separate governance.

**Data/API/contract:** portal configuration federates permitted public records without sharing private administrative data.

**Acceptance:**

- `GDN-209-AC01`: Public portal does not become an online voting or judicial system by default.
- `GDN-209-AC02`: Each nation controls its authorized content.
- `GDN-209-AC03`: Accessibility and separation are verified.

**Tests to implement:**

- `GDN-209-T01`: Cross-nation isolation.
- `GDN-209-T02`: Published-law version tests.
- `GDN-209-T03`: Service handoff and accessibility review.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Binding elections, courts, policing and regulated enterprises remain separate authorized products and specifications.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: Public portal does not become an online voting or judicial system by default. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-209/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-209-nation-portals-and-government-service-boundaries`.

#### GDN-210 - Government legal, security and production acceptance

**Status:** conditional. **Owner:** Authorized governmental product team. **Risk:** high. **Relative weight:** 5 (not a time estimate).

**Features:** F37, F39, F40, F42, F43. **Direct dependencies:** GDN-197, GDN-198, GDN-199, GDN-200, GDN-201, GDN-202, GDN-203, GDN-204, GDN-205, GDN-206, GDN-207, GDN-208, GDN-209. **External gates:** X02, X07, X12.

**Scope and outcome:** Conduct formal authorized acceptance of every activated governmental function, including independent security, legal process, accessibility, operations and disaster recovery.

**Data/API/contract:** Government acceptance is separately signed by authorized operator and expert reviewers; no software-only certification.

**Acceptance:**

- `GDN-210-AC01`: No function goes live without its actual authority and evidence.
- `GDN-210-AC02`: Citizen rights and private records are protected under verified rules.
- `GDN-210-AC03`: Research/public site remains independent and usable.

**Tests to implement:**

- `GDN-210-T01`: Independent end-to-end administrative cases.
- `GDN-210-T02`: Sealed-submission audit.
- `GDN-210-T03`: Restore/appeal/notice drills.

**Security and privacy:** Apply data-classification and purpose-based policy to every new field, index, cache, event and export. Add negative-access tests and review indirect disclosure paths. No permission broadening or new paid service is implicit in this PR.

**Migration:** Use additive versioned schema changes and idempotent backfills; retain immutable source and rollback by reversible application/projection steps, not destructive source mutation.

**Rollout:** Entire track remains conditional until enacted, authorized, funded and independently verified; never included as completed current functionality.

**Rollback:** Disable this capability or revert to the prior compatible artifact while preserving data, audit, consent withdrawals and successful writes. Reconcile migrations and queued work before replay; never run an unreviewed destructive down migration.

**Verification:** On the exact deployed SHA, exercise the principal workflow: No function goes live without its actual authority and evidence. Repeat an unauthorized or failure case from the PR test list, record actual URL/service ID and timestamp, and verify logs, rollback readiness and current feature state. Synthetic staging evidence alone is insufficient.

**Evidence:** `docs/evidence/GDN-210/acceptance.json` plus tests/review and deployment/live-verification records. **Branch suggestion:** `plan/gdn-210-government-legal-security-and-production-acceptance`.

