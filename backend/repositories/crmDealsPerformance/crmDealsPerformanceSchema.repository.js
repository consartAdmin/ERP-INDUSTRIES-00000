// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsPerformanceSchema.repository.js — ensureTable              ║
// ║ Tabela: public."crmDealsReativationActions" + índices              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './crmDealsPerformance.constants.js';
import { buildError } from './crmDealsPerformance.utils.js';

export async function ensureTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id              BIGSERIAL PRIMARY KEY,
        deal_id         BIGINT NULL,
        stage_id        BIGINT NULL,
        stage_code      TEXT NULL,
        seller_id       BIGINT NULL,
        seller_name     TEXT NULL,
        user_id         BIGINT NULL,
        customer_id     BIGINT NULL,
        customer_name   TEXT NULL,
        action_type     TEXT NOT NULL,
        from_stage_id   BIGINT NULL,
        to_stage_id     BIGINT NULL,
        estimated_value NUMERIC(18,2) NULL,
        value_at_moment NUMERIC(18,2) NULL,
        details         JSONB NULL,
        ip              TEXT NULL,
        user_agent      TEXT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_crmReatActions_created_at
        ON ${TABLE}(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_crmReatActions_seller_created
        ON ${TABLE}(seller_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_crmReatActions_deal_created
        ON ${TABLE}(deal_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_crmReatActions_action_type
        ON ${TABLE}(action_type);

      CREATE INDEX IF NOT EXISTS idx_crmReatActions_details_gin
        ON ${TABLE} USING GIN (details);
    `;
    await pool.query(sql);
    return { ok: true };
  } catch (err) {
    return buildError(err, 'crmDealsReativationPerformanceApi.ensureTable');
  }
}
