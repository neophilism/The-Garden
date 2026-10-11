#!/usr/bin/env python3
"""Fail closed on incomplete launch content and misleading image review records."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTES={"/", "/why", "/how-it-works", "/funding", "/legislation",
        "/history", "/research", "/questions", "/participate", "/about"}
ASSET_TYPES={"archival_primary", "generated_historical", "conceptual_art", "family_contribution"}
REVIEW={"historical", "fiscal", "legal", "rights", "community", "accessibility"}

def validate(doc):
    if doc.get("status") != "commissioning_specification_only" or doc.get("expert_review_complete") is not False:
        raise ValueError("commissioned content is not approved or independently reviewed")
    if doc.get("unqualified_zero_taxpayer_cost_claim_allowed") is not False:
        raise ValueError("fiscal claim must remain qualified")
    if doc.get("unreviewed_historical_material_publication_allowed") is not False:
        raise ValueError("uncleared historical content cannot be published")
    if doc.get("editorial_independence") is not True:
        raise ValueError("research must remain independent of policy advocacy")
    pages=doc.get("public_pages", [])
    if len(pages)!=len(ROUTES) or {p.get("route") for p in pages}!=ROUTES:
        raise ValueError("ten required launch deliverables must be present")
    for page in pages:
        if page.get("public_release")!="not_approved" or page.get("reviewers_assigned")!=[]:
            raise ValueError("reviewer must not be fabricated and uncleared copy must not publish")
        if not page.get("claims") or not page.get("sources") or not page.get("review_roles"):
            raise ValueError("source and reviewer roles required")
    assets=doc.get("asset_types", [])
    if len(assets)!=4 or {r.get("type") for r in assets}!=ASSET_TYPES:
        raise ValueError("each image type needs separate review")
    for row in assets:
        if row.get("allow_public_without_review") is not False or not row.get("required"):
            raise ValueError("asset must have rights, provenance and independent context checks")
    generated=next(r for r in assets if r["type"]=="generated_historical")
    if not {"generation_provenance","reconstruction_label","historical_accuracy_review","asset_rights"}.issubset(generated["required"]):
        raise ValueError("generated history must be labeled and checked")
    gates=doc.get("review_gates", [])
    if len(gates)!=6 or {x.get("id") for x in gates}!=REVIEW:
        raise ValueError("complete review tracks required")
    if any(g.get("status")!="not_assigned" or not g.get("min_evidence") for g in gates):
        raise ValueError("no expert review was independently assigned")
    if doc.get("launch_media_count_verified")!=0:
        raise ValueError("no verified media yet")
    if len(doc.get("mandatory_principles", []))<6:
        raise ValueError("required consent/review principles missing")
    return True

def main():
    doc=json.loads((ROOT/"docs/editorial/content-deliverables.json").read_text())
    validate(doc)
    print("10 page deliverables and 4 image types guarded; expert/rights approvals remain pending")

if __name__=="__main__": main()
