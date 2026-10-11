# Membership and researcher onboarding - GDN-023

## Boundaries

Verified email identity (GDN-021) is not a research membership. An active workspace membership is not a publication approval. Role vocabulary distinguishes contributor, transcriber, translator, researcher, reviewer, editor, rights reviewer, community adviser, moderator and administrator; administrators do not inherit scholarly or rights-review authority.

The server obtains the subject and verified email from the existing cache-free identity adapter. HTTP bodies cannot supply subject IDs, roles, approval flags or institutional-verification status. A contributor can request membership and describe expertise without an institutional credential. Expertise always remains self-reported. Workspace access requires a valid invitation and three attestations against the workspace's current policy digest. These attestations record acknowledgment, not demonstrated scholarly competence. Revised policies require renewed attestations; suspended/revoked memberships cannot reactivate themselves.

## Invitations and grants

The token is 32 random bytes encoded canonically as base64url, stored only as SHA-256. Email binding uses a separate server HMAC key; hashes are not public or anonymous data. Verified email case-folding is preserved without collapsing plus or dot variants. Issuance requires a live administrator grant through a distinct NOLOGIN capability role. No administrative HTTP issuance endpoint is enabled pending privileged-session controls. Administrators are bootstrapped only by a separately reviewed operator process; the migration creates none.

Invitations expire within seven days. Grants expire within ninety days and no later than the issuing grant. Single-use consumption, grant creation and membership transition commit in one transaction. Redemption locks the invitation and rechecks its issuer, email binding, expiry, workspace policy and suspension. Revocation/expiry are checked anew for each request; previously returned metadata is not an authorization token.

## Accountable reviewer assignment

An assignment refers to an editorial-registered target and exact revision digest. Its author is read from the target registry, not supplied by the assignment caller. The issuer must hold editor/administrator authority, the reviewer the specific research/rights/community role, and the reviewer must differ from the author. Both role-grant identities, actor, reviewer, author and revision are retained. An assignment starts as `assigned`; it does not certify that a review occurred. Actual scholarly independence and conflicts require additional review workflows.

## Database and transport

Migration `0003_membership.sql` is additive. Raw membership, invitation and review tables are not granted to runtime capability roles. Narrow SECURITY DEFINER functions use fixed schema-qualified references and revoked PUBLIC execution. Application transactions set `garden_research` locally, bind all SQL values and roll back before pool reuse. A failed rollback destroys the connection. The database functions trust the authenticated server to pass the verified subject; they are not a server-independent identity or end-to-end encryption mechanism. GDN-024 supplies record-level isolation and transaction context.

The bounded same-origin JSON adapter exposes only request, attest and accept operations. Its module is not mounted on the public or research application yet. Responses are non-cacheable and errors are redacted. There are no external invitations or real email deliveries in this change.

## Acceptance and rollout

Tests cover role transitions, invitation replay/expiry/email mismatch, policy refresh, suspension, assignment version/role/self-review denial, and onboarding through the existing real Better Auth lifecycle against ephemeral PostgreSQL. Synthetic CI does not authorize use with contributor records. The new migration has not been applied to Neon; production activation, SMTP, administrative MFA, browser onboarding UI and independent security review remain open. Roll back application activation, not successful historical membership/audit records. Do not run destructive down migrations.
