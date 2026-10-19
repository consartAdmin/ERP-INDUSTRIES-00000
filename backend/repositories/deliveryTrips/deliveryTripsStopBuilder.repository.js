// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsStopBuilder.repository.js — Montagem/inserção de      ║
// ║ paradas: buildStop, assertNotScheduled, insertStops                ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  SOURCE_TYPES, MOVEMENT_TYPES, httpError, toInt, cleanText, toEnum,
} from './deliveryTrips.schema.js';
import { TRIPS, STOPS, DOCUMENT_TYPES, SOURCE_ID_FIELD } from './deliveryTrips.constants.js';
import { stopMatchesDoc } from './deliveryTrips.sql.js';
import { pickStopFields } from './deliveryTrips.sanitizers.js';
import { loadSource, loadCustomerAsStop } from './deliveryTripsSources.repository.js';

/**
 * Monta a parada a partir do payload:
 *   { source_type:'PEDIDO', source_id | order_id, movement_type }
 *   { source_type:'ORCAMENTO', source_id | budget_id, movement_type }
 *   { source_type:'NFE', source_id | invoice_id, movement_type }  → guarda também o Pedido/Orçamento da nota
 *   { source_type:'AVULSO', customer_id?, recipient_name, address, ... }
 * Campos enviados explicitamente sobrescrevem os do documento.
 */
export async function buildStop(client, input = {}) {
  const source_type = toEnum(input.source_type, SOURCE_TYPES, 'INVALID_SOURCE_TYPE', 'AVULSO');
  const movement_type = toEnum(input.movement_type, MOVEMENT_TYPES, 'INVALID_MOVEMENT_TYPE', 'ENTREGA');
  const overrides = pickStopFields(input);

  let base = {};
  if (DOCUMENT_TYPES.includes(source_type)) {
    const id = toInt(input.source_id ?? input[SOURCE_ID_FIELD[source_type]]);
    if (!id) throw httpError('SOURCE_ID_REQUIRED', 400);
    const doc = await loadSource(client, source_type, id);
    base = {
      order_id: doc.order_id, budget_id: doc.budget_id, invoice_id: doc.invoice_id,
      nfe_number: doc.nfe_number, customer_id: doc.customer_id,
      recipient_name: doc.recipient_name, tax_id: doc.tax_id, contact_phone: doc.contact_phone,
      address: doc.address, neighborhood: doc.neighborhood, city: doc.city, state: doc.state,
      postal_code: doc.postal_code, volumes: doc.volumes, gross_weight: doc.gross_weight,
      document_amount: doc.document_amount,
    };
  } else if (toInt(input.customer_id)) {
    base = await loadCustomerAsStop(client, toInt(input.customer_id));
  }

  const stop = {
    order_id: null, budget_id: null, invoice_id: null, customer_id: null,
    ...base,
    ...overrides,
    source_type,
    movement_type,
  };
  stop.recipient_name = cleanText(stop.recipient_name, 255);
  if (!stop.recipient_name) throw httpError('RECIPIENT_NAME_REQUIRED', 400);
  return stop;
}

/** Garante que o documento não está em outra parada ativa do mesmo movimento */
export async function assertNotScheduled(client, stop, ignoreStopId = null) {
  if (!stop.order_id && !stop.budget_id && !stop.invoice_id) return;
  const { rows } = await client.query(
    `SELECT s.stop_id, s.trip_id, t.trip_date::text AS trip_date,
            s.source_type, s.order_id, s.budget_id, inv.nfe_number
       FROM ${STOPS} s
       JOIN ${TRIPS} t ON t.trip_id = s.trip_id
       LEFT JOIN public."invoicesIssued" inv ON inv.invoice_id = s.invoice_id
      WHERE ${stopMatchesDoc({ order: '$1', budget: '$2', invoice: '$3' })}
        AND s.movement_type = $4
        AND t.status <> 'CANCELADA' AND s.status IN ('PENDENTE','CONCLUIDA')
        AND ($5::bigint IS NULL OR s.stop_id <> $5)
      LIMIT 1`,
    [stop.order_id ?? null, stop.budget_id ?? null, stop.invoice_id ?? null, stop.movement_type, ignoreStopId]
  );
  if (rows[0]) {
    // Descreve a parada que já existe (pode ser o Pedido de uma NF-e, ou vice-versa)
    const hit = rows[0];
    const label = hit.source_type === 'NFE' ? `NF-e ${hit.nfe_number}`
      : hit.order_id ? `Pedido ${hit.order_id}` : `Orçamento ${hit.budget_id}`;
    const err = httpError(`ALREADY_SCHEDULED`, 409);
    err.details = { document: label, trip_id: hit.trip_id, trip_date: hit.trip_date };
    throw err;
  }
}

export async function insertStops(client, tripId, inputs = [], { force = false } = {}) {
  const { rows: [{ next }] } = await client.query(
    `SELECT COALESCE(MAX(stop_order), 0) + 1 AS next FROM ${STOPS} WHERE trip_id = $1`,
    [tripId]
  );
  let order = Number(next);
  const inserted = [];
  const seen = new Set();

  for (const input of inputs) {
    const stop = await buildStop(client, input);
    const key = (stop.order_id || stop.budget_id || stop.invoice_id)
      ? `${stop.order_id}|${stop.budget_id}|${stop.invoice_id}|${stop.movement_type}` : null;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    if (!force) await assertNotScheduled(client, stop);

    const cols = [
      'trip_id', 'stop_order', 'movement_type', 'source_type', 'order_id', 'budget_id', 'invoice_id', 'customer_id',
      'recipient_name', 'tax_id', 'contact_phone', 'address', 'neighborhood', 'city', 'state',
      'postal_code', 'volumes', 'gross_weight', 'document_amount', 'notes',
    ];
    const values = { ...stop, trip_id: tripId, stop_order: order++ };
    const { rows } = await client.query(
      `INSERT INTO ${STOPS} (${cols.join(', ')})
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING stop_id`,
      cols.map((c) => values[c] ?? null)
    );
    inserted.push(rows[0].stop_id);
  }
  return inserted;
}
