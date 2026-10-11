# GDN-003 — canonical E2EESA reconciliation

Source repository: https://github.com/neophilism/End-To-End-Everywhere-Security-Architecture-Standard
Pinned Git SHA: ddfbd40c47d13890ebb81ea91c81fe329417058e
Status at inspection: development toward 0.9.0-rc.2 addressing Audit v2. Not a frozen release or certification basis.

All twelve existing Garden proposed security domains now link to their subject-area normative documents at that exact revision. The document references are **not** verified mappings to every BCP 14 requirement, a selection of profile-ID@version configurations, tested integration, independent assessment, or a claim of conformance.

Garden's rights, consent, archival parser and historical-publication constraints require additional application-specific controls beyond messaging-oriented protocol requirements. Authentication, sealed key custody, public projections and data lifecycle must each be separately assessed on the actual deployed service.

Active blockers: secure source/contributor production, sealed E2EE, and governmental workflows remain disabled until the required independent reviews, exact profile-resolution evidence, and legal authority exist. A nonsensitive, public-only prototype may proceed through ordinary engineering gates.

Validate the machine-readable record locally with:

    python3 scripts/validate_security_crosswalk.py
    python3 -m unittest discover -s tests/architecture -v

Re-pin and review on upstream updates; the SHA must never be replaced with a floating main/latest reference.
