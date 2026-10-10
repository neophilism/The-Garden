#!/usr/bin/env python3
"""Validate the planning package, not the application. Standard library only."""
from __future__ import annotations
import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
ROOT = Path(__file__).resolve().parents[1]
STATUSES = {'planned','conditional','in_progress','pr_open','checks_passed','merged','deployed','production_verified','blocked','regressed','superseded'}

def closure(ids: list[str], items: dict[str, dict[str, Any]]) -> set[str]:
    seen: set[str] = set()
    def visit(key: str) -> None:
        if key in seen or key not in items: return
        seen.add(key)
        for dep in items[key].get('depends_on', []): visit(dep)
    for key in ids: visit(key)
    return seen

def validate_data(plan: dict[str, Any], mapping: dict[str, Any], root: Path | None = None) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    prs=plan.get('prs',[]); features=plan.get('features',[])
    ids=[p.get('id') for p in prs]; items={p['id']:p for p in prs if p.get('id')}
    if len(prs)!=210 or set(ids)!={f'GDN-{n:03}' for n in range(1,211)}: errors.append('Baseline PR inventory differs from 210 specified IDs.')
    if len(set(ids))!=len(ids): errors.append('Duplicate PR identifier.')
    fids={f.get('id') for f in features}
    if fids!={f'F{n:02}' for n in range(1,44)}: errors.append('Feature inventory differs from F01..F43.')
    mapped={f:[] for f in fids}; acids=[]; tids=[]
    required=('title','scope','contract','owner_role','risk','rollout','rollback','migration','security_impact','production_verification','required_evidence')
    for p in prs:
        pid=p.get('id','<missing>')
        for field in required:
            if not p.get(field): errors.append(f'{pid}: missing {field}.')
        if p.get('status') not in STATUSES: errors.append(f'{pid}: unknown status.')
        ds=p.get('depends_on',[])
        if len(ds)!=len(set(ds)): errors.append(f'{pid}: duplicate dependency.')
        for d in ds:
            if d not in items: errors.append(f'{pid}: missing dependency {d}.')
            if d==pid: errors.append(f'{pid}: self-dependency.')
            if p.get('applicability')=='current_scope' and d in items and items[d].get('applicability')=='conditional_government': errors.append(f'{pid}: depends on conditional government.')
        if not p.get('features'): errors.append(f'{pid}: no feature mapping.')
        for f in p.get('features',[]):
            if f not in fids: errors.append(f'{pid}: unknown feature {f}.')
            else: mapped[f].append(pid)
        if len(p.get('acceptance_criteria',[]))<3: errors.append(f'{pid}: fewer than three acceptance criteria.')
        if len(p.get('test_cases',[]))<3: errors.append(f'{pid}: fewer than three test scenarios.')
        for a in p.get('acceptance_criteria',[]):
            acids.append(a.get('id'))
            if not a.get('text'): errors.append(f'{pid}: empty criterion.')
        for t in p.get('test_cases',[]):
            tids.append(t.get('id'))
            if not t.get('scenario'): errors.append(f'{pid}: empty scenario.')
            if p.get('status') in {'planned','conditional'} and t.get('kind')!='specified_not_executed': errors.append(f'{pid}: planned test falsely marked executed.')
        if not isinstance(p.get('effort_weight'),int) or p['effort_weight']<=0: errors.append(f'{pid}: invalid weight.')
        for gate in p.get('external_gates',[]):
            if gate not in plan.get('external_gates',{}): errors.append(f'{pid}: unknown external gate.')
        if p.get('applicability')=='conditional_government' and 'X12' not in p.get('external_gates',[]): errors.append(f'{pid}: authority gate missing.')
        if p.get('status') in {'planned','conditional'}:
            if any(p.get(k) is not None for k in ('github_pr_number','github_url','commit_sha')): errors.append(f'{pid}: planned item has remote implementation evidence.')
            if p.get('ci_evidence') or p.get('production_evidence'): errors.append(f'{pid}: claimed executed evidence in planned item.')
        if p.get('status') in {'merged','deployed','production_verified'}:
            if not p.get('github_pr_number') or not p.get('commit_sha') or not p.get('ci_evidence'): errors.append(f'{pid}: completed state lacks PR/commit/CI evidence.')
        if p.get('status')=='production_verified':
            if not p.get('production_evidence'): errors.append(f'{pid}: production verification lacks evidence.')
            if root:
                for ref in p.get('required_evidence',[]):
                    if not (root/ref).is_file(): errors.append(f'{pid}: missing evidence artifact {ref}.')
        if root:
            path=root/'docs/prs'/f'{pid}.md'
            if not path.is_file(): errors.append(f'{pid}: missing PR file.')
            else:
                text=path.read_text(encoding='utf-8')
                if p.get('title','') not in text: errors.append(f'{pid}: title drift.')
                for a in p.get('acceptance_criteria',[]):
                    if a.get('id') not in text or a.get('text') not in text: errors.append(f'{pid}: acceptance drift.')
                for t in p.get('test_cases',[]):
                    if t.get('id') not in text or t.get('scenario') not in text: errors.append(f'{pid}: test drift.')
    if len(acids)!=len(set(acids)): errors.append('Duplicate acceptance ID.')
    if len(tids)!=len(set(tids)): errors.append('Duplicate test ID.')
    for f in features:
        if not mapped.get(f['id']): errors.append(f"{f['id']}: uncovered feature.")
        if sorted(f.get('prs',[]))!=sorted(mapped.get(f['id'],[])): errors.append(f"{f['id']}: crosswalk drift.")
    visiting=set();visited=set()
    def dfs(key: str) -> None:
        if key in visiting: errors.append(f'Dependency cycle at {key}.');return
        if key in visited or key not in items:return
        visiting.add(key)
        for dep in items[key].get('depends_on',[]):dfs(dep)
        visiting.remove(key);visited.add(key)
    for key in items:dfs(key)
    for r in plan.get('releases',[]):
        for key in r.get('acceptance_roots',[]):
            if key not in items:errors.append(f"{r['id']}: unknown acceptance root.")
        c=closure(r.get('acceptance_roots',[]),items)
        if c!=set(r.get('dependency_closure',[])):errors.append(f"{r['id']}: release closure drift.")
        if r.get('id')=='R1' and c&{'GDN-045','GDN-048','GDN-122','GDN-148','GDN-166','GDN-197'}:errors.append('R1 incorrectly blocked by later scope.')
        if r.get('id')=='R5' and c!={f'GDN-{n:03}' for n in range(1,197)}:errors.append('R5 does not cover all current scope.')
    tables=mapping.get('tables',[]);names=[t.get('source_table') for t in tables];count=sum(t.get('source_rows',0) for t in tables)
    if len(tables)!=106 or len(set(names))!=106:errors.append('Mapping needs 106 unique source tables.')
    if count!=923292 or mapping.get('row_count')!=count:errors.append('Source accounting differs from 923292 rows.')
    if any(t.get('normalization_status')!='specified_not_executed' for t in tables):errors.append('False executed normalization claim.')
    if root:
        obs=json.loads((root/'docs/migration/source-schema-inventory.json').read_text())
        oc={t['table']:t['rows'] for t in obs['tables']}
        if set(oc)!=set(names):errors.append('Source table names differ.')
        for t in tables:
            if oc.get(t['source_table'])!=t['source_rows']:errors.append(f"Count differs for {t['source_table']}.")
        if mapping.get('source_sha256')!=obs.get('sha256'):errors.append('Source digest differs.')
    current=[p for p in prs if p.get('applicability')=='current_scope'];conditional=[p for p in prs if p.get('applicability')=='conditional_government'];progress=plan.get('progress',{})
    if len(current)!=196 or len(conditional)!=14:errors.append('Current/conditional inventory differs.')
    vals={'current_scope_items':len(current),'conditional_items':len(conditional),'current_scope_weight':sum(p.get('effort_weight',0) for p in current),'conditional_weight':sum(p.get('effort_weight',0) for p in conditional),'verified_merged_items':sum(p.get('status') in {'merged','deployed','production_verified'} for p in current),'production_verified_items':sum(p.get('status')=='production_verified' for p in current)}
    for k,val in vals.items():
        if progress.get(k)!=val:errors.append(f'Progress mismatch: {k}.')
    summary={'work_items':len(prs),'current_scope':len(current),'conditional_scope':len(conditional),'features':len(features),'acceptance_criteria':len(acids),'specified_test_scenarios':len(tids),'dependency_edges':sum(len(p.get('depends_on',[])) for p in prs),'source_tables':len(tables),'source_rows':count,'production_verified_items':progress.get('production_verified_items'),'status_counts':dict(Counter(p.get('status') for p in prs))}
    return errors,summary

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=ROOT);parser.add_argument('--report',type=Path)
    a=parser.parse_args()
    try:
        p=json.loads((a.root/'plan/plan.json').read_text());m=json.loads((a.root/'docs/migration/table-disposition.json').read_text());errors,summary=validate_data(p,m,a.root)
    except (OSError,ValueError,KeyError,TypeError) as exc:
        print(f'VALIDATION ERROR: {exc}');return 2
    report={'check':'local_plan_structure_not_application_tests','recorded_at':datetime.now(timezone.utc).isoformat(),'result':'fail' if errors else 'pass','summary':summary,'errors':errors,'limits':['No application CI executed.','No GitHub PR or deployment verified.','Source byte/schema checks are not historical or rights verification.']}
    print(json.dumps(report,indent=2))
    if a.report:a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,indent=2)+'\n')
    return 1 if errors else 0
if __name__=='__main__':raise SystemExit(main())
