# ADR 0013: versioned historical aggregates over protected envelopes

Status: implemented candidate; independent review pending. Applies first to GDN-035.

The established record envelope provides a stable UUID, workspace, classification, version and RLS boundary. Store typed canonical working records inside that envelope and expose security-invoker typed views rather than creating a second, competing authorization system. Preserve every new version in a transaction-bound, runtime-append-only journal. A source statement, structured record and public publication are different objects.

This avoids duplicating policy tickets, per-record grants and revocation logic across each new historical type. Repository operations remain framework-independent and injectable for testing; real acceptance uses PostgreSQL, not only mocks. The journal's schema administrator remains trusted: no blockchain, external signature, certification, or immutable-against-owner claim is made.

Merges are reversible redirects between same-kind entities, never destructive consolidation. Stable source identifiers and names stay attached to their original UUIDs. Deterministic locks and optimistic revision requirements prevent opposite concurrent merges and lost updates. A canonical redirect target must be an unredirected entity at the moment of a merge; later chains are inspectable history, not a basis for silent identity inference.

Subsequent archival and claim repositories may reuse this history foundation only after GDN-035 is merged and its database checks pass. Their implementation dependency on the shared journal is in addition to, not a replacement for, the approved plan's earlier dependencies. Publication, retention, sensitive-data controls and security auditing retain their separate milestones and review gates.
