// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.actions.js — Ações da tela e bind de eventos         ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ║ ✔ Importa XML NF-e de entrada                                        ║
// ║ ✔ Cria rascunho de devolução ao fornecedor                           ║
// ║ ✔ Emite NF-e de devolução via backend / TecnoSpeed                   ║
// ║ ✔ Sincroniza PlugNotas, download XML e DANFE, exclusão               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { SEARCH_DEBOUNCE_MS } from './supplierReturns.config.js';
import { state } from './supplierReturns.state.js';
import { qs, setMessage, setLoading } from './supplierReturns.utils.js';
import {
  ensureTablesRequest,
  importInboundXmlRequest,
  listReturnsRequest,
  createReturnRequest,
  emitNfeRequest,
  syncPlugNotasRequest,
  deleteReturnRequest,
  getDownloadUrl,
} from './supplierReturns.api.js';
import {
  validateXmlFile,
  validateCreatePayload,
  validateReturnId,
} from './supplierReturns.validation.js';
import { confirmAction, showAlert } from './supplierReturns.modal.js';
import { renderReturns, getTotalPages } from './supplierReturns.render.js';
import {
  mapImportedItems,
  renderImportedDraft,
  clearImportForm,
  syncAllImportedRows,
  buildCreatePayload,
} from './supplierReturns.form.js';

let searchTimer = null;

/* ------------------------------------------------------------------
 * Tabelas / importação
 * ------------------------------------------------------------------ */
export async function ensureTables() {
  const btn = qs('#btnEnsure');

  try {
    setLoading(btn, true, 'Verificando...');
    const data = await ensureTablesRequest();
    setMessage(data.message || 'Tabelas verificadas.', 'success');
  } catch (err) {
    setMessage(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

export async function importXml() {
  const btn = qs('#btnImportXml');
  const file = qs('#xmlFile')?.files?.[0];

  try {
    validateXmlFile(file);
  } catch (err) {
    setMessage(err.message, 'error');
    return;
  }

  try {
    setLoading(btn, true, 'Importando...');
    setMessage('Importando XML...');

    const data = await importInboundXmlRequest(file);

    state.importedHeader = data.header;
    state.importedItems = mapImportedItems(data.items);

    renderImportedDraft();

    setMessage(
      `NF-e importada com ${state.importedItems.length} item(ns). Escolha os itens para devolução.`,
      'success'
    );
  } catch (err) {
    state.importedHeader = null;
    state.importedItems = [];
    renderImportedDraft();
    setMessage(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

export function clearImport() {
  clearImportForm();
}

/* ------------------------------------------------------------------
 * Devoluções
 * ------------------------------------------------------------------ */
export async function loadReturns() {
  const params = new URLSearchParams({
    page: String(state.page),
    limit: String(state.limit),
  });

  if (state.q) params.set('q', state.q);
  if (state.status) params.set('status', state.status);

  try {
    const data = await listReturnsRequest(params);
    state.total = data.total || 0;
    renderReturns(data.rows || []);
  } catch (err) {
    setMessage(err.message, 'error');
  }
}

export async function createReturn() {
  const btn = qs('#btnCreateReturn');

  try {
    setLoading(btn, true, 'Criando...');
    syncAllImportedRows();

    const payload = buildCreatePayload();
    validateCreatePayload(payload);

    const data = await createReturnRequest(payload);

    setMessage(`Devolução #${data.return_id} criada com sucesso.`, 'success');
    await loadReturns();
  } catch (err) {
    setMessage(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

export async function emitSupplierReturnNfe(id, button = null) {
  try {
    validateReturnId(id);
  } catch (err) {
    setMessage(err.message, 'error');
    return;
  }

  if (!confirmAction(`Emitir NF-e de devolução da operação #${id}?`)) return;

  try {
    setLoading(button, true, 'Emitindo...');

    const data = await emitNfeRequest(id);

    console.log('[SUPPLIER RETURN NF-E EMIT RESULT]', data);

    setMessage(`NF-e de devolução #${id} enviada para emissão.`, 'success');
    showAlert('NF-e de devolução enviada para emissão.');

    await loadReturns();
  } catch (err) {
    setMessage(err.message, 'error');
    showAlert(err.message || 'Erro ao emitir NF-e de devolução.');
  } finally {
    setLoading(button, false);
  }
}

export async function syncPlugNotas(id, button = null) {
  try {
    validateReturnId(id);
  } catch (err) {
    setMessage(err.message, 'error');
    return;
  }

  try {
    setLoading(button, true, 'Sincronizando...');

    const data = await syncPlugNotasRequest(id);

    console.log('[SUPPLIER RETURN SYNC PLUGNOTAS]', data);

    setMessage(`Devolução #${id} sincronizada com PlugNotas.`, 'success');
    await loadReturns();
  } catch (err) {
    setMessage(err.message, 'error');
    showAlert(err.message || 'Erro ao sincronizar com PlugNotas.');
  } finally {
    setLoading(button, false);
  }
}

export function openDownload(id, type) {
  try {
    validateReturnId(id);
  } catch (err) {
    setMessage(err.message, 'error');
    return;
  }

  window.open(getDownloadUrl(id, type), '_blank', 'noopener,noreferrer');
}

export async function deleteReturn(id) {
  if (!confirmAction(`Excluir devolução #${id}?`)) return;

  try {
    await deleteReturnRequest(id);
    setMessage(`Devolução #${id} excluída.`, 'success');
    await loadReturns();
  } catch (err) {
    setMessage(err.message, 'error');
  }
}

/* ------------------------------------------------------------------
 * Bind de eventos
 * ------------------------------------------------------------------ */
function onReturnsTableClick(ev) {
  const emitBtn = ev.target.closest('.btn-emit');
  const syncBtn = ev.target.closest('.btn-sync');
  const xmlBtn = ev.target.closest('.btn-xml');
  const danfeBtn = ev.target.closest('.btn-danfe');
  const delBtn = ev.target.closest('.btn-delete');

  if (emitBtn) {
    emitSupplierReturnNfe(emitBtn.dataset.id, emitBtn);
    return;
  }

  if (syncBtn) {
    syncPlugNotas(syncBtn.dataset.id, syncBtn);
    return;
  }

  if (xmlBtn) {
    openDownload(xmlBtn.dataset.id, 'xml');
    return;
  }

  if (danfeBtn) {
    openDownload(danfeBtn.dataset.id, 'danfe');
    return;
  }

  if (delBtn) {
    deleteReturn(delBtn.dataset.id);
  }
}

export function bindSupplierReturnActions() {
  qs('#btnEnsure')?.addEventListener('click', ensureTables);
  qs('#btnImportXml')?.addEventListener('click', importXml);
  qs('#btnClearImport')?.addEventListener('click', clearImport);
  qs('#btnCreateReturn')?.addEventListener('click', createReturn);
  qs('#btnReload')?.addEventListener('click', loadReturns);

  qs('#searchInput')?.addEventListener('input', (ev) => {
    state.q = ev.target.value.trim();
    state.page = 1;

    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadReturns, SEARCH_DEBOUNCE_MS);
  });

  qs('#statusFilter')?.addEventListener('change', (ev) => {
    state.status = ev.target.value;
    state.page = 1;
    loadReturns();
  });

  qs('#pagAnterior')?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    loadReturns();
  });

  qs('#pagProxima')?.addEventListener('click', () => {
    if (state.page >= getTotalPages()) return;
    state.page += 1;
    loadReturns();
  });

  qs('#apRowsPerPage')?.addEventListener('change', (ev) => {
    state.limit = Number(ev.target.value) || 50;
    state.page = 1;
    loadReturns();
  });

  qs('#returnsBody')?.addEventListener('click', onReturnsTableClick);
}
