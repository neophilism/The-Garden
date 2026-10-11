-- All subject arguments come from the server's cache-free verified identity, never HTTP JSON.
-- Administrative issuance has a separate capability role with no public HTTP route.
DO $role$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='garden_membership_admin') THEN
  CREATE ROLE garden_membership_admin NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='garden_membership_admin' AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
  RAISE EXCEPTION 'Unexpected membership administration role';
 END IF;
 EXECUTE format('GRANT garden_membership_admin TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $role$;
SET LOCAL ROLE garden_migrator;
CREATE TABLE garden_control.access_workspaces (
 id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 policy_sha256 text NOT NULL CHECK(policy_sha256 ~ '^[0-9a-f]{64}$'), enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE garden_control.access_members (
 workspace_id uuid REFERENCES garden_control.access_workspaces(id), subject_id text CHECK(length(subject_id) BETWEEN 1 AND 128),
 state text NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','onboarding','active','suspended','revoked')),
 policy_sha256 text NOT NULL CHECK(policy_sha256 ~ '^[0-9a-f]{64}$'), version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 expertise text CHECK(length(expertise) BETWEEN 1 AND 400), expertise_status text NOT NULL DEFAULT 'self_reported' CHECK(expertise_status='self_reported'),
 PRIMARY KEY(workspace_id,subject_id)
);
CREATE TABLE garden_control.access_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, subject_id text NOT NULL,
 role text NOT NULL CHECK(role IN ('contributor','transcriber','translator','researcher','reviewer','editor','rights_reviewer','community_adviser','moderator','administrator')),
 issued_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 expires_at timestamptz NOT NULL, revoked_at timestamptz, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK(expires_at>granted_at AND expires_at<=granted_at+interval '90 days'),
 FOREIGN KEY(workspace_id,subject_id) REFERENCES garden_control.access_members(workspace_id,subject_id),
 FOREIGN KEY(workspace_id,issued_by) REFERENCES garden_control.access_members(workspace_id,subject_id)
);
CREATE INDEX access_roles_subject ON garden_control.access_roles(workspace_id,subject_id);
CREATE TABLE garden_control.access_training (
 workspace_id uuid NOT NULL, subject_id text NOT NULL, policy_sha256 text NOT NULL,
 task text CHECK(task IN ('source-integrity','consent-and-rights','research-conduct')),
 attested_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 PRIMARY KEY(workspace_id,subject_id,policy_sha256,task),
 FOREIGN KEY(workspace_id,subject_id) REFERENCES garden_control.access_members(workspace_id,subject_id)
);
CREATE TABLE garden_control.access_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES garden_control.access_workspaces(id),
 token_hash bytea NOT NULL UNIQUE CHECK(octet_length(token_hash)=32), email_hash bytea NOT NULL CHECK(octet_length(email_hash)=32),
 role text NOT NULL CHECK(role IN ('contributor','transcriber','translator','researcher','reviewer','editor','rights_reviewer','community_adviser','moderator')),
 issuer_grant_id uuid NOT NULL REFERENCES garden_control.access_roles(id),
 issued_at timestamptz NOT NULL DEFAULT statement_timestamp(), expires_at timestamptz NOT NULL,
 consumed_at timestamptz, consumed_by text, revoked_at timestamptz,
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '7 days')
);
REVOKE ALL ON garden_control.access_workspaces,garden_control.access_members,garden_control.access_roles,garden_control.access_training,garden_control.access_invites FROM PUBLIC,garden_research,garden_public,garden_publisher,garden_membership_admin;
GRANT USAGE ON SCHEMA garden_control TO garden_research,garden_membership_admin;
CREATE FUNCTION garden_control.membership_active(p_workspace uuid,p_subject text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM garden_control.access_members m JOIN garden_control.access_workspaces w ON w.id=m.workspace_id
 WHERE m.workspace_id=p_workspace AND m.subject_id=p_subject AND w.enabled AND m.state='active' AND m.policy_sha256=w.policy_sha256
 AND EXISTS(SELECT 1 FROM garden_control.access_roles r WHERE r.workspace_id=m.workspace_id AND r.subject_id=m.subject_id AND r.revoked_at IS NULL AND r.expires_at>statement_timestamp()))
$$;
CREATE FUNCTION garden_control.membership_snapshot(p_workspace uuid,p_subject text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT jsonb_build_object('state',CASE WHEN NOT w.enabled OR m.policy_sha256<>w.policy_sha256 THEN 'policy_refresh_required' ELSE m.state END,'version',m.version,
 'roles',COALESCE((SELECT jsonb_agg(jsonb_build_object('role',r.role,'expiresAt',r.expires_at,'revoked',r.revoked_at IS NOT NULL,'version',r.version) ORDER BY r.role,r.id) FROM garden_control.access_roles r WHERE r.workspace_id=m.workspace_id AND r.subject_id=m.subject_id),'[]'::jsonb),
 'training',COALESCE((SELECT jsonb_agg(t.task ORDER BY t.task) FROM garden_control.access_training t WHERE t.workspace_id=m.workspace_id AND t.subject_id=m.subject_id AND t.policy_sha256=w.policy_sha256),'[]'::jsonb),
 'expertise',CASE WHEN m.expertise IS NULL THEN NULL ELSE jsonb_build_object('statement',m.expertise,'status','self_reported','verified',false) END)
 FROM garden_control.access_members m JOIN garden_control.access_workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=p_workspace AND m.subject_id=p_subject
$$;
CREATE FUNCTION garden_control.request_membership(p_workspace uuid,p_subject text,p_policy text,p_expertise text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM garden_control.access_workspaces WHERE id=p_workspace AND enabled AND policy_sha256=p_policy) THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 INSERT INTO garden_control.access_members(workspace_id,subject_id,policy_sha256,expertise) VALUES(p_workspace,p_subject,p_policy,p_expertise) ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION garden_control.attest_training(p_workspace uuid,p_subject text,p_policy text,p_task text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE m garden_control.access_members%ROWTYPE;
BEGIN
 SELECT * INTO m FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id=p_subject FOR UPDATE;
 IF NOT FOUND OR m.state NOT IN ('requested','onboarding','active') OR NOT EXISTS(SELECT 1 FROM garden_control.access_workspaces WHERE id=p_workspace AND enabled AND policy_sha256=p_policy) THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 INSERT INTO garden_control.access_training(workspace_id,subject_id,policy_sha256,task) VALUES(p_workspace,p_subject,p_policy,p_task) ON CONFLICT DO NOTHING;
 IF m.state IN ('onboarding','active') AND (SELECT count(*) FROM garden_control.access_training WHERE workspace_id=p_workspace AND subject_id=p_subject AND policy_sha256=p_policy)=3 THEN
  UPDATE garden_control.access_members SET state='active',policy_sha256=p_policy,version=version+1 WHERE workspace_id=p_workspace AND subject_id=p_subject;
 END IF;
END $$;
CREATE FUNCTION garden_control.issue_membership_invite(p_workspace uuid,p_actor text,p_role text,p_email_hash bytea,p_token_hash bytea,p_expires timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE grant_id uuid; result uuid;
BEGIN
 IF NOT garden_control.membership_active(p_workspace,p_actor) THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 SELECT id INTO grant_id FROM garden_control.access_roles WHERE workspace_id=p_workspace AND subject_id=p_actor AND role='administrator' AND revoked_at IS NULL AND expires_at>statement_timestamp() ORDER BY expires_at DESC LIMIT 1;
 IF grant_id IS NULL THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 INSERT INTO garden_control.access_invites(workspace_id,role,email_hash,token_hash,expires_at,issuer_grant_id) VALUES(p_workspace,p_role,p_email_hash,p_token_hash,p_expires,grant_id) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION garden_control.accept_membership_invite(p_subject text,p_email_hash bytea,p_token_hash bytea,p_policy text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE invitation garden_control.access_invites%ROWTYPE; issuer garden_control.access_roles%ROWTYPE; m garden_control.access_members%ROWTYPE; next_state text;
BEGIN
 IF p_email_hash IS NULL OR octet_length(p_email_hash)<>32 OR p_token_hash IS NULL OR octet_length(p_token_hash)<>32 OR p_subject IS NULL OR length(p_subject) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 SELECT * INTO invitation FROM garden_control.access_invites WHERE token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND OR invitation.email_hash<>p_email_hash OR invitation.consumed_at IS NOT NULL OR invitation.revoked_at IS NOT NULL OR invitation.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 SELECT * INTO issuer FROM garden_control.access_roles WHERE id=invitation.issuer_grant_id FOR SHARE;
 PERFORM 1 FROM garden_control.access_members WHERE workspace_id=invitation.workspace_id AND subject_id=issuer.subject_id FOR SHARE;
 IF NOT FOUND OR issuer.role<>'administrator' OR issuer.revoked_at IS NOT NULL OR issuer.expires_at<=statement_timestamp() OR NOT garden_control.membership_active(invitation.workspace_id,issuer.subject_id) THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 PERFORM 1 FROM garden_control.access_workspaces WHERE id=invitation.workspace_id AND enabled AND policy_sha256=p_policy FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 PERFORM garden_control.request_membership(invitation.workspace_id,p_subject,p_policy,NULL);
 SELECT * INTO m FROM garden_control.access_members WHERE workspace_id=invitation.workspace_id AND subject_id=p_subject FOR UPDATE;
 IF m.state NOT IN ('requested','onboarding','active') THEN RAISE EXCEPTION 'Membership request denied'; END IF;
 next_state := CASE WHEN (SELECT count(*) FROM garden_control.access_training WHERE workspace_id=invitation.workspace_id AND subject_id=p_subject AND policy_sha256=p_policy)=3 THEN 'active' ELSE 'onboarding' END;
 INSERT INTO garden_control.access_roles(workspace_id,subject_id,role,issued_by,expires_at) VALUES(invitation.workspace_id,p_subject,invitation.role,issuer.subject_id,LEAST(statement_timestamp()+interval '90 days',issuer.expires_at));
 UPDATE garden_control.access_members SET state=next_state,policy_sha256=p_policy,version=version+1 WHERE workspace_id=invitation.workspace_id AND subject_id=p_subject;
 UPDATE garden_control.access_invites SET consumed_at=statement_timestamp(),consumed_by=p_subject WHERE id=invitation.id;
 RETURN invitation.workspace_id;
END $$;
REVOKE ALL ON FUNCTION garden_control.membership_active(uuid,text),garden_control.membership_snapshot(uuid,text),garden_control.request_membership(uuid,text,text,text),garden_control.attest_training(uuid,text,text,text),garden_control.issue_membership_invite(uuid,text,text,bytea,bytea,timestamptz),garden_control.accept_membership_invite(text,bytea,bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.membership_active(uuid,text),garden_control.membership_snapshot(uuid,text),garden_control.request_membership(uuid,text,text,text),garden_control.attest_training(uuid,text,text,text),garden_control.accept_membership_invite(text,bytea,bytea,text) TO garden_research;
GRANT EXECUTE ON FUNCTION garden_control.issue_membership_invite(uuid,text,text,bytea,bytea,timestamptz) TO garden_membership_admin;
-- Targets are registered by the later editorial domain, not by an assignment request.
CREATE TABLE garden_control.review_targets (
 workspace_id uuid REFERENCES garden_control.access_workspaces(id), target_id uuid,
 revision_sha256 text NOT NULL CHECK(revision_sha256 ~ '^[0-9a-f]{64}$'),
 author_subject_id text NOT NULL, PRIMARY KEY(workspace_id,target_id),
 FOREIGN KEY(workspace_id,author_subject_id) REFERENCES garden_control.access_members(workspace_id,subject_id)
);
CREATE TABLE garden_control.review_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, target_id uuid NOT NULL,
 revision_sha256 text NOT NULL CHECK(revision_sha256 ~ '^[0-9a-f]{64}$'), kind text NOT NULL CHECK(kind IN ('research','rights','community')),
 assigned_by text NOT NULL, reviewer_subject_id text NOT NULL, author_subject_id text NOT NULL,
 issuer_grant_id uuid NOT NULL REFERENCES garden_control.access_roles(id), reviewer_grant_id uuid NOT NULL REFERENCES garden_control.access_roles(id),
 assigned_at timestamptz NOT NULL DEFAULT statement_timestamp(), state text NOT NULL DEFAULT 'assigned' CHECK(state IN ('assigned','withdrawn')),
 FOREIGN KEY(workspace_id,target_id) REFERENCES garden_control.review_targets(workspace_id,target_id),
 CHECK(reviewer_subject_id<>author_subject_id)
);
REVOKE ALL ON garden_control.review_targets,garden_control.review_assignments FROM PUBLIC,garden_research,garden_public,garden_publisher,garden_membership_admin;
CREATE FUNCTION garden_control.assign_reviewer(p_workspace uuid,p_actor text,p_reviewer text,p_target uuid,p_revision text,p_kind text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE target garden_control.review_targets%ROWTYPE; issuer uuid; reviewer uuid; required_role text; result uuid;
BEGIN
 required_role := CASE p_kind WHEN 'research' THEN 'reviewer' WHEN 'rights' THEN 'rights_reviewer' WHEN 'community' THEN 'community_adviser' END;
 IF required_role IS NULL OR NOT garden_control.membership_active(p_workspace,p_actor) OR NOT garden_control.membership_active(p_workspace,p_reviewer) THEN RAISE EXCEPTION 'Reviewer assignment denied'; END IF;
 PERFORM 1 FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id IN (p_actor,p_reviewer) ORDER BY subject_id FOR SHARE;
 PERFORM 1 FROM garden_control.access_workspaces WHERE id=p_workspace AND enabled FOR SHARE;
 SELECT * INTO target FROM garden_control.review_targets WHERE workspace_id=p_workspace AND target_id=p_target FOR SHARE;
 IF NOT FOUND OR target.revision_sha256<>p_revision OR target.author_subject_id=p_reviewer THEN RAISE EXCEPTION 'Reviewer assignment denied'; END IF;
 SELECT id INTO issuer FROM garden_control.access_roles WHERE workspace_id=p_workspace AND subject_id=p_actor AND role IN ('administrator','editor') AND revoked_at IS NULL AND expires_at>statement_timestamp() ORDER BY expires_at DESC LIMIT 1 FOR SHARE;
 SELECT id INTO reviewer FROM garden_control.access_roles WHERE workspace_id=p_workspace AND subject_id=p_reviewer AND role=required_role AND revoked_at IS NULL AND expires_at>statement_timestamp() ORDER BY expires_at DESC LIMIT 1 FOR SHARE;
 IF issuer IS NULL OR reviewer IS NULL OR NOT garden_control.membership_active(p_workspace,p_actor) OR NOT garden_control.membership_active(p_workspace,p_reviewer) THEN RAISE EXCEPTION 'Reviewer assignment denied'; END IF;
 INSERT INTO garden_control.review_assignments(workspace_id,target_id,revision_sha256,kind,assigned_by,reviewer_subject_id,author_subject_id,issuer_grant_id,reviewer_grant_id)
 VALUES(p_workspace,p_target,p_revision,p_kind,p_actor,p_reviewer,target.author_subject_id,issuer,reviewer) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION garden_control.assign_reviewer(uuid,text,text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.assign_reviewer(uuid,text,text,uuid,text,text) TO garden_research;
RESET ROLE;
