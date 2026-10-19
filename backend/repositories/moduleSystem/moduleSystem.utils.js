// ╔════════════════════════════════════════════════════════════════════╗
// ║ moduleSystem.utils.js — helper q() (query com log leve)            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/** Helper: executa query com log leve */
export async function q(text, params = []) {
  // console.debug('[SQL moduleSystem]', text, params);
  const res = await pool.query(text, params);
  return res;
}
