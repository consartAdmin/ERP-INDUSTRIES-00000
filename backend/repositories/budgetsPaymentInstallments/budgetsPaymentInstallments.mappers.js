// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallments.mappers.js — linha do banco → objeto      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  COLUMNS,
} from './budgetsPaymentInstallments.constants.js';
import {
  toNumber,
} from './budgetsPaymentInstallments.sanitizers.js';
import {
  toDateOnly,
} from './budgetsPaymentInstallments.utils.js';

export function mapInstallmentColumns(row) {
  const out = {};

  for (const [column, def] of Object.entries(COLUMNS)) {
    const value = row[column];

    if (value == null) {
      out[column] = null;
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
        out[column] = toDateOnly(value);
        break;
      default:
        out[column] = value;
    }
  }

  return out;
}

export function mapInstallment(row) {
  return {
    ...mapInstallmentColumns(row),

    payment_method_id: row.payment_method_id != null ? Number(row.payment_method_id) : null,
    payment_method_name: row.payment_method_name || null,
    payment_method_type: row.payment_method_type || null
  };
}
