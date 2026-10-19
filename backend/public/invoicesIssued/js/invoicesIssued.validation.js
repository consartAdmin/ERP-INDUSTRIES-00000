// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.validation.js — Validações e status canônicos NF-e  ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function normalizeNfeStatusCode(value) {
  const status = String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const aliases = {
    PENDENTE: 'PENDENTE',

    PROCESSANDO: 'PROCESSANDO',
    PROCESSAMENTO: 'PROCESSANDO',
    EM_PROCESSAMENTO: 'PROCESSANDO',

    AUTORIZADA: 'AUTORIZADO',
    AUTORIZADO: 'AUTORIZADO',
    CONCLUIDO: 'AUTORIZADO',
    CONCLUIDA: 'AUTORIZADO',

    REJEITADA: 'REJEITADO',
    REJEITADO: 'REJEITADO',

    CANCELADA: 'CANCELADO',
    CANCELADO: 'CANCELADO',

    DENEGADA: 'DENEGADO',
    DENEGADO: 'DENEGADO',

    INUTILIZADA: 'INUTILIZADO',
    INUTILIZADO: 'INUTILIZADO',

    ERRO: 'ERRO',
  };

  return aliases[status] || status || null;
}

export function isAuthorizedStatus(value) {
  return normalizeNfeStatusCode(value) === 'AUTORIZADO';
}

export function isCancelledStatus(value) {
  return normalizeNfeStatusCode(value) === 'CANCELADO';
}

export function isValidNfeKey(value) {
  const key = String(value || '').trim();
  return !key || /^\d{44}$/.test(key);
}

export function validateInvoicePayload(payload = {}) {
  const errors = [];

  if (!isValidNfeKey(payload.nfe_key)) {
    errors.push('A chave da NF-e deve possuir 44 dígitos.');
  }

  if (
    payload.nfe_number !== null &&
    payload.nfe_number !== undefined &&
    payload.nfe_number !== '' &&
    (!Number.isSafeInteger(Number(payload.nfe_number)) || Number(payload.nfe_number) <= 0)
  ) {
    errors.push('Número da NF-e inválido.');
  }

  if (
    payload.order_id !== null &&
    payload.order_id !== undefined &&
    payload.order_id !== '' &&
    (!Number.isSafeInteger(Number(payload.order_id)) || Number(payload.order_id) <= 0)
  ) {
    errors.push('Pedido ID inválido.');
  }

  if (
    payload.total_amount !== null &&
    payload.total_amount !== undefined &&
    payload.total_amount !== '' &&
    !Number.isFinite(Number(payload.total_amount))
  ) {
    errors.push('Valor total inválido.');
  }

  const normalizedStatus = normalizeNfeStatusCode(payload.nfe_status);

  return {
    ok: errors.length === 0,
    errors,
    payload: {
      ...payload,
      nfe_status: normalizedStatus,
    },
  };
}
