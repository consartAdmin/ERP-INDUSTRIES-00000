// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.mappers.js — Formato de saída das linhas               ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeReceiptRow(row = {}) {
  if (!row) return null;

  return {
    ...row,
    numero: row.numero ?? row.nfe_number ?? null,
    serie: row.serie ?? null,
    total_nf: row.total_nf ?? row.total_amount ?? null,
  };
}
