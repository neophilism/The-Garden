# Authorization on every delivery path - GDN-025

## One policy across representations

The server-owned repository reads through the GDN-024 policy executor and forced row security. Record pages, snippets, JSON record exports, and notification/collaboration projections receive explicit allowlists, never raw database payloads. Search results, counts and facets derive from the same permission-filtered SQL snapshot, before pagination. Searching for a hidden title cannot expose its count or category. This is a bounded title search, not the later advanced atlas engine. Notification/collaboration projections are integration primitives, not an implemented mail or realtime transport.

The HTTP adapter returns the same non-cacheable 404 error body for absent and denied records. HEAD requests still authorize before returning object metadata. Known channels are closed-world. Input paths, JSON fields, lengths, query multiplicity, origins, methods, tile selectors and ranges are bounded. The module remains unmounted by default; both public and researcher apps retain their disabled-research posture.

## Private bytes and capability URLs

A file URL points back to the authenticated application proxy, never a public bucket or direct signed storage URL. A thirty-second HMAC capability binds its key ID, pseudonymous subject fingerprint, workspace, record, exact record revision, immutable asset version, operation, tile selector, optional single byte range and research purpose. The verifier checks the current authenticated subject and exact scope every time. Explicit prior keys may overlap only while tokens remain valid. Malformed, noncanonical, expired, future, altered and wrong-purpose capabilities fail closed.

Capabilities authenticate; they do not encrypt. A URL can expose record and operation metadata and must be excluded from request/access/error logs, analytics, referrers, notifications and Engine Room. The subject fingerprint is keyed, not anonymous. Signing keys require the later managed-key lifecycle and must never reach the browser. A valid capability does not replace database authorization or confer citizenship, editorial review or publication approval.

The real archive adapter validates its private endpoint/bucket/key, byte count and SHA-256. The delivery service checks bytes again, reauthorizes after acquisition and rechecks token expiry, revision, source asset hash/version and MIME type immediately before constructing the response. Revoked permissions and replaced revisions reject new responses. Previously delivered data cannot be recalled, and a revocation after the final authorization boundary is not retroactive. No claim of instant revocation of every already-running network stream is made.

Whole-object verification is deliberately limited to 8 MiB. A range is sliced only from completely verified bytes; arbitrary multipart/suffix ranges and large streaming are not enabled. Tiles bind their exact page/level/x/y selector. The MIME allowlist excludes HTML and SVG and uses nosniff, a sandbox CSP, no-referrer and no-store. This is not file decoding, malware scanning, rights clearance or a media playback guarantee. Original/derivative attachment identity is expected to come from the authoritative source registry; the public route stays disabled until that integration and the security/rights gates are satisfied.

## Real checks and explicit limits

Unit tests exercise all delivery channels, signature scope/tampering/expiry/rotation, cross-user reuse, private canaries, revoked access during reads, size/range validation, unsafe MIME, HEAD, wrong origins, query duplication, JSON input bounds and default-off behavior. The PostgreSQL integration uses the existing disjoint-login RLS architecture with its own isolated fixture: allowed and denied users share a pool, all search views use actual RLS, and private bytes pass through the real archive adapter. Only the object backend and fixture identity are synthetic; no S3 transport, real email, cloud migration or external account is asserted to have been tested.

The actual Better Auth lifecycle remains tested separately. Later API mounting, browser onboarding, notification delivery, realtime subscriptions, bulk exports, production key handling and hosted permission verification are separate PR/release obligations. Canonical roadmap synchronization is checked against observed PR evidence without inferring completion from a mapping.

## Rollout and recovery

No provider mutation accompanies this change. First enable only in a scoped synthetic staging fixture after all exact-head CI workflows succeed. Keep the route unmounted for real data until independent security review and complete source/consent/rights integration. Roll back by disabling delivery, revoking capabilities or rotating keys; never weaken RLS or delete original research to recover service. A policy-service outage returns no protected bytes rather than an offline permissive fallback.
