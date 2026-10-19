// ╔════════════════════════════════════════════════════════════════════╗
// ║ batchCrmDealsQuery.repository.js — searchCustomers                 ║
// ║ Tabela: public.customers                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { text } from './batchCrmDeals.utils.js';

export async function searchCustomers({ q, limit = 100 } = {}) {
  const search = text(q);

  if (search.length < 3) {
    return { ok: true, data: [] };
  }

  const sql = `
    SELECT
      c.customer_id,
      c.trade_name,
      c.legal_name,
      c.tax_id,
      c.mobile_number,
      c.phone
    FROM public.customers c
    WHERE
      UPPER(COALESCE(c.trade_name, '')) LIKE UPPER($1)
      OR UPPER(COALESCE(c.legal_name, '')) LIKE UPPER($1)
      OR UPPER(COALESCE(c.tax_id, '')) LIKE UPPER($1)
      OR CAST(c.customer_id AS TEXT) LIKE $1
    ORDER BY
      COALESCE(c.trade_name, c.legal_name, CAST(c.customer_id AS TEXT)) ASC
    LIMIT $2
  `;

  const { rows } = await pool.query(sql, [`%${search}%`, Number(limit) || 100]);

  return {
    ok: true,
    data: rows,
  };
}
