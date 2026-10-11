# GDN-002: CP-017 source baseline

Four original component ZIPs were retrieved from the owner's Library on 2026-10-10; all exact byte counts, SHA-256 hashes, and ZIP member CRCs matched. The canonical CORE SQLite reopened read-only, passed integrity_check, and had zero foreign-key violations. 107 sqlite_master tables include internal tables.

To reproduce the exact source checks with authorized copies of all four ZIPs:

    python3 scripts/verify_baseline.py --archive-directory /authorized/location/of/four/zips

Source archives must not be committed to this public repository. The verification tool never modifies source archives, imports to Neon, publishes content, or reruns inherited migrations. Explicit --skip-crc or --skip-sqlite are only partial checks.

Not verified: historical identities or assertions, image rights, family consent, missing original CP-011/016 state, or equivalence of bounded recovery. Seven companion documents are located by Library records but not all reverified byte-for-byte. A valid archive is not historical scholarship.

Record IDs, rights restrictions, and preserved uncertainty are in baseline-artifacts.json. Independent historical and permissions review are prerequisites for publication and migration.
