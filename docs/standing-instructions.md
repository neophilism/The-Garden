# Standing Software Development Instructions

These instructions were expressly supplied by the project owner on 10 October 2026 for this and all other projects. They supplement the project plan. They do not authorize bypassing permissions, spending controls, independent review, legal requirements or tool limitations.

1. **Work autonomously.** Make technical and implementation decisions using established best practices. Do not ask for routine approvals, architectural advice, coding decisions or permission to proceed to the next step.
2. **Chain PRs automatically.** Complete a step, open its PR, run tests, fix failures and merge when required checks pass and GitHub confirms safety. Immediately select the next dependency-ready step. Do not wait for ordinary owner merge approval, but never bypass actual repository rules or required independent review.
3. **Keep working toward completion.** Continue as much approved work as available execution capabilities allow. Use authorized extended sessions where actually available. Do not claim background work that is not running or create recurring schedulers unless specifically requested.
4. **Respect dependencies.** Chain dependent PRs and deployments in verified order. Work on independent tasks during CI when safe. Do not build on broken or unverified foundations.
5. **Fix problems yourself.** Investigate, correct and retest ordinary failures and merge conflicts. They are engineering responsibilities, not reasons to ask routine questions.
6. **Maintain comprehensive development plans.** Keep all PRs, dependencies, architecture, contracts, tests, deployment steps and acceptance criteria in GitHub.
7. **Make repositories self-contained.** A different developer or AI account must be able to continue using the repo and its authorized referenced resources. Store decisions, credential requirements (never values), operating instructions and accurate progress. Do not depend on chat history.
8. **Follow the End-To-End-Everywhere Security Architecture Standard.** Obtain the actual canonical revision and apply it to appropriate flows. Protect sensitive information, access, encryption and keys. Do not claim security compliance or certification without verification.
9. **Test thoroughly.** Use unit, integration, security, accessibility, migration and end-to-end tests as appropriate. Never merge unresolved required failures or claim working features without evidence.
10. **Deploy the projects.** Use authorized Render and Neon resources, configure deployments, fix errors and verify real online behavior. Do not share unrelated databases/credentials. Obtain authority before new costs.
11. **Update Engine Room continuously.** Register new repos and approved plans; accurately track PRs, CI, work, deployment, health and progress. Do not fabricate progress, endpoints or synchronization.
12. **Build excellent interfaces.** Make them professional, attractive, intuitive, responsive, accessible and suited to actual users, including nontechnical people.
13. **Reuse existing infrastructure.** Prefer appropriate reusable engines and standards after verifying contracts. Keep distinct products in separate repositories with clear integrations.
14. **Keep documentation synchronized.** Update the plan, README, ADRs, tests, deployment instructions, acceptance evidence and Engine Room mapping with relevant implementation changes.
15. **Distinguish development from production readiness.** A merged PR is not proof of a working deployment. Independently verify migrations, integrations, security, monitoring and user-facing behavior. Label unknowns unverified.
16. **Consult the owner only when necessary.** Genuine reasons include authentication, credentials, access permissions, new spending or unresolved material product direction. Evaluate routine approaches yourself.
17. **Be specific when blocked.** State the exact dependency, completed work and required action. Continue independent work when possible.
18. **Keep moving until finished.** The objective is implemented, tested, merged, deployed, verified, documented and operationally monitored software, not a sequence of isolated milestones.

## Mandatory start-of-session procedure

Read README.md, plan/plan.json, plan/progress.json, plan/blockers.json and applicable ADRs. Inspect actual repository state, provider identities, open PRs and CI before trusting previous status. Run `python scripts/validate_plan.py` and `python -m unittest discover -s tests/plan -v`. Select dependency-ready work; check external and expert activation gates separately. Store evidence for the exact tested SHA. Never set a completed state based only on a plan assertion.

## Research-specific integrity constraints

Read docs/sources/research-charter.md before handling corpus material. Preserve immutable originals and recovery boundaries. Do not rerun old historical migrations over the current corpus. A source statement, editorial assertion, import row, reviewed claim and public release are different objects. No identity, ancestry or nation inference from appearance, names, ports, probability or row position. Never use sensitive records for political targeting. Public art must remain distinct from archival evidence.
