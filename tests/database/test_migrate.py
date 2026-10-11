from pathlib import Path
import json
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from db_migrate import MigrationError,target,load_migrations,plan_sql
ROOT=Path(__file__).resolve().parents[2]
class MigrationPlannerTests(unittest.TestCase):
 def setUp(self):
  self.ci={'GARDEN_DB_TARGET':'ci','PGHOST':'127.0.0.1','PGPORT':'5432','PGDATABASE':'neondb','PGUSER':'postgres'}
  self.stage={**self.ci,'GARDEN_DB_TARGET':'staging','PGHOST':'ep-round-recipe-b5mlz2vw.c-7.us-east-2.aws.neon.tech','PGUSER':'neondb_owner','PGSSLMODE':'verify-full','PGCHANNELBINDING':'require','NEON_PROJECT_ID':'royal-union-78374030','NEON_BRANCH_ID':'br-purple-grass-b5hurfl7'}
 def test_ci_target(self):self.assertEqual(target(self.ci)[0],'ci')
 def test_exact_staging_target(self):self.assertEqual(target(self.stage)[0],'staging')
 def test_production_forbidden(self):
  with self.assertRaises(MigrationError):target({**self.stage,'GARDEN_DB_TARGET':'production'})
 def test_wrong_project(self):
  with self.assertRaises(MigrationError):target({**self.stage,'NEON_PROJECT_ID':'wrong'})
 def test_production_host(self):
  with self.assertRaises(MigrationError):target({**self.stage,'PGHOST':'ep-blue-pine-b50s0k0x.c-7.us-east-2.aws.neon.tech'})
 def test_pooled_migration_denied(self):
  with self.assertRaises(MigrationError):target({**self.stage,'PGHOST':self.stage['PGHOST'].replace('.c-7','-pooler.c-7')})
 def test_weak_tls(self):
  for value in ['require','disable','prefer']:
   with self.assertRaises(MigrationError):target({**self.stage,'PGSSLMODE':value})
 def test_connection_override(self):
  for key in ['PGSERVICE','PGHOSTADDR','PGOPTIONS','PGSERVICEFILE']:
   with self.assertRaises(MigrationError):target({**self.ci,key:'untrusted'})
 def test_ci_no_remote_host(self):
  with self.assertRaises(MigrationError):target({**self.ci,'PGHOST':'example.invalid'})
 def test_sql_guard_transaction_and_checksum(self):
  s=plan_sql(self.ci,ROOT/'db/migrations')
  for marker in ['BEGIN;','COMMIT;','pg_advisory_xact_lock','existing_binding_conflict','stored_migration_digest_conflict','\\if :applied']:self.assertIn(marker,s)
 def test_password_not_in_plan(self):
  secret='do-not-print-this-synthetic-value'
  self.assertNotIn(secret,plan_sql({**self.ci,'PGPASSWORD':secret},ROOT/'db/migrations'))
 def test_manifest_digest(self):self.assertEqual(load_migrations(ROOT/'db/migrations')[0][0],'0001_foundation')
 def test_changed_file_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'manifest.json').write_bytes((ROOT/'db/migrations/manifest.json').read_bytes());(p/'0001_foundation.sql').write_text('SELECT 1;')
   with self.assertRaises(MigrationError):load_migrations(p)
 def test_traversal_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'manifest.json').write_text(json.dumps({'version':1,'migrations':[{'id':'0001_foundation','file':'../file','sha256':'a'*64}]}))
   with self.assertRaises(MigrationError):load_migrations(p)
 def test_arbitrary_operator_rejected(self):
  with self.assertRaises(MigrationError):target({**self.stage,'PGUSER':'garden_public'})
 def test_wrong_database_rejected(self):
  with self.assertRaises(MigrationError):target({**self.stage,'PGDATABASE':'other'})
 def test_wrong_branch_rejected(self):
  with self.assertRaises(MigrationError):target({**self.stage,'NEON_BRANCH_ID':'br-curly-band-b5aatp1e'})
 def test_channel_binding_required(self):
  with self.assertRaises(MigrationError):target({**self.stage,'PGCHANNELBINDING':'prefer'})
if __name__=='__main__':unittest.main()
