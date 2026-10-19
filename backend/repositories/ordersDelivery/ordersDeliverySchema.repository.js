// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersDeliverySchema.repository.js — ensureTable (idempotente)     ║
// ║ Tabela: public."ordersDelivery"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ordersDelivery.constants.js';

async function tableExists() {
  const sql = `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='ordersDelivery'
    LIMIT 1
  `;
  const r = await pool.query(sql);
  return r.rowCount > 0;
}

async function indexExists(indexName) {
  const sql = `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1 LIMIT 1`;
  const r = await pool.query(sql, [indexName]);
  return r.rowCount > 0;
}

export async function ensureTable() {
  // Seu banco JÁ tem a tabela. Aqui só garantimos o index (idempotente).
  const exists = await tableExists();

  if (!exists) {
    // ⚠️ Fallback (caso rode em DB vazio).
    // Mantive o nome ordersDelivery e constraints iguais ao seu dump.
    const createSql = `
        CREATE TABLE IF NOT EXISTS ${TB} (
          id               BIGSERIAL PRIMARY KEY,
          order_id         BIGINT NOT NULL UNIQUE REFERENCES public."orders"(order_id) ON DELETE CASCADE,

          freight_mode     SMALLINT NOT NULL DEFAULT 9 CHECK (freight_mode = ANY (ARRAY[0,1,2,9])),
          freight_value    NUMERIC(12,2) NOT NULL DEFAULT 0,

          carrier_name     TEXT,
          carrier_cnpj_cpf VARCHAR(14),
          carrier_ie       VARCHAR(20),
          carrier_address  TEXT,
          carrier_city     TEXT,
          carrier_uf       CHAR(2),
          antt_code        VARCHAR(20),
          vehicle_plate    VARCHAR(8),
          vehicle_uf       CHAR(2),

          volume_quantity  INTEGER,
          volume_species   TEXT,
          volume_brand     TEXT,
          volume_numbering TEXT,

          gross_weight     NUMERIC(12,3),
          net_weight       NUMERIC(12,3),

          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

          CONSTRAINT orderdelivery_cnpjcpf_chk CHECK (carrier_cnpj_cpf IS NULL OR carrier_cnpj_cpf ~ '^[0-9]{11}$|^[0-9]{14}$'),
          CONSTRAINT orderdelivery_uf_chk CHECK (carrier_uf IS NULL OR carrier_uf ~ '^[A-Z]{2}$'),
          CONSTRAINT orderdelivery_vehicle_uf_chk CHECK (vehicle_uf IS NULL OR vehicle_uf ~ '^[A-Z]{2}$')
        );
      `;
    await pool.query(createSql);

    // Trigger set_timestamp (se existir)
    const trigSql = `
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_timestamp') THEN
            IF NOT EXISTS (
              SELECT 1 FROM pg_trigger WHERE tgname='trg_orderdelivery_set_timestamp'
            ) THEN
              CREATE TRIGGER trg_orderdelivery_set_timestamp
              BEFORE UPDATE ON ${TB}
              FOR EACH ROW EXECUTE FUNCTION set_timestamp();
            END IF;
          END IF;
        END $$;
      `;
    await pool.query(trigSql);
  }

  if (!(await indexExists('idx_orderdelivery_order_id'))) {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orderdelivery_order_id ON ${TB} (order_id)`);
  }

  return { ok: true, table: 'ordersDelivery', existed: exists };
}
