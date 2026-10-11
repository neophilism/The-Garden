import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from validate_data_classification import validate

class ClassificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = json.loads((Path(__file__).resolve().parents[2] / "docs/security/data-classification.json").read_text())

    def broken(self, callback):
        copy_data = copy.deepcopy(self.base)
        callback(copy_data)
        with self.assertRaises(ValueError):
            validate(copy_data)

    def test_full_contract(self):
        self.assertTrue(validate(self.base))

    def test_sealed_server_decrypt_rejected(self):
        self.broken(lambda d: d["classification"][4].update(decryptors=["authorized_server_component"]))

    def test_sealed_ai_rejected(self):
        self.broken(lambda d: d["classification"][4].update(ai="enabled"))

    def test_sensitive_contributor_in_public_index_rejected(self):
        self.broken(lambda d: d["classification"][3].update(search="public"))

    def test_private_anonymous_access_rejected(self):
        self.broken(lambda d: d["classification"][2]["readers"].append("anonymous"))

    def test_gov_permission_rejected(self):
        self.broken(lambda d: d["release"].update(governmental="enabled"))

    def test_missing_data_class_rejected(self):
        self.broken(lambda d: d["classification"].pop())

    def test_missing_flow_rejected(self):
        self.broken(lambda d: d["flows"].pop())

    def test_unowned_threat_rejected(self):
        self.broken(lambda d: d["threats"][0].update(owner=""))

    def test_false_independent_review_rejected(self):
        self.broken(lambda d: d["review"].update(security="complete"))

    def test_political_targeting_rule_cannot_disappear(self):
        self.broken(lambda d: d.update(hard_rules=["No server plaintext"]))

if __name__ == "__main__":
    unittest.main()
