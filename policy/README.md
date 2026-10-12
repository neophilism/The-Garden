# The Garden — source documents

The Garden now follows the [Cornerstone `policy/` source-library pattern](https://github.com/neophilism/The-Cornerstone/tree/main/policy): policy originals, legislation, research companions, a cryptographic `SOURCE_MANIFEST.json`, and separate implementation/verification documentation.

**Repository visibility checked:** private on 12 October 2026. These are source documents for authorized collaborators, **not automatically approved public website content**. Independent historical, consent, licensing, legal and editorial decisions remain separate.

## Authoritative entry points

- [Garden legislation and drafting materials](legislation/README.md): original Word bill, LaTeX, Markdown and legislative source/drafting notes.
- [Historical research working checkpoint](historical-research/README.md): CP-018 / Atlas 1.30-alpha, apparatus, corrections, image budget, file-system guide, saved indexes, and corpus manifests.
- [Supporting documents](supporting/README.md): original Garden policy and supporting architecture/charter references.
- [Full source and custody inventory](SOURCE_MANIFEST.json): byte-exact source checksums, Library provenance and untransferred originals.
- [Large-document transfer runbook](historical-research/LARGE_ARCHIVES.md): Git LFS procedure and validation for the illustrated manuscript and corpus packages.
- [Current engineering status](../docs/CURRENT_STATUS.md): implementation/CI/deployment, **not** the historic CP-018 manuscript's version.

## Repository layout

```text
policy/
  README.md
  SOURCE_MANIFEST.json
  legislation/         original Garden Act .docx/.md/.tex and notes
  historical-research/ original CP-018 companions and manifests
  supporting/          original Garden policy and source references
```

The historical working book is **not yet wholly present** in Git. Its original illustrated Word file is 219,069,956 bytes, exceeding GitHub's ordinary 100 MiB file limit. The four 1.18 corpus ZIPs require an appropriate verified large-file transfer; additional small files that were rejected by the current GitHub connector are recorded rather than silently omitted. See the manifest's `external_materials` for exact names, source IDs, hashes where available and transfer status. **Do not mistake the archival manifest for the actual archive or a complete corpus migration.**

The Library's saved `guide_Not-From-Nowhere_LATEST.html` file was copied as a versioned snapshot, not as a guaranteed live link to the latest software. For development activity use the repository's current-status and execution registries.

## Updating sources

1. Make sure this repository stays private and collaborators have narrowly scoped access.
2. Preserve original filenames and bytes. Keep archived versions and reasoned corrections separately; never overwrite unreviewed historical evidence.
3. For new original bytes, add a manifest entry with SHA-256, byte count, role, provenance and review state. Run `python3 scripts/verify_policy_sources.py --check`.
4. For large files, follow the LFS runbook only after confirming available Git LFS capacity and any additional costs.
5. Treat research, translation, cataloguing, editorial approval, policy argument and actual web publication as different permission and verification states.

Other research integrity guidance: [research charter](../docs/sources/research-charter.md), [review states](../docs/research/scoped-review-states.md), [editorial review](../docs/editorial/commissioning-and-review.md). Public-source archival availability is not a grant of rights for redistribution.
