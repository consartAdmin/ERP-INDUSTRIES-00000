// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsLock.repository.js — Transação e locks (FOR UPDATE)   ║
// ║ withTransaction, lockTrip, lockStop                                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { httpError, mapDbError } from './deliveryTrips.schema.js';
import { TRIPS, STOPS } from './deliveryTrips.constants.js';

/* ─────────────────────────── Helpers ─────────────────────────── */

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw mapDbError(err);
  } finally {
    client.release();
  }
}

export async function lockTrip(client, tripId) {
  const { rows } = await client.query(
    `SELECT trip_id, status FROM ${TRIPS} WHERE trip_id = $1 FOR UPDATE`,
    [tripId]
  );
  if (!rows[0]) throw httpError('TRIP_NOT_FOUND', 404);
  return rows[0];
}

export async function lockStop(client, stopId) {
  const { rows } = await client.query(
    `SELECT s.stop_id, s.trip_id, s.status, s.movement_type, s.order_id, s.budget_id, s.invoice_id,
            t.status AS trip_status
       FROM ${STOPS} s JOIN ${TRIPS} t ON t.trip_id = s.trip_id
      WHERE s.stop_id = $1 FOR UPDATE OF s, t`,
    [stopId]
  );
  if (!rows[0]) throw httpError('STOP_NOT_FOUND', 404);
  return rows[0];
}
