# Testing and evidence contract

GDN-045 controlled extraction and storage-boundary coverage runs in the existing storage CI workflow: `python3 -I -m unittest discover -s tests/import -v` and `node --test tests/storage/*.test.mjs`. This includes an actual SIGKILL transaction recovery test and a generated 422,723,584-byte SQLite fixture under a 256 MiB worker address-space cap. See `docs/runbooks/corpus-staging.md` for repeatable commands and acceptance limits; these are synthetic engineering checks, not historical corpus review.

The PR catalog contains 630 individually identified acceptance criteria and 630 specified test scenarios. These are implementation requirements, not executed application tests. Global regression and manual-review obligations apply in addition.

## Unit and property tests

Pure fiscal functions must cover fixed return, positive qualifying income, final cap, refunds, zero/negative income and aggregate reconciliation. Query ASTs, historical date intervals, identity merges, status transitions and consent combinations require boundary/property tests. Unicode and exact source offsets require explicit fixtures.

## Integration and migration

Use real PostgreSQL roles/policies in tests, not only mocked authorization. Exercise pooling, outbox crash/retry, object access, converter isolation, index rebuilds, source locators and third-party contract failures. Reconcile all 106 source tables, source/edition namespaces and open recovery gaps. A passing integrity_check does not prove historical accuracy or source completeness.

## Security and privacy

Generate an allow/deny matrix across user roles, workspaces and public/restricted/sensitive/sealed data. Cover HTML, JSON, facets/counts, image tiles, media range requests, caches, search, exports, notifications, websocket sync, provider calls and audit/logs. Include adversarial uploads, indirect prompt injection, insider roles, signature replay and revoked access. Use independent assessment for actual sensitive production and cryptographic claims.

## Accessibility and usability

Test complete newcomer, search/citation, source upload, transcription, review, publishing, contribution/withdrawal and account recovery flows with keyboard and screen readers, plus mobile, zoom/reflow, captions, reduced motion and low bandwidth. Automated tools are necessary but insufficient. Record actual participant/reviewer evidence and consent; synthetic personas are not user research.

## Reproducibility and scholarly review

Transcriptions, translations, claim decisions and computations need qualified independent review where required. Preserve contradictory evidence and inspected scope. An implementation agent must not invent reviewers or call model agreement independent scholarship. Reproduce computational output from exact code, runtime and input snapshots before publication.

## Production evidence

An application item's evidence identifies tested commit, deployment ID, environment, URL, migration state, timestamps, positive journey, negative-access/failure case and outcome. Evidence must be retrievable and safe to share. Never put tokens, private genealogies or restricted screenshots into public GitHub. Documentation-only items use a distinct evidence profile with repository validation and actual review, not fictitious deployment checks.

## Acceptance record shape

See evidence.schema.json. Required outcomes are pass/fail/blocked/not_run; a planned test is not pass. Completion requires actual records for all applicable acceptance criteria, required CI/reviews, data migration and live behavior. Regressions invalidate affected verification and reopen work.
