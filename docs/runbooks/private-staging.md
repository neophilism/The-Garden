# Owner-private Render staging shells

This is a staging-only access boundary for the existing public and research
application shells. Every application page, asset and route requires the owner
staging credential. It does not activate researcher accounts, uploads, corpus
access, database connections or publication. The separately managed owner-only
Sites front end is outside this deployment and must not be changed or duplicated.

GDN-014 remains partial until actual authorized Render services exist and the
external checks pass on their exact deployed source. A successful local build or
an authenticated local preview is not online acceptance.

## Boundary and credential handling

Each service owns a separate `GARDEN_STAGING_PREVIEW_ACCESS_TOKEN`. The Blueprint
uses `generateValue: true`, which Render documents as a random 256-bit value in
standard base64. The launcher also accepts canonical base64url for exactly 32
random bytes. Missing, malformed, cross-environment or enabled-research
configuration stops startup before listening. Use a provider-generated random
value; satisfying the encoding check alone does not establish randomness.

The credential belongs to the ingress, not the app. The build launcher removes
this one variable before both `npm ci` and the application build. The serving
launcher removes it before importing application code. All other environment
entries still pass through `config/environment.ts`; private/database credentials
remain forbidden in public and disabled-research processes. Do not rename a
credential or disable the environment checks to work around a rejection.

An owner can use the browser's HTTP Basic prompt with username `garden` and the
service's token as the password. Read the value through the authorized provider
secret interface; do not place it in the URL, repository, screenshots, shell
history, reports or logs. Verification clients use a Bearer header. Cookies,
query parameters, alternate usernames, duplicate Authorization headers and Next
middleware headers grant no access. The request's Authorization value is removed
from all header views before the app receives it.

The gate permits only GET and HEAD. It rejects protocol upgrades before any
framework handler, including Next's lazily installed upgrade handler. It denies
CONNECT tunnels, and Expect requests still go through the same access check.
All responses use `Cache-Control: private, no-store` and non-indexing headers;
the final header boundary preserves them even if a framework or asset handler
attempts to set public caching. No cookie is issued.

On Render, authenticated requests also require `X-Forwarded-Proto: https`.
Render terminates TLS at its load balancer and forwards HTTP internally; the
external verifier must observe the actual provider forwarding behavior. A local
launch without `RENDER` binds only `127.0.0.1`. Managed launches bind `0.0.0.0` on
the provider's `PORT`.

The only anonymous success is an exact GET/HEAD `/api/live`, returning
`{"status":"alive"}` and no source, service, application or research metadata.
This supports a provider health probe that cannot supply the owner credential.
Authenticated `/api/live` returns the existing source-bound release metadata.
Research readiness remains 503 while identity, database and storage are
unconfigured. Use `/api/live` for process health, not research readiness.

This is an authenticated internet-facing shell on a Render web service, not a
network-private service or researcher identity system. The high-entropy token
grants read-only staging access to whoever possesses it. It is not suitable for
personal records or production activation. Browser Basic credentials can remain
cached until the browser session ends; rotate the service token and restart the
service to invalidate old credentials. Use a distinct value for each surface.

## Build and launch

Use the committed lockfile and Node 24.19.0. Provide `GARDEN_ENV=staging` and the
owner token through a protected environment. The following commands contain no
secret values:

```sh
node scripts/build-private-staging.mjs public
node scripts/serve-private-staging.mjs public
```

Use `research` for the separate research service. The build command performs
the dependency installation with lifecycle scripts disabled and then builds
the chosen app with the ingress variable absent. It writes the same full Git
SHA manifest as the existing runtime. Startup rejects a manifest that differs
from `RENDER_GIT_COMMIT`.

The ordinary `npm start` and `npm run start:research` remain development/runtime
diagnostics without this staging access boundary. The Render Blueprint must
always use `serve-private-staging.mjs`; do not substitute an ordinary start
command when creating a remotely reachable service.

## Provider placement and current limitation

The authorized target is workspace `tea-db23jkks728c73av263g`, Garden project
`prj-db57f92jnfac739ghic0`. `render.yaml` describes two free Node web services in
Ohio, separate generated tokens, automatic deployment off and `/api/live` health
checks. No database, disk, worker, paid plan, environment group or shared secret
is created. Do not repurpose unrelated services or delete them to make room.

The previous 2026-10-16 creation attempt was rejected by Render's Hobby
25-service limit. The read-only 2026-10-17 inventory returned 24 web/static
services and no Garden service; Key Value inventory was empty. This does not
establish remaining capacity for both proposed services.

The current connector can create a free web service in the workspace, but its
creation contract cannot assign the Garden project/environment or configure an
HTTP health-check path. No Render API key or CLI was available in this session.
Do not silently create an ungrouped replacement. An authorized project-aware
Dashboard/API/Blueprint path and observed capacity are still needed before a
provider mutation. Do not invent an environment ID or claim that a Blueprint
file has been applied merely because it is committed.

Before creation, publish the tested source, verify actual Garden project and
environment placement, confirm that the chosen plans remain free, and inspect
for existing matching services. Create only the intended missing Garden
resources. Preserve manual deploys. Verify service/project IDs, commands,
credential presence by name, health path and the actual full deployed SHA from
the provider after creation. Never dump full environment values for evidence.

## Verification and rollback

After both ordinary builds exist, local verification runs against the real
guarded processes:

```sh
node --test tests/runtime/private-staging*.test.mjs tests/runtime/public-server.test.mjs
node tools/quality/private-staging-smoke.mjs
```

The smoke checks authenticated HTML and real assets, anonymous and wrong-token
denial, protected cache headers, exact source binding, disabled research routes,
GET/HEAD restrictions and a protocol upgrade after the real Next handler has
warmed up. Each surface starts, exits cleanly on SIGTERM, and starts again.
Forced SIGKILL is cleanup failure, not successful shutdown. Missing token/env,
production scope, wrong source, any private/database credential and research
activation all fail before the health listener is available.

For online verification, load the correct service token into the protected
environment and use the actual provider-origin URL and full deployed SHA:

```sh
node scripts/verify-private-staging.mjs https://ACTUAL-SERVICE-URL FULL_COMMIT_SHA public
node scripts/verify-private-staging.mjs https://ACTUAL-SERVICE-URL FULL_COMMIT_SHA research
```

The external verifier requires HTTPS, refuses redirects and cross-origin asset
requests, checks all responses for private no-store caching, and returns only
safe status evidence. It never emits response bodies or credentials. Keep its
JSON together with provider service/deploy IDs and timestamps. Re-run it after
restart, redeploy or token rotation, including old-token denial on rotation.

Rollback only to an earlier **guarded** staging release, retaining token
configuration and the guarded launcher. Earlier unguarded shell releases are
not acceptable private-staging rollback targets. If no verified guarded release
exists, stop the Garden service until a corrected guarded artifact is ready.
These shells never migrate or modify the corpus/database at startup; rollback
must not run destructive schema changes or touch the separate Sites front end.

## Provider and runtime references

- [Render Blueprint secret generation](https://render.com/docs/blueprint-spec#generating-random-secrets)
- [Render web services and TLS termination](https://render.com/docs/web-services)
- [Render health checks](https://render.com/docs/health-checks)
- [Next custom server contract](https://nextjs.org/docs/app/guides/custom-server)
- [Node 24 HTTP upgrade handling](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html)

The installed Next 16.4.0 source was inspected for lazy upgrade registration;
the Node 24.19.0 constructor prevents those events from reaching that handler.
This source review and the automated tests are AI-assisted engineering evidence,
not independent human review or security certification.
