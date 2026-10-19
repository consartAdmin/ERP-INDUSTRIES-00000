// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeOperationTypes.mappers.js — Linha do banco → objeto             ║
// ╚════════════════════════════════════════════════════════════════════╝

export function rowToOperation(row) {
  return row ? {
    ...row,
    operation_type_id: Number(row.operation_type_id),
    generates_receivable: Boolean(row.generates_receivable),
    moves_stock: Boolean(row.moves_stock),
    active: Boolean(row.active),
  } : null;
}
