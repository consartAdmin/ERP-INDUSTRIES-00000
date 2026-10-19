// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomer.utils.js — q() e parseOrder()                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function q(text, params = []) {
  return pool.query(text, params);
}

export function parseOrder(orderBy, allowed = []) {
  if (!orderBy) return 'ORDER BY sfc.created_at DESC';
  const [col, dirRaw] = String(orderBy).trim().split(/\s+/);
  const colSafe = allowed.includes(col) ? col : null;
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'ASC';
  return colSafe ? `ORDER BY sfc.${colSafe} ${dir}` : 'ORDER BY sfc.created_at DESC';
}
