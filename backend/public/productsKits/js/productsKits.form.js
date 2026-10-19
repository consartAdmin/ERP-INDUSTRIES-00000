// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.form.js                                          ║
// ║ MODULE: Products Kits — Form                                        ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom, state } from './productsKits.state.js';
import { toNumber } from './productsKits.utils.js';

export function openForm() {
  setFormVisibility(true);

  const scrollTarget = dom.kitFormHeader || dom.formTitle;
  if (!scrollTarget) return;

  const top = scrollTarget.getBoundingClientRect().top + window.scrollY - 20;
  window.scrollTo({ top, behavior: 'smooth' });
}

export function closeForm() {
  setFormVisibility(false);
  clearForm();
}

export function setFormVisibility(visible) {
  const targets = new Set([
    dom.kitFormSection,
    dom.kitFormHeader,
    dom.kitItemsSection,
  ]);

  targets.forEach((element) => {
    if (!element) return;

    element.hidden = !visible;
    element.classList.toggle('hidden', !visible);

    if (element === dom.kitFormSection) {
      element.setAttribute('aria-hidden', String(!visible));
      element.classList.toggle('is-open', visible);
      element.classList.toggle('modal--open', visible);
    }
  });

  document.body.classList.toggle('modal-open', visible);
}

export function clearForm() {
  if (dom.formTitle) dom.formTitle.textContent = 'Novo Kit';
  if (dom.kitId) dom.kitId.value = '';
  if (dom.kitSku) dom.kitSku.value = '';
  if (dom.kitDescription) dom.kitDescription.value = '';
  if (dom.priceMode) dom.priceMode.value = 'MANUAL';
  if (dom.salePrice) dom.salePrice.value = '0';
  if (dom.kitActive) dom.kitActive.value = 'true';

  state.kitItems = [];
  clearItemInputs();
}

export function clearItemInputs() {
  if (dom.productSearch) dom.productSearch.value = '';
  if (dom.itemSku) dom.itemSku.value = '';
  if (dom.itemDescription) dom.itemDescription.value = '';

  if (dom.itemUnit) {
    dom.itemUnit.value = '';
    dom.itemUnit.dataset.factor = '1';
  }

  if (dom.itemQuantity) dom.itemQuantity.value = '1';
  if (dom.itemCostUnit) dom.itemCostUnit.value = '0';
  if (dom.itemSaleUnit) dom.itemSaleUnit.value = '0';

  dom.productSuggestions?.classList.add('hidden');
  if (dom.productSuggestions) dom.productSuggestions.innerHTML = '';
}

export function fillKitForm(kit) {
  if (dom.formTitle) dom.formTitle.textContent = `Editar Kit #${kit.id}`;
  if (dom.kitId) dom.kitId.value = kit.id;
  if (dom.kitSku) dom.kitSku.value = kit.kit_sku || '';
  if (dom.kitDescription) {
    dom.kitDescription.value = kit.kit_description || '';
  }
  if (dom.priceMode) dom.priceMode.value = kit.price_mode || 'MANUAL';
  if (dom.salePrice) dom.salePrice.value = kit.sale_price || 0;
  if (dom.kitActive) dom.kitActive.value = String(kit.active !== false);

  state.kitItems = (kit.items || []).map((item) => ({
    product_sku: item.product_sku,
    description: item.description,
    unit: item.unit,
    unit_factor: toNumber(
      item.unit_factor || item.fator || item.factor || 1
    ),
    quantity: toNumber(item.quantity),
    cost_unit: toNumber(item.cost_unit),
    sale_price_unit: toNumber(item.sale_price_unit),
    active: item.active !== false,
  }));
}

export function readItemForm() {
  return {
    product_sku: dom.itemSku?.value.trim() || '',
    description: dom.itemDescription?.value.trim() || '',
    unit: dom.itemUnit?.value.trim() || '',
    unit_factor: toNumber(dom.itemUnit?.dataset.factor || 1),
    quantity: toNumber(dom.itemQuantity?.value || 1),
    cost_unit: toNumber(dom.itemCostUnit?.value),
    sale_price_unit: toNumber(dom.itemSaleUnit?.value),
    active: true,
  };
}

export function readKitForm() {
  return {
    id: dom.kitId?.value || '',
    payload: {
      kit_sku: dom.kitSku?.value.trim() || '',
      kit_description: dom.kitDescription?.value.trim() || '',
      price_mode: dom.priceMode?.value || 'MANUAL',
      sale_price: toNumber(dom.salePrice?.value),
      active: dom.kitActive?.value === 'true',
      items: state.kitItems,
    },
  };
}