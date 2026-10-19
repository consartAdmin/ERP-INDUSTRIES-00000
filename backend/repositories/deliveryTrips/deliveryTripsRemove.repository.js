// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsRemove.repository.js — deleteTrip                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { httpError, toInt } from './deliveryTrips.schema.js';
import { TRIPS } from './deliveryTrips.constants.js';
import { withTransaction, lockTrip } from './deliveryTripsLock.repository.js';

export async function deleteTrip(tripId) {
  const id = toInt(tripId);
  await withTransaction(async (client) => {
    const trip = await lockTrip(client, id);
    if (!['PLANEJADA', 'CANCELADA'].includes(trip.status)) throw httpError(`TRIP_${trip.status}`, 409);
    await client.query(`DELETE FROM ${TRIPS} WHERE trip_id = $1`, [id]);
  });
  return { trip_id: id };
}
