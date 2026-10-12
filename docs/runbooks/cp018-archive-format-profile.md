# CP-018 archive-format profile (read only, October 12, 2026)

The four immutable v1.18 corpus archive components are still held outside GitHub. The owner requested that real archived research shape the Garden's actual research collaboration functionality. To avoid importing unreviewed records merely because they are available, this checkpoint performs a bounded **format/custody inventory only**. The pinned source hashes and sizes were checked before any ZIP was read.

Read the structured, aggregate [evidence](../evidence/CP-018/READ_ONLY_SOURCE_FORMAT_PROFILE_2026-10-12.json) and [reproducible profiler](../../scripts/profile_cp018_component_archives.py). No names, transcript text, catalog field values, private document paths or other record contents appear in the output. The program does not extract the ZIP members, open their SQLite databases, read uploaded images, run migrations or promote any candidate into the public Garden website.

The observed archive shape has **360 file members** across CORE, EXPORTS, SOURCES and RECOVERY. These include two SQLite databases, 109 NDJSON members, 198 JPEG/PNG images, four PDFs, two HTML files and other metadata and guides. Counting raw ZIP member names does not establish 360 distinct sources, 198 independently licensed images or any number of people. The total **969,621 NDJSON lines** is a physical-file line count, not the database's 923,292 recorded source-table rows; these measures have different meanings and should not be reconciled as if they counted the same entities. Duplicate versions, derivative records and unreviewed recovery evidence must remain distinct.

**Design consequence:** GDN-078's generic RIS/BibTeX/CSL citation intake is appropriate for incoming bibliography and DOI catalog records, but it **does not itself import** the actual CP-018 corpus. Real data uses SQLite, NDJSON, heterogeneous JSON source metadata, page imagery and PDFs. The reviewed GDN-044 mapping and disabled GDN-045 staging importer remain authoritative for raw database custody. GDN-079's future document conversion, image derivative and safer reader workflows need exact original file lineage, rights flags and size bounds. The SOURCES archive's image members especially require source-specific provenance/licensing and human historical description; a file extension is not proof of historical identity.

To reproduce on a workstation authorized to access the originals, first obtain all four original ZIP bytes and the current `policy/SOURCE_MANIFEST.json`, then run:

```sh
python3 scripts/profile_cp018_component_archives.py \
  --source-dir /secure/originals \
  --manifest policy/SOURCE_MANIFEST.json \
  --output /secure/reports/cp018-format-profile.json
python3 -m unittest discover -s tests/migration -v
```

The profiler performs whole-archive SHA-256 and exact byte-count checks, rejects ZIP path traversal, symlink entries, duplicates, encryption and declared large expansions, and emits only aggregate file-kind counts and one-way JSON-shape fingerprints. Bounded-memory `.ndjson` line counting does **not** parse, review, or approve its contents. Any actual source copy into a Garden staging database requires separate operator access, complete verified migration contracts, evidence-chain retention, privacy and rights controls, source-specific authorization, and independent acceptance. These checks make no claims about source historical accuracy, relationships between records, licenses or security certification.

No new provider accounts, paid storage, public routes or private corpus exports were created for this checkpoint.
