// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acao.sql.js — WHERE dinâmico e ORDER BY (whitelist)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toInt, normalizeStr } from './plano_acao.sanitizers.js';

export function buildWhere(filters = {}, params = []) {
  const where = [];
  const push = (sql, value) => {
    params.push(value);
    where.push(sql.replace(/\$(\?)/g, `$${params.length}`));
  };

  const qTerm = normalizeStr(filters.q);
  const empresa = normalizeStr(filters.empresa);
  const status = normalizeStr(filters.status);
  const responsavel = normalizeStr(filters.responsavel);
  const item = toInt(filters.item, null);

  if (item != null) push(`item = $?`, item);
  if (empresa) push(`empresa ILIKE $?`, `%${empresa}%`);
  if (status) push(`status ILIKE $?`, `%${status}%`);
  if (responsavel) push(`responsavel ILIKE $?`, `%${responsavel}%`);

  if (qTerm) {
    // Busca “inteligente” em campos principais
    params.push(`%${qTerm}%`);
    const p = `$${params.length}`;
    where.push(`(
      empresa ILIKE ${p}
      OR causa ILIKE ${p}
      OR acao ILIKE ${p}
      OR responsavel ILIKE ${p}
      OR status ILIKE ${p}
      OR situacao_atual ILIKE ${p}
      OR observ_evidencias ILIKE ${p}
      OR campo_extra_01 ILIKE ${p}
    )`);
  }

  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { sql, params };
}

export function parseOrder(orderBy) {
  // whitelist: evite SQL injection
  const allowed = new Map([
    ['id', 'id'],
    ['item', 'item'],
    ['empresa', 'empresa'],
    ['responsavel', 'responsavel'],
    ['data', '"data"'],
    ['status', 'status'],
    ['created_at', 'created_at'],
    ['updated_at', 'updated_at'],
  ]);

  const raw = String(orderBy ?? '').trim();
  if (!raw) return 'ORDER BY item ASC, id ASC';

  const [colRaw, dirRaw] = raw.split(/\s+/);
  const col = allowed.get(colRaw) || null;
  const dir = String(dirRaw ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  if (!col) return 'ORDER BY item ASC, id ASC';
  return `ORDER BY ${col} ${dir}, id ASC`;
}
