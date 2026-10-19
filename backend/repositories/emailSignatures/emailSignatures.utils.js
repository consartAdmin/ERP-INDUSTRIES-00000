// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailSignatures.utils.js — Helpers de conexão                      ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Helper: executa callback com client dedicado (pool.connect)
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
