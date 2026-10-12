# GDN-077 resumable quarantine uploads

This is an unmounted, default-disabled operator capability and a receipt display component. It is not a hosted upload endpoint or a provider multipart implementation. All upload, database and filesystem tests use generated fixtures. No real source is admitted by this implementation work.

## Admission and protocol

Compose `createResumableUploads` with the existing durable audited-decision service, current source/workspace/purpose authorization, a trusted repository and an explicit server enablement gate. Every method takes `(headers, workspaceId, input, {signal})`. No request supplies a subject, filesystem path, classification, scanner result, provider URL, grant or publication status. The authenticated subject must remain the same for the complete operation. Audit failure, identity change, withdrawal, cancellation or disabled capability fails closed. Malformed requests receive the same safe rejection.

| Method | Input besides `uploadId` | Result |
| --- | --- | --- |
| `start` | `sourceId`, `version`, `sha256`, `size`, `declaredType` | Bound receiving session or identical replay |
| `chunk` | `index`, `sha256`, `bytes` | Durably received or replayed part |
| `status` | `afterIndex` (`-1` initially) | Counts and at most 128 part receipts |
| `pause`, `resume` | None | Preserved progress; no lifetime extension |
| `finalize` | None | Hash/size/header-checked private original reference |
| `abort` | None | Abandoned parts retained until expiry |
| `expire` | None | Authorized cleanup of expired, unaccepted parts |

Upload, source and version identifiers are opaque UUIDs. The declared full-file SHA-256, exact byte size, media type and owner are immutable. A second upload cannot claim an existing source/version. `sourceRef` is absent until finalization commits. A partial upload never appears in the research source registry.

Admission first checks workspace/upload authority; `session-bound` and subsequent gates additionally carry the authoritative stored source reference. The authorizer must enforce source grants there. Renew permission during byte verification, at each assembled chunk, immediately before commit and before returning the receipt. An allow decision is not an operation-completion receipt. This module does not supply production identity credentials, source grants or privileged-operator assurance.

## Bounds and integrity

Parts are exactly 1 MiB except the final part, with independent SHA-256 checks. Uploads may arrive out of order. A differing replay cannot replace an existing part. The overall ceiling is 16 GiB, further restricted by the configured source/owner/workspace/global quotas. Four operations per service instance may be in flight by default (maximum configurable eight); excess admission rejects before another part copy is queued. Assembly reads 64 KiB at a time. No whole-file buffer is created.

The accepted declared types are SQLite, ZIP, PDF, PNG and JPEG. The file header must match the declaration after complete size/hash verification. Header recognition is not format validity or malware clearance; scanner status remains `unavailable`, and files are never executed, unzipped, parsed or published by this module. The existing 8 MiB archive store and bounded inspector remain unchanged.

`createPrivateUploadRepository` requires an existing operator-owned private directory outside the repository/web roots. It refuses symlinked roots, public modes, unsafe files, schema drift and altered audit chains. The journal uses SQLite rollback transactions and `synchronous=FULL`; file bytes and directory entries are synced before the corresponding receipt transaction commits. Parts and originals are mode 0400; the ledger is 0600. SQLite locks serialize processes; the adapter serializes asynchronous work inside one process. Busy external writers fail for a retry, never bypass locking.

A session reserves **twice its declared bytes**, for retained chunks plus assembled original, against all byte quotas. A global open-session count also bounds admission. Quotas do not account for all database metadata, audit history and backups: an independently enforced volume quota and headroom remain mandatory. Finalized originals retain their reservation and chunks. Do not size raw staging or operational PostgreSQL from compressed archive size; use separately authorized private preflight measurements.

## Crash recovery and retention

A process can die before a chunk receipt or finalization commit. Reopen the complete directory with its SQLite hot journal intact. Retry the same UUID and metadata: exact orphan bytes may be adopted only after rechecking size/hash and current authorization; conflicting bytes remain rejected. Incomplete `.partial` assembly files have no source identity and are replaced from the preserved checked parts. An existing assembled original is verified and reused, never overwritten.

The default session lifetime is 24 hours and cannot exceed seven days. Pausing does not extend it. Expired receipts explicitly say `expired-retained` until cleanup. Expired/aborted parts still consume quota until an authorized `expire` operation removes them after the deadline and commits the purge receipt. Removal is idempotent after interruption. Finalized originals cannot be aborted or purged. An assembled orphan is also retained for explicit review, even after expiry. Audit/session history is retained; there is no deletion API for it. No background cleanup scheduler is activated.

Every committed transition appends a local hash-linked event containing the durable parent decision UUID. CI matches create, chunk and finalize UUIDs to actual PostgreSQL audit allow events, then sends the generated original through the actual GDN-045 subprocess and confirms operational research records are unchanged. Local events contain metadata, not source bytes. Filesystem administrators remain trusted; the local ledger is not externally anchored or administrator-proof.

## Staging handoff and contributor receipt

`repository.resolveSource` implements the GDN-045 trusted registry shape for completed, owner-bound SQLite uploads. The returned source reference uses the existing Garden quarantine namespace; `storageLocation: private-offline-quarantine` explicitly means no object was uploaded to Neon. The resolver does not grant access and is called only behind staging authorization. It rejects other formats rather than inventing conversion. GDN-045 independently rechecks source hashes and its reviewed schema contract. Broader team sharing needs actual source grants and a separately reviewed ownership policy.

`UploadReceiptPanel` renders an already-authorized snapshot, including progress, paused/cancelled/expired state and a stable receipt. Completion means bytes received and checked, awaiting inspection. The panel exposes no provider names, paths, source content, publication action or mounted upload form. Browser fixtures exercise the committed component on desktop and mobile with accessibility checks.

## Activation and rollback

Before mounting or accepting historical material, verify current identity/source/purpose grants, privileged assurance where required, private encrypted source/output/temporary volumes, denied worker egress, actual file-system quotas, scanner/isolation handling, backups and restore, independent security assessment, and admission/body-size/rate limits at the real transport boundary. Verify source retention policy and the exact deployment. Existing buckets, successful unit tests and a checksummed original are insufficient. Do not increase capacity or create paid resources implicitly.

Rollback disables admission and keeps accepted originals, committed parts, audit and rollback journals intact. Reopening with the prior compatible worker requires reviewed schema compatibility. No down migration, original overwrite, historical verification, rights clearance or public release is included.
