"""One-time exact lock and observed progress preparation; removed before PR."""
from pathlib import Path
import json, os, datetime
p=Path('.')
old=json.loads(Path(os.environ['RUNNER_TEMP'],'garden-original-lock.json').read_text())
lock=json.loads(Path('package-lock.json').read_text())
for name, prior in old['packages'].items():
 if not name.startswith('node_modules/') or prior.get('link'): continue
 assert name in lock['packages'], 'Existing dependency removed'
 for key in ('version','resolved','integrity'): assert lock['packages'][name].get(key)==prior.get(key), 'Existing dependency changed'
assert lock['packages']['node_modules/@better-auth/passkey']['version']=='1.7.7'
Path('package-lock.json').write_text(json.dumps(lock,indent=1)+'\n')
x=json.loads((p/'plan/execution.json').read_text())
x['work_items']['GDN-029'].update(implementation='merged_with_exact_ci',github_pr_number=26,github_head_sha='779cd85db8562e8764bad9caf7a9fdd8b791b2c1',github_merge_sha='b62396cf1715d51c2d396ef24d276a7a3306f017',ci_url='https://github.com/neophilism/The-Garden/actions/runs/38150802752',ci_workflows={'repository':38150802752,'identity':38150802798,'database':38150802768,'storage':38150802815,'historical_data':38150802787,'quality_browser':38150802822},independent_review='not_performed',note='All six exact-head workflows were reverified successful. No production or historical acceptance inferred.')
x['work_items']['GDN-022']={'implementation':'candidate','accepted':False,'production_verified':False,'independent_review':'not_performed','note':'Current session assurance, verified passkeys, enrollment/recovery controls and browser UI; exact-head CI pending.'}
x['observed_at_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();x['engine_room']['mapped_planned_units']=23
(p/'plan/execution.json').write_text(json.dumps(x,separators=(',',':'))+'\n')
m=json.loads((p/'.exechub/approved-pr-mapping.json').read_text());m['pullRequestNumbers'][28]=26;m['mappingRevision']=m.get('mappingRevision',1)+1
(p/'.exechub/approved-pr-mapping.json').write_text(json.dumps(m,indent=2)+'\n')
x=json.loads((p/'plan/progress.json').read_text());x.update(remote_prs_opened=23,verified_merged_items=23,note='23 engineering items have observed merges and exact-head CI. GDN-022 is a candidate, not accepted or deployed. The original 196-current/14-conditional scope is unchanged.')
(p/'plan/progress.json').write_text(json.dumps(x,indent=2)+'\n')
s=(p/'docs/CURRENT_STATUS.md').read_text();s='# Current continuation: GDN-022 candidate\n\nPR #26 / GDN-029 is merged at `b62396cf1715d51c2d396ef24d276a7a3306f017`; all six exact-head CI workflows were reverified. There are 23 observed engineering merges, not production acceptances.\n\nGDN-022 adds current server-side passkey assurance, secure session rotation, own/all-device revocation, protected enrollment and recovery, and unmounted account controls. 78 local identity tests pass; new real-browser/PostgreSQL CI is pending. Read `docs/security/sessions-and-step-up.md`. No hosted routes, cloud migrations, physical-device approval or independent certification are claimed.\n\nRender still requires explicit workspace confirmation before service access in this session. The supplied project and Neon branch remain the sole authorized targets; no substitute deployment or new costs.\n\n---\n\n'+s
(p/'docs/CURRENT_STATUS.md').write_text(s)
s=(p/'README.md').read_text();s+='\n## Session-security continuation\n\nGDN-029 is merged in PR #26. GDN-022 is the unmounted session/passkey candidate: [session and recovery contract](docs/security/sessions-and-step-up.md). The real verification gates and current mappings are in the execution registry, not inferred from this note.\n'
(p/'README.md').write_text(s)
