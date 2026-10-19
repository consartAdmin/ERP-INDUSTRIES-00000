// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsUpdate.repository.js — updateTrip / setTripStatus     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TRIP_STATUS, httpError, toInt, toEnum } from './deliveryTrips.schema.js';
import { TRIPS, STOPS, TRIP_TRANSITIONS } from './deliveryTrips.constants.js';
import { pickTripHeader } from './deliveryTrips.sanitizers.js';
import { withTransaction, lockTrip } from './deliveryTripsLock.repository.js';
import { getTrip } from './deliveryTripsQuery.repository.js';

export async function updateTrip(tripId, data = {}) {
  const id = toInt(tripId);
  const header = pickTripHeader(data, { partial: true });
  const cols = Object.keys(header);
  await withTransaction(async (client) => {
    const trip = await lockTrip(client, id);
    if (trip.status === 'CANCELADA') throw httpError('TRIP_CANCELADA', 409);
    if (!cols.length) return;
    await client.query(
      `UPDATE ${TRIPS} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE trip_id = $1`,
      [id, ...cols.map((c) => header[c])]
    );
  });
  return getTrip(id);
}

export async function setTripStatus(tripId, data = {}) {
  const id = toInt(tripId);
  const next = toEnum(data.status, TRIP_STATUS, 'INVALID_STATUS');

  await withTransaction(async (client) => {
    const trip = await lockTrip(client, id);
    if (trip.status === next) return;
    if (!TRIP_TRANSITIONS[trip.status].includes(next)) {
      throw httpError(`INVALID_TRANSITION_${trip.status}_TO_${next}`, 409);
    }

    const { rows: [info] } = await client.query(
      `SELECT t.driver_id, t.vehicle_id,
              COUNT(s.*) FILTER (WHERE s.status <> 'CANCELADA')::int AS active_stops,
              COUNT(s.*) FILTER (WHERE s.status = 'PENDENTE')::int   AS pending_stops
         FROM ${TRIPS} t LEFT JOIN ${STOPS} s ON s.trip_id = t.trip_id
        WHERE t.trip_id = $1 GROUP BY t.trip_id`,
      [id]
    );

    const sets = ['status = $2'];
    const params = [id, next];
    const push = (sql, v) => { params.push(v); sets.push(sql.replace('?', `$${params.length}`)); };

    if (next === 'EM_ROTA' && trip.status === 'PLANEJADA') {
      if (!info.driver_id) throw httpError('DRIVER_REQUIRED', 400);
      if (!info.vehicle_id) throw httpError('VEHICLE_REQUIRED', 400);
      if (!info.active_stops) throw httpError('TRIP_WITHOUT_STOPS', 400);
      sets.push('departed_at = now()');
      if ('start_km' in data) push('start_km = ?', toInt(data.start_km));
    }
    if (next === 'CONCLUIDA') {
      if (info.pending_stops) {
        const err = httpError('PENDING_STOPS', 409);
        err.details = { pending: info.pending_stops };
        throw err;
      }
      sets.push('finished_at = now()');
      if ('end_km' in data) push('end_km = ?', toInt(data.end_km));
    }
    if (next === 'PLANEJADA') sets.push('departed_at = NULL', 'finished_at = NULL');
    if (next === 'EM_ROTA' && trip.status === 'CONCLUIDA') sets.push('finished_at = NULL');

    await client.query(`UPDATE ${TRIPS} SET ${sets.join(', ')} WHERE trip_id = $1`, params);
  });
  return getTrip(id);
}
