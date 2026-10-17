-- Draft additive GDN-032 requester storage. No research-record lookup,
-- reviewed acceptance, tombstone, export worker, retention period or eraser.
-- A fixed trusted host mints admission for its actual requester PID+xid8 before
-- taking case/audit locks. Runtime SQL access is not an end-user interface.
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_lifecycle_requester') THEN
  CREATE ROLE garden_lifecycle_requester NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_lifecycle_requester' AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Unsafe lifecycle capability'; END IF;
 EXECUTE format('GRANT garden_lifecycle_requester TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $role$;
SET LOCAL ROLE garden_migrator;
GRANT USAGE ON SCHEMA garden_control TO garden_lifecycle_requester;

CREATE TABLE garden_private.lifecycle_request_cases (
 workspace_id uuid NOT NULL REFERENCES garden_control.access_workspaces(id), request_id uuid NOT NULL,
 requester_reference uuid NOT NULL DEFAULT gen_random_uuid(),
 submission_operation_id uuid NOT NULL UNIQUE,
 submission_fingerprint text NOT NULL CHECK(submission_fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 PRIMARY KEY(workspace_id,request_id), UNIQUE(workspace_id,request_id,requester_reference),
 CHECK(created_at>=timestamptz '1970-01-01 00:00:00+00' AND extract(year FROM created_at AT TIME ZONE 'UTC')<=9999 AND created_at=date_trunc('milliseconds',created_at))
);
-- Private case material is deliberately separate from retained operation
-- evidence. No runtime can update/delete it. A future authorized eraser may
-- remove it; absent material denies reconstruction and is never re-created by
-- a retry. Retained hashes/aliases are not proof of anonymization or erasure.
CREATE TABLE garden_private.lifecycle_request_payloads (
 workspace_id uuid NOT NULL, request_id uuid NOT NULL, requester_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('delete','export')), claimed_record_id uuid NOT NULL,
 PRIMARY KEY(workspace_id,request_id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES garden_private.lifecycle_request_cases(workspace_id,request_id),
 CHECK(length(requester_id) BETWEEN 1 AND 128 AND octet_length(requester_id)<=512)
);
CREATE TABLE garden_private.lifecycle_request_events (
 workspace_id uuid NOT NULL, request_id uuid NOT NULL, revision bigint NOT NULL CHECK(revision IN (1,2)),
 operation_id uuid NOT NULL UNIQUE, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 action text NOT NULL CHECK(action IN ('submit','cancel')), state text NOT NULL CHECK(state IN ('pending','cancelled')),
 requester_reference uuid NOT NULL, expected_revision bigint NOT NULL,
 previous_revision bigint, previous_fingerprint text,
 recorded_at timestamptz NOT NULL, admission_expires_at timestamptz NOT NULL,
 audit_sequence bigint NOT NULL, transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(workspace_id,request_id,revision), UNIQUE(workspace_id,request_id,revision,fingerprint),
 FOREIGN KEY(workspace_id,request_id,requester_reference) REFERENCES garden_private.lifecycle_request_cases(workspace_id,request_id,requester_reference),
 FOREIGN KEY(workspace_id,request_id,previous_revision,previous_fingerprint) REFERENCES garden_private.lifecycle_request_events(workspace_id,request_id,revision,fingerprint),
 FOREIGN KEY(workspace_id,audit_sequence) REFERENCES garden_control.audit_events(workspace_id,sequence),
 CHECK((revision=1 AND action='submit' AND state='pending' AND expected_revision=0 AND previous_revision IS NULL AND previous_fingerprint IS NULL) OR
       (revision=2 AND action='cancel' AND state='cancelled' AND expected_revision=1 AND previous_revision IS NOT NULL AND previous_revision=1 AND previous_fingerprint IS NOT NULL AND previous_fingerprint ~ '^[0-9a-f]{64}$')),
 CHECK(recorded_at>=timestamptz '1970-01-01 00:00:00+00' AND extract(year FROM recorded_at AT TIME ZONE 'UTC')<=9999 AND recorded_at=date_trunc('milliseconds',recorded_at)),
 CHECK(admission_expires_at>recorded_at)
);
CREATE TABLE garden_private.lifecycle_request_heads (
 workspace_id uuid NOT NULL, request_id uuid NOT NULL, revision bigint NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'), PRIMARY KEY(workspace_id,request_id),
 FOREIGN KEY(workspace_id,request_id,revision,fingerprint) REFERENCES garden_private.lifecycle_request_events(workspace_id,request_id,revision,fingerprint)
);
CREATE TABLE garden_control.lifecycle_request_tickets (
 token_hash bytea PRIMARY KEY CHECK(octet_length(token_hash)=32),
 workspace_id uuid NOT NULL REFERENCES garden_control.access_workspaces(id), subject_id text NOT NULL,
 environment text NOT NULL CHECK(environment IN ('ci','staging')),
 purpose text NOT NULL CHECK(purpose='lifecycle-request'), action text NOT NULL CHECK(action IN ('submit','status','cancel','recover')),
 request_id uuid NOT NULL, operation_id uuid NOT NULL, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 backend_pid integer NOT NULL CHECK(backend_pid>0), transaction_id xid8 NOT NULL,
 issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz,
 UNIQUE(backend_pid,transaction_id), CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '31 seconds')
);
CREATE INDEX lifecycle_request_ticket_expiry ON garden_control.lifecycle_request_tickets(expires_at);
CREATE TABLE garden_control.lifecycle_request_contexts (
 backend_pid integer NOT NULL, transaction_id xid8 NOT NULL,
 token_hash bytea NOT NULL REFERENCES garden_control.lifecycle_request_tickets(token_hash),
 completed_at timestamptz, closed_at timestamptz, result_revision bigint, result_fingerprint text,
 PRIMARY KEY(backend_pid,transaction_id), UNIQUE(token_hash),
 CHECK((completed_at IS NULL AND result_revision IS NULL AND result_fingerprint IS NULL AND closed_at IS NULL) OR
       (completed_at IS NOT NULL AND result_revision IS NOT NULL AND result_revision IN (1,2) AND result_fingerprint IS NOT NULL AND result_fingerprint ~ '^[0-9a-f]{64}$'))
);
DO $private$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['lifecycle_request_cases','lifecycle_request_payloads','lifecycle_request_events','lifecycle_request_heads'] LOOP
  EXECUTE format('REVOKE ALL ON garden_private.%I FROM PUBLIC,garden_public,garden_research,garden_publisher,garden_worker,garden_context_issuer,garden_membership_admin,garden_consent_admin,garden_audit_reader,garden_audit_writer,garden_encryption,garden_lifecycle_requester',n);
  EXECUTE format('ALTER TABLE garden_private.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('ALTER TABLE garden_private.%I FORCE ROW LEVEL SECURITY',n);
  EXECUTE format('CREATE POLICY lifecycle_owner ON garden_private.%I TO garden_migrator USING(true) WITH CHECK(true)',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['lifecycle_request_tickets','lifecycle_request_contexts'] LOOP
  EXECUTE format('REVOKE ALL ON garden_control.%I FROM PUBLIC,garden_public,garden_research,garden_publisher,garden_worker,garden_context_issuer,garden_membership_admin,garden_consent_admin,garden_audit_reader,garden_audit_writer,garden_encryption,garden_lifecycle_requester',n);
  EXECUTE format('ALTER TABLE garden_control.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('ALTER TABLE garden_control.%I FORCE ROW LEVEL SECURITY',n);
  EXECUTE format('CREATE POLICY lifecycle_owner ON garden_control.%I TO garden_migrator USING(true) WITH CHECK(true)',n);
 END LOOP;
END $private$;
CREATE TRIGGER immutable_lifecycle_case BEFORE UPDATE OR DELETE ON garden_private.lifecycle_request_cases FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_lifecycle_case_truncate BEFORE TRUNCATE ON garden_private.lifecycle_request_cases FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_lifecycle_event BEFORE UPDATE OR DELETE ON garden_private.lifecycle_request_events FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_lifecycle_event_truncate BEFORE TRUNCATE ON garden_private.lifecycle_request_events FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();

CREATE FUNCTION garden_control.lifecycle_uuid_valid(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT COALESCE(p ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) $$;
CREATE FUNCTION garden_control.lifecycle_subject_valid(p text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE ch text; units integer:=0;
BEGIN
 IF p IS NULL OR length(p)<1 OR octet_length(p)>512 THEN RETURN false; END IF;
 FOR ch IN SELECT regexp_split_to_table(p,'') LOOP
  IF ascii(ch)<=32 OR ascii(ch)=127 THEN RETURN false; END IF;
  units:=units+CASE WHEN ascii(ch)>65535 THEN 2 ELSE 1 END;
 END LOOP;
 RETURN units BETWEEN 1 AND 128;
END $$;
CREATE FUNCTION garden_control.lifecycle_exact(p jsonb,fields text[]) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' THEN RETURN false; END IF;
 RETURN p ?& fields AND p-fields='{}'::jsonb;
END $$;
CREATE FUNCTION garden_control.lifecycle_submission_fingerprint(p_workspace uuid,p_subject text,p jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text; encoded text;
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_workspace::text) OR NOT garden_control.lifecycle_subject_valid(p_subject) OR NOT garden_control.lifecycle_exact(p,ARRAY['operationId','requestId','kind','claimedRecordId']) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 FOREACH k IN ARRAY ARRAY['operationId','requestId','claimedRecordId'] LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' OR NOT garden_control.lifecycle_uuid_valid(p->>k) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 END LOOP;
 IF jsonb_typeof(p->'kind') IS DISTINCT FROM 'string' OR p->>'kind' NOT IN ('delete','export') THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 -- Explicit scalar serialization matches the domain's JSON.stringify order;
 -- JSONB object order/whitespace must never become an operation identity.
 encoded:='{"workspaceId":'||to_json(p_workspace::text)::text||',"subjectId":'||to_json(p_subject)::text||',"operationId":'||to_json(p->>'operationId')::text||',"requestId":'||to_json(p->>'requestId')::text||',"kind":'||to_json(p->>'kind')::text||',"claimedRecordId":'||to_json(p->>'claimedRecordId')::text||'}';
 RETURN encode(sha256(convert_to('garden-lifecycle-operation-v1'||chr(10)||'submit'||chr(10)||encoded,'UTF8')),'hex');
END $$;
CREATE FUNCTION garden_control.lifecycle_cancellation_fingerprint(p_workspace uuid,p_subject text,p_request uuid,p_submission text,p_operation uuid,p_expected bigint) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE encoded text;
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_workspace::text) OR NOT garden_control.lifecycle_subject_valid(p_subject) OR NOT garden_control.lifecycle_uuid_valid(p_request::text) OR NOT garden_control.lifecycle_uuid_valid(p_operation::text) OR p_submission IS NULL OR p_submission !~ '^[0-9a-f]{64}$' OR p_expected IS NULL OR p_expected<1 THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 encoded:='{"workspaceId":'||to_json(p_workspace::text)::text||',"subjectId":'||to_json(p_subject)::text||',"requestId":'||to_json(p_request::text)::text||',"requestFingerprint":'||to_json(p_submission)::text||',"operationId":'||to_json(p_operation::text)::text||',"expectedRevision":'||to_json(p_expected::text)::text||',"state":"cancelled","review":null}';
 RETURN encode(sha256(convert_to('garden-lifecycle-operation-v1'||chr(10)||'cancel'||chr(10)||encoded,'UTF8')),'hex');
END $$;
CREATE FUNCTION garden_control.lifecycle_status_fingerprint(p_workspace uuid,p_subject text,p_request uuid,p_operation uuid) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE encoded text;
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_workspace::text) OR NOT garden_control.lifecycle_subject_valid(p_subject) OR NOT garden_control.lifecycle_uuid_valid(p_request::text) OR NOT garden_control.lifecycle_uuid_valid(p_operation::text) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 encoded:='{"workspaceId":'||to_json(p_workspace::text)::text||',"subjectId":'||to_json(p_subject)::text||',"requestId":'||to_json(p_request::text)::text||',"operationId":'||to_json(p_operation::text)::text||'}';
 RETURN encode(sha256(convert_to('garden-lifecycle-read-v1'||chr(10)||'status'||chr(10)||encoded,'UTF8')),'hex');
END $$;
CREATE FUNCTION garden_control.lifecycle_deployment(p_workspace uuid,p_environment text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_workspace::text) OR p_environment IS NULL OR p_environment NOT IN ('ci','staging') THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 PERFORM 1 FROM garden_control.deployment_binding WHERE singleton AND repository='neophilism/The-Garden' AND environment=p_environment AND database_name=current_database() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 -- Receiving-workspace existence is required; its research enablement and
 -- researcher policies are deliberately unrelated to this own-request path.
 PERFORM 1 FROM garden_control.access_workspaces WHERE id=p_workspace FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
END $$;

CREATE FUNCTION garden_control.issue_lifecycle_request_ticket(p_workspace uuid,p_subject text,p_environment text,p_action text,p_request uuid,p_operation uuid,p_fingerprint text,p_backend integer,p_transaction xid8) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE token text; point timestamptz; resolved uuid;
BEGIN
 IF NOT garden_control.lifecycle_subject_valid(p_subject) OR p_action IS NULL OR p_action NOT IN ('submit','status','cancel','recover') OR NOT garden_control.lifecycle_uuid_valid(p_operation::text) OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' OR p_backend IS NULL OR p_backend<=0 OR p_transaction IS NULL THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 PERFORM garden_control.lifecycle_deployment(p_workspace,p_environment);
 IF p_action='recover' THEN
  IF p_request IS NOT NULL THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
  SELECT e.request_id INTO resolved FROM garden_private.lifecycle_request_events e
   JOIN garden_private.lifecycle_request_payloads p USING(workspace_id,request_id)
   WHERE e.operation_id=p_operation AND e.workspace_id=p_workspace AND e.fingerprint=p_fingerprint AND p.requester_id=p_subject;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 ELSE
  IF NOT garden_control.lifecycle_uuid_valid(p_request::text) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
  resolved:=p_request;
 END IF;
 IF p_action='status' AND p_fingerprint IS DISTINCT FROM garden_control.lifecycle_status_fingerprint(p_workspace,p_subject,resolved,p_operation) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');point:=clock_timestamp();
 INSERT INTO garden_control.lifecycle_request_tickets(token_hash,workspace_id,subject_id,environment,purpose,action,request_id,operation_id,fingerprint,backend_pid,transaction_id,issued_at,expires_at)
 VALUES(sha256(convert_to(token,'UTF8')),p_workspace,p_subject,p_environment,'lifecycle-request',p_action,resolved,p_operation,p_fingerprint,p_backend,p_transaction,point,point+interval '30 seconds');
 RETURN token;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle request unavailable';
END $$;
CREATE FUNCTION garden_control.bind_lifecycle_request_context(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO t FROM garden_control.lifecycle_request_tickets WHERE token_hash=sha256(convert_to(p_token,'UTF8')) FOR UPDATE;
 IF NOT FOUND OR t.used_at IS NOT NULL OR t.expires_at<=clock_timestamp() OR t.backend_pid<>pg_backend_pid() OR t.transaction_id<>pg_current_xact_id() THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 PERFORM garden_control.lifecycle_deployment(t.workspace_id,t.environment);
 IF t.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 INSERT INTO garden_control.lifecycle_request_contexts(backend_pid,transaction_id,token_hash) VALUES(pg_backend_pid(),pg_current_xact_id(),t.token_hash);
 UPDATE garden_control.lifecycle_request_tickets SET used_at=clock_timestamp() WHERE token_hash=t.token_hash;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle request unavailable';
END $$;
CREATE FUNCTION garden_control.invalidate_lifecycle_request_ticket(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 DELETE FROM garden_control.lifecycle_request_contexts WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
 DELETE FROM garden_control.lifecycle_request_tickets WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
END $$;
CREATE FUNCTION garden_control.lifecycle_request_authority(p_action text,p_request uuid,p_operation uuid,p_fingerprint text) RETURNS garden_control.lifecycle_request_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE;
BEGIN
 SELECT q.* INTO t FROM garden_control.lifecycle_request_contexts c JOIN garden_control.lifecycle_request_tickets q ON q.token_hash=c.token_hash
  WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned() AND c.completed_at IS NULL AND c.closed_at IS NULL;
 IF NOT FOUND OR t.backend_pid<>pg_backend_pid() OR t.transaction_id<>pg_current_xact_id() OR t.used_at IS NULL OR t.expires_at<=clock_timestamp() OR t.action IS DISTINCT FROM p_action OR (p_request IS NOT NULL AND t.request_id<>p_request) OR (p_operation IS NOT NULL AND t.operation_id<>p_operation) OR (p_fingerprint IS NOT NULL AND t.fingerprint<>p_fingerprint) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 PERFORM garden_control.lifecycle_deployment(t.workspace_id,t.environment);
 -- Global operation uniqueness and missing case rows are serialized before
 -- lookup; a failed transaction cannot make its prebound token reusable.
 IF p_action IN ('submit','cancel','recover') THEN PERFORM pg_advisory_xact_lock(144740,hashtext(t.operation_id::text)); END IF;
 PERFORM pg_advisory_xact_lock(144741,hashtext(t.workspace_id::text||':'||t.request_id::text));
 IF t.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 RETURN t;
END $$;
CREATE FUNCTION garden_control.lifecycle_head_current(p_workspace uuid,p_request uuid,p_revision bigint,p_fingerprint text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM garden_private.lifecycle_request_events WHERE workspace_id=p_workspace AND request_id=p_request AND revision=p_revision AND fingerprint=p_fingerprint)
 AND NOT EXISTS(SELECT 1 FROM garden_private.lifecycle_request_events WHERE workspace_id=p_workspace AND request_id=p_request AND revision>p_revision)
$$;
CREATE FUNCTION garden_control.lifecycle_request_snapshot(p_workspace uuid,p_request uuid,p_subject text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE c garden_private.lifecycle_request_cases%ROWTYPE; p garden_private.lifecycle_request_payloads%ROWTYPE; h garden_private.lifecycle_request_heads%ROWTYPE; first_event garden_private.lifecycle_request_events%ROWTYPE; last_event garden_private.lifecycle_request_events%ROWTYPE; original jsonb; resolution jsonb:=NULL;
BEGIN
 SELECT * INTO c FROM garden_private.lifecycle_request_cases WHERE workspace_id=p_workspace AND request_id=p_request FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO p FROM garden_private.lifecycle_request_payloads WHERE workspace_id=p_workspace AND request_id=p_request FOR SHARE;
 IF NOT FOUND OR p.requester_id IS DISTINCT FROM p_subject THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 original:=jsonb_build_object('operationId',c.submission_operation_id,'requestId',c.request_id,'kind',p.kind,'claimedRecordId',p.claimed_record_id);
 IF garden_control.lifecycle_submission_fingerprint(c.workspace_id,p.requester_id,original) IS DISTINCT FROM c.submission_fingerprint THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO h FROM garden_private.lifecycle_request_heads WHERE workspace_id=p_workspace AND request_id=p_request FOR SHARE;
 IF NOT FOUND OR NOT garden_control.lifecycle_head_current(p_workspace,p_request,h.revision,h.fingerprint) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO first_event FROM garden_private.lifecycle_request_events WHERE workspace_id=p_workspace AND request_id=p_request AND revision=1;
 IF NOT FOUND OR first_event.operation_id<>c.submission_operation_id OR first_event.fingerprint<>c.submission_fingerprint OR first_event.recorded_at<>c.created_at OR first_event.requester_reference<>c.requester_reference THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO last_event FROM garden_private.lifecycle_request_events WHERE workspace_id=p_workspace AND request_id=p_request AND revision=h.revision AND fingerprint=h.fingerprint;
 IF NOT FOUND OR last_event.recorded_at<c.created_at OR last_event.requester_reference<>c.requester_reference THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 IF h.revision=2 THEN
  IF last_event.previous_fingerprint<>c.submission_fingerprint OR last_event.operation_id=c.submission_operation_id OR last_event.fingerprint IS DISTINCT FROM garden_control.lifecycle_cancellation_fingerprint(c.workspace_id,p.requester_id,c.request_id,c.submission_fingerprint,last_event.operation_id,1) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
  resolution:=jsonb_build_object('action','cancel','operationId',last_event.operation_id,'fingerprint',last_event.fingerprint,'subjectId',p.requester_id,'expectedRevision','1','state','cancelled','recordedAt',to_char(last_event.recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'review',NULL);
 END IF;
 RETURN jsonb_build_object('schemaVersion',1,'requestId',c.request_id,'workspaceId',c.workspace_id,'requesterId',p.requester_id,'kind',p.kind,'claimedRecordId',p.claimed_record_id,'createdAt',to_char(c.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'revision',h.revision::text,'state',last_event.state,'submission',jsonb_build_object('operationId',c.submission_operation_id,'fingerprint',c.submission_fingerprint),'resolution',resolution);
END $$;
CREATE FUNCTION garden_control.lifecycle_complete_request(p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE; h garden_private.lifecycle_request_heads%ROWTYPE;
BEGIN
 SELECT q.* INTO t FROM garden_control.lifecycle_request_contexts c JOIN garden_control.lifecycle_request_tickets q ON q.token_hash=c.token_hash WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned() AND c.completed_at IS NULL AND c.closed_at IS NULL;
 IF NOT FOUND OR t.expires_at<=clock_timestamp() OR p_request->>'workspaceId' IS DISTINCT FROM t.workspace_id::text OR p_request->>'requestId' IS DISTINCT FROM t.request_id::text OR p_request->>'requesterId' IS DISTINCT FROM t.subject_id THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO STRICT h FROM garden_private.lifecycle_request_heads WHERE workspace_id=t.workspace_id AND request_id=t.request_id;
 UPDATE garden_control.lifecycle_request_contexts SET completed_at=clock_timestamp(),result_revision=h.revision,result_fingerprint=h.fingerprint WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id();
 RETURN p_request;
END $$;
CREATE FUNCTION garden_control.check_lifecycle_request_context() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE; c garden_control.lifecycle_request_contexts%ROWTYPE;
BEGIN
 SELECT * INTO c FROM garden_control.lifecycle_request_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id_if_assigned();
 IF NOT FOUND OR c.completed_at IS NULL OR c.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO t FROM garden_control.lifecycle_request_tickets WHERE token_hash=c.token_hash;
 IF NOT FOUND OR t.used_at IS NULL OR t.backend_pid<>pg_backend_pid() OR t.transaction_id<>pg_current_xact_id() OR t.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 PERFORM garden_control.lifecycle_deployment(t.workspace_id,t.environment);
 IF t.expires_at<=clock_timestamp() OR NOT garden_control.lifecycle_head_current(t.workspace_id,t.request_id,c.result_revision,c.result_fingerprint) OR NOT EXISTS(SELECT 1 FROM garden_private.lifecycle_request_heads WHERE workspace_id=t.workspace_id AND request_id=t.request_id AND revision=c.result_revision AND fingerprint=c.result_fingerprint) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 RETURN true;
END $$;
CREATE FUNCTION garden_control.clear_lifecycle_request_context() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 PERFORM garden_control.check_lifecycle_request_context();
 UPDATE garden_control.lifecycle_request_contexts SET closed_at=clock_timestamp() WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id() AND closed_at IS NULL;
END $$;
CREATE FUNCTION garden_control.lifecycle_request_commit_fresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE; c garden_control.lifecycle_request_contexts%ROWTYPE;
BEGIN
 SELECT * INTO c FROM garden_control.lifecycle_request_contexts WHERE backend_pid=NEW.backend_pid AND transaction_id=NEW.transaction_id;
 IF NOT FOUND OR c.completed_at IS NULL OR c.closed_at IS NULL THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO t FROM garden_control.lifecycle_request_tickets WHERE token_hash=NEW.token_hash;
 IF NOT FOUND OR t.used_at IS NULL OR t.expires_at<=clock_timestamp() OR t.backend_pid<>pg_backend_pid() OR t.transaction_id<>pg_current_xact_id() OR NOT garden_control.lifecycle_head_current(t.workspace_id,t.request_id,c.result_revision,c.result_fingerprint) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 RETURN NULL;
END $$;
-- This trigger covers new writes, reads and exact operation readback alike.
-- Fixed host SQL keeps it deferred. A compromised arbitrary-SQL login could
-- force an early constraint check; it is not an untrusted runtime API.
CREATE CONSTRAINT TRIGGER lifecycle_request_commit_fresh AFTER INSERT ON garden_control.lifecycle_request_contexts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_control.lifecycle_request_commit_fresh();

CREATE FUNCTION garden_control.submit_lifecycle_request(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE; old garden_private.lifecycle_request_events%ROWTYPE; c garden_private.lifecycle_request_cases%ROWTYPE; command jsonb; result jsonb; operation uuid; requested uuid; fingerprint text; point timestamptz; seq bigint;
BEGIN
 IF NOT garden_control.lifecycle_exact(p,ARRAY['input','fingerprint']) OR NOT garden_control.lifecycle_exact(p->'input',ARRAY['operationId','requestId','kind','claimedRecordId']) OR jsonb_typeof(p->'fingerprint') IS DISTINCT FROM 'string' OR p->>'fingerprint' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 command:=p->'input';
 IF jsonb_typeof(command->'operationId') IS DISTINCT FROM 'string' OR jsonb_typeof(command->'requestId') IS DISTINCT FROM 'string' OR NOT garden_control.lifecycle_uuid_valid(command->>'operationId') OR NOT garden_control.lifecycle_uuid_valid(command->>'requestId') THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 operation:=(command->>'operationId')::uuid;requested:=(command->>'requestId')::uuid;fingerprint:=p->>'fingerprint';
 t:=garden_control.lifecycle_request_authority('submit',requested,operation,fingerprint);
 IF fingerprint IS DISTINCT FROM garden_control.lifecycle_submission_fingerprint(t.workspace_id,t.subject_id,command) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO old FROM garden_private.lifecycle_request_events WHERE operation_id=operation;
 IF FOUND THEN
  IF old.workspace_id<>t.workspace_id OR old.request_id<>requested OR old.fingerprint<>fingerprint OR old.action<>'submit' THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
  RETURN garden_control.lifecycle_complete_request(garden_control.lifecycle_request_snapshot(t.workspace_id,requested,t.subject_id));
 END IF;
 IF EXISTS(SELECT 1 FROM garden_private.lifecycle_request_cases WHERE workspace_id=t.workspace_id AND request_id=requested) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 point:=date_trunc('milliseconds',clock_timestamp());
 INSERT INTO garden_private.lifecycle_request_cases(workspace_id,request_id,submission_operation_id,submission_fingerprint,created_at)
  VALUES(t.workspace_id,requested,operation,fingerprint,point) RETURNING * INTO c;
 INSERT INTO garden_private.lifecycle_request_payloads(workspace_id,request_id,requester_id,kind,claimed_record_id)
  VALUES(t.workspace_id,requested,t.subject_id,command->>'kind',(command->>'claimedRecordId')::uuid);
 -- State, head and succeeded audit are one transaction. No separate pool is
 -- awaited while append_audit_event holds the workspace audit head.
 seq:=garden_control.append_audit_event(t.workspace_id,'subject',t.subject_id,'lifecycle-request',requested::text,1,'lifecycle.request.submit',operation);
 IF t.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 INSERT INTO garden_private.lifecycle_request_events(workspace_id,request_id,revision,operation_id,fingerprint,action,state,requester_reference,expected_revision,recorded_at,admission_expires_at,audit_sequence)
  VALUES(t.workspace_id,requested,1,operation,fingerprint,'submit','pending',c.requester_reference,0,point,t.expires_at,seq);
 INSERT INTO garden_private.lifecycle_request_heads VALUES(t.workspace_id,requested,1,fingerprint);
 result:=garden_control.lifecycle_request_snapshot(t.workspace_id,requested,t.subject_id);
 RETURN garden_control.lifecycle_complete_request(result);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle request unavailable';
END $$;
CREATE FUNCTION garden_control.cancel_lifecycle_request(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE; old garden_private.lifecycle_request_events%ROWTYPE; c garden_private.lifecycle_request_cases%ROWTYPE; command jsonb; current_request jsonb; operation uuid; requested uuid; op_fingerprint text; expected bigint; point timestamptz; seq bigint; changed bigint;
BEGIN
 IF NOT garden_control.lifecycle_exact(p,ARRAY['input','requestFingerprint','fingerprint']) OR NOT garden_control.lifecycle_exact(p->'input',ARRAY['operationId','requestId','expectedRevision']) OR jsonb_typeof(p->'fingerprint') IS DISTINCT FROM 'string' OR p->>'fingerprint' !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p->'requestFingerprint') IS DISTINCT FROM 'string' OR p->>'requestFingerprint' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 command:=p->'input';
 IF jsonb_typeof(command->'operationId') IS DISTINCT FROM 'string' OR jsonb_typeof(command->'requestId') IS DISTINCT FROM 'string' OR NOT garden_control.lifecycle_uuid_valid(command->>'operationId') OR NOT garden_control.lifecycle_uuid_valid(command->>'requestId') OR jsonb_typeof(command->'expectedRevision') IS DISTINCT FROM 'string' OR command->>'expectedRevision' !~ '^[1-9][0-9]{0,18}$' OR (command->>'expectedRevision')::numeric>9223372036854775807 THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 operation:=(command->>'operationId')::uuid;requested:=(command->>'requestId')::uuid;op_fingerprint:=p->>'fingerprint';expected:=(command->>'expectedRevision')::bigint;
 t:=garden_control.lifecycle_request_authority('cancel',requested,operation,op_fingerprint);
 IF op_fingerprint IS DISTINCT FROM garden_control.lifecycle_cancellation_fingerprint(t.workspace_id,t.subject_id,requested,p->>'requestFingerprint',operation,expected) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 current_request:=garden_control.lifecycle_request_snapshot(t.workspace_id,requested,t.subject_id);
 IF current_request#>>'{submission,fingerprint}' IS DISTINCT FROM p->>'requestFingerprint' THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO old FROM garden_private.lifecycle_request_events WHERE operation_id=operation;
 IF FOUND THEN
  IF old.workspace_id<>t.workspace_id OR old.request_id<>requested OR old.fingerprint<>op_fingerprint OR old.action<>'cancel' THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
  RETURN garden_control.lifecycle_complete_request(current_request);
 END IF;
 IF current_request->>'state'<>'pending' OR expected<>1 OR current_request->>'revision'<>expected::text THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 SELECT * INTO STRICT c FROM garden_private.lifecycle_request_cases WHERE workspace_id=t.workspace_id AND request_id=requested;
 point:=date_trunc('milliseconds',clock_timestamp());
 IF point<c.created_at THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 seq:=garden_control.append_audit_event(t.workspace_id,'subject',t.subject_id,'lifecycle-request',requested::text,2,'lifecycle.request.cancel',operation);
 IF t.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 INSERT INTO garden_private.lifecycle_request_events(workspace_id,request_id,revision,operation_id,fingerprint,action,state,requester_reference,expected_revision,previous_revision,previous_fingerprint,recorded_at,admission_expires_at,audit_sequence)
  VALUES(t.workspace_id,requested,2,operation,op_fingerprint,'cancel','cancelled',c.requester_reference,1,1,c.submission_fingerprint,point,t.expires_at,seq);
 UPDATE garden_private.lifecycle_request_heads SET revision=2,fingerprint=op_fingerprint
  WHERE workspace_id=t.workspace_id AND request_id=requested AND revision=expected AND lifecycle_request_heads.fingerprint=c.submission_fingerprint;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 RETURN garden_control.lifecycle_complete_request(garden_control.lifecycle_request_snapshot(t.workspace_id,requested,t.subject_id));
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle request unavailable';
END $$;
CREATE FUNCTION garden_control.lifecycle_request_status(p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE;
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_request::text) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 t:=garden_control.lifecycle_request_authority('status',p_request,NULL,NULL);
 IF t.fingerprint IS DISTINCT FROM garden_control.lifecycle_status_fingerprint(t.workspace_id,t.subject_id,p_request,t.operation_id) THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 RETURN garden_control.lifecycle_complete_request(garden_control.lifecycle_request_snapshot(t.workspace_id,p_request,t.subject_id));
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle request unavailable';
END $$;
CREATE FUNCTION garden_control.recover_lifecycle_request(p_operation uuid,p_fingerprint text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_request_tickets%ROWTYPE; e garden_private.lifecycle_request_events%ROWTYPE;
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_operation::text) OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 t:=garden_control.lifecycle_request_authority('recover',NULL,p_operation,p_fingerprint);
 SELECT * INTO e FROM garden_private.lifecycle_request_events WHERE operation_id=p_operation;
 IF NOT FOUND OR e.workspace_id<>t.workspace_id OR e.request_id<>t.request_id OR e.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'Lifecycle request unavailable'; END IF;
 RETURN garden_control.lifecycle_complete_request(garden_control.lifecycle_request_snapshot(t.workspace_id,t.request_id,t.subject_id));
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle request unavailable';
END $$;

-- Preserve the effective 0013 audit protocol; add only these two closed
-- lifecycle mutation actions. 'request' continues to mean operation identity,
-- while 'lifecycle-request' is the stable case UUID and never a claimed record.
CREATE OR REPLACE FUNCTION garden_control.append_audit_event(p_workspace uuid,p_actor_kind text,p_actor text,p_subject_kind text,p_subject text,p_version bigint,p_action text,p_request uuid DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE h garden_control.audit_heads%ROWTYPE; actor_ref uuid; subject_ref uuid; request_ref uuid; expected_kind text; outcome text:='succeeded'; reason text; e jsonb; serialized text; digest text;
BEGIN
 IF p_workspace IS NULL OR (p_version IS NOT NULL AND p_version<=0) THEN RAISE EXCEPTION 'Audit event unavailable'; END IF;
 CASE p_action
  WHEN 'lifecycle.request.submit' THEN expected_kind:='lifecycle-request';reason:='request-submitted';
  WHEN 'lifecycle.request.cancel' THEN expected_kind:='lifecycle-request';reason:='request-cancelled';
  WHEN 'encryption.persist' THEN expected_kind:='record';reason:='encrypted-content-persisted';
  WHEN 'encryption.rewrap' THEN expected_kind:='record';reason:='encrypted-content-rewrapped';
  WHEN 'encryption.key-policy' THEN expected_kind:='workspace';reason:='encryption-key-policy-changed';
  WHEN 'encryption.key-version' THEN expected_kind:='workspace';reason:='encryption-key-version-changed';
  WHEN 'record.create' THEN expected_kind:='record';reason:='record-created';
  WHEN 'record.revise' THEN expected_kind:='record';reason:='record-revised';
  WHEN 'consent.policy' THEN expected_kind:='record';reason:='policy-revised';
  WHEN 'consent.grant' THEN expected_kind:='grant';reason:='permission-recorded';
  WHEN 'consent.withdraw' THEN expected_kind:='grant';reason:='permission-withdrawn';
  WHEN 'consent.use' THEN expected_kind:='record';reason:='permission-checked';outcome:='allowed';
  WHEN 'review.scope' THEN expected_kind:='review';reason:='review-scope-created';
  WHEN 'review.decision' THEN expected_kind:='review';reason:='scoped-decision-recorded';
  WHEN 'review.reopen' THEN expected_kind:='review';reason:='scoped-review-reopened';
  WHEN 'review.import' THEN expected_kind:='review';reason:='imported-status-preserved';
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

REVOKE ALL ON FUNCTION garden_control.lifecycle_uuid_valid(text),garden_control.lifecycle_subject_valid(text),garden_control.lifecycle_exact(jsonb,text[]),garden_control.lifecycle_submission_fingerprint(uuid,text,jsonb),garden_control.lifecycle_cancellation_fingerprint(uuid,text,uuid,text,uuid,bigint),garden_control.lifecycle_status_fingerprint(uuid,text,uuid,uuid),garden_control.lifecycle_deployment(uuid,text),garden_control.issue_lifecycle_request_ticket(uuid,text,text,text,uuid,uuid,text,integer,xid8),garden_control.bind_lifecycle_request_context(text),garden_control.invalidate_lifecycle_request_ticket(text),garden_control.lifecycle_request_authority(text,uuid,uuid,text),garden_control.lifecycle_head_current(uuid,uuid,bigint,text),garden_control.lifecycle_request_snapshot(uuid,uuid,text),garden_control.lifecycle_complete_request(jsonb),garden_control.check_lifecycle_request_context(),garden_control.clear_lifecycle_request_context(),garden_control.lifecycle_request_commit_fresh(),garden_control.submit_lifecycle_request(jsonb),garden_control.cancel_lifecycle_request(jsonb),garden_control.lifecycle_request_status(uuid),garden_control.recover_lifecycle_request(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.issue_lifecycle_request_ticket(uuid,text,text,text,uuid,uuid,text,integer,xid8),garden_control.invalidate_lifecycle_request_ticket(text) TO garden_context_issuer;
GRANT EXECUTE ON FUNCTION garden_control.bind_lifecycle_request_context(text),garden_control.check_lifecycle_request_context(),garden_control.clear_lifecycle_request_context(),garden_control.submit_lifecycle_request(jsonb),garden_control.cancel_lifecycle_request(jsonb),garden_control.lifecycle_request_status(uuid),garden_control.recover_lifecycle_request(uuid,text) TO garden_lifecycle_requester;
RESET ROLE;
