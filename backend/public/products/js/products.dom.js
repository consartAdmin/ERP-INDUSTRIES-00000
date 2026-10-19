// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.dom.js — Helpers de DOM e status/footer                    ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { qs } from './products.utils.js';

export function getSearchInput() {
  return qs('#txtBusca') || qs('#campoBusca');
}

export function getLimitSelect() {
  return qs('#apRowsPerPage') || qs('#qtdPorPagina');
}

export function getExportButton() {
  return qs('#btnExport') || qs('#btnExportarExcel');
}

export function getStockPdfButton() {
  return qs('#btnPosicaoEstoque');
}

export function getStatusArea() {
  return qs('#statusArea');
}

export function getFooterTotalEl() {
  return qs('#apTableInfo');
}

export function getFooterPageEl() {
  return qs('#infoPagina') || qs('#lblPagina');
}

export function getTableBody() {
  return qs('#tableBody');
}

export function getPaginationEl() {
  return qs('#paginacao');
}

export function getPreviousPageButton() {
  return qs('#pagAnterior');
}

export function getNextPageButton() {
  return qs('#pagProxima');
}

export function getCameraDropZone() {
  return qs('#cameraArea') || qs('[data-camera-dropzone]');
}

export function getSearchButton() {
  return qs('#btnBuscar');
}

export function setStatus(msg, type = 'info') {
  const el = getStatusArea();

  if (!el) return;

  el.textContent = msg || '';
  el.dataset.type = type;
}

export function setFooterInfo({
  total = null,
  page = null,
  pages = null,
} = {}) {
  const elTotal = getFooterTotalEl();
  const elPage = getFooterPageEl();

  const parsedTotal = Number(total);
  const parsedPage = Number(page);
  const parsedPages = Number(pages);

  if (elTotal) {
    elTotal.textContent = Number.isFinite(parsedTotal)
      ? `${parsedTotal} produto(s)`
      : '— produto(s)';
  }

  if (elPage) {
    elPage.textContent =
      Number.isFinite(parsedPage) && Number.isFinite(parsedPages)
        ? `Página ${parsedPage} de ${parsedPages}`
        : 'Página — de —';
  }
}