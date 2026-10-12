# The Garden — policy, historical research, and legislation

This directory follows [The Cornerstone's policy/ arrangement](https://github.com/neophilism/The-Cornerstone/tree/main/policy): authored policy sources and a cryptographic source manifest, kept separate from app implementation. Unlike Cornerstone's expressly publication-approved originals, The Garden's archival corpus and illustrated working book **are not approved for unrestricted public publication**.

## Current documents

| Material | Repo location | Version | Status |
| --- | --- | --- | --- |
| Draft Garden Act | [Markdown](legislation/Garden_Act_v1-0_2026-09-28.md) and [LaTeX](legislation/Garden_Act_v1-0_2026-09-28.tex) | 1.0, 2026-09-28 | Proposed legislation; counsel review outstanding |
| Legislative sources / drafting notes | [Notes](legislation/Garden_Act_Source-and-Drafting-Notes_v1-0_2026-09-28.md) | 1.0, 2026-09-28 | Supporting research, not independent legal certification |
| Historical research working checkpoint | [Resume Here](historical-research/Not-From-Nowhere_Resume-Here.md) | CP-018 / 1.30-alpha | Operational handoff, NOT a released scholarly edition |
| Working corpus component accounting | [Bundle manifest](historical-research/CORPUS-BUNDLE-MANIFEST_CP-018_2026-10-10.json) | Corpus 1.18 | Archive inventory, NOT the archive contents |
| Public repository source manifest | [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json) | 2026-10-12 | Sizes/hashes for repository text originals |
| Historical archive access and protection | [Research custody guide](historical-research/README.md) | CP-018 | Restricted source and verification gates |
| Additional supporting sources | [Supporting docs](supporting/README.md) | living | Provenance and editorial/engineering crosswalk |

## What is deliberately absent

The working illustrated manuscript, correction log, image budget, nation registry, original family/source records, large SQLite corpus, and CORE/EXPORTS/SOURCES/RECOVERY bundles are **not copied into public Git**, even if they were once referenced in a public-facing document index. Their rights, privacy, provenance, and verification are separate decisions. The access-controlled originals remain in the Library; their checkpoint metadata is preserved here, and publication must follow scoped review and source-specific approvals. Consult `docs/sources/research-charter.md`, `docs/research/scoped-review-states.md` and `docs/product/charter.md`.

## Updating the index

Preserve immutable originals and their original names. Put an approved new document alongside its former version, add/replace a declared manifest entry with measured bytes and SHA-256, run `python3 scripts/verify_policy_sources.py --check`, and update links here. A new version must not erase earlier checkpoints or imply historical verification, rights clearance, elected government, adoption of a bill, or deployment. Restricted materials instead use approved private source control, encrypted storage and rights-aware accession workflows. Never include raw private download URLs, private records, credentials or unreviewed image originals in a public repository.
