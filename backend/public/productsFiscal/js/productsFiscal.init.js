// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.init.js                                        ║
// ║ MODULE: Products Fiscal — Bootstrap                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openFiscalClassificationModal } from '/public/modalsSearch/fiscalClassificationModalSearch.js';
import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import {
  loadProductsFiscalList,
  saveProductFiscal,
  selectFiscalClassification,
  selectProduct,
} from './productsFiscal.actions.js';
import { API_BASE } from './productsFiscal.config.js';
import {
  nextListPage,
  previousListPage,
  resetListOffset,
} from './productsFiscal.filters.js';
import { $$, byId, installGlobalErrorLogging } from './productsFiscal.utils.js';

function bindEvents() {
  byId('btnBuscarProduto')?.addEventListener('click', () => {
    openProductsModalSearch({ apiBase: API_BASE, onPick: selectProduct });
  });

  byId('btnAbrirModalFC')?.addEventListener('click', () => {
    openFiscalClassificationModal({
      apiBase: API_BASE,
      onPick: selectFiscalClassification,
    });
  });

  byId('btnSalvar')?.addEventListener('click', saveProductFiscal);
  byId('btnPesquisar')?.addEventListener('click', () => {
    resetListOffset();
    loadProductsFiscalList();
  });
  byId('prevPage')?.addEventListener('click', () => {
    previousListPage();
    loadProductsFiscalList();
  });
  byId('nextPage')?.addEventListener('click', () => {
    nextListPage();
    loadProductsFiscalList();
  });
  byId('limit')?.addEventListener('change', () => {
    resetListOffset();
    loadProductsFiscalList();
  });

  byId('btnOpenProductFiscalModal')
    ?.addEventListener('click', openProductFiscalModal);

  $$('[data-product-fiscal-modal-close]')
    .forEach((element) => {
      element.addEventListener('click', closeProductFiscalModal);
    });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const modal = byId('productFiscalModal');

    if (modal?.classList.contains('is-open')) {
      closeProductFiscalModal();
    }
  });
}

function openProductFiscalModal() {
  const modal = byId('productFiscalModal');
  if (!modal) return;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    byId('pf_nome')?.focus();
  });
}

function closeProductFiscalModal() {
  const modal = byId('productFiscalModal');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');

  document.body.classList.remove('modal-open');
}

function bootProductsFiscal() {
  installGlobalErrorLogging();
  bindEvents();
  loadProductsFiscalList();
}

document.addEventListener('DOMContentLoaded', bootProductsFiscal);
