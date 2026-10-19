// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsSources.repository.js — Documentos de origem          ║
// ║ listSources, loadSource, loadCustomerAsStop                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  MOVEMENT_TYPES, httpError, toInt, cleanText, toEnum, toDate,
} from './deliveryTrips.schema.js';
import { TRIPS, STOPS, DOCUMENT_TYPES, NOT_FOUND } from './deliveryTrips.constants.js';
import { CUSTOMER_ADDRESS_SQL, stopMatchesDoc, sourceQuery } from './deliveryTrips.sql.js';

/**
 * Lista Pedidos / Orçamentos / Notas Fiscais disponíveis para montar rota.
 * only_unscheduled=true esconde os que já têm parada ativa do mesmo movimento.
 */
export async function listSources({
  source_type = 'PEDIDO', q = '', date_from = null, date_to = null, status = '',
  movement_type = 'ENTREGA', only_unscheduled = true, limit = 100,
} = {}) {
  const type = toEnum(source_type, DOCUMENT_TYPES, 'INVALID_SOURCE_TYPE');
  const movement = toEnum(movement_type, MOVEMENT_TYPES, 'INVALID_MOVEMENT_TYPE', 'ENTREGA');
  const { alias, idCol, numberExpr, statusExpr, dateCol, keys, base, searchLike } = sourceQuery(type);

  const params = [];
  const where = [];
  const term = cleanText(q);
  if (term) {
    params.push(`%${term}%`, term);
    const like = `$${params.length - 1}`;
    const exact = `$${params.length}`;
    const likes = [...searchLike, 'c.city', 'c.neighborhood'].map((col) => `${col} ILIKE ${like}`);
    where.push(`(${numberExpr}::text = ${exact} OR ${likes.join(' OR ')})`);
  }
  const from = toDate(date_from);
  if (from) { params.push(from); where.push(`${dateCol} >= $${params.length}`); }
  const to = toDate(date_to);
  if (to) { params.push(to); where.push(`${dateCol} <= $${params.length}`); }
  const st = cleanText(status, 40);
  if (st) { params.push(st.toUpperCase()); where.push(`${statusExpr} = $${params.length}`); }
  if (only_unscheduled === true || only_unscheduled === 'true') {
    params.push(movement);
    where.push(`NOT EXISTS (
      SELECT 1 FROM ${STOPS} s JOIN ${TRIPS} t ON t.trip_id = s.trip_id
       WHERE ${stopMatchesDoc(keys)} AND s.movement_type = $${params.length}
         AND t.status <> 'CANCELADA' AND s.status IN ('PENDENTE','CONCLUIDA'))`);
  }
  params.push(Math.min(Math.max(toInt(limit, 100), 1), 500));

  const sql = `${base} ${where.length ? `AND ${where.join(' AND ')}` : ''}
    ORDER BY ${dateCol} DESC, ${alias}.${idCol} DESC
    LIMIT $${params.length}`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function loadSource(client, sourceType, sourceId) {
  const { alias, idCol, base } = sourceQuery(sourceType);
  const { rows } = await client.query(`${base} AND ${alias}.${idCol} = $1`, [sourceId]);
  if (!rows[0]) throw httpError(NOT_FOUND[sourceType], 404);
  return rows[0];
}

export async function loadCustomerAsStop(client, customerId) {
  const { rows } = await client.query(
    `SELECT c.customer_id, COALESCE(c.legal_name, c.trade_name) AS recipient_name, c.tax_id,
            COALESCE(c.mobile_number, c.phone_number) AS contact_phone,
            ${CUSTOMER_ADDRESS_SQL} AS address, c.neighborhood, c.city, LEFT(c.state, 2) AS state, c.postal_code
       FROM public.customers c WHERE c.customer_id = $1`,
    [customerId]
  );
  if (!rows[0]) throw httpError('CUSTOMER_NOT_FOUND', 404);
  return rows[0];
}
