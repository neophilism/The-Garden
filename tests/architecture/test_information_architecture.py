import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from validate_information_architecture import validate

ROOT = Path(__file__).resolve().parents[2]

class PublicNavigationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nav = json.loads((ROOT / "docs/design/navigation.json").read_text())
        cls.html = (ROOT / "docs/design/prototype.html").read_text()

    def invalid(self, nav=None, html=None):
        with self.assertRaises(ValueError): validate(nav if nav is not None else self.nav, html if html is not None else self.html)

    def test_complete_accessible_prototype(self): self.assertTrue(validate(self.nav, self.html))
    def test_public_login_denial(self):
        doc = copy.deepcopy(self.nav)
        doc["routes"][0]["requires_login"] = True
        self.invalid(nav=doc)
    def test_workspace_access_denial(self):
        doc = copy.deepcopy(self.nav)
        doc["routes"][-1]["requires_login"] = False
        self.invalid(nav=doc)
    def test_missing_primary_route(self):
        doc = copy.deepcopy(self.nav)
        doc["routes"] = [r for r in doc["routes"] if r["id"] != "garden"]
        self.invalid(nav=doc)
    def test_unqualified_funding_removed(self):
        doc = copy.deepcopy(self.nav)
        doc["editorial_rules"] = [x for x in doc["editorial_rules"] if "zero-taxpayer" not in x]
        self.invalid(nav=doc)
    def test_dead_anchor(self): self.invalid(html=self.html.replace('href="#funding"', 'href="#absent"'))
    def test_collecting_family_data_is_not_prototype(self): self.invalid(html=self.html.replace("</main>", "<form></form></main>"))
    def test_no_inaccurate_public_image(self): self.invalid(html=self.html.replace("</main>", '<img src="archive.jpg"></main>'))
    def test_unique_ids(self): self.invalid(html=self.html.replace('id="home"', 'id="main"'))
    def test_reduced_motion(self): self.invalid(html=self.html.replace("prefers-reduced-motion", "no-motion-rule"))
    def test_skip_link(self): self.invalid(html=self.html.replace('href="#main"', 'href="#other"'))

if __name__ == "__main__": unittest.main()
