# Archival sources and lineage - GDN-036

## Boundaries and dependency

The implementation uses GDN-035's existing protected record envelope and version journal. The source plan's direct dependencies GDN-013/GDN-024 remain; GDN-035 is an additional implementation-order dependency, not silently removed from the execution requirements. The dependency was satisfied by merged PR #22 before integration. No source ingestion or publication endpoint is enabled.

A repository, collection, series and archival item are archival units, not historical nations. A witness, edition and digital representation are source forms, not interchangeable counts of evidence. UUIDs remain stable independently of a changing display title. Missing parents and metadata remain explicit nulls; they are not fabricated. A digital representation describes one exact set of bytes and derives from one explicitly identified source. Born-digital material can have a distinct witness record and its digital representation. Neither a declared hash nor an archival catalog statement authenticates the source or establishes permission to publish it.

## Catalog contradictions and corrections

Catalog assertions preserve the exact supplied value, attribution locator and stable ID. Competing dates remain separately attributed assertions. Corrections append an assertion that may supersede a former assertion of the same field; they do not delete or silently change its text. Cyclic, self or dangling supersession is invalid. Record revisions cannot remove old assertions, alter their bytes, or change an established source form/archival level. Reclassification requires a new record and an explicit future editorial decision, not rewriting a witness into another category.

Display titles and optional notes are convenience fields, not an adjudication of every catalog assertion. The protected journal retains all revisions, including prior links and conflicting descriptions. Exact locator/excerpt resolution is GDN-038; provenance strings are not represented as independently validated locators yet.

## Graph correctness

Application validation inspects at most 512 unique nodes and 64 levels with a visited/active-path traversal. It rejects cycles, unknown IDs, incompatible parent types and inaccessible nodes rather than silently truncating. Multiple paths to the same ancestor are not mistaken for a cycle. The SQL trigger independently checks direct edge types and iteratively follows authorized parent/derivation edges with a 512-node bound. It rejects a path back to the proposed record. Archival parent and derivation IDs must be distinct.

All source writes acquire a workspace-specific transaction advisory lock before application row locks. The database trigger uses the same lock for direct SQL writes. Its default VOLATILE semantics intentionally use fresh snapshots for queries after waiting on that lock; changing it to STABLE would weaken the concurrency reasoning. PostgreSQL documents this behavior at https://www.postgresql.org/docs/18/xfunc-volatility.html . The real ephemeral PostgreSQL test races opposite parent writes without the application graph validator: exactly one must commit. Sequential cycle closing must also fail. This is a tested database contract, not a formal proof or protection from a malicious database superuser.

## Authorization

Every source and every inspected ancestor is selected through forced RLS under the verified viewer's current workspace membership, purpose and record grant. A source grant does not grant its witness or parent automatically. Unknown and ungranted targets cause the same denied operation. Read, history and lineage comparison are bounded repository methods, not public URLs. Each uses a workspace-bound ticket so linked records can be independently checked against their own grants. It never treats broad workspace membership as read permission for every record.

The journal remains protected against changes by ordinary query roles; present permissions apply to prior versions. Multi-record reads do not constitute an immutable snapshot across all concurrent catalog edits: results describe a bounded authorized inspection, and later reproducible-publication snapshots must bind exact versions. No long-lived graph or lineage cache bypasses reauthorization.

## Independence is not a record count

`compareSourceLineages` exposes common known witness roots and unresolved edition roots. Two scans of one edition share one root even when their file hashes differ. Two distinct witness roots are *not automatically independent testimony*. The result always returns `independence: not-established` and `independentEvidenceCount: null`; editorial evidence is required to establish stronger conclusions. Missing edition provenance is an unresolved root, never an invented original witness.

## Verification and activation

The Node tests cover each archival/source form, contradictory dates, immutable correction history, edition/digitization distinction, malformed metadata, typed parents, missing references, cycles and bounds. The separate ephemeral PostgreSQL journey checks real RLS, history, direct SQL mutations, source projections, grant and membership revocation, and concurrent parent updates. Database fixtures use synthetic identity adapters; the independent Better Auth workflow continues to exercise the actual authentication implementation. No cloud migration or real archival record is claimed by these tests.

Migrations are additive and checksum-locked. Run the existing migration planner and all six CI workflows. Rollback disables these unmounted repository entry points or reverts the application artifact while preserving journal/source rows; never erase successful writes to simulate rollback. No scan files, licenses, sensitive family records, credentials or costs accompany this implementation.
