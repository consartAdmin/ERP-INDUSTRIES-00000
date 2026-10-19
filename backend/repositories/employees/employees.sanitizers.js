// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employees.sanitizers.js — Normalização de payloads                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { COLS } from './employees.constants.js';
import { toNumOrNull, toStrOrNull, toDateOrNull, toBoolOrNull } from './employees.utils.js';

// ─────────────────────────────────────────────────────────────
// Normalização Employees
// ─────────────────────────────────────────────────────────────

export function normalizePayload(input = {}) {
  const out = {};

  [
    'full_name', 'cpf', 'rg', 'email', 'phone', 'mobile', 'address', 'city', 'state',
    'postal_code', 'position', 'department', 'employment_type', 'trial_notes', 'notes',
  ].forEach((k) => { if (k in input) out[COLS[k]] = toStrOrNull(input[k]); });

  [
    'birth_date', 'admission_date', 'termination_date',
    'trial_start_date', 'trial_end_date', 'trial_extension_end_date',
  ].forEach((k) => { if (k in input) out[COLS[k]] = toDateOrNull(input[k]); });

  ['salary_base', 'transport_benefit', 'food_benefit', 'meal_benefit', 'health_benefit']
    .forEach((k) => { if (k in input) out[COLS[k]] = toNumOrNull(input[k]); });

  ['active', 'trial_extended'].forEach((k) => {
    if (k in input) out[COLS[k]] = toBoolOrNull(input[k]);
  });

  Object.keys(out).forEach((k) => {
    if (out[k] === null && k !== COLS.notes && k !== COLS.trial_notes) delete out[k];
  });

  return out;
}

// ─────────────────────────────────────────────────────────────
// Normalização Docs
// ─────────────────────────────────────────────────────────────
export function normalizeDocPayload(input = {}) {
  const out = {
    employee_id: toNumOrNull(input.employee_id),
    document_type: toStrOrNull(input.document_type),
    file_name: toStrOrNull(input.file_name),
    mime_type: toStrOrNull(input.mime_type) || 'application/octet-stream',
    file_size: toNumOrNull(input.file_size) ?? 0,
    gcs_bucket: toStrOrNull(input.gcs_bucket),
    gcs_path: toStrOrNull(input.gcs_path),
    notes: toStrOrNull(input.notes),
    is_active: (input.is_active === undefined ? true : !!toBoolOrNull(input.is_active)),
  };

  Object.keys(out).forEach((k) => {
    if (out[k] === null && k !== 'notes') delete out[k];
  });

  return out;
}
