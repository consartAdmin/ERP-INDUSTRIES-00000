// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.inventories.js — Inventários (list, select, save, finalize) ║
// ║ PRODNEX ERP | Inventário                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

import { apiGet, apiPost, apiPut } from './inventory.api.js';
import { INVENTORY_API_BASE } from './inventory.config.js';
import { state } from './inventory.state.js';
import { askPasswordModal } from './inventory.passwordModal.js';
import { activateTab } from './inventory.tabs.js';
import { clearItemProduct, clearUnitSelect, clearLocationField, clearLotSelect } from './inventory.items.js';
import { fmtDatePt } from './inventory.utils.js';
import { logError } from './inventory.config.js';

function getInventoryNotes(inv) {
  return inv?.notes ?? inv?.observacoes ?? inv?.observacao ?? inv?.observation ?? '';
}

// ── Paginação da lista de inventários (rodapé: apTableInfo / infoPagina / pagAnterior / pagProxima / apRowsPerPage)
const invPaging = { page: 1, limit: 50, total: 0, bound: false };

function inventoryPagingEls() {
  return {
    info: document.getElementById('apTableInfo'),
    pageInfo: document.getElementById('infoPagina'),
    prev: document.getElementById('pagAnterior'),
    next: document.getElementById('pagProxima'),
    rowsPerPage: document.getElementById('apRowsPerPage'),
  };
}

function bindInventoryPaging(els) {
  if (invPaging.bound) return;
  invPaging.bound = true;

  const p = inventoryPagingEls();
  if (p.rowsPerPage) invPaging.limit = Number(p.rowsPerPage.value) || invPaging.limit;

  p.prev?.addEventListener('click', () => {
    if (invPaging.page > 1) loadInventories(els, { page: invPaging.page - 1 });
  });
  p.next?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(invPaging.total / invPaging.limit));
    if (invPaging.page < totalPages) loadInventories(els, { page: invPaging.page + 1 });
  });
  p.rowsPerPage?.addEventListener('change', () => {
    invPaging.limit = Number(p.rowsPerPage.value) || 50;
    loadInventories(els, { page: 1 });
  });
}

function renderInventoryPaging(rowsOnPage) {
  const p = inventoryPagingEls();
  const totalPages = Math.max(1, Math.ceil(invPaging.total / invPaging.limit));

  if (p.info) {
    p.info.textContent = `${invPaging.total.toLocaleString('pt-BR')} registros`;
  }
  if (p.pageInfo) p.pageInfo.textContent = `Página ${invPaging.page} de ${totalPages}`;
  if (p.prev) p.prev.disabled = invPaging.page <= 1;
  if (p.next) p.next.disabled = invPaging.page >= totalPages || rowsOnPage === 0;
}

/** Lista inventários; sem `page` volta para a 1ª página (nova busca, filtro ou recarga após salvar) */
export async function loadInventories(els, { page = 1 } = {}) {
  try {
    bindInventoryPaging(els);

    const search = (els.searchInventory?.value || '').trim();
    const status = els.statusFilter?.value || '';

    invPaging.page = Math.max(1, page);

    const params = new URLSearchParams();
    params.set('limit', String(invPaging.limit));
    params.set('offset', String((invPaging.page - 1) * invPaging.limit));
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    const url = `${INVENTORY_API_BASE}?${params.toString()}`;
    const data = await apiGet(url);

    const inventories = Array.isArray(data?.rows) ? data.rows : [];
    // total vem do backend; fallback para APIs antigas sem contagem
    invPaging.total = Number.isFinite(Number(data?.total))
      ? Number(data.total)
      : (invPaging.page - 1) * invPaging.limit + inventories.length;

    renderInventoryTable(els, inventories, async (inv) => await onSelectInventory(els, inv));
    renderInventoryPaging(inventories.length);
  } catch (err) {
    logError('Erro em loadInventories:', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao carregar inventários',
      message: String(err.message || err),
    });
  }
}

function downloadInventoryReportPdf(inventoryId) {
  if (!inventoryId) return;

  window.open(
    `/api/inventories/${inventoryId}/report-pdf`,
    '_blank'
  );
}

window.downloadInventoryReportPdf = downloadInventoryReportPdf;
export function renderInventoryTable(els, inventories, onPick) {
  const tbody = els.inventoryTableBody;
  if (!tbody) return;

  tbody.innerHTML = '';
  state.inventoryRowsCache = [];
  state.inventoryKeyboardIndex = -1;

  inventories.forEach((inv) => {
    const tr = document.createElement('tr');
    tr.dataset.id = inv.inventory_id;

    const status = String(inv.status || '').toUpperCase();
    const canReopen = status === 'FINALIZED';
    const notesText = getInventoryNotes(inv);

    tr.innerHTML = `
      <td>${inv.code || ''}</td>
      <td>${notesText || ''}</td>
      <td>${inv.type || ''}</td>
      <td>${inv.status || ''}</td>
      <td>${inv.reference_date ? fmtDatePt(inv.reference_date) : ''}</td>
      <td class="col-actions">

  <button
    type="button"
    class="btn btn-toolbar btn-sm"
    onclick="downloadInventoryReportPdf(${inv.inventory_id})"
  >
    📄 Relatório
  </button>

  ${canReopen
        ? `
    <button
      type="button"
      class="btn btn-toolbar btn-sm js-reopen-inventory"
      data-id="${inv.inventory_id}"
      data-code="${inv.code || ''}"
    >
      Estornar estoque
    </button>
  `
        : `<span style="opacity:.45;">—</span>`
      }

</td>
    `;

    tr.addEventListener('click', () => onPick?.(inv));

    tbody.appendChild(tr);
    state.inventoryRowsCache.push({ element: tr, data: inv });
  });
}

export function updateInventoryKeyboardSelection() {
  state.inventoryRowsCache.forEach((row, index) => {
    row.element.classList.toggle('is-selected', index === state.inventoryKeyboardIndex);
  });
  const selected = state.inventoryRowsCache[state.inventoryKeyboardIndex];
  if (selected) selected.element.scrollIntoView({ block: 'nearest' });
}

export async function onSelectInventory(els, inv, { loadItemsFn } = {}) {
  try {
    state.currentInventory = inv;

    if (els.inventoryTableBody) {
      [...els.inventoryTableBody.querySelectorAll('tr')].forEach((tr) => {
        tr.classList.toggle('is-selected', tr.dataset.id === String(inv.inventory_id));
      });
    }

    const invFull = await apiGet(`${INVENTORY_API_BASE}/${inv.inventory_id}`);
    fillInventoryForm(els, invFull);

    if (typeof loadItemsFn === 'function') {
      await loadItemsFn();
    }

    // 🔒 Lock if finalized
    applyInventoryLock(els, invFull.status);

    activateTab(els, 'edit');
  } catch (err) {
    logError('Erro em onSelectInventory:', err);
  }
}

export function fillInventoryForm(els, inv) {
  if (!inv) return;

  if (els.inventoryCode) els.inventoryCode.value = inv.code || '';
  if (els.inventoryType) els.inventoryType.value = inv.type || 'GENERAL';
  if (els.inventoryStatus) els.inventoryStatus.value = inv.status || 'OPEN';
  if (els.referenceDate) {
    els.referenceDate.value = inv.reference_date
      ? new Date(inv.reference_date).toISOString().substring(0, 10)
      : '';
  }
  if (els.inventoryNotes) els.inventoryNotes.value = inv.notes || '';
}

function applyInventoryLock(els, status) {
  const locked =
    String(status || '').toUpperCase() === 'FINALIZED';

  [
    els.inventoryCode,
    els.inventoryType,
    els.inventoryStatus,
    els.referenceDate,
    els.inventoryNotes,
  ].forEach((element) => {
    if (element) {
      element.disabled = locked;
    }
  });

  [
    els.btnSaveInventory,
    els.btnSaveInventoryInline,
    els.btnFinalizeInventory,
    els.btnFinalizeInventoryInline,
    els.btnSaveItem,
  ].forEach((button) => {
    if (button) {
      button.disabled = locked;
    }
  });

  document
    .querySelectorAll(
      '.inventory-edit-icon, .inventory-delete-icon'
    )
    .forEach((icon) => {
      icon.style.pointerEvents = locked ? 'none' : '';
      icon.style.opacity = locked ? '0.35' : '';
    });

  document.body.classList.toggle(
    'inventory-readonly',
    locked
  );
}

export function resetInventoryForm(els) {
  state.currentInventory = null;
  state.items = [];
  state.logsData = [];

  fillInventoryForm(els, {
    code: '',
    type: 'GENERAL',
    status: 'OPEN',
    reference_date: new Date().toISOString().substring(0, 10),
    notes: '',
  });

  clearItemProduct(els);
  clearUnitSelect(els);
  clearLocationField(els);
  clearLotSelect(els);
  if (els.itemCountedQty) els.itemCountedQty.value = '';
  if (els.itemNotes) els.itemNotes.value = '';
}

export async function saveInventory(els, { afterReloadInventories, afterSelectCreated } = {}) {
  try {
    const payload = {
      code: (els.inventoryCode?.value || '').trim(),
      type: (els.inventoryType?.value || 'GENERAL').toUpperCase(),
      status: (els.inventoryStatus?.value || 'OPEN').toUpperCase(),
      reference_date: els.referenceDate?.value || null,
      notes: els.inventoryNotes?.value || null,
    };

    if (!payload.code) {
      showCenterModal({ variant: 'warning', title: 'Código obrigatório', message: 'Informe um código para o inventário.' });
      return null;
    }

    let data;
    if (state.currentInventory?.inventory_id) {
      data = await apiPut(`${INVENTORY_API_BASE}/${state.currentInventory.inventory_id}`, payload);
    } else {
      data = await apiPost(INVENTORY_API_BASE, payload);
    }

    showCenterModal({ variant: 'success', title: 'Inventário salvo', message: 'Inventário salvo com sucesso.' });

    if (typeof afterReloadInventories === 'function') await afterReloadInventories();

    if (!state.currentInventory?.inventory_id && data?.inventory_id) {
      if (typeof afterSelectCreated === 'function') await afterSelectCreated(data);
    }

    return data;
  } catch (err) {
    logError('Erro em saveInventory:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao salvar inventário', message: String(err.message || err) });
    return null;
  }
}



export async function finalizeInventory(els, { afterReloadInventories, afterReloadItems } = {}) {
  try {
    if (!state.currentInventory?.inventory_id) {
      showCenterModal({ variant: 'warning', title: 'Selecione um inventário', message: 'Selecione um inventário antes de finalizar.' });
      return;
    }

    const senha = await askPasswordModal({
      title: 'Finalizar e aplicar estoque',
      subtitle: 'Digite a senha para FINALIZAR e APLICAR o estoque:',
    });

    if (senha == null) return;
    if (!String(senha).trim()) {
      showCenterModal({ variant: 'warning', title: 'Senha obrigatória', message: 'Você precisa informar a senha para finalizar.' });
      return;
    }

    const url = `${INVENTORY_API_BASE}/${state.currentInventory.inventory_id}/finalize`;
    await apiPost(url, { applyAdjust: true, password: String(senha) });

    showCenterModal({ variant: 'success', title: 'Inventário finalizado', message: 'Inventário finalizado com sucesso.' });

    applyInventoryLock(els, 'FINALIZED');

    if (typeof afterReloadInventories === 'function') await afterReloadInventories();
    if (typeof afterReloadItems === 'function') await afterReloadItems();

    activateTab(els, 'list');
  } catch (err) {
    logError('Erro em finalizeInventory:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao finalizar inventário', message: String(err.message || err) });
  }
}

export async function reopenInventory(els, inventoryId, inventoryCode, { afterReloadInventories, afterReloadCurrent } = {}) {
  try {
    const ok = await showCenterModal({
      variant: 'warning',
      title: 'CONFIRMAR ESTORNO?',
      message: `
      <div style="display:flex;flex-direction:column;gap:6px">
      <div><b>Inventário:</b> ${String(inventoryCode || inventoryId)}</div>
      <div style="opacity:.9">
      Isso irá desfazer o ajuste aplicado no estoque e reabrir o inventário.
      </div>
      </div>
      `,
      buttons: [
        { label: 'Cancelar', variant: 'cancel', action: () => false },
        { label: 'OK', variant: 'danger', action: () => true },
      ],
    });

    if (!ok) return;

    const senha = await askPasswordModal({
      title: 'Estornar estoque',
      subtitle: 'Digite a senha para ESTORNAR o estoque e reabrir o inventário:',
    });

    if (senha == null) return;
    if (!String(senha).trim()) {
      showCenterModal({ variant: 'warning', title: 'Senha obrigatória', message: 'Você precisa informar a senha para estornar.' });
      return;
    }

    await apiPost(`${INVENTORY_API_BASE}/${inventoryId}/reopen`, { password: String(senha) });

    showCenterModal({ variant: 'success', title: 'Estorno realizado', message: 'O estoque foi estornado e o inventário voltou para ABERTO.' });

    if (typeof afterReloadInventories === 'function') await afterReloadInventories();

    if (typeof afterReloadCurrent === 'function') {
      await afterReloadCurrent(inventoryId);
    }
  } catch (err) {
    logError('Erro em reopenInventory:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao estornar', message: String(err.message || err) });
  }
}