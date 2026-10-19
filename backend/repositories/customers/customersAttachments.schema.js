// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersAttachments.schema.js                                     ║
// ║ DDL de public."customersAttachments". Idempotente.                 ║
// ║ Arquivo no GCS: customers/{customer_id}/{uuid}.{ext}               ║
// ║ Depende de: public.customers (FK) — rodar DEPOIS dela.             ║
// ╚════════════════════════════════════════════════════════════════════╝

export async function ensureCustomersAttachmentsTable(client) {
    await client.query(`
    CREATE TABLE IF NOT EXISTS public."customersAttachments" (
      attachment_id    BIGSERIAL PRIMARY KEY,
      customer_id      INTEGER      NOT NULL,
      original_name    VARCHAR(255) NOT NULL,
      storage_bucket   VARCHAR(100) NOT NULL,
      storage_path     VARCHAR(500) NOT NULL,
      mime_type        VARCHAR(150),
      size_bytes       BIGINT       NOT NULL DEFAULT 0,
      category         VARCHAR(30)  NOT NULL DEFAULT 'documento',
      description      TEXT,
      uploaded_by      INTEGER,
      is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
      deleted_at       TIMESTAMP,
      deleted_by       INTEGER,

      CONSTRAINT "customersAttachments_customer_id_fkey"
        FOREIGN KEY (customer_id)
        REFERENCES public.customers (customer_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

      CONSTRAINT "customersAttachments_category_check"
        CHECK (category IN ('documento', 'contrato', 'comprovante', 'outros')),

      CONSTRAINT "customersAttachments_size_check"
        CHECK (size_bytes >= 0)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_attachments_storage_path
      ON public."customersAttachments" (storage_path);

    CREATE INDEX IF NOT EXISTS idx_customers_attachments_customer_active
      ON public."customersAttachments" (customer_id, created_at DESC)
      WHERE is_active = TRUE;
  `);
}

export default ensureCustomersAttachmentsTable;
