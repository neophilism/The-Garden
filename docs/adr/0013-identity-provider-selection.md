# ADR 0013: identity provider selection for GDN-021

Decision: self-managed Better Auth, pinned 1.7.7, on the existing research application's server with an isolated Postgres identity schema and least-privilege runtime role. No existing identity provider or users are replaced. Public reading is unaffected and contains no auth dependency.

Reason: the approved GDN-022 scope requires privileged MFA/passkeys. Neon's current Managed Better Auth plugin matrix does not expose these capabilities; enabling managed identity now would require an unnecessary later migration. The Neon auth skill routes this case to self-managed Better Auth on the existing app host. Upstream v1.7.7 documents two-factor and passkey support. GDN-021 implements the email/session foundation only; it does not claim MFA has been implemented.

Sources: https://neon.com/docs/auth/guides/plugins.md ; https://better-auth.com/docs/plugins/2fa ; https://better-auth.com/docs/plugins/passkey ; https://github.com/better-auth/better-auth/tree/v1.7.7 ; https://better-auth.com/docs/adapters/postgresql . The library's `better-auth/db/migration` API is used only against synthetic ephemeral CI, never during an application request or production startup.

Current implementation intentionally disables all account linking and social OAuth until verified two-identity proof and issuer/callback contracts exist. Ban state is checked from authoritative identity storage on every protected viewer lookup; cookie-cache shortcuts are off. Identity authentication never grants historical-record permissions, privileged assurance or citizenship. Operator impersonation endpoints are not exposed.

Production and unreviewed staging remain blocked. Real SMTP/OAuth origins, provider credentials, identity schema deployment, actual research routes, independent security review and privileged MFA are separate gates. CI uses synthetic accounts, captured in-memory email messages and loopback Postgres only; no external message is sent.
