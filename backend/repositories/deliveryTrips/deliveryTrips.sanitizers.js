// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTrips.sanitizers.js — Payload de rota/parada e checagens   ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  MOVEMENT_TYPES, httpError, toInt, toNum, cleanText, toEnum, toDate,
} from './deliveryTrips.schema.js';
import { LOCKED_TRIP_STATUS } from './deliveryTrips.constants.js';

export function assertTripEditable(trip) {
  if (LOCKED_TRIP_STATUS.includes(trip.status)) throw httpError(`TRIP_${trip.status}`, 409);
}

export function pickTripHeader(data = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || 'trip_date' in data) {
    out.trip_date = toDate(data.trip_date);
    if (!out.trip_date) throw httpError('TRIP_DATE_REQUIRED', 400);
  }
  if (!partial || 'name' in data) out.name = cleanText(data.name, 120);
  if (!partial || 'driver_id' in data) out.driver_id = toInt(data.driver_id);
  if (!partial || 'vehicle_id' in data) out.vehicle_id = toInt(data.vehicle_id);
  if (!partial || 'start_km' in data) out.start_km = toInt(data.start_km);
  if (!partial || 'end_km' in data) out.end_km = toInt(data.end_km);
  if (!partial || 'notes' in data) out.notes = cleanText(data.notes);
  return out;
}

/** Campos editáveis manualmente em uma parada */
export function pickStopFields(data = {}) {
  const out = {};
  if ('movement_type' in data) out.movement_type = toEnum(data.movement_type, MOVEMENT_TYPES, 'INVALID_MOVEMENT_TYPE');
  if ('recipient_name' in data) out.recipient_name = cleanText(data.recipient_name, 255);
  if ('tax_id' in data) out.tax_id = cleanText(data.tax_id, 32);
  if ('contact_phone' in data) out.contact_phone = cleanText(data.contact_phone, 50);
  if ('address' in data) out.address = cleanText(data.address, 500);
  if ('neighborhood' in data) out.neighborhood = cleanText(data.neighborhood, 120);
  if ('city' in data) out.city = cleanText(data.city, 120);
  if ('state' in data) out.state = cleanText(data.state, 2)?.toUpperCase() ?? null;
  if ('postal_code' in data) out.postal_code = cleanText(data.postal_code, 12);
  if ('volumes' in data) out.volumes = toInt(data.volumes);
  if ('gross_weight' in data) out.gross_weight = toNum(data.gross_weight);
  if ('document_amount' in data) out.document_amount = toNum(data.document_amount);
  if ('notes' in data) out.notes = cleanText(data.notes);
  if ('recipient_name' in out && !out.recipient_name) throw httpError('RECIPIENT_NAME_REQUIRED', 400);
  return out;
}
