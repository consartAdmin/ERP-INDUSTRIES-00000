// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellersCreate.repository.js — create                               ║
// ║ Tabela: public."sellers"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './sellers.constants.js';
import { normalizePayload } from './sellers.sanitizers.js';
import { rowToModel } from './sellers.mappers.js';

export async function create(data = {}) {
  const normalized = normalizePayload(data);

  const cols = [];
  const vals = [];
  const placeholders = [];
  let i = 1;

  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    cols.push(k);
    vals.push(v);
    placeholders.push(`$${i}`);
    i++;
  }

  if (!cols.length || !normalized.name) {
    throw new Error('Nome do vendedor é obrigatório.');
  }

  const sql = `
    INSERT INTO ${tbl()} (${cols.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, vals);
  return rowToModel(rows[0]);
}
