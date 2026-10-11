# GDN-012: environment, secret and spending boundaries

## Authority and observed resources

The owner supplied Render project `prj-db57f92jnfac739ghic0` and Neon project `royal-union-78374030`, production branch `br-curly-band-b5aatp1e`. Authenticated Neon inspection found the empty `neondb` database and the two endpoint hostnames recorded in `config/resource-registry.json`. No application role, staging branch, Render service or spending approval has been inferred. The Render connector requires explicit workspace selection; Phillip's workspace has been offered to the owner but not yet confirmed in this session. Project-aware service placement remains unavailable through the present tool.

`plan/runtime-targets.json` preserves provider observations. `config/resource-registry.json` is the versioned build/runtime binding authority. Neither contains credentials. Future changes must reconcile both. Blank service/role/staging bindings intentionally prevent activation.

## Enforced entry points

Both `apps/public/next.config.mjs` and `apps/research/next.config.mjs` invoke the server-only configuration validator. Next.js loads these for development, builds and server startup, including direct workspace commands. The exact build-only import is the sole exception to the public-app relative-import lint rule; public route modules cannot import the validator. Its host identifiers and environment access are not serialized into page content.

Run `node scripts/check-environment.mjs public` or `research` for a safe diagnostic. Output is environment, surface and enablement only. Configuration failures use fixed error codes, never rejected values or raw URL errors.

Local and CI default to their respective isolated modes. A Render environment must explicitly set GARDEN_ENV; NODE_ENV=production and CI=true are not evidence of deployment identity. Allowed names are local, ci, preview, staging and production. Credentials are environment-prefixed; populated credentials from a different environment fail closed. Managed staging/production reject unscoped aliases. The public app rejects private configuration entirely. Disabled research rejects credentials instead of silently ignoring them.

A future reviewed research activation additionally requires exact project, branch, host, database and application-role bindings. Managed PostgreSQL connections require verify-full TLS and reject unrecognized/duplicate options, mismatched roles, ports and hosts. These are configuration checks, not a claim that a provider connection, TLS negotiation, role permission or application feature was verified. Local/CI connections are loopback-only. No nonproduction binding may reuse the production branch. Preview research, government, donation and assistant activation remain denied.

## Secret names and delivery

`.env.example` lists empty environment-qualified names. This supersedes earlier planning examples using generic RESEARCH_DATABASE_URL or IDENTITY_CLIENT_SECRET aliases. Service-specific credentials must come from the correct provider's secret store, be independently scoped and rotated, and never enter public app environments, GitHub source or CI reports. A reference to a review artifact is not itself an independent review; actual activation still requires the applicable security and research workflow gates.

## Cost guard

`authorizeProvisioning` is a pure dry-run validator, not a provider client. Unknown cost is denied. Positive incremental USD estimates require a nonexpired approval identifying provider, parent project, environment, allowed operation, ceiling and evidence reference. A zero-cost create/resize requires current free-allowance evidence; "free tier" is not assumed. Render writes also require confirmed workspace, and existing-service deployments require an observed service binding. The result explicitly is not a budget reservation and does not prevent another actor consuming quota. Provider-specific preflight, billing basis and budget reservation must be checked at the actual mutation boundary. No new resource is provisioned here.

## Verification and recovery

52 environment/unit/CLI tests exercise configuration inventory, secret rejection/redaction, context mixing, project/role/TLS mismatch, malformed inputs, unreviewed activation, cross-environment budgets, expired approvals and unverified provisioning. Existing app builds, static-export checks and browser suites must pass with the integrated guard. Tests use only visibly synthetic values. The live Neon database is unchanged. Rollback is a code/config revision only; never rotate or recreate provider secrets implicitly. Actual hosted enforcement remains unverified until deployment is authorized and tested.
