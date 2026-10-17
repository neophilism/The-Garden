import hashlib
import json
from datetime import datetime, timedelta, timezone


def uid(n):
    return f"81000000-0000-4000-8000-{n:012x}"


NOW = datetime(2026, 10, 17, 15, 0, 0, tzinfo=timezone.utc)


def instant(ms):
    return (NOW + timedelta(milliseconds=ms)).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def digest(profile, value):
    return hashlib.sha256((profile + "\n" + json.dumps(value, ensure_ascii=False, separators=(",", ":"))).encode("utf-8")).hexdigest()


scope = dict(workspaceId=uid(1), recordId=uid(2), recordRevision="7", classification="restricted_research")
place = dict(operationId=uid(3), holdId=uid(4), scope=scope, reason="legal-hold", evidenceId=uid(5),
             effectiveAt=instant(-5000), expiresAt=instant(120000), reviewBy=instant(90000))


def authority(subject, action, command):
    return dict(workspaceId=uid(1), subjectId=subject, action=action, operationId=command["operationId"],
                authorizationId=command["operationId"], authorityEvidenceId=uid(13), authorityRevision="2",
                validFrom=instant(-10000), expiresAt=instant(100000),
                commandFingerprint=digest("garden-retention-v1\n" + action,
                                          dict(workspaceId=uid(1), subjectId=subject, command=command)))


placed = dict(command=place, recordedAt=instant(0), authority=authority("placement-author-private", "lifecycle.hold-place", place))
hold = dict(schemaVersion=1, kind="hold-record", revision="1", placement=placed, release=None)
hold_fingerprint = digest("garden-retention-v1\nhold", hold)
descriptor = dict(purpose="hold-administration-v1", projectionVersion="1", scope=scope, holdId=uid(4), placementFingerprint=hold_fingerprint)
release = dict(operationId=uid(8), holdId=uid(4), expectedRevision="1", holdFingerprint=hold_fingerprint,
               evidenceId=uid(9), reviewBy=instant(85000))
intent = dict(action="lifecycle.hold-release", scope=scope, command=release, expectedControlRevision="6", expectedFingerprint=hold_fingerprint)
proof = authority("release-operator-private", "lifecycle.hold-release", release)
intent_fingerprint = digest("garden-lifecycle-control-intent-v1", dict(workspaceId=uid(1), subjectId="release-operator-private", intent=intent))
proposal_fingerprint = digest("garden-retention-v1\noperation", dict(command=release, authority=proof))
commit = dict(intentFingerprint=intent_fingerprint, grantId=uid(12), grantRevision="2", authority=proof, proposalFingerprint=proposal_fingerprint)
evidence = dict(operationId=uid(20), evidenceId=uid(21), revision="1", expectedFingerprint=None, scope=scope,
                action="lifecycle.hold-release", authorityKind="legal-review", authorityReference=uid(22), reviewerReference=uid(23),
                validFrom=instant(-60000), expiresAt=instant(600000), reviewBy=instant(300000), state="verified")
grant = dict(operationId=uid(30), grantId=uid(31), revision="1", expectedFingerprint=None, scope=scope, subjectId="release-operator-private",
             action="lifecycle.hold-release", evidenceId=uid(21), evidenceRevision="1", validFrom=instant(-60000),
             expiresAt=instant(600000), reviewBy=instant(300000), state="active")


def authority_digest(kind, command):
    return digest("garden-lifecycle-hold-metadata-authority-" + kind + "-v1",
                  dict(workspaceId=uid(1), maintainerId='reviewer"\\雪\u2028', descriptor=descriptor, command=command))


print(json.dumps(dict(hold=hold_fingerprint,
                      descriptor=digest("garden-lifecycle-hold-metadata-descriptor-v1", descriptor),
                      grant=authority_digest("grant", grant), evidence=authority_digest("evidence", evidence),
                      release=digest("garden-lifecycle-control-operation-v1", commit)), indent=2))
