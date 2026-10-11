# Authorization regression and capability isolation

GDN-031 extends the existing transaction context, permitted-use, archive-delivery,
identity and audit boundaries. It is not authorization to mount these services.

## Database identities

Each runtime login has exactly one of the registered Garden database capability
roles, with `INHERIT FALSE, SET TRUE`. The login and capability must have no
superuser, bypass-RLS, role-creation, database-creation, replication or inheritance
attributes. A runtime login cannot own schema, relation, routine or database
objects. Migration and identity-schema provisioning use distinct credentials.

`apps/research/access/database-role.mjs` checks the entire reachable membership
graph, including foreign and future unknown roles. A fixed blacklist would miss
newly introduced capabilities. `MEMBER`, `SET` and `USAGE` are separate checks:
NOINHERIT on a login alone does not establish the per-membership inheritance
setting. Credentials and names are never included in external failure messages.

A capability is checked before beginning trusted work and before commit, with
both session and active SQL role bound. Revocation, unintended SET ROLE changes,
object ownership or a contaminated pooled connection reject the transaction.
The connection is discarded for capability failures. The check is a defense in
depth boundary, not protection against a malicious database owner or trusted
application code deliberately using another pool. Database administration must
not grant additional direct privileges to runtime logins. This does not change
or certify a deployed database's grants.

## Executed test boundaries

The independent matrix model explicitly enumerates 11 research roles, six stored
record classifications, three record states and three grant states. The live
PostgreSQL journey asserts 594 expected read outcomes and 66 write outcomes. It
uses the real parameterized policy issuer, RLS, repository, audit and job SQL.
Synthetic identity/session and in-memory byte providers are deliberate adapters;
cryptographic WebAuthn and archive transport are tested by the existing separate
journeys. No real contributor records, original corpus or cloud resources enter
this suite.

The request suite covers record, snippet, JSON export, notifications,
collaboration, search results/counts/facets, signed downloads/media/tiles and HEAD.
Denied and nonexistent records must have identical tested response bodies,
status codes and content types. Unauthorized signed requests cannot reach object
acquisition. Numeric range, subject, workspace, record, revision and expiry
binding remain independent of the storage provider. This is not a statistical
latency measurement or a constant-time claim.

The audit route is unmounted. Auditor-only SQL access is separately exercised
for all research roles. AI, indexing and public-projection routes are absent:
negative canaries establish absence only, not implemented safe AI or indexing.
Future activation requires substantive provider-specific policy tests.

Worker tests use the real fenced queue and outbox: revocation before claim runs
no handler; withdrawal during work prevents completion; withdrawal after result
commit prevents new consumer effects. Handler work must be reversible/staged
until authorization and completion succeed. Arbitrary external side effects
cannot be undone by a database rollback and require their own controls.

## Endpoint registration

`tests/security/policy-matrix/registry.json` names the actual Next route files,
methods and executable test cases. `scripts/verify_policy_routes.py` refuses new
unregistered methods or paths and requires review for indirect exports and legacy
Pages API routes. A missing named test fails the gate; independent negative tests
prove the gate fails when a route or method is added without coverage.

Registration is not proof of semantic adequacy. A developer who adds a route must
add real allowed/denied, cross-scope and revocation tests, and obtain applicable
review before activation. The scanner is deliberately conservative, not a
complete JavaScript parser. Existing generic unmounted adapters must still pass
request-level tests even without a filesystem route.

## Running and evidence

Run `npm test`, `python3 scripts/verify_policy_routes.py` and the existing plan and
architecture suites. In the isolated PostgreSQL 18 CI job run
`node apps/research/access/isolation.ci.mjs` after the checksum-locked migrations.
CI refuses non-local/non-ephemeral targets. Browser tests inspect readiness and
confirm the unimplemented endpoints remain absent. Results record the exact
tested commit, counts and limits in `identity-evidence/isolation-matrix.json`.

CI artifacts and a merged PR do not establish independent security approval,
physical-device testing, provider configuration or production readiness.
