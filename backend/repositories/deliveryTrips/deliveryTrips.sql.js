// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTrips.sql.js — Fragmentos SQL de rotas, paradas e          ║
// ║ documentos de origem (Pedido / Orçamento / NF-e)                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TRIPS, STOPS } from './deliveryTrips.constants.js';

/* ─────────────────────────── SQL fragments ─────────────────────────── */

/** Endereço do cliente em uma linha (customers guarda o endereço em partes) */
export const CUSTOMER_ADDRESS_SQL = `
  NULLIF(CONCAT_WS(' - ',
    NULLIF(CONCAT_WS(', ',
      NULLIF(TRIM(CONCAT_WS(' ', c.street_type, c.street_name)), ''),
      NULLIF(TRIM(c.street_number), '')
    ), ''),
    NULLIF(TRIM(c.address_complement), '')
  ), '')`;

/**
 * Parada "s" pertence ao documento cujas chaves são {order, budget, invoice} (expressões SQL).
 * Uma NF-e guarda também o Pedido/Orçamento de origem, então agendar o Pedido
 * bloqueia a NF-e dele (e vice-versa).
 */
export const stopMatchesDoc = ({ order = 'NULL', budget = 'NULL', invoice = 'NULL' }) => `(
  (${order}::bigint IS NOT NULL AND s.order_id = ${order})
  OR (${budget}::bigint IS NOT NULL AND s.budget_id = ${budget})
  OR (${invoice}::bigint IS NOT NULL AND s.invoice_id = ${invoice}))`;

/** Paradas "ativas" de um documento: parada PENDENTE/CONCLUIDA em rota não cancelada */
export const scheduledSql = (keys) => `
  COALESCE((
    SELECT json_agg(json_build_object(
             'trip_id', t.trip_id, 'trip_date', t.trip_date::text, 'trip_status', t.status,
             'movement_type', s.movement_type, 'stop_status', s.status
           ) ORDER BY t.trip_date DESC)
      FROM ${STOPS} s
      JOIN ${TRIPS} t ON t.trip_id = s.trip_id
     WHERE ${stopMatchesDoc(keys)}
       AND t.status <> 'CANCELADA'
       AND s.status IN ('PENDENTE','CONCLUIDA')
  ), '[]'::json)`;

export const TRIP_SELECT = `
  SELECT t.trip_id, t.trip_date::text AS trip_date, t.name, t.status, t.driver_id, t.vehicle_id,
         t.start_km, t.end_km, t.departed_at, t.finished_at, t.notes,
         t.created_by, t.created_at, t.updated_at,
         e.full_name AS driver_name, COALESCE(d.phone, e.mobile, e.phone) AS driver_phone,
         d.cnh_number AS driver_cnh,
         v.plate AS vehicle_plate, v.description AS vehicle_description,
         v.capacity_kg AS vehicle_capacity_kg,
         COALESCE(st.total, 0)::int       AS stops_total,
         COALESCE(st.pending, 0)::int     AS stops_pending,
         COALESCE(st.done, 0)::int        AS stops_done,
         COALESCE(st.failed, 0)::int      AS stops_failed,
         COALESCE(st.deliveries, 0)::int  AS deliveries_count,
         COALESCE(st.pickups, 0)::int     AS pickups_count,
         COALESCE(st.weight, 0)::numeric  AS total_weight,
         COALESCE(st.volumes, 0)::int     AS total_volumes
    FROM ${TRIPS} t
    LEFT JOIN public."drivers" d  ON d.driver_id = t.driver_id
    LEFT JOIN public.employees e  ON e.employee_id = d.employee_id
    LEFT JOIN public."vehicles" v ON v.vehicle_id = t.vehicle_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE s.status <> 'CANCELADA')   AS total,
             COUNT(*) FILTER (WHERE s.status = 'PENDENTE')     AS pending,
             COUNT(*) FILTER (WHERE s.status = 'CONCLUIDA')    AS done,
             COUNT(*) FILTER (WHERE s.status = 'FALHOU')       AS failed,
             COUNT(*) FILTER (WHERE s.movement_type = 'ENTREGA' AND s.status <> 'CANCELADA') AS deliveries,
             COUNT(*) FILTER (WHERE s.movement_type = 'COLETA'  AND s.status <> 'CANCELADA') AS pickups,
             SUM(s.gross_weight) FILTER (WHERE s.status <> 'CANCELADA') AS weight,
             SUM(s.volumes)      FILTER (WHERE s.status <> 'CANCELADA') AS volumes
        FROM ${STOPS} s WHERE s.trip_id = t.trip_id
    ) st ON TRUE
`;

export const STOP_COLS = `
  s.stop_id, s.trip_id, s.stop_order, s.movement_type, s.source_type, s.order_id, s.budget_id,
  s.invoice_id, inv.nfe_number, inv.nfe_key, s.customer_id, s.recipient_name, s.tax_id, s.contact_phone, s.address, s.neighborhood,
  s.city, s.state, s.postal_code, s.volumes, s.gross_weight, s.document_amount, s.status,
  s.received_by, s.failure_reason, s.completed_at, s.notes, s.created_at, s.updated_at`;

/**
 * SELECT de documentos no formato de parada.
 *   idCol      → chave usada em source_id
 *   numberExpr → número exibido/buscado (Pedido/Orçamento = id; NF-e = nº da nota)
 *   keys       → vínculos do documento para detectar agendamento duplicado
 */
export function sourceQuery(sourceType) {
  if (sourceType === 'PEDIDO') {
    const keys = { order: 'o.order_id' };
    return {
      alias: 'o',
      idCol: 'order_id',
      numberExpr: 'o.order_id',
      statusExpr: 'o.status',
      dateCol: 'o.issue_date',
      keys,
      searchLike: ['o.customer_name', 'o.customer_tax_id'],
      base: `
        SELECT 'PEDIDO' AS source_type, o.order_id AS source_id, o.order_id AS doc_number,
               o.order_id, NULL::bigint AS budget_id, NULL::bigint AS invoice_id, NULL::bigint AS nfe_number,
               o.issue_date::text AS issue_date, o.status, o.customer_id,
               COALESCE(NULLIF(o.customer_name, ''), c.legal_name, c.trade_name) AS recipient_name,
               COALESCE(NULLIF(o.customer_tax_id, ''), c.tax_id) AS tax_id,
               COALESCE(NULLIF(o.customer_phone, ''), c.mobile_number, c.phone_number) AS contact_phone,
               ${CUSTOMER_ADDRESS_SQL} AS address,
               c.neighborhood, c.city, LEFT(c.state, 2) AS state, c.postal_code,
               od.volume_quantity AS volumes, od.gross_weight, o.total_amount AS document_amount,
               ${scheduledSql(keys)} AS scheduled
          FROM public.orders o
          LEFT JOIN public.customers c ON c.customer_id = o.customer_id
          LEFT JOIN public."ordersDelivery" od ON od.order_id = o.order_id
         WHERE COALESCE(o.status, '') <> 'CANCELADO'`,
    };
  }

  if (sourceType === 'NFE') {
    // invoicesIssued não tem customer_id: cliente/endereço/volumes vêm do Pedido ou Orçamento de origem
    const keys = { order: 'i.order_id', budget: 'i.budget_id', invoice: 'i.invoice_id' };
    return {
      alias: 'i',
      idCol: 'invoice_id',
      numberExpr: 'i.nfe_number',
      statusExpr: 'i.nfe_status',
      dateCol: 'COALESCE(i.issued_date, i.issued_at::date)',
      keys,
      searchLike: ['i.customer_name', 'i.customer_tax_id', 'i.nfe_key'],
      base: `
        SELECT 'NFE' AS source_type, i.invoice_id AS source_id, i.nfe_number AS doc_number,
               i.order_id, i.budget_id, i.invoice_id, i.nfe_number, i.nfe_key,
               COALESCE(i.issued_date, i.issued_at::date)::text AS issue_date, i.nfe_status AS status,
               c.customer_id,
               COALESCE(NULLIF(i.customer_name, ''), c.legal_name, c.trade_name) AS recipient_name,
               COALESCE(NULLIF(i.customer_tax_id, ''), c.tax_id) AS tax_id,
               COALESCE(NULLIF(o.customer_phone, ''), NULLIF(b.customer_phone, ''), c.mobile_number, c.phone_number) AS contact_phone,
               ${CUSTOMER_ADDRESS_SQL} AS address,
               c.neighborhood, c.city, LEFT(c.state, 2) AS state, c.postal_code,
               COALESCE(od.volume_quantity, bs.volumes) AS volumes,
               COALESCE(od.gross_weight, bs.gross_weight) AS gross_weight,
               i.total_amount AS document_amount,
               ${scheduledSql(keys)} AS scheduled
          FROM public."invoicesIssued" i
          LEFT JOIN public.orders o  ON o.order_id = i.order_id
          LEFT JOIN public.budgets b ON b.budget_id = i.budget_id
          LEFT JOIN public.customers c ON c.customer_id = COALESCE(o.customer_id, b.customer_id)
          LEFT JOIN public."ordersDelivery" od  ON od.order_id = i.order_id
          LEFT JOIN public."budgetsShipping" bs ON bs.budget_id = i.budget_id
         WHERE i.nfe_status IN ('AUTORIZADO', 'AUTORIZADA')`,
    };
  }

  const keys = { budget: 'b.budget_id' };
  return {
    alias: 'b',
    idCol: 'budget_id',
    numberExpr: 'b.budget_id',
    statusExpr: 'b.status',
    dateCol: 'b.issue_date',
    keys,
    searchLike: ['b.customer_name', 'b.customer_tax_id'],
    // Orçamentos CONVERTIDOS viraram Pedido — a entrega é feita pelo Pedido
    base: `
      SELECT 'ORCAMENTO' AS source_type, b.budget_id AS source_id, b.budget_id AS doc_number,
             NULL::bigint AS order_id, b.budget_id, NULL::bigint AS invoice_id, NULL::bigint AS nfe_number,
             b.issue_date::text AS issue_date, b.status, b.customer_id,
             COALESCE(NULLIF(b.customer_name, ''), c.legal_name, c.trade_name) AS recipient_name,
             COALESCE(NULLIF(b.customer_tax_id, ''), c.tax_id) AS tax_id,
             COALESCE(NULLIF(b.customer_phone, ''), c.mobile_number, c.phone_number) AS contact_phone,
             ${CUSTOMER_ADDRESS_SQL} AS address,
             c.neighborhood, c.city, LEFT(c.state, 2) AS state, c.postal_code,
             bs.volumes, bs.gross_weight, b.total_amount AS document_amount,
             ${scheduledSql(keys)} AS scheduled
        FROM public.budgets b
        LEFT JOIN public.customers c ON c.customer_id = b.customer_id
        LEFT JOIN public."budgetsShipping" bs ON bs.budget_id = b.budget_id
       WHERE COALESCE(b.status, '') NOT IN ('CONVERTIDO', 'CANCELADO')`,
  };
}
