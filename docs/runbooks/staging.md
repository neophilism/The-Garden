# Garden staging deployment

The owner authorized Garden GitHub changes, free/existing Render test services,
and migrations/roles/tests in the isolated Neon staging branch on 2026-10-16.
Independent human security review is a final follow-up, not an activation gate.
Required tests and actual access controls remain enforced.

## Build and run

Use Node 24.19.0 and the committed lockfile:

```sh
npm ci --include=dev --ignore-scripts --no-audit
npm run check
npm start
# In a second terminal, after the research build:
PORT=3001 npm run start:research
```

`npm run build:public` and `npm run build:research` write a server-only source
manifest. `npm start` serves only the public static export. Research runs as a
separate process; the public build and process reject private credentials.
Use a clean shell/container if a development environment injects unrelated
credentials. Do not delete or rename the credential guard to make a build pass.

`render.yaml` defines two free Node services in Ohio, with explicit staging
configuration and automatic deployment off. Use the owner-designated workspace
`tea-db23jkks728c73av263g` and Garden project `prj-db57f92jnfac739ghic0`.
The connector can create services in that workspace but cannot assign project
membership or configure health-check paths. Project grouping must be completed
through the project dashboard or an authenticated API/Blueprint path; report it
as unverified until observed. Do not invent an environment ID.

Set the Render health check to `/api/live`. Both surfaces bind `0.0.0.0` and use
the provider's `PORT`. Node startup on a managed deployment requires explicit
`GARDEN_ENV`; the public process also verifies the build's full SHA against
`RENDER_GIT_COMMIT`. No database, email, identity or storage secret is needed for
these shells. No personal/research data is seeded or collected.

## Verification and rollback

```sh
node tools/quality/runtime-smoke.mjs
node scripts/verify-deployment.mjs https://ACTUAL-PUBLIC-URL FULL_COMMIT_SHA public
node scripts/verify-deployment.mjs https://ACTUAL-RESEARCH-URL FULL_COMMIT_SHA research
```

The first command starts, stops and restarts both actual processes and rejects
missing environment, wrong source and cross-environment credentials. The latter
commands require external HTTPS, the expected source, staging scope, visible
pages and private endpoint denial. They do not turn a shell into active research.
Retain their JSON together with provider service/deployment IDs and timestamps.

Public `/api/ready` is 200 only when its export is present and it is not draining.
Research `/api/live` is 200 when the process serves requests; `/api/ready` and the
legacy `/api/health` are 503 while the research dependencies are unconfigured.
Use liveness for process replacement and readiness for capability availability.
Do not configure a restart loop based on intentional research unavailability.

For rollback, redeploy the previously verified commit for the affected service,
then repeat the external checks with that commit. These services perform no
schema migration at startup. Database rollout and consent/deletion replay are
separate; application rollback must never trigger destructive down migrations.

## Remaining research configuration

The isolated database is `royal-union-78374030` / `br-purple-grass-b5hurfl7`
(`garden-staging`), not the default production branch. Current migrations and
the application's distinct least-privilege roles must be applied and verified
before credentials are connected. Identity needs its own schema, secret, origin
and mail transport. Storage needs private bucket credentials and verified
quarantine handling. None of these are prerequisites for the public site.

Never paste secret values into repository files, evidence or logs. Record only
the variable names and resource identities. Use environment-specific names
accepted by `config/environment.ts`; preserve separate credentials per surface.
