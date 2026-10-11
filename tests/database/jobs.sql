\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE g uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); scope uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); ref uuid:=gen_random_uuid(); trace uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); w2 uuid:=gen_random_uuid(); j uuid; j2 uuid; e uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); lease garden_control.jobs; again garden_control.jobs; ignored uuid;
BEGIN
 INSERT INTO garden_control.job_grants VALUES(g,s,scope,1,false,clock_timestamp()+interval '1 hour');
 j:=garden_control.enqueue_job(k,g,s,scope,1,'verify-object',ref,'restricted',trace);
 IF j<>garden_control.enqueue_job(k,g,s,scope,1,'verify-object',ref,'restricted',trace) THEN RAISE EXCEPTION 'idempotent enqueue failed'; END IF;
 BEGIN
  ignored:=garden_control.enqueue_job(k,g,s,scope,1,'verify-object',gen_random_uuid(),'restricted',trace);
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='incorrectly accepted different reference';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 SELECT * INTO lease FROM garden_control.claim_jobs(w,1,60);
 IF lease.job_id<>j OR lease.attempts<>1 OR lease.lease_epoch<>1 THEN RAISE EXCEPTION 'first claim failed'; END IF;
 IF EXISTS(SELECT 1 FROM garden_control.claim_jobs(w2,1,60)) THEN RAISE EXCEPTION 'duplicate live lease'; END IF;
 IF garden_control.complete_job(j,w2,1,e,r) THEN RAISE EXCEPTION 'wrong worker completed'; END IF;
 BEGIN
  IF NOT garden_control.complete_job(j,w,lease.lease_epoch,e,r) THEN RAISE EXCEPTION 'completion failed'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='simulated crash before commit';
 EXCEPTION WHEN SQLSTATE 'ZX002' THEN NULL; END;
 IF EXISTS(SELECT 1 FROM garden_control.outbox WHERE job_id=j) OR EXISTS(SELECT 1 FROM garden_control.job_results WHERE job_id=j) THEN RAISE EXCEPTION 'outbox/result survived rollback'; END IF;
 IF NOT garden_control.complete_job(j,w,lease.lease_epoch,e,r) THEN RAISE EXCEPTION 'completion retry failed'; END IF;
 IF garden_control.complete_job(j,w,lease.lease_epoch,e,r) THEN RAISE EXCEPTION 'completed job replayed'; END IF;
 IF (SELECT count(*) FROM garden_control.outbox WHERE job_id=j)<>1 THEN RAISE EXCEPTION 'outbox cardinality'; END IF;
 IF NOT garden_control.consume_event(e,'test-consumer') OR garden_control.consume_event(e,'test-consumer') THEN RAISE EXCEPTION 'consumer deduplication failed'; END IF;
 j2:=garden_control.enqueue_job(gen_random_uuid(),g,s,scope,1,'verify-object',ref,'restricted',trace);
 SELECT * INTO lease FROM garden_control.claim_jobs(w,1,60);
 UPDATE garden_control.jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE job_id=j2;
 SELECT * INTO again FROM garden_control.claim_jobs(w2,1,60);
 IF again.job_id<>j2 OR again.lease_epoch<=lease.lease_epoch THEN RAISE EXCEPTION 'lease recovery failed'; END IF;
 IF garden_control.complete_job(j2,w,lease.lease_epoch,gen_random_uuid(),r) THEN RAISE EXCEPTION 'old lease not fenced'; END IF;
 UPDATE garden_control.job_grants SET revoked=true WHERE grant_id=g;
 IF garden_control.complete_job(j2,w2,again.lease_epoch,gen_random_uuid(),r) THEN RAISE EXCEPTION 'revoked job committed'; END IF;
 IF (SELECT status FROM garden_control.jobs WHERE job_id=j2)<>'cancelled' THEN RAISE EXCEPTION 'revoked status wrong'; END IF;
 IF garden_control.consume_event(e,'new-consumer') THEN RAISE EXCEPTION 'revoked outbox dispatched'; END IF;
 UPDATE garden_control.job_grants SET revoked=false,version=2 WHERE grant_id=g;
 BEGIN
  ignored:=garden_control.enqueue_job(gen_random_uuid(),g,s,scope,1,'verify-object',ref,'restricted',trace);
  RAISE EXCEPTION USING ERRCODE='ZX003',MESSAGE='stale grant accepted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 j2:=garden_control.enqueue_job(gen_random_uuid(),g,s,scope,2,'verify-object',ref,'restricted',trace);
 SELECT * INTO lease FROM garden_control.claim_jobs(w,1,60);
 IF NOT garden_control.fail_job(j2,w,lease.lease_epoch,'transient') THEN RAISE EXCEPTION 'retry release failed'; END IF;
 IF EXISTS(SELECT 1 FROM garden_control.claim_jobs(w,1,60)) THEN RAISE EXCEPTION 'backoff ignored'; END IF;
 UPDATE garden_control.jobs SET available_at=clock_timestamp()-interval '1 second' WHERE job_id=j2;
 SELECT * INTO lease FROM garden_control.claim_jobs(w,1,60);
 PERFORM garden_control.fail_job(j2,w,lease.lease_epoch,'corrupt');
 IF (SELECT status FROM garden_control.jobs WHERE job_id=j2)<>'dead' THEN RAISE EXCEPTION 'dead letter missing'; END IF;
 j2:=garden_control.enqueue_job(gen_random_uuid(),g,s,scope,2,'verify-object',ref,'restricted',trace);
 IF NOT garden_control.cancel_job(j2) OR garden_control.cancel_job(j2) THEN RAISE EXCEPTION 'cancel not idempotent'; END IF;
 j2:=garden_control.enqueue_job(gen_random_uuid(),g,s,scope,2,'verify-object',ref,'restricted',trace);
 UPDATE garden_control.jobs SET max_attempts=1 WHERE job_id=j2;
 SELECT * INTO lease FROM garden_control.claim_jobs(w,1,60);
 UPDATE garden_control.jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE job_id=j2;
 PERFORM garden_control.claim_jobs(w2,1,60);
 IF (SELECT status FROM garden_control.jobs WHERE job_id=j2)<>'dead' THEN RAISE EXCEPTION 'exhausted lease not dead'; END IF;
 BEGIN
  ignored:=garden_control.enqueue_job(gen_random_uuid(),g,s,scope,2,'verify-object',ref,'sealed',trace);
  RAISE EXCEPTION USING ERRCODE='ZX004',MESSAGE='sealed data accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF has_function_privilege('garden_public','garden_control.claim_jobs(uuid,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'public queue execute'; END IF;
 IF has_table_privilege('garden_worker','garden_control.jobs','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'worker has raw-table privilege'; END IF;
END $test$;
SET SESSION AUTHORIZATION garden_worker;
DO $test$ BEGIN
 BEGIN PERFORM 1 FROM garden_control.job_grants; RAISE EXCEPTION USING ERRCODE='ZX005',MESSAGE='worker read authorization table'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'SET ROLE garden_migrator'; RAISE EXCEPTION USING ERRCODE='ZX006',MESSAGE='worker became migrator'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
RESET SESSION AUTHORIZATION;
ROLLBACK;
SELECT 'queue leases, rollback, dedupe, revocation, retry, cancellation and privilege tests passed' AS result;
