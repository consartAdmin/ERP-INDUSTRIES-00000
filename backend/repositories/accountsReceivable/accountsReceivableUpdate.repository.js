// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableUpdate.repository.js — updateAccount             ║
// ║ Sincroniza ENTRADA do caixa ao mudar de/para recebida              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './accountsReceivable.constants.js';
import {
  isAsaasCustomerId,
  normalizeErpCustomerId,
  normalizeBankAccountId,
  hasOwn,
} from './accountsReceivable.sanitizers.js';
import { persistenceDiagnostic, isReceivedStatus } from './accountsReceivable.utils.js';
import { runPersistenceQuery, withTransaction } from './accountsReceivableDb.repository.js';
import { syncReceivableCashMovement } from './accountsReceivableCashMovement.repository.js';

export async function updateAccount(id, payload) {
  const {
    customer_id,
    description,
    value,
    due_date,
    payment_date,
    status,
    paid_value,
    amount_paid,
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
      '[accountsReceivableApi.updateAccount] customer_id recebeu ID do Asaas. Use o customer_id interno do ERP.'
    );
  }

  const normalizedCustomerId = normalizeErpCustomerId(customer_id);

  // cash_account_id e bank_account_id só mudam quando vierem no payload.
  // Assim, quem não envia esses campos não apaga o valor gravado.
  const sql = `
    UPDATE ${TB}
    SET
      customer_id  = $1,
      description  = $2,
      value        = $3,
      amount_paid  = $4,
      due_date     = $5,
      payment_date = $6,
      status       = $7,
      invoice_number = $8,
      document_number = $9,
      document_type_id = $10,
      category_id = $11,
      subcategory_id = $12,
      issue_date = $13,
      payment_method_id = $14,
      cash_account_id = CASE WHEN $23::boolean THEN $15 ELSE cash_account_id END,
      fine = $16,
      interest = $17,
      charges = $18,
      notes = $19,
      attachment_url = $20,
      chart_account_id = $21,
      bank_account_id = CASE WHEN $25::boolean THEN $24 ELSE bank_account_id END,
      updated_at   = now()
    WHERE id = $22
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
    Number(paid_value ?? amount_paid ?? 0),
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
    id,
    hasOwn(payload, 'cash_account_id'),
    normalizeBankAccountId(bank_account_id),
    hasOwn(payload, 'bank_account_id'),
  ];

  return withTransaction(async (client) => {
    const { rows: previous } = await client.query(
      `SELECT status FROM ${TB} WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!previous[0]) return null;

    const rows = await runPersistenceQuery('UPDATE', sql, params, {
      accountId: id,
      receivedKeys: Object.keys(payload).sort(),
      requested: persistenceDiagnostic(payload),
    }, client);
    const row = rows[0] || null;

    // Passou a recebida → cria ENTRADA; deixou de ser recebida → desativa.
    // Edição de conta que continua recebida não sobrescreve o caixa.
    if (row) {
      await syncReceivableCashMovement(client, row.id, {
        isTransition: !isReceivedStatus(previous[0].status),
      });
    }
    return row;
  });
}
