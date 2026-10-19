// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.render.js                                  ║
// ║ MODULE: Products Fiscal Batch — Render                               ║
// ║ PRODNEX ERP                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom, state } from './productsFiscalBatch.state.js';
import {
  syncSelectAllState,
  toggleProductSelection,
  updateSelectionSummary,
} from './productsFiscalBatch.products.js';

function createCell(value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = value ?? '-';
  if (className) cell.className = className;
  return cell;
}

function createEmptyRow(message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');

  cell.colSpan = 8;
  cell.textContent = message;
  cell.style.textAlign = 'center';
  cell.style.padding = '16px';

  row.appendChild(cell);
  return row;
}

export function renderProducts(onUnlink) {
  if (!dom.productsBody) return;

  dom.productsBody.replaceChildren();

  if (!state.products.length) {
    const message =
      state.search && state.search.length >= 3
        ? 'Nenhum produto encontrado para a busca.'
        : 'Nenhum produto encontrado.';

    dom.productsBody.appendChild(createEmptyRow(message));
    syncSelectAllState();
    updateSelectionSummary();
    return;
  }

  const fragment = document.createDocumentFragment();

  state.products.forEach((product) => {
    const productId = product.product_id;
    const productCode = String(product.product_code || '').trim();
    const sku = productCode || '-';
    const description =
      product.product_description || product.description || '-';
    const classification =
      product.classification_name || '-';
    const profile = product.profile_name || '-';
    const isLinked =
      product.fiscal_is_linked === true ||
      product.fiscal_is_linked === 1 ||
      product.fiscal_is_linked === '1' ||
      product.fiscal_is_linked === 'true';

    const row = document.createElement('tr');

    const checkboxCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.productId = productCode;
    checkbox.checked = state.selected.has(productCode);
    checkbox.setAttribute(
      'aria-label',
      `Selecionar produto ${sku}`
    );

    checkbox.addEventListener('change', () => {
      toggleProductSelection(productCode, checkbox.checked);
    });

    checkboxCell.appendChild(checkbox);

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `pfb-status-badge ${isLinked ? 'ok' : 'no'}`;
    badge.textContent = isLinked ? '✔️ Vinculado' : '❌ Não vinculado';
    statusCell.appendChild(badge);

    const unlinkCell = document.createElement('td');
    unlinkCell.className = 'pfb-unlink-cell';

    const unlinkButton = document.createElement('button');
    unlinkButton.type = 'button';
    unlinkButton.className = 'btn btn-toolbar btn-sm';
    unlinkButton.textContent = 'Desvincular';
    unlinkButton.disabled = !isLinked;
    unlinkButton.addEventListener('click', () => onUnlink(productId, sku));
    unlinkCell.appendChild(unlinkButton);

    row.append(
      checkboxCell,
      createCell(productId),
      createCell(sku),
      createCell(description),
      createCell(classification),
      createCell(profile),
      statusCell,
      unlinkCell
    );

    fragment.appendChild(row);
  });

  dom.productsBody.appendChild(fragment);
  syncSelectAllState();
  updateSelectionSummary();
}

export function renderPagination() {
  const firstRecord =
    state.total > 0 ? (state.page - 1) * state.pageSize + 1 : 0;

  const lastRecord = Math.min(
    state.page * state.pageSize,
    state.total
  );

  if (dom.pageInfo) {
    dom.pageInfo.textContent =
      `Página ${state.page} de ${state.totalPages}`;
  }

  if (dom.tableInfo) {
    dom.tableInfo.textContent =
      state.total > 0
        ? `${firstRecord}–${lastRecord} de ${state.total} registros`
        : '0 Registros';
  }

  if (dom.previousButton) {
    dom.previousButton.disabled = state.loading || state.page <= 1;
  }

  if (dom.nextButton) {
    dom.nextButton.disabled =
      state.loading || state.page >= state.totalPages;
  }
}

export function setLoading(loading) {
  state.loading = loading;

  [
    dom.searchButton,
    dom.previousButton,
    dom.nextButton,
    dom.pageSize,
    dom.linkedFilter,
  ].forEach((element) => {
    if (element) element.disabled = loading;
  });

  if (dom.searchButton) {
    dom.searchButton.textContent = loading ? 'Buscando...' : 'Buscar';
  }
}
