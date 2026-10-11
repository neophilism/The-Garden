# Durable source locators - GDN-038

## Evidence, not convenience URLs

Each immutable locator references one existing digital representation UUID and its exact positive revision, the original resource SHA-256, retained original identifiers, an optional digital page ordinal and separate printed page label/canvas identity, and an explicit selector. The repository loads the pinned source revision through the protected journal, rechecks current source/ancestor grants, and checks the declared resource hash. It never silently uses the latest source version or an arbitrary remote URL.

Whole-resource, text, original-pixel image and half-open millisecond audio/video selectors have separate validated shapes. The record's source must declare compatible media for spatial/temporal selectors; a specific PDF page can have spatial coordinates. These checks do not authenticate an archival catalog or prove that supplied media metadata was correctly decoded. The authorized reader must supply a version-bound decoding/page-map manifest. Dedicated PDF/image/media viewers and independent review remain later work.

## Text profile and normalization

The profile `plain-text-codepoints-v1` is a separately preserved UTF-8 plaintext representation. HTML/XML extraction must occur upstream with its own provenance; this resolver never evaluates HTML, normalizes Unicode, changes whitespace, applies NFC, transposes bidirectional text, or counts UTF-16 code units. A second SHA-256 binds this exact plaintext. Text position `start` is included and `end` excluded. Printed page labels are not inferred from the ordinal.

Quoted text is optional; positions alone support records whose rights do not allow duplicating passages. Quotes and contexts are bounded and remain as restricted as their parent source. A position plus quote must agree at the stored range. A quote found elsewhere is not a license to move the anchor. Quote-only matches are searched in logical code-point order with a bounded linear scan. More than one matching occurrence yields `ambiguous`, never the first match. Exceeding the inspection bound also yields ambiguity without a truncated-success claim. Grapheme splitting is surfaced as a warning using the runtime's `Intl.Segmenter`; engine/ICU differences are not treated as historical changes.

## Resolution, orphaning and reanchoring

Resolution checks source revision, resource bytes, page mapping and the selector's text hash, dimensions or duration. It returns explicit `resolved`, `orphaned`, or `ambiguous` states. A different crop, changed source hash, mismatched folio label, changed text, invalid range or mismatched decoder extent cannot silently yield a valid citation. The resolver accepts byte arrays supplied by an authorized reader and makes no network request. Bytes are limited to 16 MiB and text to 1,048,576 UTF-16 units in this initial bounded resolver; large-stream binding requires the later reader integration rather than disabling bounds.

`proposeReanchor` is a separate explicit operation on changed text for the same source identity. It returns an unadopted proposal, new hashes and a candidate range, or reports ambiguity/orphaning. It cannot mutate the original locator. An immutable `locator-reanchor` record names the original and proposed locator and the reason with `decision: proposed`. Approval and publication remain separate editorial capabilities, not fields an importer can set. To change to a different witness/edition identity, author a new locator rather than treating it as a cosmetic reflow.

## Exchange and standards

Primary references consulted 11 October 2026:

- W3C Web Annotation Data Model, Text Quote and Text Position selectors: https://www.w3.org/TR/annotation-model/ . Unicode code points, half-open positions and normalized textual representations inform the exchange objects. The Garden deliberately requires explicit disambiguation instead of adopting every repeated quote match as one citation.
- W3C Media Fragments URI 1.0 (basic): https://www.w3.org/TR/media-frags/ . Original pixel `xywh` and `t=npt:` ranges are exported with exact millisecond arithmetic. Garden bounds reject out-of-range media rather than silently clamping a scholarly anchor.

`webAnnotationSelectors` exports individual selector objects, not a complete validated JSON-LD Annotation document or reproduction license. Position/quote objects are alternative exchange components; this helper does not misstate their relationship as nested, relative selectors. Page labels and exact hash state remain explicit Garden metadata until the full source-viewer export implementation supplies the target/state envelope.

## Access and activation

Initialize and read execute under the existing verified-viewer policy executor. A locator grant does not grant its source or witness. Pinned revisions still require present permissions. Reanchor reads authorize both locators and each bound source. The existing generic delivery adapter only exposes whitelisted metadata, not arbitrary locator payloads. No locator HTTP, annotation export or publication endpoint is mounted. Do not enable such a route until its source-byte adapter and publication/rights gates are integrated and verified.

Migration `0007_durable_locators` is additive and checksum-locked. It independently enforces immutable payloads, exact version/hash references, selector shapes and original identifier preservation. No historic corpus or existing source is backfilled. Query roles can read the restricted projections but cannot create an administrative record/grant. Rollback disables the capability or returns to the prior compatible application while preserving all successful locator/proposal records; never erase citations to simulate rollback.

## Acceptance evidence

Local tests exercise code points versus UTF-16, NFC/decomposed and bidirectional text, printed-label mismatches, missing or repeated quotes, grapheme warnings, original/cropped-image dimensions, time bounds, mutation isolation and non-adoption of reanchoring. The ephemeral PostgreSQL journey exercises real source/revision constraints, immutable proposals, stale source versions and source/witness grant revocation. Its synthetic identity adapter is not a replacement for the separate real Better Auth CI. Source metadata fixtures do not claim actual PDF/image/audio decoding. Independent research review and production/source-viewer verification are still outstanding.
