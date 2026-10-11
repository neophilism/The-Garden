import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from validate_security_crosswalk import validate

class TestCanonicalSecurityMapping(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.clean = json.loads((Path(__file__).resolve().parents[2] / "docs/security/standard-crosswalk.json").read_text())

    def broken(self, mutate):
        copy = __import__("copy").deepcopy(self.clean)
        mutate(copy)
        with self.assertRaises(ValueError):
            validate(copy)

    def test_complete_pinned_baseline(self):
        self.assertTrue(validate(self.clean))

    def test_unpinned_branch_reference(self):
        self.broken(lambda d: d.update(canonical_revision="main"))

    def test_certification_claim_rejected(self):
        self.broken(lambda d: d.update(certification_claim=True))

    def test_missing_control_mapping_rejected(self):
        self.broken(lambda d: d["controls"][0].update(canonical_documents=[]))

    def test_unmapped_control_rejected(self):
        self.broken(lambda d: d["controls"].pop())

    def test_unsupported_assessment_flag_rejected(self):
        self.broken(lambda d: d["controls"][0].update(assessed=True))

    def test_requirement_proof_cannot_be_invented(self):
        self.broken(lambda d: d["controls"][0].update(canonical_requirement_id="REQ-unverified"))

    def test_floating_reference_rejected(self):
        self.broken(lambda d: d["controls"][0]["canonical_documents"][0].update(source_url="https://github.com/example/main"))

    def test_release_gate_cannot_flip(self):
        self.broken(lambda d: d["release_gates"].update(sealed_e2ee="permitted"))

    def test_no_explicit_gaps_rejected(self):
        self.broken(lambda d: d.update(gaps=[]))

if __name__ == "__main__":
    unittest.main()
