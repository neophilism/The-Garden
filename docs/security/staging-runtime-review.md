# Staging runtime source review — 2026-10-16

Scope: the public export server, liveness/readiness endpoints, source manifest,
and external smoke command. This is an AI-assisted implementation review and
automated test record, not an independent human audit or E2EESA certification.
CI binds the executable results to its exact checkout SHA and source artifact.

Threats tested: path traversal and alternate encodings; symlink and hidden-file
disclosure; mutation attempts; source/environment mixups; ambient credentials;
logging of headers, queries, bodies and unknown paths; startup without an export;
and both process restart paths. A static export inventory resolves requests, so
untrusted URL bytes never become a filesystem path. Public content uses a CSP
with per-document hashes for Next's inline bootstrap scripts, no third-party
sources, and no inline-script allowance. Browser CI tests navigation with that
policy in place. Accessibility instrumentation is injected by the debugger,
without altering the policy served to users.

Operational events use a closed field set. Request observation has no default
exporter or durable storage. Correlation IDs are newly generated for each request,
never trusted from inbound headers, and are not exported by default. Provider
access logs are outside this module; their retention/access policy remains a
separate deployment check. Do not claim network anonymity or DP.

Canonical documents inspected at upstream commit
`d916938cb6b0e6569edfde88555984ddacb96021`:
`spec/privacy-preserving-telemetry.md` and `spec/software-supply-chain.md`.
Their requirements informed the no-export default, content-free diagnostics,
locked inputs and explicit source identity. This bounded work does not satisfy
the full signed/reproducible supply-chain profile. The existing full Garden
crosswalk stays pinned to its reviewed baseline until a complete re-review.

Research readiness deliberately remains unavailable because its runtime
dependencies and routes are not connected yet. Missing human review does not
cause that response. No identity, archival-content or sealed-encryption promise
is made by a healthy shell. Follow-up work must test the actual connected flows.
