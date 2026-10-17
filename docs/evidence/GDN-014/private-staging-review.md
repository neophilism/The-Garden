# GDN-014 private staging boundary review

Review date: 2026-10-17. Scope: guarded startup/build, HTTP ingress, application
credential isolation, cache behavior, verifier and local process lifecycle.
This is substantive AI-assisted source and integration review. It is not an
independent human audit or certification.

The review examined the implementation separately from its author. The initial
reviewed input was base `f80a2373aa5825e20aee666eeb1f984a58072fcd` plus the
working-tree implementation, with individual source SHA-256 values retained.
The same reviewed code was then committed and rebased on merged main
`b8bc6e255378867d8583437d438b20b6ca0d46e0` as
`af6d39548f42686c7dff37d3c7b5cff12955c98c`. The adjacent
`private-staging-local.json` identifies the actual clean commit, runtime,
commands, outcomes and file digests used for the final local verification.

## Findings and fixes

1. **A late Next upgrade listener could still execute after socket destruction.**
   The initial guard destroyed upgrade sockets in its first EventEmitter
   listener. Next 16.4.0 installs its own upgrade listener after the first normal
   request, and EventEmitter continues invoking later listeners even after the
   socket is destroyed. This allowed unauthenticated upgrade input to reach
   framework routing code, although no response-byte disclosure was observed.
   Both native server constructors now use Node 24's
   `shouldUpgradeCallback: () => false`, and the ordinary request gate rejects
   Upgrade headers before invoking an application. A late-listener regression
   observes zero calls; the actual warmed Next server also denies the upgrade.

2. **A process smoke could count forced termination as successful shutdown.**
   The initial smoke's cleanup fallback used SIGKILL after a timeout but did not
   fail the check when that fallback ran. The check now requires an unforced
   clean exit with code 0 and no terminating signal after SIGTERM. Forced kill
   remains cleanup and is a test failure. All four actual healthy process runs
   shut down cleanly before the fallback.

3. **Header removal needed to account for Node's lazy distinct-header view.**
   The first executable tests found that shrinking `rawHeaders` before Node
   materialized `headersDistinct` caused an exception because Node retained the
   original raw-header count. The gate now materializes both views before
   removing Authorization and Proxy-Authorization values. The app receives no
   ingress credential through normalized, raw or distinct header access.

No unresolved concrete defect remained in the bounded reviewed implementation.

## Executed local verification

- 19 focused runtime/build/verifier tests passed, including real HTTP negative
  access, canonical credentials, duplicate headers, cookie/query bypass denial,
  HTTPS forwarding, cache overrides, child-process environment isolation and
  source-mismatch rejection.
- The actual public export and Next research server each ran twice: four healthy
  runs, 80 HTTP checks, four denied unauthenticated upgrades after warmup, four
  clean SIGTERM exits and successful restarts.
- Fourteen unsafe-startup cases were rejected before a health listener became
  available: missing/wrong environment, missing token, wrong source,
  cross-environment and same-environment private database credentials, and
  attempted research activation for each surface.
- Both actual builds ran through the guarded build launcher. The generated
  test-only ingress token was absent from build output, the complete public
  export and the research build artifacts. No actual owner credential was used.

## Acceptance limits

This change is a partial engineering contribution to GDN-014. No provider
resource was created or changed. External Render HTTPS, project/environment
placement, remaining free capacity, provider forwarding behavior, browser Basic
authentication UX and hosted log behavior remain unverified. The anonymous
health response is intentionally limited to process existence. No personal or
research data was seeded, no research capability was activated, and no public
Garden website or duplicate Sites front end was created.

Online acceptance must retain actual service/deployment IDs, source SHA and
timestamped output from `scripts/verify-private-staging.mjs`. A local response
or committed Blueprint cannot supply those facts.

## CI integration

The `application-build` job in `.github/workflows/ci.yml` now runs
`node tools/quality/private-staging-smoke.mjs` immediately after the existing
runtime smoke. Its preceding `npm run check` builds both applications and
records their checkout SHA. The smoke creates its own ephemeral test-only token
and clean staging process environments; no owner/provider secret is supplied to
CI. The existing failure behavior, read-only permissions, source receipts and
credential checks remain intact.

Workflow parsing/policy and plan regression results are recorded in
`private-staging-ci.json`. Remote execution of this new step is **pending**;
this source integration does not establish a passing GitHub run or a deployed
service.
