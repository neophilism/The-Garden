#!/usr/bin/env python3
"""Inspect the actual static export, not merely source-text assertions."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import sys

ROUTES = ('', 'how-it-works', 'history', 'research', 'funding', 'legislation', 'questions', 'participate', 'about')
class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.duplicates = set()
        self.refs = []
        self.h1 = self.main = self.forms = 0
        self.lang = None
        self.robots = ''
        self.feed(text)
    def handle_starttag(self, tag, attributes):
        a = dict(attributes)
        if a.get('id'):
            if a['id'] in self.ids:
                self.duplicates.add(a['id'])
            self.ids.add(a['id'])
        if tag == 'h1': self.h1 += 1
        if tag == 'main': self.main += 1
        if tag == 'html': self.lang = a.get('lang')
        if tag == 'form': self.forms += 1
        if tag == 'meta' and a.get('name') == 'robots': self.robots = a.get('content', '')
        for key in ('href', 'src'):
            if a.get(key): self.refs.append(a[key])

def verify(root, routes=ROUTES):
    root = root.resolve()
    pages = {}
    for route in routes:
        path = root / route / 'index.html'
        if not path.is_file(): raise ValueError('Missing public route: ' + route)
        text = path.read_text(encoding='utf-8')
        if any(x in text for x in ('chatgpt.com/api/library', 'DATABASE_URL', 'GITHUB_APP_PRIVATE_KEY')):
            raise ValueError('Private location or secret configuration leaked into export')
        page = Page(text)
        if page.h1 != 1 or page.main != 1 or page.lang != 'en' or page.forms or 'noindex' not in page.robots:
            raise ValueError('Invalid landmark, language, indexing or no-intake contract: ' + route)
        if page.duplicates: raise ValueError('Duplicate element identifiers: ' + route)
        pages[path] = page
    for path, page in pages.items():
        for ref in page.refs:
            uri = urlsplit(ref)
            if uri.scheme or uri.netloc:
                if uri.scheme not in ('https', 'data'): raise ValueError('Unexpected URL scheme')
                continue
            target = (root / unquote(uri.path).lstrip('/') if uri.path.startswith('/') else path.parent / unquote(uri.path)).resolve()
            if not target.is_relative_to(root): raise ValueError('Export link escapes root')
            if target.is_dir(): target = target / 'index.html'
            if not target.exists(): raise ValueError('Broken internal reference from ' + str(path.relative_to(root)) + ': ' + ref)
            if uri.fragment and target in pages and unquote(uri.fragment) not in pages[target].ids:
                raise ValueError('Missing anchor: ' + ref)
    return {'routes_checked': len(pages), 'broken_internal_references': 0, 'public_intake_forms': 0, 'scope': 'local static export, not live deployment'}

if __name__ == '__main__':
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'apps/public/out'
    print(json.dumps(verify(root), indent=2))
