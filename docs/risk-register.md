## 19. Risk register, blockers and acceptance responsibilities

All risks are planning risks, not claims that a particular incident has occurred. Each mitigation must be implemented and evidenced in the linked work.

### RISK-01 - Raw research accidentally published

**Impact:** Unreviewed claims or uncleared source images damage people and credibility.

**Mitigation:** Deny-first publication kernel; separate public projection; item-level review and rights.

**PRs:** GDN-034,043,124,191. **Owner role:** Release editor + security.

### RISK-02 - Repeated corpus truncation or hidden loss

**Impact:** An intact archive checksum can still contain a truncated database or export.

**Mitigation:** Read-back checks, reopen DB, logical row reconciliation and component packages.

**PRs:** GDN-044,045,048,183,184. **Owner role:** Data steward.

### RISK-03 - False historical identity joins

**Impact:** Names, ports, portraits or displaced rows can become false genealogies.

**Mitigation:** Typed entities, explicit hypotheses, independent review and reversible merges.

**PRs:** GDN-035,083,106,109. **Owner role:** Scholarly lead.

### RISK-04 - Security standard invented or misrepresented

**Impact:** Unknown canonical requirements become an unsupported compliance claim.

**Mitigation:** Pin actual source; proposed crosswalk only until independent verification.

**PRs:** GDN-003,026,190. **Owner role:** Security lead.

### RISK-05 - E2EE promise conflicts with server search

**Impact:** Server processing silently exposes supposedly sealed content.

**Mitigation:** Separate operating modes, recipient-controlled keys and plaintext egress canaries.

**PRs:** GDN-027,028,092,166. **Owner role:** Security architect.

### RISK-06 - Permissions leak through secondary surfaces

**Impact:** Facets, tiles, previews, exports, notifications or logs reveal restricted material.

**Mitigation:** Central policy plus per-path negative tests and minimal telemetry.

**PRs:** GDN-025,031,092,102,116. **Owner role:** Security + data.

### RISK-07 - Withdrawal incomplete or reversed

**Impact:** Old caches, exports, backups or rollback restore withdrawn material.

**Mitigation:** Origin deny ledger, derivative graph, deletion replay and honest public-copy limits.

**PRs:** GDN-032,126,139,184. **Owner role:** Privacy steward.

### RISK-08 - False fiscal promise

**Impact:** Intended repayment portrayed as guaranteed zero taxpayer cost.

**Mitigation:** Versioned model, failure cases, independent review, separate cost/tax effects.

**PRs:** GDN-069,070,071,076. **Owner role:** Fiscal/legal reviewer.

### RISK-09 - Unofficial site appears governmental

**Impact:** Visitors believe accounts or interest forms confer citizenship/rights.

**Mitigation:** Clear proposed status, no real enrollment before separate lawful authority.

**PRs:** GDN-060,066,197,201. **Owner role:** Product/legal.

### RISK-10 - Token or environment crossover

**Impact:** Unrelated products or previews share production access.

**Mitigation:** Resource registry, scoped credentials, synthetic previews and explicit cost authority.

**PRs:** GDN-012,013,020. **Owner role:** Platform lead.

### RISK-11 - Malicious archives or computational jobs

**Impact:** Uploads or notebooks compromise servers and data.

**Mitigation:** Quarantine, sandbox, egress block, resource limits and independent testing.

**PRs:** GDN-041,079,162,190. **Owner role:** Security/platform.

### RISK-12 - Scholarly review replaced by automation

**Impact:** Fast code/AI produces unearned verified labels.

**Mitigation:** Evidence-specific independent reviews and separate research/code progress.

**PRs:** GDN-108,111,165,171,176. **Owner role:** Research lead.

### RISK-13 - Public experience delayed by infrastructure scope

**Impact:** The main public-face requirement disappears behind years of backend work.

**Mitigation:** Explicit R1 closure independent of full import, advanced collaboration and AI.

**PRs:** GDN-051,064,076,192. **Owner role:** Technical/product lead.

### RISK-14 - Unavailable integration reported as working

**Impact:** Mocks, local files or stubs misrepresented as GitHub/Engine Room/production.

**Mitigation:** Contract tests, actual IDs/acknowledgments, separate progress and blockers.

**PRs:** GDN-004,019,177,196. **Owner role:** Delivery lead.

### RISK-15 - Unapproved operating expense

**Impact:** Storage, AI, previews, email or outside assessments incur new cost.

**Mitigation:** Authorization registry, quotas, disabled defaults and no automatic paid upgrade.

**PRs:** GDN-012,166,181,190. **Owner role:** Owner/operations.

### RISK-16 - Insufficient expert or moderation capacity

**Impact:** Open contribution channels expose families or accumulate harmful content.

**Mitigation:** Named program authority, staffing gate, limited pilot and pausable intake.

**PRs:** GDN-007,135,145,148,174. **Owner role:** Safeguarding lead.

### RISK-17 - Accessibility reduced to scan score

**Impact:** Complex research tools remain unusable despite automated passes.

**Mitigation:** Complete-task manual screen-reader/keyboard and participant review.

**PRs:** GDN-064,104,121,187. **Owner role:** Accessibility lead.

### RISK-18 - Sensitive-data political targeting

**Impact:** Family/research contributions reused for demographic persuasion.

**Mitigation:** Purpose separation, no ad pixels, no inferred profiles and audited analytics fields.

**PRs:** GDN-029,155,156,179. **Owner role:** Privacy/governance.

### RISK-19 - Public records lost when one account disappears

**Impact:** Project continuity relies on a chat, individual admin or proprietary export.

**Mitigation:** Stable index, portable verified packages, repo handoff and organizational account control.

**PRs:** GDN-075,183,185,186. **Owner role:** Operations owner.

### RISK-20 - Premature government activation

**Impact:** Software operates binding enrollment, allocation or adjudication without authority.

**Mitigation:** Separate product/repo, adopted law/rules, independent operator acceptance and sealed-process review.

**PRs:** GDN-197-210. **Owner role:** Authorized future operator.

### External gates and current access status

**X01 - GitHub repository access:** unavailable_in_this_session. Connected GitHub with authorized target organization/repository and required write/PR/check scopes. Never assume private account entitlement or bypass branch rules.

**X02 - Canonical End-To-End-Everywhere standard:** not_located. Actual controlled document/repository revision and reusable security engine contract. A proposed crosswalk is not canonical conformance.

**X03 - Engine Room integration:** contract_not_located. Actual endpoint/schema, authentication, project identity and permitted mutation contract. Proposed intermediate JSON remains unsynchronized.

**X04 - Render authorization:** not_connected_or_inspected. Authorized workspace/service identities, deployment rights, DNS ownership and budget. Do not provision new paid resources without authority.

**X05 - Neon authorization:** not_connected_or_inspected. Project-specific authorized resource IDs, roles, connection scopes, extension capability and recovery policy. No unrelated project database reuse.

**X06 - Storage, identity, key and notification providers:** discovery_required. Existing reusable engines or authorized providers, actual contracts, credentials by secret name, costs and privacy terms.

**X07 - Expert and community review:** assignments_not_verified. Qualified historical, source-language, rights, fiscal, legal, accessibility, safeguarding and independent security reviewers for relevant release gates.

**X08 - Incremental costs:** not_authorized_by_this_plan. Explicit authority for new hosting/storage capacity, email, AI, licensed images, payment processing and external assessments. Existing resources must be verified first.

**X09 - Full research artifacts and item rights:** partial_preparation_only. All four components and six current documents must be revalidated at import; only CORE byte/schema checks were performed in preparing this plan. Item rights and research review remain open.

**X10 - AI provider/data-processing authority:** unverified. Approved provider/model contract, retention/data handling, budgets, evaluation and permission-first retrieval. Disabled until satisfied.

**X11 - Payments and civic provider authority:** unverified. Authorized payee/legal organization, provider agreement, verified compliance disclosures and actual district/contact data for enabled services.

**X12 - Governmental authority:** conditional_future. Actual enacted law, implementing rules, authorized operator, dedicated funding/credentials and independent acceptance. No current enactment or authority is asserted.

### Definition of done applied to every PR

DOD-01: scope and acceptance criteria are implemented, or documentation artifacts delivered under their explicit profile. DOD-02: required tests and independent reviews pass on the exact commit. DOD-03: data/permissions/rights/consent and security impacts are verified. DOD-04: migrations are compatible and reversible or have a tested recovery plan. DOD-05: documentation, plan and integration contracts match implementation. DOD-06: actual deployment and user behavior are verified for application work. DOD-07: monitoring, rollback and operational ownership are present. DOD-08: GitHub and Engine Room record actual evidence; unavailable synchronization is reported as pending, never invented.

Expert approval of historical interpretation, image rights, consent, fiscal/legal statements and independent security is not a routine implementation decision to be fabricated by an autonomous coding agent. Seek necessary access or authorized expert participation while continuing independent work.
