# The Garden

A public-information and historical-research platform under development.

**Start with [current execution status](docs/CURRENT_STATUS.md), [the complete development plan](DEVELOPMENT_PLAN.md), and [AGENTS.md](AGENTS.md).** The approved baseline has 210 work items covering 43 functions: 196 current public/research items and 14 conditional governmental items. These identifiers are not GitHub PR numbers.

The full text baseline is merged in [PR #1](https://github.com/neophilism/The-Garden/pull/1). This is not an implemented or deployed website. [Execution observations](plan/execution.json) distinguish PRs, acceptance, deployment and production verification. Original planning-time status fields remain a historical snapshot; see [the authority model](plan/README.md).

## Product and research contract

Read [the charter](docs/product/charter.md) and [all feature owners](docs/product/feature-contract.json). Research participation does not require policy endorsement. Preserve evidence, disagreement, consent and source rights. The current legislative proposal does not establish guaranteed zero fiscal cost. Governmental functions require separate legal authorization.

## Run the existing checks

Python 3.10+; these checks need no third-party packages, credentials or network:

```sh
python scripts/validate_plan.py
python scripts/validate_charter.py
python -m unittest discover -s tests/plan -v
python -m unittest discover -s tests/architecture -v
```

These are planning and architecture-contract checks, not application or security certification. Actual CI identifies its tested commit. Never replace an unresolved production gate with a passing documentation check.

## Repository map

- [Full reader](DEVELOPMENT_PLAN.html): standalone searchable planning document, not the public website.
- [PR specifications](docs/prs/): individual scope, dependencies, tests, rollout and acceptance.
- [Architecture](docs/adr/) and [security](docs/security/): versioned decisions and verification gaps.
- [Migration mapping](docs/migration/): dispositions for 106 observed source tables, not migrated data.
- [Runbooks](docs/runbooks/) and [handoff](docs/handoff.md): operation, recovery and continuation.
- [Standing development instructions](docs/standing-instructions.md): autonomous tested delivery without bypasses.
- [Source register](docs/sources/source-register.json): evidence identity and inspection scope.

## Exact deployment targets

[Target registry](plan/runtime-targets.json) records the owner-designated Render project and Neon project/branch. Provider connections, actual resource inspection and deployment are pending. Do not use other projects' credentials, assume a database name, allocate paid resources or publish sensitive records.

## Baseline recovery and evolving files

`bootstrap/` retains a bounded, hash-checked transport of the approved text baseline. Restore only in a separate recovery directory. The one-time import workflow is retired; do not replay it over evolving repository files. The original package manifest also names three historical documentation-QA PNGs not included in the text-only import.

## Rights

No code or documentation license has been selected here. Public repository access does not grant redistribution rights to archival material, family submissions or generated book assets. No private research database or licensed image corpus is included. Maintain rights/consent review separately from code review.
