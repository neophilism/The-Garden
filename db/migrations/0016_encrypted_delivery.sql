-- GDN-026: bounded authorization through encrypted-content delivery. This adds
-- no provider, key, source payload, live activation or destructive operation.
-- The checksum-locked 0013 functions remain owner-only implementation details.
SET LOCAL ROLE garden_migrator;

CREATE TABLE garden_control.encrypted_delivery_contexts (
 token_hash bytea PRIMARY KEY REFERENCES garden_control.policy_tickets(token_hash),
 backend_pid integer NOT NULL CHECK(backend_pid>0), transaction_id xid8 NOT NULL,
 workspace_id uuid NOT NULL REFERENCES garden_control.access_workspaces(id), subject_id text NOT NULL,
 record_id uuid NOT NULL, record_revision bigint NOT NULL CHECK(record_revision>0), content_version_id uuid NOT NULL,
 environment text NOT NULL CHECK(environment IN ('ci','staging')),
 phase text NOT NULL CHECK(phase IN ('prepare','load','commit','recover')),
 operation_id uuid, request_digest text, key_policy_generation bigint, key_binding jsonb,
 result_fingerprint text NOT NULL CHECK(result_fingerprint ~ '^[0-9a-f]{64}$'),
 authority_expires_at timestamptz NOT NULL, completed_at timestamptz NOT NULL, closed_at timestamptz,
 UNIQUE(backend_pid,transaction_id),
 CHECK(length(subject_id) BETWEEN 1 AND 128),
 CHECK(authority_expires_at>completed_at),
 CHECK((phase IN ('prepare','load') AND operation_id IS NULL AND request_digest IS NULL) OR
       (phase IN ('commit','recover') AND operation_id IS NOT NULL AND request_digest IS NOT NULL AND request_digest ~ '^[0-9a-f]{64}$')),
 CHECK((phase='recover' AND key_policy_generation IS NULL AND key_binding IS NULL) OR
       (phase<>'recover' AND key_policy_generation IS NOT NULL AND key_policy_generation>0 AND key_binding IS NOT NULL AND jsonb_typeof(key_binding)='object'))
);
CREATE INDEX encrypted_delivery_expiry ON garden_control.encrypted_delivery_contexts(authority_expires_at);
-- Insert/delete in the final issuer TX: the deferred trigger retains NEW's
-- exact deadline even after its row and the original context have been retired.
CREATE TABLE garden_control.encrypted_delivery_checks (
 backend_pid integer NOT NULL, transaction_id xid8 NOT NULL, workspace_id uuid NOT NULL,
 record_id uuid NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(backend_pid,transaction_id)
);
DO $private$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['encrypted_delivery_contexts','encrypted_delivery_checks'] LOOP
  EXECUTE format('REVOKE ALL ON garden_control.%I FROM PUBLIC,garden_public,garden_research,garden_publisher,garden_worker,garden_context_issuer,garden_membership_admin,garden_consent_admin,garden_audit_reader,garden_audit_writer,garden_encryption,garden_lifecycle_requester,garden_lifecycle_admin',n);
  EXECUTE format('ALTER TABLE garden_control.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('ALTER TABLE garden_control.%I FORCE ROW LEVEL SECURITY',n);
  EXECUTE format('CREATE POLICY encrypted_delivery_owner ON garden_control.%I TO garden_migrator USING(true) WITH CHECK(true)',n);
 END LOOP;
END $private$;

CREATE FUNCTION garden_control.encrypted_delivery_fingerprint(p jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT encode(sha256(convert_to('garden-encrypted-delivery-result-v1'||chr(10)||garden_control.lifecycle_control_canonical(p),'UTF8')),'hex')
$$;
CREATE FUNCTION garden_control.encrypted_delivery_value(c garden_control.encrypted_delivery_contexts) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF c.phase='prepare' THEN RETURN garden_control.prepare_encrypted_content(c.workspace_id,c.record_id,c.record_revision,c.content_version_id,c.environment);
 ELSIF c.phase='load' THEN RETURN garden_control.load_encrypted_content(c.workspace_id,c.record_id,c.record_revision,c.content_version_id,c.environment);
 ELSIF c.phase IN ('commit','recover') THEN RETURN garden_control.encrypted_content_receipt(c.workspace_id,c.record_id,c.operation_id,c.request_digest);
 END IF;
 RAISE EXCEPTION 'Encrypted content unavailable';
END $$;

-- Owner-only: main and fresh final contexts call this with an exact server-owned
-- completion. It cannot accept a caller-selected actor, scope or phase.
CREATE FUNCTION garden_control.check_encrypted_delivery_row(c garden_control.encrypted_delivery_contexts) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE auth jsonb; b jsonb; value jsonb; expiry timestamptz; point timestamptz;
BEGIN
 IF c.token_hash IS NULL OR c.authority_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 auth:=garden_control.encryption_authority(c.workspace_id,c.record_id,c.record_revision,CASE WHEN c.phase='load' THEN 'read' ELSE 'write' END);
 IF auth->>'actor' IS DISTINCT FROM c.subject_id THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 PERFORM 1 FROM garden_control.deployment_binding WHERE singleton AND repository='neophilism/The-Garden' AND environment=c.environment AND database_name=current_database() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 expiry:=LEAST(c.authority_expires_at,(auth->>'expiresAt')::timestamptz);
 IF c.phase<>'recover' THEN
  b:=garden_control.encryption_binding(c.workspace_id,c.environment,c.phase<>'load');
  IF b->>'generation' IS DISTINCT FROM c.key_policy_generation::text OR b->'binding' IS DISTINCT FROM c.key_binding THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
  expiry:=LEAST(expiry,(b->>'expiresAt')::timestamptz);
 END IF;
 value:=garden_control.encrypted_delivery_value(c);
 IF value->>'workspaceId' IS DISTINCT FROM c.workspace_id::text OR value->>'recordId' IS DISTINCT FROM c.record_id::text OR value->>'recordRevision' IS DISTINCT FROM c.record_revision::text OR value->>'contentVersionId' IS DISTINCT FROM c.content_version_id::text OR garden_control.encrypted_delivery_fingerprint(value) IS DISTINCT FROM c.result_fingerprint THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 IF c.phase IN ('commit','recover') THEN
  PERFORM 1 FROM garden_private.encrypted_content_versions WHERE workspace_id=c.workspace_id AND content_version_id=c.content_version_id AND record_id=c.record_id AND record_revision=c.record_revision AND environment=c.environment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 END IF;
 point:=clock_timestamp();
 expiry:=garden_control.lifecycle_control_consent_deadline(c.workspace_id,c.record_id,point,expiry);
 IF expiry<=clock_timestamp() THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN jsonb_build_object('subjectId',c.subject_id,'expiresAt',garden_control.lifecycle_control_iso(expiry),'resultFingerprint',c.result_fingerprint);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Encrypted content unavailable';
END $$;

CREATE FUNCTION garden_control.complete_encrypted_delivery(p_phase text,p_environment text,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.policy_tickets%ROWTYPE; auth jsonb; b jsonb; expiry timestamptz; point timestamptz; workspace uuid; rid uuid; revision bigint; cid uuid;
BEGIN
 IF p_phase IS NULL OR p_phase NOT IN ('prepare','load','commit','recover') OR p_environment IS NULL OR p_environment NOT IN ('ci','staging') OR p_result IS NULL THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 workspace:=(p_result->>'workspaceId')::uuid;rid:=(p_result->>'recordId')::uuid;revision:=(p_result->>'recordRevision')::bigint;cid:=(p_result->>'contentVersionId')::uuid;
 auth:=garden_control.encryption_authority(workspace,rid,revision,CASE WHEN p_phase='load' THEN 'read' ELSE 'write' END);
 SELECT q.* INTO STRICT t FROM garden_control.policy_contexts pc JOIN garden_control.policy_tickets q ON q.token_hash=pc.token_hash
  WHERE pc.backend_pid=pg_backend_pid() AND pc.transaction_id=pg_current_xact_id() AND q.workspace_id=workspace AND q.subject_id=auth->>'actor' AND q.record_scope=rid AND q.purpose='research' AND q.action=CASE WHEN p_phase='load' THEN 'read' ELSE 'write' END AND q.used_at IS NOT NULL;
 expiry:=(auth->>'expiresAt')::timestamptz;
 IF p_phase<>'recover' THEN
  b:=garden_control.encryption_binding(workspace,p_environment,p_phase<>'load');
  expiry:=LEAST(expiry,(b->>'expiresAt')::timestamptz);
  IF p_phase IN ('prepare','load') AND (p_result->>'keyPolicyGeneration' IS DISTINCT FROM b->>'generation' OR p_result->'keyBinding' IS DISTINCT FROM b->'binding') THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
  IF p_phase='commit' AND p_result->>'keyVersion' IS DISTINCT FROM b#>>'{binding,writeVersion}' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 END IF;
 point:=clock_timestamp();expiry:=garden_control.lifecycle_control_consent_deadline(workspace,rid,point,expiry);
 INSERT INTO garden_control.encrypted_delivery_contexts(token_hash,backend_pid,transaction_id,workspace_id,subject_id,record_id,record_revision,content_version_id,environment,phase,operation_id,request_digest,key_policy_generation,key_binding,result_fingerprint,authority_expires_at,completed_at)
 VALUES(t.token_hash,pg_backend_pid(),pg_current_xact_id(),workspace,t.subject_id,rid,revision,cid,p_environment,p_phase,
  CASE WHEN p_phase IN ('commit','recover') THEN (p_result->>'operationId')::uuid ELSE NULL END,CASE WHEN p_phase IN ('commit','recover') THEN p_result->>'requestDigest' ELSE NULL END,
  CASE WHEN p_phase='recover' THEN NULL ELSE (b->>'generation')::bigint END,CASE WHEN p_phase='recover' THEN NULL ELSE b->'binding' END,
  garden_control.encrypted_delivery_fingerprint(p_result),expiry,point);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Encrypted content unavailable';
END $$;

CREATE FUNCTION garden_control.prepare_encrypted_delivery(p_workspace uuid,p_record uuid,p_revision bigint,p_content uuid,p_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE result jsonb; BEGIN
 result:=garden_control.prepare_encrypted_content(p_workspace,p_record,p_revision,p_content,p_environment);
 PERFORM garden_control.complete_encrypted_delivery('prepare',p_environment,result);RETURN result;
END $$;
CREATE FUNCTION garden_control.load_encrypted_delivery(p_workspace uuid,p_record uuid,p_revision bigint,p_content uuid,p_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE result jsonb; BEGIN
 result:=garden_control.load_encrypted_content(p_workspace,p_record,p_revision,p_content,p_environment);
 PERFORM garden_control.complete_encrypted_delivery('load',p_environment,result);RETURN result;
END $$;
CREATE FUNCTION garden_control.commit_encrypted_delivery(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE result jsonb; BEGIN
 result:=garden_control.commit_encrypted_content(p);
 PERFORM garden_control.complete_encrypted_delivery('commit',p#>>'{envelope,context,environment}',result);RETURN result;
END $$;
CREATE FUNCTION garden_control.recover_encrypted_delivery(p_workspace uuid,p_record uuid,p_operation uuid,p_digest text,p_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE result jsonb; BEGIN
 result:=garden_control.encrypted_content_receipt(p_workspace,p_record,p_operation,p_digest);
 PERFORM garden_control.complete_encrypted_delivery('recover',p_environment,result);RETURN result;
END $$;

CREATE FUNCTION garden_control.current_encrypted_delivery() RETURNS garden_control.encrypted_delivery_contexts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE c garden_control.encrypted_delivery_contexts%ROWTYPE;
BEGIN
 SELECT d.* INTO STRICT c FROM garden_control.encrypted_delivery_contexts d JOIN garden_control.policy_contexts pc ON pc.token_hash=d.token_hash AND pc.backend_pid=d.backend_pid AND pc.transaction_id=d.transaction_id
  WHERE d.backend_pid=pg_backend_pid() AND d.transaction_id=pg_current_xact_id_if_assigned();
 RETURN c;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Encrypted content unavailable';
END $$;
CREATE FUNCTION garden_control.encrypted_delivery_admission() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE c garden_control.encrypted_delivery_contexts%ROWTYPE; BEGIN
 c:=garden_control.current_encrypted_delivery();IF c.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 RETURN garden_control.check_encrypted_delivery_row(c);
END $$;
CREATE FUNCTION garden_control.clear_encrypted_delivery() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE c garden_control.encrypted_delivery_contexts%ROWTYPE; BEGIN
 c:=garden_control.current_encrypted_delivery();IF c.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 PERFORM garden_control.check_encrypted_delivery_row(c);
 -- Keep the bound policy context until the deferred COMMIT gate has run.
 UPDATE garden_control.encrypted_delivery_contexts SET closed_at=clock_timestamp() WHERE token_hash=c.token_hash;
END $$;
CREATE FUNCTION garden_control.encrypted_delivery_commit_fresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE c garden_control.encrypted_delivery_contexts%ROWTYPE; BEGIN
 IF NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id() THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 c:=garden_control.current_encrypted_delivery();
 IF c.token_hash<>NEW.token_hash OR c.closed_at IS NULL OR c.completed_at IS NULL THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 PERFORM garden_control.check_encrypted_delivery_row(c);RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER encrypted_delivery_commit_fresh AFTER INSERT ON garden_control.encrypted_delivery_contexts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_control.encrypted_delivery_commit_fresh();

CREATE FUNCTION garden_control.invalidate_encrypted_delivery(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 DELETE FROM garden_control.encrypted_delivery_contexts WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
 PERFORM garden_control.invalidate_policy_ticket(p_token);
END $$;
CREATE FUNCTION garden_control.encrypted_delivery_finish_fresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
BEGIN
 IF NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id() OR NEW.expires_at<=clock_timestamp() OR NOT garden_control.consent_allows(NEW.workspace_id,NEW.record_id,'research',clock_timestamp()) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER encrypted_delivery_finish_fresh AFTER INSERT ON garden_control.encrypted_delivery_checks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_control.encrypted_delivery_finish_fresh();
CREATE FUNCTION garden_control.finish_encrypted_delivery(p_token text,p_result_fingerprint text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE c garden_control.encrypted_delivery_contexts%ROWTYPE; t garden_control.policy_tickets%ROWTYPE; fresh text; admission jsonb; expiry timestamptz;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' OR p_result_fingerprint IS NULL OR p_result_fingerprint !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 SELECT * INTO c FROM garden_control.encrypted_delivery_contexts WHERE token_hash=sha256(convert_to(p_token,'UTF8'));
 IF NOT FOUND OR c.completed_at IS NULL OR c.closed_at IS NULL OR c.authority_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 -- The completion must belong to a previously committed, different transaction.
 IF c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id() THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(c.workspace_id::text));
 SELECT * INTO STRICT t FROM garden_control.policy_tickets WHERE token_hash=c.token_hash FOR UPDATE;
 SELECT * INTO STRICT c FROM garden_control.encrypted_delivery_contexts WHERE token_hash=t.token_hash FOR UPDATE;
 IF c.result_fingerprint<>p_result_fingerprint OR c.closed_at IS NULL OR c.authority_expires_at<=clock_timestamp() OR t.used_at IS NULL OR t.expires_at<=clock_timestamp() OR t.workspace_id<>c.workspace_id OR t.subject_id<>c.subject_id OR t.record_scope IS DISTINCT FROM c.record_id OR t.purpose<>'research' OR t.action IS DISTINCT FROM (CASE WHEN c.phase='load' THEN 'read' ELSE 'write' END) OR NOT EXISTS(SELECT 1 FROM garden_control.policy_contexts pc WHERE pc.token_hash=c.token_hash AND pc.backend_pid=c.backend_pid AND pc.transaction_id=c.transaction_id) THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;
 -- A new policy context is bound on THIS issuer PID/xid. Never reuse the
 -- original main token or accept caller-supplied phase/actor/scope/result JSON.
 fresh:=garden_control.issue_policy_ticket(c.workspace_id,c.subject_id,CASE WHEN c.phase='load' THEN 'read' ELSE 'write' END,c.record_id);
 PERFORM garden_control.bind_policy_context(fresh);
 admission:=garden_control.check_encrypted_delivery_row(c);expiry:=(admission->>'expiresAt')::timestamptz;
 INSERT INTO garden_control.encrypted_delivery_checks VALUES(pg_backend_pid(),pg_current_xact_id(),c.workspace_id,c.record_id,expiry);
 PERFORM garden_control.invalidate_encrypted_delivery(p_token);
 PERFORM garden_control.invalidate_policy_ticket(fresh);
 DELETE FROM garden_control.encrypted_delivery_checks WHERE backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id();
 IF expiry<=clock_timestamp() THEN RAISE EXCEPTION 'Encrypted content unavailable'; END IF;RETURN admission;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Encrypted content unavailable';
END $$;

-- The fixed runtime cannot bypass the new completion contract by invoking the
-- old entry points. SECURITY DEFINER wrappers retain owner access to 0013.
REVOKE EXECUTE ON FUNCTION garden_control.prepare_encrypted_content(uuid,uuid,bigint,uuid,text),garden_control.load_encrypted_content(uuid,uuid,bigint,uuid,text),garden_control.commit_encrypted_content(jsonb),garden_control.encrypted_content_receipt(uuid,uuid,uuid,text),garden_control.check_encrypted_commit(uuid,text),garden_control.clear_policy_context() FROM garden_encryption;
DO $functions$ DECLARE signature regprocedure; BEGIN
 FOR signature IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='garden_control' AND p.proname IN (
  'encrypted_delivery_fingerprint','encrypted_delivery_value','check_encrypted_delivery_row','complete_encrypted_delivery',
  'prepare_encrypted_delivery','load_encrypted_delivery','commit_encrypted_delivery','recover_encrypted_delivery',
  'current_encrypted_delivery','encrypted_delivery_admission','clear_encrypted_delivery','encrypted_delivery_commit_fresh',
  'invalidate_encrypted_delivery','encrypted_delivery_finish_fresh','finish_encrypted_delivery') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,garden_public,garden_research,garden_publisher,garden_worker,garden_context_issuer,garden_membership_admin,garden_consent_admin,garden_audit_reader,garden_audit_writer,garden_encryption,garden_lifecycle_requester,garden_lifecycle_admin',signature);
 END LOOP;
END $functions$;
GRANT EXECUTE ON FUNCTION garden_control.prepare_encrypted_delivery(uuid,uuid,bigint,uuid,text),garden_control.load_encrypted_delivery(uuid,uuid,bigint,uuid,text),garden_control.commit_encrypted_delivery(jsonb),garden_control.recover_encrypted_delivery(uuid,uuid,uuid,text,text),garden_control.encrypted_delivery_admission(),garden_control.clear_encrypted_delivery() TO garden_encryption;
GRANT EXECUTE ON FUNCTION garden_control.finish_encrypted_delivery(text,text),garden_control.invalidate_encrypted_delivery(text) TO garden_context_issuer;
RESET ROLE;
