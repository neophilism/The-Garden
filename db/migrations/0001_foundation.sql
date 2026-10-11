-- Synthetic, additive schema only. Run as bootstrap administrator in one transaction.
-- No source records, login credentials, tenant policy, or publication approval is added.
SELECT pg_advisory_xact_lock(144731, 13);
DO $guard$
DECLARE r record; name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['garden_migrator','garden_research','garden_public','garden_publisher'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', name);
    END IF;
    SELECT * INTO r FROM pg_roles WHERE rolname=name;
    IF r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolinherit THEN
      RAISE EXCEPTION 'Existing Garden role attributes differ from reviewed foundation';
    END IF;
    EXECUTE format('GRANT %I TO %I WITH INHERIT FALSE, SET TRUE', name, current_user);
  END LOOP;
END $guard$;
CREATE SCHEMA IF NOT EXISTS garden_control AUTHORIZATION garden_migrator;
CREATE SCHEMA IF NOT EXISTS garden_private AUTHORIZATION garden_migrator;
CREATE SCHEMA IF NOT EXISTS garden_publication AUTHORIZATION garden_migrator;
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('garden_control','garden_private','garden_publication') AND nspowner<>(SELECT oid FROM pg_roles WHERE rolname='garden_migrator')) THEN
  RAISE EXCEPTION 'Existing Garden schema has unexpected owner';
 END IF;
END $guard$;
SET LOCAL ROLE garden_migrator;
REVOKE ALL ON SCHEMA garden_control, garden_private, garden_publication FROM PUBLIC;
GRANT USAGE ON SCHEMA garden_private TO garden_research;
GRANT USAGE ON SCHEMA garden_publication TO garden_public, garden_publisher;
ALTER DEFAULT PRIVILEGES FOR ROLE garden_migrator IN SCHEMA garden_private REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE garden_migrator IN SCHEMA garden_publication REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE garden_migrator IN SCHEMA garden_control REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE garden_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE IF NOT EXISTS garden_control.schema_migrations (
  migration_id text PRIMARY KEY,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS garden_control.deployment_binding (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  repository text NOT NULL CHECK (repository='neophilism/The-Garden'),
  environment text NOT NULL CHECK (environment IN ('ci','staging')),
  project_id text NOT NULL,
  branch_id text NOT NULL,
  database_name text NOT NULL
);
CREATE TABLE IF NOT EXISTS garden_private.access_probe (
  id text PRIMARY KEY CHECK (id='synthetic-private-probe'),
  description text NOT NULL CHECK (description='synthetic only; no research records')
);
-- Insert only on first application, before the deny-all RLS boundary exists.
DO $seed$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM garden_control.schema_migrations WHERE migration_id='0001_foundation') THEN
  INSERT INTO garden_private.access_probe VALUES ('synthetic-private-probe','synthetic only; no research records') ON CONFLICT DO NOTHING;
 END IF;
END $seed$;
ALTER TABLE garden_private.access_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_private.access_probe FORCE ROW LEVEL SECURITY;
GRANT SELECT ON garden_private.access_probe TO garden_research;
CREATE TABLE IF NOT EXISTS garden_publication.public_probe (
  id text PRIMARY KEY CHECK (id='synthetic-public-probe'),
  description text NOT NULL CHECK (description='synthetic only; not a published historical claim')
);
INSERT INTO garden_publication.public_probe VALUES ('synthetic-public-probe','synthetic only; not a published historical claim') ON CONFLICT DO NOTHING;
GRANT SELECT ON garden_publication.public_probe TO garden_public;
RESET ROLE;
