// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrders.utils.js — Helpers (query / ordenação)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/* --------------------------------------------------------------------- */
/* Helper: executa query com log leve                                    */
/* --------------------------------------------------------------------- */

export async function q(text, params = []) {
  // console.debug('[SQL ecommerceOrders]', text, params);
  const res = await pool.query(text, params);
  return res;
}

/* --------------------------------------------------------------------- */
/* Normaliza ordenação segura                                             */
/* --------------------------------------------------------------------- */

export function parseOrder(orderBy, allowed = []) {
  if (!orderBy) return '';
  const [col, dirRaw] = String(orderBy).trim().split(/\s+/);
  const colSafe = allowed.includes(col) ? col : null;
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'ASC';
  return colSafe ? ` ORDER BY ${colSafe} ${dir} ` : '';
}
