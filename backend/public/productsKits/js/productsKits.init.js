// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.init.js                                          ║
// ║ MODULE: Products Kits — Initialization                              ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  addItem,
  createNewKit,
  deactivateKit,
  editKit,
  loadKits,
  removeItem,
  saveKit,
} from './productsKits.actions.js';
import {
  clearForm,
  closeForm,
  setFormVisibility,
} from './productsKits.form.js';
import { openProductSearch } from './productsKits.products.js';
import { renderItems, updateTotals } from './productsKits.render.js';
import { cacheDom, dom } from './productsKits.state.js';

function bindEvents() {
  dom.btnAtualizar?.addEventListener('click', loadKits);
  dom.btnPesquisar?.addEventListener('click', loadKits);

  dom.searchKit?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loadKits();
  });

  dom.btnFecharForm?.addEventListener('click', closeForm);
  dom.btnCancelar?.addEventListener('click', closeForm);
  dom.kitModalBackdrop?.addEventListener('click', closeForm);
  dom.btnAdicionarItem?.addEventListener('click', addItem);
  dom.btnSalvarKit?.addEventListener('click', saveKit);
  dom.priceMode?.addEventListener('change', updateTotals);
  dom.productSearch?.addEventListener('click', openProductSearch);

  dom.productSearch?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    openProductSearch();
  });

  dom.kitsTableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-kit-action]');
    if (!button) return;

    const id = Number(button.dataset.kitId);
    if (!Number.isInteger(id) || id <= 0) return;

    if (button.dataset.kitAction === 'edit') editKit(id);
    if (button.dataset.kitAction === 'deactivate') deactivateKit(id);
  });

  dom.itemsTableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-item-action="remove"]');
    if (!button) return;

    removeItem(Number(button.dataset.itemIndex));
  });

  /*
   * Delegated binding keeps the button working even when core.js rebuilds
   * part of the page header after this module has initialized.
   */
  document.addEventListener('click', (event) => {
    const newKitButton = event.target.closest('#btnNovoKit');
    if (!newKitButton) return;

    event.preventDefault();
    createNewKit();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (dom.kitFormSection?.classList.contains('hidden')) return;
    closeForm();
  });
}

async function init() {
  cacheDom();
  bindEvents();
  clearForm();
  renderItems();
  setFormVisibility(false);
  await loadKits();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}