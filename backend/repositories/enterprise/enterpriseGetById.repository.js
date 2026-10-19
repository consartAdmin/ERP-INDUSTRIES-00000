// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseGetById.repository.js — findById / findByCnpj              ║
// ║ Tabela: enterprises                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { catalog_schema } from './enterprise.constants.js';
import { onlyDigits } from './enterprise.sanitizers.js';
import { ensureTable } from './enterpriseSchema.repository.js';

export async function findById(id) {
  await ensureTable();

  const { rows } = await pool.query(`
    SELECT *
    FROM ${catalog_schema.table}
    WHERE ${catalog_schema.idField} = $1
    LIMIT 1
  `, [id]);

  return rows[0] || null;
}

export async function findByCnpj(cnpj) {
  await ensureTable();

  const { rows } = await pool.query(`
    SELECT *
    FROM ${catalog_schema.table}
    WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = $1
    LIMIT 1
  `, [onlyDigits(cnpj)]);

  return rows[0] || null;
}
