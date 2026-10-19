// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPayments.mappers.js — linha do banco → objeto                 ║
// ║ formatDateColumn / mapPaymentColumns / mapRow                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  COLUMNS,
} from './budgetsPayments.constants.js';
import {
  toNumber,
} from './budgetsPayments.sanitizers.js';

/*
 * O driver pg devolve colunas DATE como Date (meia-noite local) quando não há
 * type parser configurado; String(date).slice(0, 10) daria "Sat Sep 19".
 */
export function formatDateColumn(value) {
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(value).slice(0, 10);
}

export function mapPaymentColumns(row) {
  const out = {};

  for (const [column, def] of Object.entries(COLUMNS)) {
    const value = row[column];

    if (value == null) {
      out[column] = def.enum ? def.default : null;
      continue;
    }

    switch (def.type) {
      case 'bigint':
      case 'integer':
        out[column] = Number(value);
        break;
      case 'numeric':
        out[column] = Number(toNumber(value, 0).toFixed(def.scale ?? 2));
        break;
      case 'date':
        out[column] = formatDateColumn(value);
        break;
      default:
        out[column] = value;
    }
  }

  return out;
}

export function mapRow(row) {
  return {
    ...mapPaymentColumns(row),

    payment_method_name: row.payment_method_name || null,
    payment_method_type: row.payment_method_type || null,
    installments:
      row.installments != null
        ? Number(row.installments)
        : null,

    gap_one: row.gap_one != null ? Number(row.gap_one) : null,
    gap_two: row.gap_two != null ? Number(row.gap_two) : null,
    gap_three: row.gap_three != null ? Number(row.gap_three) : null,
    gap_four: row.gap_four != null ? Number(row.gap_four) : null
  };
}
