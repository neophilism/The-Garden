"""Generated >400 MB SQLite source, real extraction under a 256 MiB AS cap."""
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from staging_fixture import ROOT, contract


class StagingScaleTests(unittest.TestCase):
    def test_large_database_uses_bounded_memory(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'generated-large.sqlite'
            with sqlite3.connect(path) as db:
                db.execute('CREATE TABLE payloads(id INTEGER, value BLOB)')
                db.executemany('INSERT INTO payloads VALUES(?,?)',((i,bytes([i%256])*65536) for i in range(6400)))
            self.assertGreater(path.stat().st_size,396087296)
            config = contract(directory,path)
            harness = '''import importlib.util,json,resource,sys
spec=importlib.util.spec_from_file_location('stage',sys.argv[1])
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.constrain()
result=m.stage(json.load(sys.stdin),lambda phase:True)
print(json.dumps({'result':result,'peak_rss_kib':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}))
'''
            result = subprocess.run([sys.executable,'-I','-c',harness,str(ROOT/'services/workers/import/stage.py')],
                                    input=json.dumps(config),text=True,capture_output=True,timeout=180,check=True)
            evidence = json.loads(result.stdout)
            self.assertEqual(evidence['result']['rows'],6400)
            self.assertLess(evidence['peak_rss_kib'],200*1024)
            print('Synthetic scale evidence: '+json.dumps({'source_bytes':path.stat().st_size,
                  'rows':6400,'peak_rss_kib':evidence['peak_rss_kib'],'address_space_limit_mib':256}),flush=True)


if __name__=='__main__':
    unittest.main()
