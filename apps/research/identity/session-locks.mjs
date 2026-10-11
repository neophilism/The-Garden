/** Separate bounded lock pool prevents a set of waiting locks from exhausting
 * Better Auth's query pool. Locks coordinate account changes across processes.
 * Neither pool is ever selected from HTTP input. No schema mutation occurs.
 */
export function accountLocks(database, lockDatabase) {
  if (!database || database === lockDatabase || typeof database.query !== 'function' ||
      typeof lockDatabase?.connect !== 'function') throw Error('Distinct trusted identity lock pool required');
  const targetSQL = 'SELECT current_database() AS db, current_schema() AS schema, inet_server_addr()::text AS host, inet_server_port() AS port, session_user AS role';
  return async function acquire(subjectId) {
    if (typeof subjectId !== 'string' || !subjectId || subjectId.length > 2048) throw Error('Invalid lock subject');
    const client = await lockDatabase.connect();
    let held = false, released = false;
    try {
      const [left, right] = await Promise.all([database.query(targetSQL), client.query(targetSQL)]);
      if (left.rows.length !== 1 || right.rows.length !== 1 ||
          ['db','schema','host','port','role'].some(key => left.rows[0][key] !== right.rows[0][key])) throw Error('Identity lock target mismatch');
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='4s'; SET LOCAL statement_timeout='6s'; SET LOCAL idle_in_transaction_session_timeout='15s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('garden-identity:' || $1, 0))", [subjectId]);
      held = true;
      return async function release() {
        if (released) return;
        released = true;
        try { await client.query('COMMIT'); client.release(); }
        catch (error) { client.release(true); throw error; }
      };
    } catch (error) {
      if (!released) { try { await client.query('ROLLBACK'); } catch {} client.release(!held); }
      throw error;
    }
  };
}
