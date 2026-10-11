# The Garden

## Current engineering checkpoint (11 October 2026)

GDN-095 / PR #33 is merged at `d55a3ea953c6b009945bb572817f30dd5040f65a` with all six final-head workflows passing. There are 29 mapped engineering merges and no independently accepted or production-verified capabilities. GDN-041 adds bounded read-only import inventories and private immutable quarantine manifests; see [the import contract](docs/data/import-quarantine.md) and `docs/CURRENT_STATUS.md`. Earlier checkpoints below are historical.


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

The membership layer (PR #19) and forced record-security layer (PR #20) are merged and tested with synthetic PostgreSQL identities. The delivery authorization layer (PR #21) is also merged; typed historical records are the next candidate. Research APIs remain unmounted pending source, authorization and security gates.

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

## Archival source model

See [archival sources and lineage](docs/data/archival-sources.md). GDN-036 distinguishes witnesses, editions and exact digital representations, preserves contradictory catalog assertions, and never infers independent testimony merely from separate records. Its repository remains unmounted pending independent review and activation.

## Durable evidence locators

GDN-036 is merged in PR #23. GDN-038 is the current unmounted source-locator candidate; read `docs/data/durable-locators.md`. No source-viewer, publication, independent acceptance or cloud rollout is implied. Exact current PR mappings remain in `plan/execution.json`.

## Session-security continuation

GDN-029 is merged in PR #26. GDN-022 is the unmounted session/passkey candidate: [session and recovery contract](docs/security/sessions-and-step-up.md). The real verification gates and current mappings are in the execution registry, not inferred from this note.

## Audit-ledger continuation

GDN-022 is merged in PR #27 with all six workflows passing, 88 identity unit tests and 27 real-browser/PostgreSQL checks. GDN-030 is the unmounted audit candidate: [audit contract](docs/security/audit-ledger.md). Exact mappings and independent/deployment gates remain in the execution registry. No live audit service or external checkpoint operator is claimed.
