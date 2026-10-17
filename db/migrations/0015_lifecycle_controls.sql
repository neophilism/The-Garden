-- Bounded GDN-032 operator controls. No requester decision, tombstone, eraser,
-- export, graph inventory or permission to deliver/purge is introduced here.
-- Fresh server-attested UV, current research access and independently maintained
-- scoped lifecycle authority are all required. No authority is seeded.
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_lifecycle_admin') THEN
  CREATE ROLE garden_lifecycle_admin NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_lifecycle_admin' AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Unsafe lifecycle capability'; END IF;
 EXECUTE format('GRANT garden_lifecycle_admin TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $role$;
SET LOCAL ROLE garden_migrator;
GRANT USAGE ON SCHEMA garden_control TO garden_lifecycle_admin;

CREATE TABLE garden_control.lifecycle_operation_registry (
 operation_id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES garden_control.access_workspaces(id),
 object_id uuid NOT NULL, action text NOT NULL CHECK(action IN ('request.submit','request.cancel','lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release','authority.evidence','authority.grant')),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 UNIQUE(operation_id,workspace_id,object_id,fingerprint)
);
-- Existing retained operations are indexed without changing any old receipt.
INSERT INTO garden_control.lifecycle_operation_registry(operation_id,workspace_id,object_id,action,fingerprint)
 SELECT operation_id,workspace_id,request_id,'request.'||action,fingerprint FROM garden_private.lifecycle_request_events;
ALTER TABLE garden_private.lifecycle_request_events ADD CONSTRAINT lifecycle_request_global_operation
 FOREIGN KEY(operation_id,workspace_id,request_id,fingerprint) REFERENCES garden_control.lifecycle_operation_registry(operation_id,workspace_id,object_id,fingerprint);

CREATE TABLE garden_control.lifecycle_authority_evidence (
 workspace_id uuid NOT NULL, evidence_id uuid NOT NULL, revision bigint NOT NULL CHECK(revision>0),
 record_id uuid NOT NULL, record_revision bigint NOT NULL CHECK(record_revision>0), classification text NOT NULL CHECK(classification='restricted_research'),
 action text NOT NULL CHECK(action IN ('lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release','lifecycle.inspect')),
 authority_kind text NOT NULL CHECK(authority_kind IN ('policy-appointment','legal-review','preservation-review')),
 authority_reference uuid NOT NULL, reviewer_reference uuid NOT NULL,
 valid_from timestamptz NOT NULL, expires_at timestamptz NOT NULL, review_by timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('verified','revoked')),
 operation_id uuid NOT NULL UNIQUE, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 previous_revision bigint, previous_fingerprint text, recorded_at timestamptz NOT NULL, audit_sequence bigint NOT NULL,
 PRIMARY KEY(workspace_id,evidence_id,revision), UNIQUE(workspace_id,evidence_id,revision,fingerprint),
 -- A maintenance assertion does not establish record existence. The runtime
 -- resolves/locks the actual research record before using this scoped evidence.
 FOREIGN KEY(workspace_id,evidence_id,previous_revision,previous_fingerprint) REFERENCES garden_control.lifecycle_authority_evidence(workspace_id,evidence_id,revision,fingerprint),
 FOREIGN KEY(operation_id,workspace_id,evidence_id,fingerprint) REFERENCES garden_control.lifecycle_operation_registry(operation_id,workspace_id,object_id,fingerprint),
 FOREIGN KEY(workspace_id,audit_sequence) REFERENCES garden_control.audit_events(workspace_id,sequence),
 CHECK(valid_from<review_by AND review_by<=expires_at),
 CHECK((revision=1 AND previous_revision IS NULL AND previous_fingerprint IS NULL) OR (revision>1 AND previous_revision IS NOT NULL AND previous_revision=revision-1 AND previous_fingerprint IS NOT NULL AND previous_fingerprint ~ '^[0-9a-f]{64}$'))
);
CREATE TABLE garden_control.lifecycle_evidence_heads (
 workspace_id uuid NOT NULL, evidence_id uuid NOT NULL, revision bigint NOT NULL, fingerprint text NOT NULL,
 PRIMARY KEY(workspace_id,evidence_id),
 FOREIGN KEY(workspace_id,evidence_id,revision,fingerprint) REFERENCES garden_control.lifecycle_authority_evidence(workspace_id,evidence_id,revision,fingerprint)
);
CREATE TABLE garden_control.lifecycle_operator_grants (
 workspace_id uuid NOT NULL, grant_id uuid NOT NULL, revision bigint NOT NULL CHECK(revision>0), subject_id text NOT NULL,
 record_id uuid NOT NULL, record_revision bigint NOT NULL CHECK(record_revision>0), classification text NOT NULL CHECK(classification='restricted_research'),
 action text NOT NULL CHECK(action IN ('lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release','lifecycle.inspect')),
 evidence_id uuid NOT NULL, evidence_revision bigint NOT NULL CHECK(evidence_revision>0),
 valid_from timestamptz NOT NULL, expires_at timestamptz NOT NULL, review_by timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('active','revoked')),
 operation_id uuid NOT NULL UNIQUE, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 previous_revision bigint, previous_fingerprint text, recorded_at timestamptz NOT NULL, audit_sequence bigint NOT NULL,
 PRIMARY KEY(workspace_id,grant_id,revision), UNIQUE(workspace_id,grant_id,revision,fingerprint),
 -- No broad owner metadata bypass is added to researcher RLS. Scope becomes
 -- usable only through the separately current research-record predicate.
 FOREIGN KEY(workspace_id,evidence_id,evidence_revision) REFERENCES garden_control.lifecycle_authority_evidence(workspace_id,evidence_id,revision),
 FOREIGN KEY(workspace_id,grant_id,previous_revision,previous_fingerprint) REFERENCES garden_control.lifecycle_operator_grants(workspace_id,grant_id,revision,fingerprint),
 FOREIGN KEY(operation_id,workspace_id,grant_id,fingerprint) REFERENCES garden_control.lifecycle_operation_registry(operation_id,workspace_id,object_id,fingerprint),
 FOREIGN KEY(workspace_id,audit_sequence) REFERENCES garden_control.audit_events(workspace_id,sequence),
 CHECK(garden_control.lifecycle_subject_valid(subject_id)), CHECK(valid_from<review_by AND review_by<=expires_at),
 CHECK((revision=1 AND previous_revision IS NULL AND previous_fingerprint IS NULL) OR (revision>1 AND previous_revision IS NOT NULL AND previous_revision=revision-1 AND previous_fingerprint IS NOT NULL AND previous_fingerprint ~ '^[0-9a-f]{64}$'))
);
CREATE TABLE garden_control.lifecycle_grant_heads (
 workspace_id uuid NOT NULL, grant_id uuid NOT NULL, revision bigint NOT NULL, fingerprint text NOT NULL,
 PRIMARY KEY(workspace_id,grant_id),
 FOREIGN KEY(workspace_id,grant_id,revision,fingerprint) REFERENCES garden_control.lifecycle_operator_grants(workspace_id,grant_id,revision,fingerprint)
);

CREATE TABLE garden_private.lifecycle_control_events (
 workspace_id uuid NOT NULL, record_id uuid NOT NULL, record_revision bigint NOT NULL CHECK(record_revision>0),
 control_id uuid NOT NULL, revision bigint NOT NULL CHECK(revision>0), control_revision bigint NOT NULL CHECK(control_revision>0),
 kind text NOT NULL CHECK(kind IN ('retention-rule','hold-record')),
 action text NOT NULL CHECK(action IN ('lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release')),
 operation_id uuid NOT NULL UNIQUE, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 record_fingerprint text NOT NULL CHECK(record_fingerprint ~ '^[0-9a-f]{64}$'),
 intent_fingerprint text NOT NULL CHECK(intent_fingerprint ~ '^[0-9a-f]{64}$'),
 proposal_fingerprint text NOT NULL CHECK(proposal_fingerprint ~ '^[0-9a-f]{64}$'),
 grant_id uuid NOT NULL, grant_revision bigint NOT NULL,
 previous_revision bigint, previous_fingerprint text,
 recorded_at timestamptz NOT NULL, admission_expires_at timestamptz NOT NULL, audit_sequence bigint NOT NULL,
 transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(workspace_id,control_id,revision),
 UNIQUE(workspace_id,control_id,revision,record_fingerprint),
 UNIQUE(workspace_id,control_id,revision,record_fingerprint,record_id,record_revision,kind),
 UNIQUE(workspace_id,record_id,record_revision,control_revision,fingerprint),
 UNIQUE(workspace_id,record_id,record_revision,control_revision),
 FOREIGN KEY(workspace_id,record_id,record_revision) REFERENCES garden_private.record_revisions(workspace_id,record_id,version),
 FOREIGN KEY(workspace_id,grant_id,grant_revision) REFERENCES garden_control.lifecycle_operator_grants(workspace_id,grant_id,revision),
 FOREIGN KEY(workspace_id,control_id,previous_revision,previous_fingerprint,record_id,record_revision,kind) REFERENCES garden_private.lifecycle_control_events(workspace_id,control_id,revision,record_fingerprint,record_id,record_revision,kind),
 FOREIGN KEY(operation_id,workspace_id,control_id,fingerprint) REFERENCES garden_control.lifecycle_operation_registry(operation_id,workspace_id,object_id,fingerprint),
 FOREIGN KEY(workspace_id,audit_sequence) REFERENCES garden_control.audit_events(workspace_id,sequence),
 CHECK((revision=1 AND previous_revision IS NULL AND previous_fingerprint IS NULL) OR (revision>1 AND previous_revision IS NOT NULL AND previous_revision=revision-1 AND previous_fingerprint IS NOT NULL AND previous_fingerprint ~ '^[0-9a-f]{64}$')),
 CHECK((kind='retention-rule' AND action='lifecycle.retention-rule') OR (kind='hold-record' AND ((revision=1 AND action='lifecycle.hold-place') OR (revision=2 AND action='lifecycle.hold-release')))),
 CHECK(admission_expires_at>recorded_at)
);
-- Sensitive command/proof material is separate from immutable receipt metadata.
-- Missing or modified payload fails closed; no worker or eraser is granted.
CREATE TABLE garden_private.lifecycle_control_payloads (
 workspace_id uuid NOT NULL, control_id uuid NOT NULL, revision bigint NOT NULL,
 record jsonb NOT NULL, operation jsonb NOT NULL,
 PRIMARY KEY(workspace_id,control_id,revision),
 FOREIGN KEY(workspace_id,control_id,revision) REFERENCES garden_private.lifecycle_control_events(workspace_id,control_id,revision),
 CHECK(jsonb_typeof(record)='object' AND jsonb_typeof(operation)='object' AND octet_length(record::text)+octet_length(operation::text)<=262144)
);
CREATE TABLE garden_private.lifecycle_control_heads (
 workspace_id uuid NOT NULL, control_id uuid NOT NULL, revision bigint NOT NULL, fingerprint text NOT NULL,
 PRIMARY KEY(workspace_id,control_id),
 FOREIGN KEY(workspace_id,control_id,revision,fingerprint) REFERENCES garden_private.lifecycle_control_events(workspace_id,control_id,revision,record_fingerprint)
);
CREATE TABLE garden_private.lifecycle_control_scope_heads (
 workspace_id uuid NOT NULL, record_id uuid NOT NULL, record_revision bigint NOT NULL, control_revision bigint NOT NULL, fingerprint text NOT NULL,
 PRIMARY KEY(workspace_id,record_id,record_revision),
 FOREIGN KEY(workspace_id,record_id,record_revision,control_revision,fingerprint) REFERENCES garden_private.lifecycle_control_events(workspace_id,record_id,record_revision,control_revision,fingerprint)
);
CREATE TABLE garden_control.lifecycle_control_tickets (
 token_hash bytea PRIMARY KEY CHECK(octet_length(token_hash)=32), policy_token_hash bytea NOT NULL UNIQUE REFERENCES garden_control.policy_tickets(token_hash),
 workspace_id uuid NOT NULL, subject_id text NOT NULL, environment text NOT NULL CHECK(environment IN ('ci','staging')),
 phase text NOT NULL CHECK(phase IN ('prepare','commit','status','recover')), request jsonb NOT NULL,
 record_id uuid NOT NULL, record_revision bigint NOT NULL, action text NOT NULL,
 operation_id uuid NOT NULL, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 backend_pid integer NOT NULL CHECK(backend_pid>0), transaction_id xid8 NOT NULL,
 issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, admission_deadline timestamptz NOT NULL, used_at timestamptz,
 UNIQUE(backend_pid,transaction_id), FOREIGN KEY(workspace_id) REFERENCES garden_control.access_workspaces(id),
 CHECK(garden_control.lifecycle_subject_valid(subject_id)),
 CHECK(action IN ('lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release','lifecycle.inspect')),
 CHECK(jsonb_typeof(request)='object' AND octet_length(request::text)<=262144),
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '31 seconds' AND expires_at<=admission_deadline)
);
CREATE INDEX lifecycle_control_ticket_expiry ON garden_control.lifecycle_control_tickets(expires_at);
CREATE TABLE garden_control.lifecycle_control_contexts (
 backend_pid integer NOT NULL, transaction_id xid8 NOT NULL, token_hash bytea NOT NULL UNIQUE REFERENCES garden_control.lifecycle_control_tickets(token_hash),
 grant_id uuid, grant_revision bigint, evidence_id uuid, evidence_revision bigint,
 authority_expires_at timestamptz, result_fingerprint text, completed_at timestamptz, closed_at timestamptz,
 PRIMARY KEY(backend_pid,transaction_id),
 CHECK((completed_at IS NULL AND closed_at IS NULL AND grant_id IS NULL AND grant_revision IS NULL AND evidence_id IS NULL AND evidence_revision IS NULL AND authority_expires_at IS NULL AND result_fingerprint IS NULL) OR
       (completed_at IS NOT NULL AND grant_id IS NOT NULL AND grant_revision IS NOT NULL AND grant_revision>0 AND evidence_id IS NOT NULL AND evidence_revision IS NOT NULL AND evidence_revision>0 AND authority_expires_at IS NOT NULL AND result_fingerprint IS NOT NULL AND result_fingerprint ~ '^[0-9a-f]{64}$'))
);
-- Inserted and deleted within the final fixed validation/retirement TX. The
-- deferred trigger receives its captured NEW deadline even after deletion.
CREATE TABLE garden_control.lifecycle_control_delivery_checks (
 backend_pid integer NOT NULL, transaction_id xid8 NOT NULL, workspace_id uuid NOT NULL,
 record_id uuid NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(backend_pid,transaction_id)
);

DO $private$ DECLARE s text; n text; BEGIN
 FOREACH s IN ARRAY ARRAY['garden_control','garden_private'] LOOP
  FOREACH n IN ARRAY CASE WHEN s='garden_control' THEN ARRAY['lifecycle_operation_registry','lifecycle_authority_evidence','lifecycle_evidence_heads','lifecycle_operator_grants','lifecycle_grant_heads','lifecycle_control_tickets','lifecycle_control_contexts','lifecycle_control_delivery_checks'] ELSE ARRAY['lifecycle_control_events','lifecycle_control_payloads','lifecycle_control_heads','lifecycle_control_scope_heads'] END LOOP
   EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC,garden_public,garden_research,garden_publisher,garden_worker,garden_context_issuer,garden_membership_admin,garden_consent_admin,garden_audit_reader,garden_audit_writer,garden_encryption,garden_lifecycle_requester,garden_lifecycle_admin',s,n);
   EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',s,n);
   EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',s,n);
   EXECUTE format('CREATE POLICY lifecycle_control_owner ON %I.%I TO garden_migrator USING(true) WITH CHECK(true)',s,n);
  END LOOP;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['lifecycle_operation_registry','lifecycle_authority_evidence','lifecycle_operator_grants'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_lifecycle_control BEFORE UPDATE OR DELETE ON garden_control.%I FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable()',n);
  EXECUTE format('CREATE TRIGGER immutable_lifecycle_control_truncate BEFORE TRUNCATE ON garden_control.%I FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable()',n);
 END LOOP;
END $private$;
CREATE TRIGGER immutable_lifecycle_control_event BEFORE UPDATE OR DELETE ON garden_private.lifecycle_control_events FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_lifecycle_control_event_truncate BEFORE TRUNCATE ON garden_private.lifecycle_control_events FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();

CREATE FUNCTION garden_control.register_lifecycle_request_operation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 -- The unchanged requester already holds this operation lock. Never introduce
 -- a workspace lock here after its case/audit locks.
 INSERT INTO garden_control.lifecycle_operation_registry(operation_id,workspace_id,object_id,action,fingerprint)
 VALUES(NEW.operation_id,NEW.workspace_id,NEW.request_id,'request.'||NEW.action,NEW.fingerprint);
 RETURN NEW;
END $$;
CREATE TRIGGER register_lifecycle_request_operation BEFORE INSERT ON garden_private.lifecycle_request_events FOR EACH ROW EXECUTE FUNCTION garden_control.register_lifecycle_request_operation();

CREATE FUNCTION garden_control.lifecycle_control_time(p text) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE t timestamptz;
BEGIN
 IF p IS NULL OR p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 t:=p::timestamptz;
 IF to_char(t AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>p THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 RETURN t;
END $$;
CREATE FUNCTION garden_control.lifecycle_control_iso(p timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT to_char(p AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
CREATE FUNCTION garden_control.lifecycle_control_revision(p jsonb,p_zero boolean DEFAULT false) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE n bigint;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'string' OR p#>>'{}' !~ '^(0|[1-9][0-9]{0,18})$' OR (p#>>'{}')::numeric>9223372036854775807 THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 n:=(p#>>'{}')::bigint;IF n=0 AND NOT p_zero THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;RETURN n;
END $$;
-- Fixed schema order, not JSONB key order, defines every persisted digest.
-- Scalar to_json encoding preserves quotes/backslashes/Unicode subject IDs.
CREATE FUNCTION garden_control.lifecycle_control_json(p_kind text,p jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE fields text[]; k text; encoded text:='{'; v text; child text; action text; start_at timestamptz; end_at timestamptz; review_at timestamptz;
BEGIN
 CASE p_kind
  WHEN 'scope' THEN fields:=ARRAY['workspaceId','recordId','recordRevision','classification'];
  WHEN 'lifecycle.retention-rule' THEN fields:=ARRAY['operationId','ruleId','revision','scope','retentionClass','basis','evidenceId','effectiveAt','expiresAt','reviewBy','retainUntil','disposeBy'];
  WHEN 'lifecycle.hold-place' THEN fields:=ARRAY['operationId','holdId','scope','reason','evidenceId','effectiveAt','expiresAt','reviewBy'];
  WHEN 'lifecycle.hold-release' THEN fields:=ARRAY['operationId','holdId','expectedRevision','holdFingerprint','evidenceId','reviewBy'];
  WHEN 'intent' THEN fields:=ARRAY['action','scope','command','expectedControlRevision','expectedFingerprint'];
  WHEN 'authority' THEN fields:=ARRAY['workspaceId','subjectId','action','operationId','authorizationId','authorityEvidenceId','authorityRevision','validFrom','expiresAt','commandFingerprint'];
  WHEN 'commit' THEN fields:=ARRAY['intent','intentFingerprint','grantId','grantRevision','authority','proposalFingerprint','fingerprint'];
  WHEN 'event' THEN fields:=ARRAY['command','recordedAt','authority'];
  WHEN 'rule' THEN fields:=ARRAY['schemaVersion','kind','event'];
  WHEN 'hold' THEN fields:=ARRAY['schemaVersion','kind','revision','placement','release'];
  WHEN 'evidence' THEN fields:=ARRAY['operationId','evidenceId','revision','expectedFingerprint','scope','action','authorityKind','authorityReference','reviewerReference','validFrom','expiresAt','reviewBy','state'];
  WHEN 'grant' THEN fields:=ARRAY['operationId','grantId','revision','expectedFingerprint','scope','subjectId','action','evidenceId','evidenceRevision','validFrom','expiresAt','reviewBy','state'];
  ELSE RAISE EXCEPTION 'Lifecycle control unavailable';
 END CASE;
 IF NOT garden_control.lifecycle_exact(p,fields) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 FOREACH k IN ARRAY fields LOOP
  IF encoded<>'{' THEN encoded:=encoded||','; END IF;
  child:=NULL;
  IF k='scope' THEN child:='scope';
  ELSIF k='intent' THEN child:='intent';
  ELSIF k='authority' THEN child:='authority';
  ELSIF k IN ('event','placement') OR k='release' AND p->k<>'null'::jsonb THEN child:='event';
  ELSIF k='command' THEN child:=CASE WHEN p_kind='intent' THEN p->>'action' ELSE p#>>'{authority,action}' END;
  END IF;
  IF child IS NOT NULL THEN v:=garden_control.lifecycle_control_json(child,p->k);
  ELSIF k='schemaVersion' THEN IF p->k IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;v:='1';
  ELSIF k IN ('expectedFingerprint','release') AND p->k='null'::jsonb THEN v:='null';
  ELSE
   IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
   v:=to_json(p->>k)::text;
   IF k IN ('workspaceId','recordId','operationId','ruleId','holdId','evidenceId','authorizationId','authorityEvidenceId','grantId','authorityReference','reviewerReference') AND NOT garden_control.lifecycle_uuid_valid(p->>k) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
   IF k='subjectId' AND NOT garden_control.lifecycle_subject_valid(p->>k) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
   IF k IN ('recordRevision','revision','expectedRevision','expectedControlRevision','authorityRevision','grantRevision','evidenceRevision') THEN PERFORM garden_control.lifecycle_control_revision(p->k,k='expectedControlRevision'); END IF;
   IF k IN ('expectedFingerprint','holdFingerprint','commandFingerprint','intentFingerprint','proposalFingerprint','fingerprint') AND p->>k !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
   IF k IN ('validFrom','effectiveAt','expiresAt','reviewBy','retainUntil','disposeBy','recordedAt') THEN PERFORM garden_control.lifecycle_control_time(p->>k); END IF;
  END IF;
  encoded:=encoded||to_json(k)::text||':'||v;
 END LOOP;
 IF p_kind='scope' AND p->>'classification'<>'restricted_research' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF p_kind IN ('intent','authority') AND p->>'action' NOT IN ('lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release') THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF p_kind='intent' THEN
  action:=p->>'action';
  IF action<>'lifecycle.hold-release' AND p->'scope' IS DISTINCT FROM p#>'{command,scope}' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF (action='lifecycle.hold-place' OR action='lifecycle.retention-rule' AND p#>>'{command,revision}'='1') AND p->'expectedFingerprint' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF action='lifecycle.retention-rule' AND p#>>'{command,revision}'<>'1' AND (p->>'expectedFingerprint' IS NULL OR p->>'expectedFingerprint' !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF action='lifecycle.hold-release' AND p->>'expectedFingerprint' IS DISTINCT FROM p#>>'{command,holdFingerprint}' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 END IF;
 IF p_kind IN ('lifecycle.retention-rule','lifecycle.hold-place') THEN
  start_at:=garden_control.lifecycle_control_time(p->>'effectiveAt');end_at:=garden_control.lifecycle_control_time(p->>'expiresAt');review_at:=garden_control.lifecycle_control_time(p->>'reviewBy');
  IF start_at>=review_at OR review_at>end_at THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF p_kind='lifecycle.retention-rule' AND (p->>'retentionClass'<>'case_and_rights_policy' OR p->>'basis' NOT IN ('policy','preservation-exception') OR garden_control.lifecycle_control_time(p->>'retainUntil')<start_at OR garden_control.lifecycle_control_time(p->>'retainUntil')>garden_control.lifecycle_control_time(p->>'disposeBy') OR garden_control.lifecycle_control_time(p->>'disposeBy')>end_at) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF p_kind='lifecycle.hold-place' AND p->>'reason' NOT IN ('legal-hold','preservation-hold') THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 END IF;
 IF p_kind='lifecycle.hold-release' AND p->>'expectedRevision'<>'1' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF p_kind='authority' AND garden_control.lifecycle_control_time(p->>'validFrom')>=garden_control.lifecycle_control_time(p->>'expiresAt') THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF p_kind='event' THEN
  action:=p#>>'{authority,action}';start_at:=garden_control.lifecycle_control_time(p->>'recordedAt');
  IF p#>>'{authority,operationId}' IS DISTINCT FROM p#>>'{command,operationId}' OR p#>>'{authority,authorizationId}' IS DISTINCT FROM p#>>'{command,operationId}' OR p#>>'{authority,commandFingerprint}' IS DISTINCT FROM garden_control.lifecycle_control_command_fingerprint((p#>>'{authority,workspaceId}')::uuid,p#>>'{authority,subjectId}',action,p->'command') OR garden_control.lifecycle_control_time(p#>>'{authority,validFrom}')>start_at OR garden_control.lifecycle_control_time(p#>>'{authority,expiresAt}')<=start_at OR garden_control.lifecycle_control_time(p#>>'{command,reviewBy}')<=start_at OR (action<>'lifecycle.hold-release' AND garden_control.lifecycle_control_time(p#>>'{command,expiresAt}')<=start_at) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 END IF;
 IF p_kind IN ('evidence','grant') THEN
  IF p->>'action' NOT IN ('lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release','lifecycle.inspect') OR garden_control.lifecycle_control_time(p->>'validFrom')>=garden_control.lifecycle_control_time(p->>'reviewBy') OR garden_control.lifecycle_control_time(p->>'reviewBy')>garden_control.lifecycle_control_time(p->>'expiresAt') THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF (p->>'revision'='1' AND p->'expectedFingerprint' IS DISTINCT FROM 'null'::jsonb) OR (p->>'revision'<>'1' AND (p->>'expectedFingerprint' IS NULL OR p->>'expectedFingerprint' !~ '^[0-9a-f]{64}$')) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF p_kind='evidence' AND (p->>'state' NOT IN ('verified','revoked') OR p->>'authorityKind' NOT IN ('policy-appointment','legal-review','preservation-review')) OR p_kind='grant' AND p->>'state' NOT IN ('active','revoked') THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 END IF;
 IF p_kind='rule' AND (p->>'kind'<>'retention-rule' OR p#>>'{event,authority,action}'<>'lifecycle.retention-rule') OR p_kind='hold' AND (p->>'kind'<>'hold-record' OR p#>>'{placement,authority,action}'<>'lifecycle.hold-place' OR (p->'release'='null'::jsonb AND p->>'revision'<>'1') OR (p->'release'<>'null'::jsonb AND (p->>'revision'<>'2' OR p#>>'{release,authority,action}'<>'lifecycle.hold-release'))) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 RETURN encoded||'}';
END $$;
CREATE FUNCTION garden_control.lifecycle_control_digest(p_profile text,p_encoded text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT encode(sha256(convert_to(p_profile||chr(10)||p_encoded,'UTF8')),'hex') $$;
CREATE FUNCTION garden_control.lifecycle_control_intent_fingerprint(p_workspace uuid,p_subject text,p_intent jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE encoded text;
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_workspace::text) OR NOT garden_control.lifecycle_subject_valid(p_subject) OR p_intent#>>'{scope,workspaceId}' IS DISTINCT FROM p_workspace::text THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 encoded:='{"workspaceId":'||to_json(p_workspace::text)::text||',"subjectId":'||to_json(p_subject)::text||',"intent":'||garden_control.lifecycle_control_json('intent',p_intent)||'}';
 RETURN garden_control.lifecycle_control_digest('garden-lifecycle-control-intent-v1',encoded);
END $$;
CREATE FUNCTION garden_control.lifecycle_control_command_fingerprint(p_workspace uuid,p_subject text,p_action text,p_command jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE encoded text;
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_workspace::text) OR NOT garden_control.lifecycle_subject_valid(p_subject) OR p_action NOT IN ('lifecycle.retention-rule','lifecycle.hold-place','lifecycle.hold-release') OR (p_action<>'lifecycle.hold-release' AND p_command#>>'{scope,workspaceId}' IS DISTINCT FROM p_workspace::text) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 encoded:='{"workspaceId":'||to_json(p_workspace::text)::text||',"subjectId":'||to_json(p_subject)::text||',"command":'||garden_control.lifecycle_control_json(p_action,p_command)||'}';
 RETURN garden_control.lifecycle_control_digest('garden-retention-v1'||chr(10)||p_action,encoded);
END $$;
CREATE FUNCTION garden_control.lifecycle_control_operation_fingerprint(p_workspace uuid,p_subject text,p jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE a jsonb; i jsonb; proposal text; fingerprint text;
BEGIN
 PERFORM garden_control.lifecycle_control_json('commit',p);a:=p->'authority';i:=p->'intent';
 IF p->>'intentFingerprint' IS DISTINCT FROM garden_control.lifecycle_control_intent_fingerprint(p_workspace,p_subject,i) OR a->>'workspaceId' IS DISTINCT FROM p_workspace::text OR a->>'subjectId' IS DISTINCT FROM p_subject OR a->>'action' IS DISTINCT FROM i->>'action' OR a->>'operationId' IS DISTINCT FROM i#>>'{command,operationId}' OR a->>'authorizationId' IS DISTINCT FROM a->>'operationId' OR a->>'authorityRevision' IS DISTINCT FROM p->>'grantRevision' OR a->>'commandFingerprint' IS DISTINCT FROM garden_control.lifecycle_control_command_fingerprint(p_workspace,p_subject,i->>'action',i->'command') THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 proposal:=garden_control.lifecycle_control_digest('garden-retention-v1'||chr(10)||'operation','{"command":'||garden_control.lifecycle_control_json(i->>'action',i->'command')||',"authority":'||garden_control.lifecycle_control_json('authority',a)||'}');
 fingerprint:=garden_control.lifecycle_control_digest('garden-lifecycle-control-operation-v1','{"intentFingerprint":'||to_json(p->>'intentFingerprint')::text||',"grantId":'||to_json(p->>'grantId')::text||',"grantRevision":'||to_json(p->>'grantRevision')::text||',"authority":'||garden_control.lifecycle_control_json('authority',a)||',"proposalFingerprint":'||to_json(proposal)::text||'}');
 IF p->>'proposalFingerprint' IS DISTINCT FROM proposal OR p->>'fingerprint' IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;RETURN fingerprint;
END $$;
CREATE FUNCTION garden_control.lifecycle_control_read_fingerprint(p_workspace uuid,p_subject text,p_scope jsonb,p_operation uuid) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF NOT garden_control.lifecycle_uuid_valid(p_workspace::text) OR NOT garden_control.lifecycle_subject_valid(p_subject) OR NOT garden_control.lifecycle_uuid_valid(p_operation::text) OR p_scope->>'workspaceId' IS DISTINCT FROM p_workspace::text THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 RETURN garden_control.lifecycle_control_digest('garden-lifecycle-control-read-v1','{"workspaceId":'||to_json(p_workspace::text)::text||',"subjectId":'||to_json(p_subject)::text||',"scope":'||garden_control.lifecycle_control_json('scope',p_scope)||',"operationId":'||to_json(p_operation::text)::text||'}');
END $$;

-- These two maintenance functions have no runtime EXECUTE grant. Their caller
-- is the database maintenance boundary, responsible for establishing actual
-- appointment/legal/preservation evidence. UUIDs merely identify that evidence.
-- The explicit actor is attribution by that owner, not an identity verifier.
CREATE FUNCTION garden_control.record_lifecycle_evidence(p jsonb,p_actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE w uuid; eid uuid; rev bigint; operation uuid; fp text; old garden_control.lifecycle_authority_evidence%ROWTYPE; h garden_control.lifecycle_evidence_heads%ROWTYPE; prior garden_control.lifecycle_authority_evidence%ROWTYPE; environment text; seq bigint; point timestamptz;
BEGIN
 PERFORM garden_control.lifecycle_control_json('evidence',p);
 IF NOT garden_control.lifecycle_subject_valid(p_actor) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 w:=(p#>>'{scope,workspaceId}')::uuid;eid:=(p->>'evidenceId')::uuid;rev:=(p->>'revision')::bigint;operation:=(p->>'operationId')::uuid;
 fp:=garden_control.lifecycle_control_digest('garden-lifecycle-authority-evidence-v1','{"maintainerId":'||to_json(p_actor)::text||',"command":'||garden_control.lifecycle_control_json('evidence',p)||'}');
 PERFORM pg_advisory_xact_lock(144729,hashtext(w::text));
 SELECT b.environment INTO environment FROM garden_control.deployment_binding b WHERE b.singleton;
 PERFORM garden_control.lifecycle_deployment(w,environment);
 PERFORM pg_advisory_xact_lock(144740,hashtext(operation::text));
 SELECT * INTO old FROM garden_control.lifecycle_authority_evidence WHERE operation_id=operation;
 IF FOUND THEN
  IF old.workspace_id<>w OR old.evidence_id<>eid OR old.fingerprint<>fp THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  RETURN jsonb_build_object('id',eid,'revision',old.revision::text,'fingerprint',fp,'auditSequence',old.audit_sequence::text,'committed',true,'effectsVerified',false);
 END IF;
 IF EXISTS(SELECT 1 FROM garden_control.lifecycle_operation_registry WHERE operation_id=operation) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 SELECT * INTO h FROM garden_control.lifecycle_evidence_heads WHERE workspace_id=w AND evidence_id=eid FOR UPDATE;
 IF COALESCE(h.revision,0)<>rev-1 OR h.fingerprint IS DISTINCT FROM p->>'expectedFingerprint' OR EXISTS(SELECT 1 FROM garden_control.lifecycle_authority_evidence WHERE workspace_id=w AND evidence_id=eid AND revision>COALESCE(h.revision,0)) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF h.revision IS NOT NULL THEN
  SELECT * INTO STRICT prior FROM garden_control.lifecycle_authority_evidence WHERE workspace_id=w AND evidence_id=eid AND revision=h.revision;
  IF prior.record_id::text<>p#>>'{scope,recordId}' OR prior.record_revision::text<>p#>>'{scope,recordRevision}' OR prior.action<>p->>'action' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 END IF;
 point:=date_trunc('milliseconds',clock_timestamp());
 IF p->>'state'='verified' AND garden_control.lifecycle_control_time(p->>'reviewBy')<=point THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 INSERT INTO garden_control.lifecycle_operation_registry VALUES(operation,w,eid,'authority.evidence',fp);
 seq:=garden_control.append_audit_event(w,'subject',p_actor,'lifecycle-authority',eid::text,rev,'lifecycle.authority.evidence',operation);
 INSERT INTO garden_control.lifecycle_authority_evidence(workspace_id,evidence_id,revision,record_id,record_revision,classification,action,authority_kind,authority_reference,reviewer_reference,valid_from,expires_at,review_by,state,operation_id,fingerprint,previous_revision,previous_fingerprint,recorded_at,audit_sequence)
 VALUES(w,eid,rev,(p#>>'{scope,recordId}')::uuid,(p#>>'{scope,recordRevision}')::bigint,'restricted_research',p->>'action',p->>'authorityKind',(p->>'authorityReference')::uuid,(p->>'reviewerReference')::uuid,garden_control.lifecycle_control_time(p->>'validFrom'),garden_control.lifecycle_control_time(p->>'expiresAt'),garden_control.lifecycle_control_time(p->>'reviewBy'),p->>'state',operation,fp,h.revision,h.fingerprint,point,seq);
 INSERT INTO garden_control.lifecycle_evidence_heads VALUES(w,eid,rev,fp) ON CONFLICT(workspace_id,evidence_id) DO UPDATE SET revision=excluded.revision,fingerprint=excluded.fingerprint;
 RETURN jsonb_build_object('id',eid,'revision',rev::text,'fingerprint',fp,'auditSequence',seq::text,'committed',true,'effectsVerified',false);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;
CREATE FUNCTION garden_control.record_lifecycle_operator_grant(p jsonb,p_actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE w uuid; gid uuid; rev bigint; operation uuid; fp text; old garden_control.lifecycle_operator_grants%ROWTYPE; h garden_control.lifecycle_grant_heads%ROWTYPE; prior garden_control.lifecycle_operator_grants%ROWTYPE; e garden_control.lifecycle_authority_evidence%ROWTYPE; eh garden_control.lifecycle_evidence_heads%ROWTYPE; environment text; seq bigint; point timestamptz;
BEGIN
 PERFORM garden_control.lifecycle_control_json('grant',p);
 IF NOT garden_control.lifecycle_subject_valid(p_actor) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 w:=(p#>>'{scope,workspaceId}')::uuid;gid:=(p->>'grantId')::uuid;rev:=(p->>'revision')::bigint;operation:=(p->>'operationId')::uuid;
 fp:=garden_control.lifecycle_control_digest('garden-lifecycle-operator-grant-v1','{"maintainerId":'||to_json(p_actor)::text||',"command":'||garden_control.lifecycle_control_json('grant',p)||'}');
 PERFORM pg_advisory_xact_lock(144729,hashtext(w::text));
 SELECT b.environment INTO environment FROM garden_control.deployment_binding b WHERE b.singleton;
 PERFORM garden_control.lifecycle_deployment(w,environment);
 PERFORM pg_advisory_xact_lock(144740,hashtext(operation::text));
 SELECT * INTO old FROM garden_control.lifecycle_operator_grants WHERE operation_id=operation;
 IF FOUND THEN
  IF old.workspace_id<>w OR old.grant_id<>gid OR old.fingerprint<>fp THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  RETURN jsonb_build_object('id',gid,'revision',old.revision::text,'fingerprint',fp,'auditSequence',old.audit_sequence::text,'committed',true,'effectsVerified',false);
 END IF;
 IF EXISTS(SELECT 1 FROM garden_control.lifecycle_operation_registry WHERE operation_id=operation) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 SELECT * INTO h FROM garden_control.lifecycle_grant_heads WHERE workspace_id=w AND grant_id=gid FOR UPDATE;
 IF COALESCE(h.revision,0)<>rev-1 OR h.fingerprint IS DISTINCT FROM p->>'expectedFingerprint' OR EXISTS(SELECT 1 FROM garden_control.lifecycle_operator_grants WHERE workspace_id=w AND grant_id=gid AND revision>COALESCE(h.revision,0)) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF h.revision IS NOT NULL THEN
  SELECT * INTO STRICT prior FROM garden_control.lifecycle_operator_grants WHERE workspace_id=w AND grant_id=gid AND revision=h.revision;
  IF prior.subject_id<>p->>'subjectId' OR prior.record_id::text<>p#>>'{scope,recordId}' OR prior.record_revision::text<>p#>>'{scope,recordRevision}' OR prior.action<>p->>'action' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 END IF;
 SELECT * INTO eh FROM garden_control.lifecycle_evidence_heads WHERE workspace_id=w AND evidence_id=(p->>'evidenceId')::uuid FOR SHARE;
 SELECT * INTO e FROM garden_control.lifecycle_authority_evidence WHERE workspace_id=w AND evidence_id=(p->>'evidenceId')::uuid AND revision=(p->>'evidenceRevision')::bigint FOR SHARE;
 IF e.evidence_id IS NULL OR e.record_id::text<>p#>>'{scope,recordId}' OR e.record_revision::text<>p#>>'{scope,recordRevision}' OR e.action<>p->>'action' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 point:=date_trunc('milliseconds',clock_timestamp());
 IF p->>'state'='active' AND (eh.revision IS DISTINCT FROM e.revision OR EXISTS(SELECT 1 FROM garden_control.lifecycle_authority_evidence WHERE workspace_id=w AND evidence_id=e.evidence_id AND revision>e.revision) OR e.state<>'verified' OR e.review_by<=point OR garden_control.lifecycle_control_time(p->>'reviewBy')<=point) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 INSERT INTO garden_control.lifecycle_operation_registry VALUES(operation,w,gid,'authority.grant',fp);
 seq:=garden_control.append_audit_event(w,'subject',p_actor,'lifecycle-authority',gid::text,rev,'lifecycle.authority.grant',operation);
 INSERT INTO garden_control.lifecycle_operator_grants(workspace_id,grant_id,revision,subject_id,record_id,record_revision,classification,action,evidence_id,evidence_revision,valid_from,expires_at,review_by,state,operation_id,fingerprint,previous_revision,previous_fingerprint,recorded_at,audit_sequence)
 VALUES(w,gid,rev,p->>'subjectId',(p#>>'{scope,recordId}')::uuid,(p#>>'{scope,recordRevision}')::bigint,'restricted_research',p->>'action',e.evidence_id,e.revision,garden_control.lifecycle_control_time(p->>'validFrom'),garden_control.lifecycle_control_time(p->>'expiresAt'),garden_control.lifecycle_control_time(p->>'reviewBy'),p->>'state',operation,fp,h.revision,h.fingerprint,point,seq);
 INSERT INTO garden_control.lifecycle_grant_heads VALUES(w,gid,rev,fp) ON CONFLICT(workspace_id,grant_id) DO UPDATE SET revision=excluded.revision,fingerprint=excluded.fingerprint;
 RETURN jsonb_build_object('id',gid,'revision',rev::text,'fingerprint',fp,'auditSequence',seq::text,'committed',true,'effectsVerified',false);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;

CREATE FUNCTION garden_control.issue_lifecycle_control_ticket(p_workspace uuid,p_subject text,p_environment text,p_phase text,p_request jsonb,p_admission_deadline timestamptz,p_backend integer,p_transaction xid8) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE scope jsonb; intent jsonb; operation uuid; fp text; action text; token text; policy_token text; policy_expiry timestamptz; point timestamptz;
BEGIN
 IF NOT garden_control.lifecycle_subject_valid(p_subject) OR p_phase IS NULL OR p_phase NOT IN ('prepare','commit','status','recover') OR p_backend IS NULL OR p_backend<=0 OR p_transaction IS NULL OR p_request IS NULL OR octet_length(p_request::text)>262144 THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF p_phase='prepare' THEN
  IF NOT garden_control.lifecycle_exact(p_request,ARRAY['intent','fingerprint']) OR jsonb_typeof(p_request->'fingerprint') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  intent:=p_request->'intent';fp:=garden_control.lifecycle_control_intent_fingerprint(p_workspace,p_subject,intent);
  IF fp IS DISTINCT FROM p_request->>'fingerprint' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 ELSIF p_phase='commit' THEN
  fp:=garden_control.lifecycle_control_operation_fingerprint(p_workspace,p_subject,p_request);intent:=p_request->'intent';
 ELSE
  IF NOT garden_control.lifecycle_exact(p_request,ARRAY['scope','operationId','fingerprint']) OR jsonb_typeof(p_request->'operationId') IS DISTINCT FROM 'string' OR NOT garden_control.lifecycle_uuid_valid(p_request->>'operationId') OR jsonb_typeof(p_request->'fingerprint') IS DISTINCT FROM 'string' OR p_request->>'fingerprint' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  scope:=p_request->'scope';operation:=(p_request->>'operationId')::uuid;fp:=p_request->>'fingerprint';action:='lifecycle.inspect';
  IF p_phase='status' AND fp IS DISTINCT FROM garden_control.lifecycle_control_read_fingerprint(p_workspace,p_subject,scope,operation) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 END IF;
 IF intent IS NOT NULL THEN scope:=intent->'scope';operation:=(intent#>>'{command,operationId}')::uuid;action:=intent->>'action';END IF;
 PERFORM garden_control.lifecycle_control_json('scope',scope);
 IF scope->>'workspaceId' IS DISTINCT FROM p_workspace::text THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 PERFORM garden_control.lifecycle_deployment(p_workspace,p_environment);
 point:=clock_timestamp();
 IF p_admission_deadline IS NULL OR p_admission_deadline<=point OR p_admission_deadline>point+interval '5 minutes' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 -- This ordinary research token remains private to the fixed paired binder.
 -- It is never returned to an end user or accepted without the prebound token.
 policy_token:=garden_control.issue_policy_ticket(p_workspace,p_subject,'read',(scope->>'recordId')::uuid);
 SELECT expires_at INTO STRICT policy_expiry FROM garden_control.policy_tickets WHERE token_hash=sha256(convert_to(policy_token,'UTF8'));
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');point:=clock_timestamp();
 INSERT INTO garden_control.lifecycle_control_tickets(token_hash,policy_token_hash,workspace_id,subject_id,environment,phase,request,record_id,record_revision,action,operation_id,fingerprint,backend_pid,transaction_id,issued_at,expires_at,admission_deadline)
 VALUES(sha256(convert_to(token,'UTF8')),sha256(convert_to(policy_token,'UTF8')),p_workspace,p_subject,p_environment,p_phase,p_request,(scope->>'recordId')::uuid,(scope->>'recordRevision')::bigint,action,operation,fp,p_backend,p_transaction,point,LEAST(point+interval '30 seconds',policy_expiry,p_admission_deadline),p_admission_deadline);
 RETURN jsonb_build_object('ticket',token,'policyTicket',policy_token);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;
CREATE FUNCTION garden_control.bind_lifecycle_control_context(p_token text,p_policy_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_control_tickets%ROWTYPE; policy garden_control.policy_tickets%ROWTYPE;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' OR p_policy_token IS NULL OR p_policy_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 SELECT * INTO t FROM garden_control.lifecycle_control_tickets WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
 IF NOT FOUND OR t.used_at IS NOT NULL OR t.expires_at<=clock_timestamp() OR t.backend_pid<>pg_backend_pid() OR t.transaction_id<>pg_current_xact_id() OR t.policy_token_hash<>sha256(convert_to(p_policy_token,'UTF8')) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 -- Acquire the shared workspace lock before any research/control row lock.
 PERFORM pg_advisory_xact_lock(144729,hashtext(t.workspace_id::text));
 SELECT * INTO STRICT t FROM garden_control.lifecycle_control_tickets WHERE token_hash=t.token_hash FOR UPDATE;
 SELECT * INTO policy FROM garden_control.policy_tickets WHERE token_hash=t.policy_token_hash FOR UPDATE;
 IF t.used_at IS NOT NULL OR t.expires_at<=clock_timestamp() OR t.admission_deadline<=clock_timestamp() OR policy.token_hash IS NULL OR policy.workspace_id<>t.workspace_id OR policy.subject_id<>t.subject_id OR policy.action<>'read' OR policy.purpose<>'research' OR policy.record_scope IS DISTINCT FROM t.record_id OR policy.used_at IS NOT NULL OR policy.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 PERFORM garden_control.lifecycle_deployment(t.workspace_id,t.environment);
 PERFORM garden_control.bind_policy_context(p_policy_token);
 INSERT INTO garden_control.lifecycle_control_contexts(backend_pid,transaction_id,token_hash) VALUES(pg_backend_pid(),pg_current_xact_id(),t.token_hash);
 UPDATE garden_control.lifecycle_control_tickets SET used_at=clock_timestamp() WHERE token_hash=t.token_hash;
 IF t.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;
CREATE FUNCTION garden_control.invalidate_lifecycle_control_ticket(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE pair bytea;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 SELECT policy_token_hash INTO pair FROM garden_control.lifecycle_control_tickets WHERE token_hash=sha256(convert_to(p_token,'UTF8')) FOR UPDATE;
 DELETE FROM garden_control.lifecycle_control_contexts WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
 DELETE FROM garden_control.lifecycle_control_tickets WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
 DELETE FROM garden_control.policy_contexts WHERE token_hash=pair;
 DELETE FROM garden_control.policy_tickets WHERE token_hash=pair;
END $$;
CREATE FUNCTION garden_control.lifecycle_control_ticket(p_phase text,p_request jsonb,p_completed boolean DEFAULT false) RETURNS garden_control.lifecycle_control_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_control_tickets%ROWTYPE; c garden_control.lifecycle_control_contexts%ROWTYPE;
BEGIN
 SELECT * INTO c FROM garden_control.lifecycle_control_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id_if_assigned();
 IF NOT FOUND OR NOT p_completed AND (c.completed_at IS NOT NULL OR c.closed_at IS NOT NULL) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 SELECT * INTO STRICT t FROM garden_control.lifecycle_control_tickets WHERE token_hash=c.token_hash;
 IF t.backend_pid<>pg_backend_pid() OR t.transaction_id<>pg_current_xact_id() OR t.used_at IS NULL OR t.expires_at<=clock_timestamp() OR t.admission_deadline<=clock_timestamp() OR p_phase IS NOT NULL AND t.phase<>p_phase OR p_request IS NOT NULL AND t.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM garden_control.policy_contexts pc JOIN garden_control.policy_tickets pt ON pt.token_hash=pc.token_hash WHERE pc.backend_pid=pg_backend_pid() AND pc.transaction_id=pg_current_xact_id() AND pc.token_hash=t.policy_token_hash AND pt.workspace_id=t.workspace_id AND pt.subject_id=t.subject_id AND pt.record_scope=t.record_id AND pt.action='read' AND pt.purpose='research' AND pt.used_at IS NOT NULL AND pt.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 PERFORM garden_control.lifecycle_deployment(t.workspace_id,t.environment);RETURN t;
END $$;
CREATE FUNCTION garden_control.lifecycle_control_authority(p_ticket garden_control.lifecycle_control_tickets,p_grant uuid DEFAULT NULL,p_revision bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE g garden_control.lifecycle_operator_grants%ROWTYPE; e garden_control.lifecycle_authority_evidence%ROWTYPE; auth jsonb; point timestamptz; valid_from timestamptz; expires_at timestamptz;
BEGIN
 auth:=garden_control.encryption_authority(p_ticket.workspace_id,p_ticket.record_id,p_ticket.record_revision,'read');
 IF auth->>'actor' IS DISTINCT FROM p_ticket.subject_id THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144740,hashtext(p_ticket.operation_id::text));
 -- The workspace lock serializes missing heads and maintenance revisions;
 -- FOR SHARE additionally excludes non-key mutation by maintenance sessions.
 SELECT gr.* INTO g FROM garden_control.lifecycle_grant_heads gh JOIN garden_control.lifecycle_operator_grants gr USING(workspace_id,grant_id,revision)
  JOIN garden_control.lifecycle_evidence_heads eh ON eh.workspace_id=gr.workspace_id AND eh.evidence_id=gr.evidence_id AND eh.revision=gr.evidence_revision
  JOIN garden_control.lifecycle_authority_evidence ev ON ev.workspace_id=gr.workspace_id AND ev.evidence_id=gr.evidence_id AND ev.revision=gr.evidence_revision
  WHERE gr.workspace_id=p_ticket.workspace_id AND gr.subject_id=p_ticket.subject_id AND gr.record_id=p_ticket.record_id AND gr.record_revision=p_ticket.record_revision AND gr.action=p_ticket.action
   AND gr.classification='restricted_research' AND gr.state='active' AND ev.state='verified' AND ev.record_id=gr.record_id AND ev.record_revision=gr.record_revision AND ev.classification=gr.classification AND ev.action=gr.action
   AND (p_grant IS NULL OR gr.grant_id=p_grant) AND (p_revision IS NULL OR gr.revision=p_revision)
   AND gr.valid_from<=clock_timestamp() AND gr.review_by>clock_timestamp() AND ev.valid_from<=clock_timestamp() AND ev.review_by>clock_timestamp()
   AND NOT EXISTS(SELECT 1 FROM garden_control.lifecycle_operator_grants newer WHERE newer.workspace_id=gr.workspace_id AND newer.grant_id=gr.grant_id AND newer.revision>gr.revision)
   AND NOT EXISTS(SELECT 1 FROM garden_control.lifecycle_authority_evidence newer WHERE newer.workspace_id=ev.workspace_id AND newer.evidence_id=ev.evidence_id AND newer.revision>ev.revision)
  ORDER BY gr.grant_id LIMIT 1 FOR SHARE OF gh,gr,eh,ev;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 SELECT * INTO STRICT e FROM garden_control.lifecycle_authority_evidence WHERE workspace_id=g.workspace_id AND evidence_id=g.evidence_id AND revision=g.evidence_revision;
 point:=clock_timestamp();valid_from:=GREATEST(g.valid_from,e.valid_from);expires_at:=LEAST(g.expires_at,g.review_by,e.expires_at,e.review_by);
 IF point<valid_from OR point>=expires_at OR point>=p_ticket.expires_at OR point>=p_ticket.admission_deadline OR point>=(auth->>'expiresAt')::timestamptz OR NOT garden_control.consent_allows(p_ticket.workspace_id,p_ticket.record_id,'research',point) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 RETURN jsonb_build_object('grant',jsonb_build_object('grantId',g.grant_id,'revision',g.revision::text,'evidenceId',e.evidence_id,'evidenceRevision',e.revision::text,'validFrom',garden_control.lifecycle_control_iso(valid_from),'expiresAt',garden_control.lifecycle_control_iso(expires_at)),
  'expiresAt',garden_control.lifecycle_control_consent_deadline(p_ticket.workspace_id,p_ticket.record_id,point,LEAST(expires_at,p_ticket.expires_at,p_ticket.admission_deadline,(auth->>'expiresAt')::timestamptz)));
END $$;
CREATE FUNCTION garden_control.lifecycle_control_proof(p_ticket garden_control.lifecycle_control_tickets,p_grant jsonb,p_intent jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('workspaceId',p_ticket.workspace_id,'subjectId',p_ticket.subject_id,'action',p_ticket.action,'operationId',p_ticket.operation_id,'authorizationId',p_ticket.operation_id,
  'authorityEvidenceId',p_grant->>'evidenceId','authorityRevision',p_grant->>'revision','validFrom',p_grant->>'validFrom','expiresAt',p_grant->>'expiresAt',
  'commandFingerprint',garden_control.lifecycle_control_command_fingerprint(p_ticket.workspace_id,p_ticket.subject_id,p_ticket.action,p_intent->'command'))
$$;
CREATE FUNCTION garden_control.complete_lifecycle_control(p_authority jsonb,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 UPDATE garden_control.lifecycle_control_contexts SET grant_id=(p_authority#>>'{grant,grantId}')::uuid,grant_revision=(p_authority#>>'{grant,revision}')::bigint,evidence_id=(p_authority#>>'{grant,evidenceId}')::uuid,evidence_revision=(p_authority#>>'{grant,evidenceRevision}')::bigint,
  authority_expires_at=(p_authority->>'expiresAt')::timestamptz,result_fingerprint=garden_control.lifecycle_control_result_fingerprint(p_result),completed_at=clock_timestamp()
  WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id() AND completed_at IS NULL AND closed_at IS NULL;
 IF NOT FOUND OR (p_authority->>'expiresAt')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
END $$;

CREATE FUNCTION garden_control.lifecycle_control_consent_deadline(p_workspace uuid,p_record uuid,p_now timestamptz,p_cap timestamptz) RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE r record; subject jsonb; expiry timestamptz; result timestamptz:=p_cap; n integer:=0;
BEGIN
 IF p_now IS NULL OR p_cap IS NULL OR p_cap<=p_now OR NOT garden_control.consent_allows(p_workspace,p_record,'research',p_now) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 FOR r IN WITH RECURSIVE walk(id,path,cycle) AS (
  SELECT p_record,ARRAY[p_record],false UNION ALL
  SELECT d.input_id,w.path||d.input_id,d.input_id=ANY(w.path) FROM walk w JOIN garden_control.consent_dependencies d ON d.workspace_id=p_workspace AND d.derivative_id=w.id WHERE NOT w.cycle AND cardinality(w.path)<=32
 ) SELECT w.*,pr.policy FROM walk w LEFT JOIN garden_control.use_policy_heads h ON h.workspace_id=p_workspace AND h.record_id=w.id LEFT JOIN garden_control.use_policy_revisions pr ON pr.workspace_id=h.workspace_id AND pr.record_id=h.record_id AND pr.version=h.version LIMIT 257 LOOP
  n:=n+1;IF n>256 OR r.cycle OR cardinality(r.path)>32 OR r.policy IS NULL THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF r.policy->>'basis'='consent-required' THEN
   FOR subject IN SELECT * FROM jsonb_array_elements(r.policy->'subjects') LOOP
    SELECT max(LEAST((g.grant_record->>'expiresAt')::timestamptz,CASE WHEN g.grant_record->>'authority'='self' THEN p_cap ELSE (g.grant_record->>'authorityExpiresAt')::timestamptz END)) INTO expiry
     FROM garden_control.consent_grants g WHERE g.workspace_id=p_workspace AND g.record_id=r.id AND g.subject_id=subject->>'subjectId' AND g.purpose='research'
      AND g.terms_id=(r.policy#>>'{terms,id}')::uuid AND g.terms_version=(r.policy#>>'{terms,version}')::bigint AND g.terms_digest=r.policy#>>'{terms,digest}'
      AND g.grant_record->>'authority'=subject->>'authority' AND (g.grant_record->>'validFrom')::timestamptz<=p_now AND (g.grant_record->>'expiresAt')::timestamptz>p_now
      AND (cardinality(r.path)=1 OR g.grant_record->'derivativesAllowed'='true'::jsonb)
      AND (g.grant_record->>'authority'='self' OR (g.grant_record->>'authorityExpiresAt')::timestamptz>p_now)
      AND NOT EXISTS(SELECT 1 FROM garden_control.consent_withdrawals w WHERE w.grant_id=g.id);
    IF expiry IS NULL OR expiry<=p_now THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;result:=LEAST(result,expiry);
   END LOOP;
  END IF;
 END LOOP;
 IF n=0 THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;RETURN result;
END $$;
CREATE FUNCTION garden_control.lifecycle_control_canonical(p jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text; value jsonb; result text; first boolean:=true;
BEGIN
 IF p IS NULL THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF jsonb_typeof(p)='object' THEN
  result:='{';FOR k,value IN SELECT key,v FROM jsonb_each(p) AS j(key,v) ORDER BY key COLLATE "C" LOOP
   IF NOT first THEN result:=result||',';END IF;first:=false;result:=result||to_json(k)::text||':'||garden_control.lifecycle_control_canonical(value);
  END LOOP;RETURN result||'}';
 ELSIF jsonb_typeof(p)='array' THEN
  result:='[';FOR value IN SELECT v FROM jsonb_array_elements(p) WITH ORDINALITY AS j(v,n) ORDER BY n LOOP
   IF NOT first THEN result:=result||',';END IF;first:=false;result:=result||garden_control.lifecycle_control_canonical(value);
  END LOOP;RETURN result||']';
 END IF;
 RETURN p::text;
END $$;
CREATE FUNCTION garden_control.lifecycle_control_result_fingerprint(p jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT garden_control.lifecycle_control_digest('garden-lifecycle-control-result-v1',garden_control.lifecycle_control_canonical(p)) $$;

CREATE FUNCTION garden_control.lifecycle_control_snapshot(p_workspace uuid,p_control uuid,p_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE e garden_private.lifecycle_control_events%ROWTYPE; material garden_private.lifecycle_control_payloads%ROWTYPE; event jsonb; body jsonb; original jsonb; proof jsonb; actor text; computed text;
BEGIN
 SELECT * INTO STRICT e FROM garden_private.lifecycle_control_events WHERE workspace_id=p_workspace AND control_id=p_control AND revision=p_revision;
 SELECT * INTO STRICT material FROM garden_private.lifecycle_control_payloads WHERE workspace_id=p_workspace AND control_id=p_control AND revision=p_revision;
 body:=material.record-'fingerprint';computed:=garden_control.lifecycle_control_digest('garden-retention-v1'||chr(10)||CASE WHEN e.kind='retention-rule' THEN 'rule' ELSE 'hold' END,garden_control.lifecycle_control_json(CASE WHEN e.kind='retention-rule' THEN 'rule' ELSE 'hold' END,body));
 IF material.record->>'fingerprint' IS DISTINCT FROM e.record_fingerprint OR computed<>e.record_fingerprint THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 event:=CASE WHEN e.kind='retention-rule' THEN material.record->'event' WHEN e.action='lifecycle.hold-place' THEN material.record->'placement' ELSE material.record->'release' END;
 proof:=event->'authority';actor:=proof->>'subjectId';
 IF garden_control.lifecycle_control_operation_fingerprint(p_workspace,actor,material.operation)<>e.fingerprint OR material.operation->>'intentFingerprint'<>e.intent_fingerprint OR material.operation->>'proposalFingerprint'<>e.proposal_fingerprint OR material.operation->>'grantId'<>e.grant_id::text OR material.operation->>'grantRevision'<>e.grant_revision::text OR material.operation->'authority' IS DISTINCT FROM proof OR material.operation#>'{intent,command}' IS DISTINCT FROM event->'command' OR material.operation#>>'{intent,action}'<>e.action OR material.operation#>>'{intent,scope,workspaceId}'<>e.workspace_id::text OR material.operation#>>'{intent,scope,recordId}'<>e.record_id::text OR material.operation#>>'{intent,scope,recordRevision}'<>e.record_revision::text OR (material.operation#>>'{intent,expectedControlRevision}')::bigint<>e.control_revision-1 OR event->>'recordedAt' IS DISTINCT FROM garden_control.lifecycle_control_iso(e.recorded_at) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF e.kind='retention-rule' THEN
  IF event#>>'{command,ruleId}'<>e.control_id::text OR event#>>'{command,revision}'<>e.revision::text THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 ELSE
  original:=jsonb_build_object('schemaVersion',1,'kind','hold-record','revision','1','placement',material.record->'placement','release',NULL);
  IF material.record->>'revision'<>e.revision::text OR material.record#>>'{placement,command,holdId}'<>e.control_id::text THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  IF e.revision=2 AND (event#>>'{command,holdId}'<>e.control_id::text OR event#>>'{command,holdFingerprint}' IS DISTINCT FROM garden_control.lifecycle_control_digest('garden-retention-v1'||chr(10)||'hold',garden_control.lifecycle_control_json('hold',original)) OR event#>>'{command,operationId}'=material.record#>>'{placement,command,operationId}' OR (event->>'recordedAt')::timestamptz<(material.record#>>'{placement,recordedAt}')::timestamptz) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 END IF;
 RETURN jsonb_build_object('record',material.record,'operation',material.operation,'receipt',jsonb_build_object('operationId',e.operation_id,'fingerprint',e.fingerprint,'action',e.action,'scope',material.operation#>'{intent,scope}',
  'controlId',e.control_id,'revision',e.revision::text,'controlRevision',e.control_revision::text,'recordFingerprint',e.record_fingerprint,'auditSequence',e.audit_sequence::text,'recordedAt',garden_control.lifecycle_control_iso(e.recorded_at),'committed',true,'effectsVerified',false));
END $$;
CREATE FUNCTION garden_control.lifecycle_control_scope_snapshot(p_scope jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE w uuid; rid uuid; rev bigint; h garden_private.lifecycle_control_scope_heads%ROWTYPE; head garden_private.lifecycle_control_heads%ROWTYPE; item record; result jsonb:='[]'::jsonb; current_result jsonb; n integer:=0;
BEGIN
 PERFORM garden_control.lifecycle_control_json('scope',p_scope);w:=(p_scope->>'workspaceId')::uuid;rid:=(p_scope->>'recordId')::uuid;rev:=(p_scope->>'recordRevision')::bigint;
 SELECT * INTO h FROM garden_private.lifecycle_control_scope_heads WHERE workspace_id=w AND record_id=rid AND record_revision=rev FOR SHARE;
 IF EXISTS(SELECT 1 FROM garden_private.lifecycle_control_events WHERE workspace_id=w AND record_id=rid AND record_revision=rev AND control_revision>COALESCE(h.control_revision,0)) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 FOR item IN SELECT DISTINCT control_id FROM garden_private.lifecycle_control_events WHERE workspace_id=w AND record_id=rid AND record_revision=rev ORDER BY control_id LOOP
  n:=n+1;IF n>64 THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  SELECT * INTO head FROM garden_private.lifecycle_control_heads WHERE workspace_id=w AND control_id=item.control_id FOR SHARE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM garden_private.lifecycle_control_events WHERE workspace_id=w AND control_id=item.control_id AND revision>head.revision) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  current_result:=garden_control.lifecycle_control_snapshot(w,item.control_id,head.revision);
  IF current_result#>'{receipt,scope}' IS DISTINCT FROM p_scope OR current_result#>>'{record,fingerprint}'<>head.fingerprint THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  result:=result||jsonb_build_array(current_result->'record');
 END LOOP;
 IF (n=0 AND h.control_revision IS NOT NULL) OR (n>0 AND h.control_revision IS NULL) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 RETURN jsonb_build_object('scope',p_scope,'controlRevision',COALESCE(h.control_revision,0)::text,'records',result,'effectsVerified',false);
END $$;

CREATE FUNCTION garden_control.prepare_lifecycle_control(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_control_tickets%ROWTYPE; auth jsonb; intent jsonb; snapshot jsonb; current_record jsonb; result jsonb; old garden_private.lifecycle_control_events%ROWTYPE; target uuid;
BEGIN
 t:=garden_control.lifecycle_control_ticket('prepare',p);intent:=p->'intent';
 IF p->>'fingerprint' IS DISTINCT FROM garden_control.lifecycle_control_intent_fingerprint(t.workspace_id,t.subject_id,intent) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 auth:=garden_control.lifecycle_control_authority(t);
 SELECT * INTO old FROM garden_private.lifecycle_control_events WHERE operation_id=t.operation_id;
 IF FOUND THEN
  IF old.workspace_id<>t.workspace_id OR old.record_id<>t.record_id OR old.record_revision<>t.record_revision OR old.intent_fingerprint<>t.fingerprint OR old.action<>t.action THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  auth:=garden_control.lifecycle_control_authority(t,old.grant_id,old.grant_revision);
 ELSIF EXISTS(SELECT 1 FROM garden_control.lifecycle_operation_registry WHERE operation_id=t.operation_id) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 target:=COALESCE(intent#>>'{command,ruleId}',intent#>>'{command,holdId}')::uuid;
 snapshot:=garden_control.lifecycle_control_scope_snapshot(intent->'scope');
 SELECT r INTO current_record FROM jsonb_array_elements(snapshot->'records') r WHERE COALESCE(r#>>'{event,command,ruleId}',r#>>'{placement,command,holdId}')=target::text;
 IF current_record IS NOT NULL AND current_record->>'kind'<>(CASE WHEN t.action='lifecycle.retention-rule' THEN 'retention-rule' ELSE 'hold-record' END) OR current_record IS NULL AND EXISTS(SELECT 1 FROM garden_private.lifecycle_control_events WHERE workspace_id=t.workspace_id AND control_id=target) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 IF t.action='lifecycle.hold-release' AND current_record IS NULL THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 result:=jsonb_build_object('scope',intent->'scope','controlRevision',snapshot->>'controlRevision','current',current_record,'grant',auth->'grant','authority',garden_control.lifecycle_control_proof(t,auth->'grant',intent),'intentFingerprint',t.fingerprint);
 auth:=jsonb_set(auth,'{expiresAt}',to_jsonb(LEAST((auth->>'expiresAt')::timestamptz,(intent#>>'{command,reviewBy}')::timestamptz,COALESCE((intent#>>'{command,expiresAt}')::timestamptz,(auth->>'expiresAt')::timestamptz))));
 PERFORM garden_control.complete_lifecycle_control(auth,result);RETURN result;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;
CREATE FUNCTION garden_control.commit_lifecycle_control(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_control_tickets%ROWTYPE; auth jsonb; intent jsonb; command jsonb; proof jsonb; snapshot jsonb; current_record jsonb; result jsonb; body jsonb; event jsonb; old garden_private.lifecycle_control_events%ROWTYPE;
 target uuid; expected bigint; rev bigint; previous_rev bigint; previous_fp text; point timestamptz; record_fp text; kind text; seq bigint; final_record jsonb;
BEGIN
 t:=garden_control.lifecycle_control_ticket('commit',p);intent:=p->'intent';command:=intent->'command';
 IF garden_control.lifecycle_control_operation_fingerprint(t.workspace_id,t.subject_id,p)<>t.fingerprint THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 auth:=garden_control.lifecycle_control_authority(t,(p->>'grantId')::uuid,(p->>'grantRevision')::bigint);
 proof:=garden_control.lifecycle_control_proof(t,auth->'grant',intent);
 IF proof IS DISTINCT FROM p->'authority' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 auth:=jsonb_set(auth,'{expiresAt}',to_jsonb(LEAST((auth->>'expiresAt')::timestamptz,(command->>'reviewBy')::timestamptz,COALESCE((command->>'expiresAt')::timestamptz,(auth->>'expiresAt')::timestamptz))));
 SELECT * INTO old FROM garden_private.lifecycle_control_events WHERE operation_id=t.operation_id;
 IF FOUND THEN
  IF old.workspace_id<>t.workspace_id OR old.record_id<>t.record_id OR old.record_revision<>t.record_revision OR old.fingerprint<>t.fingerprint OR old.action<>t.action THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  result:=garden_control.lifecycle_control_snapshot(old.workspace_id,old.control_id,old.revision);
  IF result->'operation' IS DISTINCT FROM p THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  PERFORM garden_control.complete_lifecycle_control(auth,result);RETURN result;
 END IF;
 IF EXISTS(SELECT 1 FROM garden_control.lifecycle_operation_registry WHERE operation_id=t.operation_id) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 snapshot:=garden_control.lifecycle_control_scope_snapshot(intent->'scope');expected:=(intent->>'expectedControlRevision')::bigint;
 IF snapshot->>'controlRevision'<>expected::text OR expected=9223372036854775807 THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 target:=COALESCE(command->>'ruleId',command->>'holdId')::uuid;
 SELECT r INTO current_record FROM jsonb_array_elements(snapshot->'records') r WHERE COALESCE(r#>>'{event,command,ruleId}',r#>>'{placement,command,holdId}')=target::text;
 -- A control identity is fixed to its original scope even when not visible in
 -- this scope snapshot. Missing current heads/payload cannot be re-created.
 IF current_record IS NULL AND EXISTS(SELECT 1 FROM garden_private.lifecycle_control_events WHERE workspace_id=t.workspace_id AND control_id=target) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 -- Reserve a bounded owned-response budget even if all 64 holds acquire a
 -- release event later. Revisions/releases remain possible at this capacity.
 IF current_record IS NULL AND jsonb_array_length(snapshot->'records')>=64 THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 previous_fp:=current_record->>'fingerprint';previous_rev:=CASE WHEN current_record IS NULL THEN NULL WHEN current_record->>'kind'='retention-rule' THEN (current_record#>>'{event,command,revision}')::bigint ELSE (current_record->>'revision')::bigint END;
 IF previous_fp IS DISTINCT FROM intent->>'expectedFingerprint' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 point:=date_trunc('milliseconds',clock_timestamp());
 IF (auth->>'expiresAt')::timestamptz<=point THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 event:=jsonb_build_object('command',command,'recordedAt',garden_control.lifecycle_control_iso(point),'authority',proof);
 IF t.action='lifecycle.retention-rule' THEN
  rev:=(command->>'revision')::bigint;kind:='retention-rule';
  IF rev<>COALESCE(previous_rev,0)+1 OR current_record IS NOT NULL AND current_record->>'kind'<>kind THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  body:=jsonb_build_object('schemaVersion',1,'kind',kind,'event',event);
 ELSIF t.action='lifecycle.hold-place' THEN
  IF current_record IS NOT NULL THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  rev:=1;kind:='hold-record';body:=jsonb_build_object('schemaVersion',1,'kind',kind,'revision','1','placement',event,'release',NULL);
 ELSE
  IF current_record IS NULL OR current_record->>'kind'<>'hold-record' OR current_record->>'revision'<>'1' OR current_record->'release'<>'null'::jsonb OR command->>'holdFingerprint' IS DISTINCT FROM previous_fp OR command->>'operationId'=current_record#>>'{placement,command,operationId}' OR point<(current_record#>>'{placement,recordedAt}')::timestamptz THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
  rev:=2;kind:='hold-record';body:=jsonb_build_object('schemaVersion',1,'kind',kind,'revision','2','placement',current_record->'placement','release',event);
 END IF;
 record_fp:=garden_control.lifecycle_control_digest('garden-retention-v1'||chr(10)||CASE WHEN kind='retention-rule' THEN 'rule' ELSE 'hold' END,garden_control.lifecycle_control_json(CASE WHEN kind='retention-rule' THEN 'rule' ELSE 'hold' END,body));
 final_record:=body||jsonb_build_object('fingerprint',record_fp);
 INSERT INTO garden_control.lifecycle_operation_registry VALUES(t.operation_id,t.workspace_id,target,t.action,t.fingerprint);
 seq:=garden_control.append_audit_event(t.workspace_id,'subject',t.subject_id,'lifecycle-control',target::text,rev,CASE t.action WHEN 'lifecycle.retention-rule' THEN 'lifecycle.control.rule' WHEN 'lifecycle.hold-place' THEN 'lifecycle.control.hold-place' ELSE 'lifecycle.control.hold-release' END,t.operation_id);
 INSERT INTO garden_private.lifecycle_control_events(workspace_id,record_id,record_revision,control_id,revision,control_revision,kind,action,operation_id,fingerprint,record_fingerprint,intent_fingerprint,proposal_fingerprint,grant_id,grant_revision,previous_revision,previous_fingerprint,recorded_at,admission_expires_at,audit_sequence)
 VALUES(t.workspace_id,t.record_id,t.record_revision,target,rev,expected+1,kind,t.action,t.operation_id,t.fingerprint,record_fp,p->>'intentFingerprint',p->>'proposalFingerprint',(p->>'grantId')::uuid,(p->>'grantRevision')::bigint,previous_rev,previous_fp,point,(auth->>'expiresAt')::timestamptz,seq);
 INSERT INTO garden_private.lifecycle_control_payloads VALUES(t.workspace_id,target,rev,final_record,p);
 INSERT INTO garden_private.lifecycle_control_heads VALUES(t.workspace_id,target,rev,record_fp) ON CONFLICT(workspace_id,control_id) DO UPDATE SET revision=excluded.revision,fingerprint=excluded.fingerprint;
 INSERT INTO garden_private.lifecycle_control_scope_heads VALUES(t.workspace_id,t.record_id,t.record_revision,expected+1,t.fingerprint) ON CONFLICT(workspace_id,record_id,record_revision) DO UPDATE SET control_revision=excluded.control_revision,fingerprint=excluded.fingerprint;
 result:=garden_control.lifecycle_control_snapshot(t.workspace_id,target,rev);
 PERFORM garden_control.complete_lifecycle_control(auth,result);RETURN result;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;
CREATE FUNCTION garden_control.lifecycle_control_status(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_control_tickets%ROWTYPE; auth jsonb; result jsonb;
BEGIN
 t:=garden_control.lifecycle_control_ticket('status',p);
 IF t.fingerprint IS DISTINCT FROM garden_control.lifecycle_control_read_fingerprint(t.workspace_id,t.subject_id,p->'scope',t.operation_id) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 auth:=garden_control.lifecycle_control_authority(t);result:=garden_control.lifecycle_control_scope_snapshot(p->'scope');
 PERFORM garden_control.complete_lifecycle_control(auth,result);RETURN result;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;
CREATE FUNCTION garden_control.recover_lifecycle_control(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_control_tickets%ROWTYPE; auth jsonb; old garden_private.lifecycle_control_events%ROWTYPE; result jsonb;
BEGIN
 t:=garden_control.lifecycle_control_ticket('recover',p);auth:=garden_control.lifecycle_control_authority(t);
 SELECT * INTO old FROM garden_private.lifecycle_control_events WHERE operation_id=t.operation_id AND fingerprint=t.fingerprint AND workspace_id=t.workspace_id AND record_id=t.record_id AND record_revision=t.record_revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 -- Recovery reads the immutable operation version, never the current head as
 -- an invented replacement for an earlier successful placement/rule revision.
 result:=garden_control.lifecycle_control_snapshot(old.workspace_id,old.control_id,old.revision);
 IF result#>>'{operation,authority,subjectId}' IS DISTINCT FROM t.subject_id OR result#>'{receipt,scope}' IS DISTINCT FROM p->'scope' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 PERFORM garden_control.complete_lifecycle_control(auth,result);RETURN result;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;

CREATE FUNCTION garden_control.check_lifecycle_control_context() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_control_tickets%ROWTYPE; c garden_control.lifecycle_control_contexts%ROWTYPE; auth jsonb;
BEGIN
 t:=garden_control.lifecycle_control_ticket(NULL,NULL,true);
 SELECT * INTO STRICT c FROM garden_control.lifecycle_control_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id();
 IF c.completed_at IS NULL OR c.authority_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 auth:=garden_control.lifecycle_control_authority(t,c.grant_id,c.grant_revision);
 IF auth#>>'{grant,evidenceId}'<>c.evidence_id::text OR auth#>>'{grant,evidenceRevision}'<>c.evidence_revision::text OR c.authority_expires_at<=clock_timestamp() OR (auth->>'expiresAt')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;RETURN true;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;
CREATE FUNCTION garden_control.lifecycle_control_delivery() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE c garden_control.lifecycle_control_contexts%ROWTYPE;
BEGIN
 PERFORM garden_control.check_lifecycle_control_context();
 SELECT * INTO STRICT c FROM garden_control.lifecycle_control_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id() AND completed_at IS NOT NULL AND closed_at IS NULL;
 RETURN jsonb_build_object('expiresAt',garden_control.lifecycle_control_iso(c.authority_expires_at),'resultFingerprint',c.result_fingerprint);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;
CREATE FUNCTION garden_control.clear_lifecycle_control_context() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 PERFORM garden_control.check_lifecycle_control_context();
 -- Keep the exact paired policy context until COMMIT freshness has run. It is
 -- retired by the issuer only after this transaction releases all row locks.
 UPDATE garden_control.lifecycle_control_contexts SET closed_at=clock_timestamp() WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id() AND completed_at IS NOT NULL AND closed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
END $$;
CREATE FUNCTION garden_control.lifecycle_control_commit_fresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id() OR NOT EXISTS(SELECT 1 FROM garden_control.lifecycle_control_contexts WHERE backend_pid=NEW.backend_pid AND transaction_id=NEW.transaction_id AND completed_at IS NOT NULL AND closed_at IS NOT NULL) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 PERFORM garden_control.check_lifecycle_control_context();RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER lifecycle_control_commit_fresh AFTER INSERT ON garden_control.lifecycle_control_contexts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_control.lifecycle_control_commit_fresh();
CREATE FUNCTION garden_control.lifecycle_control_delivery_fresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 -- Current research/grant/evidence rows and the workspace advisory lock remain
 -- held from final validation until this fixed transaction commits.
 IF NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id() OR NEW.expires_at<=clock_timestamp() OR NOT garden_control.consent_allows(NEW.workspace_id,NEW.record_id,'research',clock_timestamp()) THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER lifecycle_control_delivery_fresh AFTER INSERT ON garden_control.lifecycle_control_delivery_checks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_control.lifecycle_control_delivery_fresh();
CREATE FUNCTION garden_control.finish_lifecycle_control_delivery(p_token text,p_result_fingerprint text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.lifecycle_control_tickets%ROWTYPE; c garden_control.lifecycle_control_contexts%ROWTYPE; auth jsonb; fresh_policy text; expiry timestamptz;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' OR p_result_fingerprint IS NULL OR p_result_fingerprint !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 SELECT * INTO t FROM garden_control.lifecycle_control_tickets WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
 IF NOT FOUND OR t.used_at IS NULL OR t.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(t.workspace_id::text));
 SELECT * INTO STRICT t FROM garden_control.lifecycle_control_tickets WHERE token_hash=t.token_hash FOR UPDATE;
 SELECT * INTO c FROM garden_control.lifecycle_control_contexts WHERE token_hash=t.token_hash FOR UPDATE;
 IF NOT FOUND OR c.backend_pid<>t.backend_pid OR c.transaction_id<>t.transaction_id OR c.completed_at IS NULL OR c.closed_at IS NULL OR c.result_fingerprint<>p_result_fingerprint OR c.authority_expires_at<=clock_timestamp() OR t.expires_at<=clock_timestamp() OR t.admission_deadline<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 PERFORM garden_control.lifecycle_deployment(t.workspace_id,t.environment);
 -- One fixed validation/retirement transaction, not a recursive repository
 -- read. The fresh policy token never leaves this owner-defined function.
 fresh_policy:=garden_control.issue_policy_ticket(t.workspace_id,t.subject_id,'read',t.record_id);
 PERFORM garden_control.bind_policy_context(fresh_policy);
 auth:=garden_control.lifecycle_control_authority(t,c.grant_id,c.grant_revision);
 IF auth#>>'{grant,evidenceId}'<>c.evidence_id::text OR auth#>>'{grant,evidenceRevision}'<>c.evidence_revision::text THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 expiry:=LEAST(c.authority_expires_at,(auth->>'expiresAt')::timestamptz);
 INSERT INTO garden_control.lifecycle_control_delivery_checks VALUES(pg_backend_pid(),pg_current_xact_id(),t.workspace_id,t.record_id,expiry);
 PERFORM garden_control.invalidate_lifecycle_control_ticket(p_token);
 PERFORM garden_control.invalidate_policy_ticket(fresh_policy);
 DELETE FROM garden_control.lifecycle_control_delivery_checks WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id();
 IF expiry<=clock_timestamp() THEN RAISE EXCEPTION 'Lifecycle control unavailable'; END IF;
 RETURN jsonb_build_object('expiresAt',garden_control.lifecycle_control_iso(expiry),'resultFingerprint',p_result_fingerprint);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Lifecycle control unavailable';
END $$;

-- Preserve all prior audit cases, serialization and existing execute ACLs.
CREATE OR REPLACE FUNCTION garden_control.append_audit_event(p_workspace uuid,p_actor_kind text,p_actor text,p_subject_kind text,p_subject text,p_version bigint,p_action text,p_request uuid DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE h garden_control.audit_heads%ROWTYPE; actor_ref uuid; subject_ref uuid; request_ref uuid; expected_kind text; outcome text:='succeeded'; reason text; e jsonb; serialized text; digest text;
BEGIN
 IF p_workspace IS NULL OR (p_version IS NOT NULL AND p_version<=0) THEN RAISE EXCEPTION 'Audit event unavailable'; END IF;
 CASE p_action
  WHEN 'lifecycle.authority.evidence' THEN expected_kind:='lifecycle-authority';reason:='authority-evidence-recorded';
  WHEN 'lifecycle.authority.grant' THEN expected_kind:='lifecycle-authority';reason:='operator-grant-recorded';
  WHEN 'lifecycle.control.rule' THEN expected_kind:='lifecycle-control';reason:='retention-rule-recorded';
  WHEN 'lifecycle.control.hold-place' THEN expected_kind:='lifecycle-control';reason:='hold-recorded';
  WHEN 'lifecycle.control.hold-release' THEN expected_kind:='lifecycle-control';reason:='hold-release-recorded';
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

-- Functions are the complete SQL capability surface. Neither runtime may
-- self-provision evidence/grants or directly read private/control tables.
DO $functions$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='garden_control' AND p.proname=ANY(ARRAY[
  'register_lifecycle_request_operation','lifecycle_control_time','lifecycle_control_iso','lifecycle_control_revision','lifecycle_control_json','lifecycle_control_digest',
  'lifecycle_control_intent_fingerprint','lifecycle_control_command_fingerprint','lifecycle_control_operation_fingerprint','lifecycle_control_read_fingerprint',
  'record_lifecycle_evidence','record_lifecycle_operator_grant','issue_lifecycle_control_ticket','bind_lifecycle_control_context','invalidate_lifecycle_control_ticket',
  'lifecycle_control_ticket','lifecycle_control_authority','lifecycle_control_proof','complete_lifecycle_control','lifecycle_control_consent_deadline',
  'lifecycle_control_canonical','lifecycle_control_result_fingerprint','lifecycle_control_snapshot','lifecycle_control_scope_snapshot',
  'prepare_lifecycle_control','commit_lifecycle_control','lifecycle_control_status','recover_lifecycle_control','check_lifecycle_control_context','lifecycle_control_delivery','clear_lifecycle_control_context',
  'lifecycle_control_commit_fresh','lifecycle_control_delivery_fresh','finish_lifecycle_control_delivery'
 ]) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,garden_public,garden_research,garden_publisher,garden_worker,garden_context_issuer,garden_membership_admin,garden_consent_admin,garden_audit_reader,garden_audit_writer,garden_encryption,garden_lifecycle_requester,garden_lifecycle_admin',f.oid::regprocedure);
 END LOOP;
END $functions$;
GRANT EXECUTE ON FUNCTION garden_control.issue_lifecycle_control_ticket(uuid,text,text,text,jsonb,timestamptz,integer,xid8),garden_control.invalidate_lifecycle_control_ticket(text),garden_control.finish_lifecycle_control_delivery(text,text) TO garden_context_issuer;
GRANT EXECUTE ON FUNCTION garden_control.bind_lifecycle_control_context(text,text),garden_control.prepare_lifecycle_control(jsonb),garden_control.commit_lifecycle_control(jsonb),garden_control.lifecycle_control_status(jsonb),garden_control.recover_lifecycle_control(jsonb),garden_control.check_lifecycle_control_context(),garden_control.lifecycle_control_delivery(),garden_control.clear_lifecycle_control_context() TO garden_lifecycle_admin;
-- The trusted host fixes transaction statements and explicitly defers these
-- triggers. Arbitrary SQL logins can change constraint timing; this is not an
-- unchangeable guarantee against a compromised privileged SQL connection.
RESET ROLE;
