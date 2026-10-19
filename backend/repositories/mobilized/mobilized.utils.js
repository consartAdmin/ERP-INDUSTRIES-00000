// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilized.utils.js — Atalho de query no pool                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function q(text, params = []) {
  return pool.query(text, params);
}
