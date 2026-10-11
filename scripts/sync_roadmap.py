#!/usr/bin/env python3
"""Reconcile canonical roadmap mappings with observed execution, without inferring completion."""
import argparse
import copy
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def reconcile(canonical, plan, execution):
    result = copy.deepcopy(canonical)
    if result.get("repository") != execution.get("repository") or result.get("repository") != "neophilism/The-Garden":
        raise ValueError("repository mismatch")
    expected = [x["id"] for x in plan["prs"]]
    items = result.get("milestones")
    if not isinstance(items, list) or [x.get("id") for x in items] != expected or result.get("plannedPrCount") != len(expected):
        raise ValueError("canonical roadmap and approved specifications diverge")
    numbers = set()
    for index, item in enumerate(items):
        state = execution.get("work_items", {}).get(item["id"], {})
        number = state.get("github_pr_number")
        current = item.get("pullRequests", [])
        if not isinstance(current, list) or any(type(n) is not int or n < 1 for n in current):
            raise ValueError("invalid canonical PR mapping")
        if index >= 196 and (number is not None or current):
            raise ValueError("conditional government cannot activate")
        if number is not None:
            if type(number) is not int or number < 1 or current not in ([], [number]):
                raise ValueError("conflicting observed mapping")
            item["pullRequests"] = [number]
        elif current:
            raise ValueError("canonical mapping lacks execution evidence")
        for mapped in item.get("pullRequests", []):
            if mapped in numbers:
                raise ValueError("one PR cannot silently complete multiple work units")
            numbers.add(mapped)
    # A mapped PR is not a completed milestone. Preserve source semantics and all
    # unrelated fields; live status belongs to actual GitHub and acceptance evidence.
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    read = lambda p: json.loads((ROOT / p).read_text())
    current = read("registry/roadmap.json")
    result = reconcile(current, read("plan/plan.json"), read("plan/execution.json"))
    if args.write:
        (ROOT / "registry/roadmap.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    elif result != current:
        raise SystemExit("Canonical roadmap mappings are stale; reconcile observed execution before merging.")
    print("Canonical roadmap: %d units; %d observed PR mappings; no completion inferred." %
          (len(result["milestones"]), sum(bool(x.get("pullRequests")) for x in result["milestones"])))
if __name__ == "__main__":
    main()
