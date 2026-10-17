# GDN-047 AI-assisted implementation review

This is implementation/source review with executable negative tests. It is not an independent human audit or certification. The owner's current policy defers that external review while development and testing continue.

## Reviewed boundaries

- Original DOCX bytes are opened read-only, hashed twice, identity checked and never extracted or rewritten. Names, ZIP entry types, duplicate/casefold collisions, expansion, XML entities/DTDs, depth and output size are bounded. External targets remain text; no network client exists in the scanner.
- Hash matches establish bytes only. Edition and placement correspondence uses exact document/locator evidence. Duplicate or null inherited IDs, contradictory image classes, changed captions/alt/title, unresolved transformations and unavailable rights are retained as findings.
- The operator request cannot inject local paths, credentials, grants, inherited review flags, a parser or a publication decision. Trusted source resolution, all evidence-source grants, session continuity, audit availability, repeated scan/commit gates and final delivery are checked separately.
- Detailed reports are bound to workspace and subject and retained in a checked private append-only SQLite schema. Replay cannot overwrite an existing run. A denied final response does not erase already committed evidence.
- The optional byte guard is disabled and unmounted. Unknown rights deny before byte reads; current exact annotation and placement review, immutable byte hash/length and post-read revocation checks prevent stale receipts from authorizing a changed caption, generated label or file.

## Findings fixed during implementation

1. An inherited document ID can repeat across editions. Placement matching now requires uniqueness in both the digest selection and original ID mapping; ambiguous rows remain visible.
2. Repeated annotations for identical DOCX bytes under different edition labels could otherwise bleed into the wrong edition. Annotation lookup binds the edition label, document digest, member and media bytes together.
3. Source grants on document bytes alone would omit evidence embedded in rights and transformation annotations. Admission and detail delivery include the full set of referenced source hashes, including transformation originals.
4. Raw SQLite coordinate strings must preserve signed 64-bit identity. Out-of-range values and negative zero are refused instead of accepted as a new synthetic coordinate.
5. Repeated large byte/annotation comparisons were indexed so current-document reconciliation does not repeatedly scan every legacy asset or annotation for every member.

## Explicit remaining limits

The trusted production source registry, real GDN-045 raw-row adapter, actual item reviews and operational PostgreSQL asset promotion are not activated. No generated or archival label is inferred from an image's appearance. The scanner observes XML references and metadata, not rendered pagination or a bitmap's visual truth. File modes and local hashes do not replace deployed encryption, OS read-only mounts, quotas, malware policy, private backups or independent anchoring. Public integration must retain the existing delivery MIME/range restrictions and use safely generated derivatives.

The real-source observation scanned one CP-021 document and compared all four image/document tables from the actual CP-017 and CP-021 SQLite originals. Source hashes and physical rowids were preserved. The 567 exact byte matches, 40 current media members without legacy asset rows, and absent current-edition placement bindings are recorded as aggregate evidence. Equal placement totals did not cause a 1.32-alpha to 1.33-alpha retargeting. Rights annotations were not loaded, so this operation cannot conclude that the broader corpus lacks those records or that operational migration/publication is complete.
