// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentFormsCreate.repository.js — create                          ║
// ║ Tabela: public."paymentForms"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './paymentForms.constants.js';
import { mapRow } from './paymentForms.mappers.js';
import { normalizeTpag } from './paymentForms.sanitizers.js';

export async function create({ name, nfe_tpag, active = true } = {}) {
  if (!name) {
    throw new Error('paymentForms.create: campo "name" é obrigatório.');
  }

  const tpag = normalizeTpag(nfe_tpag);
  if (!tpag) {
    throw new Error('paymentForms.create: campo "nfe_tpag" é obrigatório.');
  }

  const sql = `
    INSERT INTO ${TABLE} (name, nfe_tpag, active, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *;
  `;

  const values = [name.trim(), tpag, !!active];
  const { rows } = await pool.query(sql, values);
  return mapRow(rows[0]);
}
