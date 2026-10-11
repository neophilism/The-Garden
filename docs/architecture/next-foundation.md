# GDN-009 — Next.js public and research application foundation

## Architecture
Node 24 LTS / npm workspaces / strict TypeScript. Public and research are separate Next 16.4.0 applications; a shared `@garden/domain` package provides only nonsecret public content and types; a worker package contains nonrunning interfaces, no corpus processing. All dependencies are exact-version pinned and must produce a committed npm lock before CI merge.

- `apps/public`: static Next.js export, no server credentials, no historical records, no accounts and `robots` disallow while still a preview. Semantic HTML and CSS with reduced-motion, keyboard/focus support. All pages explicitly communicate proposal versus enacted law and funding uncertainty.
- `apps/research`: separate server deployment artifact, initially locked/unavailable; unauthenticated 503 health endpoint, no research database credentials or private routes. Do not deploy a private app from the public static artifact.
- `packages/domain`: portable published-content contract without private source bytes. Maintain authorization enforcement on server and storage later, never only through client content flags.
- `services/workers`: disabled placeholder; no source imports or running jobs.

## Building
Use Node 24 and `npm ci` from a fresh clone after the lockfile is committed. `npm run check` executes application tests, strict typechecking and both builds. For the static public preview, use `npm run build:public`; output is `apps/public/out`. Do not use a paid service without cost authorization. Next's announced October 14, 2026 security update addressing upstream vulnerabilities must be evaluated and applied before public release; this scaffold version is not a security approval.

## Render placement
The owner specified Render project `prj-db57f92jnfac739ghic0`. The connector currently exposes workspace-level site creation but not project-attachment; do not silently create a service outside that requested project. When project-aware deployment is available, use a free static site linked to Garden `main`, build `npm ci && npm run build:public`, publish `apps/public/out`. Verify the actual service URL, release commit, served routes, 404s, security headers, robots and rollback. Future authenticated researcher app needs separately reviewed web service and identity.

## Neon
Garden-specific Neon `royal-union-78374030`, branch `br-curly-band-b5aatp1e` is verified but remains unused in this initial public-only build. Database migrations, partitioned roles and backups belong to GDN-012/013 etc. Never import CP-017 archives into Neon before rights/privacy review.

## Privacy / licensing
No public app environment variables, custom analytics, images requiring archival rights, outside fonts, family records, endorsement records, or visitor submissions. The site is not an official enrollment portal. Security standard is pinned at document level but not independently assessed. `docs/evidence/GDN-009/acceptance.json` tracks CI and deployment separately.
