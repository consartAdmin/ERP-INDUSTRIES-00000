// ╔══════════════════════════════════════════════════════════════════════╗
// ║ getById.repository.js — CONSART ERP | Notas Fiscais Emitidas         ║
// ║ Busca a NF-e pelo invoice_id, com status, pedido e e-mails resolvidos║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  TB_INVOICES,
  TB_NFE_STATUS_MAP,
  TB_ORDERS,
  TB_BUDGETS,
  rowToInvoice,
} from './_shared.js';

export async function getById(invoiceId) {
  const id = Number(invoiceId);

  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      error: 'invoice_id inválido',
    };
  }

  const { rows } = await pool.query(
    `
    SELECT
      i.*,

      nsm.code AS nfe_status_code,
      nsm.name AS nfe_status_name,

      COALESCE(o.order_id::text, i.budget_id::text) AS order_number,
      COALESCE(o.customer_name, i.customer_name) AS customer_name,
      COALESCE(o.customer_tax_id, i.customer_tax_id) AS customer_tax_id,

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

    WHERE i.invoice_id = $1

    LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    return {
      ok: false,
      error: 'NOT_FOUND',
    };
  }

  return {
    ok: true,
    invoice: rowToInvoice(rows[0]),
  };
}

export default getById;
