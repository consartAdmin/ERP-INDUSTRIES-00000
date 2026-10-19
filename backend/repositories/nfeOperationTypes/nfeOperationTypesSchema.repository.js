// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeOperationTypesSchema.repository.js — ensureTable + seed BONUS   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeOperationTypes.constants.js';

export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB} (
      operation_type_id BIGSERIAL PRIMARY KEY,
      code VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      nature_operation VARCHAR(120) NOT NULL,
      cfop_internal VARCHAR(4),
      cfop_interstate VARCHAR(4),
      generates_receivable BOOLEAN NOT NULL DEFAULT FALSE,
      moves_stock BOOLEAN NOT NULL DEFAULT TRUE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_nfe_operation_cfop_internal
        CHECK (cfop_internal IS NULL OR cfop_internal ~ '^[0-9]{4}$'),
      CONSTRAINT chk_nfe_operation_cfop_interstate
        CHECK (cfop_interstate IS NULL OR cfop_interstate ~ '^[0-9]{4}$')
    );

    INSERT INTO ${TB} (
      code, name, nature_operation, generates_receivable, moves_stock, active
    ) VALUES (
      'BONUS', 'Bonificação', 'REMESSA EM BONIFICAÇÃO', FALSE, TRUE, TRUE
    ) ON CONFLICT (code) DO NOTHING;
  `);
  return { ok: true };
}
