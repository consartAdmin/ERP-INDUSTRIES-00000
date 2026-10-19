// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettingsGet.repository.js — Leitura dos parâmetros             ║
// ║ ensureDefaultSettings / getBudgetSettings                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TABLE, SETTINGS_ID, DEFAULTS } from './budgetSettings.catalog.js';
import { SELECT_COLUMNS } from './budgetSettings.constants.js';
import { assertDb } from './budgetSettings.utils.js';
import { normalizeRow } from './budgetSettings.mappers.js';

async function ensureDefaultSettings(db) {
  await db.query(`
    INSERT INTO ${TABLE.qualifiedName} (
      setting_id,
      out_of_stock_mode,
      allow_out_of_stock,
      require_stock_lot,
      allow_manual_unit_price,
      max_discount_percent
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (setting_id) DO NOTHING
  `, [
    SETTINGS_ID,
    DEFAULTS.out_of_stock_mode,
    DEFAULTS.allow_out_of_stock,
    DEFAULTS.require_stock_lot,
    DEFAULTS.allow_manual_unit_price,
    DEFAULTS.max_discount_percent,
  ]);
}

export async function getBudgetSettings(db) {
  assertDb(db);

  await ensureDefaultSettings(db);

  const { rows } = await db.query(`
    SELECT
      ${SELECT_COLUMNS}
    FROM ${TABLE.qualifiedName}
    WHERE setting_id = $1
    LIMIT 1
  `, [SETTINGS_ID]);

  return normalizeRow(rows[0]);
}
