#!/usr/bin/env python3
"""Fail-closed checks for Garden's authorized infrastructure inventory.

Validates declared identities and mapping semantics, not provider health.
"""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TOTAL, CURRENT, CONDITIONAL = 210, 196, 14

def validate(inventory, manifest_text, mapping):
    if inventory.get("repository", {}).get("identity") != "neophilism/The-Garden":
        raise ValueError("foreign repository")
    n = inventory.get("database", {})
    if n.get("project_id") != "royal-union-78374030" or n.get("branch_id") != "br-curly-band-b5aatp1e" or n.get("database_name") != "neondb":
        raise ValueError("foreign Neon database or branch")
    render = inventory.get("hosting", {})
    if render.get("workspace_id") != "tea-db23jkks728c73av263g" or render.get("user_designated_project_id") != "prj-db57f92jnfac739ghic0":
        raise ValueError("foreign Render target")
    if render.get("deployment_verified") is not False or render.get("service_id") is not None:
        raise ValueError("unverified Garden deployment claimed")
    if inventory.get("engine_room", {}).get("registration_observed") is not False:
        raise ValueError("unverified Engine Room registration claimed")
    if n.get("schema_migrated") is not False or n.get("tables_observed") != 0:
        raise ValueError("unexpected database state")
    if inventory.get("cost_policy", "").startswith("No paid") is False:
        raise ValueError("cost approval contract missing")
    if any(k in json.dumps(inventory).lower() for k in ("database_url=", "api_key=", "private_key=", "password=")):
        raise ValueError("secret material must not be present")
    if not re.search(r"(?m)^  repository: neophilism/The-Garden$", manifest_text):
        raise ValueError("Engine Room manifest repository mismatch")
    if not re.search(r"(?m)^  approved: true$", manifest_text) or not re.search(r"(?m)^  planned_prs: 210$", manifest_text):
        raise ValueError("approved plan denominator missing")
    sizes = [int(n) for n in re.findall(r"(?m)^    prs: (\d+)$", manifest_text)]
    if len(sizes) != 16 or sum(sizes) != TOTAL or sizes[-1] != CONDITIONAL or sum(sizes[:-1]) != CURRENT:
        raise ValueError("missing, duplicated, or incorrectly scoped milestone")
    if mapping.get("sourceRepository") != "neophilism/The-Garden" or mapping.get("roadmapVersion") != 1:
        raise ValueError("mapping contract does not match manifest")
    numbers = mapping.get("pullRequestNumbers")
    if not isinstance(numbers, list) or len(numbers) != TOTAL:
        raise ValueError("mapping denominator mismatch")
    specified = [x for x in numbers if x is not None]
    if any(type(x) is not int or x <= 0 for x in specified) or len(specified) != len(set(specified)):
        raise ValueError("invalid/duplicate GitHub PR evidence")
    if numbers[:3] != [2, 3, 4] or any(x is not None for x in numbers[3:]):
        raise ValueError("unverified mapping of planned items to PRs")
    return True

def main():
    inv = json.loads((ROOT / "docs/integrations/integration-inventory.json").read_text())
    manifest = (ROOT / ".exechub/project.yml").read_text()
    mapping = json.loads((ROOT / ".exechub/approved-pr-mapping.json").read_text())
    validate(inv, manifest, mapping)
    print("Garden integration identities and exact 210-item Engine Room mapping consistent; live sync NOT verified")

if __name__ == "__main__":
    main()
