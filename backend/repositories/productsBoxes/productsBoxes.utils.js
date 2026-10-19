// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsBoxes.utils.js — helper de query                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res;
}
