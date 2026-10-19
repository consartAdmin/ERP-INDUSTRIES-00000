// ╔════════════════════════════════════════════════════════════════════╗
// ║ transporters.utils.js — Helpers puros (sem acesso ao banco)        ║
// ╚════════════════════════════════════════════════════════════════════╝

export const onlyDigits = (v) => String(v ?? '').replace(/\D+/g, '');

export function normalizeNullable(value) {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? null : normalized;
}

export function normalizeDigits(value) {
  return onlyDigits(value) || null;
}

export function normalizeUF(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized ? normalized.slice(0, 2) : null;
}

export function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

export function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  return err;
}

// CRUD: erro simples (o controller decide o status).
export function parseTransporterId(id) {
  const transporterId = Number(id);

  if (!Number.isInteger(transporterId) || transporterId <= 0) {
    throw new Error('Invalid transporter ID.');
  }

  return transporterId;
}

// Anexos: erro com status HTTP 400.
export function validateTransporterId(id) {
  const transporterId = Number(id);

  if (!Number.isInteger(transporterId) || transporterId <= 0) {
    throw httpError('Invalid transporter ID.', 400);
  }

  return transporterId;
}

export function validateAttachmentId(id) {
  const attachmentId = Number(id);

  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    throw httpError('Invalid attachment ID.', 400);
  }

  return attachmentId;
}
