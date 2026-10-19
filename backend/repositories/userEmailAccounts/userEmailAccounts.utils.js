// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccounts.utils.js — withClient (connect/release)          ║
// ╚════════════════════════════════════════════════════════════════════╝

export async function withClient(pgPool, fn) {
  const client = await pgPool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
