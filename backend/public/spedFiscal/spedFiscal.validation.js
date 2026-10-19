// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.validation.js — Leitura e validação do formulário        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { DEFAULT_FINALIDADE } from './spedFiscal.config.js';
import { els } from './spedFiscal.state.js';

export function readParams() {
  return {
    companyId: Number(els.companyId?.value || 0),
    month: Number(els.month?.value || 0),
    year: Number(els.year?.value || 0),
    uf: String(els.uf?.value || '').trim().toUpperCase(),
    finalidade: els.finalidade?.value || DEFAULT_FINALIDADE,
  };
}

export function validateInputs() {
  const params = readParams();

  if (!Number.isInteger(params.companyId) || params.companyId <= 0) {
    throw new Error('Selecione a empresa.');
  }

  if (!Number.isInteger(params.month) || params.month < 1 || params.month > 12) {
    throw new Error('Informe um mês válido.');
  }

  if (!Number.isInteger(params.year) || params.year < 2000 || params.year > 2100) {
    throw new Error('Informe um ano válido.');
  }

  return params;
}

export function readLoteId() {
  const loteId = Number(els.downloadLoteId?.value || 0);

  if (!Number.isInteger(loteId) || loteId <= 0) {
    throw new Error('Informe um Lote ID válido para baixar.');
  }

  return loteId;
}
