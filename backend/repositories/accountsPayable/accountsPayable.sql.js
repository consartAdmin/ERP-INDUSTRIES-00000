// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayable.sql.js — Ordenação segura (ORDER BY)               ║
// ╚════════════════════════════════════════════════════════════════════╝

export function parseOrder(orderBy) {
  if (!orderBy) return 'ORDER BY ap.due_date ASC, ap.id DESC';

  const allowedCols = new Set([
    'id',
    'issue_date',
    'due_date',
    'payment_date',
    'status',
    'total_value',
    'amount_paid',
    'balance',
    'created_at',
    'updated_at',
    'invoice_number',
    'document_number'
  ]);

  const [colRaw, dirRaw] = String(orderBy).trim().split(/\s+/);
  const col = allowedCols.has(colRaw) ? colRaw : 'due_date';
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'ASC';

  return `ORDER BY ap.${col} ${dir}, ap.id DESC`;
}
