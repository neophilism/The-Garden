# Planning authority and live observations

`registry/prs.json` is the sole canonical PR registry. `registry/roadmap.json` is a retired redirect. Its stable work IDs, approved total and mappings are preserved. `plan.json` retains the complete approved v1.0 specification, dependencies, feature mappings, weights and acceptance criteria; its initial status fields are historical. `execution.json` records actual observed GitHub and acceptance evidence. No progress is inferred from an unverified title or numerical coincidence.

Run `python3 scripts/sync_roadmap.py` to check canonical mappings against observations. `--write` fills only nonconflicting observed mappings and preserves unrelated canonical fields. Missing evidence, changed totals/order, conflicting mappings, duplicate PR attribution and conditional-government activation fail closed. This is local reconciliation, not proof that Engine Room has ingested a change.

An actual merged PR is not full independent acceptance or production verification. Bootstrap #1, provider inventory #11 and concurrency follow-up #17 are not extra roadmap units. Do not add historical counts to current observations. The legacy `.exechub` map remains an explicit compatibility projection while the live Engine Room canonical contract is verified.

`runtime-targets.json` contains owner-supplied resource identifiers, not passwords or spending authority. Inspect provider identities and current state before writes. Scope changes must reconcile the canonical roadmap, detailed specifications and validators together; do not silently alter the 196-current/14-conditional baseline. Production and live Engine Room synchronization need separate evidence.
