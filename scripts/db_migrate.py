#!/usr/bin/env python3
"""Plan/apply checksum-locked synthetic migrations using psql, never production.
The operator supplies PG* credentials in a private environment; never printed
or placed on the command line. CI uses an ephemeral loopback database.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'royal-union-78374030'
STAGING_BRANCH = 'br-purple-grass-b5hurfl7'
STAGING_HOST = 'ep-round-recipe-b5mlz2vw.c-7.us-east-2.aws.neon.tech'
class MigrationError(ValueError):
    """Safe diagnostic code only, never connection details."""
def target(env):
    name = env.get('GARDEN_DB_TARGET')
    if name not in ('ci', 'staging'): raise MigrationError('target_not_authorized')
    if any(env.get(k) for k in ('PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR', 'PGOPTIONS')): raise MigrationError('connection_override')
    if env.get('PGPORT', '5432') != '5432' or env.get('PGDATABASE') != 'neondb': raise MigrationError('database_binding')
    if name == 'ci':
        if env.get('PGHOST') not in ('127.0.0.1', 'localhost') or env.get('PGUSER') != 'postgres': raise MigrationError('ci_not_loopback_admin')
        return name, 'ci-local', 'ci-ephemeral'
    if env.get('PGHOST') != STAGING_HOST or env.get('PGUSER') != 'neondb_owner': raise MigrationError('staging_host_or_role')
    if env.get('PGSSLMODE') != 'verify-full' or env.get('PGCHANNELBINDING') != 'require': raise MigrationError('transport_policy')
    if env.get('NEON_PROJECT_ID') != PROJECT or env.get('NEON_BRANCH_ID') != STAGING_BRANCH: raise MigrationError('provider_binding')
    return name, PROJECT, STAGING_BRANCH

def load_migrations(folder):
    manifest = json.loads((folder / 'manifest.json').read_text())
    rows = manifest.get('migrations')
    if manifest.get('version') != 1 or not isinstance(rows, list) or not rows: raise MigrationError('manifest_shape')
    seen, output = set(), []
    for row in rows:
        mid, fname, expected = row.get('id'), row.get('file'), row.get('sha256')
        if not isinstance(mid, str) or not re.fullmatch(r'\d{4}_[a-z_]+', mid) or mid in seen or fname != mid + '.sql': raise MigrationError('migration_identity')
        if not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected): raise MigrationError('migration_digest')
        path = folder / fname
        if path.is_symlink() or not path.is_file(): raise MigrationError('missing_or_linked_migration')
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected: raise MigrationError('migration_content_drift')
        text = raw.decode('utf-8')
        if any(line.lstrip().startswith('\\') for line in text.splitlines()): raise MigrationError('psql_command_in_migration')
        if re.search(r'\b(DROP|TRUNCATE)\s+(TABLE|SCHEMA|DATABASE|ROLE)', text, re.I): raise MigrationError('destructive_migration_not_supported')
        seen.add(mid)
        output.append((mid, expected, text))
    if [r[0] for r in output] != sorted(seen): raise MigrationError('migration_order')
    return output

def plan_sql(env, folder):
    name, project, branch = target(env)
    migrations = load_migrations(folder)
    lines = ['\\set ON_ERROR_STOP on', 'BEGIN;', "SET LOCAL lock_timeout='5s';", "SET LOCAL statement_timeout='30s';", 'SELECT pg_advisory_xact_lock(144731,13);']
    lines.append(f"DO $binding$ BEGIN IF current_database()<>'neondb' THEN RAISE EXCEPTION 'database_binding'; END IF; IF to_regclass('garden_control.deployment_binding') IS NOT NULL THEN IF EXISTS(SELECT 1 FROM garden_control.deployment_binding WHERE repository<>'neophilism/The-Garden' OR environment<>'{name}' OR project_id<>'{project}' OR branch_id<>'{branch}' OR database_name<>current_database()) THEN RAISE EXCEPTION 'existing_binding_conflict'; END IF; END IF; END $binding$;")
    for mid, digest, text in migrations:
        lines += ["SELECT to_regclass('garden_control.schema_migrations') IS NOT NULL AS history_exists \\gset", '\\if :history_exists', f"SELECT EXISTS(SELECT 1 FROM garden_control.schema_migrations WHERE migration_id='{mid}') AS applied \\gset", '\\else', '\\set applied false', '\\endif', '\\if :applied', f"DO $checksum$ BEGIN IF (SELECT sha256 FROM garden_control.schema_migrations WHERE migration_id='{mid}')<>'{digest}' THEN RAISE EXCEPTION 'stored_migration_digest_conflict'; END IF; END $checksum$;", '\\else', text, 'SET LOCAL ROLE garden_migrator;', f"INSERT INTO garden_control.schema_migrations(migration_id,sha256) VALUES('{mid}','{digest}');", 'RESET ROLE;', '\\endif']
    lines += ['SET LOCAL ROLE garden_migrator;', f"INSERT INTO garden_control.deployment_binding(singleton,repository,environment,project_id,branch_id,database_name) VALUES(true,'neophilism/The-Garden','{name}','{project}','{branch}','neondb') ON CONFLICT DO NOTHING;", 'RESET ROLE;', 'COMMIT;']
    return '\n'.join(lines) + '\n'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        sql = plan_sql(os.environ, ROOT / 'db/migrations')
        if not args.apply:
            print(sql, end='')
            return 0
        completed = subprocess.run(['psql', '-X', '-w', '-q'], input=sql, text=True, capture_output=True, timeout=90)
        if completed.returncode: raise MigrationError('database_transaction_failed_details_suppressed')
        print(json.dumps({'result': 'applied_or_already_current', 'target': os.environ['GARDEN_DB_TARGET'], 'production_changed': False}))
        return 0
    except (ValueError, OSError, UnicodeError, subprocess.SubprocessError):
        print('Garden migration failed: validation_or_transaction_rejected', file=sys.stderr)
        return 1
if __name__ == '__main__': raise SystemExit(main())
