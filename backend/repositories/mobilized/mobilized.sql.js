// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilized.sql.js — ORDER BY permitido na listagem                  ║
// ╚════════════════════════════════════════════════════════════════════╝

export function parseOrder(orderBy) {
  const allowed = new Map([
    ['mobilized_id', 'm.mobilized_id'],
    ['title', 'm.title'],
    ['status', 'm.status'],
    ['acquired_at', 'm.acquired_at'],
    ['created_at', 'm.created_at'],
    ['updated_at', 'm.updated_at'],
  ]);

  if (!orderBy) return ' ORDER BY m.mobilized_id DESC ';
  const [colRaw, dirRaw] = String(orderBy).trim().split(/\s+/);
  const col = allowed.get(colRaw);
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'DESC';
  return col ? ` ORDER BY ${col} ${dir} ` : ' ORDER BY m.mobilized_id DESC ';
}
