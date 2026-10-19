// ╔════════════════════════════════════════════════════════════════════╗
// ║ drivers.sanitizers.js — Normalização do payload de motoristas      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { httpError, toInt, toBool, cleanText, toDate } from '../deliveryTrips/deliveryTrips.schema.js';

export function pickPayload(data = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || 'employee_id' in data) out.employee_id = toInt(data.employee_id);
  if (!partial || 'cnh_number' in data) out.cnh_number = cleanText(data.cnh_number, 20);
  if (!partial || 'cnh_category' in data) out.cnh_category = cleanText(data.cnh_category, 5)?.toUpperCase() ?? null;
  if (!partial || 'cnh_expiration' in data) out.cnh_expiration = toDate(data.cnh_expiration);
  if (!partial || 'phone' in data) out.phone = cleanText(data.phone, 30);
  if (!partial || 'is_active' in data) out.is_active = toBool(data.is_active, true);
  if (!partial || 'notes' in data) out.notes = cleanText(data.notes);
  if ('employee_id' in out && !out.employee_id) throw httpError('EMPLOYEE_ID_REQUIRED', 400);
  return out;
}
