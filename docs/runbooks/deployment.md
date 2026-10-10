# Deployment and promotion runbook

Status: planned procedure; no application deployment has occurred in this package.

1. Verify target Render/Neon/storage/identity resource identities, authorized costs, environment boundaries and required provider contracts. Record IDs, never secret values.
2. Build immutable artifact from the exact checked commit. Verify provenance, dependencies, tests and required reviews. Public and research apps receive distinct secret scopes.
3. Snapshot and verify backup for affected data. Run migration compatibility tests against current schema and synthetic/authorized staging snapshot. Use expand-contract and serialized migration lock.
4. Run approved migration through the verified provider's supported path. Confirm Render pre-deploy availability; do not assume paid features are available. A deploy failure does not undo schema changes.
5. Deploy staging and run health, authentication, public/private access, key service, outbox, source viewer, collaboration and release-specific journeys. Identify actual SHA and URLs.
6. Inspect redacted logs and metrics. Run withdrawal/revocation cases. Verify rollback to compatible application artifact without resurrecting withdrawn content.
7. Promote the same artifact digest to authorized production. Activate only features whose provider/content/security gates are satisfied. No raw corpus is exposed by launch.
8. Run external live smoke and negative-access checks. Record screenshots where appropriate, actual provider deployment ID, schema migration IDs, test timestamp and outcome.
9. Update evidence, plan status and Engine Room. If synchronization fails, retain local evidence and mark sync pending. Do not report production verified until real checks pass.
10. Observe deployed health under configured ownership. Regressions reopen affected work. Stop destructive changes, contain failures and continue unrelated work only when safe.

Rollback means a tested compatible application/projection change. Never automatically run destructive down migrations after a failure. Restore only into an isolated target first, replay current consent/deletion/revocation state, reconcile and authorize promotion. No application admin can turn on government modules without separate lawful authority.
