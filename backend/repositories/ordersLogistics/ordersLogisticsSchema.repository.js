// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersLogisticsSchema.repository.js — ensureTables (idempotente)   ║
// ║ Tabelas: "ordersLogistics" / "ordersLogisticsItems"                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function ensureTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ================================================================
    // Tabela principal: "ordersLogistics"
    // ================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ordersLogistics" (
        logistics_id         SERIAL PRIMARY KEY,
        order_id             INTEGER NOT NULL REFERENCES "orders"(order_id) ON DELETE CASCADE,

        -- Status geral
        status               VARCHAR(50) NOT NULL DEFAULT 'AGUARDANDO_SEPARACAO',

        -- Responsáveis
        picker_user_id       INTEGER,
        checker_user_id      INTEGER,
        packer_user_id       INTEGER,
        shipper_user_id      INTEGER,

        -- Picking
        picking_started_at   TIMESTAMP,
        picking_finished_at  TIMESTAMP,

        -- Conferência cega
        checking_started_at  TIMESTAMP,
        checking_finished_at TIMESTAMP,

        -- Embalagem
        packing_started_at   TIMESTAMP,
        packing_finished_at  TIMESTAMP,

        -- Expedição
        shipping_method      VARCHAR(50),
        shipping_code        VARCHAR(200),
        shipping_date        TIMESTAMP,
        shipping_obs         TEXT,

        -- Dados da NF (para iniciar conferência pela chave/código de barras)
        nfe_key              VARCHAR(60),
        nf_number            INTEGER,
        nf_series            VARCHAR(10),

        -- Controle conferência cega
        blind_check_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
        blind_check_status   VARCHAR(30) DEFAULT 'PENDENTE', -- PENDENTE | EM_ANDAMENTO | OK | DIVERGENCIA
        has_discrepancy      BOOLEAN DEFAULT FALSE,
        discrepancy_note     TEXT,

        -- Auditoria
        created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Índice por pedido
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'idx_ordersLogistics_order_id'
            AND n.nspname = 'public'
        ) THEN
          CREATE INDEX idx_ordersLogistics_order_id
            ON "ordersLogistics"(order_id);
        END IF;
      END $$;
    `);

    // Índice por NF (chave)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'idx_ordersLogistics_nfe_key'
            AND n.nspname = 'public'
        ) THEN
          CREATE INDEX idx_ordersLogistics_nfe_key
            ON "ordersLogistics"(nfe_key);
        END IF;
      END $$;
    `);

    // ================================================================
    // Tabela de itens: "ordersLogisticsItems"
    // ================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ordersLogisticsItems" (
        item_log_id      SERIAL PRIMARY KEY,

        logistics_id     INTEGER NOT NULL REFERENCES "ordersLogistics"(logistics_id) ON DELETE CASCADE,
        order_item_id    INTEGER NOT NULL REFERENCES "order_items"(order_item_id) ON DELETE CASCADE,

        sku              VARCHAR(50) NOT NULL,
        product_name     TEXT NOT NULL,

        qty_ordered      NUMERIC(14,3) NOT NULL,
        qty_picked       NUMERIC(14,3) NOT NULL DEFAULT 0,
        qty_checked      NUMERIC(14,3) NOT NULL DEFAULT 0,

        discrepancy_qty  NUMERIC(14,3)
          GENERATED ALWAYS AS (qty_checked - qty_picked) STORED,

        location         VARCHAR(120),
        obs              TEXT,

        updated_at       TIMESTAMP DEFAULT NOW()
      );
    `);

    // Índice por logística
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'idx_ordersLogisticsItems_logistics_id'
            AND n.nspname = 'public'
        ) THEN
          CREATE INDEX idx_ordersLogisticsItems_logistics_id
            ON "ordersLogisticsItems"(logistics_id);
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ordersLogisticsApi.ensureTables] erro ao garantir tabelas:', err);
    throw err;
  } finally {
    client.release();
  }
}
