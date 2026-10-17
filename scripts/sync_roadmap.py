#!/usr/bin/env python3
"""Reconcile approved dependencies and observed PR mappings without inferring readiness."""
import argparse
import copy
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def approved_dependencies(plan):
    """Validate the source graph before copying any edge into the consumer registry."""
    rows = plan.get("prs", [])
    ids = [row.get("id") for row in rows]
    if not ids or any(not isinstance(item, str) or not item for item in ids) or len(set(ids)) != len(ids):
        raise ValueError("invalid approved work IDs")
    known = set(ids)
    gate_ids = set(plan.get("external_gates", {}))
    graph = {}
    applicability = {row["id"]: row.get("applicability") for row in rows}
    for row in rows:
        dependencies = row.get("depends_on")
        gates = row.get("external_gates")
        if (not isinstance(dependencies, list) or any(not isinstance(x, str) or x not in known for x in dependencies)
                or len(set(dependencies)) != len(dependencies) or row["id"] in dependencies):
            raise ValueError("invalid approved dependencies")
        if (not isinstance(gates, list) or any(not isinstance(x, str) or x not in gate_ids for x in gates)
                or len(set(gates)) != len(gates)):
            raise ValueError("invalid source external gates")
        if row.get("applicability") == "current_scope" and any(applicability[x] == "conditional_government" for x in dependencies):
            raise ValueError("current work cannot depend on conditional government activation")
        graph[row["id"]] = dependencies
    visiting, seen = set(), set()
    def visit(item):
        if item in visiting:
            raise ValueError("cyclic approved dependencies")
        if item in seen:
            return
        visiting.add(item)
        for dependency in graph[item]:
            visit(dependency)
        visiting.remove(item)
        seen.add(item)
    for item in ids:
        visit(item)
    return graph

def reconcile(canonical, plan, execution):
    result = copy.deepcopy(canonical)
    if result.get("repository") != execution.get("repository") or result.get("repository") != "neophilism/The-Garden":
        raise ValueError("repository mismatch")
    expected = [x["id"] for x in plan["prs"]]
    items = result.get("units")
    if not isinstance(items, list) or [x.get("id") for x in items] != expected or result.get("plannedPrCount") != len(expected):
        raise ValueError("canonical PR registry and approved specifications diverge")
    graph = approved_dependencies(plan)
    source = {row["id"]: row for row in plan["prs"]}
    numbers = set()
    for index, item in enumerate(items):
        # The approved source owns these fields. Normal read-only CLI use fails
        # on any difference; --write deliberately restores the exact arrays.
        item["dependsOn"] = list(graph[item["id"]])
        # X-gates include action-specific and already-resolved prerequisites.
        # They are not cross-repository dependencies or blanket human blockers.
        item["sourceExternalGates"] = list(source[item["id"]]["external_gates"])
        state = execution.get("work_items", {}).get(item["id"], {})
        number = state.get("github_pr_number")
        current = item.get("prs", [])
        if not isinstance(current, list) or any(type(n) is not int or n < 1 for n in current):
            raise ValueError("invalid canonical PR mapping")
        if index >= 196 and (number is not None or current):
            raise ValueError("conditional government cannot activate")
        if number is not None:
            if type(number) is not int or number < 1 or current not in ([], [number]):
                raise ValueError("conflicting observed mapping")
            item["prs"] = [number]
        elif current:
            raise ValueError("canonical mapping lacks execution evidence")
        for mapped in item.get("prs", []):
            if mapped in numbers:
                raise ValueError("one PR cannot silently complete multiple work units")
            numbers.add(mapped)
    # A mapped PR is not a completed milestone. Preserve source semantics and all
    # unrelated fields; live status belongs to actual GitHub and acceptance evidence.
    return result

def validate(canonical, plan, execution):
    result = reconcile(canonical, plan, execution)
    if result != canonical:
        raise ValueError("Canonical PR registry is stale; reconcile approved dependencies and observed execution before merging.")
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    read = lambda p: json.loads((ROOT / p).read_text())
    current = read("registry/prs.json")
    plan, execution = read("plan/plan.json"), read("plan/execution.json")
    result = reconcile(current, plan, execution) if args.write else validate(current, plan, execution)
    if args.write:
        (ROOT / "registry/prs.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print("Canonical PR registry: %d units; %d approved dependency edges; %d observed PR mappings; no readiness or completion inferred." %
          (len(result["units"]), sum(len(x["dependsOn"]) for x in result["units"]), sum(bool(x.get("prs")) for x in result["units"])))
if __name__ == "__main__":
    main()
