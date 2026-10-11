# Sourced geographic assertions — GDN-095

Geographic assertions are versioned working records, not authoritative boundaries. Each binds an exact entity revision, exact historical claim revision and one or more evidence-link revisions whose locator/source ancestry remains accessible. A modern reference layer cannot silently become a historical polity. Several assertions about one subject may coexist, including incompatible boundaries and dates.

Coordinates use the longitude/latitude order of OGC CRS84 and the GeoJSON model described at https://www.rfc-editor.org/rfc/rfc7946.html. The supported profile is intentionally bounded: Point, LineString, Polygon and MultiPolygon; two-dimensional positions; at most 2,048 positions; closed simple polygon rings; disjoint holes and polygon interiors; antimeridian-cut geometry; no poles, touching rings or near-degenerate shapes. The validator preserves coordinates and ring direction without silently repairing them. Unsupported original files remain preservation material for specialist normalization; this is not a full GIS import/conversion engine. No source coordinates are invented.

`validDuring` preserves the source expression and calendar plus explicitly supplied astronomical-year bounds. Missing dates and locations remain null. Temporal comparisons say possible overlap, disjoint or unknown; an approximate range is never converted into an exact date. Historical names retain their own date expressions. Every geometry has a stated uncertainty category, explanation and, for points where supplied, a radius in meters. A reported exact location is the source's claim, not an accuracy certification.

## Storage and authorization

The additive checksum-locked `0012_geographic_assertions` migration extends the existing record-envelope/revision journal and exposes an invoker-security private view. It requires exact subject/claim/evidence references, basic shape, temporal fields, typed uncertainty and immutable subject/context/privacy boundaries. It also admits these records to the existing exact-revision review-scope functions without changing review independence, roles, consent or publication conditions.

Full bounded geometry validation runs before repository writes and after reads. PostgreSQL checks identity, reference existence, basic shape and privacy; it does not independently certify polygon topology. Privileged raw JSON storage is treated as untrusted and refused by the typed repository when geometry is invalid. There is no geospatial index or raw view/public endpoint advertised as validated map content.

The repository reuses the server-owned policy transaction and claim/locator readers. It rechecks current record/source ancestry permission for historical reads as well as current reads. Stale writes fail, earlier payloads remain in the journal, and history orders the stored bigint. A separate claim review does not automatically review a geographic reconstruction; the geography record gets its own scope.

Living-person and sensitive-site coordinates require `personal` SQL classification. The general research repository refuses their storage/display, even if a caller passes a valid model. The future research-map adapter also omits the entire sensitive row: geometry, bounds, names, identifiers and omitted totals. This is defense in depth, not an authorization service. Its input must already be authorized. Historical person-location records are conservatively treated as sensitive; a separate reviewed case workflow would be required to change that policy.

## Provider observation

Read-only inspection of Garden staging on 11 October 2026 found PostGIS 3.6.4 available but not installed. This PR uses existing JSONB and does not install an extension, mutate either Neon branch, provision resources or change costs. A later spatial index/query implementation must explicitly evaluate PostGIS and its migration/restore requirements. This code does not offer distance, area, coordinate conversion or spatial-search calculations.

## Validation and rollout

Domain tests cover malformed geometry, finite coordinates, self-intersection, holes, overlapping multipolygons, uncut antimeridian segments, date ambiguity, conflicting interpretations, names and privacy. `apps/research/data/geography.ci.mjs` runs against ephemeral PostgreSQL with disjoint login roles, actual RLS and consent controls. It exercises revision pagination, concurrent writes, scoped reviews, exact reference enforcement, privacy guards and revocation of each source ancestor. Required final-head CI determines the result; synthetic fixtures are not live historical data or production acceptance.

No map UI or public projection is mounted. Later GDN-096 and public release work must use separately cleared snapshots, accessible tabular alternatives and real geographic/source review. Rollback disables the new repository/view consumer; retain the additive schema and immutable history. Do not run a destructive down migration or erase a competing interpretation.
