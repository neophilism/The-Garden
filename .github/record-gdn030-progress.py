"""One-time source-bound progress reconciliation. Removed before opening PR."""
from pathlib import Path
import datetime,json,hashlib
p=Path('.')
evidence=json.loads((p/'docs/evidence/GDN-022/final-merge.json').read_text())
assert evidence['github_pr_number']==27 and evidence['github_merge_sha']=='fa0a14c1917fcdbaeb648acfec72d65f90ccb55f'
x=json.loads((p/'plan/execution.json').read_text())
assert x['repository']=='neophilism/The-Garden'
x['work_items']['GDN-022'].update(evidence,implementation='merged_with_exact_ci',note='All six final-head workflows passed before the observed merge. No independent or production acceptance inferred.')
x['work_items']['GDN-030']={'implementation':'candidate_unmounted_audit','accepted':False,'production_verified':False,'independent_review':'not_performed','note':'Append-only SQL ledger, bounded export/checkpoint verification and current auditor admission; real database CI pending.'}
x['engine_room']['mapped_planned_units']=24
x['observed_at_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(p/'plan/execution.json').write_text(json.dumps(x,separators=(',',':'))+'\n')
m=json.loads((p/'.exechub/approved-pr-mapping.json').read_text())
assert m['pullRequestNumbers'][21] in (None,27)
m['pullRequestNumbers'][21]=27;m['mappingRevision']=m.get('mappingRevision',1)+1
(p/'.exechub/approved-pr-mapping.json').write_text(json.dumps(m,indent=2)+'\n')
x=json.loads((p/'plan/progress.json').read_text())
x.update(remote_prs_opened=24,verified_merged_items=24,note='24 engineering items have observed merges and exact-head CI. GDN-030 is a candidate, not accepted or deployed. Original scope remains 196 current and 14 conditional.')
(p/'plan/progress.json').write_text(json.dumps(x,indent=2)+'\n')
text=(p/'README.md').read_text()
text+='\n## Audit-ledger continuation\n\nGDN-022 is merged in PR #27 with all six workflows passing, 88 identity unit tests and 27 real-browser/PostgreSQL checks. GDN-030 is the unmounted audit candidate: [audit contract](docs/security/audit-ledger.md). Exact mappings and independent/deployment gates remain in the execution registry. No live audit service or external checkpoint operator is claimed.\n'
(p/'README.md').write_text(text)
text=(p/'docs/CURRENT_STATUS.md').read_text()
text='# Audit continuation - 11 October 2026\n\nGDN-022 is merged at `fa0a14c1917fcdbaeb648acfec72d65f90ccb55f` in PR #27. All six workflows passed for final head `1cf895006931c8f2930cfd07c8f36e3449ad0227`. There are 24 engineering merges, not 24 accepted or deployed features.\n\nGDN-030 adds the workspace audit ledger and an independently supplied checkpoint verifier. Local core tests: 568 passed, including 102 audit-specific tests. Real PostgreSQL and exact-head CI remain pending for this candidate. Read `docs/security/audit-ledger.md`; no cloud schema, live export endpoint or external anchoring service is enabled.\n\nAfter GDN-030 passes and merges, continue GDN-031 authorization matrix tests and GDN-039 independent review/rights/publication state. Render workspace confirmation remains pending. No new spending or substitute target.\n\nEarlier checkpoint observations follow; inspect current execution and GitHub before treating them as live state.\n\n---\n\n'+text
(p/'docs/CURRENT_STATUS.md').write_text(text)
# Reconcile the explicitly inspected SQL bytes: only a blank line and an explicit
# VOLATILE annotation differ from the initial local draft (SQL default is volatile).
sha=hashlib.sha256((p/'db/migrations/0010_audit_ledger.sql').read_bytes()).hexdigest()
assert sha=='658e8adc7764e90b7cc51e3ee6fb49925913c31d5d114aae70f13561862dbe75'
j=json.loads((p/'db/migrations/manifest.json').read_text());assert j['migrations'][-1]['id']=='0010_audit_ledger';j['migrations'][-1]['sha256']=sha
(p/'db/migrations/manifest.json').write_text(json.dumps(j,indent=2)+'\n')
f=p/'tests/access/membership.test.mjs';text=f.read_text();assert 'Object.keys(ROLE_CAPABILITIES).length,10' in text
text=text.replace('all ten distinct roles','all eleven distinct roles').replace('Object.keys(ROLE_CAPABILITIES).length,10','Object.keys(ROLE_CAPABILITIES).length,11')
text+="\ntest('auditor is a separate read capability, not an administrator or publisher',()=>{assert.equal(can(member(['auditor']),'audit.inspect'),true);assert.equal(can(member(['administrator']),'audit.inspect'),false);assert.equal(can(member(['auditor']),'membership.manage'),false);});\n"
f.write_text(text)
