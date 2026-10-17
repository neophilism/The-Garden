# AI-assisted recovery and source review — 17 October 2026

The recovered files were read without changing their original source. Their exact sizes and SHA256 values are retained in `recovery.json`. The recovered implementation hash was `335d71bb83f4d1ef7ef3e298b8415b63bfe3c62aa9d695b076bb2f6ec2cf0cab`; its original 27 tests passed when rerun but missed the reproduced defects below. That old passing result is preserved as provenance and is not final acceptance evidence.

The implementing agent, coordinating agent and a separate read-only AI peer examined the encryption boundary, actual audited-decision contract, provider adapter, negative fixtures and pinned canonical sources. The peer independently reproduced the recovered defects and reran the corrected suite. This is AI-assisted source review, not an independent human security audit or certification.

## Findings and corrections

| Finding | Correction and regression evidence |
| --- | --- |
| Disablement/cancellation in the final authorization callback, or revocation in its asynchronous decision-audit tail, could still return plaintext. | Strict synchronous current-state enable/cancellation fences follow asynchronous work and precede result return. Current metadata and grant are rechecked after each decision-audit tail. Tests cover disablement, cancellation, grant withdrawal and reclassification; all result types are denied at the final authorization boundary. |
| A grant withdrawn during the key-use attempt audit still allowed a provider call. | A fresh gate follows the attempt audit, with another post-decision-tail permission/context recheck. Encryption, decryption and rewrap regressions assert that the actual provider call count does not increase. |
| Provider clients could rewrite request pins and have their altered reply accepted against the mutated request. | Metadata and client methods are captured before asynchronous work. Client metadata is frozen, key material copied, replies checked against captured primitives, and only factory-created adapters are accepted. |
| Timeout released API capacity while the underlying provider kept running; a late unwrapped key could remain reachable and nonzero. | Actual unsettled provider calls retain separate bounded capacity until settlement. Late replies are discarded and cleared where reachable. Tests delay a real synthetic-client unwrap result through both timeout and cancellation, reject further work at capacity, verify eventual clearing, and verify reuse after settlement. |
| Equal contexts with reordered JSON properties rejected, and envelope digests depended on property order. | Validated schema-specific canonical serialization governs authenticated context and full envelope digests. Reordered JSON round trips decrypt and preserve predecessor/successor hashes; changed semantic fields still deny. |
| A faulty client could return the raw DEK, including copying it and clearing its own input to evade an equality comparison. | Raw-key comparison uses a digest captured before dispatch. The exact copy-then-clear regression rejects and confirms the retained raw reply is zeroed. All reachable reply buffers transfer to the adapter and are cleared after copying or rejection. |
| Malformed API options could escape redacted errors; unsupported async enablement could leave an unhandled rejected promise. | Options are validated inside the error boundary. Async enablement never grants access, and its rejected promise is observed. Negative tests cover null options, invalid signals and rejecting async predicates. |

Existing authenticated-release behavior was retained: GCM `update` output is not returned before `final` succeeds, temporary plaintext/key copies are cleared, and caller-owned plaintext input is preserved. The recovered format already rejected non-16-byte tags; explicit cipher/decipher `authTagLength: 16` makes that contract visible. Algorithm substitution and invalid key/tag lengths reject in fresh negative cases.

Rotation remains preparation. Tests verify allowed old/new versions, separate unwrap/wrap permission, content preservation, no-op rejection, failed new-key wrapping with a readable old envelope, and denial with missing or incorrect restored keys followed by success only with the original synthetic key.

## Exact reviewed and tested source

Implementation commit: `8bc3ab07fbe234972ed65f65a4426fc0813ea86b`, tree `3e704f755bb3c08aba438c0f65bfb27d6f9a93d6`, based on `b8bc6e255378867d8583437d438b20b6ca0d46e0`.

- `services/workers/src/trusted-encryption.mjs`: SHA256 `11a2b4104630314646c1d6f62c5976a4edb6134d1cea00609c5dc372547ff1fc`.
- `tests/security/trusted-encryption.test.mjs`: SHA256 `a449cf49cb4c8e6d5c562cb504937bf488302a891353a7dc524977f24c94f611`.
- Focused suite: **48 passed, 0 failed**, independently rerun by the peer against those hashes on Node v24.19.0.
- Full `npm run check`: **1,444 passed, 0 failed**, all type checks and both application builds passed at the implementation commit, completed 13:18:35 UTC.
- Existing local process smoke: public and research start/restart passed in four runs; three invalid startup canaries rejected, completed 13:19:21 UTC.
- Plan validation and **30 plan tests** passed. Full observations and source/configuration hashes are in `tests.json`.

The earlier continuation's public build failed because ambient credentials reached the public configuration boundary. Recovery used a fresh child environment containing only PATH, HOME and nonsecret build controls; both builds now pass. The configuration guard is unchanged, SHA256 `4f898b62bdf62da766cc3e05fe290d7b4e0fc9ce298076596493beffbff625b0`. Credential rejection remains tested. This resolves the build environment problem without disabling the guard. Next-generated declaration edits were restored after verification; they are not part of this contribution.

Evidence and two wording-only contract clarifications follow the implementation commit. No runtime, test, dependency, configuration, workflow, source import or provider change is part of that evidence follow-up. Remote CI must still test the eventual PR head and integration source before merge; these local receipts do not predict that result.

## Remaining boundaries

There are no unresolved concrete findings from the bounded source/fixture review. The component is disabled by default and unmounted. It has no real provider transport, IAM/custody configuration, persisted key-version catalog, atomic envelope CAS, rollback anchor, transactional authorization lease, downstream delivery control or deployed recovery drill. Sequential revalidation cannot make those host responsibilities atomic. The provider and operator can access plaintext; no E2EE, HSM, complete memory erasure, provider approval, canonical conformance or certification is claimed. External human review remains deferred under the owner policy.

No production records, real keys, paid resources, provider mutations or public publication were used for this work. The unit remains a partial engineering contribution pending actual provider and host integration, with deployment/live verification explicitly false.
