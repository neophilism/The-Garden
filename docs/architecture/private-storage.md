# GDN-015: private archive storage foundation

Three actual buckets on Garden staging branch `br-purple-grass-b5hurfl7` were created and then listed on 11 October 2026: garden-quarantine, garden-originals, garden-public-derivatives. All are **private**, including derivatives. Production is untouched. No historical or family material was uploaded.

The server-only worker adapter supplies quarantine, preservation, review-gated derivative creation, per-read authorization and SHA-256 readback verification. Content has opaque source/version keys. Writes are conditional and retries cannot overwrite different bytes at an existing version. Every read rechecks authorization before and after retrieving bytes; publication checks authoritative rights/consent/historical/privacy review records against the exact source hash and version. A derivative is still private until a separate reviewed publication registry commits it.

No caller may inject the authorizer, review service, backend, signer or object metadata. These are trusted server dependencies. The SDK-neutral presigned transport binds the exact staging origin/bucket/key, disallows redirects, bounds response bytes, uses 60-second signatures and suppresses credential-bearing transport errors. The signer must sign the required Content-Type and conditional-PUT header.

`node --test tests/storage/*.test.mjs` runs 22 local transport/permission/integrity tests using synthetic in-memory storage and Response fixtures. This is not a completed provider upload/download integration. Actual provider conditional-write support, signed-header compatibility, multipart interruption/resume, version restore, external anonymous denial, customer key management and deployment are still unverified. Files above 8 MiB are deliberately rejected until streaming/multipart controls exist. Do not ingest the large research ZIPs through this adapter yet.

Application-level immutable references are not S3 Object Lock or a guarantee against provider administrators changing bytes. Hash verification detects modified bytes; access policies, backups and independent security review remain necessary. No E2EE or security certification is claimed. The HTTP adapter cannot be exposed as a public upload API without the later identity, rights, malware and publication gates.

## Resumable offline admission

GDN-077 adds a separate private filesystem/SQLite upload repository, bounded chunks and audited admission. It does not enlarge this adapter's 8 MiB limit or implement provider multipart transfer. Completed SQLite uploads can resolve into the offline staging contract; the namespace reference is explicitly labelled private offline quarantine. See [the runbook](../runbooks/resumable-uploads.md).
