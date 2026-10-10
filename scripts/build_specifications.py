#!/usr/bin/env python3
"""Regenerate per-PR specifications and the catalog from plan/plan.json.

Does not change scope, statuses, evidence or provider state. Review generated diffs.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def main():
    plan=json.loads((ROOT/'plan/plan.json').read_text())
    cat='## 18. Complete pull-request execution catalog\n\nThe 210 identifiers below are planned integration units, not opened GitHub PRs. PRs 001-196 form current public/research scope. PRs 197-210 are conditional governmental work. Each acceptance criterion and test has a stable ID in plan.json and its per-PR file. All tests listed in PR specifications are future application tests, not tests reported executed in preparing this plan.\n\n'
    for phase in plan['workstreams']:
        cat+=f"### {phase['id']} - {phase['title']}\n\n"
        for p in [p for p in plan['prs'] if p['workstream']==phase['id']]:
            spec=f"#### {p['id']} - {p['title']}\n\n"
            spec+=f"**Status:** {p['status']}. **Owner:** {p['owner_role']}. **Risk:** {p['risk']}. **Relative weight:** {p['effort_weight']} (not a time estimate).\n\n"
            spec+=f"**Features:** {', '.join(p['features'])}. **Direct dependencies:** {', '.join(p['depends_on']) or 'None'}. **External gates:** {', '.join(p['external_gates']) or 'No additional provider gate beyond inherited requirements'}.\n\n"
            spec+=f"**Scope and outcome:** {p['scope']}\n\n**Data/API/contract:** {p['contract']}\n\n"
            spec+='**Acceptance:**\n\n'+''.join(f"- `{a['id']}`: {a['text']}.\n" for a in p['acceptance_criteria'])+'\n'
            spec+='**Tests to implement:**\n\n'+''.join(f"- `{t['id']}`: {t['scenario']}.\n" for t in p['test_cases'])+'\n'
            spec+=f"**Security and privacy:** {p['security_impact']}\n\n**Migration:** {p['migration']}\n\n**Rollout:** {p['rollout']}\n\n**Rollback:** {p['rollback']}\n\n**Verification:** {p['production_verification']}\n\n"
            spec+=f"**Evidence:** `{p['required_evidence'][0]}` plus tests/review"+(' and deployment/live-verification records.' if p['evidence_profile']=='application' else ' records.')+f" **Branch suggestion:** `{p['suggested_branch']}`.\n\n"
            cat+=spec
            (ROOT/'docs/prs'/f"{p['id']}.md").write_text(spec.replace('#### ','# ',1))
    (ROOT/'docs/pr-catalog.md').write_text(cat)
    print(f"Rendered {len(plan['prs'])} PR specifications. Run validation, rebuild reader, and review all diffs before committing.")
if __name__=='__main__':main()
