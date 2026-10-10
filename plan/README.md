# Planning authority and live observations

`plan.json` is the complete approved v1.0 planning baseline, including dependency DAG, feature mappings, fixed weights and acceptance criteria. Its initial status fields are preserved as a planning-time snapshot. `execution.json` contains subsequent observed GitHub and acceptance states. Never add snapshot counts to observed counts.

An observation may describe an actual PR without asserting full acceptance of a planned work item. Bootstrap PR #1 preserved the plan and is not mapped as implementation of 210 items. Explicit planned-ID to actual-PR mapping is mandatory. Merged, accepted and production-verified are separate states; absent evidence remains unverified.

`runtime-targets.json` records owner-supplied identifiers only. Authentication and provider inspection remain required before resource writes. It contains no secrets or spending authorization.

Scope changes must update the authoritative plan, dependent documentation and validators. Operational progress changes update execution evidence without rewriting the original approvals or denominator history. Engine Room requires its real contract and a verified ingestion acknowledgement before synchronization is reported as successful.
