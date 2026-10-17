-- GDN-026: private, revision-bound encrypted sidecars. No key values, provider
-- activation, source backfill, plaintext conversion, public route or purge job.
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_encryption') THEN
  CREATE ROLE garden_encryption NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_encryption' AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Unsafe encryption capability'; END IF;
 EXECUTE format('GRANT garden_encryption TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $role$;
SET LOCAL ROLE garden_migrator;
GRANT USAGE ON SCHEMA garden_control TO garden_encryption;

CREATE TABLE garden_control.encryption_key_versions (
 workspace_id uuid NOT NULL REFERENCES garden_control.access_workspaces(id),
 environment text NOT NULL CHECK(environment IN ('ci','staging')),
 data_class text NOT NULL CHECK(data_class='restricted_research'),
 provider_id text NOT NULL CHECK(provider_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$'),
 key_ref text NOT NULL CHECK(key_ref ~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$'),
 key_version text NOT NULL CHECK(key_version ~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$'),
 can_read boolean NOT NULL DEFAULT false, can_write boolean NOT NULL DEFAULT false,
 not_before timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 revoked_at timestamptz, CHECK(expires_at>not_before), CHECK(NOT can_write OR can_read),
 PRIMARY KEY(workspace_id,environment,data_class,key_version),
 UNIQUE(workspace_id,environment,data_class,provider_id,key_ref,key_version)
);
CREATE TABLE garden_control.encryption_key_bindings (
 workspace_id uuid NOT NULL REFERENCES garden_control.access_workspaces(id),
 repository text NOT NULL CHECK(repository='neophilism/The-Garden'),
 environment text NOT NULL CHECK(environment IN ('ci','staging')),
 data_class text NOT NULL CHECK(data_class='restricted_research'),
 provider_id text NOT NULL, key_ref text NOT NULL, write_version text NOT NULL,
 policy_generation bigint NOT NULL DEFAULT 1 CHECK(policy_generation>0),
 enabled boolean NOT NULL DEFAULT false, expires_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,environment,data_class),
 FOREIGN KEY(workspace_id,environment,data_class,provider_id,key_ref,write_version)
  REFERENCES garden_control.encryption_key_versions(workspace_id,environment,data_class,provider_id,key_ref,key_version)
);

CREATE TABLE garden_private.encrypted_content_versions (
 workspace_id uuid NOT NULL, content_version_id uuid NOT NULL,
 record_id uuid NOT NULL, record_revision bigint NOT NULL,
 environment text NOT NULL CHECK(environment IN ('ci','staging')),
 data_class text NOT NULL CHECK(data_class='restricted_research'), purpose text NOT NULL CHECK(purpose='research'),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,content_version_id), UNIQUE(content_version_id),
 UNIQUE(workspace_id,record_id,record_revision,environment,data_class,purpose),
 FOREIGN KEY(workspace_id,record_id,record_revision) REFERENCES garden_private.record_revisions(workspace_id,record_id,version),
 FOREIGN KEY(workspace_id,created_by) REFERENCES garden_control.access_members(workspace_id,subject_id)
);
CREATE TABLE garden_private.encrypted_envelope_revisions (
 workspace_id uuid NOT NULL, content_version_id uuid NOT NULL, generation bigint NOT NULL CHECK(generation>0),
 operation_id uuid NOT NULL UNIQUE, request_digest text NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 envelope_digest text NOT NULL CHECK(envelope_digest ~ '^[0-9a-f]{64}$'),
 previous_generation bigint, previous_digest text,
 provider_id text NOT NULL, key_ref text NOT NULL, key_version text NOT NULL,
 actor_subject_id text NOT NULL, authority_expires_at timestamptz NOT NULL,
 audit_sequence bigint NOT NULL, transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,content_version_id,generation),
 UNIQUE(workspace_id,content_version_id,generation,envelope_digest),
 FOREIGN KEY(workspace_id,content_version_id) REFERENCES garden_private.encrypted_content_versions(workspace_id,content_version_id),
 FOREIGN KEY(workspace_id,content_version_id,previous_generation,previous_digest) REFERENCES garden_private.encrypted_envelope_revisions(workspace_id,content_version_id,generation,envelope_digest),
 FOREIGN KEY(workspace_id,actor_subject_id) REFERENCES garden_control.access_members(workspace_id,subject_id),
 FOREIGN KEY(workspace_id,audit_sequence) REFERENCES garden_control.audit_events(workspace_id,sequence),
 CHECK((generation=1 AND previous_generation IS NULL AND previous_digest IS NULL) OR
  (generation>1 AND previous_generation IS NOT NULL AND previous_generation=generation-1 AND previous_digest IS NOT NULL AND previous_digest ~ '^[0-9a-f]{64}$'))
);
-- Erasable material points to immutable metadata, never the reverse. A future
-- reviewed GDN-032 eraser can remove material while retaining commit receipts.
CREATE TABLE garden_private.encrypted_material (
 workspace_id uuid NOT NULL, content_version_id uuid NOT NULL, generation bigint NOT NULL,
 wrapped_key text NOT NULL, nonce text NOT NULL, ciphertext text NOT NULL, tag text NOT NULL,
 PRIMARY KEY(workspace_id,content_version_id,generation),
 FOREIGN KEY(workspace_id,content_version_id,generation) REFERENCES garden_private.encrypted_envelope_revisions(workspace_id,content_version_id,generation),
 CHECK(length(wrapped_key) BETWEEN 1 AND 21846 AND length(nonce)=16 AND length(ciphertext)<=11184811 AND length(tag)=22)
);
CREATE TABLE garden_private.encrypted_content_heads (
 workspace_id uuid NOT NULL, content_version_id uuid NOT NULL, generation bigint NOT NULL CHECK(generation>0),
 envelope_digest text NOT NULL CHECK(envelope_digest ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(workspace_id,content_version_id),
 FOREIGN KEY(workspace_id,content_version_id,generation,envelope_digest) REFERENCES garden_private.encrypted_envelope_revisions(workspace_id,content_version_id,generation,envelope_digest)
);

DO $tables$ DECLARE n text; s text; BEGIN
 FOREACH n IN ARRAY ARRAY['encryption_key_versions','encryption_key_bindings','encrypted_content_versions','encrypted_envelope_revisions','encrypted_material','encrypted_content_heads'] LOOP
  s:=CASE WHEN n LIKE 'encryption_%' THEN 'garden_control' ELSE 'garden_private' END;
  EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC,garden_public,garden_publisher,garden_research,garden_worker,garden_context_issuer,garden_membership_admin,garden_consent_admin,garden_audit_reader,garden_audit_writer,garden_encryption',s,n);
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',s,n);
  EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',s,n);
  EXECUTE format('CREATE POLICY encryption_owner ON %I.%I TO garden_migrator USING(true) WITH CHECK(true)',s,n);
 END LOOP;
END $tables$;
CREATE TRIGGER immutable_content_version BEFORE UPDATE OR DELETE ON garden_private.encrypted_content_versions FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_content_version_truncate BEFORE TRUNCATE ON garden_private.encrypted_content_versions FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_envelope_revision BEFORE UPDATE OR DELETE ON garden_private.encrypted_envelope_revisions FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_envelope_revision_truncate BEFORE TRUNCATE ON garden_private.encrypted_envelope_revisions FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();

-- This canonical form matches envelopeDigest in trusted-encryption.mjs. Every
-- value is a closed ASCII scalar; PostgreSQL jsonb object order is irrelevant.
CREATE FUNCTION garden_control.encrypted_base64_valid(p text,p_min integer,p_max integer) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE b bytea; BEGIN
 IF p IS NULL OR length(p)>((p_max+2)/3)*4 OR p !~ '^[A-Za-z0-9_-]*$' OR length(p)%4=1 THEN RETURN false; END IF;
 b:=decode(translate(p,'-_','+/')||repeat('=',(4-length(p)%4)%4),'base64');
 RETURN octet_length(b) BETWEEN p_min AND p_max AND translate(replace(rtrim(encode(b,'base64'),'='),chr(10),''),'+/','-_')=p;
EXCEPTION WHEN OTHERS THEN RETURN false; END $$;
CREATE FUNCTION garden_control.encrypted_envelope_canonical(e jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE c jsonb; k text; fields text[]:=ARRAY['context','providerId','keyRef','keyVersion','wrappedKey','nonce','ciphertext','tag']; out text;
BEGIN
 IF e IS NULL OR jsonb_typeof(e)<>'object' OR NOT e ?& fields OR e-fields<>'{}'::jsonb THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 c:=e->'context';fields:=ARRAY['format','algorithm','workspaceId','objectId','versionId','environment','dataClass','purpose'];
 IF c IS NULL OR jsonb_typeof(c)<>'object' OR NOT c ?& fields OR c-fields<>'{}'::jsonb OR c->>'format' IS DISTINCT FROM 'garden-trusted-envelope-v1' OR c->>'algorithm' IS DISTINCT FROM 'AES-256-GCM' OR c->>'dataClass' IS DISTINCT FROM 'restricted_research' OR c->>'purpose' IS DISTINCT FROM 'research' OR NOT COALESCE(c->>'environment' IN ('ci','staging'),false) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 FOREACH k IN ARRAY fields LOOP IF jsonb_typeof(c->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF; END LOOP;
 FOREACH k IN ARRAY ARRAY['workspaceId','objectId','versionId'] LOOP IF c->>k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF; END LOOP;
 FOREACH k IN ARRAY ARRAY['providerId','keyRef','keyVersion','wrappedKey','nonce','ciphertext','tag'] LOOP IF jsonb_typeof(e->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF; END LOOP;
 FOREACH k IN ARRAY ARRAY['providerId','keyRef','keyVersion'] LOOP IF e->>k !~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF; END LOOP;
 IF NOT garden_control.encrypted_base64_valid(e->>'wrappedKey',1,16384) OR NOT garden_control.encrypted_base64_valid(e->>'nonce',12,12) OR NOT garden_control.encrypted_base64_valid(e->>'ciphertext',0,8388608) OR NOT garden_control.encrypted_base64_valid(e->>'tag',16,16) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 out:='{"context":{';
 FOREACH k IN ARRAY fields LOOP out:=out||CASE WHEN k='format' THEN '' ELSE ',' END||'"'||k||'":"'||(c->>k)||'"'; END LOOP;
 out:=out||'}';
 FOREACH k IN ARRAY ARRAY['providerId','keyRef','keyVersion','wrappedKey','nonce','ciphertext','tag'] LOOP out:=out||',"'||k||'":"'||(e->>k)||'"'; END LOOP;
 RETURN out||'}';
END $$;
CREATE FUNCTION garden_control.encrypted_envelope_digest(e jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT encode(sha256(convert_to(garden_control.encrypted_envelope_canonical(e),'UTF8')),'hex') $$;
CREATE FUNCTION garden_control.encrypted_request_digest(p jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE fields text[]:=ARRAY['operationId','workspaceId','recordId','recordRevision','contentVersionId','keyPolicyGeneration','expectedGeneration','expectedDigest','envelope']; k text; out text:='garden-encrypted-content-request-v1';
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR NOT p ?& fields OR p-fields<>'{}'::jsonb THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 FOREACH k IN ARRAY ARRAY['operationId','workspaceId','recordId','contentVersionId'] LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' OR p->>k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['recordRevision','keyPolicyGeneration','expectedGeneration'] LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' OR p->>k !~ '^(0|[1-9][0-9]{0,18})$' OR (p->>k)::numeric>=9223372036854775807 OR (k<>'expectedGeneration' AND p->>k='0') THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 END LOOP;
 IF (p->>'expectedGeneration'='0' AND p->'expectedDigest' IS DISTINCT FROM 'null'::jsonb) OR (p->>'expectedGeneration'<>'0' AND (jsonb_typeof(p->'expectedDigest') IS DISTINCT FROM 'string' OR NOT COALESCE(p->>'expectedDigest' ~ '^[0-9a-f]{64}$',false))) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 FOREACH k IN ARRAY ARRAY['operationId','workspaceId','recordId','recordRevision','contentVersionId','keyPolicyGeneration','expectedGeneration'] LOOP out:=out||chr(10)||(p->>k); END LOOP;
 out:=out||chr(10)||COALESCE(p->>'expectedDigest','none')||chr(10)||garden_control.encrypted_envelope_digest(p->'envelope');
 RETURN encode(sha256(convert_to(out,'UTF8')),'hex');
END $$;

-- Locks actual authority rows, never caller-supplied classification/state. The
-- consent advisory lock also serializes absence of a future retention block;
-- any future block/hold inserter must take this same lock before changing it.
CREATE FUNCTION garden_control.encryption_authority(p_workspace uuid,p_record uuid,p_revision bigint,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.policy_tickets%ROWTYPE; w garden_control.access_workspaces%ROWTYPE; m garden_control.access_members%ROWTYPE; g garden_control.record_grants%ROWTYPE; r garden_private.record_envelopes%ROWTYPE; role_row garden_control.access_roles%ROWTYPE; point timestamptz;
BEGIN
 IF p_workspace IS NULL OR p_record IS NULL OR p_revision IS NULL OR p_revision<1 OR p_action IS NULL OR p_action NOT IN ('read','write') THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(p_workspace::text));
 SELECT q.* INTO t FROM garden_control.policy_contexts c JOIN garden_control.policy_tickets q ON q.token_hash=c.token_hash WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned() AND q.workspace_id=p_workspace AND q.purpose='research' AND q.used_at IS NOT NULL AND q.record_scope=p_record AND q.action=CASE WHEN p_action='write' THEN 'write' ELSE q.action END;
 IF NOT FOUND OR t.action NOT IN ('read','write') THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 SELECT * INTO w FROM garden_control.access_workspaces WHERE id=p_workspace FOR SHARE;
 SELECT * INTO m FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id=t.subject_id FOR SHARE;
 SELECT * INTO g FROM garden_control.record_grants WHERE workspace_id=p_workspace AND record_id=p_record AND subject_id=t.subject_id AND purpose='research' FOR SHARE;
 SELECT * INTO r FROM garden_private.record_envelopes WHERE workspace_id=p_workspace AND id=p_record FOR SHARE;
 SELECT * INTO role_row FROM garden_control.access_roles WHERE workspace_id=p_workspace AND subject_id=t.subject_id AND revoked_at IS NULL AND expires_at>clock_timestamp() AND (p_action='read' OR role IN ('contributor','transcriber','translator','researcher','editor')) ORDER BY role,id LIMIT 1 FOR SHARE;
 point:=clock_timestamp();
 IF w.id IS NULL OR NOT w.enabled OR m.subject_id IS NULL OR m.state<>'active' OR m.version<>t.member_version OR m.policy_sha256<>w.policy_sha256 OR g.record_id IS NULL OR NOT g.can_read OR (p_action='write' AND NOT g.can_write) OR g.revoked_at IS NOT NULL OR g.expires_at<=point OR t.expires_at<=point OR role_row.id IS NULL OR role_row.expires_at<=point OR r.id IS NULL OR r.classification<>'research' OR r.state<>'active' OR r.version<>p_revision OR NOT garden_control.consent_allows(p_workspace,p_record,'research',point) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 PERFORM 1 FROM garden_private.record_revisions WHERE workspace_id=p_workspace AND record_id=p_record AND version=p_revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN jsonb_build_object('actor',t.subject_id,'expiresAt',LEAST(t.expires_at,g.expires_at,role_row.expires_at));
END $$;
CREATE FUNCTION garden_control.encryption_binding(p_workspace uuid,p_environment text,p_write boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE b garden_control.encryption_key_bindings%ROWTYPE; v garden_control.encryption_key_versions%ROWTYPE; versions jsonb; point timestamptz; expiry timestamptz;
BEGIN
 PERFORM 1 FROM garden_control.deployment_binding WHERE singleton AND repository='neophilism/The-Garden' AND environment=p_environment AND database_name=current_database() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 SELECT * INTO b FROM garden_control.encryption_key_bindings WHERE workspace_id=p_workspace AND environment=p_environment AND data_class='restricted_research' FOR SHARE;
 IF NOT FOUND OR NOT b.enabled OR b.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 -- Lock all candidate versions in a deterministic order. Revocation UPDATEs
 -- cannot pass FOR SHARE. No provider or separate-pool audit runs in this TX.
 PERFORM 1 FROM garden_control.encryption_key_versions WHERE workspace_id=p_workspace AND environment=p_environment AND data_class=b.data_class AND provider_id=b.provider_id AND key_ref=b.key_ref ORDER BY key_version FOR SHARE;
 point:=clock_timestamp();
 SELECT * INTO v FROM garden_control.encryption_key_versions WHERE workspace_id=p_workspace AND environment=p_environment AND data_class=b.data_class AND provider_id=b.provider_id AND key_ref=b.key_ref AND key_version=b.write_version AND can_read AND (NOT p_write OR can_write) AND revoked_at IS NULL AND not_before<=point AND expires_at>point;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 SELECT jsonb_agg(key_version ORDER BY key_version),min(expires_at) INTO versions,expiry FROM garden_control.encryption_key_versions WHERE workspace_id=p_workspace AND environment=p_environment AND data_class=b.data_class AND provider_id=b.provider_id AND key_ref=b.key_ref AND can_read AND revoked_at IS NULL AND not_before<=point AND expires_at>point;
 IF versions IS NULL OR jsonb_array_length(versions)>32 THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN jsonb_build_object('binding',jsonb_build_object('repository',b.repository,'environment',b.environment,'providerId',b.provider_id,'dataClass',b.data_class,'keyRef',b.key_ref,'writeVersion',b.write_version,'readVersions',versions),'generation',b.policy_generation::text,'expiresAt',LEAST(b.expires_at,v.expires_at,expiry));
END $$;
CREATE FUNCTION garden_control.encrypted_context(p_workspace uuid,p_record uuid,p_content uuid,p_environment text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT jsonb_build_object('format','garden-trusted-envelope-v1','algorithm','AES-256-GCM','workspaceId',p_workspace,'objectId',p_record,'versionId',p_content,'environment',p_environment,'dataClass','restricted_research','purpose','research') $$;
CREATE FUNCTION garden_control.encrypted_envelope(p_workspace uuid,p_content uuid,p_generation bigint) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT jsonb_build_object('context',garden_control.encrypted_context(v.workspace_id,v.record_id,v.content_version_id,v.environment),'providerId',r.provider_id,'keyRef',r.key_ref,'keyVersion',r.key_version,'wrappedKey',m.wrapped_key,'nonce',m.nonce,'ciphertext',m.ciphertext,'tag',m.tag)
 FROM garden_private.encrypted_content_versions v JOIN garden_private.encrypted_envelope_revisions r USING(workspace_id,content_version_id) JOIN garden_private.encrypted_material m USING(workspace_id,content_version_id,generation)
 WHERE v.workspace_id=p_workspace AND v.content_version_id=p_content AND r.generation=p_generation
$$;
CREATE FUNCTION garden_control.encrypted_head_current(p_workspace uuid,p_content uuid,p_generation bigint,p_digest text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM garden_private.encrypted_envelope_revisions r WHERE r.workspace_id=p_workspace AND r.content_version_id=p_content AND r.generation=p_generation AND r.envelope_digest=p_digest)
 AND NOT EXISTS(SELECT 1 FROM garden_private.encrypted_envelope_revisions newer WHERE newer.workspace_id=p_workspace AND newer.content_version_id=p_content AND newer.generation>p_generation)
$$;
CREATE FUNCTION garden_control.encrypted_receipt(p_operation uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
 SELECT jsonb_build_object('operationId',r.operation_id,'requestDigest',r.request_digest,'workspaceId',r.workspace_id,'recordId',v.record_id,'recordRevision',v.record_revision::text,'contentVersionId',r.content_version_id,'generation',r.generation::text,'envelopeDigest',r.envelope_digest,'previousDigest',r.previous_digest,'keyVersion',r.key_version,'auditSequence',r.audit_sequence::text,'committed',true)
 FROM garden_private.encrypted_envelope_revisions r JOIN garden_private.encrypted_content_versions v USING(workspace_id,content_version_id) WHERE r.operation_id=p_operation
$$;

CREATE FUNCTION garden_control.prepare_encrypted_content(p_workspace uuid,p_record uuid,p_revision bigint,p_content uuid,p_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE auth jsonb; b jsonb; v garden_private.encrypted_content_versions%ROWTYPE; h garden_private.encrypted_content_heads%ROWTYPE; e jsonb;
BEGIN
 IF p_content IS NULL THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 auth:=garden_control.encryption_authority(p_workspace,p_record,p_revision,'write');
 b:=garden_control.encryption_binding(p_workspace,p_environment,true);
 SELECT * INTO v FROM garden_private.encrypted_content_versions WHERE workspace_id=p_workspace AND (content_version_id=p_content OR (record_id=p_record AND record_revision=p_revision AND environment=p_environment AND data_class='restricted_research' AND purpose='research'));
 IF FOUND THEN
  IF v.content_version_id<>p_content OR v.record_id<>p_record OR v.record_revision<>p_revision OR v.environment<>p_environment THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
  SELECT * INTO STRICT h FROM garden_private.encrypted_content_heads WHERE workspace_id=p_workspace AND content_version_id=p_content FOR SHARE;
  e:=garden_control.encrypted_envelope(p_workspace,p_content,h.generation);
  IF NOT garden_control.encrypted_head_current(p_workspace,p_content,h.generation,h.envelope_digest) OR e IS NULL OR garden_control.encrypted_envelope_digest(e)<>h.envelope_digest OR NOT (b#>'{binding,readVersions}') ? (e->>'keyVersion') THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 END IF;
 IF LEAST((auth->>'expiresAt')::timestamptz,(b->>'expiresAt')::timestamptz)<=clock_timestamp() OR NOT garden_control.consent_allows(p_workspace,p_record,'research',clock_timestamp()) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN jsonb_build_object('workspaceId',p_workspace,'recordId',p_record,'recordRevision',p_revision::text,'contentVersionId',p_content,'context',garden_control.encrypted_context(p_workspace,p_record,p_content,p_environment),'keyBinding',b->'binding','keyPolicyGeneration',b->>'generation','head',CASE WHEN h.generation IS NULL THEN NULL ELSE jsonb_build_object('generation',h.generation::text,'digest',h.envelope_digest) END,'envelope',e);
END $$;
CREATE FUNCTION garden_control.load_encrypted_content(p_workspace uuid,p_record uuid,p_revision bigint,p_content uuid,p_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE auth jsonb; b jsonb; v garden_private.encrypted_content_versions%ROWTYPE; h garden_private.encrypted_content_heads%ROWTYPE; e jsonb;
BEGIN
 auth:=garden_control.encryption_authority(p_workspace,p_record,p_revision,'read');b:=garden_control.encryption_binding(p_workspace,p_environment,false);
 SELECT * INTO v FROM garden_private.encrypted_content_versions WHERE workspace_id=p_workspace AND content_version_id=p_content AND record_id=p_record AND record_revision=p_revision AND environment=p_environment;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 SELECT * INTO STRICT h FROM garden_private.encrypted_content_heads WHERE workspace_id=p_workspace AND content_version_id=p_content FOR SHARE;
 e:=garden_control.encrypted_envelope(p_workspace,p_content,h.generation);
 IF NOT garden_control.encrypted_head_current(p_workspace,p_content,h.generation,h.envelope_digest) OR e IS NULL OR garden_control.encrypted_envelope_digest(e)<>h.envelope_digest OR e->>'providerId' IS DISTINCT FROM b#>>'{binding,providerId}' OR e->>'keyRef' IS DISTINCT FROM b#>>'{binding,keyRef}' OR NOT (b#>'{binding,readVersions}') ? (e->>'keyVersion') OR LEAST((auth->>'expiresAt')::timestamptz,(b->>'expiresAt')::timestamptz)<=clock_timestamp() OR NOT garden_control.consent_allows(p_workspace,p_record,'research',clock_timestamp()) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN jsonb_build_object('workspaceId',p_workspace,'recordId',p_record,'recordRevision',p_revision::text,'contentVersionId',p_content,'context',garden_control.encrypted_context(p_workspace,p_record,p_content,p_environment),'keyBinding',b->'binding','keyPolicyGeneration',b->>'generation','head',jsonb_build_object('generation',h.generation::text,'digest',h.envelope_digest),'envelope',e);
END $$;

-- Database checks run again at COMMIT, after any audit-head wait and host
-- authentication recheck. Locked status/key rows cannot change meanwhile;
-- clock-based expiry and inherited consent still must be evaluated now.
CREATE FUNCTION garden_control.encryption_commit_fresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE rid uuid; BEGIN
 SELECT record_id INTO STRICT rid FROM garden_private.encrypted_content_versions WHERE workspace_id=NEW.workspace_id AND content_version_id=NEW.content_version_id;
 IF NEW.authority_expires_at<=clock_timestamp() OR NOT garden_control.consent_allows(NEW.workspace_id,rid,'research',clock_timestamp()) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER encryption_commit_fresh AFTER INSERT ON garden_private.encrypted_envelope_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_control.encryption_commit_fresh();

CREATE FUNCTION garden_control.commit_encrypted_content(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE fingerprint text; workspace uuid; rid uuid; revision bigint; cid uuid; operation uuid; expected bigint; e jsonb; digest text; auth jsonb; b jsonb; v garden_private.encrypted_content_versions%ROWTYPE; h garden_private.encrypted_content_heads%ROWTYPE; old garden_private.encrypted_envelope_revisions%ROWTYPE; prior jsonb; seq bigint; expiry timestamptz;
BEGIN
 fingerprint:=garden_control.encrypted_request_digest(p);workspace:=(p->>'workspaceId')::uuid;rid:=(p->>'recordId')::uuid;revision:=(p->>'recordRevision')::bigint;cid:=(p->>'contentVersionId')::uuid;operation:=(p->>'operationId')::uuid;expected:=(p->>'expectedGeneration')::bigint;e:=p->'envelope';
 auth:=garden_control.encryption_authority(workspace,rid,revision,'write');b:=garden_control.encryption_binding(workspace,e#>>'{context,environment}',true);
 IF e->'context' IS DISTINCT FROM garden_control.encrypted_context(workspace,rid,cid,e#>>'{context,environment}') OR e->>'providerId' IS DISTINCT FROM b#>>'{binding,providerId}' OR e->>'keyRef' IS DISTINCT FROM b#>>'{binding,keyRef}' OR e->>'keyVersion' IS DISTINCT FROM b#>>'{binding,writeVersion}' OR p->>'keyPolicyGeneration' IS DISTINCT FROM b->>'generation' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 expiry:=LEAST((auth->>'expiresAt')::timestamptz,(b->>'expiresAt')::timestamptz);digest:=garden_control.encrypted_envelope_digest(e);
 SELECT * INTO old FROM garden_private.encrypted_envelope_revisions WHERE operation_id=operation;
 IF FOUND THEN
  IF old.workspace_id<>workspace OR old.content_version_id<>cid OR old.request_digest<>fingerprint OR old.actor_subject_id IS DISTINCT FROM auth->>'actor' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
  IF expiry<=clock_timestamp() OR NOT garden_control.consent_allows(workspace,rid,'research',clock_timestamp()) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
  RETURN garden_control.encrypted_receipt(operation);
 END IF;
 SELECT * INTO v FROM garden_private.encrypted_content_versions WHERE workspace_id=workspace AND content_version_id=cid;
 IF FOUND THEN
  IF v.record_id<>rid OR v.record_revision<>revision OR v.environment<>e#>>'{context,environment}' OR expected=0 THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 ELSE
  IF expected<>0 THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
  INSERT INTO garden_private.encrypted_content_versions(workspace_id,content_version_id,record_id,record_revision,environment,data_class,purpose,created_by) VALUES(workspace,cid,rid,revision,e#>>'{context,environment}','restricted_research','research',auth->>'actor');
 END IF;
 SELECT * INTO h FROM garden_private.encrypted_content_heads WHERE workspace_id=workspace AND content_version_id=cid FOR UPDATE;
 IF COALESCE(h.generation,0)<>expected OR h.envelope_digest IS DISTINCT FROM p->>'expectedDigest' OR (expected>0 AND NOT garden_control.encrypted_head_current(workspace,cid,h.generation,h.envelope_digest)) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 IF expected>0 THEN
  prior:=garden_control.encrypted_envelope(workspace,cid,expected);
  IF prior IS NULL OR garden_control.encrypted_envelope_digest(prior)<>h.envelope_digest OR prior->>'providerId' IS DISTINCT FROM e->>'providerId' OR prior->>'keyRef' IS DISTINCT FROM e->>'keyRef' OR prior->>'keyVersion'=e->>'keyVersion' OR NOT (b#>'{binding,readVersions}') ? (prior->>'keyVersion') OR prior->'context' IS DISTINCT FROM e->'context' OR prior->>'ciphertext' IS DISTINCT FROM e->>'ciphertext' OR prior->>'nonce' IS DISTINCT FROM e->>'nonce' OR prior->>'tag' IS DISTINCT FROM e->>'tag' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 END IF;
 -- The semantic succeeded event and material/head/receipt are all in this TX.
 -- No separate-pool decision/audit or provider callback is invoked here.
 seq:=garden_control.append_audit_event(workspace,'subject',auth->>'actor','record',rid::text,revision,CASE WHEN expected=0 THEN 'encryption.persist' ELSE 'encryption.rewrap' END,operation);
 INSERT INTO garden_private.encrypted_envelope_revisions(workspace_id,content_version_id,generation,operation_id,request_digest,envelope_digest,previous_generation,previous_digest,provider_id,key_ref,key_version,actor_subject_id,authority_expires_at,audit_sequence)
 VALUES(workspace,cid,expected+1,operation,fingerprint,digest,CASE WHEN expected=0 THEN NULL ELSE expected END,h.envelope_digest,e->>'providerId',e->>'keyRef',e->>'keyVersion',auth->>'actor',expiry,seq);
 INSERT INTO garden_private.encrypted_material VALUES(workspace,cid,expected+1,e->>'wrappedKey',e->>'nonce',e->>'ciphertext',e->>'tag');
 INSERT INTO garden_private.encrypted_content_heads VALUES(workspace,cid,expected+1,digest) ON CONFLICT(workspace_id,content_version_id) DO UPDATE SET generation=excluded.generation,envelope_digest=excluded.envelope_digest;
 IF expiry<=clock_timestamp() OR NOT garden_control.consent_allows(workspace,rid,'research',clock_timestamp()) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN garden_control.encrypted_receipt(operation);
END $$;
CREATE FUNCTION garden_control.encrypted_content_receipt(p_workspace uuid,p_record uuid,p_operation uuid,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE r garden_private.encrypted_envelope_revisions%ROWTYPE; v garden_private.encrypted_content_versions%ROWTYPE; auth jsonb;
BEGIN
 IF p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 SELECT * INTO r FROM garden_private.encrypted_envelope_revisions WHERE operation_id=p_operation AND workspace_id=p_workspace AND request_digest=p_digest;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 SELECT * INTO STRICT v FROM garden_private.encrypted_content_versions WHERE workspace_id=p_workspace AND content_version_id=r.content_version_id AND record_id=p_record;
 auth:=garden_control.encryption_authority(p_workspace,p_record,v.record_revision,'write');
 IF r.actor_subject_id IS DISTINCT FROM auth->>'actor' OR (auth->>'expiresAt')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN garden_control.encrypted_receipt(p_operation);
END $$;

-- Defense in depth for the fixed host executor. SET CONSTRAINTS is itself a
-- PostgreSQL capability: the deferred trigger is not an unchangeable guarantee
-- against a compromised SQL login issuing its own transaction statements.
CREATE FUNCTION garden_control.check_encrypted_commit(p_operation uuid,p_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE r garden_private.encrypted_envelope_revisions%ROWTYPE; v garden_private.encrypted_content_versions%ROWTYPE; auth jsonb; actor text;
BEGIN
 SELECT * INTO r FROM garden_private.encrypted_envelope_revisions WHERE operation_id=p_operation AND request_digest=p_digest;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 SELECT * INTO STRICT v FROM garden_private.encrypted_content_versions WHERE workspace_id=r.workspace_id AND content_version_id=r.content_version_id;
 IF r.transaction_id=pg_current_xact_id() THEN
  actor:=garden_control.audit_current_subject(r.workspace_id);
  IF actor IS DISTINCT FROM r.actor_subject_id OR r.authority_expires_at<=clock_timestamp() OR NOT garden_control.consent_allows(r.workspace_id,v.record_id,'research',clock_timestamp()) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 ELSE
  -- An exact retry confirms the old receipt with new current authority. Its
  -- original ticket deadline is not reused as a new delivery capability.
  auth:=garden_control.encryption_authority(r.workspace_id,v.record_id,v.record_revision,'write');
  IF auth->>'actor' IS DISTINCT FROM r.actor_subject_id THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 END IF;
 RETURN true;
END $$;

CREATE FUNCTION garden_control.encryption_key_metadata_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.workspace_id<>OLD.workspace_id OR NEW.environment<>OLD.environment OR NEW.data_class<>OLD.data_class OR (TG_TABLE_NAME='encryption_key_versions' AND (to_jsonb(NEW)->>'key_version' IS DISTINCT FROM to_jsonb(OLD)->>'key_version' OR NEW.provider_id<>OLD.provider_id OR NEW.key_ref<>OLD.key_ref)) THEN RAISE EXCEPTION 'Encrypted key identity is immutable'; END IF;
  IF TG_TABLE_NAME='encryption_key_bindings' THEN NEW.policy_generation:=OLD.policy_generation+1; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION garden_control.audit_encryption_key_metadata() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 PERFORM garden_control.append_audit_event(NEW.workspace_id,'database-role',session_user::text,'workspace',NEW.workspace_id::text,NULL,CASE WHEN TG_TABLE_NAME='encryption_key_bindings' THEN 'encryption.key-policy' ELSE 'encryption.key-version' END);
 RETURN NEW;
END $$;
CREATE TRIGGER encryption_key_version_identity BEFORE UPDATE ON garden_control.encryption_key_versions FOR EACH ROW EXECUTE FUNCTION garden_control.encryption_key_metadata_change();
CREATE TRIGGER encryption_key_binding_generation BEFORE UPDATE ON garden_control.encryption_key_bindings FOR EACH ROW EXECUTE FUNCTION garden_control.encryption_key_metadata_change();
CREATE TRIGGER audit_encryption_key_version AFTER INSERT OR UPDATE ON garden_control.encryption_key_versions FOR EACH ROW EXECUTE FUNCTION garden_control.audit_encryption_key_metadata();
CREATE TRIGGER audit_encryption_key_binding AFTER INSERT OR UPDATE ON garden_control.encryption_key_bindings FOR EACH ROW EXECUTE FUNCTION garden_control.audit_encryption_key_metadata();
CREATE TRIGGER immutable_key_version_delete BEFORE DELETE ON garden_control.encryption_key_versions FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_key_version_truncate BEFORE TRUNCATE ON garden_control.encryption_key_versions FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_key_binding_delete BEFORE DELETE ON garden_control.encryption_key_bindings FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER immutable_key_binding_truncate BEFORE TRUNCATE ON garden_control.encryption_key_bindings FOR EACH STATEMENT EXECUTE FUNCTION garden_control.audit_immutable();

REVOKE ALL ON FUNCTION garden_control.encrypted_base64_valid(text,integer,integer),garden_control.encrypted_envelope_canonical(jsonb),garden_control.encrypted_envelope_digest(jsonb),garden_control.encrypted_request_digest(jsonb),garden_control.encryption_authority(uuid,uuid,bigint,text),garden_control.encryption_binding(uuid,text,boolean),garden_control.encrypted_context(uuid,uuid,uuid,text),garden_control.encrypted_envelope(uuid,uuid,bigint),garden_control.encrypted_receipt(uuid),garden_control.encrypted_head_current(uuid,uuid,bigint,text),garden_control.prepare_encrypted_content(uuid,uuid,bigint,uuid,text),garden_control.load_encrypted_content(uuid,uuid,bigint,uuid,text),garden_control.encryption_commit_fresh(),garden_control.commit_encrypted_content(jsonb),garden_control.encrypted_content_receipt(uuid,uuid,uuid,text),garden_control.encryption_key_metadata_change(),garden_control.audit_encryption_key_metadata(),garden_control.check_encrypted_commit(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.bind_policy_context(text),garden_control.clear_policy_context(),garden_control.prepare_encrypted_content(uuid,uuid,bigint,uuid,text),garden_control.load_encrypted_content(uuid,uuid,bigint,uuid,text),garden_control.commit_encrypted_content(jsonb),garden_control.encrypted_content_receipt(uuid,uuid,uuid,text),garden_control.check_encrypted_commit(uuid,text) TO garden_encryption;

-- The effective audit function (0011) is replaced below, preserving every old
-- action/serialization rule and adding only this component's closed actions.
CREATE OR REPLACE FUNCTION garden_control.append_audit_event(p_workspace uuid,p_actor_kind text,p_actor text,p_subject_kind text,p_subject text,p_version bigint,p_action text,p_request uuid DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE h garden_control.audit_heads%ROWTYPE; actor_ref uuid; subject_ref uuid; request_ref uuid; expected_kind text; outcome text:='succeeded'; reason text; e jsonb; serialized text; digest text;
BEGIN
 IF p_workspace IS NULL OR (p_version IS NOT NULL AND p_version<=0) THEN RAISE EXCEPTION 'Audit event unavailable'; END IF;
 CASE p_action
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
RESET ROLE;
