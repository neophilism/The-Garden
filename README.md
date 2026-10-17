# The Garden

The Garden is a public-information and historical-research platform under development. Its policy documents, original-source custody, researcher permissions and optional contribution program have separate responsibilities. Research participation does not require policy endorsement.

Start with [current status](docs/CURRENT_STATUS.md), [the approved development plan](DEVELOPMENT_PLAN.md), [the canonical PR registry](registry/prs.json), and [AGENTS.md](AGENTS.md). The approved plan contains **210 work items: 196 current public/research items and 14 conditional governmental items**. Planned GDN identifiers and GitHub PR numbers are different identifiers.

## Verified engineering and deployment

The latest verified implementation and merge counts are in [execution evidence](plan/execution.json) and [progress](plan/progress.json). Each capability's evidence distinguishes code, tests, acceptance, deployment and production verification. Current production verification remains zero.

The repository contains a Next.js public orientation build, a separate research application shell, identity and policy boundaries, historical entity/source/claim models, structured editorial previews, a private upload and corpus-staging foundation, bibliographic intake, and an offline source-acquisition queue. Many research adapters remain deliberately unmounted while their runtime integrations are completed. [Current status](docs/CURRENT_STATUS.md) identifies the latest verified additions and their limits.

All thirteen staging database migration hashes are verified in [db/staging-observation.json](db/staging-observation.json). PR64 adds encrypted revision persistence, atomic audit and generation/digest compare-and-swap, with 22 actual PostgreSQL scenarios and separate schema-only staging readback. The encryption service remains unmounted; no live keys, encrypted corpus records or production deployment are claimed. The Render deployment target remains the owner-designated Garden project. The earlier free-service capacity failure and current project-placement limitation are recorded in [provider constraints](plan/blockers.json). [Staging setup](docs/runbooks/staging.md) provides the build, private-access and verification instructions. A separate existing owner-private Site is tracked in [the continuation handoff](docs/handoff.md); deployment is claimed only after actual provider and HTTPS verification.

The owner authorizes continued implementation, AI-assisted source/security review, tests and ordinary guarded merges. External human security review is deferred follow-up. [The merge protocol](docs/delivery/autonomous-merges.md) binds review to the current head, independently read base, tested merge revision and CI job receipts; remote protection configuration remains a separate acceptance requirement.

## Local application and checks

Use Node 24, Python 3.10+ and the committed lockfiles:

```sh
npm ci --include=dev --ignore-scripts --no-audit
npm run check
npm start
# In a second terminal, after the research build:
PORT=3001 npm run start:research
```

`npm run check` runs the application tests, workspace type checks and both builds. Use an isolated development environment without unrelated credential variables: the public build rejects private configuration. The public export is served by its own process; the research shell has separate readiness and feature activation.

Run the planning and authority checks before selecting another work item:

```sh
python3 scripts/validate_plan.py
python3 scripts/validate_charter.py
python3 scripts/sync_roadmap.py
python3 scripts/reconcile_roadmap.py
python3 -m unittest discover -s tests/plan -v
```

The required workflows also exercise storage, historical imports, PostgreSQL isolation, identity/passkeys, policy/dependency checks, real browser journeys and accessibility. See [quality gates](docs/testing/quality-gates.md). CI receipts identify the actual source tested; merged code alone does not establish live integration.

## Policy and historical source library

[The policy and research source library](policy/README.md) records editable Garden policy/legislation originals and their provenance. The repository is public, and those owner-authored reference documents are available under their recorded conditions. The committed historical companions include the earlier CP-018 checkpoint and exact-byte verification records.

The illustrated manuscript, large corpus archives and detailed private development reports remain in their separately authorized custody. Read-only inspection of an original is distinct from transferring it into GitHub or ingesting it into the application. Revalidate the selected checkpoint, exact file digests and physical source coordinates before import; preserve original editions and recovery boundaries. Run `python3 scripts/verify_policy_sources.py --check` to check committed source hashes.

Public access to working scholarship does not certify historical claims or grant reproduction rights to third-party images, family material or archival evidence. Source assertions, editorial interpretations, reviewed claims and public releases remain separate. [The research charter](docs/sources/research-charter.md) records the original scope and cutoff; [the product charter](docs/product/charter.md) records the platform responsibilities.

## Repository guide

| Area | Purpose |
| --- | --- |
| `apps/public`, `apps/research` | Separate public and researcher application surfaces |
| `packages/domain`, `services/workers` | Domain contracts, private processing and integration boundaries |
| [Plan authority](plan/README.md) and [canonical registry](registry/prs.json) | Approved work IDs, dependency graph and observed PR mappings |
| [Architecture decisions](docs/adr/) and [security](docs/security/) | Design decisions, threat controls and acceptance limits |
| [Migration mapping](docs/migration/) and [source register](docs/sources/source-register.json) | Original source coordinates and explicit dispositions |
| [Runbooks](docs/runbooks/) and [handoff](docs/handoff.md) | Reproducible operation and autonomous continuation |
| [E2EESA status](security/e2eesa-status.json) | Separate implementation, testing and external-review records |

[Runtime targets](plan/runtime-targets.json) preserve exact owner-designated resources. Production, staging and unrelated projects use separate identities and credentials. Engine Room can consume the source-owned registry; live ingestion and registration need independent readback before being reported as verified.

Governmental features remain conditional on separately established authority and activation. No code/documentation license is selected, and repository visibility grants no additional rights to private or licensed source material. The bounded original planning transport remains in `bootstrap/` for recovery; its historical status fields are preserved rather than treated as current execution evidence.
