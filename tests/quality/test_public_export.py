import importlib.util
from pathlib import Path
import tempfile
import unittest
SPEC = importlib.util.spec_from_file_location('export', Path(__file__).resolve().parents[2] / 'scripts/verify_public_export.py')
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)
BASE = '<html lang="en"><head><meta name="robots" content="noindex,nofollow"></head><body><main id="main"><h1>Example</h1>{}</main></body></html>'
class ExportTests(unittest.TestCase):
    def check(self, html):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'index.html').write_text(html)
            return mod.verify(root, ('',))
    def test_good(self): self.assertEqual(self.check(BASE.format('<a href="#main">Skip</a>'))['routes_checked'], 1)
    def test_bad_anchor(self):
        with self.assertRaises(ValueError): self.check(BASE.format('<a href="#absent">Broken</a>'))
    def test_missing_asset(self):
        with self.assertRaises(ValueError): self.check(BASE.format('<script src="/absent.js"></script>'))
    def test_private_link(self):
        with self.assertRaises(ValueError): self.check(BASE.format('<a href="https://chatgpt.com/api/library/files/example">Private</a>'))
    def test_intake_form(self):
        with self.assertRaises(ValueError): self.check(BASE.format('<form><input></form>'))
    def test_duplicate_id(self):
        with self.assertRaises(ValueError): self.check(BASE.format('<div id="main"></div>'))
    def test_missing_noindex(self):
        with self.assertRaises(ValueError): self.check(BASE.format('').replace('noindex','index'))
    def test_traversal(self):
        with self.assertRaises(ValueError): self.check(BASE.format('<a href="/%2e%2e/private">Outside</a>'))
    def test_missing_heading(self):
        with self.assertRaises(ValueError): self.check(BASE.format('').replace('<h1>Example</h1>',''))
if __name__ == '__main__': unittest.main()
