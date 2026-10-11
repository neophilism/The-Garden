# The Garden

A public-information and historical-research platform under development.

**Start with [current execution status](docs/CURRENT_STATUS.md), [the complete plan](DEVELOPMENT_PLAN.md), and [AGENTS.md](AGENTS.md).** The approved baseline has 210 work items covering 43 functions: 196 current public/research items and 14 conditional governmental items. Planned IDs are not GitHub PR numbers.

A runnable Next.js foundation is merged in PR #10. It statically exports the public orientation pages and keeps the separate research application disabled. It is not a deployed or complete research platform. [Execution observations](plan/execution.json) distinguish implementation, merge, acceptance and production verification; [the authority model](plan/README.md) explains the preserved baseline.

## Local application and checks

Use Node 24 and Python 3.10+. No production credentials are needed for the current disabled-research preview.

```sh
npm ci --include=dev --ignore-scripts --no-audit
npm run check
npm run dev --workspace=@garden/public
```

The membership layer (PR #19) and forced record-security layer (PR #20) are merged and tested with synthetic PostgreSQL identities. Unified delivery authorization is the next candidate. Research APIs remain unmounted pending source, authorization and security gates.

The public development server is local only. A production build creates `apps/public/out`; the independent research app does not provide accounts, uploads or historical records. See [quality gates](docs/testing/quality-gates.md) for browser, accessibility, dependency, workflow and negative-fixture checks.

```sh
python scripts/validate_plan.py
python scripts/validate_charter.py
python -m unittest discover -s tests/plan -v
python -m unittest discover -s tests/architecture -v
python scripts/reconcile_roadmap.py
```

These checks are not security certification. Actual CI and acceptance evidence identify the evaluated commit and limitations.

## Product and research contract

Read [the charter](docs/product/charter.md) and [feature responsibilities](docs/product/feature-contract.json). Research participation does not require policy endorsement. Preserve evidence, disagreement, consent and rights. The proposed legislation does not establish guaranteed zero fiscal cost. Governmental functions need separate legal authorization.

## Repository map

- `apps/public`, `apps/research`, `packages/domain`, `services/workers`: separate application boundaries.
- [Full reader](DEVELOPMENT_PLAN.html) and [PR specifications](docs/prs/): the complete planning baseline, not a website completion claim.
- [Architecture](docs/adr/), [security](docs/security/) and [integration contracts](docs/integrations/): decisions and verification gaps.
- [Migration mapping](docs/migration/): all 106 observed source tables accounted for; not migrated data.
- [Runbooks](docs/runbooks/), [handoff](docs/handoff.md), [standing instructions](docs/standing-instructions.md) and [source register](docs/sources/source-register.json).

## Authorized resources

[Target registry](plan/runtime-targets.json) records the exact owner-designated Render project and Neon project/branch. Neon was inspected; Render project membership and application deployment remain unverified. Do not reuse another project's credentials, allocate new paid resources or publish private records. Connections and merged code are not proof of production readiness.

## Recovery and rights

`bootstrap/` preserves a bounded, hash-checked transport of the original text baseline. Restore only in a separate recovery directory; its one-time workflow is retired. The historical manifest names three original documentation-QA PNGs excluded from that text-only import.

No code/documentation license is selected. Public repository access grants no redistribution rights to archival material, family records or book assets. No private corpus or licensed image collection is included. Maintain rights and consent review separately from code review.
