# GDN-016: transactional jobs and outbox

PostgreSQL persists opaque references, classification, grant version and lease state. No source text, personal name, ancestry, token or credential belongs in a job. Sealed and sensitive-content payload classes are not supported. Authorization grants default revoked and must be managed by a future trusted identity/policy service, not browser callers.

Enqueue binds an idempotency key to the exact metadata tuple. A different tuple with the same key fails. Claims use SKIP LOCKED, limited batch/lease durations, bounded attempts, backoff and dead-letter states. A monotonically increasing lease epoch fences crashed or delayed workers. Revocation, scope/subject mismatch, grant-version changes and expiry are checked again during completion and event consumption. Cancellation does not silently requeue.

Completion writes the result reference, event outbox and successful status in one transaction. An interrupted transaction writes none of them. Consumer receipts have an event/consumer unique key; consumeOnce requires the receipt and database side effect in the same transaction. External APIs still need explicit idempotency and reconciliation; this is NOT a promise of exactly-once external effects.

The worker's NOLOGIN role can execute only selected security-definer functions with fixed safe search paths, not directly read queue/grant tables or enqueue work. No login credential, polling service, external scheduler or actual research handler is enabled by this PR. Handlers must honor abort signals and be idempotent under jobId. A handler that ignores its signal may finish late but cannot commit with an expired/replaced lease.

Verification includes parameterized-worker tests and real PostgreSQL fixtures for retry/collision, rollback, lost leases, grant revocation, stale versions, outbox deduplication, dead letters, cancellation and privilege escalation. The migration remains staged-only; production is denied by the runner. Runtime authenticated connection, actual workload concurrency, external integrations and independent security review are later acceptance gates.
