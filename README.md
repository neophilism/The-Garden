# The Garden

## Policy and historical document library

[Policy, legislation, historical research checkpoint and source manifest](policy/README.md) follows The Cornerstone's source-library organization. The Garden Act's editable originals and provenance are available in `policy/legislation/`; CP-018 historical research handoff and corpus component accounting are in `policy/historical-research/`. Restricted archival originals, manuscript images, family records and full research databases are **not** published in this public repository pending scoped research, rights, consent and security reviews. Run `python3 scripts/verify_policy_sources.py --check` to check committed source hashes.

## Resumable intake implementation (12 October 2026)

GDN-077 adds owner-bound, checksummed uploads with durable pause/resume, quota reservation, crash recovery, private quarantine receipts and a trusted handoff to GDN-045. The contributor panel distinguishes bytes received from research review and publication. [Runbook](docs/runbooks/resumable-uploads.md); [acceptance evidence](docs/evidence/GDN-077/acceptance.json). Implementation is under review in [PR #40](https://github.com/neophilism/The-Garden/pull/40) and remains disabled/unmounted; hosted activation and independent acceptance are not claimed.

The read-only preflight follow-up merged as [PR #39](https://github.com/neophilism/The-Garden/pull/39) at `12f9e1ff02dbf3349caa4f587c9c354d15ba0ba3`, after six workflows and nine checks passed on `fcbf577f836fc1b78719d032d9b674804e920a92`. Real-source development reports remain private. GDN-077 tests use generated data; no historical source has been uploaded through this capability or promoted into research records.

## Read-only corpus preflight

A bounded operator diagnostic now measures actual staging payload and storage classes using the importer serializer. It verifies the pinned source and complete schema/count contract without creating staging rows, copying values into reports or activating hosted ingestion. Results from privately authorized corpus inspection remain restricted operational evidence. See [the preflight runbook](docs/runbooks/corpus-preflight.md).

Use real-source measurements to provision separately accepted private staging capacity; archive size alone is insufficient. GDN-077 resumable quarantine uploads is under review. GDN-078 repository links and bibliographic intake becomes dependency-ready after its merge. Historical review, rights clearance, normalization and public release remain separate.

## Offline corpus staging merged (12 October 2026)

GDN-045 / [PR #37](https://github.com/neophilism/The-Garden/pull/37) merged after all six final-head workflows passed. It implements a default-disabled, unmounted offline staging importer, with memory-bounded SQLite extraction, exact typed lineage, atomic checkpoints, replay/conflict detection and audited authorization gates. [Operating contract and limits](docs/runbooks/corpus-staging.md). Validation uses generated fixtures, including a 422,723,584-byte database; no historical corpus was ingested, normalized, verified or published. Independent and live acceptance remain separate.

## Prior engineering checkpoint (11 October 2026)

GDN-044 / PR #35 is merged at `3cfd7584fee08cc87d0fffc0fac839b5e9d73913`. PRs #32–#35 each passed all six workflows on their final heads before merge. There are 31 mapped engineering merges and no independently accepted or production-verified capabilities. Structured editorial content, sourced geography, import quarantine and the complete recorded source-table mapping are implemented and tested within their documented activation limits. See `docs/CURRENT_STATUS.md` and `plan/execution.json`. Earlier checkpoints below are historical.


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
