// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.validation.js — Validações e regras de status   ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { RULES } from './nfeInutilizarEvents.config.js';

/* =======================================================================
 * Payload de criação
 * ======================================================================= */
export function validatePayload(payload) {
  const errors = [];

  if (!payload.companyCnpj || payload.companyCnpj.length !== RULES.CNPJ_LENGTH) {
    errors.push('Informe um CNPJ válido com 14 dígitos.');
  }

  if (!payload.model) {
    errors.push('Informe o modelo.');
  }

  if (payload.serie < 0) {
    errors.push('Série inválida.');
  }

  if (!payload.numberStart || payload.numberStart < 1) {
    errors.push('Número inicial inválido.');
  }

  if (!payload.numberEnd || payload.numberEnd < 1) {
    errors.push('Número final inválido.');
  }

  if (payload.numberEnd < payload.numberStart) {
    errors.push('O número final não pode ser menor que o número inicial.');
  }

  if (!payload.year || payload.year < RULES.MIN_YEAR) {
    errors.push('Ano inválido.');
  }

  const justificationLength = payload.justification.length;
  if (
    justificationLength < RULES.MIN_JUSTIFICATION ||
    justificationLength > RULES.MAX_JUSTIFICATION
  ) {
    errors.push(
      `A justificativa deve ter entre ${RULES.MIN_JUSTIFICATION} e ${RULES.MAX_JUSTIFICATION} caracteres.`
    );
  }

  return errors;
}

/* =======================================================================
 * Status — helpers internos
 * ======================================================================= */
function normalizeString(value) {
  return String(value ?? '').trim().toLowerCase();
}

function safeStringify(value) {
  try {
    return JSON.stringify(value ?? '');
  } catch {
    return String(value ?? '');
  }
}

function containsAuthorizedSignals(text) {
  const s = normalizeString(text);

  return (
    s.includes('inutilização homologada') ||
    s.includes('inutilizacao homologada') ||
    s.includes('inutilização de número homologado') ||
    s.includes('inutilizacao de numero homologado') ||
    s.includes('autorizad') ||
    s.includes('concluid') ||
    s.includes('inutilizad')
  );
}

const AUTHORIZED_STATUSES = [
  'done',
  'success',
  'authorized',
  'concluido',
  'concluído',
  'inutilizada',
];

/* =======================================================================
 * Status — verifica se está inutilizada / autorizada
 * ======================================================================= */
export function isInutilizada(item) {
  const status = normalizeString(item?.status);

  if (AUTHORIZED_STATUSES.includes(status)) {
    return true;
  }

  const responsePayload = safeStringify(item?.responsePayload).toLowerCase();
  const xmlResponse = String(item?.xmlResponse ?? '').toLowerCase();
  const message = String(item?.message ?? '').toLowerCase();

  if (
    responsePayload.includes('"cstat":102') ||
    responsePayload.includes('"cstat":"102"') ||
    responsePayload.includes('"status":"authorized"') ||
    responsePayload.includes('"situacao":"authorized"')
  ) {
    return true;
  }

  if (
    xmlResponse.includes('<cstat>102</cstat>') ||
    xmlResponse.includes('<cstat>135</cstat>') ||
    xmlResponse.includes('<cstat>136</cstat>')
  ) {
    return true;
  }

  return (
    containsAuthorizedSignals(responsePayload) ||
    containsAuthorizedSignals(xmlResponse) ||
    containsAuthorizedSignals(message)
  );
}

/* =======================================================================
 * Status — classe visual
 * ======================================================================= */
export function statusClass(status) {
  const s = normalizeString(status);

  if (AUTHORIZED_STATUSES.includes(s)) return 'authorized';
  if (s === 'rejected') return 'rejected';
  if (s === 'error') return 'error';
  if (s === 'sent') return 'sent';
  if (s === 'pending' || s === 'processing') return 'pending';

  return 'unknown';
}

/* =======================================================================
 * Status — texto exibido
 * ======================================================================= */
export function getDisplayStatus(item) {
  if (isInutilizada(item)) return 'INUTILIZADA';

  const raw = String(item?.status ?? '').trim();
  if (!raw) return 'UNKNOWN';

  const s = raw.toLowerCase();

  if (s === 'done') return 'DONE';
  if (s === 'success') return 'SUCCESS';
  if (s === 'authorized') return 'AUTHORIZED';
  if (s === 'concluido' || s === 'concluído') return 'CONCLUÍDO';
  if (s === 'sent') return 'SENT';
  if (s === 'pending') return 'PENDING';
  if (s === 'processing') return 'PROCESSING';
  if (s === 'error') return 'ERROR';
  if (s === 'rejected') return 'REJECTED';

  return raw.toUpperCase();
}

export function getDisplayStatusClass(item) {
  return isInutilizada(item) ? 'authorized' : statusClass(item?.status);
}
