#!/usr/bin/env python3
"""Cross-check approved Garden plan against independently recorded GitHub evidence.

Planned GDN ordinals are not GitHub PR numbers; merging is not acceptance
and a deployed feature requires separate live verification.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def validate(plan, execution, progress, mapping):
    prs = plan.get("prs", [])
    if len(prs) != 210 or [p.get("id") for p in prs] != ["GDN-" + str(i).zfill(3) for i in range(1, 211)]:
        raise ValueError("approved plan inventory changed")
    expected_ids = {p["id"] for p in prs}
    if len(plan.get("features", [])) != 43 or any(not x.get("prs") or set(x["prs"]) - expected_ids for x in plan["features"]):
        raise ValueError("43 features must map to real planned work")
    workstreams = plan.get("workstreams", [])
    if len(workstreams) != 16 or sum(s["last"] - s["first"] + 1 for s in workstreams) != 210:
        raise ValueError("invalid workstream intervals")
    adjacency = {p["id"]: p["depends_on"] for p in prs}
    seen, visiting = set(), set()
    def visit(name):
        if name not in adjacency: raise ValueError("dependency outside plan")
        if name in visiting: raise ValueError("cyclic dependency")
        if name in seen: return
        visiting.add(name)
        for dep in adjacency[name]: visit(dep)
        visiting.remove(name)
        seen.add(name)
    for item in adjacency: visit(item)
    if progress.get("current_scope_items") != 196 or progress.get("conditional_items") != 14:
        raise ValueError("scope denominators changed")
    if mapping.get("sourceRepository") != "neophilism/The-Garden" or mapping.get("roadmapVersion") != 1:
        raise ValueError("Engine Room identity mismatch")
    numbers = mapping.get("pullRequestNumbers")
    if not isinstance(numbers, list) or len(numbers) != 210:
        raise ValueError("PR mapping length mismatch")
    if any(number is not None for number in numbers[196:]):
        raise ValueError("conditional governmental PRs cannot be active")
    if len({x for x in numbers if x is not None}) != sum(x is not None for x in numbers):
        raise ValueError("duplicate mapped GitHub PRs")
    statuses = execution.get("work_items", {})
    merged = 0
    for row, number in zip(prs, numbers):
        state = statuses.get(row["id"])
        if number is None:
            if state and state.get("github_merge_sha"):
                raise ValueError("merged work missing approved PR mapping")
            continue
        if not isinstance(number, int) or number < 1 or not state or state.get("github_pr_number") != number:
            raise ValueError("planned and actual PR mapping diverged")
        if state.get("github_merge_sha"):
            if not state.get("ci_url") or state.get("accepted") not in (False, True):
                raise ValueError("merged item lacks exact CI or acceptance distinction")
            merged += 1
        if state.get("production_verified") and not state.get("github_merge_sha"):
            raise ValueError("production claimed without actual merge")
    if progress.get("remote_prs_opened") != sum(x is not None for x in numbers):
        raise ValueError("opened mapping count is inaccurate")
    if progress.get("verified_merged_items") != merged:
        raise ValueError("merged numerator not evidence-backed")
    if progress.get("production_verified_items") != 0 or execution.get("production_verified_items") != 0:
        raise ValueError("Garden has no verified production capabilities yet")
    return {"plan_items": len(prs), "mapped_prs": sum(x is not None for x in numbers), "verified_merges": merged, "production_verified": 0}

def main():
    read = lambda filename: json.loads((ROOT / filename).read_text())
    result = validate(read("plan/plan.json"), read("plan/execution.json"), read("plan/progress.json"), read(".exechub/approved-pr-mapping.json"))
    print(json.dumps(result, sort_keys=True))

if __name__ == "__main__":
    main()
