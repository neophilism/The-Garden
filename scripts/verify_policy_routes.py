#!/usr/bin/env python3
"""Fail closed when a repository route lacks an explicit policy regression.

This is a coverage registration gate, not a JavaScript parser or security
certification. Runtime enforcement and actual request tests remain mandatory.
"""
from pathlib import Path
import json
import re
import sys
ROOT = Path(__file__).resolve().parents[1]
METHOD = re.compile(r"export\s+(?:async\s+)?(?:function\s+|const\s+)(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b")

def inspect(root=ROOT):
    registry = json.loads((root/'tests/security/policy-matrix/registry.json').read_text())
    entries = {r['file']: r for r in registry['routes']}
    if len(entries)!=len(registry['routes']):
        raise ValueError('Duplicate route registration')
    actual = {}
    for path in (root/'apps').rglob('*'):
        rel = path.relative_to(root)
        if any(p in {'node_modules','.next','out'} for p in rel.parts) or not path.is_file():
            continue
        is_app = path.name in {'route.ts','route.tsx','route.js','route.jsx','route.mjs'}
        is_pages = 'pages' in rel.parts and 'api' in rel.parts and path.suffix in {'.ts','.tsx','.js','.jsx','.mjs'}
        if is_app or is_pages:
            if is_pages:
                raise ValueError('Legacy API route requires an explicit reviewed scanner extension: '+str(rel))
            text=path.read_text()
            methods=sorted(set(METHOD.findall(text)))
            if not methods or re.search(r'export\s*\{',text):
                raise ValueError('Unsupported route export requires explicit review: '+str(rel))
            actual[rel.as_posix()]=methods
    if set(actual)!=set(entries):
        raise ValueError('Policy registration differs from actual routes: '+str(sorted(set(actual)^set(entries))))
    for name,methods in actual.items():
        row=entries[name]
        test=Path(row['test'])
        if test.is_absolute() or '..' in test.parts or not row.get('case') or sorted(row.get('methods',[]))!=methods:
            raise ValueError('Incomplete policy registration: '+name)
        testfile=root/test
        if not testfile.is_file() or ('test('+repr(row['case'])+',') not in testfile.read_text():
            raise ValueError('Named executable regression is absent: '+name)
        if row.get('access')!='public-readiness-no-data':
            raise ValueError('A new access class requires explicit scanner and regression review: '+name)
    return {'registered_routes':len(actual),'registered_methods':sum(map(len,actual.values())),'production_assertion':False}

if __name__=='__main__':
    try: print(json.dumps(inspect(),sort_keys=True))
    except (ValueError,KeyError,OSError) as exc: sys.exit(str(exc))
