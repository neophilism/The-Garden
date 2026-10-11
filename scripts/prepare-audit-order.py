"""One-time exact-source repair; removed by the branch-only preparation workflow."""
from pathlib import Path
import hashlib

rules = {
'apps/research/access/audit.mjs': ('d42e3b226969f2e5f01b27a8b844322e4744a49c011bde12a022cb0e1d20d73e','2c42d3b1d78f0cce72cbcbecd637be5e674646f0cd620922fd890035a9c06350'),
'apps/research/access/audit.ci.mjs': ('d31d3cb775bc90a59411e4e0f93962c33a219c46a7914de7e472de1a557da302','91e586ad09fd29536e257462c26f10b93aca6a9b76aef665ae5f404604514afb'),
'tests/access/audit.test.mjs': ('4e4fc25865146aa48e95c587be5612ffd9be0f0f5df5d38129fc04f5fa6e776a','439085423bba5c61ac2c037ca27cbeb90fd90459484253f3fc964ca319841459')}
texts = {}
for name,(before,after) in rules.items():
    raw=Path(name).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==before,name
    texts[name]=raw.decode('utf-8')
p='apps/research/access/audit.mjs'
texts[p]=texts[p].replace('FROM garden_control.audit_events`;','FROM garden_control.audit_events AS ae`;').replace('ORDER BY sequence LIMIT $4','ORDER BY ae.sequence LIMIT $4')
p='apps/research/access/audit.ci.mjs'
texts[p]=texts[p].replace('FROM garden_control.audit_events WHERE workspace_id=$1 ORDER BY sequence`;','FROM garden_control.audit_events AS ae WHERE workspace_id=$1 ORDER BY ae.sequence`;')
texts[p]=texts[p].replace("let all=(await admin.query(rowsSQL,[W])).rows;verifyAuditPage", "let all=(await admin.query(rowsSQL,[W])).rows;\n assert.ok(all.length>=12,'fixture must exercise multi-digit sequence numbers');\n assert.deepEqual(all.map(r=>r.sequence),Array.from({length:all.length},(_,i)=>String(i+1)));\n checked('bigint audit ordering crosses sequence 9 to 10 without lexical reordering');\n verifyAuditPage")
texts['tests/access/audit.test.mjs']+='''
// PostgreSQL ORDER BY prefers a SELECT output alias over an input column.
// Qualify the stored bigint: sorting the exported sequence::text corrupts pages
// once a history reaches ten events. The real-PostgreSQL CI exercises this too.
test('audit exports sort by stored bigint, while retaining exact string sequences',async()=>{
 const f=fixture();await f.reader.page(H,W);
 const query=f.calls.find(x=>x.sql?.startsWith('SELECT workspace_id::text'));
 assert.ok(query);
 assert.match(query.sql,/sequence::text AS sequence/);
 assert.match(query.sql,/FROM garden_control\\.audit_events AS ae/);
 assert.match(query.sql,/ORDER BY ae\\.sequence LIMIT \\$4/);
 assert.doesNotMatch(query.sql,/ORDER BY sequence(?: |$)/);
});
'''
for name,text in texts.items():
    assert hashlib.sha256(text.encode()).hexdigest()==rules[name][1],name
for name,text in texts.items():
    Path(name).write_bytes(text.encode())
print('Three exact audited source changes prepared; no database operation.')
