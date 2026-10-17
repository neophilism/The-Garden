# Record-level policy context - GDN-024

## Purpose and scope

An identity, a workspace membership and a record grant are distinct. An active member reads a record only when an explicit unrevoked record grant covers that subject, workspace, research purpose and current record. Unclassified, quarantined, withdrawn, licensed, personal, sealed and governmental records are denied by this first implementation even when a grant exists. They need their own later reviewed delivery capabilities. Public publication is a separate transaction and dataset.

`garden_private.record_envelopes` has ENABLE and FORCE ROW LEVEL SECURITY. Its owner has no read policy; a compromised migration owner can still alter DDL, so migration credentials are excluded from runtime, not declared harmless. The query role has SELECT and UPDATE(payload), not INSERT, DELETE, TRUNCATE, classification or ACL changes. An update requires both a writer role and explicit write grant. A database trigger increments the record version. The envelope is a bounded synthetic storage boundary; future domain tables require equivalent record policies and tests, not assumed inheritance.

## Two trusted server capabilities, not a writable identity GUC

A server-owned identity adapter obtains the verified subject. The context-issuer login may SET only the issuer capability, not the query, worker, publisher, administration or migration roles. The query login may SET only the research capability. Every checked-out connection is tested for dangerous role attributes and cross-capability membership before use. A changed session role or contaminated pool is rejected and its connection destroyed.

The issuer mints a short-lived opaque bearer ticket: two random UUIDs, hashed in the control table, with workspace, subject, membership version, operation, optional record scope, research purpose and thirty-second expiry. The query transaction can redeem, but cannot issue, a ticket. The binding lives in a private database table keyed by backend PID and transaction ID. Client `SET` variables cannot impersonate an identity. A transaction cannot switch bindings. Committed ticket replay is denied.

These roles reduce accidental privilege mixing; they do not make a fully compromised application server or a stolen issuer credential trustworthy. The issuer must not be exposed as a client-facing arbitrary-subject endpoint. Bearer tickets must never appear in URLs, logs, metrics, errors or response bodies. Different pools mean different least-privilege login credentials, not two pool objects sharing an owner password.

## Revocation and transaction semantics

At each READ COMMITTED statement, RLS checks current membership state, policy, membership version, role validity, record grant, classification, record state, ticket lifetime and purpose. Earlier data already returned to an authorized client cannot be recalled. A concurrent revocation does not retroactively cancel a completed database statement. Later delivery-path validation belongs to GDN-025. READ COMMITTED is the supported isolation level; this is not a promise about stale repeatable-read snapshots.

The executor revalidates the authenticated subject after the trusted repository work, clears its context, checks the database capability, and then refreshes the same verified subject again before COMMIT. After commit, connection release and issuer-ticket retirement, it refreshes identity once more before returning the buffered result. This covers observed identity closure during cleanup and retirement. Failures before COMMIT trigger rollback and discard results; failures after an acknowledged COMMIT suppress delivery without relabeling the committed write as rolled back. A failed rollback destroys the connection. A separate issuer transaction retires the ticket after commit or rollback. If a process crashes before retirement, expiry limits further use and the PID/transaction key prevents cross-transaction context reuse. In a rolled-back redemption the used flag also rolls back: the no-replay claim is for committed redemption, not a global distributed exactly-once guarantee after a crash. Expired control rows require a separately configured bounded cleanup procedure; no scheduler is created here.

Identity closure or a cleanup failure after successful COMMIT is an indeterminate delivery outcome: return no protected result, do not assume the write rolled back, and do not blindly retry non-idempotent writes. Later operation IDs and audit controls must preserve this distinction. These identity refreshes do not make an external identity service and PostgreSQL atomic, do not add a last-instant database grant/consent check after retirement, and do not establish delivery-tombstone serialization.

## Outer workspace transaction gate

The trusted `createPolicyExecutor` acquires the existing **exclusive transaction advisory lock** before binding its policy context:

```sql
SELECT pg_advisory_xact_lock(144729,hashtext($1::text))
```

The parameter is the server-validated, normalized workspace UUID. Consent administration, scoped-review mutations and encrypted-content authorization already use this key. The gate is a coordination lock, not a permission decision: membership, grants, classification, consent, scope and ticket expiry still require their existing checks. It creates no context, endpoint, tombstone or provider activation.

The order is issuer transaction commit and release; research transaction begin, role/capability and timeout setup; workspace gate; policy binding; repository graph/record work; existing identity and cleanup checks; main COMMIT or ROLLBACK; connection release; issuer retirement; final identity refresh. The issuer therefore holds no unfinished mint transaction while the main transaction waits. A gate waiter has not yet locked the ticket row, so its subsequent binding checks the current ticket and membership using the existing SQL. A gate error follows the same rollback, connection-destruction and ticket-retirement paths as other transaction failures. No separate advisory unlock is issued: PostgreSQL releases this lock at transaction end, before issuer retirement.

For typed source writes, this establishes workspace gate → source-graph advisory lock → record locks. Review functions can reacquire the same exclusive transaction lock on their existing connection. Do not change the outer gate to a shared lock and then upgrade inside existing functions. Concurrent work in one workspace is serialized for the whole trusted transaction; unrelated workspace keys remain independent, although PostgreSQL's existing `hashtext` key can conservatively collide.

Trusted repository callbacks must use their provided transaction and must not await a second same-workspace gated transaction on another connection. In particular, awaiting consent withdrawal inside a research callback would wait on the research transaction itself. Concurrent withdrawal instead completes after the earlier gated transaction ends; a later research transaction observes the withdrawn permission. Direct owner updates that do not use this coordination key retain their existing next-statement RLS behavior. Long callbacks can delay consent administration; the existing five-second statement and ten-second idle-transaction timeouts remain unchanged.

This is an application-executor prerequisite for later lifecycle work. It does not change `bind_policy_context`, serialize arbitrary SQL callers, prevent an owner from bypassing the fixed host, enumerate retained dependencies, implement record tombstones, or remove material. The absence of a last database authority check after issuer retirement also remains explicit. A future tombstone transaction needs its own always-on SQL denial, compatible lock order, independently authorized metadata context and final delivery admission.

## Evidence, rollout and recovery

`tests/access/policy-context.test.mjs` tests policy-executor rejection, connection destruction, cleanup and identity changes. `apps/research/access/rls.ci.mjs` exercises actual PostgreSQL with disjoint non-owner logins, ten role types on one reused backend, no-context/GUC spoofing, write restrictions, owner and worker denial, revocation, ticket expiry/replay, rollback and cleanup. The additional `tests/access/policy-identity-boundaries.test.mjs` covers 18 cleanup/commit/release/retirement and identity-outage cases. Six added PostgreSQL groups distinguish actual rollback from committed writes when the synthetic identity adapter closes at those boundaries. Synthetic records are marked as such. Identity-lifecycle CI records source-bound observations; [the identity-boundary evidence](../evidence/GDN-024/identity-boundary-tests.json) preserves the local checkpoint and links the later verified PR68 merge and actual 39-group PostgreSQL result.

`tests/access/policy-workspace-gate.test.mjs` adds ordering, pending-lock, cancellation/rollback, failed-rollback and issuer-commit tests. Run it with the two existing policy suites:

```sh
node --test tests/access/policy-workspace-gate.test.mjs tests/access/policy-context.test.mjs tests/access/policy-identity-boundaries.test.mjs
```

`apps/research/access/policy-workspace-gate.ci.mjs` is an acceptance journey for the disposable PostgreSQL CI service, after checksum-verified migrations. It observes exact backend waits with `pg_stat_activity` and `pg_blocking_pids`; tests source ordering against actual consent, review and encrypted-preparation transactions; checks ticket, record-grant and natural consent expiry after waits; exercises cancellation and membership changes; and verifies lock release before retirement without mislabeling a committed write when final identity delivery fails. Its loopback/environment guard refuses other database targets. Synthetic key catalog handles exercise SQL admission only; no key provider or encryption operation is called. The existing consent journey also uses an observed two-transaction withdrawal race instead of awaiting a competing transaction inside its blocker.

The new PostgreSQL journey is **unverified until its required CI actually executes**. On success it writes `data-evidence/policy-workspace-gate-results.json` with the tested SHA and explicit false tombstone, erasure and production claims. Local unit or source checks cannot substitute for that receipt. The CI database owns the retained synthetic fixtures; the journey does not disable immutability, delete its history, or reuse a retained cloud database.

No public endpoint, real researcher account, cloud schema migration or private corpus is activated. The existing production-denying migration runner remains unchanged. Deploy only to an authorized synthetic test environment after all required exact-head CI passes; perform independent security and actual hosted TLS/login/pool verification before sensitive data. Roll back activation/application code while retaining successful records. Do not bypass FORCE RLS or delete research to make a test pass.

References: PostgreSQL 18 row security, transaction identifiers, and built-in binary SHA-256 functions are upstream interfaces; see https://www.postgresql.org/docs/18/ddl-rowsecurity.html , https://www.postgresql.org/docs/18/functions-info.html and https://www.postgresql.org/docs/18/functions-binarystring.html . Upstream documentation is not certification of this implementation.
