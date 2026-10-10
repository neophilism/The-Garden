from __future__ import annotations
import copy
import importlib.util
import json
import re
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('charter', ROOT/'scripts/validate_charter.py')
charter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(charter)
class CharterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = json.loads((ROOT/'plan/plan.json').read_text())
        cls.contract = json.loads((ROOT/'docs/product/feature-contract.json').read_text())
    def test_complete_snapshot(self):
        self.assertEqual(charter.validate(self.contract, self.plan), [])
    def test_missing_feature_fails(self):
        c = copy.deepcopy(self.contract); del c['features']['F01']
        self.assertTrue(charter.validate(c, self.plan))
    def test_unknown_role_fails(self):
        c = copy.deepcopy(self.contract); c['features']['F01']['owner_role'] = 'invented'
        self.assertTrue(charter.validate(c, self.plan))
    def test_government_cannot_enter_current_release(self):
        c = copy.deepcopy(self.contract); c['features']['F42']['full_feature_acceptance_release'] = 'R1'
        self.assertTrue(charter.validate(c, self.plan))
    def test_current_scope_cannot_be_hidden_in_government(self):
        c = copy.deepcopy(self.contract); c['features']['F01']['full_feature_acceptance_release'] = 'RG'
        self.assertTrue(charter.validate(c, self.plan))
    def test_every_invariant_is_enforced(self):
        for key, value in charter.REQUIRED.items():
            with self.subTest(key=key):
                c = copy.deepcopy(self.contract); c['invariants'][key] = not value
                self.assertTrue(charter.validate(c, self.plan))
    def test_boolean_strings_do_not_pass(self):
        c = copy.deepcopy(self.contract); c['invariants']['automatic_citizenship'] = 'false'
        self.assertTrue(charter.validate(c, self.plan))
    def test_document_entry_links(self):
        for relative in ['README.md', 'docs/product/charter.md', 'docs/CURRENT_STATUS.md']:
            source = ROOT/relative
            for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', source.read_text()):
                if '://' not in target and not target.startswith('#'):
                    resolved = (source.parent/target.split('#')[0]).resolve()
                    self.assertTrue(resolved.is_relative_to(ROOT), target)
                    self.assertTrue(resolved.exists(), target)
    def test_all_standing_rules_preserved(self):
        rules = (ROOT/'docs/standing-instructions.md').read_text()
        self.assertEqual([int(n) for n in re.findall(r'^(\d+)\. ', rules, re.M)], list(range(1, 19)))
    def test_exact_targets_without_spending_or_success_claim(self):
        targets = json.loads((ROOT/'plan/runtime-targets.json').read_text())
        self.assertEqual(targets['render']['project_id'], 'prj-db57f92jnfac739ghic0')
        self.assertEqual(targets['neon']['project_id'], 'royal-union-78374030')
        self.assertEqual(targets['neon']['branch_id'], 'br-curly-band-b5aatp1e')
        self.assertFalse(targets['spending']['incremental_spend_authorized'])
        self.assertEqual(targets['render']['provider_inspection'], 'not_performed')
    def test_bootstrap_has_no_false_work_item_mapping(self):
        execution = json.loads((ROOT/'plan/execution.json').read_text())
        bootstrap = next(o for o in execution['observations'] if o['kind'] == 'bootstrap_merge')
        self.assertEqual(bootstrap['mapped_work_items'], [])
        self.assertEqual(len(bootstrap['merge_commit']), 40)
if __name__ == '__main__': unittest.main()
