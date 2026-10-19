// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.validation.js — Validações e status canônicos          ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  CANONICAL_STATUS,
  CANCELLATION,
} from './cancelarNfe.config.js';

export function normalizeNfeStatusCode(value) {
  const status = String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const aliases = {
    PENDENTE: CANONICAL_STATUS.PENDENTE,

    PROCESSANDO: CANONICAL_STATUS.PROCESSANDO,
    PROCESSAMENTO: CANONICAL_STATUS.PROCESSANDO,
    EM_PROCESSAMENTO: CANONICAL_STATUS.PROCESSANDO,

    AUTORIZADA: CANONICAL_STATUS.AUTORIZADO,
    AUTORIZADO: CANONICAL_STATUS.AUTORIZADO,
    CONCLUIDO: CANONICAL_STATUS.AUTORIZADO,
    CONCLUIDA: CANONICAL_STATUS.AUTORIZADO,

    REJEITADA: CANONICAL_STATUS.REJEITADO,
    REJEITADO: CANONICAL_STATUS.REJEITADO,

    CANCELADA: CANONICAL_STATUS.CANCELADO,
    CANCELADO: CANONICAL_STATUS.CANCELADO,

    DENEGADA: CANONICAL_STATUS.DENEGADO,
    DENEGADO: CANONICAL_STATUS.DENEGADO,

    INUTILIZADA: CANONICAL_STATUS.INUTILIZADO,
    INUTILIZADO: CANONICAL_STATUS.INUTILIZADO,

    ERRO: CANONICAL_STATUS.ERRO,
  };

  return aliases[status] || status || null;
}

export function isAuthorizedStatus(value) {
  return (
    normalizeNfeStatusCode(value) ===
    CANONICAL_STATUS.AUTORIZADO
  );
}

export function validateCancellationForm({
  idNota,
  justificativa,
  invoice,
} = {}) {
  const errors = [];

  const id = String(idNota || '').trim();
  const reason = String(justificativa || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!id) {
    errors.push('Selecione uma NF-e emitida.');
  }

  if (!reason) {
    errors.push(
      'Informe a justificativa do cancelamento.'
    );
  } else if (
    reason.length < CANCELLATION.minReasonLength
  ) {
    errors.push(
      `A justificativa deve conter ao menos ${CANCELLATION.minReasonLength} caracteres.`
    );
  }

  if (
    invoice &&
    !isAuthorizedStatus(invoice.nfe_status)
  ) {
    errors.push(
      `A NF-e selecionada não está AUTORIZADA. Status atual: ${
        normalizeNfeStatusCode(invoice.nfe_status) || 'NÃO INFORMADO'
      }.`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    idNota: id,
    justificativa: reason,
  };
}
