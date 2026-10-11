import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from validate_integrations import validate

ROOT = Path(__file__).resolve().parents[2]

class IntegrationContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inventory = json.loads((ROOT / "docs/integrations/integration-inventory.json").read_text())
        cls.manifest = (ROOT / ".exechub/project.yml").read_text()
        cls.mapping = json.loads((ROOT / ".exechub/approved-pr-mapping.json").read_text())

    def assert_invalid(self, inventory=None, manifest=None, mapping=None):
        with self.assertRaises(ValueError):
            validate(inventory or self.inventory, manifest or self.manifest, mapping or self.mapping)

    def test_verified_identity_snapshot(self):
        self.assertTrue(validate(self.inventory, self.manifest, self.mapping))

    def test_unrelated_database_rejected(self):
        value = copy.deepcopy(self.inventory)
        value["database"]["project_id"] = "another-project"
        self.assert_invalid(inventory=value)

    def test_unrelated_render_project_rejected(self):
        value = copy.deepcopy(self.inventory)
        value["hosting"]["user_designated_project_id"] = "prj-wrong"
        self.assert_invalid(inventory=value)

    def test_fabricated_deployment_rejected(self):
        value = copy.deepcopy(self.inventory)
        value["hosting"]["deployment_verified"] = True
        self.assert_invalid(inventory=value)

    def test_engine_room_unverified_success_rejected(self):
        value = copy.deepcopy(self.inventory)
        value["engine_room"]["registration_observed"] = True
        self.assert_invalid(inventory=value)

    def test_premature_database_migration_rejected(self):
        value = copy.deepcopy(self.inventory)
        value["database"]["tables_observed"] = 4
        self.assert_invalid(inventory=value)

    def test_manifest_denominator_rejected(self):
        self.assert_invalid(manifest=self.manifest.replace("planned_prs: 210", "planned_prs: 196"))

    def test_conditional_scope_rejected(self):
        self.assert_invalid(manifest=self.manifest.replace("    prs: 14", "    prs: 15", 1))

    def test_duplicate_pr_number_rejected(self):
        value = copy.deepcopy(self.mapping)
        value["pullRequestNumbers"][1] = 2
        self.assert_invalid(mapping=value)

    def test_fabricated_ordinal_mapping_rejected(self):
        value = copy.deepcopy(self.mapping)
        value["pullRequestNumbers"][4] = 5
        self.assert_invalid(mapping=value)

if __name__ == "__main__":
    unittest.main()
