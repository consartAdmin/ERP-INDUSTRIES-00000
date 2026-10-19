// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccounts.utils.js — Wrapper de query do pool                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function query(text, params = []) {
  return pool.query(text, params);
}
