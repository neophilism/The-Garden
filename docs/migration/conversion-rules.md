# CP-017 explicit conversion and reference contract — GDN-044

`migration-map.json` gives every one of the 106 recorded tables a disposition, exact row count, ordered column mapping, raw destination, candidate reference rules and recovery limits. Its 923,292 rows are source records, including repeated editions and legacy state. They are not 923,292 people, independent witnesses or verified claims.

The input is the committed GDN-002 `source-schema-inventory.json`, originally derived from the immutable CP-017 database. This PR inspects the recorded DDL and column metadata; it does not reread 396,087,296 database bytes or inspect the research rows. The database SHA-256 is `3bc3b81b7a2ffaaf2a5a0a072ddf781c8688785aa67b3d6069cca5a9918d3ed0`. The complete inventory file and each table's recorded schema are separately pinned. The schema fingerprint covers table DDL and column metadata only; the 186 index definitions are absent from this input, so this is not a fingerprint of the complete SQLite schema catalog.

## Dispositions and source identity

All dispositions preserve every raw row first:

| Disposition | Meaning |
| --- | --- |
| `raw-preservation` | Keep a lossless raw record with its source identity; a normalized model is deferred. |
| `normalized-candidate` | An existing domain contract is a possible destination. Missing fields, source/locator revisions and review requirements must be resolved before conversion. No normalization runs here. |
| `legacy-snapshot` | Retain the exact version/checkpoint namespace and historical state. Do not overwrite it with a current edition or replay old corrections. |
| `unresolved-recovery` | Preserve a recovery report or reconstruction exception with its known limits. Do not create missing rows or imply original-byte equivalence. |

A raw row key is `(source_database_sha256, source_table, sqlite_rowid)` from a read-only handle on the exact pinned source. The extractor must verify that the actual table is a rowid table and record the original rowid as a signed decimal string. It must not invent a rowid from export order, a row count or a guessed legacy ID. A modified or rebuilt SQLite file has a different source namespace; rowid is not stable across arbitrary database rewrites and is never a historical identity. An export without original rowids needs its own artifact/member/record-coordinate identity and explicit lineage; it cannot impersonate this extraction.

No table in the recorded inventory declares a primary key or a foreign-key reference in its table DDL. This does not establish that no unique indexes or application constraints existed. A column called `id` is not proof of a unique/non-null key. Preserve duplicate/null legacy keys and every duplicate row. Candidate normalized keys are checked for missing values and exact typed duplicates before linking; ambiguities become issues, never silent merges or dropped rows.

## Raw conversion policy `cp017-lossless-raw-v1`

Retain the immutable original database bytes independently of any decoded export. For each value, retain its observed SQLite storage class and value. Declared `TEXT`, `INT` or `INTEGER` affinity is metadata, not permission to coerce an observed value.

| Observed storage class | Raw representation rule |
| --- | --- |
| NULL | Explicit tagged null; do not replace with empty text, zero or unknown prose. |
| INTEGER | Tagged signed decimal string, preserving integers beyond JavaScript's exact-number range. |
| REAL | Tagged exact binary64 representation, with a documented encoding; do not round through locale-formatted decimal text. |
| TEXT | Preserve Unicode/codepoint sequence and an exact encoding record. Invalid decoding becomes a retained extraction issue; do not substitute replacement characters silently. |
| BLOB | Tagged original bytes, base64 only for transport, plus byte count and SHA-256. |

Do not trim, case-fold, normalize Unicode, interpret dates, rewrite URLs, execute SQL, fetch links or parse JSON-looking strings during raw preservation. JSON columns remain original text until a separately versioned parser preserves malformed and duplicate-key cases. Column order, declared type/nullability and original DDL remain bound to the table schema hash. This contract does not implement the future raw-row serializer.

Normalized conversion must preserve an explicit raw-to-target ledger. It needs an exact source revision, field transformations, target version and unresolved reasons for every excluded candidate field. Inherited `status`, `review_state`, `judgment`, confidence, rights or verification strings remain inherited evidence; they do not issue current review receipts, grants, rights approvals or public-release decisions.

## References and domain candidates

Every identifier-reference column has either candidate target tables or an explicit unresolved-reference disposition. These are proposed field relationships, not database-enforced foreign keys or row-level validation. Resolve only by exact typed keys in the correct source/table/edition namespace after uniqueness checks. Null, missing, ambiguous or cross-type matches retain the raw row and open an issue. Never create placeholder entities or cast a key to force a match. Do not perform recursive/cascading merges.

The actual `evidence.unit_id` declaration is INTEGER, whereas IDs in the unit tables are TEXT. Its candidate relationship stays unresolved until source evidence supports a deliberate conversion; numeric equality is insufficient. `unit_id` also appears in legacy, current and edition contexts, so table names and column spelling alone cannot select an edition. `source_record_id`, sequence row numbers, names and appearance cannot establish personal identity or ancestry.

Candidate destination contracts include archival units/sources, entities, claims, evidence links, claim placements and exact locators. For example, the 1,033 `sources` URL/kind/review rows do not provide every mandatory source-form, catalog, provenance and representation field. The 40,183 `claim_candidates` remain candidates; segmentation and exact evidence are required. The 421,084 `edition_current_units` remain distinct edition snapshots; the 161,790 `external_records` remain dataset entries. No count is silently deduplicated into people or facts.

The existing table-disposition domain/classification rules remain the baseline. Each table now adds explicit column preservation, key handling, references and conversion conditions. All candidate destinations stay nonpublic and normalization is disabled. Changes to the mapping require a versioned correction and a fresh review of the exact diff.

## Recovery, verification and rollout

CP-011 original-schema lineage, CP-016 truncated export and Marinerito row-223 alignment remain unresolved. The mapping preserves the original expected/actual counts, hashes, actions and witness uncertainties when future extraction occurs; it does not reconstruct missing originals. GDN-045 must reconcile source hashes, every table and row, retained issues and the raw-to-target ledger before promotion. The existing 8 MiB GDN-041 inspector cannot process the 396 MiB database or large corpus bundles; a reviewed streaming/offline import path is still required.

Run `python scripts/validate_migration_map.py` and `python -m unittest discover -s tests/migration -v`. The validator rejects dropped/duplicated tables or columns, schema/count drift, changed source fingerprints, invented key guarantees, missing reference dispositions, classification broadening, automatic release and erased recovery gaps. CI also runs the existing plan/architecture checks. These are contract checks, not a migration or independent historical review.

Rollback restores the prior compatible mapping with an explicit correction record. It never alters corpus bytes, deletes raw rows or replays inherited migrations. No cloud schema or source content changes in this PR.
