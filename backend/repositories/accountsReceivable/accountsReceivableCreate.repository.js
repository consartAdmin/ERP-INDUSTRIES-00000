// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableCreate.repository.js — createAccount             ║
// ║ Conta já recebida gera ENTRADA no caixa (mesma transação)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './accountsReceivable.constants.js';
import { isAsaasCustomerId, normalizeErpCustomerId, normalizeBankAccountId } from './accountsReceivable.sanitizers.js';
import { persistenceDiagnostic, isReceivedStatus } from './accountsReceivable.utils.js';
import { runPersistenceQuery, withTransaction } from './accountsReceivableDb.repository.js';
import { syncReceivableCashMovement } from './accountsReceivableCashMovement.repository.js';

// -------------------------------------------------------------------
// CREATE / UPDATE
// -------------------------------------------------------------------
export async function createAccount(payload) {
  const {
    customer_id,
    description,
    value,
    due_date,
    payment_date,
    status,
    invoice_number,
    document_number,
    document_type_id,
    category_id,
    subcategory_id,
    issue_date,
    payment_method_id,
    cash_account_id,
    fine,
    interest,
    charges,
    notes,
    attachment_url,
    chart_account_id,
    bank_account_id,
  } = payload;

  if (isAsaasCustomerId(customer_id)) {
    throw new Error(
      '[accountsReceivableApi.createAccount] customer_id recebeu ID do Asaas. Use o customer_id interno do ERP.'
    );
  }

  const normalizedCustomerId = normalizeErpCustomerId(customer_id);

  const sql = `
    INSERT INTO ${TB} (
      customer_id,
      description,
      value,
      amount_paid,
      due_date,
      payment_date,
      status,
      invoice_number,
      document_number,
      document_type_id,
      category_id,
      subcategory_id,
      issue_date,
      payment_method_id,
      cash_account_id,
      fine,
      interest,
      charges,
      notes,
      attachment_url,
      chart_account_id,
      bank_account_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    RETURNING
      id,
      customer_id,
      description,
      value,
      amount_paid AS paid_value,
      due_date,
      payment_date,
      status,
      invoice_number,
      document_number,
      document_type_id,
      category_id,
      subcategory_id,
      issue_date,
      payment_method_id,
      cash_account_id,
      fine,
      interest,
      charges,
      notes,
      attachment_url,
      chart_account_id,
      bank_account_id,
      created_at,
      updated_at;
  `;

  const params = [
    normalizedCustomerId,
    description || '',
    Number(value || 0),
    Number(payload.paid_value || payload.amount_paid || 0),
    due_date,
    payment_date || null,
    status || 'PENDING',
    invoice_number || null,
    document_number || null,
    document_type_id || null,
    category_id || null,
    subcategory_id || null,
    issue_date || null,
    payment_method_id || null,
    cash_account_id || null,
    Number(fine || 0),
    Number(interest || 0),
    Number(charges || 0),
    notes || null,
    attachment_url || null,
    chart_account_id || null,
    normalizeBankAccountId(bank_account_id),
  ];

  return withTransaction(async (client) => {
    const rows = await runPersistenceQuery('CREATE', sql, params, {
      receivedKeys: Object.keys(payload).sort(),
      requested: persistenceDiagnostic(payload),
    }, client);
    const row = rows[0];

    // Conta já cadastrada como recebida → ENTRADA no caixa
    if (row && isReceivedStatus(row.status)) {
      await syncReceivableCashMovement(client, row.id, { isTransition: true });
    }
    return row;
  });
}
