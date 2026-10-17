# GDN-135 contributor program: operating contract

Status: implemented for local synthetic verification; authenticated intake is **unmounted**. No production collection program, consent approval, interview, or notification is claimed.

## Components

| Component | Responsibility |
|---|---|
| `packages/domain/src/community/program.mjs` | Strict version, purpose, authority, acknowledgment, source and receipt contracts; pinned original research charter; exact scope digest |
| `services/workers/src/contribution-program-repository.mjs` | Durable private SQLite ledger, owner/workspace isolation, immutable versions and participation events, transactional receipts and withdrawal |
| `apps/research/community/program-service.mjs` | Audited verified-session decisions, current membership/purpose checks, operator assurance, authority and upload revalidation, bounded HTTP adapter |
| `apps/research/components/ContributorProgramPanel.tsx` | Accessible exact-version guidance and already-authorized receipt presentation; no collection or network requests |
| `apps/research/app/contribute/page.tsx` | Actual research application guidance page with no configured operator or intake actions |

The accompanying `.d.mts` interfaces provide typed integration contracts. The panel receives only a safe summary and a bounded selection of the current viewer's activity. Do not pass raw authority metadata or cross-user receipts to it.

## Required trusted adapters

Construct `createContributionProgramService` in server code only. Never accept these dependencies or a principal from HTTP.

1. `decisions`: the verified-session, durable audited decision interface from GDN-025. Failure to write an allow/deny decision denies the operation. It must verify current identity, not trust a forwarded account or role claim.
2. `authorize`: current workspace membership and operation/purpose authorization. `contribution:submit` requires the actual contributor capability and current permission for the exact upload ID. `contribution:status` exposes only that viewer's receipts. Interest and its withdrawal are distinct actions. Do not turn these actions into automatic membership grants.
3. `authorizeOperator`: independent check for a scoped program administrator and recent privileged authentication. A verified email alone must not install program terms.
4. `verifyAuthority`: lookup and independently verify the actual operator-approved authority evidence by authorization ID, workspace, program, exact text/scope digest, and version. Its response must confirm the responsible institution, effective dates, response capacity and actual approval evidence. Recheck revocation at each call; never echo supplied request values as proof. The stored record alone is not current authority.
5. `verifyUpload`: resolve the exact owned, completed, quarantined GDN-077 upload in the current workspace and return its trusted collection classification. No missing classification defaults to existing material. Reject new interviews and unknown collection origins. File bytes, filenames and provider keys never enter this ledger or its receipts. GDN-029 consent, rights and source review still govern subsequent use.
6. `enabled`: live intake feature state, default `false`. It closes every collection action. Authenticated status and interest withdrawal remain available after closure and do not require renewed authority or a new acknowledgment. The identity/audit service must remain available for those paths.

No adapter supplied in the tests is suitable for a live program. Tests use an explicitly fictional institution and authorizer. Server operator and source-classification verification are material activation obligations, not optional flags.

## Version and state semantics

`installVersion` is a server operator method, not an HTTP path. It stores successive versions starting at 1. A repeated identical version and authority is idempotent; changed or skipped versions fail. No update or delete is supported. The SHA-256 includes program identity, version, exact charter text, title, institution, sorted purposes, baseline charter reference, and closed interview state.

`acknowledge` requires the exact current version and digest plus an explicit `acknowledged: true`. `submit` and `registerInterest` require the caller's matching acknowledgment and an independently allowed purpose. Their receipts explicitly state that the operation did not enroll, endorse, publish, or change researcher membership. A submission does not register interest; an interest does not submit a source.

Submission identity, the owned upload reference and participation ID are idempotent. A second submission ID for the same owned upload/program is refused rather than creating duplicate review work. Only one interest registration can be active for a subject/program at once. A withdrawal creates a separate immutable record; replaying a withdrawn interest returns its withdrawn state.

Status returns the current full version, current acknowledgment, and up to 20 newest submissions and 20 newest interests belonging to the subject. `hasOlderSubmissions` and `hasOlderInterests` identify truncation. The ledger retains older receipts, but this initial interface has no history-export or staff browse route. Do not represent the bounded view as a complete export.

## Storage and audit boundary

Create a `0700`, owner-only, non-symlink directory outside the checkout and any publicly served tree. `createPrivateContributionProgramRepository({root})` creates `contribution-program.sqlite3` with mode `0600`, foreign keys, full synchronous commits and transactional schema version 1. Existing symlinks, multiply linked files, wrong ownership/mode and unknown schema versions are refused. The same checks apply to a rollback journal before SQLite can open it; unexpected WAL/SHM files are rejected. Startup compares the exact schema, indexes and immutability triggers. Use a separate directory for each isolated operator/test instance; do not copy the ledger into Git or static website artifacts.

`contribution_program_versions`, `program_acknowledgments`, `contribution_submissions`, `program_interests`, `program_interest_withdrawals` and `program_events` are append-only. Successful writes and their decision-linked events commit atomically. Bounded authenticated reads also pass the external audited decision gate. The minimal event contains subject/workspace/program identifiers, action kind and decision ID; it contains no contact address, uploaded content, consent narrative or provider error.

SQLite here provides a local durable implementation consistent with GDN-085. It is not a hosted multi-tenant access-control service or an E2EE claim. Encryption, production custody/backup, retention and multi-process deployment must be integrated and verified before storing actual participant records. An active malicious database owner remains outside the local process security boundary; immutable triggers are not a cryptographic external audit anchor.

## HTTP boundary

The unmounted handler allows same-origin JSON POST requests of at most 4,096 bytes. It rejects unknown fields, methods, queries, mismatched origin, malformed JSON, invalid UTF-8 and unknown endpoints. The body is exactly `{workspaceId, input}`. Responses are private/no-store, vary by Cookie and Authorization, and use a generic denied error. Authority details and source-classification flags cannot be supplied by a caller.

Supported future paths:

- `/api/research/contribution/status`
- `/api/research/contribution/acknowledge`
- `/api/research/contribution/submit`
- `/api/research/contribution/interest`
- `/api/research/contribution/withdraw-interest`

Today all these application routes remain absent. The guidance page does not mount the service. There is no installation, outreach, interview, enrollment, endorsement or publication path.

## Verification

Run the focused behavior suites with Node 24:

```sh
node --test tests/data/contribution-program.test.mjs tests/access/contribution-program.test.mjs
npm run typecheck
node tools/quality/lint.mjs
npm run build:research
```

The two behavior files are already covered by root `npm test`. The browser suite `tools/quality/browser/contributor-program.spec.mjs` runs against the actual `/contribute` route and synthetic authorized receipt states. It exercises mobile/desktop layout, keyboard access to complete terms, stale acknowledgment messaging, DOM escaping, disabled collection APIs, and axe. The ordinary quality workflow picks it up automatically.

For a separately authorized private pilot, bind evidence to the actual commit, service ID and URL: verify a real verified contributor's current-version acknowledgment, private upload-reference submission, separate opt-in, and withdrawal after closing intake. Repeat wrong-owner, expired/revoked authority, changed-terms and new-interview rejection cases. Inspect successful-write audit events and retained withdrawals. Record actual credential presence by secret name only. No real pilot was performed by this PR.

## Rollback

Close `enabled` to stop new collection. Keep verified read/withdrawal processing available. Revert to the prior compatible application without destroying the ledger or original upload storage. Retain all versions, audit events and withdrawals. Reconcile a request that committed before a later delivery-denial using the same ID; it must not create duplicates. Do not run destructive down migrations, replay subscriptions as new consent, or use stale authority to reopen a program.
