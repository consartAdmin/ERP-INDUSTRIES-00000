// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallmentsPersist.repository.js — escrita pelo catálogo ║
// ║ Validação, tradução de erros, insert/update de parcela                  ║
// ╚═════════════════════════════════════════════════════════════════════════╝

import {
  CATALOG,
  COLUMNS,
  PK,
  FK_PAYMENT,
  UNIQUE_INSTALLMENT_NUMBER,
} from './budgetsPaymentInstallments.constants.js';
import {
  INSERT_INSTALLMENT_SQL,
  UPDATE_INSTALLMENT_SQL,
} from './budgetsPaymentInstallments.sql.js';

/* ──────────────────────────────────────────────────────────────────────
 * Validação, escrita e mapeamento pelo catálogo
 * ──────────────────────────────────────────────────────────────────── */

export function fitText(value, column) {
  const max = COLUMNS[column].maxLength;
  if (value == null || !max) return value;
  return value.length > max ? value.slice(0, max) : value;
}

export function validateInstallmentRecord(record, columns) {
  for (const column of columns) {
    const def = COLUMNS[column];
    const value = record[column];

    if (value == null) {
      if (def.nullable === false) {
        throw new Error(`${column} é obrigatório.`);
      }
      continue;
    }

    if (def.enum && !def.enum.includes(value)) {
      throw new Error(
        `${column} inválido: "${value}". Valores aceitos: ${def.enum.join(', ')}.`
      );
    }

    if (def.maxLength && String(value).length > def.maxLength) {
      throw new Error(`${column} excede ${def.maxLength} caracteres.`);
    }

    if (def.min != null && Number(value) < def.min) {
      throw new Error(`${column} não pode ser negativo.`);
    }

    if (def.type === 'numeric' && def.precision != null) {
      const scale = def.scale ?? 0;
      const max = 10 ** (def.precision - scale) - 10 ** -scale;
      if (Math.abs(Number(value)) > max) {
        throw new Error(
          `${column} excede o limite de numeric(${def.precision},${scale}).`
        );
      }
    }
  }
}

export function translateDbError(error, record = {}) {
  if (
    error?.code === '23505' &&
    error.constraint === UNIQUE_INSTALLMENT_NUMBER?.name
  ) {
    return new Error(
      `Já existe a parcela ${record.installment_number} para o pagamento ${record.budget_payment_id}.`
    );
  }

  if (error?.code === '23503' && error.constraint === FK_PAYMENT.name) {
    return new Error(
      `Linha de pagamento do budget não encontrada: ${record.budget_payment_id}.`
    );
  }

  return error;
}

export async function insertInstallment(db, record) {
  validateInstallmentRecord(record, CATALOG.insertable);

  try {
    const { rows } = await db.query(
      INSERT_INSTALLMENT_SQL,
      CATALOG.insertable.map((column) => record[column])
    );
    return Number(rows[0][PK]);
  } catch (error) {
    throw translateDbError(error, record);
  }
}

export async function updateInstallment(db, installmentId, record) {
  validateInstallmentRecord(record, CATALOG.updatable);

  await db.query(UPDATE_INSTALLMENT_SQL, [
    installmentId,
    ...CATALOG.updatable.map((column) => record[column])
  ]);
}
