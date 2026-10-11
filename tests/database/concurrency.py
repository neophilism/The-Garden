"""Real PostgreSQL concurrency probes, ephemeral loopback CI database only."""
import concurrent.futures
import os
import subprocess
import time
from uuid import uuid4
if os.environ.get('GARDEN_DB_TARGET')!='ci' or os.environ.get('PGHOST')!='127.0.0.1' or os.environ.get('PGUSER')!='postgres':
    raise SystemExit('Refuse concurrency mutation outside ephemeral CI')
def sql(text, timeout=8):
    p=subprocess.run(['psql','-X','-w','-qAt','-v','ON_ERROR_STOP=1','-c',text],text=True,capture_output=True,timeout=timeout)
    if p.returncode:raise AssertionError('ephemeral database operation rejected')
    return p.stdout.strip()
g,subject,scope,ref,trace,worker=[str(uuid4()) for _ in range(6)]
sql(f"INSERT INTO garden_control.job_grants VALUES('{g}','{subject}','{scope}',1,false,clock_timestamp()+interval '1 hour')")
def enqueue(key):
    return sql(f"SELECT garden_control.enqueue_job('{key}','{g}','{subject}','{scope}',1,'verify-object','{ref}','restricted','{trace}')")
key=str(uuid4())
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    ids=list(pool.map(enqueue,[key]*4))
assert len(set(ids))==1, 'concurrent idempotency produced more than one job'
a=ids[0]
b=enqueue(str(uuid4()))
held_env={**os.environ,'PGAPPNAME':'garden-queue-concurrency-lock'}
held=subprocess.Popen(['psql','-X','-w','-qAt','-v','ON_ERROR_STOP=1','-c',f"BEGIN; SELECT job_id FROM garden_control.jobs WHERE job_id='{a}' FOR UPDATE; SELECT pg_sleep(3); COMMIT;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=held_env)
try:
    for _ in range(40):
        if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='garden-queue-concurrency-lock' AND wait_event='PgSleep'")=='1':break
        time.sleep(.05)
    else:raise AssertionError('lock holder did not reach known locked state')
    claimed=sql(f"SET statement_timeout='1s'; SELECT job_id FROM garden_control.claim_jobs('{worker}',1,60)")
    assert claimed==b, 'SKIP LOCKED did not select only the unlocked job'
    held.communicate(timeout=6)
    assert held.returncode==0, 'lock holder transaction failed'
    claimed=sql(f"SELECT job_id FROM garden_control.claim_jobs('{worker}',1,60)")
    assert claimed==a, 'released row was not claimable exactly once'
    assert sql(f"SELECT count(*) FROM garden_control.claim_jobs('{worker}',20,60)")=='0', 'live leases duplicated'
finally:
    if held.poll() is None:
        held.terminate();held.communicate(timeout=3)
print('PASS: four concurrent enqueues deduplicated; locked job skipped; released job claimed; live leases not duplicated')
