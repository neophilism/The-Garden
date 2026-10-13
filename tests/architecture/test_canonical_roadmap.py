import copy
import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("sync_roadmap",ROOT/"scripts/sync_roadmap.py")
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class CanonicalRoadmapTests(unittest.TestCase):
    def setUp(self):
        self.plan=json.loads((ROOT/"plan/plan.json").read_text())
        self.execution=json.loads((ROOT/"plan/execution.json").read_text())
        self.canonical=json.loads((ROOT/"registry/prs.json").read_text())
    def test_real_mapping_is_synchronized(self):
        self.assertEqual(module.reconcile(self.canonical,self.plan,self.execution),self.canonical)
    def test_preserves_unrelated_fields(self):
        self.canonical["owner_note"]="preserve me"
        result=module.reconcile(self.canonical,self.plan,self.execution)
        self.assertEqual(result["owner_note"],"preserve me")
        self.assertEqual([x["title"] for x in result["units"]],[x["title"] for x in self.canonical["units"]])
        self.assertNotIn("completed",result["units"][0])
    def test_missing_mapping_is_filled_only_from_observation(self):
        self.canonical["units"][0].pop("prs",None)
        self.assertEqual(module.reconcile(self.canonical,self.plan,self.execution)["units"][0]["prs"],[2])
    def test_conflict_denied(self):
        self.canonical["units"][0]["prs"]=[999]
        with self.assertRaises(ValueError):module.reconcile(self.canonical,self.plan,self.execution)
    def test_missing_evidence_denied(self):
        self.canonical["units"][40]["prs"]=[999]
        with self.assertRaises(ValueError):module.reconcile(self.canonical,self.plan,self.execution)
    def test_wrong_repository_denied(self):
        self.canonical["repository"]="other/repo"
        with self.assertRaises(ValueError):module.reconcile(self.canonical,self.plan,self.execution)
    def test_conditional_activation_denied(self):
        self.canonical["units"][196]["prs"]=[999]
        with self.assertRaises(ValueError):module.reconcile(self.canonical,self.plan,self.execution)
    def test_changed_total_denied(self):
        self.canonical["plannedPrCount"]+=1
        with self.assertRaises(ValueError):module.reconcile(self.canonical,self.plan,self.execution)
    def test_changed_id_denied(self):
        self.canonical["units"][1]["id"]="NOT-GDN"
        with self.assertRaises(ValueError):module.reconcile(self.canonical,self.plan,self.execution)
    def test_boolean_number_denied(self):
        self.execution["work_items"]["GDN-001"]["github_pr_number"]=True
        with self.assertRaises(ValueError):module.reconcile(self.canonical,self.plan,self.execution)
    def test_never_mutates_input(self):
        original=copy.deepcopy(self.canonical)
        module.reconcile(self.canonical,self.plan,self.execution)
        self.assertEqual(original,self.canonical)
if __name__=="__main__":unittest.main()
