# GDN-135 AI-assisted source and threat review

17 October 2026. Scope: typed contribution program domain, private SQLite ledger, unmounted authenticated service/HTTP boundary, research guidance route and receipt panel. This is an AI-assisted implementation review, not an independent human audit, legal opinion, safeguarding approval or security certification.

## Findings addressed

- A program checkbox could otherwise become implied consent, interest, enrollment or endorsement. The implementation separates all participation objects and operations. Acknowledgment grants no content consent; submissions cannot write interests or memberships.
- Changed terms or responsibilities could otherwise silently reuse a stale acknowledgment. Every field of the versioned scope is digested, versions are immutable and successive, and new actions require the current exact version. The original research charter bytes and 25 September cutoff are pinned.
- A client-supplied operator claim could otherwise activate family collection. Operator installation has a separate privileged authorizer; authority comes from a trusted verifier and is matched to the exact scope, institution, capacity and validity period. No operator installation endpoint is exposed.
- New recordings could otherwise enter as ordinary uploads. The source adapter must independently classify already owned, completed quarantine material; new-interview and unknown classifications fail closed. No interview or outreach function is implemented.
- Another contributor could otherwise borrow an acknowledgment or receipt. All reads and relationships are checked against the current subject, workspace, program, version and digest. Tests exercise direct repository boundaries as well as the service.
- Opt-outs could otherwise become impossible when a program closes or changes terms. Status and interest withdrawal remain authenticated but do not depend on enabled intake, a live collection authority, or acknowledgment of newer terms. Withdrawals are immutable; replay cannot reactivate them.
- Partial writes or replays could otherwise duplicate participation. SQLite transactions include their minimal decision-linked event, ownership-bound IDs and uniqueness constraints. An injected audit-insert failure proves rollback of the attempted acknowledgment.
- Bounded responses and generic denials prevent unbounded history disclosure and provider-detail leakage. HTTP rejects mass assignment, unknown paths, oversized or malformed requests and cross-origin requests; no shared caching is allowed. Raw charter text is escaped by React.
- A corrupted terms record could otherwise be displayed with a trusted-looking digest. Current reads validate the exact version schema, baseline charter and recomputed digest before returning a summary.
- Root review found that intake closure during an asynchronous authorization check could be observed only at delivery after a write. The final audited admission now rechecks the feature state after upload and authority validation; a regression confirms no acknowledgment or event persists.
- Root review also identified SQLite sidecar recovery as an early file-open boundary. The repository now rejects WAL/SHM state and unsafe rollback journals, including dangling symlinks, before opening the database. Regression tests verify unrelated target bytes remain unchanged.

## Remaining real integration obligations

All authoritative identities and grants in tests are synthetic. The unmounted adapters must be implemented against actual verified membership, privilege, current authority/revocation, upload custody/classification, consent and audit systems before collection. A function returning a shape is not independent evidence of legal or operational authority.

The local metadata ledger is private by filesystem access, not encrypted or end-to-end encrypted. It must not hold actual participant records until the separately developed encryption/custody path and actual hosting are integrated. Startup schema checks and append-only triggers do not withstand an already privileged malicious database owner; no external audit anchoring or production backup restore was verified.

No messages, interviews, accounts, permissions, provider resources, historical corpus records or production data were created. GDN-135 does not alter the original historical charter, public visibility or remaining consent/rights requirements. External human review remains deferred follow-up under the owner's policy; absent human review is not used to block unrelated implementation.

## Audit-completion closure follow-up — 17 October 2026

Root review identified another asynchronous interval after the admission callback: `createAuditedDecision` rechecks identity and finishes its audit transaction before returning. Intake could close during that interval, allowing a contribution write before the later delivery gate denied the response. The real audited-decision wrapper reproduced the problem for version installation, acknowledgment, submission and interest registration at the identity recheck, audit insert and audit commit. The same tests demonstrated that program-authority or upload revocation during audit commit could also permit collection.

The service now refreshes current authority and submission upload evidence after the audited gate resolves. It checks intake after those asynchronous verifiers, immediately before dispatching to the existing synchronous repository. Status and withdrawal remain outside collection activation checks. No shared audit implementation, service interface, active adapter or HTTP mount changed.

The 16 new regressions use the actual audited-decision implementation, a capability-probed synthetic SQL pool and the real private SQLite contribution ledger. Before the fix, 14 collection tests failed and two read/withdrawal preservation tests passed. After the fix, all 108 focused contributor/audit tests and all 1,412 application tests passed, together with typechecks and syntax/boundary lint. Rejected collection makes zero contributor repository write calls and leaves all six ledger tables unchanged; withdrawal remains idempotent and receipts remain readable after closure. Exact source hashes and commands are recorded in `audit-closure-tests.json` without replacing the original acceptance or merge evidence.

An audit allow records admission, not execution: it may remain when the final collection refresh rejects the operation, while no corresponding program record or event is written. These tests do not establish live identity/provider operation or hosted acceptance. The final synchronous storage handoff is bounded by the existing repository contract; a future remote adapter must preserve its own authorization and transaction guarantees.
