import {assertDatabaseCapability,DatabaseCapabilityError} from './database-role.mjs';
/** PostgreSQL membership adapter; database identity is not supplied by the browser. */
export function createMembershipRepository(pool) {
  if (typeof pool?.connect !== 'function') throw new Error('Missing membership pool');
  async function transaction(fn) {
    let client,login; let failed = false;
    try {
      client = await pool.connect();
      login = await assertDatabaseCapability(client,'garden_research');
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE garden_research');
      await client.query("SET LOCAL statement_timeout = '5s'");
      const value = await fn(client);
      await assertDatabaseCapability(client,'garden_research',{activeRole:true,login});
      await client.query('COMMIT'); return value;
    } catch (error) {
      if(error instanceof DatabaseCapabilityError) failed=true;
      try { if(client) await client.query('ROLLBACK'); } catch { failed = true; }
      throw new Error('Membership storage unavailable');
    } finally { client?.release(failed); }
  }
  return Object.freeze({
    read: (workspace, subject) => transaction(async c => (await c.query('SELECT garden_control.membership_snapshot($1::uuid,$2::text) AS value',[workspace,subject])).rows[0].value),
    request: (workspace, subject, policy, expertise) => transaction(c => c.query('SELECT garden_control.request_membership($1::uuid,$2::text,$3::text,$4::text)',[workspace,subject,policy,expertise])),
    attest: (workspace, subject, policy, task) => transaction(c => c.query('SELECT garden_control.attest_training($1::uuid,$2::text,$3::text,$4::text)',[workspace,subject,policy,task])),
    accept: (subject, emailHash, tokenHash, policy) => transaction(async c => (await c.query("SELECT garden_control.accept_membership_invite($1::text,decode($2,'hex'),decode($3,'hex'),$4::text) AS workspace",[subject,emailHash,tokenHash,policy])).rows[0].workspace)
  });
}
