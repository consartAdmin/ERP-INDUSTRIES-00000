// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatus.schema.js — DDL de public."customerStatus"          ║
// ║ Idempotente. Depende de: customers, customerStatusTypes (FK)       ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Cria tabela e índices de public."customerStatus".
 * Recebe um `client` já dentro de uma transação.
 */
export async function ensureCustomerStatusTable(client) {
  await client.query(`
      CREATE TABLE IF NOT EXISTS public."customerStatus" (
        id              SERIAL      PRIMARY KEY,
        customer_id     BIGINT      NOT NULL REFERENCES public."customers"(customer_id) ON DELETE CASCADE,
        status_type_id  INTEGER     NOT NULL REFERENCES public."customerStatusTypes"(id),
        note            TEXT,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by      INTEGER     REFERENCES public."system_users"(id)
      );
    `);

  // 1 linha por cliente
  await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_customerStatus_customer_id
      ON public."customerStatus"(customer_id);
    `);

  await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customerStatus_status_type_id
      ON public."customerStatus"(status_type_id);
    `);

  await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customerStatus_updated_at
      ON public."customerStatus"(updated_at DESC);
    `);
}
