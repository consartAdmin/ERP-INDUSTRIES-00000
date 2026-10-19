// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettingsUpdate.repository.js — Atualização dos parâmetros      ║
// ║ updateBudgetSettings (upsert parcial da linha singleton)             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TABLE, SETTINGS_ID, DEFAULTS } from './budgetSettings.catalog.js';
import { SELECT_COLUMNS } from './budgetSettings.constants.js';
import { assertDb } from './budgetSettings.utils.js';
import {
  resolveMode,
  resolveMaxDiscount,
  resolveBoolean,
  normalizeUpdatedBy,
} from './budgetSettings.sanitizers.js';
import { normalizeRow } from './budgetSettings.mappers.js';
import { getBudgetSettings } from './budgetSettingsGet.repository.js';

// Atualização parcial: campos não informados mantêm o valor atual.
export async function updateBudgetSettings(db, settings = {}, updatedBy = null) {
  assertDb(db);

  const current = (await getBudgetSettings(db)) ?? normalizeRow({ ...DEFAULTS });

  const mode = resolveMode(settings, current);
  const maxDiscount = resolveMaxDiscount(settings, current);

  const { rows } = await db.query(`
    INSERT INTO ${TABLE.qualifiedName} (
      setting_id,
      out_of_stock_mode,
      allow_out_of_stock,
      require_stock_lot,
      allow_manual_unit_price,
      max_discount_percent,
      updated_at,
      updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
    ON CONFLICT (setting_id) DO UPDATE SET
      out_of_stock_mode = EXCLUDED.out_of_stock_mode,
      allow_out_of_stock = EXCLUDED.allow_out_of_stock,
      require_stock_lot = EXCLUDED.require_stock_lot,
      allow_manual_unit_price = EXCLUDED.allow_manual_unit_price,
      max_discount_percent = EXCLUDED.max_discount_percent,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    RETURNING
      ${SELECT_COLUMNS}
  `, [
    SETTINGS_ID,
    mode,
    mode !== 'BLOCK',
    resolveBoolean(settings, current, 'require_stock_lot'),
    resolveBoolean(settings, current, 'allow_manual_unit_price'),
    maxDiscount,
    normalizeUpdatedBy(updatedBy),
  ]);

  return normalizeRow(rows[0]);
}
