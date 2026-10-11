from pathlib import Path
import hashlib
p=Path('apps/research/review/reviews.ci.mjs');raw=p.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='fc1ff1abd425f1a31fdfb7ca8d7af744daf6df3360298595ceeef6e1a9a1fcb7'
old="SET expires_at=expires_at+interval '1 minute' WHERE workspace_id=$1 AND subject_id='dave'"
new="SET expires_at=expires_at+interval '1 minute',version=version+1 WHERE workspace_id=$1 AND subject_id='dave'"
s=raw.decode('utf-8');assert s.count(old)==1
out=s.replace(old,new).encode('utf-8')
assert hashlib.sha256(out).hexdigest()=='d0010fbf981aef897297575109ca83a4ef66945db6e4063d189093e6e395f837'
p.write_bytes(out)
print('Version-change fixture advances the recorded grant version; runtime revocation checks unchanged.')
