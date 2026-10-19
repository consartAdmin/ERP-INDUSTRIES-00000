// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailOutbounds.utils.js — Helpers de conexão                       ║
// ╚════════════════════════════════════════════════════════════════════╝

export async function withClient(pgPool, fn) {
  const client = await pgPool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
