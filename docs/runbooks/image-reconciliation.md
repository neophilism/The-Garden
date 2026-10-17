# GDN-047: per-edition image, placement and rights reconciliation

The implemented capability scans authorized DOCX originals read-only, reconciles image evidence into a restricted offline journal, and supplies a default-disabled review guard for later byte delivery. It does not publish files, classify depicted people, clear rights, mutate source documents, or populate the operational PostgreSQL asset tables.

The actual CP-021 manuscript, edition **1.33-alpha**, was inspected on 17 October 2026 with this scanner. Its exact 230,827,832 bytes yielded **607 media members, 607 distinct byte assets and 630 stored image placements**; all 630 image references resolved to media. One member had no resolved placement. These numbers describe this document and this parser scope. The CP-017 **567 assets / 591 placements** and the previously recorded **591 media / 615 placements** describe other snapshots; they are not overwritten or relabeled as current. See the [source observation](../evidence/GDN-047/source-observation.json).

The real-source comparison then read the four mapped image/document tables from the hash-verified CP-017 and CP-021 SQLite originals, preserving every physical rowid. **All 567 legacy byte assets match current media exactly; 40 current members have no legacy asset row.** CP-021 has 1,221 placement rows, but they refer to editions **1.18-alpha (591)** and **1.32-alpha (630)**. Although CP-021 registers the current **1.33-alpha** document's digest, none of its placement rows bind to those exact document bytes. The matching count of 630 does not authorize retargeting earlier placements to the current edition.

Image-budget annotations were not loaded. A missing annotation in this operation means **not supplied to this reconciliation**, not that the broader research corpus has no rights or caption information. Actual byte/row comparison is complete within this four-table scope; current-edition operational promotion, rights adjudication, historical verification and public release remain pending.

## Units and exact identity

| Unit | Identity and interpretation |
| --- | --- |
| Document | Trusted document/edition identifiers plus exact DOCX SHA-256 and byte length. An edition label alone is insufficient. |
| Media member | Exact ZIP member path within the exact DOCX; original member bytes are streamed and SHA-256 checked. Two members with the same bytes remain two members. |
| Distinct byte asset | SHA-256 plus byte length. Equality proves byte identity, not the depicted subject, caption, source independence or reproduction rights. |
| Stored placement | Exact document hash, Word XML part and expanded-namespace element locator, with a deterministic placement ID. Repeated uses of one image remain separate. |
| Rendered placement | Not measured. `renderedPlacements` stays `null`; DrawingML/VML fallback choices and SVG alternatives may contain multiple stored references for one displayed image. |
| Legacy row | Original artifact digest, exact table and original signed SQLite rowid or typed-export physical byte offset. Inherited IDs may be missing or duplicated. |
| Annotation | Exact edition, document bytes, member bytes and optional exact placement, plus traceable source coordinates. Metadata is an inherited assertion until separately reviewed. |

Byte matching may connect an old asset row to current bytes across editions. **Placement matching requires the exact same document bytes, an unambiguous legacy document ID, and an exact part/locator match.** Renaming, row order, a similar pose, a familiar filename or a prior label is insufficient. Legacy XPath dialects that do not match the current expanded-namespace locator remain unresolved; no guess or lossy XPath rewrite is performed.

## Scanner contract and limits

`services/workers/import/images.py` is a standard-library, read-only worker invoked by `createOfflineImageScanner` in `services/workers/src/image-reconciliation.mjs`. It reads all supported `word/**/*.xml` parts, including headers, footnotes, endnotes and glossary parts. It resolves OPC image relationships without fetching external targets. Media paths, hashes, declared content types, original alternative text/title properties, raw crop/extent attributes, original relationship targets and alternate markup context remain exact observations.

Captions are not inferred from nearby paragraphs. Image encoding is not decoded and image content is not visually authenticated. Declared MIME types are not proof of safe rendering. Strict OOXML image markup is explicitly marked unsupported, rather than reported as a successfully rendered edition. Missing and duplicate relationships, unsafe targets, unsupported image references and unplaced media become findings. The immutable original remains the authority for any unsupported content.

The worker rejects ZIP traversal, symlink entries, duplicate/colliding names, unsupported compression/encryption, expansion limits, XML entities/DTDs, malformed XML, source hash/size changes and unsafe source aliases. It never extracts media to disk or executes macros, nested documents, scripts, XML entities or archived code. It is an image inventory, not a malware scanner or a complete document renderer.

| Limit | Bound |
| --- | --- |
| DOCX original | 1 GiB, exact digest and size required |
| ZIP members / total declared expansion | 20,000 / 2 GiB |
| One member / one XML part | 128 MiB / 32 MiB |
| Compression expansion ratio | 1,000:1, then reject |
| XML part | 350,000 nodes, depth 100, locator length 12,000 |
| Stored image references | 20,000 per document |
| Scanner report | 48 MiB, never truncated |
| Subprocess address space / CPU / wall deadline | 768 MiB / 600 seconds / 600 seconds |
| Concurrent worker operations | 1 by default, configurable up to 2 |
| Reconciliation input | Up to 24 documents; 20,000 rows per legacy table and 20,000 annotations |
| Reconciliation report / private byte guard | 64 MiB / 8 MiB |

Sources are hashed before inspection and again before completion, with file identity rechecks. The production operator must still provide an OS read-only source mount and encrypted private output volume: a hash and process resource limit cannot protect against a privileged writer or replace OS isolation. The child receives a scrubbed environment without application/database credentials, and its stderr never enters API errors. Denied egress remains a deployment control.

## Audited admission and restricted persistence

Compose `createImageReconciliation` with the existing `decisions.decide(headers, workspaceId, evaluate)` service, an actual authorizer, the private corpus registry and `createPrivateImageReconciliationRepository`. It is disabled by default and has no mounted application route. No `--allow`, caller approval flag, caller path or request-supplied parser exists.

Requests have only `{runId, bundleId}` for reconciliation, or `{bundleId, inputDigest}` for authorized detail retrieval. `resolveBundle(principal, bundleId)` is a **trusted registry integration**, not implemented as a public resolver. It returns:

```js
{
  workspaceId,
  bundleId,
  classification: 'restricted_research',
  sources: [{
    sourcePath, // authoritative local absolute path, never HTTP input
    document: { editionId, documentId, sha256, size },
    quarantine: { disposition: 'quarantined', released: false, malware: 'clean' }
  }],
  legacySnapshot, // null explicitly records unavailable comparison input
  annotations    // exact, evidence-bound annotations; [] grants no rights
}
```

`malware: 'unavailable'` allows only this isolated, restricted inspection. It is not a clearance. Sealed, released or infected descriptors are refused. The authorizer must enforce privileged operator access, workspace/bundle grants, research purpose, all document and legacy artifact grants, and every annotation/transform source grant. The worker renews audited authorization during hashing, each XML/media stage, commit and delivery; identity changes, aborts, audit outages and revocation deny the operation.

The private repository requires a real `0700` directory outside the checkout and web roots, owned by the current process, with `0600` SQLite files. Keep it outside public backups, indexing, AI retrieval and exports. File permissions are **not encryption**. The deployment must supply accepted encryption/key custody, volume quota, denied egress and private backup/restore arrangements. Existing GDN-026 work owns the broader encryption integration; this feature does not bypass it or claim E2EE.

The journal stores immutable report snapshots, run bindings and the exact authorization decision ID for each completed attempt. Its schema and append-only triggers are checked on reopen. Identical input reuses one projection, including retries under a new run ID. A reused run ID with different input or principal is rejected. Failed scans or commit-time denial produce no completed snapshot; the existing audited decision service retains the denied request. A denied final receipt can leave a successfully committed private snapshot, which is recoverable only through fresh authorization. Hashes detect changes; they are not administrator-proof or independently anchored signatures.

## Legacy and annotation adapters

`validateLegacyImageSnapshot` accepts the exact four mapped source tables: `documents`, `assets`, `asset_members`, and `image_placements`. Each table entry has `{coordinate, record}`; every original column from the committed CP-017 schema must be present. Examples of original coordinates are `rowid:-23` and `byte-offset:8192`. Never substitute the row's `id`, its ordinal in an array or an invented original rowid.

The runtime registry adapter must read these rows from authorized GDN-045 raw staging and verify their source artifact, table, row coordinate and typed values against the journal. That production adapter is not activated by this PR. The separately authorized local observation read the four original SQLite tables directly in immutable/read-only mode; it is not a GDN-045 hosted ingestion claim. This bounded projection accepts losslessly representable text, null and safe integer cells; an unsupported raw cell fails the adapter rather than silently coercing or omitting it. The original typed staging record remains preserved. Raw legacy JSON such as `crop_json` remains exact text and a comparison finding; valid JSON alone does not prove equivalent crop coordinates.

Annotations preserve creator/title/date and repository information, collection/reproduction identifiers, exact item and image URLs, rights statements and access dates, provenance, caption, alternative text, inference limits, permitted argument, prices, original/derivative hashes and transformation parameters. Unknown pricing uses exactly **“Cost could not be ascertained.”** A public-domain or license string is stored as a **claim**, with evidence, rather than an approval. Unknown classes, conflicting archival/generated annotations, missing labels, missing rights evidence and derivative binding differences are explicit findings.

## Public-byte denial and later integration

The reconciliation projection sets every asset and placement `publicBytesAllowed: false`, with top-level `publicationApproved: false` and `publiclyAccessible: false`. These values cannot be supplied or overridden by a request.

`createReviewedImageByteReader` is a separate, unmounted trusted guard for a later cleared-byte delivery composition. It starts disabled. The caller provides only a release ID; server services resolve the immutable placement/annotation/reference and a current review receipt. Before reading and again before returning bytes it checks:

- Current authorization and feature state, with unchanged exact release metadata.
- Exact document, media, placement and annotation digest binding.
- Supported class, explicit generated/reconstruction label, caption, alt text, inference limit and permitted argument.
- Rights statement, evidence and a permissible claimed rights status; **unknown, prohibited and permission-required states deny even an otherwise approved receipt**.
- Current, unrevoked, unexpired rights, consent, historical, privacy and derivative reviews.
- Source/derivative lineage and exact returned byte hash and length.

This guard does not create derivatives, provide HTTP caching, grant anonymous access or replace the GDN-015 private store and GDN-029 purpose policy. The future integration must still use the ordinary delivery MIME/range restrictions and safe generated derivatives, and avoid rendering untrusted SVG/HTML. A successful synthetic guard test is not a public release or a license.

## Verification, activation and rollback

The added tests are discovered by the existing application and storage workflows:

```sh
node --test tests/data/image-reconciliation.test.mjs
node --test tests/storage/image-reconciliation.test.mjs
python3 -I -m unittest discover -s tests/import -p 'test_images.py' -v
```

They cover legacy/current denominators, exact bytes, duplicate rows/placements, edition boundaries, original metadata, ambiguous relationships, generated labels, missing rights, conditional byte denial, source mutation, archive/XML attacks, authorization revocation, audit outages, replay, conflicts and private journal recovery. Fixtures are generated, not historical claims. Actual CP-021 inspection is recorded separately from those tests.

For activation, bind the actual private corpus registry and authoritative rights/review services; verify the operator and every source grant; run the exact deployed SHA against authorized per-edition documents and staged legacy records; inspect every disposition; verify denied access, original hashes, private backup/restore and current byte denial. Operational asset-table promotion, historical/rights adjudication and public publication remain separate actions with their own evidence. Independent human security review is deferred follow-up under the owner's current policy, not an excuse to stop implementation or testing.

Rollback disables invocation and the optional byte guard. Preserve original documents, raw staging, existing reports, audit events and consent withdrawals. A corrected profile, caption or mapping creates a new digest/snapshot; it does not alter prior rows or replay historical source migrations. Never run a destructive down migration or delete mismatches to make counts agree.
