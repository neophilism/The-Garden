"""Tests of planning validation, not application functionality."""
import copy, importlib.util, json, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('validator',ROOT/'scripts/validate_plan.py');v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
BASE=json.loads((ROOT/'plan/plan.json').read_text());MAP=json.loads((ROOT/'docs/migration/table-disposition.json').read_text())
class PlanTests(unittest.TestCase):
    def setUp(self):self.p=copy.deepcopy(BASE);self.m=copy.deepcopy(MAP)
    def errors(self):return v.validate_data(self.p,self.m)[0]
    def test_valid(self):self.assertEqual(self.errors(),[])
    def test_duplicate(self):
        self.p['prs'][1]['id']=self.p['prs'][0]['id'];self.assertTrue(self.errors())
    def test_missing_dependency(self):
        self.p['prs'][0]['depends_on']=['GDN-999'];self.assertTrue(any('missing dependency' in x for x in self.errors()))
    def test_cycle(self):
        self.p['prs'][0]['depends_on']=['GDN-002'];self.assertTrue(any('cycle' in x for x in self.errors()))
    def test_unknown_feature(self):
        self.p['prs'][0]['features']=['F99'];self.assertTrue(any('unknown feature' in x for x in self.errors()))
    def test_crosswalk(self):
        self.p['features'][0]['prs']=[];self.assertTrue(any('crosswalk' in x for x in self.errors()))
    def test_fake_pr(self):
        self.p['prs'][0]['github_pr_number']=12;self.assertTrue(any('planned item' in x for x in self.errors()))
    def test_fake_ci(self):
        self.p['prs'][0]['ci_evidence']=['invented'];self.assertTrue(any('claimed executed' in x for x in self.errors()))
    def test_fake_production(self):
        self.p['prs'][50]['status']='production_verified';self.assertTrue(any('lacks evidence' in x or 'lacks PR' in x for x in self.errors()))
    def test_missing_criteria(self):
        self.p['prs'][0]['acceptance_criteria']=[];self.assertTrue(any('acceptance criteria' in x for x in self.errors()))
    def test_unexecuted(self):
        self.p['prs'][0]['test_cases'][0]['kind']='passed';self.assertTrue(any('falsely marked executed' in x for x in self.errors()))
    def test_missing_table(self):
        self.m['tables'].pop();self.assertTrue(any('106 unique' in x for x in self.errors()))
    def test_wrong_count(self):
        self.m['tables'][0]['source_rows']+=1;self.assertTrue(any('923292' in x for x in self.errors()))
    def test_fake_migration(self):
        self.m['tables'][0]['normalization_status']='complete';self.assertTrue(any('executed normalization' in x for x in self.errors()))
    def test_government_gate(self):
        self.p['prs'][196]['external_gates']=[];self.assertTrue(any('authority gate missing' in x for x in self.errors()))
    def test_government_dependency(self):
        self.p['prs'][0]['depends_on']=['GDN-197'];self.assertTrue(any('depends on conditional' in x for x in self.errors()))
    def test_release_drift(self):
        self.p['releases'][1]['dependency_closure']=[];self.assertTrue(any('closure drift' in x for x in self.errors()))
    def test_fake_progress(self):
        self.p['progress']['production_verified_items']=42;self.assertTrue(any('Progress mismatch' in x for x in self.errors()))
    def test_public_first(self):
        r=next(x for x in self.p['releases'] if x['id']=='R1');self.assertFalse(set(r['dependency_closure'])&{'GDN-045','GDN-166','GDN-197'})
    def test_complete_scope(self):
        r=next(x for x in self.p['releases'] if x['id']=='R5');self.assertEqual(set(r['dependency_closure']),{f'GDN-{n:03}' for n in range(1,197)})
    def test_file_parity(self):self.assertEqual(v.validate_data(self.p,self.m,ROOT)[0],[])
if __name__=='__main__':unittest.main()
