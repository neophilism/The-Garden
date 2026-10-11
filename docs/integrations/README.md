# Integration verification and credential requirements

No provider connection is established by this document. See `plan/blockers.json`. `engine-room-proposed.json` is explicitly not the actual Engine Room API.

## Verify before reusing an engine

Resolve the authorized owner/repository/service ID, supported version, authentication scopes, operations, schemas, rate limits, data processing/retention, error behavior, costs and health interface. Pin contract fixtures and run consumer tests. Record actual positive and negative results. A mock is useful for development but is never an integration success.

## Credentials and access

Use `.env.example` for names only. Store values in the authorized secret manager or provider environment. Public and research apps get different database users and bucket scopes. Migration credentials exist only in controlled jobs. Do not export secrets into preview apps, fork builds, logs, Engine Room events, issue descriptions or evidence screenshots. Never infer that another Render or Neon project is authorized merely because it is reachable.

## Provider-specific activation records

For GitHub: exact organization/repository, permitted actor, PR/check scopes, ruleset, mergeability and queue availability.

For Render: workspace/service IDs, authorized plan, build/start/health commands, region, autoscaling/cost limits, pre-deploy entitlement, deployment and rollback proof.

For Neon: project/environment/branch IDs, runtime and migration role names, TLS and pooling configuration, tested extensions, recovery window, backup policy, key requirements and costs.

For storage: bucket IDs, public versus private access, multipart limits, encryption/keys, versioning, checksum/restore tests and egress costs.

For identity: actual issuer/JWKS/audience, callback URLs, MFA/passkey/recovery policy and provider outage behavior.

For email: approved sending domain, SPF/DKIM/DMARC configuration as applicable, webhook authenticity, suppression, quotas and cost approval. No email sending is authorized by a blank environment variable.

For payments: authorized operating organization/payee, hosted checkout, fees, webhook signature/replay protections, refund path and verified disclosures. The app must not store card data.

For AI: authorized provider/model, contract and retention/data processing, region where required, cost ceilings, read-only tool list, evaluation set and egress limits.

## API conventions

Use versioned `/api/v1` routes, validated JSON, stable opaque IDs, request IDs, documented errors and cursor pagination. Never accept caller-provided tenant/role/classification as authorization truth. Mutations use idempotency keys where retries are possible and version preconditions for concurrent edits. File access uses policy-gated short-lived references. Long jobs return a job ID and explicit state; completion requires durable output checks. Sealed content has a separate ciphertext-only contract.

## Event and contract versioning

Outbox events identify schema, source record/version and classification without embedding sensitive content. Consumers recheck permission at execution, reject unsupported schema, deduplicate and retain safe failure records. Reconcile reordered webhook events against source revision. No public site request should block on Engine Room availability.

## Verified discovery snapshot (2026-10-10)

See [integration-inventory.json](integration-inventory.json). GitHub, Neon and Render are connected, but a provider connection is not a live deployment or an Engine Room write. The Garden has its own empty Neon project/branch and no Render service; no database migrations, private buckets, or Neon Auth integration exist. Render's available create-service tool does not accept an explicit project ID, so placing a service inside the owner-specified Render project requires a project-aware method or separate provider verification. All other services in the shared workspace remain out of scope.

The actual Engine Room repository describes automated import from `.exechub/project.yml` and an explicit `.exechub/approved-pr-mapping.json`. The manifest in this repository uses all 210 approved units, with 196 active and 14 conditional. Only actual GitHub PR IDs #2, #3, and #4 are mapped; PR #1 is bootstrap only, while PR #5 is still open. Engine Room's independent readback remains pending and must not be reported as already synchronized.
