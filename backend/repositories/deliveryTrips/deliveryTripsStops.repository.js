// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsStops.repository.js — Paradas da rota                 ║
// ║ addStops, updateStop, setStopStatus, deleteStop, reorderStops      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { STOP_STATUS, httpError, toInt, cleanText, toEnum } from './deliveryTrips.schema.js';
import { STOPS } from './deliveryTrips.constants.js';
import { assertTripEditable, pickStopFields } from './deliveryTrips.sanitizers.js';
import { withTransaction, lockTrip, lockStop } from './deliveryTripsLock.repository.js';
import { assertNotScheduled, insertStops } from './deliveryTripsStopBuilder.repository.js';
import { getTrip } from './deliveryTripsQuery.repository.js';

/* ─────────────────────────── Paradas ─────────────────────────── */

export async function addStops(tripId, data = {}) {
  const id = toInt(tripId);
  const inputs = Array.isArray(data.stops) ? data.stops : [data];
  await withTransaction(async (client) => {
    assertTripEditable(await lockTrip(client, id));
    await insertStops(client, id, inputs, { force: data.force === true });
  });
  return getTrip(id);
}

export async function updateStop(stopId, data = {}) {
  const id = toInt(stopId);
  const fields = pickStopFields(data);
  const cols = Object.keys(fields);
  const tripId = await withTransaction(async (client) => {
    const stop = await lockStop(client, id);
    assertTripEditable({ status: stop.trip_status });
    if (fields.movement_type && fields.movement_type !== stop.movement_type) {
      await assertNotScheduled(client, { ...stop, movement_type: fields.movement_type }, id);
    }
    if (cols.length) {
      await client.query(
        `UPDATE ${STOPS} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE stop_id = $1`,
        [id, ...cols.map((c) => fields[c])]
      );
    }
    return stop.trip_id;
  });
  return getTrip(tripId);
}

export async function setStopStatus(stopId, data = {}) {
  const id = toInt(stopId);
  const next = toEnum(data.status, STOP_STATUS, 'INVALID_STATUS');
  const tripId = await withTransaction(async (client) => {
    const stop = await lockStop(client, id);
    assertTripEditable({ status: stop.trip_status });

    // Reativar uma parada não pode duplicar agendamento do documento
    if (['PENDENTE', 'CONCLUIDA'].includes(next) && !['PENDENTE', 'CONCLUIDA'].includes(stop.status)) {
      await assertNotScheduled(client, stop, id);
    }

    let received_by = null;
    let failure_reason = null;
    if (next === 'CONCLUIDA') received_by = cleanText(data.received_by, 150);
    if (next === 'FALHOU') {
      failure_reason = cleanText(data.failure_reason);
      if (!failure_reason) throw httpError('FAILURE_REASON_REQUIRED', 400);
    }
    await client.query(
      `UPDATE ${STOPS}
          SET status = $2::varchar, received_by = $3, failure_reason = $4,
              completed_at = CASE WHEN $2::varchar IN ('CONCLUIDA','FALHOU') THEN now() ELSE NULL END
        WHERE stop_id = $1`,
      [id, next, received_by, failure_reason]
    );
    return stop.trip_id;
  });
  return getTrip(tripId);
}

export async function deleteStop(stopId) {
  const id = toInt(stopId);
  const tripId = await withTransaction(async (client) => {
    const stop = await lockStop(client, id);
    assertTripEditable({ status: stop.trip_status });
    await client.query(`DELETE FROM ${STOPS} WHERE stop_id = $1`, [id]);
    return stop.trip_id;
  });
  return getTrip(tripId);
}

/** Reordena as paradas: stop_ids na ordem desejada */
export async function reorderStops(tripId, stopIds = []) {
  const id = toInt(tripId);
  const ids = (Array.isArray(stopIds) ? stopIds : []).map((v) => toInt(v)).filter(Boolean);
  if (!ids.length) throw httpError('STOP_IDS_REQUIRED', 400);
  await withTransaction(async (client) => {
    assertTripEditable(await lockTrip(client, id));
    const { rowCount } = await client.query(
      `UPDATE ${STOPS} s SET stop_order = x.ord
         FROM UNNEST($2::bigint[]) WITH ORDINALITY AS x(stop_id, ord)
        WHERE s.stop_id = x.stop_id AND s.trip_id = $1`,
      [id, ids]
    );
    if (rowCount !== ids.length) throw httpError('STOP_NOT_IN_TRIP', 400);
  });
  return getTrip(id);
}
