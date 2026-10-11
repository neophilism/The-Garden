# Workspace audit ledger (GDN-030)

## Scope and activation

This is a disabled-by-default backend capability, not a public log, live endpoint, compliance certificate or full disaster-recovery system. A checksum-locked additive migration installs workspace-scoped audit tables, triggers, RLS and role capabilities. Application integration must supply explicit activation, a current identity verifier, distinct issuer/auditor pools and a separate decision-writer login. No contributor is granted an auditor role by this migration. Existing ordinary invitations cannot issue that role.

Audit events are private operational metadata even when their contents are pseudonymous. Do not ship them to public search, analytics, AI, error reporting or Engine Room. Engine Room receives development/health evidence, not participant events. The separately protected identity-to-alias mapping is not included in exports. Transport and provider storage protection are not end-to-end encryption; do not place sealed content or its keys in any of these tables.

## Event attribution and content limits

Each event has a fixed schema, random event/request identifiers, workspace, sequence, UTC time, actor kind/alias, subject kind/reference/revision, registered action, outcome and reason code. Fixed codes express categories, not a free-form explanation. Records, permissions, revisions and source references remain in their separately authorized systems. No document text, old/new payload, password, session token, email address, IP, user-agent, consent narrative, private key or error string is copied into the ledger.

Verified research writes use the current transaction-bound policy subject. Administrative SQL operations without a proven person identify the database-role alias instead of guessing a human from an old `issued_by` field. Consent and reviewer-assignment functions bind their already-authorized actor input. Workspace-specific aliases prevent direct export-level linkage of the same subject across workspaces; an authorized mapping custodian can still attribute actions. Mapping custody and access procedures require an independently reviewed operational implementation.

The request identifier ties events in one transaction together. Explicit use-receipt IDs are preserved for authorized correlation. SQL-trigger events record committed activity. `createAuditedDecision` records a trusted backend authorization decision and explicitly returns `operationPerformed:false`: admission is not proof that a mutation ran or a publication occurred. An audit failure prevents returning an allowed decision. Consumers must bind subsequent operation/transaction evidence independently.

## Covered writes and deliberate gaps

Triggers cover record revisions, purpose-policy revisions, consent grants and withdrawals, use receipts, workspace/member/role changes, record grants and reviewer assignments. Audit exports record their own access. Future publication/review decisions must use their domain transaction adapters; this release does not fabricate events for unimplemented features. Historical writes before installation have no inferred audit history. Global consent-term definitions are not claimed workspace-audited. Login/password/passkey internals remain in the identity trust domain; no identity secret is mirrored here.

Reason/subject/actor schemas are closed in SQL and the offline verifier. New actions require a reviewed schema change and matching tests. An authorizer cannot inject arbitrary free-form data through a registered enum. Aliases and record IDs remain pseudonymous personal/operational metadata, not anonymous data.

## Integrity and concurrency

A per-workspace locked head assigns each committed sequence number. The append and source change occur in the same transaction. A rollback advances neither the chain nor its head. Concurrent writes serialize at the head, and bounded transaction timeouts prevent indefinite waiting. Cross-workspace operations should acquire workspace locks in a deterministic order and retry aborted transactions idempotently; this module does not conceal deadlock failures.

The SHA-256 input is exact UTF-8 bytes:

```
garden-audit-v1\nWORKSPACE\nDECIMAL_SEQUENCE\nPREVIOUS_HASH\nEXACT_EVENT_TEXT
```

Event JSON text is retained exactly as emitted by PostgreSQL. Do not reserialize it before checking hashes. Sequences and versions are decimal strings to avoid JavaScript integer rounding. The verifier checks schema, identity, adjacency, previous/current hashes, duplicated identifiers and sizes. Normal UPDATE, DELETE and TRUNCATE are denied; append-only triggers also reject ordinary owner mutations.

**This is tamper-evident, not owner-proof.** A privileged database owner can disable protections and rewrite a whole chain. Detecting a complete rewrite or removed suffix requires a previously trusted checkpoint held outside the database's administrative boundary. The code supports comparison with such a checkpoint; no independent anchoring/signing service is configured or claimed. A checksum does not establish truthful attribution by a malicious operator, trustworthy wall-clock time, or historical completeness.

## Access and exporting

An auditor needs current verified identity, fresh GDN-022 passkey assurance and an active workspace `auditor` grant. Administrator/editor roles do not implicitly include audit access. Audit-read and append-decision capabilities have different noninheriting logins. The read pool cannot read the identity map or write historical events; the decision pool cannot read the ledger. Both are disjoint from content, migration, worker and administrative capabilities.

Audit policy tickets are one-use, short-lived and bound to a PostgreSQL backend/transaction. Their action/purpose is `audit`, not `research`. A caller-set SQL configuration value is not authority. Membership, expiry, revocation and assurance are rechecked before commit. Page errors are generic; they do not distinguish hidden records from absent ones.

Exports use a pinned through-checkpoint and keyset cursor. A new export event does not extend an already pinned pagination target forever. Each page has at most 1,000 entries. Event bytes are immutable; newer requests and grants still require live authorization. The service does not grant raw database access or provide its own HTTP route, cache or permanent download URL.

## Offline inspection and restoration

`node scripts/verify-audit.mjs --export rows.json --checkpoint trusted-checkpoint.json` verifies up to 10,000 rows from genesis to the supplied endpoint. Larger exports can be checked in segments with `--start trusted-start.json`; both boundary checkpoints must be independently trusted. Input files are bounded, symlinks/URLs are refused, no network or SQL is used, and output excludes event contents. The checkpoint file must not simply be copied from the same untrusted export header.

Preserve audit events, heads, aliases, request correlation and schema identities together in authorized encrypted backups. Restore into an isolated target; compare exact rows and hashes to independently retained checkpoints before enabling writes. Inconsistent history is quarantined, not repaired by overwriting hashes. The CI reload is a component-level SQL snapshot/reload, not pg_dump/PITR/full-system recovery evidence. Full backup, retention, custody, alert routing and independent anchor verification are required before operational acceptance.

Audit retention has privacy and legal consequences. Do not allow general runtime users to remove old aliases or events, and do not invent deletion guarantees. Correlation rows retain transaction/request identities; their volume and any approved archival cleanup need operational budgeting. Never let a log-retention job discard consent withdrawals or falsify an intact chain.

## Rollout and rollback

Apply only the new checksum-locked migration on an explicitly authorized target. Ordinary runtime logins never migrate. Verify all role memberships, RLS and fixed functions against the generated schema. Existing production data must be backed up, reviewed and staged before applying. Initial activation must record a checkpoint, test corruption alerting and ensure storage growth/availability cannot silently drop events.

To roll back, disable export/decision adapters and stop affected writes if necessary. Preserve the installed append-only history and its source versions. Do not execute a destructive down migration, erase inconvenient audit rows, reclassify a revoked role or silently allow unaudited sensitive actions. Compatible older application writes may still trigger the additive audit; verify compatibility rather than assuming it.

## Evidence

Local tests cover chain tampering, forbidden payloads, finite bounds, independent checkpoint limits, current auditor admission, role isolation, recovery after errors and ticket cleanup. Real PostgreSQL CI covers triggers, RLS, concurrent appends, rollback, deliberate synthetic-owner corruption and component reload. The identity fixture there is explicitly synthetic; actual passkey cryptography is exercised in GDN-022's separate real-browser journey. No independent review, cloud migration or production acceptance is inferred from either suite.
