// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelPrintConfigUpdate.repository.js — updateLabelConfig / reset    ║
// ║ Table: public."labelPrintConfig" | Single global row                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  LABEL_PRINT_CONFIG_TABLE,
  WRITABLE_COLUMNS,
} from './labelPrintConfig.constants.js';
import { normalizePayload, validatePayload } from './labelPrintConfig.sanitizers.js';

export async function updateLabelConfig(payload = {}) {
  const normalized = normalizePayload(payload);
  validatePayload(normalized);

  const keys = Object.keys(normalized).filter((key) =>
    WRITABLE_COLUMNS.includes(key)
  );

  if (!keys.length) {
    throw new Error('Nenhum campo válido enviado para atualização.');
  }

  const setSql = keys
    .map((key, index) => `"${key}" = $${index + 1}`)
    .join(', ');

  const values = keys.map((key) => normalized[key]);

  const sql = `
    UPDATE ${LABEL_PRINT_CONFIG_TABLE}
       SET ${setSql},
           updated_at = NOW()
     WHERE id = (
       SELECT id
       FROM ${LABEL_PRINT_CONFIG_TABLE}
       ORDER BY id ASC
       LIMIT 1
     )
     RETURNING *;
  `;

  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

export async function resetLabelConfig() {
  const sql = `
    UPDATE ${LABEL_PRINT_CONFIG_TABLE}
       SET width_mm = 80,
           height_mm = 40,
           margin_mm = 2,
           orientation = 'portrait',
           barcode_height = 40,
           font_size_pt = 8,
           barcode_type = 'CODE128',
           copies = 1,
           paper = 'custom',
           show_label_text = TRUE,
           show_location = TRUE,
           location_font_size = 7,
           show_id = FALSE,
           updated_at = NOW()
     WHERE id = (
       SELECT id
       FROM ${LABEL_PRINT_CONFIG_TABLE}
       ORDER BY id ASC
       LIMIT 1
     )
     RETURNING *;
  `;

  const { rows } = await pool.query(sql);
  return rows[0] || null;
}
