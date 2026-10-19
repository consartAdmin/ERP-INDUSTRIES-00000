// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employeesRemove.repository.js — remove (soft/hard)                   ║
// ║ Tabela: public.employees                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK } from './employees.constants.js';
import { ensureTable } from './employeesSchema.repository.js';

export async function remove(id, { hard = false } = {}) {
  await ensureTable();

  if (hard) {
    await pool.query(`DELETE FROM ${TB} WHERE ${PK} = $1`, [Number(id)]);
    return { ok: true, hard: true };
  }

  await pool.query(`UPDATE ${TB} SET active = FALSE, updated_at = NOW()::timestamp WHERE ${PK} = $1`, [Number(id)]);
  return { ok: true, hard: false };
}
