# Read-only corpus preflight

Use this operator diagnostic only for source bytes the operator is authorized to inspect. It does not stage rows, issue application grants, upload to a provider, mount routes or satisfy live ingestion acceptance. The owner authorized use of the real corpus for development on 12 October 2026. Hosted ingestion remains subject to the actual authorization, isolation and recovery controls in [the staging runbook](corpus-staging.md).

Recover the exact CORE archive through its authorized saved location in `docs/sources/baseline-artifacts.json`. Check its full SHA-256 and all member CRCs, then stream only the named `corpus_v1_17/research.sqlite` member into a new private operator directory outside the checkout and web roots. Never execute source scripts or migrations, extract arbitrary archive paths, replace an original, or substitute the defective recovery database. Preserve the extracted bytes read-only and check their expected size and SHA-256. A changed or mismatched local copy is rejected; recover a fresh copy from the hash-verified archive rather than editing it.

On Linux, with Python 3.10+ and the staging worker's SQLite requirements:

```sh
python3 -I services/workers/import/preflight.py \
  --source /private/cp017/original.sqlite \
  --report /private/operator-reports/cp017-preflight.json
```

The report directory must already exist, belong to the operator and allow no group/other access. Reports are exclusive-created with mode 0600; existing paths and symlinks cannot be overwritten. The CLI always uses the committed, hash-pinned CP-017 mapping and inventory. There is no grant flag or client-supplied schema. Hash/size/DDL/count drift, live sidecars, unsupported schemas, cancellation, invalid paths and resource limits fail without a complete report. Low-level parse errors and source values never enter CLI errors. A killed process can leave a partial report file; only a complete JSON document with the completion status is usable, and a subsequent attempt must use a new report path.

The scanner reuses the actual typed-cell and raw-row serializer under the worker's 256 MiB address-space limit. It holds at most one row and bounded table/column counters, preserving INTEGER/TEXT distinctions while reporting only storage-class counts, value sizes and invalid-encoding counts. No raw values, row identifiers, source prose, references or example records appear in the report. It hashes the source before and after the complete scan and checks source identity throughout. OS isolation and protected storage still require independent evidence; a read-only file mode is not an isolated live worker.

Keep reports in private operational storage, outside GitHub and public artifacts. Source-derived counts, hashes and profile measurements are not automatically cleared for repository publication. Original archives remain recoverable from the existing manifest. Twelve generated-fixture regression tests cover mixed storage classes, duplicate identifiers, invalid text, exact payload measurement, cancellation, drift, source mutation, sidecars, limits, private output and safe CLI rejection. No real source is downloaded by CI.

Use the measured payload plus indexes, pages, audit, checkpoints, assembly and backups to check approved storage capacity. An existing private bucket does not establish uploaded objects, operator grants, deployed migrations or safe ingestion. No new paid capacity is implicit.

Development consequences: implement resumable, checksummed source admission (GDN-077); configure a real private source registry and independently accepted isolated worker; then execute and reconcile raw staging. Use stable source coordinates and explicit unresolved references in researcher workflows. Document/footnote migration (GDN-046), media/rights migration (GDN-047), full reconciliation (GDN-048), historical review and any publication remain separate work. No historical assertions become verified through this scan.
