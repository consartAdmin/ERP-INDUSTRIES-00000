// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.schema.js — DDL de public."nfeReceipts"                ║
// ║ Espelha o schema real (\d "nfeReceipts"). Idempotente.             ║
// ║ Depende de: public."invoicesIssued" (FK)                           ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Cria/atualiza public."nfeReceipts".
 * Recebe um `client` já dentro de uma transação (ver nfeReceiptsSchema.repository.js).
 */
export async function ensureNfeReceiptsTable(client) {
  // ---------------------------------------------------------------
  // 1) Tabela
  // ---------------------------------------------------------------
  await client.query(`
    CREATE TABLE IF NOT EXISTS public."nfeReceipts" (
      receipt_id BIGSERIAL PRIMARY KEY,

      nfe_id BIGINT NOT NULL REFERENCES public."invoicesIssued"(invoice_id) ON DELETE CASCADE,

      access_key VARCHAR(44) NOT NULL,

      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

      receiver_name VARCHAR(180),
      receiver_document VARCHAR(20),
      receiver_phone VARCHAR(30),

      received_at TIMESTAMPTZ,
      refused_at TIMESTAMPTZ,
      refusal_reason TEXT,

      signature_path TEXT,
      signature_url TEXT,
      signature_png BYTEA,

      latitude NUMERIC(10, 7),
      longitude NUMERIC(10, 7),

      ip_address INET,
      user_agent TEXT,

      notes TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT nfe_receipts_access_key_chk
        CHECK (access_key ~ '^[0-9]{44}$'),

      CONSTRAINT nfe_receipts_status_chk
        CHECK (status IN ('PENDING', 'SIGNED', 'REFUSED', 'CANCELLED')),

      CONSTRAINT nfe_receipts_nfe_unique
        UNIQUE (nfe_id)
    );
  `);

  // ---------------------------------------------------------------
  // 2) Colunas adicionadas depois (bancos antigos)
  // ---------------------------------------------------------------
  await client.query(`
    ALTER TABLE public."nfeReceipts"
      ADD COLUMN IF NOT EXISTS signature_png BYTEA;
  `);

  // ---------------------------------------------------------------
  // 3) Índices (mesmos nomes/definições do banco real)
  //    A chave de acesso é única pelo índice ux_nfe_receipts_access_key.
  // ---------------------------------------------------------------
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_nfe_receipts_access_key
      ON public."nfeReceipts" (access_key);

    CREATE INDEX IF NOT EXISTS idx_nfe_receipts_access_key
      ON public."nfeReceipts" (access_key);

    CREATE INDEX IF NOT EXISTS idx_nfe_receipts_status
      ON public."nfeReceipts" (status);

    CREATE INDEX IF NOT EXISTS idx_nfe_receipts_received_at
      ON public."nfeReceipts" (received_at);

    CREATE INDEX IF NOT EXISTS idx_nfe_receipts_nfe_id
      ON public."nfeReceipts" (nfe_id);
  `);
}

export default ensureNfeReceiptsTable;
