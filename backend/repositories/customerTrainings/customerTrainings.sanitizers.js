// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainings.sanitizers.js — Normalização de entrada          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { FORMATS, STATUSES } from './customerTrainings.constants.js';

export const toStrOrNull = (v) => (v === '' || v == null ? null : String(v).trim() || null);

export const toBool = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'boolean') return v;
  return ['true', '1', 't', 'yes', 'y', 'sim', 's', 'on'].includes(String(v).toLowerCase());
};

export function toPositiveInt(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function normalizeStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  return STATUSES.includes(s) ? s : null;
}

export function normalizeFormat(v) {
  const s = String(v || '').trim().toLowerCase();
  return FORMATS.includes(s) ? s : null;
}

// Aceita "YYYY-MM-DDTHH:mm", "YYYY-MM-DD HH:mm[:ss]" → "YYYY-MM-DD HH:mm:ss"
export function normalizeDateTime(v) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v || '').trim());
  return m ? `${m[1]} ${m[2]}:${m[3]}:${m[4] || '00'}` : null;
}

export function normalizeDate(v) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || '').trim());
  return m ? m[1] : null;
}

export function normalizeAttendees(list) {
  if (!Array.isArray(list)) return [];

  return list
    .map((a) => ({
      name: toStrOrNull(a?.name),
      email: toStrOrNull(a?.email),
      phone: toStrOrNull(a?.phone),
      attended: toBool(a?.attended),
    }))
    .filter((a) => a.name || a.email);
}

export function badRequest(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Campos editáveis do treinamento (create / update) — valida obrigatórios
export function normalizeTrainingPayload(payload = {}) {
  const fields = {
    customer_id: toPositiveInt(payload.customer_id),
    title: toStrOrNull(payload.title),
    topics: toStrOrNull(payload.topics),
    scheduled_at: normalizeDateTime(payload.scheduled_at),
    duration_minutes: toPositiveInt(payload.duration_minutes) || 60,
    format: normalizeFormat(payload.format) || 'online',
    location_or_link: toStrOrNull(payload.location_or_link),
    trainer_name: toStrOrNull(payload.trainer_name),
    status: normalizeStatus(payload.status),
  };

  if (!fields.customer_id) throw badRequest('Selecione o cliente do treinamento.');
  if (!fields.title) throw badRequest('Informe o título do treinamento.');
  if (!fields.scheduled_at) throw badRequest('Informe a data e o horário do treinamento.');

  return fields;
}
