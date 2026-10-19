// ╔══════════════════════════════════════════════════════════════════════╗
// ║ upsertFromOrder.repository.js — CONSART ERP | Notas Fiscais Emitidas ║
// ║ Cria ou sincroniza a NF-e a partir da tentativa autorizada do pedido ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  TB_INVOICES,
  TB_ORDERS,
  TB_ORDER_NFE_ATTEMPTS,
  createAuditLog,
  normalizeNfeStatusCode,
  resolveNfeStatus,
  normalizeText,
  normalizeUserId,
  rowToInvoice,
} from './_shared.js';

import { createInvoiceIssuedAudit } from './_stockOutAudit.js';
import { update } from './update.repository.js';

async function buildPatchFromOrder(orderId, attemptId = null) {
  const { rows } = await pool.query(
    `
    SELECT
      a.nfe_number,
      a.access_key AS nfe_key,
      'AUTORIZADO'::text AS nfe_status,
      a.protocol AS nfe_protocol,
      a.nfe_environment,
      a.provider_id AS nfe_provider_id,
      NULLIF(a.provider_response->>'xml', '') AS xml_url,
      NULLIF(a.provider_response->>'pdf', '') AS danfe_url,
      a.authorized_at AS issued_at,
      COALESCE(
        a.issue_date,
        (a.authorized_at AT TIME ZONE 'America/Sao_Paulo')::date,
        o.issue_date
      ) AS issued_date,
      COALESCE(a.total_amount, o.total_amount, 0) AS total_amount,
      COALESCE(a.customer_name, o.customer_name) AS customer_name,
      COALESCE(a.customer_tax_id, o.customer_tax_id) AS customer_tax_id,
      COALESCE(a.customer_email, o.customer_email) AS customer_email
    FROM ${TB_ORDERS} o
    JOIN ${TB_ORDER_NFE_ATTEMPTS} a
      ON a.order_id = o.order_id
    WHERE o.order_id = $1
      AND a.authorized_at IS NOT NULL
      AND ($2::bigint IS NULL OR a.attempt_id = $2)
    ORDER BY a.attempt_number DESC, a.attempt_id DESC
    LIMIT 1
    `,
    [orderId, attemptId]
  );

  const o = rows[0];

  if (!o) {
    return null;
  }

  const canonicalCode = normalizeNfeStatusCode(o.nfe_status);

  const statusMap =
    canonicalCode
      ? await resolveNfeStatus(canonicalCode)
      : null;

  return {
    nfe_number: o.nfe_number,
    nfe_key: o.nfe_key,
    nfe_provider_id: normalizeText(o.nfe_provider_id),

    nfe_status_id:
      statusMap?.nfe_status_id ?? null,

    // Temporário durante a migração
    nfe_status:
      statusMap?.code ?? canonicalCode,

    nfe_protocol: o.nfe_protocol,
    nfe_environment: o.nfe_environment,
    xml_url: o.xml_url,
    danfe_url: o.danfe_url,
    issued_at: o.issued_at,
    issued_date: o.issued_date,

    total_amount: o.total_amount,
    customer_name: o.customer_name,
    customer_tax_id: o.customer_tax_id,
    customer_email: o.customer_email,
  };
}

export async function upsertFromOrder(
  orderId,
  { userId = null, attemptId = null } = {},
) {
  const id = Number(orderId);

  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'order_id inválido' };
  }

  const existing = await pool.query(
    `
    SELECT *
    FROM ${TB_INVOICES}
    WHERE order_id = $1
    ORDER BY invoice_id DESC
    LIMIT 1
    `,
    [id]
  );

  if (existing.rowCount) {
    const currentInvoice = existing.rows[0];
    const invoiceId = currentInvoice.invoice_id;

    const patch = await buildPatchFromOrder(id, attemptId);

    if (!patch) {
      return {
        ok: false,
        error: 'Tentativa autorizada da NF-e não encontrada para o pedido',
      };
    }

    // ==============================================================
    // NF-e issuance date is immutable after it has been recorded.
    // Sync may only populate it when it is still NULL.
    // ==============================================================
    if (currentInvoice.issued_at) {
      delete patch.issued_at;
    }

    if (currentInvoice.issued_date) {
      delete patch.issued_date;
    }

    const out = await update(
      invoiceId,
      patch,
      { userId, operation: 'SYNC_FROM_ORDER' }
    );

    if (out.ok) {
      await createInvoiceIssuedAudit(id, invoiceId);
    }

    return out;
  }

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
      total_amount,
      customer_name,
      customer_tax_id,
      customer_email,
      source_type
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
      COALESCE(a.total_amount, o.total_amount, 0),
      COALESCE(a.customer_name, o.customer_name),
      COALESCE(a.customer_tax_id, o.customer_tax_id),
      COALESCE(a.customer_email, o.customer_email),
      'ORDER'
    FROM ${TB_ORDERS} o
    JOIN ${TB_ORDER_NFE_ATTEMPTS} a
      ON a.order_id = o.order_id
    WHERE o.order_id = $1
      AND a.authorized_at IS NOT NULL
      AND ($2::bigint IS NULL OR a.attempt_id = $2)
    ORDER BY a.attempt_number DESC, a.attempt_id DESC
    LIMIT 1
    RETURNING *
  `;

  const safeAttemptId = Number(attemptId);
  const attemptFilter = Number.isSafeInteger(safeAttemptId) && safeAttemptId > 0
    ? safeAttemptId
    : null;

  const { rows } = await pool.query(sql, [id, attemptFilter]);

  if (!rows.length) {
    return {
      ok: false,
      error: 'Pedido não encontrado ou ainda não faturado/autorizado',
    };
  }

  await createInvoiceIssuedAudit(id, rows[0].invoice_id);

  await createAuditLog({
    tabela: 'invoicesIssued',
    register_id: rows[0].invoice_id,
    operation: 'CREATE_FROM_ORDER',
    user_id: normalizeUserId(userId),
    before: null,
    after: rowToInvoice(rows[0]),
  });

  return {
    ok: true,
    invoice: rowToInvoice(rows[0]),
  };
}

export default upsertFromOrder;
