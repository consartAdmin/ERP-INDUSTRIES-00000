// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethodsCreate.repository.js — create                        ║
// ║ Tabela: public."paymentMethods"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, GAP_COLUMNS } from './paymentMethods.constants.js';
import { SELECT_COLUMNS } from './paymentMethods.sql.js';
import { normalizePayload, validatePayload } from './paymentMethods.sanitizers.js';
import { fromDb } from './paymentMethods.mappers.js';

export async function create(payload = {}) {
  const data = normalizePayload(payload);
  validatePayload(data);

  const columns = ['name', 'type', 'installments', ...GAP_COLUMNS, 'nfe_tpag', 'active'];
  const values = columns.map((column) => data[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

  const { rows } = await pool.query(`
    INSERT INTO ${TB} (${columns.map((column) => `"${column}"`).join(', ')})
    VALUES (${placeholders})
    RETURNING ${SELECT_COLUMNS};
  `, values);

  return fromDb(rows[0]);
}
