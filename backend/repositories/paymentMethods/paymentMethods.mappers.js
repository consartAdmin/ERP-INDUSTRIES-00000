// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethods.mappers.js — Linha do banco → objeto                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { GAP_COLUMNS } from './paymentMethods.constants.js';

export function fromDb(row) {
  if (!row) return null;

  const id = Number(
    row.paymentMethods_id ??
    row.paymentmethods_id ??
    row.payment_method_id ??
    row.id
  );

  const result = {
    id,
    paymentMethods_id: id,
    name: row.name ?? '',
    type: row.type ?? '',
    installments: Number(row.installments ?? 1) || 1,
    nfe_tpag: row.nfe_tpag?.trim() || null,
    active: Boolean(row.active),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };

  for (const column of GAP_COLUMNS) {
    result[column] = row[column] == null ? null : Number(row[column]);
  }

  return result;
}
