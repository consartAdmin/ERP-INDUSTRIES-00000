// ╔══════════════════════════════════════════════════════════════════════╗
// ║ getByOrderId.repository.js — CONSART ERP | Notas Fiscais Emitidas    ║
// ║ Lista as NF-e vinculadas a um pedido, da mais recente para a antiga  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  TB_INVOICES,
  TB_NFE_STATUS_MAP,
  TB_ORDERS,
  TB_BUDGETS,
  rowToInvoice,
} from './_shared.js';

export async function getByOrderId(orderId) {
  const id = Number(orderId);

  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      error: 'order_id inválido',
    };
  }

  const { rows } = await pool.query(
    `
    SELECT
      i.*,

      nsm.code AS nfe_status_code,
      nsm.name AS nfe_status_name,

      o.order_id AS order_number,
      o.customer_name,
      o.customer_tax_id,

      o.customer_email AS order_email,

      COALESCE(
        NULLIF(TRIM(i.customer_email), ''),
        NULLIF(TRIM(c.email), ''),
        NULLIF(TRIM(b.customer_email), '')
      ) AS customer_email,

      COALESCE(
        NULLIF(TRIM(o.customer_email), ''),
        NULLIF(TRIM(i.customer_email), ''),
        NULLIF(TRIM(c.email), ''),
        NULLIF(TRIM(b.customer_email), '')
      ) AS final_email

    FROM ${TB_INVOICES} i

    LEFT JOIN ${TB_NFE_STATUS_MAP} nsm
      ON nsm.nfe_status_id = i.nfe_status_id

    LEFT JOIN ${TB_ORDERS} o
      ON o.order_id = i.order_id

    LEFT JOIN public."customers" c
      ON c.customer_id = o.customer_id

    LEFT JOIN ${TB_BUDGETS} b
      ON b.budget_id = i.budget_id

    WHERE i.order_id = $1

    ORDER BY i.invoice_id DESC
    `,
    [id]
  );

  return {
    ok: true,
    rows: rows.map(rowToInvoice),
    total: rows.length,
  };
}

export default getByOrderId;
