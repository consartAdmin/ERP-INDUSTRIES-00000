// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParameters.utils.js — withClient (pool.connect dedicado)       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/**
 * Helper: executes callback with dedicated client (pool.connect)
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
