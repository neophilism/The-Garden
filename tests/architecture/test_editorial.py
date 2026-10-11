import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2]/"scripts"))
from validate_editorial import validate

class EditorialPlanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc=json.loads((Path(__file__).resolve().parents[2]/"docs/editorial/content-deliverables.json").read_text())

    def reject(self, change):
        doc=copy.deepcopy(self.doc)
        change(doc)
        with self.assertRaises(ValueError):validate(doc)

    def test_author_copy(self):self.assertTrue(validate(self.doc))
    def test_fake_expert_approval(self):self.reject(lambda d:d.update(expert_review_complete=True))
    def test_missing_page(self):self.reject(lambda d:d["public_pages"].pop())
    def test_missing_citation(self):self.reject(lambda d:d["public_pages"][0].update(sources=[]))
    def test_fake_page_release(self):self.reject(lambda d:d["public_pages"][0].update(public_release="approved"))
    def test_unqualified_zero_cost(self):self.reject(lambda d:d.update(unqualified_zero_taxpayer_cost_claim_allowed=True))
    def test_generated_image_undisclosed(self):self.reject(lambda d:d["asset_types"][1].update(required=["image"]))
    def test_image_rights_bypass(self):self.reject(lambda d:d["asset_types"][0].update(allow_public_without_review=True))
    def test_unassigned_reviewer_as_assigned(self):self.reject(lambda d:d["review_gates"][0].update(status="complete"))
    def test_research_edited_for_advocacy(self):self.reject(lambda d:d.update(editorial_independence=False))
    def test_family_submission_silent_publication(self):self.reject(lambda d:d["asset_types"][3].update(allow_public_without_review=True))

if __name__=="__main__":unittest.main()
