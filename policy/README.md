# The Garden — source document library

Organized after [The Cornerstone's source library](https://github.com/neophilism/The-Cornerstone/tree/main/policy), with the original documents kept separate from software implementation, a source checksum inventory, and explicit version and review states.

The Garden repository is **public**. Its policy and proposed legislation are intentionally available for public reading. Historical working documents in this directory are also accessible, but a repository file does not automatically establish independent historical verification, third-party licensing, family consent or permission to republish the original archival evidence on the website.

## Documents

| Collection | Contents | Status |
| --- | --- | --- |
| [Legislation](legislation/README.md) | Garden Act v1.0 (.docx, .md, .tex) and source/drafting notes (.md, .html) | Public policy proposal; not enacted |
| [Historical research](historical-research/README.md) | CP-018 / Atlas 1.30-alpha apparatus, corrections, image budget, file-system guide, research handoff, indexes, corpus manifests | Publicly accessible working research; not certified |
| [Supporting sources](supporting/README.md) | Original Garden policy Word document and charter/development crosswalk | Public policy source |
| [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json) | Original filenames, byte counts, SHA-256 checksums, provenance, missing originals and release distinctions | Versioned integrity inventory |
| [Large-source transfer procedure](historical-research/LARGE_ARCHIVES.md) | Git LFS and checksum verification for oversized manuscript and corpus bundles | Pending work |

## Latest-file and preservation rules

This source index is the **current GitHub entry point** for the files already transferred. The Library's October 11 `guide_Not-From-Nowhere_LATEST.html` is retained as a dated historical-research checkpoint, not as a live index of every new engineering PR. The authoritative development status is at [docs/CURRENT_STATUS.md](../docs/CURRENT_STATUS.md). Checkpoints and corrections are kept as distinct source versions rather than silently overwritten.

The original illustrated manuscript (219,069,956 bytes), all four corpus ZIPs, the African nations registry and some smaller records remain listed under `external_materials` in the manifest. All 12 original files were independently rehashed from their saved Library bytes on 12 October 2026; see [the byte-integrity evidence](historical-research/EXTERNAL_ORIGINALS_INTEGRITY_2026-10-12.json). **They have not been uploaded or imported to the platform.** Large originals require a reproducible, checksum-verified Git LFS or protected source-custody transfer; do not create unbacked pointers or assume historical import on the basis of an inventory.

When adding sources, preserve exact original bytes, update the manifest and run `python3 scripts/verify_policy_sources.py --check`. For separately held originals, run `python3 scripts/verify_policy_archives.py --source-dir <authorized-originals-dir> --require-all`. These two checks do not establish public-use rights. Distinguish owner-authored public policy documents, provisional scholarship, third-party evidence, and independently approved public site content. See [research charter](../docs/sources/research-charter.md), [editorial review](../docs/editorial/commissioning-and-review.md), and [research review states](../docs/research/scoped-review-states.md).
