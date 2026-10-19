// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.form.js — Leitura, limpeza e contador do formulário    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { $ } from './cancelarNfe.utils.js';
import { state } from './cancelarNfe.state.js';

export function getIdNotaValue() {
  return String($('#idNota')?.value || '').trim();
}

export function getJustificativaValue() {
  return String($('#justificativa')?.value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function updateContadorJustificativa() {
  const total = getJustificativaValue().length;
  const el = $('#contadorJustificativa');

  if (el) {
    el.textContent = `${total} caracteres`;
  }
}

export function clearSelectedInvoice() {
  state.nfesEmitidas = [];
  state.nfeSelecionada = null;

  const ids = [
    'idNota',
    'nfeNumberSelecionada',
    'orderIdSelecionado',
    'buscaNfeEmitida',
    'statusNfeSelecionada',
  ];

  for (const id of ids) {
    const el = $(`#${id}`);
    if (el) el.value = '';
  }
}

export function clearCancellationForm() {
  clearSelectedInvoice();

  const reason = $('#justificativa');
  if (reason) reason.value = '';

  updateContadorJustificativa();
}
