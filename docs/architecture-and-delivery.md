# The Garden: Comprehensive Website Development Plan

**Version 1.0 | 10 October 2026 | Planning baseline GARDEN-WEB-PLAN-001**

**Deliverable status:** Authored development plan, not an implemented or deployed application. The PR identifiers in this document are planned work-item identifiers, not existing GitHub pull-request numbers. GitHub access, the target repository, the canonical End-To-End-Everywhere Security Architecture Standard, Engine Room's actual integration contract, and the authorized hosting resources were not available for verification during preparation. Local planning-tool validation is reported separately from application CI and production verification.

## 1. Product mandate and non-negotiable outcomes

The Garden website is one coherent public institution with three distinct responsibilities: explain the proposed policy to people encountering it for the first time; preserve and publish a critically reviewed historical record; and enable sustained, accountable collaboration on that record. Its public experience must be welcoming and emotionally meaningful without disguising uncertainty. Its scholarly environment must remain usable by people who do not endorse the policy. Its operational architecture must prevent convenience, publicity, or automation from overriding evidence, consent, security, or legal authority.

The first public release must communicate what The Garden is, why its proponents consider it important, what the draft legislation would and would not do, how the proposed financing works, what remains unresolved, and how to inspect the underlying evidence. It must not require an account to read published research. Public education is not postponed until every advanced research tool is finished.

The complete program covers all 43 previously specified functions. It includes an eventual legally authorized implementation track, but does not confuse that track with a privately operated research and public-information website. It does not confer citizenship, recognize governments, adjudicate legal eligibility, award economic rights, operate regulated businesses, or run binding elections merely because the software can display a form.

Success has separate dimensions. Product success means that visitors understand the proposal and can find evidence; research success means that records, claims, review decisions, and corrections remain traceable; engineering success means tested and maintainable software; production success means verified online behavior, recoverability, and security; policy success is not an engineering assertion. No one percentage substitutes for all five.

### 1.1 Audience and participation principles

Serve first-time public visitors, ADOS and other descendant participants, relevant African communities, historians, archivists, translators, teachers, journalists, policy analysts, accessibility users, and authorized administrators. ADOS participants must have practical opportunities to shape representation, contribute evidence, challenge findings, and control personal materials. The research library must not require political agreement or disclosure of ancestry.

Provide a universally available explanation of the policy and its arguments. Do not tailor political persuasion using race, ancestry, religion, inferred political affiliation, family records, or research behavior. Voluntary audience research may assess comprehension and usability, with separate consent and aggregate reporting; it must not become a political targeting database. People may authorize research preservation without authorizing promotional use or endorsement.

### 1.2 The core visitor journeys

**Understand:** Home -> short introduction -> illustrated explanation -> program steps -> funding -> objections -> legislative provision. A visitor can complete this journey with a keyboard, on a phone, without video or animation, and without creating an account.

**Investigate:** Public story -> historical subject -> individual claim -> supporting and contradicting evidence -> exact source region or timecode -> citation or download. Every step preserves the distinction between a source's statement and the project's conclusion.

**Contribute:** Contribution guidance -> consent and visibility choices -> secure upload -> receipt -> researcher triage -> requested clarification -> review -> publication decision -> ongoing access and correction options. No submission is automatically published or treated as an enrollment application.

**Research:** Researcher onboarding -> authorized collection -> source intake -> source inspection -> transcription/translation -> entity and claim work -> independent review -> rights/accessibility clearance -> publication -> dependency-aware correction. Concurrent editing, interrupted connections, and researcher handoffs do not destroy work.

**Challenge:** Claim or representation -> correction/dispute submission -> acknowledgment -> conflict-free assignment -> evidence exchange -> reasoned decision -> appeal -> public correction where appropriate. Popularity does not settle a historical question.

**Operate:** Versioned plan -> dependency-ready PR -> required checks -> permitted merge -> staged deployment -> online verification -> evidence capture -> Engine Room reconciliation -> next ready task. A merged PR is never reported as production-ready by inference.

## 2. Source baseline, verified preparation work, and limits

### 2.1 Garden policy baseline

The policy input is `garden.docx`. The operative drafting baseline reviewed for this plan is **Garden National Restoration and Economic Self-Government Act, version 1.0, 28 September 2026**, together with its source and drafting notes. These remain proposed documents requiring legal and fiscal review; this plan does not establish congressional introduction, passage, government endorsement, or constitutional validity. The website must use a dated, sourced legislative-status record rather than infer current status from the document's title. [P01, P02]

Important implementation constraints in the draft include voluntary affiliation, no mandatory genetic testing, no requirement to prove descent from a selected historical polity, no replacement of United States citizenship, independent historical assessment, no exclusive authority for this atlas, voluntary state participation, protection of existing rights, and an Assembly that facilitates but cannot impose settlements. Closed founding rolls precede exclusive commercial awards. The historical roster is not a modern genealogy or a finding of international succession. [P01, sections 103, 201-202, 301-302, 401, 501, 601-602, 701, 801]

The funding interface must accurately represent the draft. Audited founding-fund net disbursements define a recovery target with a **one-time 5 percent return**, not a compounding annual return. Annual assessments are **1 percent of a nation's economic share of positive consolidated qualifying net income** until the aggregate target is reached. Insufficient income can prevent recovery; administration, fees, and tax effects must be separately reported. The draft expressly rejects a zero-fiscal-cost assertion based only on intended repayment. The policy's intended self-financing rationale should be prominent, but an unconditional zero-taxpayer-cost headline must remain blocked unless supported by an applicable independent fiscal assessment and editorial/legal clearance. [P01, sections 1101-1102; P02]

### 2.2 Research baseline

The current master index and registry identify **CP-017 / Working Research Edition 1.29-alpha / Research Corpus 1.17**, dated 9 October 2026. The six-document set comprises the atlas, apparatus, registry, guide, image budget, and correction log. The corpus is distributed as four component archives: CORE, EXPORTS, SOURCES, and RECOVERY. Older editions and recovery artifacts remain part of the preservation record. [P03-P05]

The research charter distinguishes records acquired, inspected, transcribed, independently checked, supported with scope, contested, and published. It prohibits identity inference from resemblance, name, port, or broad geographic probability; it separates polities, peoples, languages, regions, people, voyages, and archival witnesses. Its original online-research cutoff remains historical metadata, not a website-wide freeze on new contributions. Any future oral-history program requires its own consent-governed protocol and a new intake lane; it does not retroactively change the earlier charter. [P06]

The work log reports 1,747 rendered final pages but only 37 visually reviewed at that checkpoint; it records 175 provisional Marinerito rows and unresolved row alignment beginning at row 223. It also records inherited database recovery limits, pending source rights, and incomplete comprehensive review. These are imported as limitations, not erased by a new interface. [P04]

### 2.3 Preparation checks actually performed for this plan

The exact CORE component was materialized and hashed. Its SHA-256 matched the registry: `d8bef939c9ef63c4f0e3896f947d79679aae10f3fd62d347ff99f960d8247780`. Its ZIP CRC test returned no bad member. The enclosed database was opened read-only and immutable; `integrity_check` returned `ok`, and `foreign_key_check` returned zero violations. The observed database is 396,087,296 bytes with SHA-256 `3bc3b81b7a2ffaaf2a5a0a072ddf781c8688785aa67b3d6069cca5a9918d3ed0`, 106 tables, 186 indexes, zero triggers, and 923,292 rows across the 106 tables. A complete schema/count inventory is included in the package. [V01]

These checks establish the integrity of the inspected bytes and observable database state, not historical accuracy, original-schema equivalence, complete recovery, or reproduction permission. The other three component archives and the six complete Word documents were not independently reaudited during this planning task. Their checkpoint claims remain attributed to the existing registry and work log. Counts of structural units, lexical code occurrences, database rows, records, people, claims, and reviewed findings must never be treated as interchangeable.

The inspected database contains multiple historical extraction layers. For example, its legacy `assets` and `image_placements` tables are not automatically the authoritative newest-book counts. Migration must reconcile the actual current documents and their manifests rather than silently prefer whichever table name sounds current. The complete per-table disposition matrix is part of the implementation backlog and package.

### 2.4 Unavailable specifications and external dependencies

No canonical text of the user's End-To-End-Everywhere standard or Engine Room API was retrieved. Their absence from the searches performed is not a claim that they do not exist. The security design below is an explicit proposed baseline, not a reinterpretation or certification of that named standard. The Engine Room adapter contract below is a Garden-side proposal pending reconciliation, not an invented description of the existing service.

The GitHub integration was found but is not connected in this session. The repository owner/name, existing code, branch rules, reusable engines, authorized Render workspace, Neon project, object-storage service, identity provider, key service, email provider, budget, and domain were not verified. Discovery tasks must establish them. Independent documentation, synthetic-data development, and local tests can proceed while access is resolved; costs, protected data, and production changes cannot.

## 3. Product boundaries and release strategy

### 3.1 Four operating modes

**Public information:** Reviewed explanations, public evidence, exhibits, policy documents, funding scenarios, education, and transparent participation. No sign-in to read. Only publication-cleared material reaches public pages, search indexes, feeds, screenshots, caches, exports, or AI retrieval.

**Research workspace:** Authorized source intake, collaboration, analysis, review, and administrative work. Visibility is collection- and record-specific, not a global assumption that every researcher may read everything.

**Sealed workspace:** End-to-end-encrypted materials whose plaintext is available only to authorized participant devices. Server-side full-text search, AI processing, transcription, malware content inspection, and public preview are unavailable unless a distinct consented declassification/processing workflow creates an authorized derivative. Restrictions must be visible before upload.

**Authorized government extension:** A separate future product/security boundary for official roster administration, enrollment, nation portals, and Assembly procedures. It requires enactment, delegated authority, rules, credentials, independent review, and dedicated deployment. The public site never gains those powers from a feature-flag change alone.

### 3.2 Release milestones, not a single giant launch

**R0 - Reproducible foundation:** Repository, source register, architecture decisions, plan validator, credential requirements, threat model, local development, CI, merge policy, staging isolation, and integration-discovery results. Public narrative work may proceed in parallel with research-model work using explicitly reviewed fixtures.

**R1 - Public explanation and inspected evidence pilot:** Professional homepage, layered explanation, name/vision, policy library, how-it-works, rights, funding center, objections, selected rights-cleared stories, basic public source inspection, accessibility, feedback, and current-document index. The release visibly says which research is available and what remains in progress. It does not publish the raw corpus by default.

**R2 - Researcher alpha and accountable migration:** Researcher identity and permissions, preserved source imports, staged reconciliation, source viewer, structured records, transcription, claims, review, audit trail, and recoverable workspaces. Use synthetic records until security gates clear; invite qualified pilot researchers only within approved access and costs.

**R3 - Public atlas and advanced discovery:** Reviewed subject pages, claim-to-source navigation, simple and advanced search, maps/timelines, citations, reading shelves, exports, research coverage, and correction propagation. A visible verified-publication gate applies per object and claim; an unfinished corpus does not prevent publishing a reviewed subset.

**R4 - Full collaboration and community programs:** Concurrent editing, source-language review, family/oral-history intake, community governance, disputes, education, public events, opt-in communication, transparent donations where authorized, and reproducible analysis. Human research and editorial work continues alongside implementation rather than being represented by code completion.

**R5 - Assistant and operational completion:** Evidence-bound conversational search after evaluation, all performance/accessibility/security requirements, complete source reconciliation accounting, independent operational review, tested restoration, handoff, and verified production behavior for the full public/research scope. Assistant availability depends on an approved provider and spending ceiling; ordinary search never depends on it.

**RG - Legally authorized extension:** Future official processes. Conditional work has its own denominator and must not make current-site progress appear permanently incomplete or falsely complete. Design and test harnesses can be prepared without activating government functions.

These are release packages, not instructions to serialize all work by chapter number. The PR dependency graph determines safe execution. The earliest public release has an explicit dependency closure; research ingestion must not monopolize the critical path when the public-facing work can safely advance independently.

### 3.3 Explicit non-goals and forbidden shortcuts

Do not build a regulated-goods marketplace, sell membership or national citizenship, offer investment returns, provide individualized legal eligibility decisions, or imply government recognition. Do not automate ancestry assignments, infer racial identity from portraits, turn speculative reconstruction into archival evidence, or call unreviewed bulk text verified. Do not create an unrestricted public social network as a substitute for moderated research and listening. Do not build custom cryptographic algorithms, a new payment processor, a general-purpose CRM, or another Engine Room when an existing authorized service can meet the contract.

Do not make public engagement dependent on opaque recommendation ranking. Do not optimize political conversion through sensitive-data profiling. Do not put proprietary source bytes, personal genealogies, secrets, or production database exports in a public repository or untrusted PR preview.

## 4. Architecture and technical decisions

### 4.1 Repository and application topology

Use a **modular monorepo for this one coherent product**, not a premature fleet of microservices. Proposed repository slug: `garden-platform`, subject to discovery of an existing Garden repository; do not create a duplicate if one exists. Keep genuinely separate reusable engines and the future governmental extension in their own repositories with versioned integration contracts. The current product owns its domain model, public experience, research workflows, and adapters, not the internals of shared infrastructure.

Proposed application structure:

```text
apps/
  public-web/          Public information and published research only
  research-web/        Authenticated collaboration and administration
  worker/              Import, rendering, publication, export, reconciliation
  collab-relay/        Authenticated real-time document update transport
packages/
  domain/              Pure state machines and policies
  contracts/           Versioned HTTP/event/validation schemas
  database/            SQL migrations, repositories, permission tests
  design-system/       Tokens, accessible components, editorial blocks
  identity-adapter/    Existing identity-engine/OIDC integration
  storage-adapter/     Object storage, hashes, derivative manifests
  security-adapter/    Canonical security-engine integration, once verified
  engine-room/         Progress/evidence export and reconciliation
  search/              Published projections and authorized query execution
  source-viewer/       IIIF/annotation/transcript components
  fiscal-model/        Deterministic, versioned scenario calculations
  research-assistant/  Retrieval/evaluation/provider interfaces
```

Public and researcher applications may share source code and design components but use separate credentials and deployable services. The public runtime has no credential capable of reading restricted research tables or private object buckets. A dedicated publication projector crosses the boundary only after recorded approval. This separation reduces the consequences of a public-rendering defect without pretending to solve every threat.

### 4.2 Runtime, framework, database, and deployment choices

Use TypeScript, React, and Next.js App Router for the public and authenticated interfaces; keep domain services independent of framework request handlers. Prefer server-rendered public content and progressive enhancement. At preparation, the official Next.js documentation identifies 16.4.0; its self-hosting guidance must be followed for cache coordination and multi-instance deployment. Pin the current patched supported release at bootstrap rather than use floating `latest` tags. [S01, S02]

Use Node.js 24 LTS for the initial runtime baseline, subject to patch verification at implementation. The official release page identifies Node 24 as LTS and recommends production use of active or maintenance LTS releases. An upgrade is a tested PR, not an unrecorded host default change. [S03]

Use authorized **Neon PostgreSQL** resources for transactional metadata, relationships, state transitions, audit references, query projections, and job/outbox records. Keep original documents and media in authorized object storage, not PostgreSQL blobs or ephemeral Render filesystems. Use SQL migrations with a typed query layer; keep permission-sensitive SQL explicit and integration-tested. Full-text search and trigram matching are the initial lexical baseline; use PostGIS and vector extensions only after their availability and authorization are verified in the actual Neon project. No extension or separate search cluster is assumed to exist.

Use **Render** for authorized web, worker, and relay deployments. Commit deployment definitions only after confirming workspace, region, resource IDs, networking, plan capabilities, and spending authorization. Public and research deployments have separate service identities. Pre-deploy migration execution, preview services, disks, and zero-downtime behavior must be verified for the selected service plan, not inferred from marketing language. Render documents paid-service limits for pre-deploy commands and specific preview-environment behavior. [S04, S05]

Use existing identity, storage, key-management, email, observability, and progress engines where they meet these contracts. The default identity protocol is OIDC Authorization Code with PKCE and server-managed sessions; do not implement a custom password system. If no authorized provider meets the required authentication and security properties, signed-in launch is blocked pending access/provider authorization while public development continues. This is an integration dependency, not a request for routine architectural advice.

### 4.3 Trusted processing versus end-to-end encryption

Encryption in transit, encryption at rest, application-level envelope encryption, and true end-to-end encryption solve different problems. Never label them interchangeably. Public evidence is deliberately public. Some collaboration requires authorized server-side processing; other material must remain unreadable to the service. The UI, APIs, storage, indexes, workers, logs, exports, and assistant all carry the same classification and processing policy.

Default treatment of new private family records and sensitive unpublished submissions is **sealed pending explicit processing consent**. A workspace can permit trusted-server processing only under a documented, visible policy permitted by the canonical standard. Do not silently downgrade protection to make search convenient. The canonical End-To-End-Everywhere standard may require a stricter design; reconcile it before any sensitive production data is accepted.

True E2EE uses an audited protocol/library or an existing verified security engine, authenticated device enrollment, participant key verification, per-collection/document key epochs, cryptographic integrity, and a documented recovery model. The service cannot claim zero knowledge while retaining universal plaintext recovery keys. Key loss and recovery consequences must be explained. Removing a participant prevents future access and rotates future key material; it cannot erase plaintext or keys already copied by that participant. Re-encryption and cache invalidation do not justify a retrospective revocation guarantee.

Protect against malicious client delivery as well as database theft: strict CSP, minimal third-party scripts, integrity-checked builds, dependency controls, independent client security review, short-lived sessions, device revocation, and signed/versioned client manifests where the approved engine supports them. A browser application served by the operator has an explicit client-delivery trust assumption; describe it rather than claim server-compromise immunity.

### 4.4 Data-classification matrix

| Class | Typical content | Server processing | Public search/AI | Encryption and access rule |
|---|---|---|---|---|
| PUB | Rights-cleared published evidence and approved explanations | Allowed for defined purposes | Allowed only from current publication projections | TLS, integrity/provenance, signed releases; no claim of confidentiality |
| RES | Licensed research content and ordinary private team drafts | Only when explicitly authorized by collection policy | Never; authorized workspace search may be permitted | TLS, at-rest encryption, scoped access, audit, envelope encryption where required |
| SEN | Living-person information, confidential testimony, sensitive community knowledge | Denied by default; purpose-bound exception requires consent and standard compatibility | Never | Sealed intake or strongly isolated authorized workflow; metadata minimized |
| SEALED | Participant-only encrypted documents and messages | Ciphertext transport/storage only | Never; client-local search only | Verified E2EE engine, device/key lifecycle, no platform plaintext recovery claim |
| SEC | Credentials, recovery secrets, signing keys | Only dedicated security service | Never | External secret/key store, minimal short-lived access; never in repo/logs/analytics |
| GOV | Future official enrollment and sealed government submissions | Only under future authorized rules | Only specifically publishable derivatives | Separate repository/deployment/trust boundary and legal activation gate |

Every derivative inherits the most restrictive relevant policy until an explicit release decision creates a new public derivative. A redaction is a new asset with its own hash and locator mapping; merely drawing a black rectangle in a browser is not a redaction.

### 4.5 Data flows and trust boundaries

**Public read:** Browser -> public edge -> published API -> publication database/projection and public-media derivative store. Restricted storage is not on this request path. Public response caches key on publication version and locale; emergency withdrawal has an access-denying check and tested purge path.

**Research read/write:** Browser -> authenticated research gateway -> central policy decision -> resource-specific service -> transaction-scoped authorized database/object access. Recheck authorization on every mutation, export, subscription, and background job execution. API permissions do not replace database and object-store boundaries.

**Upload:** Client -> authorized upload session -> quarantine/ciphertext store -> integrity and format checks -> permission-aware processing -> immutable source object -> research record. No parser is given unrestricted internet access, credentials, or permission to execute embedded code.

**Publication:** Reviewed version + claim decisions + rights + consent + accessibility + editor authorization -> immutable release candidate -> projection validation -> atomic publish pointer -> search/index/cache/feed refresh -> live verification. Fail closed if a mandatory dependency is missing or stale. An index lag must never expose newly restricted records.

**Integration events:** Transactional outbox -> scoped adapter -> acknowledged remote service -> reconciliation. Each event is idempotent, versioned, and traceable. External service downtime does not destroy local evidence or create false success.

**Sealed content:** Authorized devices encrypt/decrypt; servers transport and persist ciphertext and minimal routing metadata. A publication action requires an authorized client to produce a deliberate redacted/public derivative and a separate review decision. No backend indexes ciphertext as if it contained searchable text.

### 4.6 Authorization and database rules

Adopt deny-by-default policy enforcement with roles plus resource attributes: actor, collection, task, record class, consent, rights, purpose, ownership, embargo, and current review state. Roles are not sufficient by themselves. A transcriber may inspect an assigned source without gaining access to every family submission; a rights reviewer need not access private genealogies; a public editor cannot modify sealed originals.

PostgreSQL row-level security is defense in depth. Application roles must not own protected tables or possess `BYPASSRLS`; force RLS where appropriate and verify migration-owner separation. PostgreSQL documents owner and privileged-role bypass behavior, so tests must exercise the actual production-equivalent roles, not just a superuser fixture. [S06]

Use transaction-local actor/collection context with pooled connections; never rely on ambient session state surviving or being reset safely by assumption. The application server is itself a trusted enforcement component; user-settable context variables are not cryptographic proof of identity. Parameterize all values, allowlist query structure, prohibit direct end-user SQL, and test alternating tenants on the same pool under concurrency. Verify Neon's actual pooling mode and extension limits before enabling the pattern. [S07]

Background workers receive scoped job capabilities and revalidate permissions at execution and delivery. A job queued before a consent withdrawal cannot bypass the later restriction. Object URLs, IIIF tiles, thumbnails, annotations, notifications, counts, facets, exports, and assistant retrieval are part of the authorization surface.

## 5. Canonical data model and research semantics

### 5.1 Core aggregates

Use stable opaque identifiers and immutable version identifiers. Preserve external identifiers in a namespaced mapping table; do not embed the latest human-readable name in a canonical identity. Slugs are replaceable display routes with redirects, not primary keys.

The minimum aggregate families are: actors and organizations; memberships and grants; collections and access policies; source works, editions, archival items, witnesses, and manifestations; source files and derivatives; pages/canvases/time segments; transcriptions, normalized readings, and translations; entities and names; assertions and evidence relationships; inspections, reviews, and decisions; editorial pages and block placements; publication releases; rights and consent instruments; tasks, research lanes, and searches; corrections and dependencies; discussions and disputes; contributions and oral histories; analysis runs and datasets; saved queries and reading collections; fiscal model versions and scenarios; audit events; export jobs; integration events; and preservation manifests.

An `AssertionVersion` records exact wording, claim type, subject, predicate/object or narrative content, temporal/geographic scope, source-attribution mode, current editorial status, and evidence links. `EvidenceLink` records a locator, support/contradiction/context relation, evidence class, independence group, inspection depth, limitations, and reviewer decision. `ClaimPlacement` binds the assertion version to a precise editorial or dataset location. A prose paragraph is not automatically one atomic claim.

### 5.2 Review and publication are different state machines

Keep at least four independent dimensions: inspection/research status, editorial decision, rights/consent availability, and public release status. A source may be fully inspected but not reproducible; a claim may be well supported but contain sensitive living-person details; a source may be public domain while a proposed interpretation remains unsupported.

Research states preserve the charter's meaning: unreviewed, partially inspected, supported-with-scope, contested, unsupported, withdrawn, access-blocked, deferred-offline, and closed-with-limits. Public presentation translates those states into understandable labels without flattening them into a universal green checkmark. A contested finding may be published as contested after review; it must not enter a filter called verified fact.

A publishability decision requires all applicable gates, including claim-level scope, source locator, permission/consent, accessible alternatives, editorial approval, and current dependency versions. Reviews expire or become stale when the reviewed text, source, scope, rights, or material interpretation changes. Keep who reviewed what, their declared competence and conflicts, and whether the review was human, machine-assisted, or independent.

### 5.3 Identity, time, geography, and uncertainty

Store exact recorded strings separately from normalized search forms. Names need language/script, type, date scope, recorder, source, and disputed-equivalence metadata. Polity, people, language, port, region, institution, person, family, vessel, voyage, and event remain distinct types. Merge proposals are reversible, reviewed operations; same-name or adjacent register rows are not sufficient identity evidence.

Dates need original text, calendar, normalized interval if justified, precision, uncertainty, and separate event/creation/publication/digitization/access dates. Coordinates and boundaries need source, temporal validity, precision, uncertainty geometry, and representation status. An approximate point is not a surveyed boundary. A modern border is optional context, not an inferred historical jurisdiction.

Relationships need a direction, type, temporal scope, source, and evidentiary status. Graph visualizations must render hypotheses differently from accepted links, and their accessible table must retain those distinctions. Do not infer living descendants or eligibility from historical entity graphs.

### 5.4 Source locators and annotation resilience

A locator can include source item ID, edition/witness ID, digital page, printed page/folio, side, image coordinates, text quote and surrounding context, text offsets bound to a version hash, line/row/column, or audio/video timecode. Preserve each locator's meaning; digital page 9 is not automatically printed page 9.

Use IIIF Presentation and W3C Web Annotation concepts for interoperable canvases, resources, annotations, and selectors. Implement the subset explicitly declared by the application; passing a local example does not certify full protocol conformance. [S08, S09]

When text changes, reanchor annotations with a confidence/ambiguity result. Ambiguous anchors enter a review queue rather than attaching to the nearest familiar phrase. A revoked or redacted source invalidates related thumbnails, snippets, attachments, and public citations to protected content while preserving lawful tombstone metadata.

### 5.5 Import keys, immutable originals, and lineage

Use `(source_namespace, source_record_id, source_version)` plus content hashes for deterministic ingest identity. Hashes detect byte equality, not person identity. Preserve raw records and raw source bytes in a quarantined/preserved tier; typed projections may be corrected without rewriting originals. Record each transformation, tool version, mapping version, source and output hashes, timestamp, and limitation.

The current SQLite corpus is an import source, not a schema to reproduce blindly as the production application. Keep all 106 tables accounted for. Classify tables as canonical source records, historical extraction snapshots, review/evidence state, sequence data, correction history, preservation metadata, or quarantined legacy state. Preserve historical snapshots without inflating current-record counts. Unknown columns/tables stop promotion and enter reconciliation; they are never silently dropped.

## 6. Existing-research migration and publication program

### 6.1 Inventory and reconciliation

Obtain all four authoritative corpus components, all six current documents, their integration/validation manifests, the original policy and draft legislation, and referenced earlier immutable milestones needed for lineage. Record access results; do not claim a missing component was imported because its filename appears in an index. Read and retain the charter and work log before transforming anything.

For each artifact, verify the exact received byte count and SHA-256, ZIP members/CRC where applicable, decodeability, and reopenability after storage. For SQLite, inspect the header/page count, close/reopen it, run integrity checks, inventory schema objects, and compare complete NDJSON exports without assuming schema recovery from data alone. Truncation is a first-class failure case and must be injected in tests.

For Word documents, preserve document XML, hyperlinks, bookmarks, comments, tracked changes, footnote-like formatting, headers/footers, nested tables, image relationships, crops, alt text, and edition-local note numbering. Comments containing superseded language must not become current prose or new source testimony. Parsing success is not reader-link activation or visual inspection.

### 6.2 Three migration layers

**Layer A - Preservation:** Every source object and legacy table is durably accounted for, including defective archives and partial recovery records. Preserve restricted materials according to rights and privacy rules. This layer can be complete without any historical finding being reviewed.

**Layer B - Canonicalization:** Typed source/entity/claim/review/task records are populated through versioned mappings; duplicates and conflicts are proposed for review; exact source-to-target reconciliation reports exist. Current versus historical layers are distinguished. This is a data-engineering completion state, not scholarly endorsement.

**Layer C - Public release:** Only individually cleared claims, pages, assets, and datasets enter the public publication projection. Unreviewed material remains visible to appropriately authorized researchers with explicit status. A public research-progress page describes unpublished scope without leaking restricted names, counts, or content.

### 6.3 Migration acceptance criteria

Every source artifact, table, row batch, image placement, citation occurrence, and document part in the declared migration scope has a disposition: imported, preserved-only, superseded with a link, duplicate by bytes with lineage, awaiting review, unavailable with an access record, or quarantined with a reason. No silent omissions. Every row-count variance is explained at the correct unit of analysis.

Repeated import is idempotent. An interrupted import resumes without duplicate rows or promoting half-written records. A failed bulk import cannot mutate the public release. Updates preserve source versions and a reversible reconciliation trail. New-source discoveries after a cutoff enter dated supplements. The launch report distinguishes preservation completeness, canonicalization completeness, editorial readiness, rights clearance, and historical review.

A final content-transfer test must open real authorized artifacts through the deployed reader, follow representative citations into the correct edition/region, and compare generated public pages to their reviewed source records. Automated format checks are necessary but not a substitute for specialist review.

## 7. Public experience and content-production specification

### 7.1 Information architecture

Primary navigation: **The Garden; How It Works; History & Atlas; Research; Participate; About.** Search is always reachable. Researcher sign-in is visible but secondary on public pages. Each major destination has a plain-language introduction, a small number of useful next actions, and deeper routes for experts.

Use an editorial visual language rather than a generic administrative dashboard: generous typography, disciplined whitespace, clear image captions, readable narrow text columns, prominent evidence links, and consistent distinction among documentary evidence, later artwork, and generated illustration. The research workspace can be denser but retains accessible hierarchy and recoverable state.

Provide all empty, loading, denied, withdrawn, error, stale, pending-review, no-results, and partial-data states. Skeletons cannot resemble completed evidence. A date or progress bar without a meaningful denominator must not appear authoritative.

### 7.2 Homepage and layered explanations

The homepage presents a source-reviewed definition, purpose, proposal status, human context, core institutional mechanism, intended financing, important qualifications, and routes to evidence and participation. Provide short, guided, and detailed modes using the same structured claims and versioned content, not independent copies that drift.

A visitor should find funding and questions within two meaningful navigation actions from the homepage. Test comprehension with consenting first-time users, including descendant/community participants, without collecting unnecessary identity data. Proposed acceptance target: at least 80 percent of the pilot sample correctly distinguish proposal from existing program, voluntary affiliation from ancestry assignment, and intended repayment from guaranteed zero cost. This is a design test target, not an asserted measured result or a statistically representative public-opinion finding.

### 7.3 Narrative and image treatment

Explain cultures through institutions, work, family, arts, belief, political relationships, survival, and change before describing capture and disruption. Avoid a universal template that forces every community into destruction. Historical and moral arguments should be identifiable as such. Visitors can read without traumatic imagery; graphic material is opt-in and never autoplays.

Pose-pair exhibits require two independent asset records, separate captions, a stated curatorial argument, and a review that the pairing does not imply unsupported identity, continuity, or causation. Generated book images must be located, rights/creation records inspected, and reviewed before use. They require a persistent generated/reconstruction label in the image, caption, metadata, downloads, and share derivatives. Appearance is not evidence of racial or ancestral identity.

### 7.4 Policy mechanics, eligibility, objections, and examples

Use versioned process steps and responsibility diagrams linked to draft sections. Show conditions, actors, decisions, appeals, and failure/delay branches. Explain separate meanings of historical affiliation, eligibility, citizenship, governmental recognition, land jurisdiction, and commercial authorization. Do not turn a preliminary questionnaire into an eligibility determination or collect documentary proof before official authority exists.

A policy question has a concise answer, longer explanation, relevant provision, evidence, counterargument, unresolved issues, and last review. Alternatives are compared using disclosed criteria. Illustrative outcomes include uncertainty and adverse cases; fictional composites are labeled, never presented as testimonials. A policy-text change flags all related explanations and translations for review.

### 7.5 Funding-model specification

Model inputs are explicitly hypothetical until supported by a dated budget or fiscal analysis. Keep units, currency, real/nominal basis, reference year, time horizon, and discount-rate assumption visible. Separate startup census funding, other administration, fees, state/local effects, private investment, nation enterprise economics, repayment receipts, tax effects, and outstanding public exposure.

Let `B` be audited Fund disbursements less eligible recoveries/refunds attributable to those disbursements; define `T = 1.05 * B` once for a specified assessment version. Let `Q[n,t]` be each nation's economic share of qualifying consolidated net income for year `t`, as defined by the scenario. Requested assessment is `A[n,t] = 0.01 * max(0, Q[n,t])`. Total collection in a year cannot exceed remaining target. Do not subtract repayment collections again when calculating `B`, and do not net an unrelated activity's losses against qualifying income. [P01, section 1101]

For the simulator, allocate a capped final aggregate assessment proportionately to requested assessments with deterministic smallest-currency-unit rounding; identify this as a modeling convention pending an official allocation rule. Display no-income, delayed-income, partial-recovery, failure, and high-income scenarios. Show nominal recovery separately from discounted net fiscal effect. Never hide a negative result or choose optimistic defaults merely for persuasion.

Tests include `B=1,000,000` giving `T=1,050,000`; zero/negative qualifying income producing no assessment; ten million of qualifying national economic-share income producing a requested 100,000 assessment; a remaining 50,000 balance capping the aggregate collection at 50,000; no compounding; no excess collections after termination; rounding conservation; invalid units; and scenario reproducibility. These are arithmetic fixtures, not financial forecasts.

### 7.6 Content ownership and independence

Assign content owners by role: public editor, historical editor, source-language specialist, community adviser, rights reviewer, fiscal reviewer, and legal reviewer. Named people are assigned through authorized project administration, not invented in the plan. Software can enforce review prerequisites and preserve decisions; it cannot supply missing expertise by marking itself reviewed.

Do not let donation status or policy endorsement change research access decisions, review outcomes, search ranking, or editorial prominence. Public voices, oral histories, and advocacy endorsements have separate consent instruments. Material disagreement may remain published with scope rather than being removed to simplify the public case.

## 8. Research workflow, search, and collaboration design

### 8.1 Source intake and document handling

Support resumable uploads, individual and batch intake, bibliographic import, repository links, authorized API connectors, and human-reviewed acquisition requests. Implement source-site rate limits, conditional requests, retry budgets, and access-result logging. Never bypass blocked repositories by changing routes to defeat their controls. Repository search results are leads until the source object is inspected.

Uploads have explicit size/type limits, format sniffing, archive-bomb and traversal protection, antivirus where plaintext processing is authorized, isolated parsing, resource/time limits, and manual exception paths. E2EE ciphertext cannot be truthfully described as server-malware-scanned. Its client download/open path warns of that limitation and avoids executing embedded content.

IIIF, text, audio, video, tables, and datasets are presented through accessible viewers with precise citations. Originals remain immutable; transformations are recorded. External viewers and embeds are subject to consent, rights, tracking, availability, and sandbox policy.

### 8.2 Transcription and historical review

Keep diplomatic transcription, normalized text, translation, and interpretation in separate layers. Transcribers can mark uncertain characters, missing leaves, ditto forms, uncertain row alignment, corrections in the source, and illegibility. A second reader sees relevant witnesses and records disagreements. AI/OCR output is a draft with provenance, not an independent scholarly witness.

Claims require exact support scope and contrary evidence. Source independence is modeled so copied or derivative accounts do not become multiple confirmations. Review assignments enforce conflicts, claimed expertise, and separation between author and reviewer where required. The final decision can be support with scope, visible contestation, qualification, withdrawal, or documented inability to verify.

### 8.3 Collaboration and autosave

Use a mature CRDT-based collaboration layer, provisionally Yjs with a compatible editor, for concurrent draft editing where permitted by security classification. Yjs provides shared data structures and network-independent synchronization; authorization, durable persistence, review semantics, and encryption remain application responsibilities. [S10]

An edit is shown as durably saved only after a persisted acknowledgment. Proposed service target: ordinary online edits reach durable storage within two seconds at p95 under the declared test load. Interrupted/offline edits have a visibly different state. Local persistence is opt-in and encrypted or disabled for sensitive classes; shared-device mode prevents durable local content caching. Reconnection reconciles edits without silently accepting an unauthorized former member's updates.

Store immutable publication snapshots separately from live collaborative documents. Real-time presence is not an audit trail. Each publication binds to a stable text version and review set. Comment anchors can become unresolved after edits and must be repaired explicitly. Attribution and contribution histories respect pseudonymity, privacy, and consent.

### 8.4 Search architecture

Maintain a public search projection populated only from publishable versions. Public full-text, snippets, facets, suggestions, counts, maps, graph links, and assistant retrieval operate on that projection. Private search either executes policy-aware database queries or a separately authorized index with equivalent controls; filtering a global result set after retrieval is insufficient.

Represent advanced queries as a versioned, validated AST with bounded nesting, allowlisted fields/operators, explicit date semantics, resource limits, deterministic sort/tie-breakers, and cursor pagination bound to query and snapshot. Include original versus translated text, exact phrase, variants, exclusions, source/repository/type/language/status filters, uncertain time intervals, geographic bounds, and missing-field predicates. Query plans cannot become SQL strings assembled from user input.

Create a judged search set spanning misspellings, aliases, scripts, ambiguous names, contested entities, no-results cases, and exact source phrases. Proposed launch targets: at least 90 percent of exact-ID/source-title queries place the correct record first; at least 85 percent of the curated general-query set contains an accepted relevant result in the top five. Freeze the evaluation set per release; do not report these targets as measured until run.

Saved queries and exports record query version, data snapshot, filters, sort, access scope, and export schema. A saved query never grants permanent access to material later restricted. Private query titles and search terms must not leak through URLs, analytics, email subjects, or shared-browser history when they reveal sensitive subjects.

### 8.5 Reproducible analysis and assistant

Analysis runs use immutable authorized input snapshots, code/version manifests, deterministic seeds where relevant, resource ceilings, isolated execution, and reviewed output. Do not execute arbitrary researcher code inside the production web service or with production credentials. Untrusted notebooks use a hardened separately authorized execution service with egress restrictions; otherwise provide export/reproduction instructions without a false in-browser execution claim.

The optional assistant uses evidence-bound retrieval, exact citations, quote limits, visible uncertainty, a no-answer path, correction reporting, and evaluation sets for unsupported claims and leakage. Treat source text and tool outputs as untrusted data, never system instructions. Disable write-capable tools and arbitrary URL fetching by default. Test malicious instructions embedded in sources, metadata, and citations. Validate authorization before retrieval and again before response/export.

Sealed records never enter server-side prompts, embeddings, logs, or third-party providers. A user-selected public-only mode is the default. Provider retention/training settings, data-processing terms, region, rates, quotas, and budget ceilings require verification; do not assume a paid account or a vendor's no-training configuration. An outage or budget limit falls back to ordinary search without degrading access to evidence.

## 9. Security assurance and privacy program

### 9.1 Named standard reconciliation

PR work must obtain the canonical End-To-End-Everywhere document from its verified owner/repository, record its version/hash, identify mandatory controls and approved engines, and produce a control-by-control applicability/evidence matrix. Unknown controls remain `unassessed`; they are not marked not applicable by convenience. Any conflict with this proposed architecture produces an ADR and revision before affected production data flows are enabled.

Use OWASP ASVS 5.0.0 as an additional testable application-security reference, with a Level 2 baseline and risk-selected stronger controls. This is a project testing target, not ASVS certification and not a replacement for the user's standard. Version requirement identifiers, because identifiers can change between editions. [S11]

### 9.2 Threat model and abuse cases

Threats include unauthorized collection access, insider misuse, account takeover, malicious uploads, archive/parser attacks, source-site SSRF, cross-site scripting, CSRF, injection, link-preview leaks, cache leaks, signed-URL sharing, inference through facets/counts, malicious collaborative updates, forged review decisions, evidence tampering, data poisoning, AI prompt injection, webhook forgery/replay, supply-chain compromise, secret exposure, destructive migration, ransomware, domain/account loss, and politically motivated harassment.

Model harms to living people, descendant families, researchers, source communities, and public trust, not only infrastructure availability. Sensitive cultural access restrictions may differ from copyright permissions. Research authenticity and consent are security-relevant data, not decorative metadata.

### 9.3 Required controls

Use phishing-resistant MFA/passkeys for privileged roles where the verified identity engine supports them, short-lived scoped service credentials, server-side session revocation, safe account recovery, step-up authentication for sensitive actions, rate limits, and audited emergency access. Staff roles are never granted by an email-domain heuristic alone. Invitation and recovery tokens are one-time, expiring, and stored safely.

Apply strict content sanitization and CSP, trusted-proxy configuration, secure cookies, CSRF protection, origin checks on real-time connections, restrictive CORS, request-size limits, SSRF-resistant fetchers, anti-enumeration responses, constant-policy error behavior, and dependency/secret scanning. Handle SVG, HTML, office macros, PDFs, and archive contents as hostile until an isolated processing policy permits them. No browser-supplied MIME type or filename is trusted.

Key management requires an inventory, separate wrapping/data keys where appropriate, documented custody, rotation, revocation, recovery, access logging, and compromise procedures. Do not store encryption keys beside protected data with equivalent access. Cryptographic choices and lifecycle design follow verified engines and expert review; OWASP's storage and key-management guidance are supporting references, not proof of an audited design. [S12, S13]

Audit events are append-oriented and externally anchored where supported; hash chains alone do not prevent a fully privileged attacker from rewriting both data and hashes. Include detection and independent storage/custody assumptions. Do not log raw confidential text, credentials, family documents, private queries, signed URLs, or personal identifiers unnecessarily.

### 9.4 Retention, withdrawal, and incident handling

Define retention by record category, purpose, source conditions, and consent; publish plain-language choices. Do not invent a universal legal retention period. Use interim short retention for unaccepted submissions and analytics, with recorded review before expansion. Legal holds require verified authority and restricted handling; they do not silently permit broader publication.

Withdrawal/restriction propagation covers active databases, object variants, indexes, embeddings, caches, feeds, generated downloads, notifications, and queued jobs. Backups retain restricted copies until controlled expiry where deletion cannot be immediate; restored systems replay the restriction ledger before serving traffic. Public copies already downloaded by others cannot be guaranteed erased. Explain that limitation during consent.

An incident runbook defines containment, affected-object analysis, key/token revocation, service disablement, legal/privacy review, user notification decisions, restoration, evidence preservation, and post-incident corrective PRs. Do not run destructive tests or unsolicited penetration tests against third parties. Test only authorized environments and fixtures.

## 10. APIs, integration contracts, and interoperability

### 10.1 HTTP and event conventions

Use versioned APIs and OpenAPI/JSON Schema contracts. Route namespaces distinguish public published read models, authenticated research operations, administrative controls, integrations, and future governmental functions. Public URLs expose stable resource identifiers and optional readable slugs; version-specific citations remain resolvable after renaming.

Mutations support idempotency keys where repeated requests can duplicate work. Use optimistic concurrency with `If-Match`/version tokens for non-CRDT records. Return structured errors with safe user explanations and correlation IDs, not SQL or secret-bearing diagnostics. Bulk operations expose job IDs, item-level outcomes, cancellation, partial-failure receipts, and resumability.

Events carry `event_id`, `schema_version`, `aggregate_id`, `aggregate_version`, `occurred_at`, `actor_ref`, `classification`, and minimal payload. Delivery is at least once with idempotent consumers, ordering/version checks where required, exponential retry with jitter, bounded retries, dead-letter handling, and reconciliation. Do not claim exactly-once processing across remote systems.

### 10.2 Required integration inventory

| Integration | Required capability | Verification before enabling | Default while unavailable |
|---|---|---|---|
| GitHub | Repo read/write, PRs, checks, rules, mergeability, deployment evidence | Exact repository, app scopes, actor authority, branch policy | Local plan/package; no claim of pushed PRs |
| Engine Room | Register repo, import versioned plan, reconcile work/evidence/health | Actual schema/API, authentication, allowed writes, progress semantics | Durable local export; pending sync, not completed sync |
| Render | Authorized service deployment, logs, health, environment controls | Workspace/service IDs, resource plan, costs, deployment permissions | Local/staging definitions only |
| Neon | Isolated database, roles, migrations, restore, observability | Project/branch IDs, connection mode, extensions, retention, costs | Local PostgreSQL and synthetic data |
| Object storage | Private/public buckets, immutable originals, multipart, integrity, lifecycle | Provider, access policy, encryption, restore, egress/cost rules | Local synthetic fixtures; no private production upload |
| Identity | OIDC, MFA, sessions, recovery, revocation | Issuer/JWKS/audience/redirects, assurance, existing engine contract | Local test issuer only; no production sign-in |
| Key/security engine | Approved envelope/E2EE/device/recovery operations | Canonical standard and engine protocol/version | Sealed features disabled; no protection claim |
| Email/events | Transactional messages, consent, suppression, delivery callbacks | Sender domain, provider terms, quotas, permissions | In-app/local sink; no unsolicited sending |
| Payments | Authorized organization checkout/refunds/webhooks | Payee, financial/legal review, fees, approval | Donations disabled; informational funding page remains |
| Archives/IIIF | Lawful discovery and object access | Item-level rights, rate limits, API terms, availability | Record a barrier and use authorized cached evidence |
| AI | Read-only grounded answers within budget/privacy rules | Provider approval, contract, retention, cost ceiling, evaluation | Search-only mode |
| Analytics/monitoring | Privacy-minimized health and usability evidence | Retention, redaction, access, authorized destination | Local counters and synthetic tests |

Use adapters and consumer-driven contract tests. Do not share database credentials between unrelated products or tightly couple Engine Room's availability to a visitor's ability to read the atlas. An adapter package may be reusable; the Garden's research data remains owned by this product and its permissions.

### 10.3 Engine Room progress semantics

The repository contains a vendor-neutral intermediate plan manifest until the real Engine Room import schema is verified. Include project/repository identity, plan version/hash, all PR IDs, feature mappings, dependencies, applicability, effort weights, required evidence, release membership, blockers, and status. Never fabricate a server endpoint or report a dry-run export as a successful import.

Store GitHub PR number and URLs only after remote creation. Track checks against the exact head or merge-group SHA, merge commit, deployment ID/environment, database migration version, live test run, health observation, and timestamps. Separate `planned`, `in_progress`, `pr_open`, `checks_passed`, `merged`, `deployed`, `production_verified`, `blocked`, and `conditional` states. Documentation-only work has an explicitly different completion-evidence profile.

Display at least three measures: implementation merged, current-scope production verified, and conditional future scope. Weights are planning estimates, not time predictions; freeze them per baseline and log revisions. Superseded/split PRs preserve total weight so splitting work cannot manufacture progress. A blocked item remains in the applicable denominator; a conditional government item is separately visible until activated. Unknown health is unknown, not green.

The current package contains no verified remote implementation progress. The local plan's initial completion numerator is zero. That is not a claim about an uninspected existing repository; it means no remote task evidence was obtained for this baseline.

## 11. Autonomous PR execution and repository discipline

### 11.1 PR contract

Every planned PR specifies the user-visible or operational outcome, feature coverage, direct dependencies, risk/owner role, bounded implementation scope, data/API changes, acceptance criteria, tests, security/privacy impact, rollout/rollback, production verification, and evidence location. The global definition of done applies in addition to its specific tests. PR IDs are stable across revisions; GitHub numbers are attached later.

A PR is a reviewable integration unit, not an arbitrary sprint. Prefer one clear change with bounded rollback. Split a PR when it mixes independent trust boundaries, destructive migration with UI changes, or more than one unreviewable behavioral area. Preserve parent acceptance criteria and effort allocation when splitting. Do not pad counts with empty PRs or merge an incomplete acceptance set because its code compiles.

### 11.2 Execution loop

Read the repo's plan, AGENTS instructions, current evidence, blocked items, and actual branch state. Select dependency-ready work. For an external dependency, verify deployed contract/version where needed; a planned adapter is not a satisfied dependency. Create a branch, implement with tests, update relevant docs, and open a PR carrying the plan ID and evidence.

Run required checks on the exact candidate commit. Investigate failures, fix root causes, and rerun affected and regression suites. While CI runs, work on independent branches/worktrees with explicit schema/file ownership. Do not build dependent functionality on a broken or unverified base. Stacked PRs can exist as drafts, but dependency completion is not inferred from an open branch.

When GitHub confirms mergeability and all required checks/reviews pass, merge through the permitted method. Respect branch protections; do not bypass protections, dismiss required reviewers, forge approvals, or weaken checks to satisfy an autonomy instruction. If mergeability is unknown or a required check is pending, wait within the active execution session or continue independent work. Access, approvals mandated by policy, costs, or unavailable expert review are specific blockers, not ordinary coding decisions.

Use merge queues where the repository plan supports them. GitHub requires merge-group CI triggers for queue checks; private-repository availability depends on the actual account plan. Otherwise use protected-branch auto-merge or a serialized compare-and-merge loop with an expected head SHA and fresh checks. Do not assume a queue exists. [S14]

Deploy the merged artifact, apply approved compatible migrations, verify online behavior and permissions, capture evidence, update the plan/progress ledger and Engine Room, and immediately select the next ready work. A production incident interrupts ordinary work and triggers containment. No recurring scheduler or background-agent claim is created by this plan; extended work uses only capabilities actually available and authorized.

### 11.3 Required repository contents

The repository is sufficient for a new developer or agent to resume without this chat. It contains README, AGENTS, development plan, feature inventory, architecture decisions, source register, domain glossary, API/event schemas, data dictionaries, import mappings, security standard reference and crosswalk, threat model, credential requirements, local setup, fixtures, test commands, CI/check definitions, deployment/restore runbooks, evidence manifest schema, PR records, progress/Engine Room mapping, blocker log, and handoff instructions.

Record credential **requirements** only: purpose, owning service, environment, minimum scopes, provisioning/rotation method, storage location category, and access contact role. Never include token values, private keys, database passwords, real recovery material, or production cookies. Redact screenshots, logs, and test artifacts before repository publication.

Design decisions include rationale, alternatives, tradeoffs, status, and consequences. Source references include exact versions/hashes and access limitations. A public repository must not contain licensed archival files or personal records merely to make it self-contained; it contains synthetic fixtures, authorized public samples, acquisition manifests, and explicit access requirements instead.

## 12. Testing, quality thresholds, and acceptance evidence

### 12.1 Test layers

Use unit and property tests for pure state transitions, fiscal arithmetic, permissions, date intervals, record matching constraints, query ASTs, and version logic. Use integration tests against production-equivalent PostgreSQL roles and schemas, object storage, identity mocks/contract environments, queues, and collaboration transports. Test migrations on realistic-volume synthetic data and controlled read-only replicas only when explicitly authorized.

Use browser end-to-end tests for the main public, researcher, contributor, editor, moderator, and administrator journeys. Include keyboard and screen-reader checks, responsive layouts, reduced motion, high zoom, touch alternatives, error recovery, empty states, interrupted uploads, concurrent edits, withdrawn content, and third-party outages. Automated accessibility scanners supplement, not replace, manual complete-process testing against the WCAG 2.2 AA target. [S15]

Security tests include cross-collection access, expired/revoked sessions, unauthorized exports, worker rechecks, RLS pool leakage, signed URL policy, cache separation, object previews, webhook replay, unsafe file formats, parser isolation, SSRF, XSS, query complexity, secret redaction, E2EE server non-decryption, and assistant retrieval leakage. Record authorized test scope and retain sanitized evidence.

Research-quality tests are separate from software tests. They check precise source binding, identity non-inference, source independence, row/person distinction, original versus translation layers, generated-image labels, rights, and decision provenance. Specialist historical review is not replaced by a unit test or an AI's statement that a claim is true.

### 12.2 Proposed measurable service targets

These are initial design/test budgets, not promises about provisioned capacity. Confirm them under the actual authorized resource tier and representative content before launch; revise transparently if the budget and requirements conflict.

| Area | Initial acceptance target and measurement |
|---|---|
| Public page experience | Field p75 LCP <=2.5 s, INP <=200 ms, CLS <=0.1 when sufficient data exists; laboratory budgets and real-device tests before field data exists |
| Search latency | p95 simple search <=1.5 s and bounded advanced search <=3 s on a one-million-record synthetic corpus at declared 50 concurrent search clients |
| Public load | 100 requests/s representative mix for 15 minutes, p95 application response <=1 s for cached/read pages, <1 percent unexpected errors; capacity is verified only after test |
| Collaboration | 50 simultaneous active pilot editors across ten documents; p95 durable-save acknowledgment <=2 s; no lost acknowledged updates under restart/disconnect test |
| Availability | Initial monthly objective 99.9 percent for public read paths; measurement and exclusions defined, no uptime claim before monitoring evidence |
| Restoration | Metadata target RPO <=15 minutes and RTO <=4 hours; originals require verified durable storage before receipt, separate backup/replication policy; test full restoration |
| Restriction propagation | Access denial effective synchronously at authoritative gateways; public projection/cache withdrawal target <=60 s; external copies explicitly outside control |
| Accessibility | WCAG 2.2 AA target across complete in-scope processes; no unresolved critical/serious automated violations plus completed manual checklist |
| Publication integrity | Zero unpublished/restricted sentinel objects in public HTML, APIs, maps, facets, thumbnails, exports, feeds, logs, or assistant outputs |
| Source accounting | 100 percent of declared import-scope items have a recorded disposition; zero unexplained row/byte/hash discrepancies |
| Security findings | No unresolved required-check failures; no unmitigated critical/high release-blocking findings; lower-severity exceptions require owner, rationale, mitigation, expiry |

For retention of sensitive revocable media, choose private authorization-checked delivery rather than a long-lived public URL. No numerical cache target implies that already downloaded public copies can be withdrawn. RPO and RTO objectives depend on storage/provider capabilities and approved costs; inability to meet them is a launch blocker or a transparently revised requirement, not a hidden exception.

### 12.3 Evidence package per PR and release

Each evidence manifest includes plan/PR ID, requirement/test IDs, repository and commit SHA, implementation version, environment, migration and dataset fixture versions, test command/run URL, result, timestamps, reviewer role, sanitized artifacts, deployment identifier/URL, online verification, unresolved limitations, and file hashes. Local, CI, staging, and production evidence are labeled separately.

Do not record a screenshot as proof of an API permission control. Do not record a passing unit test as proof of a live deployment. Do not record a successful deployment job as proof that the correct database or keys were used. The evidence reader must be able to reproduce the relevant verification without access to this chat, while secrets and protected content remain outside the repository.

## 13. Deployment, migrations, recovery, and operational handoff

### 13.1 Environment isolation and cost control

Use local development with synthetic fixtures; ephemeral previews with sanitized/empty database branches; a stable staging environment; and production. Never branch a private production database into a broadly accessible PR preview. Previews from untrusted forks have no production secrets and cannot trigger privileged deployment workflows. Environment-variable schemas fail closed when required identities or policies are missing.

Record exact project/service/database/bucket identifiers and approved monthly/one-time resource ceilings before provisioning. Reusing an authorized paid service can still incur additional costs; confirm quotas and headroom. Automatic preview cleanup, bounded jobs, export size caps, AI budgets, storage lifecycle rules, and cost alerts are requirements. No cloud resource creation, paid API call, image licensing purchase, or new subscription is authorized by this document alone.

### 13.2 Deployment procedure

Build one immutable artifact from the tested commit and record its digest. Run schema compatibility and security checks. Acquire a deployment/migration lock. Apply backward-compatible expand migrations using the restricted migration identity. Deploy workers/services in the documented compatibility order. Verify readiness separately from liveness, including database connectivity, expected schema, storage access, key/identity configuration, and dependency health without leaking secrets.

Run post-deployment public and authorized smoke tests, publication-boundary sentinels, search/citation tests, and one reversible synthetic write where appropriate. Compare deployed SHA and migration version with the evidence manifest. Observe error, latency, queue, and permission-denial signals under the agreed soak criteria. Mark production verified only for the exact tested feature/environment state. Failed verification triggers rollback or feature disablement and preserves the previous known-good public publication.

### 13.3 Database and index migrations

Use expand -> dual-read/write only when necessary -> idempotent backfill -> reconciliation -> switch -> observation -> contract in a later PR. Backfills are resumable, rate-limited, monitored, and do not hold unbounded locks. Test old and new application versions against the migration window. Destructive changes require a rehearsed restore/forward-fix plan, not a casual reverse migration.

An application rollback does not automatically roll back the database. Prefer compatible schema evolution and forward fixes; restore is a controlled incident operation with declared data-loss boundaries. Search indexes are replaceable projections: build a new version, validate counts and sentinels, atomically switch aliases/pointers, retain the prior safe version for bounded rollback, and apply restriction tombstones to both.

### 13.4 Backups, preservation, and disaster recovery

Preserve originals with content-addressed keys and immutable manifests where supported. Keep metadata backups, object inventory, key-recovery procedures, configuration, and restore tooling under separate appropriate custody. Test corruption, truncation, missing objects, key unavailability, and loss of one provider. A successful archive upload is not a successful backup until exact bytes can be retrieved, verified, reopened, and restored.

Restoration order: recover authorized identities/key access; restore metadata and object references into an isolated environment; apply restriction/withdrawal ledger; verify schema and content hashes; rebuild projections; run access and reader tests; then switch traffic under a controlled approval path. A preservation copy does not grant permission to republish restricted content.

Maintain the stable current-document index after each successful release/checkpoint. Links update only after target storage and access checks pass. Preserve previous milestones, release notes, source manifests, and portable exports. Repository/domain/provider ownership and emergency contacts must be documented by role so continuity does not depend on a single chat or account.

### 13.5 Operational monitoring and maintenance

Instrument public availability, search relevance/latency, upload failure, import reconciliation, indexing lag, review bottlenecks, rights expiry, restriction propagation, email suppression, job retries, collaboration persistence, storage integrity, database growth, dependency failures, cost ceilings, and Engine Room synchronization. Dashboards distinguish user-visible availability from internal component health.

Provide a status page, support route, accessibility feedback, moderation escalation, maintenance notices, and incident histories. Avoid overly sensitive public infrastructure disclosures. Maintenance schedules and automated monitoring are application operations to be configured only in the authorized deployment context; this planning task has not created a recurring ChatGPT task or a running background process.

## 14. Governance, expert work, and content delivery dependencies

Software enables research; it does not finish every historical dossier. Track expert tasks separately from code PRs, with their own owners, evidence, access barriers, review rules, and budgets. The existing 104 named-roster dossiers, provisional sequences, rights issues, source-page bindings, and all-assertion review remain scholarly work unless separately completed and evidenced. [P04]

Maintain independent research and advocacy editorial policies, conflicts disclosures, advisory participation, attribution rules, appeals, and transparent correction procedures. Publication approvals involving rights, consent, legal claims, or specialist source interpretation require the appropriate authorized reviewer; these are substantive safeguards, not routine requests for the user to choose implementation details.

Community advisers can request restrictions, supply knowledge, dispute descriptions, and review representation. They do not automatically speak for an entire people or acquire unilateral authority over all scholarly findings. A disagreement record distinguishes factual correction, interpretation, naming, cultural sensitivity, privacy, and legal/rights concerns. Harassment reporting and confidential misconduct channels need separate access from public discussion.

Payment and donation functions remain off until organizational authority, payee details, provider terms, financial reporting, and applicable compliance review are verified. Research donations and policy advocacy spending are classified separately. Donors cannot purchase editorial outcomes, research status, citizenship, or commercial rights.

## 15. Conditional governmental extension

Reserve separate contracts and repositories for official roster procedures, enrollment evidence, appeals, duplicate founding-affiliation checks, nation certification records, opportunity registers, sealed ranked preferences, voluntary negotiation records, compact publication, and authorized nation portals. Treat the draft's time limits and rules as versioned proposed parameters, not current law or irrevocable constants.

Activation requires actual enacted text and current implementing rules, designation of the lawful operating body, formal system authority, approved data processing and retention, identity/eligibility standards, independent security assessment, accessibility review, tested appeals, dedicated credentials/resources, and verified integration with the responsible institutions. No single application administrator can turn private interest records into citizenship records.

An official roster entry and a research entity retain separate identifiers and explicit links. A historical correction does not automatically cancel citizenship, recognition, or a compact. Founding affiliation is not inferred from a surname, image, genetic profile, or search history. Duplicate enrollment checks reveal the minimum necessary status, not other communities' genealogical files.

Sealed preferences need a separately reviewed cryptographic ceremony, deadline authority, custody model, tamper-evident receipts, controlled opening, conflict rules, and documented failure/recovery procedures. The platform facilitates negotiation but cannot impose an allocation or manufacture an award. Binding online elections, judicial adjudication systems, policing, clinical operations, gambling operations, and regulated product sales are outside this website plan and require separate authorized product plans.

## 16. Delivery gates and completion definition

A current-scope feature is complete only when its applicable acceptance criteria pass; required tests and reviews have evidence; source/data migrations reconcile; user documentation is accurate; permission and privacy behavior is verified; the deployed version is identified; real user-facing behavior is tested online; monitoring and rollback are ready; and plan/Engine Room records reflect the actual state. A documentation PR can complete under its documented evidence profile without pretending to be a deployed feature.

Current-scope launch cannot be held hostage to future congressional enactment. Conversely, future governmental functions cannot be marked complete because a disabled screen exists. Research completeness and engineering completeness have independent progress bars. The overall project can reach operational release while continuing historical research under the charter, provided the public scope and limitations remain explicit.

The following sections contain the full feature-to-PR crosswalk, execution catalog, dependency graph, test/evidence requirements, risk register, and handoff package. All quantitative targets are proposed acceptance thresholds unless an observation is explicitly reported with preparation evidence.
