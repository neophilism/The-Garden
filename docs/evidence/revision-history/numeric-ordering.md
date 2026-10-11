# Revision-history ordering correction

The audit export repair exposed the same defect in the historical entity, source and claim history readers: `SELECT version::text` creates a text output column, and an unqualified `ORDER BY version` refers to that output column. Beyond revision 9, lexical ordering returns 9 before 10 and invalidates keyset continuation.

The three queries now explicitly order and filter the stored `revisions.version` bigint. Response revision identifiers remain exact strings; no migration, stored content rewrite or interface version change is needed.

Regression coverage executes each actual repository reader and checks the SQL plus cursor binding. The real PostgreSQL historical, source and claim journeys each create at least fifteen revisions, cross 10/9, traverse every page exactly once, append another revision between pages and confirm it does not leak above the established keyset boundary. Existing RLS and revocation tests still apply. PostgreSQL verification is pending for this candidate until its CI runs pass.

This is maintenance of GDN-035, GDN-036 and GDN-038, not three additional completed milestones. No cloud changes, history deletion, blanket historical verification or production acceptance is implied. The correction does not freeze old content against authorized subsequent edits; current authorization continues to govern every page.

Reference: https://www.postgresql.org/docs/18/queries-order.html
