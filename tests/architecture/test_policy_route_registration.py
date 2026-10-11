import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('policy_routes',ROOT/'scripts/verify_policy_routes.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class PolicyRegistrationTests(unittest.TestCase):
    def fixture(self, root):
        files={
            'apps/research/app/api/health/route.ts':'export async function GET() { return null; }',
            'tests/browser.mjs':"test('readiness stays empty',async()=>{});",
            'tests/security/policy-matrix/registry.json':json.dumps({'routes':[{'file':'apps/research/app/api/health/route.ts','methods':['GET'],'access':'public-readiness-no-data','test':'tests/browser.mjs','case':'readiness stays empty'}]})}
        for name,text in files.items():
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    def test_current_registry(self):
        self.assertEqual(m.inspect()['registered_routes'],1)
    def test_empty_test_cannot_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.fixture(root);(root/'tests/browser.mjs').write_text('')
            with self.assertRaises(ValueError):m.inspect(root)
    def test_new_method_cannot_bypass_registration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.fixture(root);(root/'apps/research/app/api/health/route.ts').write_text('export const GET=()=>null; export const POST=()=>null;')
            with self.assertRaises(ValueError):m.inspect(root)
    def test_new_route_cannot_bypass_registration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.fixture(root);p=root/'apps/research/app/api/private/route.ts';p.parent.mkdir();p.write_text('export const GET=()=>null;')
            with self.assertRaises(ValueError):m.inspect(root)
    def test_indirect_exports_require_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.fixture(root);(root/'apps/research/app/api/health/route.ts').write_text('export {handler as GET} from "../api";')
            with self.assertRaises(ValueError):m.inspect(root)
    def test_pages_api_requires_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.fixture(root);p=root/'apps/research/pages/api/secret.ts';p.parent.mkdir(parents=True);p.write_text('export default()=>null;')
            with self.assertRaises(ValueError):m.inspect(root)
