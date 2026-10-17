# Retained-record lifecycle dependency metadata

This component extracts a bounded, deterministic dependency inventory from supplied historical record revisions. It supports the verified v1 source, locator, claim, entity, relationship and geographic contracts through migration 0013. It is independent of requester storage, future operator decisions and live lifecycle controls.

The implementation is [dependencies.mjs](../../packages/domain/src/lifecycle/dependencies.mjs); its synthetic acceptance cases are [lifecycle-dependencies.test.mjs](../../tests/security/lifecycle-dependencies.test.mjs). The source baseline is verified main `bff5048543ee336162ff01e306cf56d3a656e36c`. Existing migrations and domain validators are preserved.

## Meaning and trust boundary

Every result has `effectsVerified: false` and `physicalErasureAuthorized: false`. Closure results additionally have `authorityVerified: false`, `materialInventory: "not-inspected"` and `globalCompleteness: "not-established"`. They contain no allow decision, tombstone, removal queue entry, completed export, purge instruction or provider call.

`completeness: "complete"` means that the supplied snapshot is consistent with the separately supplied retained-revision manifest, all recognized reference checks succeeded, and traversal finished within the requested bounds without unresolved findings. Its explicit scope is `supplied-retained-manifest`. The pure function cannot authenticate the manifest or prove that an upstream query omitted no records. Rewriting both the manifest and snapshot consistently cannot be detected without a separate authoritative control anchor.

The eventual host must obtain the expected manifest independently of the requester and the extraction results, under current operator authority and a coherent database snapshot. It must bind current control and inventory generations before acting. A requester-filtered query such as `affectedPlacements` cannot establish workspace-wide coverage. A hash is a content commitment, not an authority proof or a signature.

Record IDs, revision coordinates, dependency relationships and payload digests remain private metadata. Omitting payload text does not make this report safe for public or ordinary requester delivery. The future host must enforce the correct operator scope for both inputs and outputs; this module does not authenticate a caller, bypass sealed custody or authorize server processing of material it could not otherwise read.

These limits follow the existing [historical aggregate boundary](../adr/0013-historical-aggregate-persistence.md), [encrypted material separation](../adr/0019-private-encrypted-content-persistence.md), [research charter](../sources/research-charter.md) and [canonical security reconciliation](canonical-reconciliation.md). The component makes no certification, original-source verification or physical-erasure claim.

## API and exact input structures

The module exports four functions and the manifest-profile/default-limit constants. All functions are synchronous and take owned snapshots before inspecting values.

### Payload digest and one-revision extraction

`lifecyclePayloadDigest(payload)` computes the canonical digest used in the expected manifest. `extractLifecycleDependencies(row)` accepts exactly:

```js
{
  workspaceId,                 // canonical lowercase UUID
  recordId,                    // canonical lowercase UUID
  revision,                    // positive PostgreSQL bigint decimal string
  payload                      // plain JSON object for one retained revision
}
```

The payload ID must equal the retained row's record ID. The extractor reuses the verified historical domain validators. Unknown record types, unsupported schema versions, empty uninitialized payloads, incompatible shapes and ID mismatches produce an incomplete extraction with a fixed reason and no inferred edges. Unsafe JavaScript structures or invalid wrapper fields throw `LifecycleDependencyError` with code `lifecycle_dependencies_unavailable` and a fixed message. Error details never contain supplied content.

An extraction receipt binds the workspace, record, revision, canonical payload digest, recognized type/schema, deduplicated edges, unresolved findings and fixed effect limits. Its `receiptDigest` covers all those fields except itself. `extractionCompleteness: "complete"` establishes that a recognized schema was fully extracted; references or external material can still be unresolved. `referencesVerified` remains false because extraction alone performs no external lookup or authority check.

### Independent retained-revision manifest

`lifecycleManifestDigest(manifest)` accepts exactly:

```js
{
  profile: "garden-lifecycle-retained-manifest-v1",
  workspaceId,
  inventoryRevision,
  coverage: "complete",        // "partial" is accepted only as incomplete coverage
  heads: [{recordId, revision}],
  revisions: [{recordId, revision, payloadDigest}]
}
```

Each record has one current head and each retained coordinate occurs once. Revision strings must fit PostgreSQL's positive signed bigint range. The closure checks that every record has a head, the head is present in the expected retained set, and no newer retained revision contradicts it. It does not infer a missing current head from the largest available revision.

The manifest enumerates retained revisions, rather than claiming that every original revision still exists. An independently omitted historical revision is an upstream inventory problem; this component must not be presented as proof against a consistent rollback of the whole manifest and history.

### Closure

`inspectLifecycleDependencyClosure(manifest, snapshot, request)` takes the manifest as a separate argument. The snapshot must have exactly:

```js
{
  workspaceId,
  inventoryRevision,
  manifestDigest,
  coverage: "complete",        // or "partial"
  revisions: [{workspaceId, recordId, revision, payload}]
}
```

The request must have exactly:

```js
{
  rootRecordIds: [recordId],
  limits: null                 // fixed defaults, or all four lower limits below
}
```

Duplicate roots are deduplicated. Duplicate expected coordinates or heads are rejected. Duplicate observed coordinates, including byte-identical duplicates, cannot produce complete coverage. Missing, extra, changed or foreign-workspace revisions remain explicit findings; a matching row count is insufficient. A different inventory revision or manifest digest prevents traversal under the stale binding.

The snapshot digest binds the actual observed coordinate/digest list, coverage and manifest binding. It is null if the initial scope or revision bound prevents inspection. Both manifest and observed coordinate lists are sorted before digesting, so transport order does not change their identity.

## Edge contract and direction

Every edge has these metadata fields:

```js
{
  workspaceId,
  originRecordId,
  originRevision,
  dependentRecordId,
  dependentRevision,
  inputRecordId,
  inputRevision,               // exact revision, or null for a current reference
  inputBinding,                // "exact" or "current"
  edgeKind,
  relationshipClass           // derivation, semantic, provenance, review-impact
}
```

The dependency is **dependent → input**; reverse closure travels **input → dependent**. The origin identifies the exact payload that declared the edge. Usually the origin and dependent are the same revision. The evidence review-impact edge is the deliberate exception: the origin is the evidence-link revision, its input is that evidence-link revision, and its dependent is the exact evaluated claim revision. A future index must bind this edge to the origin's extraction receipt, not pretend the evaluated claim payload declared it.

Canonical uniqueness includes origin, dependent, input, revision binding, edge kind and relationship class. Repeated provenance paths to the same source can collapse; a different revision or kind cannot. Closure output adds a resolution status and `resolvedInputRevision` without changing the declared binding. A missing exact revision never falls back to a current version. A current reference keeps `inputRevision: null` even when the supplied head resolves it.

| Record family | Declared inputs | Edge treatment |
| --- | --- | --- |
| Archival unit | `parentId`, assertion provenance `sourceId` | Current hierarchy plus uncertain provenance |
| Source | `archivalItemId`, `derivedFrom[]`, assertion provenance | Current archive, derivation and uncertain provenance |
| Locator | `source.id/revision` | Exact retained digital representation; hash metadata must match |
| Reanchor proposal | `fromLocatorId`, `toLocatorId` | Both current locator references; no automatic adoption |
| Source-testimony claim | `attribution.locatorId` | Current locator |
| Evidence link | `claim.id/revision`, `locatorId` | Exact claim/current locator; separate evidence → claim review impact |
| Claim placement | `dependencies[].id/revision` | Exact retained claim, link or placement revisions |
| Entity | Name provenance, redirect target and redirect evidence | Current target plus uncertain provenance |
| Relationship | `fromId`, `toId`, evidence provenance | Current typed endpoints plus uncertain provenance |
| Geographic assertion | Subject, claim and evidence `id/revision` | Exact retained references with type and claim-binding checks |

The module checks reference type compatibility using the supplied revisions. It does not establish present database access, live reference existence, scientific truth or byte possession. Syntactic historical provenance IDs remain `unverified-provenance` even when a compatible source row is present. A foreign-workspace row cannot satisfy an in-workspace reference.

External source identities, locator identifiers/canvas IDs, representation material and placement targets produce explicit unresolved findings. Their actual identifier strings, URLs, filenames and coordinates are omitted. Free proposition text and external identifiers that happen to look like UUIDs are never converted into canonical edges. Assertion supersession IDs remain local assertion identities.

## Retained history, review impact and safe bounds

Closure is record-wide: every matched retained revision contributes edges. Removing a source reference from the current version therefore cannot erase a dependency retained by an older revision. The result preserves both the declaration revision and any exact input revision.

The union of retained history can contain cycles even if source ancestry was acyclic at each historical write. Evidence influence also creates legitimate claim/evidence cycles. The traversal deduplicates records and edges deterministically and uses breadth-first depth. It does not misapply a current source-DAG prohibition to this historical union. It is an inventory of supplied revisions, not a reimplementation of every historical transaction invariant.

The default and maximum limits are:

| Limit | Maximum |
| --- | ---: |
| Retained revisions/heads | 512 |
| Extracted edges across the snapshot | 8,192 |
| Affected records | 512 |
| Traversal depth | 64 |
| Requested roots before deduplication | 100 |

`limits` may be null or an exact object with `maxRevisions`, `maxEdges`, `maxRecords` and `maxDepth`, each a positive integer no greater than its maximum. A cap produces an incomplete result with empty affected-record, revision and traversed-edge outputs; it never silently returns a truncated actionable closure.

Ownership validation separately bounds recursion to 32 levels, each array to 8,192 elements, each object to 64 own properties, each argument to 200,000 visited values and 8 MiB of string/key data, and each canonical payload to 128 KiB. Cycles, malformed Unicode, nonfinite values, functions, symbols, accessors, proxies, custom prototypes, sparse arrays, hidden fields and custom iterators are rejected. Caller getters, proxy traps, iterators and `toJSON` are not invoked. Outputs are recursively frozen copies.

An unresolved or unknown row anywhere in the supplied workspace inventory prevents complete coverage, even if it is not reached from this request's roots. An unknown schema could otherwise conceal a reverse dependency. Extraction still returns the bounded known metadata and explicit reason; no default permission is derived from the missing facts.

## Digest encoding

Digests are SHA-256 of UTF-8 `profile + "\n" + canonicalJSON`. Canonical JSON sorts object keys using JavaScript string ordering, preserves array order, uses JSON string escaping and finite JSON number encoding, and preserves valid Unicode without normalization. Manifest heads/revisions and observed coordinates are explicitly sorted as sets before hashing. Payload array order remains significant. Numeric zero follows JSON encoding, including `-0` encoding as `0`.

Profiles distinguish payload, manifest, extraction receipt, observed snapshot and closure result identities. These are canonical working-payload digests, not original document or media byte hashes. A future SQL implementation must pass the same escaped-text and Unicode vectors; `jsonb::text` is not this encoding.

The independent payload vector for `{"text":"a\"b\\c\nÅ😀","nested":{"z":2,"a":1}}` is `a7568ceb667555f3c33b2f01503865b1cca41311d285b1a738d81f0f8c3890f7` under `garden-lifecycle-payload-v1`.

## Durable integration remains separate

A future metadata index should bind each edge to its exact `(workspace, origin record, retained revision, payload digest, extraction receipt)` and append new revision entries instead of replacing historical edges. Its authoritative coverage must compare exact expected coordinates/digests, not counts or extraction output supplied as its own proof.

That adapter must share the existing workspace consent lock before source-graph or destination-row locks, re-read control and authority after waits, persist history/index changes atomically, and acquire the audit head last. Actual PostgreSQL tests must cover both orders of source/claim writes versus tombstones, expiry after lock waits, forced audit failure, hidden descendants and stale restored heads. This pure component does not implement those transactions or change delivery policy.

Material inventory is also separate. Migration 0013 maps every encrypted content version to an exact record revision and separates immutable wrapper receipts from erasable material. A future authorized removal inventory must include every retained content version and generation, not only the current head. Review metadata, object-store references, generated images, external publications and backups need their own verified adapters. A semantic reference, review-impact edge or shared class key never establishes per-object erasure authority.

## Verification

Run the individual synthetic cases with:

```sh
node --test --test-reporter=spec tests/security/lifecycle-dependencies.test.mjs
```

The tests exercise real verified domain validators, exact/current references, retained rewrites, cyclic review impact, closure bounds, independent manifest comparison, foreign and unresolved references, immutable snapshots, and private-value canaries. They include an independently calculated canonical digest vector and adversarial JavaScript object cases. They do not seed a database, inspect actual corpus rows or call a provider. Source-bound PR evidence must record the final tested revision separately from these reproducible test instructions.
