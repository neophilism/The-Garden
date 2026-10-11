\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE g uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); scope uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); j uuid; lease garden_control.jobs;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'ephemeral CI only'; END IF;
 INSERT INTO garden_control.job_grants VALUES(g,s,scope,1,false,clock_timestamp()+interval '1 hour');
 j:=garden_control.enqueue_job(gen_random_uuid(),g,s,scope,1,'verify-object',gen_random_uuid(),'restricted',gen_random_uuid());
 SELECT * INTO lease FROM garden_control.claim_jobs(w,1,60);
 IF lease.job_id<>j OR NOT garden_control.complete_job(j,w,lease.lease_epoch,e,gen_random_uuid()) THEN RAISE EXCEPTION 'synthetic job setup failed'; END IF;
 CREATE TEMP TABLE synthetic_consumer_effects(event_id uuid PRIMARY KEY) ON COMMIT DROP;
 BEGIN
  IF garden_control.consume_event(e,'atomic-consumer') THEN INSERT INTO synthetic_consumer_effects VALUES(e); END IF;
  RAISE EXCEPTION USING ERRCODE='ZX007',MESSAGE='consumer crash before commit';
 EXCEPTION WHEN SQLSTATE 'ZX007' THEN NULL; END;
 IF EXISTS(SELECT 1 FROM garden_control.consumer_receipts WHERE event_id=e AND consumer='atomic-consumer') OR EXISTS(SELECT 1 FROM synthetic_consumer_effects) THEN RAISE EXCEPTION 'consumer transaction not atomic'; END IF;
 IF garden_control.consume_event(e,'atomic-consumer') THEN INSERT INTO synthetic_consumer_effects VALUES(e); END IF;
 IF garden_control.consume_event(e,'atomic-consumer') THEN INSERT INTO synthetic_consumer_effects VALUES(e); END IF;
 IF (SELECT count(*) FROM synthetic_consumer_effects)<>1 THEN RAISE EXCEPTION 'consumer effect duplicated'; END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: consumer effect and receipt roll back and retry together; duplicate has no effect' AS result;
