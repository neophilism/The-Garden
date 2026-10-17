# Purpose-bound hold metadata protocol

This pure GDN-032 component represents administration of one retained hold. It does not access a database, authenticate an operator, create authority, prove that a record exists, release a hold, or erase material. The fixed storage implementation remains a separate prerequisite.

The module is `packages/domain/src/lifecycle/hold-metadata-storage.mjs`. It reuses the verified 0015 control and retention representation without modifying either source or any v1 release bytes. A descriptor fingerprint identifies supplied metadata; it is not an authorization credential.

## Immutable target and separate current metadata

Every metadata authority identity must be born with this exact descriptor:

```js
{
  purpose: 'hold-administration-v1',
  projectionVersion: '1',
  scope: {
    workspaceId, recordId, recordRevision,
    classification: 'restricted_research'
  },
  holdId,
  placementFingerprint
}
```

The scope names the original retained revision. The placement fingerprint binds the original hold event, including its recorded command and proof. A released hold still resolves to that original placement fingerprint; its newer record fingerprint cannot replace the placement identity.

Current record metadata is a separate tuple: workspace ID, record ID, decimal-string version, actual `research` classification, and `active`, `quarantined`, or `withdrawn` state. It must name the same record and a version at least as new as the original retained revision. The component validates that supplied representation. Future storage must resolve and lock the actual current tuple and prove that the original revision is retained. Neither the current head nor its content becomes part of the operator's original approval.

Missing, cross-workspace, changed-class, sealed, personal, or governmental targets require denial in the fixed storage boundary. Expired and released holds remain representable history; elapsed dates do not turn them into a permission or an erasure result.

## New evidence and grant identity profiles

Only `lifecycle.inspect` and `lifecycle.hold-release` are representable metadata actions. Creation fingerprints bind the complete descriptor, every evidence or grant command field, and the maintainer attribution:

```js
{
  workspaceId,
  maintainerId,
  descriptor,
  command
}
```

The SHA-256 input is UTF-8 of the fixed profile, a newline, and fixed-order JSON of this validated value. Profiles are `garden-lifecycle-hold-metadata-authority-evidence-v1` and `garden-lifecycle-hold-metadata-authority-grant-v1`. Unknown fields, alternative scalar types, malformed Unicode, serialization hooks, proxies, accessors, sparse or decorated arrays, excessive input, and noncanonical identifiers are rejected before serialization.

A later revision retains the original authority identity, descriptor, action and grant subject, advances the revision by one, supplies the exact predecessor fingerprint, and uses a new operation ID. A new maintainer or updated evidence reference can be represented as a reviewed revision. Representation alone cannot establish that a maintainer or evidence is currently authorized.

Future SQL must enforce permanent purpose binding from identity creation, with no fallback from an old identity whose binding is absent. Legacy grants and evidence cannot be retrofitted into this path. Research-only handlers must also reject metadata-purpose identities. The new creation hash is not interchangeable with an earlier authority-operation hash.

## Fixed projection

`projectHoldMetadata` returns only:

- Schema/kind, purpose and projection version.
- Original scope, separately supplied current record metadata and aggregate control revision.
- Hold ID, hold revision, current hold fingerprint and original placement fingerprint.
- Closed reason code, bounded evidence IDs, effective/expiry/review/recorded instants, and limited release metadata.
- `effectsVerified: false`.

The projection contains no record payload, owner or author, placement/release actor, grant/proof document, authority reference document, operation ID, ciphertext, wrapped key, or provider handle. Its evidence IDs remain private administrative metadata. It does not expose `canRead`, `canRelease`, disposal permission or a committed/deleted assertion.

## Placement validation and exact release replay

`validateHoldMetadataReleaseCommit(principal, {descriptor, hold, commit})` validates the unchanged v1 commit and its placement, target, command and proof compatibility. A retained hold does not store the grant ID or aggregate compare-and-swap revision. It therefore cannot identify the entire stored operation by itself.

`validateHoldMetadataReleaseReplay(principal, {descriptor, hold, expectedCommit, receivedCommit})` requires released hold history, validates both full v1 commits against that retained target, then compares all canonical fields exactly. Storage must supply `expectedCommit` from its immutable operation history. A matching but unauthenticated caller-supplied value is not proof of a recorded operation.

Independent review reproduced two valid rehashed substitutions accepted by the placement-only helper: a changed grant ID and a changed aggregate control revision. The explicit replay helper rejects both. Matching malformed commits, changed commands, unreleased history and hostile inputs also deny. Existing v1 fingerprint vectors and recovery references remain unchanged.

## Future fixed storage contract

The next storage slice must establish current identity and purpose-bound authority before inspecting or releasing an existing hold. It must resolve original retained coordinates and the current record independently, expose only the fixed projection, and compare recovery against the full immutable recorded operation.

A release must append to the existing 0015 control history, head, scope head, global operation registry and atomic audit. Metadata and research releases of the same hold must compete through one compare-and-swap boundary. No parallel release ledger or silent rewrite of successful history is permitted.

The metadata resolver requires a separate, narrowly privileged owner and context-bound policies. It must not widen the existing research/review row policies or obtain payload columns. Actual PostgreSQL tests must demonstrate permitted metadata row locking alongside denied row modification, raw-table access, role escalation and cross-target access.

The host must retain the first principal, exact result and minimum captured expiry through fresh completion and the final identity await. The verified common workspace gate must precede authority/control locks. SQL/runtime implementation depends on the verified encryption completion foundation; preparing this pure module does not substitute for that gate.

Release is not deletion, restored research access, proof of legal authority, a complete material inventory or verified physical erasure. Approval of current content or inventory requires a separately versioned operation format rather than optional unhashed fields added to v1.

## Evidence

[Source and review observations](../evidence/GDN-032/hold-metadata-protocol-observation.json) preserve the original checkpoint, independent Python vectors, the replay finding, its correction and source-bound local test results. Initial tests passed 63 cases; the corrected focused suite passed 68, including 32 metadata cases and 36 existing control/retention cases. Full integration, published-source CI, SQL, provider actions and operational acceptance are recorded separately when actually performed.

## Isolated permission prerequisite

Before adding a production resolver, the required data workflow runs a separate disposable PostgreSQL 18 experiment. A non-elevated NOLOGIN resolver owns fixed functions and receives only metadata-column SELECT and UPDATE on the version column for row locking. Its context-bound SELECT/UPDATE policies use a false write check. Eleven authored groups exercise exact context and target binding, payload/owner/predicate denial, attempted writes, real low-privilege caller escalation, an observed FOR SHARE writer wait, and complete teardown of the uniquely owned synthetic objects. Existing Garden rows and policies are not changed.

The source and helper review are recorded in [permission evidence](../evidence/GDN-032/hold-metadata-permissions-observation.json). A modeled lost insertion acknowledgment exposed a context-coordinate cleanup ordering error; the coordinates are now captured before dispatch. The same helper suite records 21/22 against the original and 22/22 after that correction. These helper results do not substitute for actual PostgreSQL behavior. At this checkpoint the actual 11-group execution remains pending required CI, and the production purpose-authority resolver, 0017 schema, runtime release path and physical erasure remain unimplemented.
