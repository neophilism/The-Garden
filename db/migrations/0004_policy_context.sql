-- Context issuer and query runtime must be separate login identities/pools.
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_context_issuer') THEN
  CREATE ROLE garden_context_issuer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_context_issuer' AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Unsafe context issuer'; END IF;
 EXECUTE format('GRANT garden_context_issuer TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $role$;
SET LOCAL ROLE garden_migrator;
CREATE TABLE garden_control.policy_tickets (
 token_hash bytea PRIMARY KEY CHECK(octet_length(token_hash)=32), workspace_id uuid NOT NULL,
 subject_id text NOT NULL, member_version bigint NOT NULL, action text NOT NULL CHECK(action IN ('read','write')),
 purpose text NOT NULL CHECK(purpose='research'), record_scope uuid,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 used_at timestamptz, CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '31 seconds'),
 FOREIGN KEY(workspace_id,subject_id) REFERENCES garden_control.access_members(workspace_id,subject_id)
);
CREATE TABLE garden_control.policy_contexts (
 backend_pid integer NOT NULL, transaction_id xid8 NOT NULL, token_hash bytea NOT NULL REFERENCES garden_control.policy_tickets(token_hash),
 PRIMARY KEY(backend_pid,transaction_id)
);
CREATE INDEX policy_ticket_expiry ON garden_control.policy_tickets(expires_at);
CREATE TABLE garden_private.record_envelopes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES garden_control.access_workspaces(id),
 owner_subject_id text NOT NULL, classification text NOT NULL DEFAULT 'unclassified' CHECK(classification IN ('unclassified','research','licensed','personal','sealed','government')),
 state text NOT NULL DEFAULT 'quarantined' CHECK(state IN ('active','quarantined','withdrawn')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,owner_subject_id) REFERENCES garden_control.access_members(workspace_id,subject_id),
 CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=1048576),
 CHECK(classification<>'sealed' OR payload='{}'::jsonb)
);
CREATE TABLE garden_control.record_grants (
 workspace_id uuid NOT NULL, record_id uuid NOT NULL, subject_id text NOT NULL,
 can_read boolean NOT NULL DEFAULT false, can_write boolean NOT NULL DEFAULT false,
 purpose text NOT NULL CHECK(purpose='research'), expires_at timestamptz NOT NULL,
 revoked_at timestamptz, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(workspace_id,record_id,subject_id,purpose), CHECK(NOT can_write OR can_read),
 FOREIGN KEY(workspace_id,record_id) REFERENCES garden_private.record_envelopes(workspace_id,id),
 FOREIGN KEY(workspace_id,subject_id) REFERENCES garden_control.access_members(workspace_id,subject_id)
);
REVOKE ALL ON garden_control.policy_tickets,garden_control.policy_contexts,garden_control.record_grants,garden_private.record_envelopes FROM PUBLIC,garden_public,garden_publisher,garden_research,garden_worker,garden_context_issuer;
GRANT USAGE ON SCHEMA garden_control TO garden_context_issuer;
CREATE FUNCTION garden_control.issue_policy_ticket(p_workspace uuid,p_subject text,p_action text,p_scope uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE token text; v bigint;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('read','write') OR NOT garden_control.membership_active(p_workspace,p_subject) THEN RAISE EXCEPTION 'Policy context denied'; END IF;
 IF p_action='write' AND NOT EXISTS(SELECT 1 FROM garden_control.access_roles WHERE workspace_id=p_workspace AND subject_id=p_subject AND role IN ('contributor','transcriber','translator','researcher','editor') AND revoked_at IS NULL AND expires_at>statement_timestamp()) THEN RAISE EXCEPTION 'Policy context denied'; END IF;
 SELECT version INTO v FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id=p_subject;
 token := replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 INSERT INTO garden_control.policy_tickets(token_hash,workspace_id,subject_id,member_version,action,purpose,record_scope,expires_at)
 VALUES(sha256(convert_to(token,'UTF8')),p_workspace,p_subject,v,p_action,'research',p_scope,clock_timestamp()+interval '30 seconds');
 RETURN token;
END $$;
CREATE FUNCTION garden_control.bind_policy_context(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.policy_tickets%ROWTYPE;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Policy context denied'; END IF;
 SELECT * INTO t FROM garden_control.policy_tickets WHERE token_hash=sha256(convert_to(p_token,'UTF8')) FOR UPDATE;
 IF NOT FOUND OR t.used_at IS NOT NULL OR t.expires_at<=clock_timestamp() OR NOT garden_control.membership_active(t.workspace_id,t.subject_id) OR NOT EXISTS(SELECT 1 FROM garden_control.access_members WHERE workspace_id=t.workspace_id AND subject_id=t.subject_id AND version=t.member_version) THEN RAISE EXCEPTION 'Policy context denied'; END IF;
 IF EXISTS(SELECT 1 FROM garden_control.policy_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id()) THEN RAISE EXCEPTION 'Policy context already bound'; END IF;
 INSERT INTO garden_control.policy_contexts VALUES(pg_backend_pid(),pg_current_xact_id(),t.token_hash);
 UPDATE garden_control.policy_tickets SET used_at=clock_timestamp() WHERE token_hash=t.token_hash;
END $$;
CREATE FUNCTION garden_control.clear_policy_context() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 DELETE FROM garden_control.policy_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id_if_assigned()
$$;
CREATE FUNCTION garden_control.invalidate_policy_ticket(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 DELETE FROM garden_control.policy_contexts WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
 DELETE FROM garden_control.policy_tickets WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
END $$;
CREATE FUNCTION garden_control.may_access_record(p_workspace uuid,p_record uuid,p_class text,p_state text,p_action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT COALESCE(p_class='research' AND p_state='active' AND p_action IN ('read','write') AND EXISTS(
 SELECT 1 FROM garden_control.policy_contexts c
 JOIN garden_control.policy_tickets t ON t.token_hash=c.token_hash
 JOIN garden_control.access_members m ON m.workspace_id=t.workspace_id AND m.subject_id=t.subject_id
 JOIN garden_control.record_grants g ON g.workspace_id=t.workspace_id AND g.subject_id=t.subject_id AND g.record_id=p_record AND g.purpose=t.purpose
 WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned()
 AND t.workspace_id=p_workspace AND t.expires_at>statement_timestamp() AND t.used_at IS NOT NULL AND m.version=t.member_version
 AND (t.record_scope IS NULL OR t.record_scope=p_record) AND g.revoked_at IS NULL AND g.expires_at>statement_timestamp()
 AND garden_control.membership_active(t.workspace_id,t.subject_id) AND g.can_read
 AND (p_action='read' OR (t.action='write' AND g.can_write AND EXISTS(SELECT 1 FROM garden_control.access_roles r WHERE r.workspace_id=t.workspace_id AND r.subject_id=t.subject_id AND r.role IN ('contributor','transcriber','translator','researcher','editor') AND r.revoked_at IS NULL AND r.expires_at>statement_timestamp())))
 ),false)
$$;
CREATE FUNCTION garden_control.bump_record_version() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN NEW.version:=OLD.version+1; RETURN NEW; END $$;
CREATE TRIGGER record_version BEFORE UPDATE ON garden_private.record_envelopes FOR EACH ROW EXECUTE FUNCTION garden_control.bump_record_version();
ALTER TABLE garden_private.record_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_private.record_envelopes FORCE ROW LEVEL SECURITY;
CREATE POLICY record_read ON garden_private.record_envelopes FOR SELECT TO garden_research USING (garden_control.may_access_record(workspace_id,id,classification,state,'read'));
CREATE POLICY record_update ON garden_private.record_envelopes FOR UPDATE TO garden_research USING (garden_control.may_access_record(workspace_id,id,classification,state,'write')) WITH CHECK (garden_control.may_access_record(workspace_id,id,classification,state,'write'));
GRANT SELECT,UPDATE(payload) ON garden_private.record_envelopes TO garden_research;
REVOKE ALL ON FUNCTION garden_control.issue_policy_ticket(uuid,text,text,uuid),garden_control.bind_policy_context(text),garden_control.clear_policy_context(),garden_control.invalidate_policy_ticket(text),garden_control.may_access_record(uuid,uuid,text,text,text),garden_control.bump_record_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.issue_policy_ticket(uuid,text,text,uuid),garden_control.invalidate_policy_ticket(text) TO garden_context_issuer;
GRANT EXECUTE ON FUNCTION garden_control.bind_policy_context(text),garden_control.clear_policy_context(),garden_control.may_access_record(uuid,uuid,text,text,text) TO garden_research;
RESET ROLE;
