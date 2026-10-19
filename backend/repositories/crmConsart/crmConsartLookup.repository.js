// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsartLookup.repository.js — nome do cliente / vendedor        ║
// ║ Tabelas: public.clientes, public."sellers"                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function fetchCustomerName(customerId) {
  if (!customerId) return null;
  const sql = `
    SELECT nome_fantasia AS name
    FROM public.clientes
    WHERE id = $1
  `;
  const { rows } = await pool.query(sql, [customerId]);
  return rows[0]?.name || null;
}

export async function fetchSellerName(sellerId) {
  if (!sellerId) return null;

  const sql = `
    SELECT
      name,
      nickname
    FROM public."sellers"
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [sellerId]);

  if (!rows.length) return null;
  const row = rows[0];
  if (row.nickname) return `${row.name} (${row.nickname})`;
  return row.name;
}
