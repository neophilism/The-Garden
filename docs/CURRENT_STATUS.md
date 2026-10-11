# Current execution status

The approved baseline remains GARDEN-WEB-PLAN-001: 196 current public/research items plus 14 legally conditional governmental items. Current observations are in `plan/execution.json`; baseline statuses are historical, not a second progress numerator.

## Implemented and merged

GDN-001 through GDN-009 have mapped, merged engineering PRs with recorded passing CI. GDN-009 is GitHub PR #10, merge `78c7e9a5b2b4d3b79ef4d55b9b6d29f3bcb79c4d`. It adds runnable public/research Next.js applications, a public-only shared domain package and an inactive worker scaffold. Public output is a nine-page static orientation preview. Authentication, research intake, corpus search and government functions remain disabled or unimplemented.

Bootstrap PR #1 and provider-inventory PR #11 are not planned-feature completions. No feature has independent production acceptance. Actual Engine Room ingestion and dashboard readback are unverified despite a compatible checked-in manifest and explicit PR mapping.

## Active work

GDN-010, PR #12, adds browser/accessibility, supply-chain, source-lint and workflow-policy checks. Initial browser CI ran 39 cases: 12 passed and 27 failed due to three shared accessibility issues. The failures are being corrected without exclusions. Supply-chain/policy CI passed. Fresh final-head CI, review of screenshots and mergeability must pass before merge. See `docs/testing/quality-gates.md` and `docs/evidence/GDN-010/acceptance.json`.

## Providers and deployment

Neon The Garden / royal-union-78374030 / br-curly-band-b5aatp1e / neondb is accessible and has no user tables. It remains unchanged. Render's account is connected; the active tool requires explicit selection of Phillip's workspace before further operations. The designated project is prj-db57f92jnfac739ghic0. Project membership/service placement remains unverified and the connector cannot specify a project when creating a service. Do not create outside the owner's requested project or substitute an unrelated resource.

No hosting purchases, database migrations or application deployments were made. Public release and protected research activation retain legal/editorial, image-rights, consent, accessibility and independent security gates. The announced upcoming Next.js security release must be assessed before production readiness is claimed.

## Continue

Read AGENTS.md, the plan, actual main/open PR state and current CI. Finish GDN-010 before referencing its checks in branch rules. GDN-012 environment isolation is independently dependency-ready after GDN-005/GDN-009; prepare and test it while respecting unverified provider scope and spending gates. Do not replay the baseline importer over evolving files.
