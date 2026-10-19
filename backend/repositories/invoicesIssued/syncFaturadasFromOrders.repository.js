// ╔══════════════════════════════════════════════════════════════════════╗
// ║ syncFaturadasFromOrders.repository.js — CONSART ERP                 ║
// ║ Importa/atualiza em lote as NF-e autorizadas a partir dos pedidos    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  TB_INVOICES,
  TB_ORDERS,
  TB_ORDER_NFE_ATTEMPTS,
  createAuditLog,
  normalizeUserId,
} from './_shared.js';

import { createInvoiceIssuedAudit } from './_stockOutAudit.js';

export async function syncFaturadasFromOrders({ userId = null } = {}) {
  const sql = `
    INSERT INTO ${TB_INVOICES} (
      order_id,
      nfe_number,
      nfe_key,
      nfe_provider_id,
      nfe_status_id,
      nfe_status,
      nfe_protocol,
      nfe_environment,
      xml_url,
      danfe_url,
      issued_at,
      issued_date,
      total_amount
    )
    SELECT
      o.order_id,
      a.nfe_number,
      NULLIF(a.access_key, ''),
      NULLIF(a.provider_id, ''),
      a.nfe_status_id,
      'AUTORIZADO',
      a.protocol,
      a.nfe_environment,
      NULLIF(a.provider_response->>'xml', ''),
      NULLIF(a.provider_response->>'pdf', ''),
      COALESCE(a.authorized_at, NOW()),
      COALESCE(
        a.issue_date,
        (a.authorized_at AT TIME ZONE 'America/Sao_Paulo')::date,
        o.issue_date
      ),
      COALESCE(a.total_amount, o.total_amount, 0)
    FROM ${TB_ORDERS} o
    JOIN LATERAL (
      SELECT attempt.*
      FROM ${TB_ORDER_NFE_ATTEMPTS} attempt
      WHERE attempt.order_id = o.order_id
        AND attempt.authorized_at IS NOT NULL
      ORDER BY attempt.attempt_number DESC, attempt.attempt_id DESC
      LIMIT 1
    ) a ON TRUE

    ON CONFLICT (order_id) WHERE order_id IS NOT NULL
    DO UPDATE SET
      nfe_number      = EXCLUDED.nfe_number,
      nfe_key         = EXCLUDED.nfe_key,
      nfe_provider_id = COALESCE(EXCLUDED.nfe_provider_id, ${TB_INVOICES}.nfe_provider_id),
      nfe_status_id   = EXCLUDED.nfe_status_id,
      nfe_status      = EXCLUDED.nfe_status,
      nfe_protocol    = EXCLUDED.nfe_protocol,
      nfe_environment = EXCLUDED.nfe_environment,
      xml_url         = EXCLUDED.xml_url,
      danfe_url       = EXCLUDED.danfe_url,

      issued_at = COALESCE(
        ${TB_INVOICES}.issued_at,
        EXCLUDED.issued_at
      ),

      issued_date = COALESCE(
        ${TB_INVOICES}.issued_date,
        EXCLUDED.issued_date
      ),

      total_amount = EXCLUDED.total_amount,
      updated_at   = NOW()

    WHERE
      ${TB_INVOICES}.nfe_number IS DISTINCT FROM EXCLUDED.nfe_number
      OR ${TB_INVOICES}.nfe_key IS DISTINCT FROM EXCLUDED.nfe_key
      OR ${TB_INVOICES}.nfe_provider_id IS DISTINCT FROM EXCLUDED.nfe_provider_id
      OR ${TB_INVOICES}.nfe_status_id IS DISTINCT FROM EXCLUDED.nfe_status_id
      OR ${TB_INVOICES}.nfe_status IS DISTINCT FROM EXCLUDED.nfe_status
      OR ${TB_INVOICES}.nfe_protocol IS DISTINCT FROM EXCLUDED.nfe_protocol
      OR ${TB_INVOICES}.nfe_environment IS DISTINCT FROM EXCLUDED.nfe_environment
      OR ${TB_INVOICES}.xml_url IS DISTINCT FROM EXCLUDED.xml_url
      OR ${TB_INVOICES}.danfe_url IS DISTINCT FROM EXCLUDED.danfe_url
      OR ${TB_INVOICES}.total_amount IS DISTINCT FROM EXCLUDED.total_amount

    RETURNING invoice_id, order_id, xmax
  `;

  const { rows } = await pool.query(sql);

  for (const invoice of rows) {
    const wasInserted = invoice.xmax === '0' || invoice.xmax === 0;

    if (wasInserted) {
      await createInvoiceIssuedAudit(invoice.order_id, invoice.invoice_id);
    }

    await createAuditLog({
      tabela: 'invoicesIssued',
      register_id: invoice.invoice_id,
      operation: wasInserted
        ? 'CREATE_FROM_ORDER_SYNC'
        : 'UPDATE_FROM_ORDER_SYNC',
      user_id: normalizeUserId(userId),
      before: null,
      after: {
        invoice_id: invoice.invoice_id,
        order_id: invoice.order_id,
      },
    });
  }

  return {
    ok: true,
    imported: rows.length,
  };
}

export default syncFaturadasFromOrders;
