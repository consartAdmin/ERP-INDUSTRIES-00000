// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabelSettingsStore.repository.js — get / save              ║
// ║ Tabela: public."deliveryLabelSettings" (linha única id=1)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryLabelSettings.constants.js';
import { sanitizeLabelSettings } from './deliveryLabelSettings.sanitizers.js';
import { ready } from './deliveryLabelSettingsSchema.repository.js';

export async function getLabelSettings() {
  await ready();
  const { rows } = await pool.query(`SELECT settings FROM ${TB} WHERE id = 1`);
  return sanitizeLabelSettings(rows[0]?.settings || {});
}

export async function saveLabelSettings(input = {}) {
  await ready();
  const settings = sanitizeLabelSettings(input);

  await pool.query(
    `
      INSERT INTO ${TB} (id, settings, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
        SET settings = EXCLUDED.settings,
            updated_at = NOW()
    `,
    [JSON.stringify(settings)]
  );

  return settings;
}
