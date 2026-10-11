# Current continuation - 11 October 2026

## Verified baseline and current work

PR #26 / GDN-029 is merged at `b62396cf1715d51c2d396ef24d276a7a3306f017`; all six exact-head workflows were reverified. There are 23 observed engineering merges at this checkpoint. Bootstrap, inventory and follow-up PRs do not inflate the planned-work count. The 196-current/14-conditional scope is unchanged.

PR #27 / GDN-022 has passed all six workflows for head `bc0d1e55890fe0daceba72ae5e4af44596bbb8fd`. Its 88 identity unit tests and 27 real-browser/PostgreSQL checks cover passkey signatures, mandatory user verification, session rotation and revocation, privilege expiry, cross-tab logout and password-recovery races. Evidence preserves both the PR head and the tested merge ref. The downloaded source tree matched the PR head exactly, and the desktop/mobile screenshots were inspected. See `docs/evidence/GDN-022/verification-2026-10-11.json`. Subsequent commits must pass fresh CI before merge; this record does not claim they already did.

The identity and account-security capability remains unmounted. Email infrastructure, hosted HTTPS, physical authenticators, multi-browser testing, independent review and production acceptance remain separate gates. Ordinary password recovery does not replace an enrolled passkey or enable privileged actions. Read `docs/security/sessions-and-step-up.md` before integrating consumers.

## Next dependency-ready implementation

After GDN-022 merges with fresh passing CI, continue GDN-030 tamper-evident audit, then GDN-031 authorization isolation and GDN-039 independent evidence/rights/publication status. Other dependency-ready work must respect the explicit key-management and provider gates. Do not infer source verification, publication permission or legal authority from a schema or successful CI run.

## Provider and deployment boundary

The supplied Render project is `prj-db57f92jnfac739ghic0`. This session's Render connection requires explicit confirmation of Phillip's workspace (`tea-db23jkks728c73av263g`) before service access. No alternate project, service or paid resource was substituted. Earlier project-bound service-inspection/assignment limitations also require verification after workspace selection.

Neon project `royal-union-78374030` is connected. The existing Garden staging branch is `br-purple-grass-b5hurfl7`; production branch `br-curly-band-b5aatp1e` is unchanged. This continuation changed no cloud schema or storage object and sent no external email.

The public application remains a nine-page preproduction orientation site. Browser checks operate against CI builds, not a verified live Garden deployment. No original corpus, private family data, AI, payments or official governmental capability is enabled.

## Progress integrity and handoff

Read `AGENTS.md`, `registry/roadmap.json`, `plan/plan.json`, `plan/execution.json`, `plan/progress.json` and applicable ADRs. Engine Room source mappings reflect actual PRs; live ingestion/readback and branch-rule administration remain unverified. Merged engineering, independent acceptance and production readiness are different observations. Inspect actual GitHub state at the start of each session; do not use an old status paragraph as current evidence.

Previous status text and source snapshots remain in Git history. There is no recurring development scheduler or claimed unattended worker. Required code, tests and runbooks reside in the repository; conversation history is not an implementation dependency.
