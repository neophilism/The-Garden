# GDN-016 additional real-database verification

This follow-up adds multi-session PostgreSQL tests for four concurrent idempotent enqueues and SKIP LOCKED behavior while another transaction holds a row. The lock-holder state is observed before the claim is attempted; a one-second statement timeout prevents a silently blocking claim from passing. A second SQL fixture checks that consumer receipts and database effects roll back and retry together.

The original GDN-016 PR #16 merged with passing repository/database/browser/storage checks. These additional files were prepared separately and must pass fresh CI themselves; their preparation is not a previous test result. This is follow-up verification for the same planned item, not another completed roadmap unit. External exactly-once effects, actual production workers and independent security review remain unverified.
