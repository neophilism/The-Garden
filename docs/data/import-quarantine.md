# Read-only import inventory — GDN-041

`createImportInventory` inventories an already-uploaded, immutable quarantine reference. It does not accept an arbitrary URL or execute uploaded content. No route, scheduler, provider scanner or production worker is activated. Only synthetic inputs have been exercised.

The source is read through the GDN-015 archive boundary with its exact source ID, version, byte count and SHA-256. The GDN-030 audited-decision adapter must derive the subject from verified identity; a trusted authorizer must check current workspace membership, source grants, purpose and historical-only classification. Denials and admission decisions are recorded before protected work. These audit records do not claim that the import operation completed.

Authorization is rechecked after the original read, malware scan, inspection and manifest persistence. Session changes, revocation, disabled capabilities, cancelled work and audit failure prevent a successful response. Archive writes independently recheck authorization. A revocation after a successful private write does not delete the write or report it as released. Sensitive and sealed imports remain disabled under the existing activation requirements.

## Manifest contract

The immutable `garden-import-manifest-v1` is a private JSON object in the same quarantine archive. It contains these logical records; it does not create SQL import tables or mutate the historical corpus:

| Record | Meaning |
| --- | --- |
| `importRun` | Run ID, immutable attempt version, workspace, original reference, declared and detected content types, inspection profile, completeness and technical status. |
| `importedArtifacts` | The checksummed original and successfully inventoried ZIP members. A member hash identifies bytes; it is not an independent source or reviewed claim. |
| `quarantineDecision` | Always quarantined, never released; exact-hash malware result, bounded finding codes, unreviewed rights and historical review. |
| `lineage` | Exact original reference, read-only operation, unchanged source bytes and no recursive format parsing. |
| `database` | Optional bounded SQLite schema names and quick-check result. No source SQL statements or user rows are exported. |

The original always has a checksum and disposition when an inventory is created, including parser failures, detected malware and rejected archives. Interrupted uploads or checksum mismatches never produce an inventory pretending to represent complete bytes. Unvisited/failed archive members are not assigned invented checksums; `inventoryComplete` remains false. Partial inventories never represent all contents.

Identical run/version retries converge to identical bytes. Changed scanner versions/results or a changed original require a new attempt version. A conflicting immutable write is rejected, never overwritten. Scan timestamps and random audit request IDs do not make retry manifests unstable. Each audit admission remains independently correlated by its existing request ID.

The source and manifest use different source IDs. A future manifest lookup adapter must resolve its original lineage and recheck the original's current grants; granting access to an opaque run ID alone is insufficient. There is no manifest listing endpoint. Filenames, schema names and hashes remain private and must be escaped if later rendered. They must not enter public logs or public search.

## Inspection boundary

The Node adapter starts a fixed Python script using an absolute executable, isolated Python mode, no shell, a minimal credential-free environment, bounded output, a five-second wall timeout and cancellation. The Linux parser caps input at 8 MiB, expanded ZIP bytes at 16 MiB, individual members at 8 MiB, entries at 256, address space at 256 MiB and CPU time at three seconds. It extracts no archive member to the filesystem. SQLite alone gets a private temporary file containing the unchanged main database, opened read-only and immutable; extension loading, writes and source-defined queries are not allowed.

ZIP traversal, absolute/drive paths, symlinks/devices, ambiguous normalized names, unsupported encryption/compression, excessive ratios, expansion, corrupt CRCs and truncation are rejected or marked uninspectable. Nested archives are hashed without recursion. ZIP member type detection is preliminary and does not parse those members. Executable/macro/script markers require review. The worker never runs macros, scripts, shell fragments, XML parsers, external entities or archived SQL.

Standalone SQLite runs a bounded quick-check and lists at most 256 schema objects. This only checks the main-file snapshot; it neither applies a WAL nor proves that an omitted sidecar never existed. JSON objects/arrays reject duplicate keys, non-finite constants and malformed/deep input. Other UTF-8 text remains literal. PDF, images, XML and executable signatures are recognized but their formats are not parsed. Declared types must be canonical supported MIME strings; actual byte detection and mismatches remain separate.

Malware checking is an injected trusted integration, not a fake antivirus implementation. Without it, `malware-check-unavailable` holds the import for review. A clean result must bind the exact source hash and identify the scanner/version. An infected result skips parsing. Scanner adapters receive a bounded abort signal and must honor cancellation; failure or timeout cannot become a clean result. Even a clean, fully inventoried file remains quarantined, with no rights or historical approval.

These limits are defense in depth, not an OS isolation claim. Before enabling real uploads, verify a dedicated worker/container, network-egress denial, filesystem isolation, patched parser runtime, an actual malware scanner, private provider storage, authoritative identity/audit adapters, and recovery/operation receipts with the existing fenced job engine. GDN-077 will mount authenticated intake; this PR does not expose a web parser or wire real jobs to unverified adapters.

## Verification and rollback

Run `node --test tests/storage/*.test.mjs` and `python3 -I -m unittest discover -s tests/import -v`. Tests exercise real subprocess text/PDF/truncated-ZIP inventory, immutable storage, denied access, revocation, retries, cancellation and bounded subprocess failure; Python fixtures cover malicious ZIP paths/types, bombs, CRCs, malformed databases, source-defined views, XML external entities and JSON ambiguity. Scanner results in tests are explicitly synthetic. The storage workflow runs both suites.

Disable the inventory capability or revert the worker code to roll back. Preserve all originals, manifests and audit records. No migration, source transformation, public release or cloud mutation is part of this change.
