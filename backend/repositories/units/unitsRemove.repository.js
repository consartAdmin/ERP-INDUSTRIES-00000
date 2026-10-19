// ╔════════════════════════════════════════════════════════════════════╗
// ║ unitsRemove.repository.js — remove (DELETE físico)                 ║
// ║ Tabela: public.units                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './units.constants.js';

export async function remove(id) {
  const res = await pool.query(`DELETE FROM ${TB} WHERE unit_id = $1`, [Number(id)]);
  return res.rowCount > 0;
}
