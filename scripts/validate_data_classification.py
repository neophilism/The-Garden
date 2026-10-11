#!/usr/bin/env python3
"""Static data-classification guardrail, not a proof of deployed authorization."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {"public_policy", "public_verified_research", "restricted_research", "sensitive_contributor", "sealed_ciphertext", "operational_security", "future_governmental"}

def validate(data):
    if data.get("status") != "architected_not_independently_assessed":
        raise ValueError("classification cannot claim assessment")
    rows = data.get("classification")
    if not isinstance(rows, list) or len(rows) != 7 or {r.get("id") for r in rows} != EXPECTED:
        raise ValueError("all seven unique classes are required")
    classes = {r["id"]: r for r in rows}
    for row in rows:
        if any(not row.get(k) for k in ("readers", "decryptors", "stores", "search", "ai", "retention", "publication_gate")):
            raise ValueError("class missing reader, decryption, storage, search, AI, retention or gate")
    for name in ("restricted_research", "sensitive_contributor", "sealed_ciphertext", "operational_security", "future_governmental"):
        if "anonymous" in classes[name]["readers"] or classes[name]["search"] == "public":
            raise ValueError("restricted class exposed publicly")
    sealed = classes["sealed_ciphertext"]
    if sealed["decryptors"] != ["authorized_client_device_only"] or sealed["ai"] != "prohibited" or sealed["search"] != "no_server_plaintext_search":
        raise ValueError("sealed class must remain server-opaque")
    if classes["sensitive_contributor"]["ai"] != "prohibited":
        raise ValueError("contributor data cannot reach AI")
    gov = classes["future_governmental"]
    if not gov["search"].startswith("disabled") or gov["publication_gate"] != "blocked_pending_legal_authority":
        raise ValueError("governmental access must remain off")
    flows = data.get("flows")
    if not isinstance(flows, list) or {x.get("data_class") for x in flows} != EXPECTED:
        raise ValueError("each class requires an explicit data flow")
    for flow in flows:
        if any(not flow.get(x) for x in ("source", "sink", "processor", "purpose", "test", "owner", "gate")):
            raise ValueError("data flow missing owner or security boundary")
    threats = data.get("threats")
    if not isinstance(threats, list) or len(threats) < 12 or len({r.get("id") for r in threats}) != len(threats):
        raise ValueError("missing threats or duplicates")
    if any(t.get("severity") not in {"critical","high","medium","low"} or not t.get("owner") or not t.get("test") for t in threats):
        raise ValueError("unowned or untested threat")
    rules = "\n".join(data.get("hard_rules", []))
    if "individualized political targeting" not in rules or "No server plaintext" not in rules or "governmental" not in rules:
        raise ValueError("mandatory threat invariants absent")
    if data.get("release", {}).get("governmental") != "disabled_until_enactment" or data["release"].get("sealed") != "blocked_pending_review":
        raise ValueError("governmental or sealed release gate prematurely enabled")
    if any(v != "not_performed" for v in data.get("review", {}).values()):
        raise ValueError("unverified expert review claimed")
    return True

def main():
    validate(json.loads((ROOT / "docs/security/data-classification.json").read_text()))
    print("seven data classes, seven flows, 13 threats defined; all sensitive review gates remain closed")

if __name__ == "__main__":
    main()
