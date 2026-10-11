# Sessions, passkeys and current assurance (GDN-022)

This is an unmounted identity capability, not a live service or security certification. It extends the existing self-managed Better Auth 1.7.7 identity without moving accounts to another provider. Password login remains available for basic account access. Privileged operations require a user-verified passkey, a currently valid server-side session, a still-enrolled credential, and a separate action-specific authorization decision.

## Verification and trust boundary

The pinned `@better-auth/passkey` 1.7.7 plugin performs WebAuthn cryptography through the lockfile's SimpleWebAuthn. Garden does not implement its own signature verifier. Upstream uses `requireUserVerification:false`; Garden's trusted post-verification callbacks therefore require the authenticated `userVerified === true` flag and exact credential identity for both registration and authentication. Registration options and the authentication-options response also request required user verification. Changing a browser option, signing with an unverified device, or possessing a password does not establish higher assurance.

Request-local AsyncLocalStorage carries the library-verified proof to a server-side session-creation hook. Clients cannot set method, credential, timestamp, role or verification status. The session fields have `input:false` and `returned:false`; the HTTP allowlist additionally rejects overrides and blocks administrative, account-linking, generic session-update and alternative recovery endpoints. Responses remove bearer tokens and tracking metadata. Stateful GET ceremonies require a non-simple same-origin request; POSTs require an exact origin and bounded JSON body.

## Current, short-lived assurance

A passkey login creates a new random library session and revokes the same user's previous cookie session. Separate devices remain valid until explicit revocation or recovery. Credential owner and enrollment are joined from SQL on every privileged viewer read. Five minutes after the assertion, privilege expires even if the ordinary session remains valid. Activity cannot slide the verification timestamp. Future or malformed timestamps, missing keys, suspended users, expired/revoked sessions, database errors and unknown actions fail closed.

`authorizePrivileged(headers, action, authorize)` is a fresh admission check, **not** a portable capability, role grant or transaction-commit guarantee. The callback must check actual membership/purpose authority. Domain operations must recheck authority and expiry in their own bounded transaction before committing. A returned viewer is never accepted instead of current headers and SQL. No research rights, citizenship, editorial approval or public clearance comes from signing in.

## Enrollment, recovery and revocation

First enrollment requires a verified account and a password-authenticated session younger than ten minutes. Legacy sessions without a trusted method cannot enroll. Once any passkey exists, starting and completing another enrollment require fresh passkey assurance. Enrollment does not elevate the session, and registration-created sessions are blocked.

Users can inspect/revoke their own sessions or revoke all devices from a basic verified password session. Removing a key requires current assurance, cannot remove the last factor, and invalidates sessions authenticated by that credential. Guessed identifiers cannot operate on another user's records.

Password recovery invalidates sessions but preserves all passkeys. A recovered password cannot add a replacement while an existing factor remains enrolled. Lost-all-devices recovery requires a separate reviewed procedure: there is no email-only, backup-code, remembered-device or operator-impersonation bypass. This PR does not implement TOTP, enrollment-secret recovery or a hardware-bound assurance claim. Synced passkeys are permitted; hardware attestation and certification require separate policy/evidence.

## Multi-instance concurrency

Activation requires a separately bounded `sessionLockDatabase` pool targeting the **same** database, schema, server and role as the identity pool. Mismatches fail closed. Bounded PostgreSQL account advisory locks serialize authentication, enrollment, removal, revocation and recovery across service instances. A separate pool prevents waiting locks from starving identity queries. All instances and administrative recovery paths must follow this contract; do not activate a mixed old/new identity fleet. Privileged database administrators remain inside the trusted boundary.

Lock lifetime is bounded by PostgreSQL timeouts. Connection/release failure returns unavailable, not success. Library writes may already have committed before a transport error: refresh state rather than blindly replay. Deployment must verify connection-acquisition timeouts and capacity. A new connection pool does not authorize increasing a cloud compute tier.

## UI and privacy

`SecurityPanel` remains unmounted until the research service is activated. The underlying DOM module is the real-browser acceptance target. Native browser WebAuthn JSON conversion is required; unsupported browsers receive an explanation rather than a weaker fallback. BroadcastChannel carries only `identity-changed`, never a user ID, token or assurance. Other tabs re-fetch server state. Local display refresh is not hosted background monitoring.

Session lists omit IPs, user-agent tracking and bearer tokens. Key lists omit public-key material. Names are rendered as text, not HTML. No ancestry, political agreement or official enrollment is requested.

## Schema, activation and rollback

The pinned Better Auth schema generator adds the passkey table and three non-user-writable session columns to the separate identity schema. Generate/review additive SQL using the configured factory; apply with an authorized migration role, never a runtime/lock role. Existing sessions are not backfilled as verified. Record exact source, schema digest and database/branch.

CI uses isolated PostgreSQL schemas and synthetic users. Staging additionally requires the exact Garden staging branch, verified mail, `assurance_policy: passkey-uv-v1`, and an independent `assurance_review_id`. Production remains denied by the environment policy. Rollback disables privileged admission, revokes high-assurance sessions and retains factors/history; it does not downgrade sensitive work to password-only access. Never restore revoked sessions from backup without invalidating them again.

## Evidence and remaining gates

Pure request, assurance, client and locking tests run without cloud resources. The identity CI journey uses the real pinned verifier, ephemeral PostgreSQL and Chromium virtual authenticators for signatures, UV refusal, origin/RP tampering, replay, rotation, last-key protection, expiry, revocation, reset races and cross-tab logout. Axe and viewport checks inspect the actual controls. Physical-device/cross-browser WebAuthn, independent review, SMTP, hosted HTTPS, pool capacity and deployed operation remain separate unverified gates.

Primary implementation references:
- https://github.com/better-auth/better-auth/blob/v1.7.7/packages/passkey/src/routes.ts
- https://github.com/better-auth/better-auth/blob/v1.7.7/packages/passkey/src/types.ts
- https://github.com/better-auth/better-auth/blob/v1.7.7/packages/better-auth/src/api/routes/password.ts
- https://www.better-auth.com/docs/plugins/passkey
- https://www.better-auth.com/docs/concepts/session-management

E2EESA remains pinned in `docs/security/standard-crosswalk.json`. Neither WebAuthn nor CI is independent certification.
