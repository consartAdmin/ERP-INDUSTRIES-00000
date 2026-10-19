// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.render.js — Renderização das tabelas                 ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ║ ✔ Itens importados do XML                                            ║
// ║ ✔ Lista de devoluções                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ICONS, NON_EMITTABLE_STATUSES } from './supplierReturns.config.js';
import { state } from './supplierReturns.state.js';
import { qs, money, numberBr, escapeHtml } from './supplierReturns.utils.js';

/* ------------------------------------------------------------------
 * Itens importados
 * ------------------------------------------------------------------ */
export function updateItemsSummary() {
  const selectedItems = state.importedItems.filter(
    (item) => item.selected !== false && Number(item.quantity_return || 0) > 0
  );

  const total = selectedItems.reduce((acc, item) => acc + Number(item.total_value_return || 0), 0);

  const el = qs('#itemsSummary');
  if (el) el.textContent = `${selectedItems.length} selecionado(s) | ${money(total)}`;
}

export function renderImportedItems() {
  const tbody = qs('#importedItemsBody');
  if (!tbody) return;

  if (!state.importedItems.length) {
    tbody.innerHTML = '<tr><td colspan="14" class="center">Nenhum item importado.</td></tr>';
    updateItemsSummary();
    return;
  }

  tbody.innerHTML = state.importedItems
    .map((item, index) => {
      const productOk = Boolean(item.product_found || item.product_id);
      const checked = item.selected !== false ? 'checked' : '';
      const qty = Number(item.quantity_return || item.quantity_original || 0);
      const total = Number(item.total_value_return || qty * Number(item.unit_value || 0));

      return `
        <tr data-index="${index}">
          <td class="center"><input type="checkbox" class="item-selected" ${checked} /></td>
          <td>${escapeHtml(item.xml_item_no || index + 1)}</td>
          <td>${escapeHtml(item.xml_product_code || item.product_code || '')}</td>
          <td>${escapeHtml(item.product_code || '')}</td>
          <td title="${escapeHtml(item.description || '')}">${escapeHtml(String(item.description || '').slice(0, 56))}</td>
          <td class="right">${numberBr(item.quantity_original)}</td>
          <td class="right"><input type="number" min="0" step="0.0001" class="item-qty" value="${qty}" /></td>
          <td>${escapeHtml(item.unit || 'UN')}</td>
          <td class="right">${money(item.unit_value)}</td>
          <td class="right item-total">${money(total)}</td>
          <td>${escapeHtml(item.cfop_inbound || '')}</td>
          <td><input type="text" maxlength="4" class="cfop-input item-cfop" value="${escapeHtml(item.cfop || '')}" /></td>
          <td>${escapeHtml(item.ncm || '')}</td>
          <td><span class="badge ${productOk ? 'badge-ok' : 'badge-warn'}">${productOk ? 'Vinculado' : 'Não vinculado'}</span></td>
        </tr>
      `;
    })
    .join('');

  updateItemsSummary();
}

/* ------------------------------------------------------------------
 * Lista de devoluções
 * ------------------------------------------------------------------ */
function getReturnNfeNumber(row = {}) {
  return (
    row.nfe_number ||
    row.plugnotas_response?.data?.[0]?.numero ||
    row.plugnotas_response?.data?.numero ||
    row.plugnotas_response?.numero ||
    ''
  );
}

function renderReturnRow(row) {
  const status = String(row.status || 'DRAFT').toUpperCase();
  const canEmit = !NON_EMITTABLE_STATUSES.includes(status);
  const canDownload = Boolean(row.plugnotas_id);
  const returnNfeNumber = getReturnNfeNumber(row);

  return `
    <tr>
      <td>${escapeHtml(row.return_id)}</td>
      <td>${escapeHtml(row.supplier_name || '')}</td>
      <td>
        <div>Orig.: ${escapeHtml(row.original_document_number || '')}/${escapeHtml(row.original_series || '')}</div>
        <div style="font-weight:700;color:#0a7d24;">
          Dev.: ${escapeHtml(returnNfeNumber || '-')}
        </div>
      </td>
      <td title="${escapeHtml(row.original_nfe_key || '')}">${escapeHtml(String(row.original_nfe_key || '').slice(0, 18))}...</td>
      <td class="right">${money(row.total_value)}</td>
      <td><span class="badge badge-status" title="${escapeHtml(row.nfe_status_code || status)}">${escapeHtml(row.nfe_status_name || status)}</span></td>
      <td>
        <div class="row-actions">

        <button class="btn btn-primary btn-sm btn-emit" type="button" data-id="${row.return_id}" ${canEmit ? '' : 'disabled'}>
          Emitir NF-e
        </button>

        <button class="btn btn-toolbar btn-sm btn-sync btn-icon" type="button" data-id="${row.return_id}" title="Sincronizar PlugNotas" aria-label="Sincronizar PlugNotas" ${canDownload ? '' : 'disabled'}>
          <span class="action-icon action-icon--emoji" aria-hidden="true">${ICONS.sync}</span>
        </button>

        <button class="btn btn-toolbar btn-sm btn-xml btn-icon" type="button" data-id="${row.return_id}" title="Baixar XML" aria-label="Baixar XML" ${canDownload ? '' : 'disabled'}>
          <img src="${ICONS.xml}" alt="" aria-hidden="true" class="action-icon" />
        </button>

        <button class="btn btn-toolbar btn-sm btn-danfe btn-icon" type="button" data-id="${row.return_id}" title="Baixar DANFE" aria-label="Baixar DANFE" ${canDownload ? '' : 'disabled'}>
          <img src="${ICONS.danfe}" alt="" aria-hidden="true" class="action-icon" />
        </button>

        <button class="btn btn-danger btn-sm btn-delete btn-icon" type="button" data-id="${row.return_id}" title="Excluir" aria-label="Excluir">
          <span class="action-icon action-icon--emoji" aria-hidden="true">${ICONS.delete}</span>
        </button>

        </div>
      </td>
    </tr>
  `;
}

export function renderReturns(rows = []) {
  const tbody = qs('#returnsBody');
  if (!tbody) return;

  tbody.innerHTML = rows.length
    ? rows.map(renderReturnRow).join('')
    : '<tr><td colspan="7" class="center">Nenhuma devolução encontrada.</td></tr>';

  renderFooter();
}

/* ------------------------------------------------------------------
 * Rodapé (contador e paginação)
 * ------------------------------------------------------------------ */
export function getTotalPages() {
  return Math.max(1, Math.ceil(state.total / state.limit));
}

function renderFooter() {
  const totalPages = getTotalPages();

  const lblTotal = qs('#limit');
  const lblPage = qs('#infoPagina');
  const btnPrev = qs('#pagAnterior');
  const btnNext = qs('#pagProxima');
  const rowsPerPage = qs('#apRowsPerPage');

  if (lblTotal) lblTotal.textContent = `${state.total} ${state.total === 1 ? 'registro' : 'registros'}`;
  if (lblPage) lblPage.textContent = `Página ${state.page} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.page <= 1;
  if (btnNext) btnNext.disabled = state.page >= totalPages;
  if (rowsPerPage) rowsPerPage.value = String(state.limit);
}
