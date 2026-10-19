// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutes.sql.js — Montagem do WHERE da listagem              ║
// ║ Filtros: q, is_active, route_type                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toBool, normalizeRouteType } from './deliveryRoutes.sanitizers.js';

export function buildWhere({ q, is_active, route_type }) {
  const where = [];
  const params = [];

  const qStr = (q ?? '').toString().trim();
  if (qStr) {
    params.push(`%${qStr}%`);
    const p = `$${params.length}`;
    where.push(
      `(name ILIKE ${p} OR route_code ILIKE ${p} OR city ILIKE ${p} OR region ILIKE ${p} OR driver_name ILIKE ${p} OR vehicle_plate ILIKE ${p} OR linked_name ILIKE ${p} OR linked_tax_id ILIKE ${p})`
    );
  }

  const act = toBool(is_active, null);
  if (act !== null) {
    params.push(act);
    where.push(`is_active = $${params.length}`);
  }

  const rt = route_type === null || route_type === undefined || route_type === ''
    ? null
    : normalizeRouteType(route_type, null);

  if (rt) {
    params.push(rt);
    where.push(`route_type = $${params.length}`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}
