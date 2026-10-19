// ╔════════════════════════════════════════════════════════════════════╗
// ║ vehicles.sanitizers.js — Normalização do payload de veículos       ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  VEHICLE_TYPES, httpError, toInt, toNum, toBool, cleanText, toEnum,
} from '../deliveryTrips/deliveryTrips.schema.js';

export function normalizePlate(v) {
  const s = cleanText(v, 10);
  if (!s) throw httpError('PLATE_REQUIRED', 400);
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function pickPayload(data = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || 'plate' in data) out.plate = normalizePlate(data.plate);
  if (!partial || 'description' in data) {
    out.description = cleanText(data.description, 120);
    if (!out.description) throw httpError('DESCRIPTION_REQUIRED', 400);
  }
  if (!partial || 'brand' in data) out.brand = cleanText(data.brand, 60);
  if (!partial || 'vehicle_type' in data) out.vehicle_type = toEnum(data.vehicle_type, VEHICLE_TYPES, 'INVALID_VEHICLE_TYPE', 'CARRO');
  if (!partial || 'model_year' in data) out.model_year = toInt(data.model_year);
  if (!partial || 'renavam' in data) out.renavam = cleanText(data.renavam, 20);
  if (!partial || 'capacity_kg' in data) out.capacity_kg = toNum(data.capacity_kg);
  if (!partial || 'capacity_m3' in data) out.capacity_m3 = toNum(data.capacity_m3);
  if (!partial || 'is_active' in data) out.is_active = toBool(data.is_active, true);
  if (!partial || 'notes' in data) out.notes = cleanText(data.notes);
  return out;
}
