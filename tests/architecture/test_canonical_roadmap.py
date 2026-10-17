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
    def test_missing_source_graph_is_rejected_until_explicit_repair(self):
        original=copy.deepcopy(self.canonical)
        for unit in self.canonical["units"]:
            unit["dependsOn"]=[]
        with self.assertRaisesRegex(ValueError,"stale"):
            module.validate(self.canonical,self.plan,self.execution)
        repaired=module.reconcile(self.canonical,self.plan,self.execution)
        self.assertEqual(repaired,original)
        self.assertEqual(module.reconcile(repaired,self.plan,self.execution),repaired)
        self.assertEqual(sum(len(x["dependsOn"]) for x in repaired["units"]),960)
        self.assertEqual([x["id"] for x in repaired["units"] if not x["dependsOn"]],["GDN-001"])
    def test_exact_edge_mismatch_cannot_pass_with_the_same_edge_count(self):
        baseline=copy.deepcopy(self.canonical)
        current=baseline["units"][13]["dependsOn"]
        for invalid in [current[:-1],current+["GDN-001"],list(reversed(current)),["GDN-999"],
                        ["GDN-014"],current+[current[0]],"GDN-009",None]:
            with self.subTest(invalid=invalid):
                candidate=copy.deepcopy(baseline)
                candidate["units"][13]["dependsOn"]=invalid
                with self.assertRaisesRegex(ValueError,"stale"):
                    module.validate(candidate,self.plan,self.execution)
    def test_invalid_approved_graph_is_never_written_as_a_repair(self):
        for invalid in [["GDN-999"],["GDN-002"],["GDN-001","GDN-001"],"GDN-001",None]:
            with self.subTest(invalid=invalid):
                plan=copy.deepcopy(self.plan);plan["prs"][1]["depends_on"]=invalid
                with self.assertRaisesRegex(ValueError,"invalid approved dependencies"):
                    module.reconcile(self.canonical,plan,self.execution)
        plan=copy.deepcopy(self.plan);plan["prs"][0]["depends_on"]=["GDN-002"]
        with self.assertRaisesRegex(ValueError,"cyclic"):
            module.reconcile(self.canonical,plan,self.execution)
    def test_current_scope_cannot_acquire_a_conditional_activation_dependency(self):
        plan=copy.deepcopy(self.plan);plan["prs"][1]["depends_on"].append("GDN-197")
        with self.assertRaisesRegex(ValueError,"conditional government"):
            module.reconcile(self.canonical,plan,self.execution)
    def test_external_gate_provenance_does_not_create_automatic_blockers(self):
        result=module.validate(self.canonical,self.plan,self.execution)
        for unit,source in zip(result["units"],self.plan["prs"]):
            self.assertEqual(unit["sourceExternalGates"],source["external_gates"])
        self.assertEqual(sum(len(x["sourceExternalGates"]) for x in result["units"]),181)
        self.assertEqual(result["units"][134]["externalPrerequisites"],[])
        candidate=copy.deepcopy(self.canonical);candidate["units"][134]["sourceExternalGates"]=[]
        with self.assertRaisesRegex(ValueError,"stale"):
            module.validate(candidate,self.plan,self.execution)
        plan=copy.deepcopy(self.plan);plan["prs"][134]["external_gates"]=["X99"]
        with self.assertRaisesRegex(ValueError,"source external gates"):
            module.reconcile(self.canonical,plan,self.execution)
    def test_dependency_repair_preserves_observations_and_external_contracts(self):
        self.canonical["units"][13]["dependsOn"]=[]
        unit=self.canonical["units"][13]
        unit["externalDependencies"]=[{"repository":"example/provider","unitId":"PRV-001"}]
        unit["externalPrerequisites"]=["Synthetic unresolved provider prerequisite"]
        unit["review_note"]="Preserve unrelated evidence"
        original=copy.deepcopy((self.canonical,self.plan,self.execution))
        result=module.reconcile(self.canonical,self.plan,self.execution)
        self.assertEqual((self.canonical,self.plan,self.execution),original)
        self.assertEqual(result["observedAt"],self.canonical["observedAt"])
        self.assertEqual(result["pullRequests"],self.canonical["pullRequests"])
        self.assertEqual([x["prs"] for x in result["units"]],[x["prs"] for x in self.canonical["units"]])
        for field in ["externalDependencies","externalPrerequisites","review_note","applicability"]:
            self.assertEqual(result["units"][13][field],unit[field])
if __name__=="__main__":unittest.main()
