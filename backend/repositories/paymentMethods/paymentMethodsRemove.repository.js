// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethodsRemove.repository.js — remove (DELETE físico)        ║
// ║ Tabela: public."paymentMethods"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK } from './paymentMethods.constants.js';
import { SELECT_COLUMNS } from './paymentMethods.sql.js';
import { toInt } from './paymentMethods.sanitizers.js';
import { fromDb } from './paymentMethods.mappers.js';

export async function remove(id) {
  const safeId = toInt(id, 0);
  if (!safeId) throw new Error('ID inválido.');

  const { rows } = await pool.query(`
    DELETE FROM ${TB}
    WHERE ${PK} = $1
    RETURNING ${SELECT_COLUMNS};
  `, [safeId]);

  return rows[0] ? fromDb(rows[0]) : null;
}
