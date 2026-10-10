# The Garden - repository-ready development plan

Version 1.0 / GARDEN-WEB-PLAN-001 / 10 October 2026.

**This is a planning and handoff repository package, not the implemented website.** It contains a full development plan, 210 specified PRs, 43-feature coverage, 106-table migration mapping, source references, security and integration contracts, release gates, and runnable local plan-validation tooling. No remote repository, GitHub PR, deployment or Engine Room registration was performed in preparing this package. All application test cases in PR files are specified, not executed.

## Start here

Read `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `plan/plan.json`, `plan/blockers.json`, and `docs/handoff.md`. The browser edition `DEVELOPMENT_PLAN.html` provides local search, navigation and PR filters. It requires no external scripts, tracker, account or network connection to read. Do not confuse this documentation page with a deployed Garden application.

## Validate this package

From the package root, with Python 3.10 or newer:

```sh
python scripts/validate_plan.py
python -m unittest discover -s tests/plan -v
```

These commands validate planning structure and artifacts, not application security or production readiness. The generated `validation/plan-validation.json` and `validation/local-tool-tests.txt` record the preparation checks. Application development begins with the dependency-ready PRs, not with a claim that these planning-tool tests implement the site.

## Layout

`plan/`: machine-readable PRs, features, release closures, blockers, progress and JSON Schema.

`docs/prs/`: one detailed specification per planned PR. IDs GDN-001 through GDN-196 are current public/research work; GDN-197 through GDN-210 are conditional government work.

`docs/adr/`: architecture decisions and review triggers. `docs/security/`: proposed control baseline and canonical-standard gap. `docs/integrations/`: explicit proposed contracts, credential names and provider verification gates.

`docs/migration/`: all 106 observed source tables, actual schema/count inventory and proposed migration dispositions. `docs/sources/`: source register and preserved research charter. No private research database or licensed image corpus is included.

`docs/runbooks/`: deployment, restore, incidents and handoff procedures. `docs/testing/`: evidence formats and acceptance scenarios. `scripts/` and `tests/plan/`: standard-library validation tools, not application source.

## Authorization and next work

GitHub access and the target repository remain unverified. The canonical End-To-End-Everywhere standard and actual Engine Room API were not located. Render/Neon/provider resources and budgets must be discovered and authorized. The plan makes technical choices and leaves only real access, budget, legal and expert-review gates unresolved. Do not invent missing endpoints or treat a mock as an integration.

## Scope and progress

Current scope: 196 planned PRs. Conditional scope: 14 planned PRs. Verified remote merged items: 0. Verified production items: 0. This records absence of remote evidence in this package, not an assertion about an uninspected existing repository. Research completion remains separate: the source checkpoint is a working edition with open audit/recovery boundaries.

## Licensing and redistribution

The owner must choose a code/documentation license before public repository distribution. Referenced archival material and family submissions retain their own rights and consent. This package does not grant a license to redistribute source books, database contents, images or contributor records. Preserve provenance and access restrictions.

## Regenerating documentation

The JSON plan is the PR authority. `python scripts/build_specifications.py` regenerates the per-PR files and catalog. Optional `python scripts/render_reader.py` rebuilds the complete Markdown/HTML reader from the committed narrative, coverage, catalog, risk and source sections. It uses the package versions in `requirements-docs.txt`; the plan validator itself has no third-party dependency. Update release closures and feature mappings with scope changes, then run validation before rendering. Review generated diffs and keep all versions synchronized.

`python scripts/qa_reader.py` runs optional browser documentation checks when Playwright and a compatible browser are installed. Set BROWSER_PATH to an installed Chromium binary when needed. These checks load locally supplied HTML; they do not test a deployed Garden application or certify accessibility.
