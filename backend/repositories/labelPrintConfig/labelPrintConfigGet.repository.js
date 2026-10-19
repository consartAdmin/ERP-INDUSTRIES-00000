// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelPrintConfigGet.repository.js — getLabelConfig                  ║
// ║ Table: public."labelPrintConfig" | Single global row                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { LABEL_PRINT_CONFIG_TABLE } from './labelPrintConfig.constants.js';

export async function getLabelConfig() {
  const { rows } = await pool.query(`
    SELECT *
    FROM ${LABEL_PRINT_CONFIG_TABLE}
    ORDER BY id ASC
    LIMIT 1;
  `);

  return rows[0] || null;
}
