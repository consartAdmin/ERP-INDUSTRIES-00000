// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsCreate.repository.js — createTrip (rota + paradas)    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toInt } from './deliveryTrips.schema.js';
import { TRIPS } from './deliveryTrips.constants.js';
import { pickTripHeader } from './deliveryTrips.sanitizers.js';
import { withTransaction } from './deliveryTripsLock.repository.js';
import { insertStops } from './deliveryTripsStopBuilder.repository.js';
import { getTrip } from './deliveryTripsQuery.repository.js';

export async function createTrip(data = {}, userId = null) {
  const header = pickTripHeader(data);
  const stops = Array.isArray(data.stops) ? data.stops : [];
  const force = data.force === true;

  const tripId = await withTransaction(async (client) => {
    const cols = Object.keys(header);
    const { rows } = await client.query(
      `INSERT INTO ${TRIPS} (${cols.join(', ')}, created_by)
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1})
       RETURNING trip_id`,
      [...cols.map((c) => header[c]), toInt(userId)]
    );
    if (stops.length) await insertStops(client, rows[0].trip_id, stops, { force });
    return rows[0].trip_id;
  });
  return getTrip(tripId);
}
