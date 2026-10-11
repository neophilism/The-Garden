# GDN-010: executable quality gates

These are application and repository checks, not independent security certification or proof of production readiness. No deployment token or private research dataset is made available to a pull-request workflow. Test workflows have contents: read, immutable reviewed action pins, no persisted checkout credentials and no privileged pull_request_target/workflow_run event.

## Stable check names

- plan-validation: approved baseline and its regression tests.
- architecture-contracts: charter, source, security crosswalk, editorial and integration contract regressions.
- application-build: seven application checks, strict TypeScript, public static export and separately disabled research build.
- supply-chain-and-policy: parsed workflow/lock policy, scoped source lint, credential and dependency canaries, static-export negative fixtures, roadmap reconciliation, npm advisory audits and CycloneDX inventory.
- browser-and-accessibility: real built output in Chromium desktop, Chromium mobile and Firefox desktop; nine routes per project plus keyboard journey, narrow viewport, accessibility canary and disabled research HTTP integration.

Branch rules are a distinct GDN-011 task. A list of intended checks does not establish repository enforcement.

## Reproduce

With Node 24 and Python 3.10+ from the repository root:

```sh
npm ci --include=dev --ignore-scripts --no-audit
npm ci --prefix tools/quality --ignore-scripts --no-audit
node tools/quality/verify-policy.mjs
node tools/quality/lint.mjs
node --test tools/quality/unit/*.test.mjs
python3 -m unittest discover -s tests/quality -v
python3 scripts/reconcile_roadmap.py
npm run check
python3 scripts/verify_public_export.py
cd tools/quality
npx --no-install playwright install --with-deps chromium firefox
npm run test:browser
```

The browser test server serves only the public export on localhost. A separate localhost research process is expected to report unavailable with HTTP 503 and no access to credentials or records. Both processes are bounded to the test run, not scheduled/background operations.

## Evidence and limitations

CI retains exact checkout and PR head, runtime details, dependency-lock hashes, full axe results (including inconclusive findings), screenshots, failure traces, advisory reports and inventory for 30 days. Download required release evidence before retention expiry. No credentials are included. All test failures remain failures; retries are zero and no blanket exception suppressions are used.

The credential scanner is intentionally limited to runtime source and workflow files and three credential-shape families. The AST lint covers syntax, explicit any, dynamic evaluation/raw HTML sinks and public/private imports; it is not a whole-program security analysis. npm audit covers published registry advisories at execution time, not unknown vulnerabilities. Automated axe and browser checks do not replace screen-reader, inclusive user or expert accessibility assessments. CI is not a live Render deployment test.

Tool pins were verified against upstream Playwright v1.64.0, axe-core v4.14.0 and yaml v2.9.0. The lock candidate was generated in read-only CI run 38098882372 and reviewed before committing. The one-time candidate workflow is removed. No provider resources are created by these workflows.
