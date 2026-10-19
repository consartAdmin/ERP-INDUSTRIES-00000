// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.pagination.js — Paginação do módulo de produtos            ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './products.state.js';

import {
  getNextPageButton,
  getPreviousPageButton,
  setFooterInfo,
} from './products.dom.js';

let previousHandler = null;
let nextHandler = null;

export function renderPagination({
  total = 0,
  page = 1,
  limit = 50,
  onPageChange,
} = {}) {
  const normalizedTotal = Math.max(Number(total) || 0, 0);
  const normalizedLimit = Math.max(Number(limit) || 50, 1);

  const pages = Math.max(
    Math.ceil(normalizedTotal / normalizedLimit),
    1
  );

  const normalizedPage = Math.min(
    Math.max(Number(page) || 1, 1),
    pages
  );

  state.page = normalizedPage;
  state.limit = normalizedLimit;

  const previousButton = getPreviousPageButton();
  const nextButton = getNextPageButton();

  if (previousButton) {
    previousButton.disabled = normalizedPage <= 1;
    previousButton.setAttribute(
      'aria-disabled',
      String(normalizedPage <= 1)
    );

    if (previousHandler) {
      previousButton.removeEventListener('click', previousHandler);
    }

    previousHandler = () => {
      if (
        state.loading ||
        state.page <= 1 ||
        typeof onPageChange !== 'function'
      ) {
        return;
      }

      state.page -= 1;
      onPageChange();
    };

    previousButton.addEventListener('click', previousHandler);
  }

  if (nextButton) {
    nextButton.disabled = normalizedPage >= pages;
    nextButton.setAttribute(
      'aria-disabled',
      String(normalizedPage >= pages)
    );

    if (nextHandler) {
      nextButton.removeEventListener('click', nextHandler);
    }

    nextHandler = () => {
      if (
        state.loading ||
        state.page >= pages ||
        typeof onPageChange !== 'function'
      ) {
        return;
      }

      state.page += 1;
      onPageChange();
    };

    nextButton.addEventListener('click', nextHandler);
  }

  setFooterInfo({
    total: normalizedTotal,
    page: normalizedPage,
    pages,
  });
}