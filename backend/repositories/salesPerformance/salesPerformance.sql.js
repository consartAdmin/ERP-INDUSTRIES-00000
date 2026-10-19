// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesPerformance.sql.js — Montagem de filtros WHERE / JOIN         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { normalizeDateRange, splitResponsaveis } from './salesPerformance.sanitizers.js';

export function pushDateFilters(whereParts, params, inicio, fim, columnName = 'a.created_at') {
  const range = normalizeDateRange(inicio, fim);

  if (range.inicio) {
    params.push(range.inicio);
    whereParts.push(`${columnName} >= $${params.length}`);
  }

  if (range.fim) {
    params.push(range.fim);
    whereParts.push(`${columnName} <= $${params.length}`);
  }
}

export function pushSellerFilters(whereParts, params, responsaveis, alias = 'a') {
  const { ids, nomes } = splitResponsaveis(responsaveis);
  const local = [];

  if (ids.length) {
    params.push(ids);
    local.push(`${alias}.seller_id = ANY($${params.length}::bigint[])`);
  }

  if (nomes.length) {
    params.push(nomes);
    local.push(`UPPER(TRIM(COALESCE(${alias}.seller_name, ''))) = ANY($${params.length}::text[])`);
  }

  if (local.length) {
    whereParts.push(`(${local.join(' OR ')})`);
  }
}

export function buildWhere(whereParts) {
  return whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
}

export function buildActionJoinFilters({ params, inicio, fim, responsaveis, alias = 'a' }) {
  const joinParts = [];

  pushDateFilters(joinParts, params, inicio, fim, `${alias}.created_at`);
  pushSellerFilters(joinParts, params, responsaveis, alias);

  return joinParts.length ? ` AND ${joinParts.join(' AND ')}` : '';
}
