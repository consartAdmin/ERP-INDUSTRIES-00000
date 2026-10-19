// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsLookup.repository.js — nome do cliente / vendedor          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { erpTable } from '../../utils/erpCompanyContext.js';

/* =========================================================================
 * LOOKUPS
 * ========================================================================= */
export async function fetchCustomerName(customerId) {
  if (!customerId) return null;

  const attempts = [
    `SELECT nome_fantasia AS name FROM public.clientes WHERE id = $1 LIMIT 1`,
    `SELECT nome_fantasia AS name FROM public.clientes WHERE cliente_id = $1 LIMIT 1`,
    `SELECT nome_fantasia AS name FROM ${erpTable('public."customers"')} WHERE customer_id = $1 LIMIT 1`,
    `SELECT nome_fantasia AS name FROM ${erpTable('public."customers"')} WHERE cliente_id = $1 LIMIT 1`,
    `SELECT COALESCE(trade_name, legal_name) AS name FROM ${erpTable('public."customers"')} WHERE customer_id = $1 LIMIT 1`,
  ];

  for (const sql of attempts) {
    try {
      const { rows } = await pool.query(sql, [customerId]);
      if (rows[0]?.name) return rows[0].name;
    } catch (_) { }
  }

  return null;
}

export async function fetchSellerName(sellerId) {
  if (!sellerId) return null;

  const sql = `
    SELECT name, nickname
    FROM ${erpTable('public."sellers"')}
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [sellerId]);
  if (!rows.length) return null;

  const row = rows[0];
  if (row.nickname) return `${row.name} (${row.nickname})`;
  return row.name;
}
