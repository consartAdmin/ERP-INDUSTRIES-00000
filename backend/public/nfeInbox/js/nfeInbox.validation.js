/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.validation.js — Validações | PRODNEX ERP (ESM)         ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

import { getPeriodo } from './nfeInbox.form.js';

export function validateFilters(dom) {
  const { dataIni: start, dataFim: end } = getPeriodo(dom);
  if (start && end && start > end) return 'A data inicial não pode ser posterior à data final.';
  return null;
}

export function getSelectedRow(dom, state) {
  return state.selectedRowEl || dom.$tbody?.querySelector('tr.nfi-row-selected') || null;
}

export function validateSelectedRow(dom, state) {
  const row = getSelectedRow(dom, state);
  if (!row) return { error: 'Selecione uma NF na lista.', row: null };
  if (!row.dataset.id) return { error: 'A linha selecionada não possui um identificador válido.', row: null };
  return { error: null, row };
}

export function validateManifest(dom, state) {
  const selected = validateSelectedRow(dom, state);
  if (selected.error) return selected;
  const operation = (dom.$manifestSelect?.value || '').trim();
  if (!operation) return { error: 'Selecione uma operação de manifestação.', row: null };
  return { ...selected, operation };
}

export function validateXmlFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return { files, error: null };
  const invalid = files.find((file) => !file.name.toLowerCase().endsWith('.xml'));
  return {
    files,
    error: invalid ? `O arquivo "${invalid.name}" não é um XML.` : null,
  };
}
