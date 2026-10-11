import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from reconcile_roadmap import validate

ROOT = Path(__file__).resolve().parents[2]
read = lambda name: json.loads((ROOT / name).read_text())

class RoadmapReconciliationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = (read("plan/plan.json"), read("plan/execution.json"), read("plan/progress.json"), read(".exechub/approved-pr-mapping.json"))

    def bad(self, index, mutator):
        docs = [copy.deepcopy(x) for x in self.data]
        mutator(docs[index])
        with self.assertRaises(ValueError):
            validate(*docs)

    def test_actual_mapped_counts(self):
        value = validate(*self.data)
        self.assertEqual(value["production_verified"], 0)
        self.assertEqual(value["plan_items"], 210)

    def test_boolean_pr_number_denied(self):
        docs = [copy.deepcopy(x) for x in self.data]
        docs[3]["pullRequestNumbers"][0] = True
        docs[1]["work_items"]["GDN-001"]["github_pr_number"] = True
        with self.assertRaises(ValueError):
            validate(*docs)

    def test_numeric_acceptance_denied(self):
        self.bad(1, lambda p: p["work_items"]["GDN-001"].update(accepted=1))

    def test_fake_merged_count_denied(self):
        self.bad(2, lambda p: p.update(verified_merged_items=209))

    def test_fake_production_denied(self):
        self.bad(2, lambda p: p.update(production_verified_items=1))

    def test_ordinal_confusion_denied(self):
        self.bad(3, lambda p: p["pullRequestNumbers"].__setitem__(0, 1))

    def test_conditional_activation_denied(self):
        self.bad(3, lambda p: p["pullRequestNumbers"].__setitem__(209, 300))

    def test_dependency_cycle_denied(self):
        self.bad(0, lambda p: p["prs"][0]["depends_on"].append("GDN-002"))

    def test_missing_feature_coverage_denied(self):
        self.bad(0, lambda p: p["features"][0].update(prs=[]))

    def test_unmapped_merge_denied(self):
        self.bad(3, lambda p: p["pullRequestNumbers"].__setitem__(0, None))

    def test_ci_missing_denied(self):
        self.bad(1, lambda p: p["work_items"]["GDN-001"].update(ci_url=None))

    def test_missing_planned_pr_denied(self):
        self.bad(0, lambda p: p["prs"].pop())

if __name__ == "__main__":
    unittest.main()
