# Current continuation — 11 October 2026

## Verified baseline

GDN-044 / PR #35 is merged at `3cfd7584fee08cc87d0fffc0fac839b5e9d73913`. There are 31 mapped engineering merges. Independent acceptance and production verification remain unperformed; maintenance PRs do not add roadmap units.

| Work item | PR | Final tested head | Confirmed merge |
| --- | --- | --- | --- |
| GDN-040 structured editorial content | #32 | `656b16a9774da9ff9e4f1622efe1532e36956b47` | `e0c98404757c05337116b2a2fb52c1896a3dbcfb` |
| GDN-095 sourced geographic assertions | #33 | `75b64e576dff4021cd0a6b98b155735e1305ddaa` | `d55a3ea953c6b009945bb572817f30dd5040f65a` |
| GDN-041 read-only import quarantine | #34 | `3d9401e3d5a05320bf14275de58c67a354dea68d` | `d789ed5e440a19d07a35f8a3fdfa8863b9d76d54` |
| GDN-044 explicit source-table mapping | #35 | `b2b4eb3ef9f656e305f5cc06c033ba0f46b65ec2` | `3cfd7584fee08cc87d0fffc0fac839b5e9d73913` |

All six workflows passed for each final tested head: repository, database, identity, storage, historical data and quality/browser. Full run IDs and limitations are recorded in `plan/execution.json` and each work item's evidence. PR #33's PostgreSQL JSONB-order identity bug was corrected and all checks rerun before merging.

## Current capabilities and limits

Editorial previews bind structured content to exact policy drafts, claim revisions and scoped reviews; they do not approve publication. Geographic assertions preserve sourced, dated, uncertain and competing extents; sensitive locations are omitted from the general research/map projection. The bounded import worker preserves immutable original bytes and private manifests; every result stays quarantined, and no real malware scanner or hosted worker is activated. The source mapping covers 106 recorded tables and 923,292 source rows without upgrading them into people or verified claims. Its schema fingerprint covers the recorded table DDL/columns, not missing index definitions or a new source-byte inspection.

## Next dependency-ready work

GDN-045 can implement the idempotent raw corpus staging importer using the now-merged quarantine and mapping contracts. Before a real import, revalidate exact authorized source bytes, use read-only extraction, preserve typed cells and stable source/table/row coordinates, and verify batch resume/replay/conflict handling. The current 8 MiB inspector must not be used for the 396 MiB corpus database or large bundles. Original hashes and saved source locations are in `docs/sources/baseline-artifacts.json`; do not commit corpus bytes or rerun historical migrations.

GDN-077 resumable uploads is also dependency-ready for implementation. Identity/source authorization, exact owner/digest/size binding, quotas, interrupted chunks, quarantine and real provider behavior must be verified before mounting endpoints. Existing storage buckets do not satisfy those activation gates.

## Deployment state

The authorized deployment target remains recorded in the existing resource registry. The available Render creation tool cannot place a service in that target project. This is a placement limitation, not a need to repeat account setup. No deployment, resource creation or new spending occurred in this continuation.

## Continuation and release boundaries

The nine-page public orientation remains a nonindexable preproduction build. Sensitive research, real source uploads, sealed material, AI and governmental administration remain unmounted/disabled. Synthetic fixtures confer no historical review, rights clearance, independent security assessment or production readiness.

Read AGENTS.md, registry/roadmap.json, plan/execution.json, plan/progress.json and relevant contracts. Engine Room source mappings are reconciled; live ingestion/readback remains unverified. No recurring scheduler or unattended development worker is running.
