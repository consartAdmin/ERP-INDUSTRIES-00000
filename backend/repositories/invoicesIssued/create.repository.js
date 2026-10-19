// ╔══════════════════════════════════════════════════════════════════════╗
// ║ create.repository.js — CONSART ERP | Notas Fiscais Emitidas          ║
// ║ Insere a NF-e emitida, audita a criação e a saída de produtos        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  TB_INVOICES,
  INVOICES_ISSUED_INSERT_COLUMNS,
  createAuditLog,
  normalizeNfeStatusCode,
  resolveNfeStatus,
  normalizeMoney,
  normalizeText,
  normalizeUserId,
  withTransaction,
  rowToInvoice,
} from './_shared.js';

import { createInvoiceIssuedAudit } from './_stockOutAudit.js';

export async function create(data = {}, { userId = null } = {}) {
  const canonicalCode = normalizeNfeStatusCode(data.nfe_status);

  const statusMap =
    canonicalCode
      ? await resolveNfeStatus(canonicalCode)
      : null;

  const createColumns = [
    'order_id',
    'budget_id',
    'source_type',
    'nfe_number',
    'nfe_key',
    'nfe_provider_id',
    'nfe_status_id',
    'nfe_status',
    'nfe_protocol',
    'nfe_environment',
    'xml_url',
    'danfe_url',
    'issued_at',
    'issued_date',
    'cancelled_at',
    'cancellation_reason',
    'total_amount',
    'customer_name',
    'customer_tax_id',
    'customer_email',
  ];

  const invalidCreateColumns = createColumns.filter(
    (column) => !INVOICES_ISSUED_INSERT_COLUMNS.includes(column)
  );

  if (invalidCreateColumns.length) {
    throw new Error(
      `Coluna(s) fora do catálogo de invoicesIssued: ${invalidCreateColumns.join(', ')}`
    );
  }

  const sql = `
    INSERT INTO ${TB_INVOICES} (
      order_id,
      budget_id,
      source_type,
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
      cancelled_at,
      cancellation_reason,
      total_amount,
      customer_name,
      customer_tax_id,
      customer_email
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
    )
    RETURNING *
  `;

  const args = [
    data.order_id ?? null,
    data.budget_id ?? null,
    normalizeText(data.source_type, data.budget_id ? 'BUDGET' : 'ORDER'),
    data.nfe_number ?? null,
    normalizeText(data.nfe_key),
    normalizeText(data.nfe_provider_id || data.nfe_id_integracao),
    statusMap?.nfe_status_id ?? null,
    statusMap?.code ?? canonicalCode,
    normalizeText(data.nfe_protocol),
    normalizeText(data.nfe_environment),
    normalizeText(data.xml_url),
    normalizeText(data.danfe_url),
    data.issued_at ?? null,
    data.issued_date ?? null,
    data.cancelled_at ?? null,
    normalizeText(data.cancellation_reason),
    normalizeMoney(data.total_amount, 0),
    normalizeText(data.customer_name),
    normalizeText(data.customer_tax_id),
    normalizeText(data.customer_email),
  ];

  const invoice = await withTransaction(async (client) => {
    const { rows } = await client.query(sql, args);
    const created = rows[0];

    await createAuditLog({
      tabela: 'invoicesIssued',
      register_id: created.invoice_id,
      operation: 'CREATE',
      user_id: normalizeUserId(userId),
      before: null,
      after: rowToInvoice(created),
      db: client,
    });

    return created;
  });

  if (invoice?.order_id) {
    await createInvoiceIssuedAudit(invoice.order_id, invoice.invoice_id);
  }

  return {
    ok: true,
    invoice: rowToInvoice(invoice),
  };
}

export default create;
