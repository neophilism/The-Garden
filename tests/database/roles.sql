\set ON_ERROR_STOP on
-- CI superuser session only; never use SET SESSION AUTHORIZATION on Neon.
DO $test$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'ephemeral CI administrator required'; END IF;
 IF (SELECT count(*) FROM garden_private.access_probe)<>1 THEN RAISE EXCEPTION 'missing private test row'; END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('garden_migrator','garden_research','garden_public','garden_publisher') AND NOT (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreaterole OR rolcreatedb OR rolreplication))<>4 THEN RAISE EXCEPTION 'unsafe role attributes'; END IF;
END $test$;
BEGIN;
SET SESSION AUTHORIZATION garden_public;
DO $test$ BEGIN
 IF (SELECT count(*) FROM garden_publication.public_probe)<>1 THEN RAISE EXCEPTION 'public read failed'; END IF;
 BEGIN PERFORM 1 FROM garden_private.access_probe; RAISE EXCEPTION 'private read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN CREATE TABLE garden_publication.not_allowed(id int); RAISE EXCEPTION 'public DDL allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'SET ROLE garden_migrator'; RAISE EXCEPTION 'privilege escalation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
RESET SESSION AUTHORIZATION;
ROLLBACK;
BEGIN;
SET SESSION AUTHORIZATION garden_research;
DO $test$ BEGIN
 IF (SELECT count(*) FROM garden_private.access_probe)<>0 THEN RAISE EXCEPTION 'RLS failed'; END IF;
 BEGIN CREATE TABLE garden_private.not_allowed(id int); RAISE EXCEPTION 'research DDL allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM garden_control.schema_migrations; RAISE EXCEPTION 'control read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'SET ROLE garden_migrator'; RAISE EXCEPTION 'escalation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
RESET SESSION AUTHORIZATION;
ROLLBACK;
BEGIN;
SET LOCAL ROLE garden_migrator;
DO $test$ BEGIN IF (SELECT count(*) FROM garden_private.access_probe)<>0 THEN RAISE EXCEPTION 'owner bypassed FORCE RLS'; END IF; END $test$;
ROLLBACK;
DO $test$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'transaction role leaked into reused session'; END IF;
 IF (SELECT count(*) FROM garden_private.access_probe)<>1 THEN RAISE EXCEPTION 'role test changed source row'; END IF;
 IF (SELECT count(*) FROM garden_control.schema_migrations)<>1 THEN RAISE EXCEPTION 'migration not idempotent'; END IF;
END $test$;
SELECT 'permission, escalation, force-RLS, idempotency and role-reset tests passed' AS result;
