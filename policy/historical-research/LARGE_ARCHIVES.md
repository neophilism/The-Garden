# Large original research files

This private repository can store its approved source collection, but some original files exceed GitHub's ordinary Git size limits. The illustrated Atlas Word manuscript (~219 MB) and SOURCES ZIP (~178 MB) exceed the 100 MiB per-file ceiling. Other corpus components are also large. The Garden's [source manifest](../SOURCE_MANIFEST.json) records sizes, hashes and the corresponding authenticated Library files.

An authorized maintainer with repository and source access must use **Git LFS**, after checking the project's available storage, bandwidth and any additional costs. Download the exact originals, verify each file's byte count and SHA-256, track the archive extensions with Git LFS, push both commits and LFS objects, and verify readback through a clean private clone. Update the manifest only after the objects exist and match the recorded hashes.

Do not commit LFS pointer files alone, use the ordinary Git API to upload files above platform limits, silently repack corrupted versions, or claim the actual archival corpus has been ingested into the research platform. Do not put this private directory into a public web export without separate publication review.

For smaller untransferred files, the manifest records the exact missing items. Preserve their existing Library copies until verified transfer and Git source-control custody are complete.
