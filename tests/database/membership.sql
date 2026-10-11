\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'ephemeral CI only'; END IF; END $$;
INSERT INTO garden_control.access_workspaces(id,name,policy_sha256,enabled) VALUES ('11111111-1111-4111-8111-111111111111','Synthetic workspace',repeat('a',64),true);
INSERT INTO garden_control.access_members(workspace_id,subject_id,state,policy_sha256) VALUES
 ('11111111-1111-4111-8111-111111111111','issuer','active',repeat('a',64)),
 ('11111111-1111-4111-8111-111111111111','independent-reviewer','active',repeat('a',64));
INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES
 ('11111111-1111-4111-8111-111111111111','issuer','administrator','issuer',statement_timestamp()+interval '30 days'),
 ('11111111-1111-4111-8111-111111111111','independent-reviewer','reviewer','issuer',statement_timestamp()+interval '30 days');
SET LOCAL ROLE garden_membership_admin;
SELECT garden_control.issue_membership_invite('11111111-1111-4111-8111-111111111111','issuer','contributor',decode(repeat('b',64),'hex'),decode(repeat('c',64),'hex'),statement_timestamp()+interval '1 day');
RESET ROLE;
SET LOCAL ROLE garden_research;
DO $$ BEGIN
 BEGIN PERFORM 1 FROM garden_control.access_members; RAISE EXCEPTION 'raw membership read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM garden_control.issue_membership_invite('11111111-1111-4111-8111-111111111111','issuer','reviewer',decode(repeat('b',64),'hex'),decode(repeat('d',64),'hex'),statement_timestamp()+interval '1 day'); RAISE EXCEPTION 'research role issued invitation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT garden_control.request_membership('11111111-1111-4111-8111-111111111111','community-historian',repeat('a',64),'Local family records, no institutional affiliation');
DO $$ DECLARE x jsonb; BEGIN
 x:=garden_control.membership_snapshot('11111111-1111-4111-8111-111111111111','community-historian');
 IF x->>'state'<>'requested' OR x->'expertise'->>'verified'<>'false' OR x->'roles'<>'[]'::jsonb THEN RAISE EXCEPTION 'request granted privilege or verified expertise'; END IF;
 BEGIN PERFORM garden_control.accept_membership_invite('community-historian',NULL,decode(repeat('c',64),'hex'),repeat('a',64)); RAISE EXCEPTION 'null email allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Membership request denied' THEN RAISE; END IF; END;
 BEGIN PERFORM garden_control.accept_membership_invite('community-historian',decode(repeat('d',64),'hex'),decode(repeat('c',64),'hex'),repeat('a',64)); RAISE EXCEPTION 'wrong email allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Membership request denied' THEN RAISE; END IF; END;
END $$;
SELECT garden_control.accept_membership_invite('community-historian',decode(repeat('b',64),'hex'),decode(repeat('c',64),'hex'),repeat('a',64));
DO $$ BEGIN
 IF garden_control.membership_active('11111111-1111-4111-8111-111111111111','community-historian') THEN RAISE EXCEPTION 'invite skipped onboarding'; END IF;
 BEGIN PERFORM garden_control.accept_membership_invite('community-historian',decode(repeat('b',64),'hex'),decode(repeat('c',64),'hex'),repeat('a',64)); RAISE EXCEPTION 'replay allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Membership request denied' THEN RAISE; END IF; END;
END $$;
SELECT garden_control.attest_training('11111111-1111-4111-8111-111111111111','community-historian',repeat('a',64),task) FROM unnest(ARRAY['source-integrity','consent-and-rights','research-conduct']) AS task;
DO $$ BEGIN
 IF NOT garden_control.membership_active('11111111-1111-4111-8111-111111111111','community-historian') THEN RAISE EXCEPTION 'trained contributor not active'; END IF;
 IF (SELECT count(*) FROM garden_private.access_probe)<>0 THEN RAISE EXCEPTION 'onboarding revealed private records'; END IF;
 BEGIN INSERT INTO garden_publication.public_probe VALUES('11111111-1111-4111-8111-111111111112','not allowed'); RAISE EXCEPTION 'onboarding allowed publication'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Published data does not change during onboarding.
DO $$ BEGIN IF (SELECT count(*) FROM garden_publication.public_probe)<>1 THEN RAISE EXCEPTION 'publication changed'; END IF; END $$;
INSERT INTO garden_control.review_targets VALUES('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',repeat('d',64),'community-historian');
SET LOCAL ROLE garden_research;
SELECT garden_control.assign_reviewer('11111111-1111-4111-8111-111111111111','issuer','independent-reviewer','22222222-2222-4222-8222-222222222222',repeat('d',64),'research');
DO $$ BEGIN
 BEGIN PERFORM garden_control.assign_reviewer('11111111-1111-4111-8111-111111111111','issuer','community-historian','22222222-2222-4222-8222-222222222222',repeat('d',64),'research'); RAISE EXCEPTION 'self review allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Reviewer assignment denied' THEN RAISE; END IF; END;
 BEGIN PERFORM garden_control.assign_reviewer('11111111-1111-4111-8111-111111111111','issuer','independent-reviewer','22222222-2222-4222-8222-222222222222',repeat('e',64),'research'); RAISE EXCEPTION 'stale revision allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Reviewer assignment denied' THEN RAISE; END IF; END;
 BEGIN PERFORM garden_control.assign_reviewer('11111111-1111-4111-8111-111111111111','issuer','independent-reviewer','22222222-2222-4222-8222-222222222222',repeat('d',64),'rights'); RAISE EXCEPTION 'wrong reviewer capability allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Reviewer assignment denied' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM garden_control.review_assignments WHERE state='assigned' AND assigned_by='issuer' AND author_subject_id='community-historian')<>1 THEN RAISE EXCEPTION 'accountable review missing'; END IF; END $$;
UPDATE garden_control.access_workspaces SET policy_sha256=repeat('e',64);
DO $$ BEGIN IF garden_control.membership_active('11111111-1111-4111-8111-111111111111','community-historian') THEN RAISE EXCEPTION 'old policy still active'; END IF; END $$;
SET LOCAL ROLE garden_research;
SELECT garden_control.attest_training('11111111-1111-4111-8111-111111111111','community-historian',repeat('e',64),task) FROM unnest(ARRAY['source-integrity','consent-and-rights','research-conduct']) AS task;
RESET ROLE;
UPDATE garden_control.access_members SET state='suspended' WHERE subject_id='community-historian';
SET LOCAL ROLE garden_research;
DO $$ BEGIN
 IF garden_control.membership_active('11111111-1111-4111-8111-111111111111','community-historian') THEN RAISE EXCEPTION 'suspension failed'; END IF;
 BEGIN PERFORM garden_control.attest_training('11111111-1111-4111-8111-111111111111','community-historian',repeat('e',64),'research-conduct'); RAISE EXCEPTION 'training bypassed suspension'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Membership request denied' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
-- Expired and revoked issuer capabilities cannot redeem outstanding invitations.
UPDATE garden_control.access_workspaces SET policy_sha256=repeat('a',64);
SELECT garden_control.issue_membership_invite('11111111-1111-4111-8111-111111111111','issuer','translator',decode(repeat('b',64),'hex'),decode(repeat('f',64),'hex'),statement_timestamp()+interval '1 day');
UPDATE garden_control.access_roles SET revoked_at=statement_timestamp(),version=version+1 WHERE subject_id='issuer';
SET LOCAL ROLE garden_research;
DO $$ BEGIN
 BEGIN PERFORM garden_control.accept_membership_invite('another-subject',decode(repeat('b',64),'hex'),decode(repeat('f',64),'hex'),repeat('a',64)); RAISE EXCEPTION 'revoked issuer allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Membership request denied' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE garden_control.access_roles SET revoked_at=NULL WHERE subject_id='issuer';
UPDATE garden_control.access_invites SET issued_at=statement_timestamp()-interval '2 days',expires_at=statement_timestamp()-interval '1 day' WHERE token_hash=decode(repeat('f',64),'hex');
SET LOCAL ROLE garden_research;
DO $$ BEGIN
 BEGIN PERFORM garden_control.accept_membership_invite('another-subject',decode(repeat('b',64),'hex'),decode(repeat('f',64),'hex'),repeat('a',64)); RAISE EXCEPTION 'expired invite allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Membership request denied' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'membership transitions, role isolation, expiry, replay, policy, review and publication boundaries passed' AS result;
