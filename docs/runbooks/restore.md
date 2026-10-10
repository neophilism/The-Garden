# Backup and restore runbook

No recovery guarantee is claimed before this is successfully rehearsed on actual authorized infrastructure.

Inventory required application DB, immutable originals, manifests, audit roots, keys/recipient recovery material, configuration and current revocation/retention state. Separate public, restricted and sealed recovery assumptions. A backup that cannot be decrypted by its intended owners is not a verified recovery plan.

Create bounded component packages with byte hashes, sizes, format checks and logical counts. Read back each uploaded object; reopen the database and exports. An archive CRC or transfer checksum alone cannot prove the payload inside is a valid complete database. Compare exact current expected rows and preserve all recovery non-equivalence warnings.

Restore into isolated authorized infrastructure. Verify schema/version, rows, foreign keys, selected content semantics, asset hashes, audit integrity and key access. Rebuild indexes from approved data. Before any user access, replay current deletion tombstones, consent changes, rights revocations and legal holds. Public projection cannot publish old withdrawn material.

Measure actual recovery point and elapsed restoration time. Compare with proposed RPO 15 minutes and RTO 4 hours under recorded dataset/tier assumptions; do not call targets achieved without evidence. Identify unrecoverable sealed keys honestly; do not install an undocumented operator backdoor.

Test user-level journeys and negative-access paths, then record source backup IDs, checksums, target resources, timestamps, findings and approval to promote. A drill never overwrites production. Retain safe evidence and destroy drill resources under retention/cost policy.
