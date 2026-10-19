// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acao.utils.js — Helpers (query / clamp)                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function q(text, params = []) {
  return pool.query(text, params);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
