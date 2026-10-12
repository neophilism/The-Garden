# GDN-045 resumable corpus staging

An unmounted, default-disabled offline capability. Tests use generated fixtures only. The 106 recorded tables and 923,292 source rows have **not** been ingested by this PR. Structural checks and migration do not confer historical verification, rights clearance, public release or independent security acceptance.

## Admission and storage integration

`services/workers/src/corpus-staging.mjs` exports `createCorpusStaging` and `createOfflineStagingWorker`. Compose them only in a separately authorized operator worker. Use the existing `decisions.decide(headers, workspaceId, evaluate)` audited service and an authoritative `authorize(facts, {action:'stage-import',sourceRef,runId,phase})`. Require actual workspace/source grants, permitted research purpose and privileged operator assurance. Inherited source permissions/statuses are never grants. Audit outages deny the operation.

Request input has only `runId` and `sourceRef`. The reference retains the existing Garden quarantine project/branch/bucket/key/source/version/hash/size shape, with a separate 16 GiB offline ceiling. This does not enlarge the 8 MiB storage transport or implement downloads. `resolveSource(principal, sourceRef)` is a **trusted, unimplemented production adapter** returning exactly:

```js
{
  workspaceId, sourceRef, sourcePath, stagingDirectory,
  format: 'sqlite', // or separately reviewed 'typed-ndjson'
  classification: 'restricted_research',
  quarantine: {disposition: 'quarantined', released: false, malware: 'unavailable'}
}
```

Resolve to the exact authorized prepositioned original and a `0700` directory dedicated to that workspace/source/version, outside web roots, checkouts, public backups, search and AI mounts. The original must be outside the staging directory; overlap is rejected before opening a writable journal. Never accept user filenames or create a fresh directory on every retry; that would bypass the shared idempotency namespace. The reference must come from a verified offline quarantine registry, not invented upload evidence. `clean` or `unavailable` malware states permit only private quarantine extraction in the isolated worker; infected, released or sealed inputs are refused. Retain authoritative quarantine/scanner receipts in that registry and its existing audit system. Scanner status grants no historical/rights approval.

Default contracts load the committed CP-017 mapping and hash-pinned inventory. `loadContracts` is a trusted injection for controlled fixtures or separately reviewed export contracts, never HTTP input. CP-017 changes still require the GDN-044 validator. Never rerun historical migrations against original bytes.

There is no `--allow` flag, self-issued authorization file or public route. The subprocess requests fresh parent authorization before reading, during long scans, at each batch commit and at completion. EOF, parent loss, abort and denial fail closed. The parent also checks authorization before resolving storage and returning a receipt. The subprocess receives a scrubbed environment and no application/database credentials. Resource limits are not an OS sandbox.

## Runtime and resource bounds

Use Linux with `/proc/self/fd`, Python 3.10+, SQLite 3.37+ (`PRAGMA table_list`) and Node 24. Deploy a reviewed SQLite security patch level. Python 3.11+ additionally limits SQLite record allocation with `Connection.setlimit`; Python 3.10 retains the process cap. Real activation requires denied egress, a read-only source mount, encrypted private output and temporary volumes, least-privilege identity, disk quota, verified backups/restore and independent assessment under the pinned security standard. No E2EE conformance is asserted.

| Resource | Bound |
| --- | --- |
| Artifact | 16 GiB; exact hash and size pinned |
| Worker virtual address space | 256 MiB |
| CPU / parent wall deadline | 3,600 seconds each; timeout means incomplete quarantine |
| Hash read | 1 MiB; authorization renewed every 32 MiB |
| SQLite cache | 2 MiB per connection; mmap disabled |
| Tables / columns / catalog objects | 256 / 128 / 2,048 |
| TEXT/BLOB cell | 1 MiB |
| Serialized raw row / export line | 4 MiB |
| Batch | At most 256 rows and 8 MiB serialized payload |
| Staging file | 32 GiB process limit; deployment also needs disk quota |
| Worker output buffer | 8 KiB; no row values in receipts |

Oversized cells/rows reject rather than truncate. This PR does not claim every real corpus cell fits these ceilings; establish that during separately authorized real preflight. Profile/limit changes require review. Tests generate a **422,723,584-byte synthetic database**, without opening historical material. Each attempt rehashes the whole source twice and verifies persisted evidence before resume; memory is bounded, while verification time grows with staged data.

SQLite tables must expose an unshadowed `rowid`, `_rowid_` or `oid`. Reject WITHOUT ROWID, virtual/shadow tables and hidden/generated columns. Ordered keyset scans preserve negative, zero and full signed rowids. Exact DDL, ordered column metadata, table inventory and counts must match. The full observed catalog also receives a digest in the binding; GDN-044's original fingerprint still covers recorded DDL/columns only, not previously unrecorded index definitions. Views/triggers are preserved catalog evidence, not executed.

## Preservation and unresolved evidence

`staging_rows` is keyed by artifact hash, exact table and coordinate. Canonical JSON binds the coordinate to table schema, raw destination and initial classification. `binding` preserves the complete mapping/inventory/catalog, including domain/disposition, proposed references, unresolved columns and recovery exceptions. This is a raw-to-staging ledger; normalized writes have not been attempted.

| Storage class | Representation |
| --- | --- |
| NULL | Explicit tagged null |
| INTEGER | Exact signed decimal string, including all 64-bit values |
| REAL | Eight IEEE-754 bytes as big-endian lowercase hex |
| TEXT | Bytes obtained with `CAST AS BLOB`, database encoding, length, SHA-256, base64 and strict decoding outcome |
| BLOB | Original bytes, length, SHA-256 and base64 |

TEXT is never trimmed, Unicode-normalized, date-converted, URL-fetched or parsed as JSON. Invalid encoding retains its bytes and a column-level `invalid-text-encoding` issue. Malformed/duplicate-key JSON-looking strings remain text. Inherited review/rights/verification labels stay inside source cells; each new envelope has `historicalReview: 'unreviewed'`, `rights: 'unreviewed'`, `normalization: 'not-attempted'`, `disposition: 'quarantined'`.

Duplicate rows/identifiers keep their original coordinates. There is **no reference-resolution attempt**: NULL, INTEGER versus TEXT, duplicate keys, missing original guarantees, edition ambiguity and absent target evidence remain unresolved under the mapping. No placeholders, silent merges or verification receipts are created. CP-011 lineage, CP-016 truncation and Marinerito row-223 alignment remain unresolved.

The typed export adapter accepts UTF-8 NDJSON with this first line:

```json
{"format":"garden-typed-export-v1","schema_sha256":"<reviewed metadata digest>","origin":"inherited provenance; original rowids unavailable"}
```

Each later line has exactly `table` and `cells`, each cell carrying the representation above and its exact `column`. Group records by lexical table order, preserve column order, and match trusted counts. Empty tables have no rows. All lines require a trailing newline. Duplicate object keys, corrupt length/hash/base64, unsupported tags, REAL NaN and truncation are rejected; JSON inside TEXT stays uninterpreted. The separately reviewed mapping pins the **export artifact's** hash/size (legacy field names remain `source_database_sha256`/`source_database_bytes`). It cannot use CP-017's hash for different bytes. Coordinates are physical byte offsets, never synthesized original rowids. Origin prose is inherited evidence, not original-byte equivalence.

## Resume, replay, conflicts and audit

An exclusive `flock` serializes the journal. SQLite uses rollback journaling and `synchronous=FULL`. Files are `0600`; symlinks, hardlinks, foreign ownership, unsafe modes and staging schema drift are rejected. Filesystem administrators remain trusted. Preserve the whole directory, including any hot rollback journal, during recovery.

Each batch transaction inserts raw rows, payload hashes, batch digest/chain, linked audit event and checkpoint together. Denial or error at the commit gate rolls all of them back; SQLite recovers SIGKILL interruptions on reopen. An empty preinitialization file can be initialized on retry. States remain incomplete/failed quarantine until final reconciliation. Attempts append actor/workspace/run identity and validation outcome. Conflicting keys, source or contract changes preserve existing rows. Failures record safe codes without source values or parser tracebacks when storage is writable. If the audit disk itself cannot write, return no success; preserve parent decision evidence and investigate storage.

Resume verifies staging schema, bound mapping/inventory/catalog, row hashes and key lineage, batch ranges/digests/chains, linked audit events, table counts and checkpoints. It then seeks after the last committed coordinate per table. Identical retries or a new authorized run ID reuse existing rows/batches and append attempt evidence. A changed workspace/source version/contract/profile cannot reuse that journal. Final source hash and full count reconciliation precede `complete-quarantined`; this state grants no release or serving access.

Commit events also bind the parent's durable authorization-decision request UUID, enabling readback against the existing audit ledger. CI exercises this connection with the actual PostgreSQL audited-decision service and an explicitly synthetic source grant. Receipts contain source hash, counts, audit head and explicit unreviewed/nonpublic flags. Keep receipts/logs as restricted operational evidence. Local hash chains are not signatures or protection against replacement of the entire journal; protected backups and independent anchoring need separate operational acceptance.

## Tests, activation and rollback

```sh
python3 scripts/validate_migration_map.py
python3 -I -m unittest discover -s tests/import -v
node --test tests/storage/*.test.mjs
npm run check
python3 scripts/reconcile_roadmap.py
```

The storage workflow runs generated >400 MB extraction, actual subprocess integration, typed round trips, duplicate replay, SIGKILL recovery, commit denial, audit outage, drift, corrupt lineage/checkpoints/journals, export corruption and access isolation. All existing repository, database, identity, historical-data and browser workflows must pass on the exact PR head. No fixture is downloaded; generated databases are temporary.

Real ingestion is a **separate acceptance operation**: recover authorized CP-017 bytes from `docs/sources/baseline-artifacts.json`; revalidate digest/inventory; prove read-only isolation, encrypted quarantine, operator/source/purpose authorization, scanner handling, quota and restore; execute with restricted evidence; reconcile all 106 tables and 923,292 source rows and review every extraction issue. Preserve source and staging independently. Never commit or publish corpus bytes, source values or private journals. Operational PostgreSQL promotion, historical review, rights/consent clearance and public publication each need their own later evidence and authority.

Rollback disables admission/invocation and preserves the run directory and original source. Never delete committed raw rows, edit checkpoints, erase failed audits or run destructive down migrations. Corrected contracts/profiles need a separately reviewed journal and supersession record. This PR changes no cloud schema, provider resource, existing application route or paid service.
