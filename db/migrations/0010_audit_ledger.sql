-- Append-only, workspace-scoped audit. Database owners remain a trust boundary.
-- An external checkpoint is required to detect a complete owner rewrite.
DO $roles$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['garden_audit_reader','garden_audit_writer'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=n) THEN
   EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',n);
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=n AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Unsafe audit capability'; END IF;
  EXECUTE format('GRANT %I TO %I WITH INHERIT FALSE, SET TRUE',n,current_user);
 END LOOP;
END $roles$;
SET LOCAL ROLE garden_migrator;
GRANT USAGE ON SCHEMA garden_control TO garden_audit_reader,garden_audit_writer;
ALTER TABLE garden_control.access_roles DROP CONSTRAINT access_roles_role_check;
ALTER TABLE garden_control.access_roles ADD CONSTRAINT access_roles_role_check CHECK(role IN ('contributor','transcriber','translator','researcher','reviewer','editor','rights_reviewer','community_adviser','moderator','administrator','auditor'));
-- Auditor grants require a separate controlled administrator procedure; invitations
-- cannot acquire this role through an ordinary contributor enrollment flow.
ALTER TABLE garden_control.policy_tickets DROP CONSTRAINT policy_tickets_action_check;
ALTER TABLE garden_control.policy_tickets DROP CONSTRAINT policy_tickets_purpose_check;
ALTER TABLE garden_control.policy_tickets ADD CONSTRAINT policy_tickets_action_check CHECK(action IN ('read','write','audit'));
ALTER TABLE garden_control.policy_tickets ADD CONSTRAINT policy_tickets_purpose_check CHECK((action IN ('read','write') AND purpose='research') OR (action='audit' AND purpose='audit'));

CREATE TABLE garden_control.audit_heads (
 workspace_id uuid PRIMARY KEY, sequence bigint NOT NULL DEFAULT 0 CHECK(sequence>=0),
 hash text NOT NULL DEFAULT repeat('0',64) CHECK(hash ~ '^[0-9a-f]{64}$')
);
CREATE TABLE garden_control.audit_actor_aliases (
 workspace_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('subject','database-role')),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 1 AND 128),
 alias uuid NOT NULL DEFAULT gen_random_uuid(), PRIMARY KEY(workspace_id,kind,source_reference), UNIQUE(workspace_id,alias)
);
CREATE TABLE garden_control.audit_requests (
 backend_pid integer NOT NULL, transaction_id xid8 NOT NULL,
 request_id uuid NOT NULL DEFAULT gen_random_uuid(), PRIMARY KEY(backend_pid,transaction_id), UNIQUE(request_id)
);
CREATE TABLE garden_control.audit_events (
 workspace_id uuid NOT NULL, sequence bigint NOT NULL CHECK(sequence>0),
 previous_hash text NOT NULL CHECK(previous_hash ~ '^[0-9a-f]{64}$'),
 hash text NOT NULL CHECK(hash ~ '^[0-9a-f]{64}$'), event_text text NOT NULL CHECK(octet_length(event_text)<=4096),
 PRIMARY KEY(workspace_id,sequence),
 CHECK(jsonb_typeof(event_text::jsonb)='object'),
 CHECK(event_text::jsonb->>'workspaceId'=workspace_id::text),
 CHECK(event_text::jsonb->>'sequence'=sequence::text)
);
CREATE UNIQUE INDEX audit_event_identity ON garden_control.audit_events((event_text::jsonb->>'eventId'));
REVOKE ALL ON garden_control.audit_heads,garden_control.audit_actor_aliases,garden_control.audit_requests,garden_control.audit_events FROM PUBLIC,garden_research,garden_public,garden_worker,garden_publisher,garden_membership_admin,garden_context_issuer,garden_consent_admin,garden_audit_reader,garden_audit_writer;
ALTER TABLE garden_control.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_control.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_owner_read ON garden_control.audit_events FOR SELECT TO garden_migrator USING(true);
CREATE POLICY audit_owner_append ON garden_control.audit_events FOR INSERT TO garden_migrator WITH CHECK(true);
ALTER TABLE garden_control.audit_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_control.audit_heads FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_head_owner ON garden_control.audit_heads TO garden_migrator USING(true) WITH CHECK(true);

CREATE FUNCTION garden_control.audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Audit history is append-only'; END $$;
CREATE TRIGGER immutable_audit_events BEFORE UPDATE OR DELETE ON garden_control.audit_events FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_audit_events_truncate BEFORE TRUNCATE ON garden_control.audit_events FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_audit_aliases BEFORE UPDATE OR DELETE ON garden_control.audit_actor_aliases FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_audit_aliases_truncate BEFORE TRUNCATE ON garden_control.audit_actor_aliases FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();

CREATE FUNCTION garden_control.audit_alias(p_workspace uuid,p_kind text,p_reference text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF p_workspace IS NULL OR p_kind IS NULL OR p_kind NOT IN ('subject','database-role') OR p_reference IS NULL OR length(p_reference) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Audit reference unavailable'; END IF;
 INSERT INTO garden_control.audit_actor_aliases(workspace_id,kind,source_reference) VALUES(p_workspace,p_kind,p_reference) ON CONFLICT DO NOTHING;
 SELECT alias INTO STRICT result FROM garden_control.audit_actor_aliases WHERE workspace_id=p_workspace AND kind=p_kind AND source_reference=p_reference;
 RETURN result;
END $$;
CREATE FUNCTION garden_control.audit_request(p_explicit uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF p_explicit IS NOT NULL THEN RETURN p_explicit; END IF;
 INSERT INTO garden_control.audit_requests(backend_pid,transaction_id) VALUES(pg_backend_pid(),pg_current_xact_id()) ON CONFLICT DO NOTHING;
 SELECT request_id INTO STRICT result FROM garden_control.audit_requests WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id();
 RETURN result;
END $$;
CREATE FUNCTION garden_control.append_audit_event(p_workspace uuid,p_actor_kind text,p_actor text,p_subject_kind text,p_subject text,p_version bigint,p_action text,p_request uuid DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE h garden_control.audit_heads%ROWTYPE; actor_ref uuid; subject_ref uuid; request_ref uuid; expected_kind text; outcome text:='succeeded'; reason text; e jsonb; serialized text; digest text;
BEGIN
 IF p_workspace IS NULL OR (p_version IS NOT NULL AND p_version<=0) THEN RAISE EXCEPTION 'Audit event unavailable'; END IF;
 CASE p_action
  WHEN 'record.create' THEN expected_kind:='record';reason:='record-created';
  WHEN 'record.revise' THEN expected_kind:='record';reason:='record-revised';
  WHEN 'consent.policy' THEN expected_kind:='record';reason:='policy-revised';
  WHEN 'consent.grant' THEN expected_kind:='grant';reason:='permission-recorded';
  WHEN 'consent.withdraw' THEN expected_kind:='grant';reason:='permission-withdrawn';
  WHEN 'consent.use' THEN expected_kind:='record';reason:='permission-checked';outcome:='allowed';
  WHEN 'review.assign' THEN expected_kind:='review';reason:='reviewer-assigned';
  WHEN 'membership.change' THEN expected_kind:='identity';reason:='membership-changed';
  WHEN 'role.change' THEN expected_kind:='role';reason:='role-changed';
  WHEN 'workspace.change' THEN expected_kind:='workspace';reason:='workspace-changed';
  WHEN 'record.access' THEN expected_kind:='record';reason:='record-access-changed';
  WHEN 'identity.access' THEN expected_kind:='identity';reason:='identity-access-changed';
  WHEN 'audit.export' THEN expected_kind:='request';reason:='audit-authorized';outcome:='allowed';
  WHEN 'access.allow' THEN expected_kind:='request';reason:='authorization-allowed';outcome:='allowed';
  WHEN 'access.deny' THEN expected_kind:='request';reason:='authorization-denied';outcome:='denied';
  ELSE RAISE EXCEPTION 'Unregistered audit action';
 END CASE;
 IF p_subject_kind IS DISTINCT FROM expected_kind THEN RAISE EXCEPTION 'Audit subject mismatch'; END IF;
 INSERT INTO garden_control.audit_heads(workspace_id) VALUES(p_workspace) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT h FROM garden_control.audit_heads WHERE workspace_id=p_workspace FOR UPDATE;
 actor_ref:=garden_control.audit_alias(p_workspace,p_actor_kind,p_actor);
 request_ref:=garden_control.audit_request(p_request);
 IF p_subject_kind='identity' THEN subject_ref:=garden_control.audit_alias(p_workspace,'subject',p_subject);
 ELSIF p_subject_kind='request' THEN subject_ref:=request_ref;
 ELSE
  IF p_subject IS NULL OR p_subject !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Audit subject unavailable'; END IF;
  subject_ref:=p_subject::uuid;
 END IF;
 e:=jsonb_build_object('schemaVersion',1,'eventId',gen_random_uuid(),'workspaceId',p_workspace,'sequence',(h.sequence+1)::text,'requestId',request_ref,
  'occurredAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'actor',jsonb_build_object('kind',p_actor_kind,'reference',actor_ref),'subject',jsonb_build_object('kind',p_subject_kind,'reference',subject_ref,'version',CASE WHEN p_version IS NULL THEN NULL ELSE p_version::text END),
  'action',p_action,'outcome',outcome,'reasonCode',reason);
 serialized:=e::text;
 digest:=encode(sha256(convert_to('garden-audit-v1'||chr(10)||p_workspace::text||chr(10)||(h.sequence+1)::text||chr(10)||h.hash||chr(10)||serialized,'UTF8')),'hex');
 INSERT INTO garden_control.audit_events VALUES(p_workspace,h.sequence+1,h.hash,digest,serialized);
 UPDATE garden_control.audit_heads SET sequence=h.sequence+1,hash=digest WHERE workspace_id=p_workspace;
 RETURN h.sequence+1;
END $$;
CREATE FUNCTION garden_control.audit_current_subject(p_workspace uuid) RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT t.subject_id FROM garden_control.policy_contexts c JOIN garden_control.policy_tickets t ON t.token_hash=c.token_hash
 WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned() AND t.workspace_id=p_workspace AND t.purpose='research' AND t.action='write' AND t.expires_at>clock_timestamp()
$$;
CREATE FUNCTION garden_control.audit_record_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE actor text:=garden_control.audit_current_subject(NEW.workspace_id);
BEGIN
 PERFORM garden_control.append_audit_event(NEW.workspace_id,CASE WHEN actor IS NULL THEN 'database-role' ELSE 'subject' END,COALESCE(actor,session_user::text),'record',NEW.record_id::text,NEW.version,CASE WHEN NEW.version=1 THEN 'record.create' ELSE 'record.revise' END);
 RETURN NEW;
END $$;
CREATE TRIGGER audit_record_revision AFTER INSERT ON garden_private.record_revisions FOR EACH ROW EXECUTE FUNCTION garden_control.audit_record_revision();

CREATE FUNCTION garden_control.audit_consent_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE workspace uuid;
BEGIN
 IF TG_TABLE_NAME='use_policy_revisions' THEN
  PERFORM garden_control.append_audit_event(NEW.workspace_id,'subject',NEW.recorded_by,'record',NEW.record_id::text,NEW.version,'consent.policy');
 ELSIF TG_TABLE_NAME='consent_grants' THEN
  PERFORM garden_control.append_audit_event(NEW.workspace_id,'subject',NEW.recorded_by,'grant',NEW.id::text,NULL,'consent.grant');
 ELSIF TG_TABLE_NAME='consent_withdrawals' THEN
  SELECT workspace_id INTO STRICT workspace FROM garden_control.consent_grants WHERE id=NEW.grant_id;
  PERFORM garden_control.append_audit_event(workspace,'subject',NEW.recorded_by,'grant',NEW.grant_id::text,NULL,'consent.withdraw');
 ELSIF TG_TABLE_NAME='use_receipts' THEN
  PERFORM garden_control.append_audit_event(NEW.workspace_id,'database-role',session_user::text,'record',NEW.record_id::text,NULL,'consent.use',NEW.request_id);
 ELSE RAISE EXCEPTION 'Unknown consent audit source'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER audit_policy AFTER INSERT ON garden_control.use_policy_revisions FOR EACH ROW EXECUTE FUNCTION garden_control.audit_consent_change();
CREATE TRIGGER audit_grant AFTER INSERT ON garden_control.consent_grants FOR EACH ROW EXECUTE FUNCTION garden_control.audit_consent_change();
CREATE TRIGGER audit_withdrawal AFTER INSERT ON garden_control.consent_withdrawals FOR EACH ROW EXECUTE FUNCTION garden_control.audit_consent_change();
CREATE TRIGGER audit_use AFTER INSERT ON garden_control.use_receipts FOR EACH ROW EXECUTE FUNCTION garden_control.audit_consent_change();

CREATE FUNCTION garden_control.audit_administration_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE r jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; w uuid; v bigint;
BEGIN
 IF TG_TABLE_NAME='access_workspaces' THEN
  PERFORM garden_control.append_audit_event((r->>'id')::uuid,'database-role',session_user::text,'workspace',r->>'id',NULL,'workspace.change');
 ELSE
  w:=(r->>'workspace_id')::uuid;v:=(r->>'version')::bigint;
  IF TG_TABLE_NAME='access_members' THEN
   PERFORM garden_control.append_audit_event(w,'database-role',session_user::text,'identity',r->>'subject_id',v,'membership.change');
  ELSIF TG_TABLE_NAME='access_roles' THEN
   PERFORM garden_control.append_audit_event(w,'database-role',session_user::text,'role',r->>'id',v,'role.change');
  ELSIF TG_TABLE_NAME='record_grants' THEN
   PERFORM garden_control.append_audit_event(w,'database-role',session_user::text,'record',r->>'record_id',v,'record.access');
   PERFORM garden_control.append_audit_event(w,'database-role',session_user::text,'identity',r->>'subject_id',v,'identity.access');
  ELSIF TG_TABLE_NAME='review_assignments' THEN
   PERFORM garden_control.append_audit_event(w,'subject',r->>'assigned_by','review',r->>'id',NULL,'review.assign');
  ELSE RAISE EXCEPTION 'Unknown administration audit source'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER audit_workspaces AFTER INSERT OR UPDATE OR DELETE ON garden_control.access_workspaces FOR EACH ROW EXECUTE FUNCTION garden_control.audit_administration_change();
CREATE TRIGGER audit_members AFTER INSERT OR UPDATE OR DELETE ON garden_control.access_members FOR EACH ROW EXECUTE FUNCTION garden_control.audit_administration_change();
CREATE TRIGGER audit_roles AFTER INSERT OR UPDATE OR DELETE ON garden_control.access_roles FOR EACH ROW EXECUTE FUNCTION garden_control.audit_administration_change();
CREATE TRIGGER audit_record_grants AFTER INSERT OR UPDATE OR DELETE ON garden_control.record_grants FOR EACH ROW EXECUTE FUNCTION garden_control.audit_administration_change();
CREATE TRIGGER audit_review_assignments AFTER INSERT ON garden_control.review_assignments FOR EACH ROW EXECUTE FUNCTION garden_control.audit_administration_change();

CREATE FUNCTION garden_control.audit_member(p_workspace uuid,p_subject text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT garden_control.membership_active(p_workspace,p_subject) AND EXISTS(SELECT 1 FROM garden_control.access_roles WHERE workspace_id=p_workspace AND subject_id=p_subject AND role='auditor' AND revoked_at IS NULL AND expires_at>clock_timestamp())
$$;
CREATE FUNCTION garden_control.issue_audit_ticket(p_workspace uuid,p_subject text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE token text; v bigint;
BEGIN
 IF NOT garden_control.audit_member(p_workspace,p_subject) THEN RAISE EXCEPTION 'Audit access denied'; END IF;
 SELECT version INTO STRICT v FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id=p_subject;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 INSERT INTO garden_control.policy_tickets(token_hash,workspace_id,subject_id,member_version,action,purpose,record_scope,expires_at)
 VALUES(sha256(convert_to(token,'UTF8')),p_workspace,p_subject,v,'audit','audit',NULL,clock_timestamp()+interval '30 seconds');
 RETURN token;
END $$;
CREATE FUNCTION garden_control.audit_may_read(p_workspace uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM garden_control.policy_contexts c JOIN garden_control.policy_tickets t ON t.token_hash=c.token_hash
 JOIN garden_control.access_members m ON m.workspace_id=t.workspace_id AND m.subject_id=t.subject_id
 WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned() AND t.workspace_id=p_workspace AND t.action='audit' AND t.purpose='audit'
 AND t.used_at IS NOT NULL AND t.expires_at>clock_timestamp() AND m.version=t.member_version AND garden_control.audit_member(t.workspace_id,t.subject_id))
$$;
CREATE POLICY audit_reader ON garden_control.audit_events FOR SELECT TO garden_audit_reader USING(garden_control.audit_may_read(workspace_id));
CREATE POLICY audit_head_reader ON garden_control.audit_heads FOR SELECT TO garden_audit_reader USING(garden_control.audit_may_read(workspace_id));
GRANT SELECT ON garden_control.audit_events,garden_control.audit_heads TO garden_audit_reader;
CREATE FUNCTION garden_control.record_audit_export(p_workspace uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE actor text; request uuid;
BEGIN
 IF NOT garden_control.audit_may_read(p_workspace) THEN RAISE EXCEPTION 'Audit access denied'; END IF;
 SELECT t.subject_id INTO STRICT actor FROM garden_control.policy_contexts c JOIN garden_control.policy_tickets t ON t.token_hash=c.token_hash WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned();
 request:=garden_control.audit_request();
 PERFORM garden_control.append_audit_event(p_workspace,'subject',actor,'request',NULL,NULL,'audit.export',request);
 RETURN request;
END $$;
-- An allowed decision is NOT evidence that an operation ran or was published.
-- Only a separately authenticated, server-owned decision adapter may call this.
CREATE FUNCTION garden_control.record_audit_decision(p_workspace uuid,p_subject text,p_request uuid,p_allowed boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF p_request IS NULL OR p_allowed IS NULL OR NOT EXISTS(SELECT 1 FROM garden_control.access_workspaces WHERE id=p_workspace) THEN RAISE EXCEPTION 'Audit decision unavailable'; END IF;
 PERFORM garden_control.append_audit_event(p_workspace,CASE WHEN p_subject IS NULL THEN 'database-role' ELSE 'subject' END,COALESCE(p_subject,session_user::text),'request',NULL,NULL,CASE WHEN p_allowed THEN 'access.allow' ELSE 'access.deny' END,p_request);
END $$;
REVOKE ALL ON FUNCTION garden_control.audit_immutable(),garden_control.audit_alias(uuid,text,text),garden_control.audit_request(uuid),garden_control.append_audit_event(uuid,text,text,text,text,bigint,text,uuid),garden_control.audit_current_subject(uuid),garden_control.audit_record_revision(),garden_control.audit_consent_change(),garden_control.audit_administration_change(),garden_control.audit_member(uuid,text),garden_control.issue_audit_ticket(uuid,text),garden_control.audit_may_read(uuid),garden_control.record_audit_export(uuid),garden_control.record_audit_decision(uuid,text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.issue_audit_ticket(uuid,text),garden_control.audit_member(uuid,text) TO garden_context_issuer;
GRANT EXECUTE ON FUNCTION garden_control.bind_policy_context(text),garden_control.clear_policy_context(),garden_control.audit_may_read(uuid),garden_control.record_audit_export(uuid) TO garden_audit_reader;
GRANT EXECUTE ON FUNCTION garden_control.record_audit_decision(uuid,text,uuid,boolean) TO garden_audit_writer;
RESET ROLE;
