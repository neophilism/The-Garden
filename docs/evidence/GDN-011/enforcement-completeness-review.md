# GDN-011 server enforcement completeness review

This is a bounded AI-assisted source review of the merge-evidence evaluator based on verified main `269f62d8f8c99ec74cdbaec2d04d3303df1eb87f`. It is separate from the original PR57 review and does not replace its execution history. Exact implementation, test, policy and operating-guide hashes are recorded in [the component evidence](enforcement-completeness.json).

## Confirmed issue and correction

The original evaluator checked each remotely required check against successful local evidence, but did not require GitHub's configuration to cover every trusted policy check and app binding. It also recognized the `enforce_admins` field without requiring enabled administrator enforcement. The original module could therefore approve a synthetic all-green snapshot whose remote strict protection required no checks, only a subset, or allowed an unspecified app, and could accept administrator exemption. This was a verifier evidence-completeness issue; no actual GitHub bypass or protection mutation was attempted.

The patch adds the reverse coverage check and requires positive exact app IDs for unique required contexts. It also requires the documented GET response's `enforce_admins.enabled` to be boolean true. A request payload's bare boolean does not qualify as readback. Malformed requirement collections now yield denial receipts. Legacy context names can add evidence requirements but cannot substitute for app binding. The operating guide retains the current provider limitation and owner-authorized guarded merge path.

The 93-test canonical suite retained the original 55 tests and added 38 cases. Against the old module, 67 passed and 26 failed; the identical test source passed 93/93 after the fix. The failures include missing denial receipts for malformed collections as well as affirmative eligibility for weak protection. Existing invalid-app denials were kept as regression controls. Required check names, trusted app ID 15368, seven workflow paths, source receipt format and merge APIs were unchanged.

## Review boundary

The provider read remains unavailable with HTTP403 while the branch summary reports protection disabled and the visible ruleset list is empty. Current GitHub tool discovery exposes no administrative mutation method; its GET-only fetch connection also lacks Administration access. This code cannot install protection or make GDN-011 complete.

The local tests use a synthetic provider snapshot following the documented GitHub GET shape. They do not establish an authenticated production protection read, a live merge queue, successful remote CI for this patch, or an atomic base lease. The evaluator remains read-only, requires fresh source and final confirmation evidence, preserves blocking reviews and unsupported remote requirements, and adds no merge executor or bypass.

## Independent AI peer result

A separate contributor reviewed the frozen module and tests and independently ran all 93 focused tests on 17 October 2026, with zero failures or skips and identical source hashes before and after execution. The run used the same five-key environment and ordinary child-process execution. No concrete source blocker or requested edit remained.

The reviewer also ran 23 independent baseline/current comparison cases. Seventeen previously eligible incomplete, wildcard, administrator-exemption or duplicate-requirement cases now deny. Complete requirements, reordered requirements, an empty legacy projection and an additional successful legacy status remain eligible; unknown app-bound requirements and a failed required check remain denied. These synthetic canaries supplement the durable regression suite and do not establish live GitHub configuration. The component evidence retains the peer observation, script and log hashes. A second contributor performed a bounded source/test read and reported no concrete issue, without running a duplicate suite.
