// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypes.schema.js — DDL de public."customerStatusTypes"║
// ║ Idempotente.                                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Cria tabela e índices de public."customerStatusTypes".
 * Recebe um `client` já dentro de uma transação.
 */
export async function ensureCustomerStatusTypesTable(client) {
  await client.query(`
      CREATE TABLE IF NOT EXISTS public."customerStatusTypes" (
        id              SERIAL       PRIMARY KEY,
        name_pt         VARCHAR(80)  NOT NULL,
        internal_code   VARCHAR(40)  NOT NULL UNIQUE,
        description_en  TEXT,
        color_hex       VARCHAR(7),
        sort_order      SMALLINT     NOT NULL DEFAULT 0,
        is_active       BOOLEAN      NOT NULL DEFAULT TRUE
      );
    `);

  // ✅ Index idempotente de verdade (sem DO $$ e sem erro 42P07)
  await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customerStatusTypes_sort_order
      ON public."customerStatusTypes" (sort_order);
    `);
}
