// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsPersist.repository.js — escrita pelo catálogo         ║
// ║ validatePaymentRecord / buildPaymentRecord / insert / update         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  CATALOG,
  COLUMNS,
  PK,
} from './budgetsPayments.constants.js';
import {
  INSERT_PAYMENT_SQL,
  UPDATE_PAYMENT_SQL,
} from './budgetsPayments.sql.js';

/* ──────────────────────────────────────────────────────────────────────
 * Validação e mapeamento pelo catálogo
 * ──────────────────────────────────────────────────────────────────── */

export function validatePaymentRecord(record, columns, context = '') {
  const suffix = context ? ` ${context}` : '';

  for (const column of columns) {
    const def = COLUMNS[column];
    const value = record[column];

    if (value == null) {
      if (def.nullable === false) {
        throw new Error(`${column} é obrigatório${suffix}.`);
      }
      continue;
    }

    if (def.enum && !def.enum.includes(value)) {
      throw new Error(
        `${column} inválido${suffix}: "${value}". Valores aceitos: ${def.enum.join(', ')}.`
      );
    }

    if (def.maxLength && String(value).length > def.maxLength) {
      throw new Error(
        `${column} excede ${def.maxLength} caracteres${suffix}.`
      );
    }

    if (def.type === 'numeric' && def.precision != null) {
      const scale = def.scale ?? 0;
      const max = 10 ** (def.precision - scale) - 10 ** -scale;
      if (Math.abs(Number(value)) > max) {
        throw new Error(
          `${column} excede o limite de numeric(${def.precision},${scale})${suffix}.`
        );
      }
    }
  }
}

export function buildPaymentRecord({
  budgetId,
  paymentMethodId,
  bankAccount,
  amount,
  notes,
  manualDueDate
}) {
  return {
    budget_id: budgetId,
    payment_method_id: paymentMethodId,
    bank_account_id: bankAccount.bank_account_id,
    collection_provider: bankAccount.collection_provider,
    boleto_mode: bankAccount.boleto_mode,
    amount,
    notes,
    manual_due_date: manualDueDate
  };
}

export async function insertPayment(client, record, context = '') {
  validatePaymentRecord(record, CATALOG.insertable, context);

  const { rows } = await client.query(
    INSERT_PAYMENT_SQL,
    CATALOG.insertable.map((column) => record[column])
  );

  return Number(rows[0][PK]);
}

export async function updatePayment(client, budgetPaymentId, record) {
  validatePaymentRecord(record, CATALOG.updatable);

  await client.query(UPDATE_PAYMENT_SQL, [
    budgetPaymentId,
    ...CATALOG.updatable.map((column) => record[column])
  ]);
}
