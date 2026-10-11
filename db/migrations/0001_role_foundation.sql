-- GDN-013 candidate: apply once to the authorized empty Garden database.
-- No passwords, user data, extensions or existing-object rewrites.
-- All statements and assertion canaries run atomically in this DO statement.
DO $garden_foundation$
DECLARE
  role_name text;
  visible_rows bigint;
BEGIN
  IF current_database() <> 'neondb' OR session_user <> 'neondb_owner'
     OR current_setting('server_version_num')::integer < 180000 THEN
    RAISE EXCEPTION 'Garden foundation: unexpected database/operator/version';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname LIKE 'garden_%')
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname LIKE 'garden_%') THEN
    RAISE EXCEPTION 'Garden foundation already exists or namespace collision: inspect, do not overwrite';
  END IF;

  FOREACH role_name IN ARRAY ARRAY[
    'garden_schema_owner','garden_migrator','garden_research_runtime',
    'garden_publication_writer','garden_public_reader'
  ] LOOP
    EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS', role_name);
    -- The existing bootstrap administrator manages the new group roles.
    EXECUTE format('GRANT %I TO %I WITH ADMIN OPTION', role_name, session_user);
  END LOOP;
  GRANT garden_schema_owner TO garden_migrator WITH INHERIT FALSE, SET TRUE;

  CREATE SCHEMA garden_control AUTHORIZATION garden_schema_owner;
  CREATE SCHEMA garden_private AUTHORIZATION garden_schema_owner;
  SET LOCAL ROLE garden_schema_owner;
  REVOKE ALL ON SCHEMA garden_control, garden_private FROM PUBLIC;
  GRANT USAGE ON SCHEMA garden_control, garden_private TO garden_research_runtime;
  GRANT USAGE ON SCHEMA garden_private TO garden_publication_writer;

  CREATE TABLE garden_control.migration_history (
    migration_id text PRIMARY KEY,
    source_ref text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
  );
  ALTER TABLE garden_control.migration_history ENABLE ROW LEVEL SECURITY;
  ALTER TABLE garden_control.migration_history FORCE ROW LEVEL SECURITY;
  CREATE POLICY migration_owner_only ON garden_control.migration_history
    FOR ALL TO garden_schema_owner USING (true) WITH CHECK (true);
  REVOKE ALL ON garden_control.migration_history FROM PUBLIC;
  INSERT INTO garden_control.migration_history(migration_id, source_ref)
    VALUES ('0001_role_foundation', 'GDN-013/0001 source-controlled candidate');

  ALTER DEFAULT PRIVILEGES FOR ROLE garden_schema_owner IN SCHEMA garden_control, garden_private
    REVOKE ALL ON TABLES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE garden_schema_owner IN SCHEMA garden_control, garden_private
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE garden_schema_owner IN SCHEMA garden_control, garden_private
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

  -- Grant SELECT only during the canary, to test RLS rather than a missing grant.
  GRANT SELECT ON garden_control.migration_history TO garden_research_runtime;
  RESET ROLE;
  SET LOCAL ROLE garden_research_runtime;
  SELECT count(*) INTO visible_rows FROM garden_control.migration_history;
  IF visible_rows <> 0 THEN RAISE EXCEPTION 'Runtime RLS canary failed'; END IF;
  BEGIN
    CREATE TABLE garden_private.forbidden_runtime_ddl(id integer);
    RAISE EXCEPTION 'Runtime unexpectedly created a table';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    ALTER TABLE garden_control.migration_history ADD COLUMN forbidden_runtime_alter integer;
    RAISE EXCEPTION 'Runtime unexpectedly altered migration history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- SET ROLE permission itself uses session_user, so testing owner-role
  -- assumption in this administrator session would be misleading. Membership
  -- is checked below; independent runtime LOGIN tests remain an activation gate.
  RESET ROLE;
  SET LOCAL ROLE garden_schema_owner;
  REVOKE SELECT ON garden_control.migration_history FROM garden_research_runtime;
  RESET ROLE;

  FOREACH role_name IN ARRAY ARRAY['garden_research_runtime','garden_publication_writer','garden_public_reader'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication OR rolcanlogin)) THEN
      RAISE EXCEPTION 'Unsafe runtime group role attributes';
    END IF;
    IF pg_has_role(role_name, 'garden_schema_owner', 'MEMBER')
       OR pg_has_role(role_name, 'garden_migrator', 'MEMBER')
       OR has_schema_privilege(role_name, 'public', 'CREATE')
       OR has_schema_privilege(role_name, 'garden_private', 'CREATE')
       OR has_table_privilege(role_name, 'garden_control.migration_history', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'Unexpected runtime migration or private-control privilege';
    END IF;
  END LOOP;
  IF has_schema_privilege('garden_public_reader', 'garden_private', 'USAGE') THEN
    RAISE EXCEPTION 'Public-reader private-schema boundary failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='garden_control' AND c.relname='migration_history'
    AND c.relrowsecurity AND c.relforcerowsecurity) THEN
    RAISE EXCEPTION 'Forced RLS not established';
  END IF;
END
$garden_foundation$;
