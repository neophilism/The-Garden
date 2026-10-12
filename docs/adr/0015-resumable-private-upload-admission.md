# ADR 0015: durable resumable admission before raw staging

Status: GDN-077 implementation under review; hosted activation and independent acceptance pending.

The existing 8 MiB whole-object adapter cannot admit large corpus sources. Add a separate bounded chunk protocol with immutable owner/source/version/hash/size binding and an actual private filesystem/SQLite repository. Do not widen the existing transport limit or pretend that an offline original is a provider object. Every result remains quarantine with explicit unreviewed historical and rights status.

Use the existing audited identity-decision boundary at admission, authoritative source binding, byte verification, commit and delivery. Preserve transaction-local commit receipts with decision UUIDs. Allocate opaque server paths only, reserve space before accepting bytes, cap in-flight work and open sessions, and stream assembly. Local hash chains are evidence of consistency, not independent security certification.

Sync immutable parts before committing their metadata. After interruption, verify orphan bytes against the exact manifest before adoption. Never expose a source reference for partial progress. Keep originals and valuable assembled orphans across cancellation and expiry; purge only unaccepted expired parts under current authorization. Retain audit history.

The source registry resolver feeds completed SQLite files to GDN-045, which verifies the full reviewed migration contract independently. The contributor panel presents received bytes and quarantine review state without conferring historical truth or publication rights. The implementation remains unmounted pending the [operating and activation contract](../runbooks/resumable-uploads.md).
