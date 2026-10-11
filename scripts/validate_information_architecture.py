#!/usr/bin/env python3
"""Validate the Garden orientation study and navigation model offline."""
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIMARY = ["garden", "how", "history", "research", "participate", "about"]

class Analyzer(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.hrefs = []
        self.tags = []
        self.lang = None
        self.nav_aria = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append(tag)
        if tag == "html":
            self.lang = attrs.get("lang")
        if "id" in attrs: self.ids.append(attrs["id"])
        if tag == "a" and "href" in attrs: self.hrefs.append(attrs["href"])
        if tag == "nav": self.nav_aria.append(attrs.get("aria-label"))

def validate(nav, source):
    if nav.get("status") != "designed_not_production_implemented":
        raise ValueError("prototype must not claim deployment")
    routes = nav.get("routes", [])
    ids = [r.get("id") for r in routes]
    if len(set(ids)) != len(ids) or not set(PRIMARY).issubset(ids):
        raise ValueError("six primary navigation destinations required")
    if nav.get("primary_navigation") != PRIMARY:
        raise ValueError("primary route hierarchy changed without review")
    if any(r.get("requires_login") is True for r in routes if r.get("kind") == "public"):
        raise ValueError("public reader must not require login")
    workspace = next((r for r in routes if r.get("id") == "workspace"), None)
    if not workspace or workspace.get("requires_login") is not True or workspace.get("kind") != "restricted":
        raise ValueError("private researcher workflow cannot be public")
    rules = nav.get("editorial_rules", [])
    if len(rules) < 6 or not any("zero-taxpayer" in r for r in rules):
        raise ValueError("fiscal caveat and publication safeguards missing")
    parser = Analyzer()
    parser.feed(source)
    if parser.lang != "en" or parser.tags.count("main") != 1 or not parser.nav_aria:
        raise ValueError("semantic page landmarks missing")
    if len(set(parser.ids)) != len(parser.ids):
        raise ValueError("duplicate element IDs")
    if not all(h[1:] in parser.ids for h in parser.hrefs if h.startswith("#")):
        raise ValueError("broken internal navigation link")
    if parser.hrefs.count("#main") != 1 or "prefers-reduced-motion" not in source or ":focus-visible" not in source:
        raise ValueError("skip link, focus or reduced-motion support missing")
    if any(tag in parser.tags for tag in ("form", "input", "iframe")):
        raise ValueError("research collection or embedded third-party code not allowed in prototype")
    for phrase in ["not enacted law", "funding", "historical", "review", "participation", "taxpayer"]:
        if phrase not in source.lower():
            raise ValueError("missing public-comprehension prerequisite: " + phrase)
    if "<img" in source.lower() or "data:image" in source.lower():
        raise ValueError("unverified historical images cannot appear in prototype")
    return True

def main():
    nav = json.loads((ROOT / "docs/design/navigation.json").read_text())
    source = (ROOT / "docs/design/prototype.html").read_text()
    validate(nav, source)
    print("Garden navigation, anchors, public access, funding caveat and accessible static prototype passed")

if __name__ == "__main__":
    main()
