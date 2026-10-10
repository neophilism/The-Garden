#!/usr/bin/env python3
"""Validate governing architecture contracts; never claim application readiness."""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any
ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    'research_independence': True, 'public_research_without_login': True,
    'automatic_citizenship': False, 'sensitive_trait_persuasion_targeting': False,
    'family_data_for_advocacy_targeting': False, 'unqualified_zero_taxpayer_cost_claim': False,
    'source_integrity_proves_history': False, 'generated_images_are_archival_evidence': False,
    'government_authority_required': True, 'new_cost_requires_authorization': True,
    'production_requires_live_evidence': True,
}
def validate(contract: dict[str, Any], plan: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    expected = {f'F{n:02}' for n in range(1, 44)}
    if contract.get('plan_id') != plan.get('plan_id'): errors.append('Plan identity mismatch')
    if set(contract.get('features', {})) != expected: errors.append('Feature inventory mismatch')
    if {f['id'] for f in plan['features']} != expected: errors.append('Baseline feature mismatch')
    if contract.get('ownership_type') != 'accountable_role_not_claimed_staffing': errors.append('Staffing cannot be inferred')
    releases = {r['id'] for r in plan['releases']}
    for fid, assignment in contract.get('features', {}).items():
        if assignment.get('owner_role') not in contract.get('roles', {}): errors.append(f'{fid}: unknown owner')
        release = assignment.get('full_feature_acceptance_release')
        if release not in releases: errors.append(f'{fid}: unknown release')
        if (fid in {'F42', 'F43'}) != (release == 'RG'): errors.append(f'{fid}: conditional release mismatch')
    for key, expected_value in REQUIRED.items():
        if contract.get('invariants', {}).get(key) is not expected_value: errors.append(f'Invariant violated: {key}')
    return errors

def main() -> int:
    try:
        errors = validate(json.loads((ROOT/'docs/product/feature-contract.json').read_text()), json.loads((ROOT/'plan/plan.json').read_text()))
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f'Invalid contract: {exc}'); return 2
    for error in errors: print(error)
    if not errors: print('PASS: 43 feature owners, release boundaries and charter invariants; not production evidence.')
    return int(bool(errors))
if __name__ == '__main__': raise SystemExit(main())
