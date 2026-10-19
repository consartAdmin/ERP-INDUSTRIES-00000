// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.actions.js — Ações e fluxo do módulo Transportadoras   ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements } from './transporters.config.js';
import { state, resetEditing, resetPagination } from './transporters.state.js';
import {
  consultPublicCnpj,
  createTransporter,
  listTransporterAttachments,
  listTransporters,
  removeTransporter,
  removeTransporterAttachment,
  resolveIbgeCity,
  updateTransporter,
  uploadTransporterAttachment
} from './transporters.api.js';
import { applyCnpjLookupData, clearTransporterForm, fillTransporterForm, getTransporterFormData } from './transporters.form.js';
import {
  closeTransporterModal,
  getModalElements,
  openTransporterModal,
  setAttachmentsEnabled,
  setTransporterModalLoading,
  setTransporterModalMode,
  showAttachmentsAlert,
  showCnpjLookupStatus,
  showTransporterModalError
} from './transporters.modal.js';
import { renderAttachments, renderTransportersTable } from './transporters.render.js';
import { asArray, normalizeState, onlyDigits } from './transporters.utils.js';
import { validateTransporter } from './transporters.validation.js';

let lastCnpjLookup = '';
let activeCnpjLookupToken = 0;

function resetCnpjLookupControl() {
  lastCnpjLookup = '';
  activeCnpjLookupToken += 1;
  showCnpjLookupStatus('');
}

function extractResolvedIbgeCode(payload) {
  const root = payload?.data ?? payload;

  if (Array.isArray(root) && root[0]) {
    const item = root[0];
    return item.ibgeCode ?? item.ibge_code ?? item.codigo_ibge ?? item.codigo ?? item.city_ibge_code ?? item.ibge_city_code ?? '';
  }

  if (root && typeof root === 'object') {
    return root.ibgeCode ?? root.ibge_code ?? root.codigo_ibge ?? root.codigo ?? root.city_ibge_code ?? root.ibge_city_code ?? '';
  }

  return '';
}

export async function lookupCnpjAndFill(cnpjValue) {
  const cnpj = onlyDigits(cnpjValue);
  if (cnpj.length !== 14) return;

  if (cnpj === lastCnpjLookup) return;

  const token = ++activeCnpjLookupToken;
  showCnpjLookupStatus('Consultando CNPJ...', 'loading');

  try {
    const response = await consultPublicCnpj(cnpj);
    if (token !== activeCnpjLookupToken) return;

    const d = response?.dados || response?.data || response || {};
    const est = d?.estabelecimento || {};
    const cidade = est?.cidade || {};
    const estado = est?.estado || {};
    const uf = normalizeState(estado?.sigla || est?.uf || d?.uf || '');
    const city = String(cidade?.nome || est?.cidade_nome || d?.municipio || d?.cidade || '').trim();

    let resolvedIbgeCode = '';
    if (uf && city) {
      const ibgeResponse = await resolveIbgeCity(uf, city);
      if (token !== activeCnpjLookupToken) return;
      resolvedIbgeCode = extractResolvedIbgeCode(ibgeResponse);
    }

    applyCnpjLookupData(response, resolvedIbgeCode);
    lastCnpjLookup = cnpj;
    showCnpjLookupStatus('Dados importados automaticamente pelo CNPJ.', 'success');
  } catch (error) {
    if (token !== activeCnpjLookupToken) return;

    lastCnpjLookup = '';
    console.error('[transporters.lookupCnpjAndFill]', error);
    showCnpjLookupStatus(
      error?.message || 'Não foi possível consultar este CNPJ.',
      'error'
    );
  }
}

export async function loadTransporters() {
  state.loading = true;
  try {
    const response = await listTransporters();
    state.rows = asArray(response);
    applyFilters();
  } finally {
    state.loading = false;
  }
}

export function applyFilters() {
  const els = getPageElements();
  const q = String(els.searchInput?.value || '').trim().toLowerCase();
  const city = String(els.searchCity?.value || '').trim().toLowerCase();
  const uf = String(els.searchState?.value || '').trim().toLowerCase();
  const status = String(els.searchStatus?.value || '');

  state.filteredRows = state.rows.filter((row) => {
    const searchable = [
      row.legal_name,
      row.trade_name,
      row.tax_id,
      row.cpf,
      row.city,
      row.contact_name,
      row.phone_number,
      row.mobile_number,
      row.notes
    ].map((value) => String(value || '').toLowerCase());

    const matchesText = !q || searchable.some((value) => value.includes(q));
    const matchesCity = !city || String(row.city || '').toLowerCase().includes(city);
    const matchesState = !uf || String(row.state || '').toLowerCase() === uf;
    const matchesStatus = !status || String(Boolean(row.is_active)) === status;

    return matchesText && matchesCity && matchesState && matchesStatus;
  });

  resetPagination();
  renderTransportersTable();
}

export function openCreateModal() {
  resetEditing();
  resetCnpjLookupControl();
  clearTransporterForm();
  setTransporterModalMode('create');
  showTransporterModalError('');
  renderAttachments([]);
  setAttachmentsEnabled(false);
  openTransporterModal();
}

export async function openEditModal(row) {
  resetCnpjLookupControl();
  state.editingId = Number(row.transporter_id || 0) || null;
  fillTransporterForm(row);
  setTransporterModalMode('edit', state.editingId);
  showTransporterModalError('');
  setAttachmentsEnabled(Boolean(state.editingId));
  openTransporterModal();
  await loadAttachments();
}

export async function saveTransporter() {
  try {
    setTransporterModalLoading(true);
    showTransporterModalError('');

    const payload = getTransporterFormData();
    validateTransporter(payload);

    if (state.editingId) {
      await updateTransporter(state.editingId, payload);
    } else {
      await createTransporter(payload);
    }

    closeTransporterModal();
    resetEditing();
    await loadTransporters();
  } catch (error) {
    console.error('[transporters.saveTransporter]', error);
    showTransporterModalError(error.message || 'Erro ao salvar a transportadora.');
  } finally {
    setTransporterModalLoading(false);
  }
}

export async function deleteTransporter(id) {
  const confirmed = window.confirm('Deseja realmente excluir esta transportadora?');
  if (!confirmed) return;

  await removeTransporter(id);
  await loadTransporters();
}

export async function handleTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const row = state.rows.find((item) => Number(item.transporter_id) === id);

  try {
    if (button.dataset.action === 'edit' && row) {
      await openEditModal(row);
      return;
    }

    if (button.dataset.action === 'delete' && id) {
      await deleteTransporter(id);
    }
  } catch (error) {
    console.error('[transporters.handleTableClick]', error);
    alert(error.message || 'Erro ao executar a ação.');
  }
}

export async function loadAttachments() {
  if (!state.editingId) {
    state.attachments = [];
    renderAttachments([]);
    setAttachmentsEnabled(false);
    return;
  }

  try {
    showAttachmentsAlert('');
    setAttachmentsEnabled(true);
    const response = await listTransporterAttachments(state.editingId);
    state.attachments = asArray(response);
    renderAttachments(state.attachments);
  } catch (error) {
    console.error('[transporters.loadAttachments]', error);
    state.attachments = [];
    renderAttachments([]);
    showAttachmentsAlert(error.message || 'Erro ao carregar os anexos.', 'error');
  }
}

export async function uploadAttachments(files = []) {
  if (!state.editingId) {
    showAttachmentsAlert('Salve a transportadora primeiro para enviar anexos.', 'warning');
    return;
  }

  const list = Array.from(files || []);
  if (!list.length) return;

  const els = getModalElements();

  try {
    els.selectAttachmentBtn.disabled = true;
    showAttachmentsAlert('Enviando anexos...', 'info');

    for (const file of list) {
      await uploadTransporterAttachment(state.editingId, file);
    }

    els.attachmentInput.value = '';
    showAttachmentsAlert('Anexo enviado com sucesso.', 'success');
    await loadAttachments();
  } catch (error) {
    console.error('[transporters.uploadAttachments]', error);
    showAttachmentsAlert(error.message || 'Erro ao enviar o anexo.', 'error');
  } finally {
    els.selectAttachmentBtn.disabled = false;
  }
}

export async function deleteAttachment(attachmentId) {
  if (!state.editingId || !attachmentId) return;

  const confirmed = window.confirm('Deseja realmente excluir este anexo?');
  if (!confirmed) return;

  try {
    showAttachmentsAlert('');
    await removeTransporterAttachment(state.editingId, attachmentId);
    await loadAttachments();
  } catch (error) {
    console.error('[transporters.deleteAttachment]', error);
    showAttachmentsAlert(error.message || 'Erro ao excluir o anexo.', 'error');
  }
}

export function previousPage() {
  if (state.page <= 1) return;
  state.page -= 1;
  renderTransportersTable();
}

export function nextPage() {
  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  if (state.page >= totalPages) return;
  state.page += 1;
  renderTransportersTable();
}

export function changePageSize(value) {
  const pageSize = Number(value);
  state.pageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50;
  resetPagination();
  renderTransportersTable();
}

export function normalizeSearchStateInput() {
  const els = getPageElements();
  if (els.searchState) els.searchState.value = normalizeState(els.searchState.value);
}

export function handleLoadError(error) {
  console.error('[transporters.loadTransporters]', error);
  alert(error.message || 'Erro ao carregar as transportadoras.');
}
