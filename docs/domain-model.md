# Domain model and invariants

This is a logical schema specification. Actual migrations are planned PR work, not deployed SQL.

| Aggregate | Key fields and relations | Invariants |
|---|---|---|
| Entity | id, type, names, date bounds, source relations | Polity, people, language, port and person are distinct; unknown remains unknown. |
| Name authority | entity_id, source form, language, transliteration, status | A spelling variant is not proof of identity. |
| Source | repository, collection/item, witness, edition, origin URL, rights evidence | Digital representation is not the same object as original document or testimony. |
| Artifact | digest, bytes, MIME, source version, classification, immutable storage ref | Verify exact bytes after transfer; never execute arbitrary source code/macros. |
| Locator | artifact/version digest, page label/index, text selector, xywh or timecode | Ambiguous reanchoring is flagged, not silently attached elsewhere. |
| Claim | type, text, epistemic qualifiers, version, author, review state | Source statement differs from historical conclusion and policy argument. |
| Evidence edge | claim_id, locator_id, supports/contradicts/context, rationale | Citation count is not independent corroboration. |
| Placement | claim/content version, page/exhibit/export span | Every correction can trace dependent public appearances. |
| Review | exact object/version, role, scope, conflicts, outcome, rationale | Review cannot certify more than inspected scope; independent reviewer where required. |
| Rights/consent | exact material/use, grantor, terms, expiry, restrictions | Public access is not permission; research consent is not endorsement consent. |
| Publication | manifest, eligibility states, public generation, revocation | Only approved public fields enter serving projection; retraction cannot be undone by rollback. |
| Workspace/member | identity, role, scope, assurance | Server enforces authorization independently of UI or client claims. |
| Sealed record | ciphertext, algorithm version, recipient keys, key epoch | Server has no plaintext index, OCR, preview or AI path. |
| Contribution | contact ref, context, items, terms, review, withdrawal | Default restricted; never automatically enrollment or public genealogy. |
| Analysis | code/config/runtime hash, input snapshot, outputs, review | Reproducible computation does not establish the truth of historical assumptions. |
| Research task | question, source/claim scope, dependencies, state, evidence | Distinct from software PR and universal-history completion. |
| Delivery item | plan ID, PR/check/commit/deployment/live evidence | Planned, merged and production-verified are distinct. |

## State separation

Acquisition: discovered -> authorized -> downloaded -> byte-verified -> parsed, with inaccessible/quarantined branches.

Transcription: untouched -> machine-draft or human-draft -> second-reading -> adjudicated; uncertain segments may remain unresolved.

Evidence review: candidate -> scoped -> under-review -> supported/qualified/disputed/unsupported -> reconsidered. These are interpretation states, not publication permissions.

Publication: private-draft -> eligible-candidate -> independently-cleared -> staged -> public -> corrected/withdrawn. Rights, consent, privacy, accessibility and legal authority are independently necessary where applicable.

## Proposed API families

`/public/pages`, `/public/policy/versions`, `/public/atlas`, `/public/search`, `/public/claims/:id/evidence`, `/public/sources/:id`, `/public/current-work`, `/public/corrections`.

`/research/workspaces`, `/research/uploads`, `/research/sources`, `/research/annotations`, `/research/transcriptions`, `/research/claims`, `/research/reviews`, `/research/tasks`, `/research/search`, `/research/exports`.

`/contributions`, `/consents`, `/withdrawals`, `/support` with strict per-subject authorization. `/sealed/*` is ciphertext-only and cannot be mapped to ordinary server-processing endpoints.

`/admin/*` uses scoped step-up authorization; no generic execute-SQL or arbitrary-file route. Optional `/assistant/*` is read-only with independent retrieval authorization. Government routes are not deployed in the current product.

These are proposed Garden API families, not existing external Engine Room endpoints. GDN-004/019 must obtain the real Engine Room contract.
