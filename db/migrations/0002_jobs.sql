-- No raw content, personal identities or secrets: opaque references only.
-- All processing is disabled until trusted job grants are supplied by policy.
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_worker') THEN
  CREATE ROLE garden_worker NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='garden_worker' AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'unsafe worker role'; END IF;
 EXECUTE format('GRANT garden_worker TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $roles$;
SET LOCAL ROLE garden_migrator;
GRANT USAGE ON SCHEMA garden_control TO garden_worker;
CREATE TABLE garden_control.job_grants(
 grant_id uuid PRIMARY KEY, subject_id uuid NOT NULL, scope_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version>0), revoked boolean NOT NULL DEFAULT true,
 valid_until timestamptz NOT NULL
);
CREATE TABLE garden_control.jobs(
 job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), idempotency_key uuid NOT NULL UNIQUE,
 grant_id uuid NOT NULL REFERENCES garden_control.job_grants, subject_id uuid NOT NULL, scope_id uuid NOT NULL,
 grant_version bigint NOT NULL, kind text NOT NULL CHECK(kind IN ('verify-object','transcribe-source','refresh-publication')),
 content_ref uuid NOT NULL, classification text NOT NULL CHECK(classification IN ('public','restricted')),
 trace_id uuid NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','cancelled','dead')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 10),
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(), lease_owner uuid, lease_epoch integer NOT NULL DEFAULT 0,
 lease_until timestamptz, last_error text CHECK(last_error IN ('transient','corrupt','revoked','lease-expired','cancelled')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((status='running')=(lease_owner IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX jobs_ready ON garden_control.jobs(available_at,created_at) WHERE status IN ('queued','running');
CREATE TABLE garden_control.job_results(job_id uuid PRIMARY KEY REFERENCES garden_control.jobs,result_ref uuid NOT NULL,committed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE garden_control.outbox(event_id uuid PRIMARY KEY,job_id uuid NOT NULL UNIQUE REFERENCES garden_control.jobs,result_ref uuid NOT NULL,classification text NOT NULL,trace_id uuid NOT NULL,schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE garden_control.consumer_receipts(event_id uuid REFERENCES garden_control.outbox,consumer text CHECK(consumer ~ '^[a-z][a-z0-9_-]{0,63}$'),received_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(event_id,consumer));
DO $tables$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['job_grants','jobs','job_results','outbox','consumer_receipts'] LOOP
  EXECUTE format('ALTER TABLE garden_control.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('ALTER TABLE garden_control.%I FORCE ROW LEVEL SECURITY',n);
  EXECUTE format('CREATE POLICY owner_only ON garden_control.%I TO garden_migrator USING (true) WITH CHECK (true)',n);
 END LOOP;
END $tables$;
CREATE FUNCTION garden_control.enqueue_job(p_key uuid,p_grant uuid,p_subject uuid,p_scope uuid,p_version bigint,p_kind text,p_ref uuid,p_class text,p_trace uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog,garden_control AS $fn$
DECLARE g garden_control.job_grants; j garden_control.jobs;
BEGIN
 SELECT * INTO g FROM garden_control.job_grants WHERE grant_id=p_grant FOR SHARE;
 IF NOT FOUND OR g.revoked OR g.version<>p_version OR g.subject_id<>p_subject OR g.scope_id<>p_scope OR g.valid_until<=clock_timestamp() THEN RAISE EXCEPTION 'job authorization rejected'; END IF;
 INSERT INTO garden_control.jobs(idempotency_key,grant_id,subject_id,scope_id,grant_version,kind,content_ref,classification,trace_id)
 VALUES(p_key,p_grant,p_subject,p_scope,p_version,p_kind,p_ref,p_class,p_trace) ON CONFLICT(idempotency_key) DO NOTHING;
 SELECT * INTO j FROM garden_control.jobs WHERE idempotency_key=p_key;
 IF ROW(j.grant_id,j.subject_id,j.scope_id,j.grant_version,j.kind,j.content_ref,j.classification,j.trace_id) IS DISTINCT FROM ROW(p_grant,p_subject,p_scope,p_version,p_kind,p_ref,p_class,p_trace) THEN RAISE EXCEPTION 'idempotency key conflict'; END IF;
 RETURN j.job_id;
END $fn$;
CREATE FUNCTION garden_control.claim_jobs(p_worker uuid,p_limit integer DEFAULT 1,p_seconds integer DEFAULT 60)
RETURNS SETOF garden_control.jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control AS $fn$
BEGIN
 IF p_worker IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR p_seconds IS NULL OR p_seconds NOT BETWEEN 15 AND 300 THEN RAISE EXCEPTION 'invalid lease request'; END IF;
 UPDATE garden_control.jobs j SET status='cancelled',lease_owner=NULL,lease_until=NULL,last_error='revoked',updated_at=clock_timestamp()
 WHERE j.status IN ('queued','running') AND NOT EXISTS(SELECT 1 FROM garden_control.job_grants g WHERE g.grant_id=j.grant_id AND g.version=j.grant_version AND g.subject_id=j.subject_id AND g.scope_id=j.scope_id AND NOT g.revoked AND g.valid_until>clock_timestamp());
 UPDATE garden_control.jobs SET status='dead',lease_owner=NULL,lease_until=NULL,last_error='lease-expired',updated_at=clock_timestamp()
 WHERE status='running' AND lease_until<=clock_timestamp() AND attempts>=max_attempts;
 RETURN QUERY WITH selected AS (
  SELECT j.job_id FROM garden_control.jobs j WHERE j.attempts<j.max_attempts AND ((j.status='queued' AND j.available_at<=clock_timestamp()) OR (j.status='running' AND j.lease_until<=clock_timestamp()))
  ORDER BY j.available_at,j.created_at,j.job_id FOR UPDATE SKIP LOCKED LIMIT p_limit
 ) UPDATE garden_control.jobs j SET status='running',lease_owner=p_worker,lease_epoch=j.lease_epoch+1,lease_until=clock_timestamp()+make_interval(secs=>p_seconds),attempts=j.attempts+1,updated_at=clock_timestamp()
 FROM selected s WHERE s.job_id=j.job_id RETURNING j.*;
END $fn$;
CREATE FUNCTION garden_control.complete_job(p_job uuid,p_worker uuid,p_epoch integer,p_event uuid,p_result uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control AS $fn$
DECLARE j garden_control.jobs; g garden_control.job_grants;
BEGIN
 SELECT * INTO j FROM garden_control.jobs WHERE job_id=p_job FOR UPDATE;
 IF NOT FOUND OR j.status<>'running' OR j.lease_owner IS DISTINCT FROM p_worker OR j.lease_epoch IS DISTINCT FROM p_epoch OR j.lease_until<=clock_timestamp() THEN RETURN false; END IF;
 SELECT * INTO g FROM garden_control.job_grants WHERE grant_id=j.grant_id FOR SHARE;
 IF NOT FOUND OR g.revoked OR g.version<>j.grant_version OR g.subject_id<>j.subject_id OR g.scope_id<>j.scope_id OR g.valid_until<=clock_timestamp() THEN
  UPDATE garden_control.jobs SET status='cancelled',lease_owner=NULL,lease_until=NULL,last_error='revoked',updated_at=clock_timestamp() WHERE job_id=p_job; RETURN false;
 END IF;
 INSERT INTO garden_control.job_results(job_id,result_ref) VALUES(p_job,p_result);
 INSERT INTO garden_control.outbox(event_id,job_id,result_ref,classification,trace_id) VALUES(p_event,p_job,p_result,j.classification,j.trace_id);
 UPDATE garden_control.jobs SET status='succeeded',lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE job_id=p_job;
 RETURN true;
END $fn$;
CREATE FUNCTION garden_control.fail_job(p_job uuid,p_worker uuid,p_epoch integer,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control AS $fn$
DECLARE j garden_control.jobs;
BEGIN
 IF p_reason IS NULL OR p_reason NOT IN ('transient','corrupt','revoked') THEN RAISE EXCEPTION 'unsafe diagnostic'; END IF;
 SELECT * INTO j FROM garden_control.jobs WHERE job_id=p_job FOR UPDATE;
 IF NOT FOUND OR j.status<>'running' OR j.lease_owner IS DISTINCT FROM p_worker OR j.lease_epoch IS DISTINCT FROM p_epoch OR j.lease_until<=clock_timestamp() THEN RETURN false; END IF;
 UPDATE garden_control.jobs SET status=CASE WHEN p_reason='revoked' THEN 'cancelled' WHEN p_reason='corrupt' OR attempts>=max_attempts THEN 'dead' ELSE 'queued' END,
  lease_owner=NULL,lease_until=NULL,last_error=p_reason,available_at=clock_timestamp()+make_interval(secs=>least(300,power(2,j.attempts)::integer)),updated_at=clock_timestamp() WHERE job_id=p_job;
 RETURN true;
END $fn$;
CREATE FUNCTION garden_control.cancel_job(p_job uuid) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,garden_control AS $fn$
DECLARE changed integer;
BEGIN
 UPDATE garden_control.jobs SET status='cancelled',lease_owner=NULL,lease_until=NULL,last_error='cancelled',updated_at=clock_timestamp() WHERE job_id=p_job AND status IN ('queued','running');
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $fn$;
-- Call within the SAME transaction as a consumer's database side effect.
-- It cannot guarantee exactly-once delivery to external systems.
CREATE FUNCTION garden_control.consume_event(p_event uuid,p_consumer text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control AS $fn$
DECLARE j garden_control.jobs; g garden_control.job_grants; changed integer;
BEGIN
 IF p_consumer IS NULL OR p_consumer !~ '^[a-z][a-z0-9_-]{0,63}$' THEN RAISE EXCEPTION 'invalid consumer'; END IF;
 PERFORM 1 FROM garden_control.outbox WHERE event_id=p_event FOR UPDATE; IF NOT FOUND THEN RETURN false; END IF;
 SELECT x.* INTO j FROM garden_control.jobs x JOIN garden_control.outbox e ON e.job_id=x.job_id WHERE e.event_id=p_event;
 SELECT * INTO g FROM garden_control.job_grants WHERE grant_id=j.grant_id FOR SHARE;
 IF NOT FOUND OR g.revoked OR g.version<>j.grant_version OR g.subject_id<>j.subject_id OR g.scope_id<>j.scope_id OR g.valid_until<=clock_timestamp() THEN RETURN false; END IF;
 INSERT INTO garden_control.consumer_receipts(event_id,consumer) VALUES(p_event,p_consumer) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $fn$;
REVOKE ALL ON FUNCTION garden_control.enqueue_job(uuid,uuid,uuid,uuid,bigint,text,uuid,text,uuid),garden_control.claim_jobs(uuid,integer,integer),garden_control.complete_job(uuid,uuid,integer,uuid,uuid),garden_control.fail_job(uuid,uuid,integer,text),garden_control.cancel_job(uuid),garden_control.consume_event(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.claim_jobs(uuid,integer,integer),garden_control.complete_job(uuid,uuid,integer,uuid,uuid),garden_control.fail_job(uuid,uuid,integer,text),garden_control.consume_event(uuid,text) TO garden_worker;
RESET ROLE;
