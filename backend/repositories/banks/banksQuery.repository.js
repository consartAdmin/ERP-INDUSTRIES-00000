// ╔════════════════════════════════════════════════════════════════════╗
// ║ banksQuery.repository.js — listBanks / getBankById                 ║
// ║ Tabela: public."banks"                                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './banks.constants.js';
import { positiveId } from './banks.sanitizers.js';

export async function listBanks({ search, active } = {}) {
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${String(search).trim()}%`);
    where.push(`(b.name ILIKE $${params.length} OR b.code ILIKE $${params.length})`);
  }

  if (active !== undefined && active !== null && active !== '') {
    params.push(String(active).toLowerCase() !== 'false');
    where.push(`b.is_active = $${params.length}`);
  }

  const sql = `
    SELECT b.id, b.code, b.name, b.is_active, b.created_at, b.updated_at
    FROM ${TB} b
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY b.name ASC, b.id ASC;
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function getBankById(value) {
  const id = positiveId(value);
  if (!id) return null;

  const { rows } = await pool.query(`
    SELECT b.id, b.code, b.name, b.is_active, b.created_at, b.updated_at
    FROM ${TB} b
    WHERE b.id = $1;
  `, [id]);

  return rows[0] || null;
}
