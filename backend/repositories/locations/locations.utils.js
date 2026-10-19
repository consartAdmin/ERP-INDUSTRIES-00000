// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locations.utils.js — withClient + buildUpdateSet (helpers genéricos)     ║
// ║ This module DOES NOT create the pool; you must pass pgPool in each call. ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/* ------------------------------------------------------------------------- */
/* Helper – run callback with client (optional, but good for transactions)  */
/* ------------------------------------------------------------------------- */

/**
 * @param {import('pg').Pool} pgPool
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
export async function withClient(pgPool, fn) {
  const client = await pgPool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------------- */
/* Generic helpers                                                           */
/* ------------------------------------------------------------------------- */

/**
 * Builds a dynamic SET clause and params for UPDATE
 * Returns: { setClause: 'SET col1 = $1, col2 = $2', values: [...] }
 */
export function buildUpdateSet(payload, startIndex = 1) {
  const keys = Object.keys(payload).filter((k) => payload[k] !== undefined);
  const setParts = [];
  const values = [];

  keys.forEach((key, i) => {
    setParts.push(`"${key}" = $${startIndex + i}`);
    values.push(payload[key]);
  });

  return {
    setClause: setParts.length ? `SET ${setParts.join(', ')}` : '',
    values,
  };
}
