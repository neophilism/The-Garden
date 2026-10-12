# ADR 0014: offline, transactional historical corpus quarantine

Status: GDN-045 implementation merged in PR #37; independent and live acceptance pending.

Keep the 8 MiB limits of the GDN-041 inspector and storage transport. Use a separate Linux/Python offline worker with bounded reads and a private SQLite staging journal, admitted through the existing audited decision-service interface. The server resolves authorized references to prepositioned, quiescent original bytes and a private staging directory. Requests never provide paths, schemas, grants or parser commands. No application endpoint is mounted.

Open the source read-only and immutable, bound to a checked file descriptor. Hash, size, table DDL, column metadata and row counts must match the reviewed mapping. Refuse live WAL/SHM/rollback-journal sources, unsafe paths, unsupported schemas and drift. Recheck source identity at commits and the entire hash before extraction and before technical completion. An OS read-only source mount is additionally required: cooperative locks and stat checks cannot protect against a privileged writer.

Commit typed rows, batch evidence, linked audit event and checkpoint in one transaction. Serialize attempts with an exclusive process lock. Before resume, verify stored schema, binding, row hashes and lineage keys, batch/audit chains and checkpoint counts, then seek past committed source coordinates. Replay adds attempt evidence without another raw row. Conflicts retain prior bytes and quarantine. Local hashes are tamper evidence, not independently anchored or administrator-proof immutability.

SQLite identity is artifact hash, exact table and original signed rowid. Declared types never coerce observed storage classes. A versioned typed NDJSON adapter instead uses export artifact hash, exact table and physical record byte offset; it never invents original rowids. SQL dumps, CSV, ZIPs and legacy exports lacking a reviewed typed adapter are rejected. Export metadata does not prove inspection of its alleged original database.

Preserve mapping dispositions, recovery exceptions, candidate relationships and raw destinations. Envelopes remain quarantined, unreviewed and unnormalized regardless of inherited labels. No resolved links, normalized records, grants, rights receipts or public projections are created. Future PostgreSQL transfer needs separately authorized raw lineage and reconciliation, not public/application credentials.

Standard-library SQLite avoids adding a dependency or paid service. See [the operating contract](../runbooks/corpus-staging.md) for exact resource limits, integration prerequisites, rollback and separate real-ingestion acceptance gates.
