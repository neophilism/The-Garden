-- Purpose-specific consent is separate from access grants, rights and publication.
-- Existing records WITHOUT an explicit use policy fail closed; no consent backfill.
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_consent_admin') THEN
  CREATE ROLE garden_consent_admin NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_consent_admin' AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Unsafe consent administrator'; END IF;
 EXECUTE format('GRANT garden_consent_admin TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $role$;
SET LOCAL ROLE garden_migrator;
GRANT USAGE ON SCHEMA garden_control TO garden_consent_admin,garden_publisher,garden_worker;
CREATE TABLE garden_control.consent_terms (
 id uuid NOT NULL, version bigint NOT NULL CHECK(version>0), digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 recorded_by text NOT NULL CHECK(length(recorded_by) BETWEEN 1 AND 128), recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(id,version), UNIQUE(id,version,digest)
);
CREATE TABLE garden_control.use_policy_revisions (
 workspace_id uuid NOT NULL, record_id uuid NOT NULL, version bigint NOT NULL CHECK(version>0),
 policy jsonb NOT NULL, recorded_by text NOT NULL CHECK(length(recorded_by) BETWEEN 1 AND 128),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(workspace_id,record_id,version),
 FOREIGN KEY(workspace_id,record_id) REFERENCES garden_private.record_envelopes(workspace_id,id)
);
CREATE TABLE garden_control.use_policy_heads (
 workspace_id uuid NOT NULL, record_id uuid NOT NULL, version bigint NOT NULL,
 PRIMARY KEY(workspace_id,record_id), FOREIGN KEY(workspace_id,record_id,version) REFERENCES garden_control.use_policy_revisions(workspace_id,record_id,version)
);
CREATE TABLE garden_control.consent_dependencies (
 workspace_id uuid NOT NULL, derivative_id uuid NOT NULL, input_id uuid NOT NULL,
 PRIMARY KEY(workspace_id,derivative_id,input_id), CHECK(derivative_id<>input_id),
 FOREIGN KEY(workspace_id,derivative_id) REFERENCES garden_private.record_envelopes(workspace_id,id),
 FOREIGN KEY(workspace_id,input_id) REFERENCES garden_private.record_envelopes(workspace_id,id)
);
CREATE TABLE garden_control.consent_grants (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, record_id uuid NOT NULL, subject_id text NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('preservation','research','public-display','name-attribution','promotional-endorsement')),
 terms_id uuid NOT NULL, terms_version bigint NOT NULL, terms_digest text NOT NULL,
 grant_record jsonb NOT NULL, recorded_by text NOT NULL CHECK(length(recorded_by) BETWEEN 1 AND 128),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(workspace_id,record_id) REFERENCES garden_private.record_envelopes(workspace_id,id),
 FOREIGN KEY(terms_id,terms_version,terms_digest) REFERENCES garden_control.consent_terms(id,version,digest)
);
CREATE INDEX consent_grant_lookup ON garden_control.consent_grants(workspace_id,record_id,subject_id,purpose);
CREATE TABLE garden_control.consent_withdrawals (
 grant_id uuid PRIMARY KEY REFERENCES garden_control.consent_grants(id),
 recorded_by text NOT NULL CHECK(length(recorded_by) BETWEEN 1 AND 128), reason_digest text NOT NULL CHECK(reason_digest ~ '^[a-f0-9]{64}$'),
 withdrawn_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE garden_control.use_receipts (
 request_id uuid PRIMARY KEY, workspace_id uuid NOT NULL, record_id uuid NOT NULL,
 purposes text[] NOT NULL, admitted_at timestamptz NOT NULL, policy_revisions jsonb NOT NULL,
 FOREIGN KEY(workspace_id,record_id) REFERENCES garden_private.record_envelopes(workspace_id,id)
);
REVOKE ALL ON garden_control.consent_terms,garden_control.use_policy_revisions,garden_control.use_policy_heads,garden_control.consent_dependencies,garden_control.consent_grants,garden_control.consent_withdrawals,garden_control.use_receipts FROM PUBLIC,garden_research,garden_worker,garden_public,garden_publisher,garden_context_issuer,garden_consent_admin;
CREATE FUNCTION garden_control.consent_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Consent history is append-only'; END $$;
CREATE TRIGGER immutable_terms BEFORE UPDATE OR DELETE ON garden_control.consent_terms FOR EACH ROW EXECUTE FUNCTION garden_control.consent_immutable();
CREATE TRIGGER immutable_use_policy BEFORE UPDATE OR DELETE ON garden_control.use_policy_revisions FOR EACH ROW EXECUTE FUNCTION garden_control.consent_immutable();
CREATE TRIGGER immutable_consent_dependencies BEFORE UPDATE OR DELETE ON garden_control.consent_dependencies FOR EACH ROW EXECUTE FUNCTION garden_control.consent_immutable();
CREATE TRIGGER immutable_grants BEFORE UPDATE OR DELETE ON garden_control.consent_grants FOR EACH ROW EXECUTE FUNCTION garden_control.consent_immutable();
CREATE TRIGGER immutable_withdrawals BEFORE UPDATE OR DELETE ON garden_control.consent_withdrawals FOR EACH ROW EXECUTE FUNCTION garden_control.consent_immutable();
CREATE TRIGGER immutable_use_receipts BEFORE UPDATE OR DELETE ON garden_control.use_receipts FOR EACH ROW EXECUTE FUNCTION garden_control.consent_immutable();
CREATE FUNCTION garden_control.use_purpose_valid(p text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT COALESCE(p IN ('preservation','research','public-display','name-attribution','promotional-endorsement'),false)
$$;
CREATE FUNCTION garden_control.consent_policy_valid(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE item jsonb; b text; q jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR NOT p ?& ARRAY['schemaVersion','recordId','basis','inputs','terms','subjects','purposes','reasonDigest'] OR p-ARRAY['schemaVersion','recordId','basis','inputs','terms','subjects','purposes','reasonDigest']<>'{}'::jsonb
 OR p->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR NOT COALESCE(p->>'recordId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
 OR NOT COALESCE(p->>'reasonDigest' ~ '^[a-f0-9]{64}$',false) OR octet_length(p::text)>16384 THEN RETURN false; END IF;
 b:=p->>'basis';IF NOT COALESCE(b IN ('unreviewed','consent-required','no-consent-required','inherits-only'),false) THEN RETURN false; END IF;
 IF jsonb_typeof(p->'inputs') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'subjects') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'purposes') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p->'inputs')>32 OR jsonb_array_length(p->'subjects')>16 OR jsonb_array_length(p->'purposes')>5 THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'inputs') e GROUP BY e HAVING count(*)>1) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'purposes') e GROUP BY e HAVING count(*)>1) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'subjects') e GROUP BY e->>'subjectId' HAVING count(*)>1) THEN RETURN false; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p->'inputs') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR NOT COALESCE(item#>>'{}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) OR item#>>'{}'=p->>'recordId' THEN RETURN false; END IF;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p->'purposes') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR NOT garden_control.use_purpose_valid(item#>>'{}') THEN RETURN false; END IF;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p->'subjects') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT item ?& ARRAY['subjectId','authority'] OR item-ARRAY['subjectId','authority']<>'{}'::jsonb OR NOT garden_control.historical_text_valid(item->'subjectId',128,false) OR NOT COALESCE(item->>'authority' IN ('self','guardian'),false) THEN RETURN false; END IF;
 END LOOP;
 IF b='consent-required' THEN
  q:=p->'terms';IF jsonb_array_length(p->'subjects')=0 OR jsonb_array_length(p->'purposes')<>0 OR jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT q ?& ARRAY['id','version','digest'] OR q-ARRAY['id','version','digest']<>'{}'::jsonb
   OR NOT COALESCE(q->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) OR NOT garden_control.exact_revision_valid(q->'version') OR NOT COALESCE(q->>'digest' ~ '^[a-f0-9]{64}$',false) THEN RETURN false; END IF;
 ELSIF p->'terms' IS DISTINCT FROM 'null'::jsonb OR jsonb_array_length(p->'subjects')<>0 THEN RETURN false; END IF;
 IF b='no-consent-required' THEN
  IF jsonb_array_length(p->'purposes')=0 OR p->'purposes' ? 'promotional-endorsement' THEN RETURN false; END IF;
 ELSIF jsonb_array_length(p->'purposes')<>0 THEN RETURN false; END IF;
 IF b='inherits-only' AND jsonb_array_length(p->'inputs')=0 THEN RETURN false; END IF;
 RETURN true;
END $$;
CREATE FUNCTION garden_control.consent_grant_valid(g jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog SET timezone='UTC' AS $$
DECLARE p jsonb; field text; t jsonb;
BEGIN
 IF jsonb_typeof(g) IS DISTINCT FROM 'object' OR NOT g ?& ARRAY['schemaVersion','id','recordId','subjectId','grantorId','authority','authorityDigest','authorityExpiresAt','terms','purpose','derivativesAllowed','validFrom','expiresAt','evidenceDigest'] OR g-ARRAY['schemaVersion','id','recordId','subjectId','grantorId','authority','authorityDigest','authorityExpiresAt','terms','purpose','derivativesAllowed','validFrom','expiresAt','evidenceDigest']<>'{}'::jsonb OR g->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR octet_length(g::text)>8192 THEN RETURN false; END IF;
 FOREACH field IN ARRAY ARRAY['id','recordId'] LOOP
  IF jsonb_typeof(g->field) IS DISTINCT FROM 'string' OR NOT COALESCE(g->>field ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) THEN RETURN false; END IF;
 END LOOP;
 IF NOT garden_control.historical_text_valid(g->'subjectId',128,false) OR NOT garden_control.historical_text_valid(g->'grantorId',128,false) OR NOT garden_control.use_purpose_valid(g->>'purpose') OR jsonb_typeof(g->'derivativesAllowed') IS DISTINCT FROM 'boolean' OR NOT COALESCE(g->>'evidenceDigest' ~ '^[a-f0-9]{64}$',false) THEN RETURN false; END IF;
 p:=jsonb_build_object('schemaVersion',1,'recordId',g->'recordId','basis','consent-required','inputs','[]'::jsonb,'terms',g->'terms','subjects',jsonb_build_array(jsonb_build_object('subjectId',g->'subjectId','authority',g->'authority')),'purposes','[]'::jsonb,'reasonDigest',g->'evidenceDigest');
 IF NOT garden_control.consent_policy_valid(p) THEN RETURN false; END IF;
 FOREACH field IN ARRAY ARRAY['validFrom','expiresAt'] LOOP
  IF jsonb_typeof(g->field) IS DISTINCT FROM 'string' OR NOT COALESCE(g->>field ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$',false) THEN RETURN false; END IF;
  PERFORM (g->>field)::timestamptz;
 END LOOP;
 IF (g->>'expiresAt')::timestamptz<=(g->>'validFrom')::timestamptz THEN RETURN false; END IF;
 IF g->>'authority'='self' THEN
  IF g->>'grantorId' IS DISTINCT FROM g->>'subjectId' OR g->'authorityDigest' IS DISTINCT FROM 'null'::jsonb OR g->'authorityExpiresAt' IS DISTINCT FROM 'null'::jsonb THEN RETURN false; END IF;
 ELSE
  IF g->>'grantorId'=g->>'subjectId' OR NOT COALESCE(g->>'authorityDigest' ~ '^[a-f0-9]{64}$',false) OR jsonb_typeof(g->'authorityExpiresAt') IS DISTINCT FROM 'string' OR NOT COALESCE(g->>'authorityExpiresAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$',false) OR (g->>'authorityExpiresAt')::timestamptz<=(g->>'validFrom')::timestamptz THEN RETURN false; END IF;
 END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE garden_control.use_policy_revisions ADD CONSTRAINT use_policy_shape CHECK(garden_control.consent_policy_valid(policy) AND policy->>'recordId'=record_id::text);
ALTER TABLE garden_control.consent_grants ADD CONSTRAINT consent_grant_shape CHECK(garden_control.consent_grant_valid(grant_record) AND grant_record->>'id'=id::text AND grant_record->>'recordId'=record_id::text AND grant_record->>'subjectId'=subject_id AND grant_record->>'purpose'=purpose AND grant_record#>>'{terms,id}'=terms_id::text AND grant_record#>>'{terms,version}'=terms_version::text AND grant_record#>>'{terms,digest}'=terms_digest);
CREATE FUNCTION garden_control.register_consent_terms(p_id uuid,p_version bigint,p_digest text,p_actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF p_id IS NULL OR p_version IS NULL OR p_version<1 OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$' OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Consent terms unavailable'; END IF;
 INSERT INTO garden_control.consent_terms(id,version,digest,recorded_by) VALUES(p_id,p_version,p_digest,p_actor);
END $$;
CREATE FUNCTION garden_control.set_use_policy(p_workspace uuid,p_policy jsonb,p_expected bigint,p_actor text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE rid uuid; old jsonb; v bigint; item jsonb; ids uuid[]; count_nodes integer; cyclic boolean;
BEGIN
 IF p_workspace IS NULL OR NOT garden_control.consent_policy_valid(p_policy) OR p_expected IS NULL OR p_expected<0 OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Use policy unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(p_workspace::text));rid:=(p_policy->>'recordId')::uuid;
 SELECT h.version,r.policy INTO v,old FROM garden_control.use_policy_heads h JOIN garden_control.use_policy_revisions r USING(workspace_id,record_id,version) WHERE h.workspace_id=p_workspace AND h.record_id=rid;
 IF COALESCE(v,0)<>p_expected THEN RAISE EXCEPTION 'Use policy changed'; END IF;
 IF old IS NOT NULL THEN
  IF NOT (p_policy->'inputs') @> (old->'inputs') THEN RAISE EXCEPTION 'Derivative limits cannot be removed'; END IF;
  IF old->>'basis'='consent-required' THEN
   IF p_policy->>'basis'<>'consent-required' OR p_policy#>>'{terms,id}' IS DISTINCT FROM old#>>'{terms,id}' OR (p_policy#>>'{terms,version}')::bigint<(old#>>'{terms,version}')::bigint OR EXISTS(SELECT 1 FROM jsonb_array_elements(old->'subjects') s WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_policy->'subjects') n WHERE n->>'subjectId'=s->>'subjectId')) THEN RAISE EXCEPTION 'Consent obligations cannot be removed'; END IF;
  END IF;
 END IF;
 IF p_policy->>'basis'='consent-required' AND NOT EXISTS(SELECT 1 FROM garden_control.consent_terms t WHERE t.id=(p_policy#>>'{terms,id}')::uuid AND t.version=(p_policy#>>'{terms,version}')::bigint AND t.digest=p_policy#>>'{terms,digest}') THEN RAISE EXCEPTION 'Exact consent terms unavailable'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_policy->'inputs') LOOP
  INSERT INTO garden_control.consent_dependencies VALUES(p_workspace,rid,(item#>>'{}')::uuid) ON CONFLICT DO NOTHING;
 END LOOP;
 WITH RECURSIVE walk(id,path,cycle) AS (
  SELECT rid,ARRAY[rid],false UNION ALL
  SELECT d.input_id,w.path||d.input_id,d.input_id=ANY(w.path) FROM walk w JOIN garden_control.consent_dependencies d ON d.workspace_id=p_workspace AND d.derivative_id=w.id WHERE NOT w.cycle AND cardinality(w.path)<=32
 ) SELECT count(*),COALESCE(bool_or(cycle OR cardinality(path)>32),false) INTO count_nodes,cyclic FROM (SELECT * FROM walk LIMIT 257) limited;
 IF count_nodes>256 OR cyclic THEN RAISE EXCEPTION 'Consent dependency graph unavailable'; END IF;
 v:=COALESCE(v,0)+1;
 INSERT INTO garden_control.use_policy_revisions VALUES(p_workspace,rid,v,p_policy,p_actor,clock_timestamp());
 INSERT INTO garden_control.use_policy_heads VALUES(p_workspace,rid,v) ON CONFLICT(workspace_id,record_id) DO UPDATE SET version=excluded.version;
 RETURN v;
END $$;
CREATE FUNCTION garden_control.record_consent_grant(p_workspace uuid,p_grant jsonb,p_actor text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE policy jsonb;
BEGIN
 IF p_workspace IS NULL OR NOT garden_control.consent_grant_valid(p_grant) OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Consent grant unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(p_workspace::text));
 SELECT r.policy INTO policy FROM garden_control.use_policy_heads h JOIN garden_control.use_policy_revisions r USING(workspace_id,record_id,version) WHERE h.workspace_id=p_workspace AND h.record_id=(p_grant->>'recordId')::uuid;
 IF policy IS NULL OR policy->>'basis'<>'consent-required' OR policy->'terms' IS DISTINCT FROM p_grant->'terms' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(policy->'subjects') s WHERE s->>'subjectId'=p_grant->>'subjectId' AND s->>'authority'=p_grant->>'authority') THEN RAISE EXCEPTION 'Consent scope unavailable'; END IF;
 INSERT INTO garden_control.consent_grants(id,workspace_id,record_id,subject_id,purpose,terms_id,terms_version,terms_digest,grant_record,recorded_by)
 VALUES((p_grant->>'id')::uuid,p_workspace,(p_grant->>'recordId')::uuid,p_grant->>'subjectId',p_grant->>'purpose',(p_grant#>>'{terms,id}')::uuid,(p_grant#>>'{terms,version}')::bigint,p_grant#>>'{terms,digest}',p_grant,p_actor);
 RETURN (p_grant->>'id')::uuid;
END $$;
CREATE FUNCTION garden_control.withdraw_consent_grant(p_workspace uuid,p_grant uuid,p_reason text,p_actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF p_workspace IS NULL OR p_grant IS NULL OR p_reason IS NULL OR p_reason !~ '^[a-f0-9]{64}$' OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Consent withdrawal unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(p_workspace::text));
 IF NOT EXISTS(SELECT 1 FROM garden_control.consent_grants WHERE id=p_grant AND workspace_id=p_workspace) THEN RAISE EXCEPTION 'Consent withdrawal unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM garden_control.consent_withdrawals WHERE grant_id=p_grant) THEN RETURN; END IF;
 -- Withdraw the permission purpose, not just its newest receipt: no older grant resurrection.
 INSERT INTO garden_control.consent_withdrawals(grant_id,recorded_by,reason_digest)
 SELECT g.id,p_actor,p_reason FROM garden_control.consent_grants g JOIN garden_control.consent_grants selected ON selected.id=p_grant
 WHERE g.workspace_id=p_workspace AND g.record_id=selected.record_id AND g.subject_id=selected.subject_id AND g.purpose=selected.purpose ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION garden_control.consent_allows(p_workspace uuid,p_record uuid,p_purpose text,p_now timestamptz) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp SET timezone='UTC' AS $$
DECLARE row record; p jsonb; subject jsonb; n integer:=0;
BEGIN
 IF p_now IS NULL OR NOT garden_control.use_purpose_valid(p_purpose) THEN RETURN false; END IF;
 FOR row IN WITH RECURSIVE walk(id,path,cycle) AS (
   SELECT p_record,ARRAY[p_record],false UNION ALL
   SELECT d.input_id,w.path||d.input_id,d.input_id=ANY(w.path) FROM walk w JOIN garden_control.consent_dependencies d ON d.workspace_id=p_workspace AND d.derivative_id=w.id WHERE NOT w.cycle AND cardinality(w.path)<=32
  ) SELECT w.*,r.policy FROM walk w LEFT JOIN garden_control.use_policy_heads h ON h.workspace_id=p_workspace AND h.record_id=w.id LEFT JOIN garden_control.use_policy_revisions r ON r.workspace_id=h.workspace_id AND r.record_id=h.record_id AND r.version=h.version LIMIT 257 LOOP
  n:=n+1;IF n>256 OR row.cycle OR cardinality(row.path)>32 OR row.policy IS NULL THEN RETURN false; END IF;p:=row.policy;
  IF p->>'basis'='unreviewed' THEN RETURN false; END IF;
  IF p->>'basis'='no-consent-required' AND NOT (p->'purposes') ? p_purpose THEN RETURN false; END IF;
  IF p->>'basis'='consent-required' THEN
   FOR subject IN SELECT * FROM jsonb_array_elements(p->'subjects') LOOP
    IF NOT EXISTS(
     SELECT 1 FROM garden_control.consent_grants g WHERE g.workspace_id=p_workspace AND g.record_id=row.id AND g.subject_id=subject->>'subjectId' AND g.purpose=p_purpose
     AND g.terms_id=(p#>>'{terms,id}')::uuid AND g.terms_version=(p#>>'{terms,version}')::bigint AND g.terms_digest=p#>>'{terms,digest}'
     AND g.grant_record->>'authority'=subject->>'authority' AND (g.grant_record->>'validFrom')::timestamptz<=p_now AND (g.grant_record->>'expiresAt')::timestamptz>p_now
     AND (cardinality(row.path)=1 OR g.grant_record->'derivativesAllowed'='true'::jsonb)
     AND (g.grant_record->>'authority'='self' OR (g.grant_record->>'authorityExpiresAt')::timestamptz>p_now)
     AND NOT EXISTS(SELECT 1 FROM garden_control.consent_withdrawals w WHERE w.grant_id=g.id)
    ) THEN RETURN false; END IF;
   END LOOP;
  END IF;
 END LOOP;
 RETURN n>0;
END $$;
-- No control table or free-form evaluator is exposed to a research connection.
CREATE FUNCTION garden_control.research_consent_allows(p_workspace uuid,p_record uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT garden_control.may_access_record(p_workspace,p_record,'research','active','read') AND garden_control.consent_allows(p_workspace,p_record,'research',statement_timestamp())
$$;
CREATE POLICY record_consent_read ON garden_private.record_envelopes AS RESTRICTIVE FOR SELECT TO garden_research USING(garden_control.research_consent_allows(workspace_id,id));
CREATE POLICY record_consent_update ON garden_private.record_envelopes AS RESTRICTIVE FOR UPDATE TO garden_research USING(garden_control.research_consent_allows(workspace_id,id)) WITH CHECK(garden_control.research_consent_allows(workspace_id,id));
-- Freeze the consent-bearing source object itself. Redactions or replacement media
-- are new derivative identities; a writer cannot replace what a person agreed to.
CREATE FUNCTION garden_control.guard_consented_payload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF NEW.payload IS DISTINCT FROM OLD.payload AND EXISTS(SELECT 1 FROM garden_control.use_policy_revisions WHERE workspace_id=OLD.workspace_id AND record_id=OLD.id AND policy->>'basis'='consent-required') THEN RAISE EXCEPTION 'Create a new derivative instead of replacing consented content'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consented_payload BEFORE UPDATE OF payload ON garden_private.record_envelopes FOR EACH ROW EXECUTE FUNCTION garden_control.guard_consented_payload();
CREATE FUNCTION garden_control.admit_use(p_workspace uuid,p_record uuid,p_request uuid,p_purposes text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE purpose text; point timestamptz; versions jsonb; previous garden_control.use_receipts%ROWTYPE;
BEGIN
 IF p_workspace IS NULL OR p_record IS NULL OR p_request IS NULL OR p_purposes IS NULL OR cardinality(p_purposes) NOT BETWEEN 1 AND 5 OR EXISTS(SELECT 1 FROM unnest(p_purposes) p WHERE NOT garden_control.use_purpose_valid(p)) OR (SELECT count(DISTINCT p) FROM unnest(p_purposes) p)<>cardinality(p_purposes) THEN RAISE EXCEPTION 'Use admission unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(p_workspace::text));point:=clock_timestamp();
 FOREACH purpose IN ARRAY p_purposes LOOP IF NOT garden_control.consent_allows(p_workspace,p_record,purpose,point) THEN RAISE EXCEPTION 'Use admission unavailable'; END IF; END LOOP;
 WITH RECURSIVE walk(id) AS (SELECT p_record UNION SELECT d.input_id FROM walk w JOIN garden_control.consent_dependencies d ON d.workspace_id=p_workspace AND d.derivative_id=w.id)
 SELECT jsonb_object_agg(h.record_id::text,h.version::text) INTO versions FROM walk w JOIN garden_control.use_policy_heads h ON h.workspace_id=p_workspace AND h.record_id=w.id;
 SELECT * INTO previous FROM garden_control.use_receipts WHERE request_id=p_request;
 IF FOUND THEN
  IF previous.workspace_id<>p_workspace OR previous.record_id<>p_record OR previous.purposes<>p_purposes OR previous.policy_revisions IS DISTINCT FROM versions THEN RAISE EXCEPTION 'Use admission request conflict'; END IF;
  -- A retry rechecks current permission and policy versions; old receipts are not capabilities.
 ELSE
  INSERT INTO garden_control.use_receipts VALUES(p_request,p_workspace,p_record,p_purposes,point,versions);
 END IF;
 RETURN jsonb_build_object('requestId',p_request,'allowed',true,'checkedAt',point,'publicationApproved',false,'revalidateBeforeUse',true);
END $$;
CREATE FUNCTION garden_control.admit_publication_use(p_workspace uuid,p_record uuid,p_request uuid,p_purposes text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF p_purposes IS NULL OR cardinality(p_purposes)<1 OR NOT p_purposes <@ ARRAY['public-display','name-attribution','promotional-endorsement']::text[] THEN RAISE EXCEPTION 'Publication purpose unavailable'; END IF;
 RETURN garden_control.admit_use(p_workspace,p_record,p_request,p_purposes);
END $$;
CREATE FUNCTION garden_control.admit_preservation_use(p_workspace uuid,p_record uuid,p_request uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT garden_control.admit_use(p_workspace,p_record,p_request,ARRAY['preservation']::text[])
$$;
REVOKE ALL ON FUNCTION garden_control.consent_immutable(),garden_control.use_purpose_valid(text),garden_control.consent_policy_valid(jsonb),garden_control.consent_grant_valid(jsonb),garden_control.register_consent_terms(uuid,bigint,text,text),garden_control.set_use_policy(uuid,jsonb,bigint,text),garden_control.record_consent_grant(uuid,jsonb,text),garden_control.withdraw_consent_grant(uuid,uuid,text,text),garden_control.consent_allows(uuid,uuid,text,timestamptz),garden_control.research_consent_allows(uuid,uuid),garden_control.guard_consented_payload(),garden_control.admit_use(uuid,uuid,uuid,text[]),garden_control.admit_publication_use(uuid,uuid,uuid,text[]),garden_control.admit_preservation_use(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.register_consent_terms(uuid,bigint,text,text),garden_control.set_use_policy(uuid,jsonb,bigint,text),garden_control.record_consent_grant(uuid,jsonb,text),garden_control.withdraw_consent_grant(uuid,uuid,text,text) TO garden_consent_admin;
GRANT EXECUTE ON FUNCTION garden_control.research_consent_allows(uuid,uuid) TO garden_research;
GRANT EXECUTE ON FUNCTION garden_control.admit_publication_use(uuid,uuid,uuid,text[]) TO garden_publisher;
GRANT EXECUTE ON FUNCTION garden_control.admit_preservation_use(uuid,uuid,uuid) TO garden_worker;
RESET ROLE;
