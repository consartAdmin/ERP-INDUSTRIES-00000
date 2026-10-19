// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableReceive.repository.js — receivePayment           ║
// ║ Baixa + ENTRADA no caixa na mesma transação                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './accountsReceivable.constants.js';
import { normalizeBankAccountId } from './accountsReceivable.sanitizers.js';
import { persistenceDiagnostic, isReceivedStatus } from './accountsReceivable.utils.js';
import { runPersistenceQuery, withTransaction } from './accountsReceivableDb.repository.js';
import { syncReceivableCashMovement } from './accountsReceivableCashMovement.repository.js';

// -------------------------------------------------------------------
// REGISTRO DE RECEBIMENTO
// -------------------------------------------------------------------
export async function receivePayment(id, payload) {
  const original = Number(payload.original_value || 0);
  const discount = Number(payload.discount || 0);
  const interest = Number(payload.interest || 0);
  const charges = Number(payload.charges || 0);

  const pago = original - discount + interest + charges;

  const sql = `
    UPDATE ${TB}
    SET
      amount_paid  = $1,
      payment_date = COALESCE($2::date, CURRENT_DATE),
      status       = 'PAID',
      document_type_id = COALESCE($3, document_type_id),
      category_id = COALESCE($4, category_id),
      subcategory_id = COALESCE($5, subcategory_id),
      cash_account_id = COALESCE($6, cash_account_id),
      chart_account_id = COALESCE($7, chart_account_id),
      interest = $8,
      charges = $9,
      notes = COALESCE($10, notes),
      bank_account_id = COALESCE($12, bank_account_id),
      updated_at   = now()
    WHERE id = $11
    RETURNING
      id,
      customer_id,
      description,
      value,
      amount_paid AS paid_value,
      due_date,
      payment_date,
      status,
      cash_account_id,
      bank_account_id,
      created_at,
      updated_at;
  `;

  const paymentDate = payload.payment_datetime
    ? payload.payment_datetime.substring(0, 10)
    : null;

  const queryParams = [
    pago,
    paymentDate,
    payload.document_type_id || null,
    payload.category_id || null,
    payload.subcategory_id || null,
    payload.cash_account_id || null,
    payload.chart_account_id || null,
    interest,
    charges,
    payload.notes || null,
    id,
    normalizeBankAccountId(payload.bank_account_id),
  ];

  // Baixa + ENTRADA no caixa na mesma transação (ou grava tudo, ou nada)
  return withTransaction(async (client) => {
    const { rows: previous } = await client.query(
      `SELECT status FROM ${TB} WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!previous[0]) return null;

    const rows = await runPersistenceQuery('RECEIVE', sql, queryParams, {
      accountId: id,
      receivedKeys: Object.keys(payload).sort(),
      requested: persistenceDiagnostic(payload),
      calculatedAmountPaid: pago,
    }, client);
    const row = rows[0] || null;
    if (!row) return null;

    const cash = await syncReceivableCashMovement(client, row.id, {
      isTransition: !isReceivedStatus(previous[0].status),
      refresh: true,
      movementDate: payload.payment_datetime || null,
      breakdown: { amount: original - discount, interest, charges },
    });

    return { ...row, cash_movement_id: cash.id ?? null };
  });
}
