# Approved-plan import

This is a one-time, checksum-verified transport of the owner-approved Garden planning package. The connector accepts text rather than mounted file uploads, so the original UTF-8 files are transported as numbered Base64 chunks. They are data, not executable code. The archive is decoded only after the pinned SHA-256 passes.

The importer will restore all 274 original UTF-8 package files as ordinary repository files. Three PNG screenshots documenting the earlier reader inspection remain in the original Library checkpoint; they are not application or CI evidence. The original 277-file ZIP has SHA-256 `23beed9b45e48fd11b5ee09cf3e5611717bf5502cdfd58731bd20d920d22a1c8`.

`python bootstrap/restore_plan.py` performs a bounded decode, verifies every included member against the original manifest, and restores only approved relative paths. `python bootstrap/restore_plan.py --check` checks the restored bytes. The dedicated import workflow can run only on a push to this repository's fixed bootstrap branch; it cannot run through an untrusted pull request and has no deployment secrets. It does not merge anything.

The normal read-only PR workflow must independently test the resulting PR head before merge. Importing a plan does not complete its planned application work, certify security, verify historical findings, register a live Engine Room project, or deploy a website.
