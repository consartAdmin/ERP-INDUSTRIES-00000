// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.form.js — Leitura, máscaras e resumo do form    ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULTS } from './nfeInutilizarEvents.config.js';
import {
  formatCnpj,
  onlyDigits,
  toInt,
} from './nfeInutilizarEvents.utils.js';

/* =======================================================================
 * Payload de criação
 * ======================================================================= */
export function buildPayload(el) {
  return {
    companyCnpj: onlyDigits(el.companyCnpj?.value),
    model: String(el.model?.value || DEFAULTS.MODEL).trim(),
    serie: toInt(el.serie?.value, 0),
    numberStart: toInt(el.numberStart?.value, 0),
    numberEnd: toInt(el.numberEnd?.value, 0),
    year: toInt(el.year?.value, new Date().getFullYear()),
    justification: String(el.justification?.value || '').trim(),
  };
}

/* =======================================================================
 * Parâmetros dos filtros
 * ======================================================================= */
export function buildFilterParams(el) {
  const params = new URLSearchParams();

  const map = {
    status: el.filterStatus?.value,
    model: el.filterModel?.value,
    serie: el.filterSerie?.value,
    year: el.filterYear?.value,
    number: el.filterNumber?.value,
    protocol: el.filterProtocol?.value,
    companyCnpj: onlyDigits(el.filterCompanyCnpj?.value),
  };

  Object.entries(map).forEach(([key, value]) => {
    const text = String(value ?? '').trim();
    if (text) params.set(key, text);
  });

  return params;
}

/* =======================================================================
 * Máscaras
 * ======================================================================= */
export function applyCnpjMask(input) {
  if (!input) return;
  input.value = formatCnpj(input.value);
}

/* =======================================================================
 * Resumo da faixa e contador da justificativa
 * ======================================================================= */
export function updateSummary(el) {
  const start = toInt(el.numberStart?.value, 0);
  const end = toInt(el.numberEnd?.value, 0);

  const total = start > 0 && end >= start ? (end - start) + 1 : 0;

  if (el.summaryRange) {
    el.summaryRange.textContent = total > 0 ? `${start} até ${end}` : '—';
  }

  if (el.summaryTotal) {
    el.summaryTotal.textContent = String(total);
  }
}

export function updateJustificationCounter(el) {
  if (!el.justificationCounter || !el.justification) return;

  const total = (el.justification.value || '').length;
  el.justificationCounter.textContent = `${total} caracteres`;
}

/* =======================================================================
 * Defaults e limpeza
 * ======================================================================= */
export function applyDefaultYear(el) {
  if (el.year && !el.year.value) {
    el.year.value = String(new Date().getFullYear());
  }
}

export function resetForm(el) {
  el.formInutilizacao?.reset();

  applyDefaultYear(el);
  updateSummary(el);
  updateJustificationCounter(el);
}

export function resetFilters(el) {
  el.formFiltros?.reset();
}
