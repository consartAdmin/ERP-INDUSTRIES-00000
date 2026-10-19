// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.render.js                                        ║
// ║ MODULE: Products Kits — Rendering                                   ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom, state } from './productsKits.state.js';
import { escapeHtml, money, toNumber } from './productsKits.utils.js';

export function renderKitsLoading() {
  if (!dom.kitsTableBody) return;
  dom.kitsTableBody.innerHTML = `
    <tr>
      <td colspan="9" class="empty">Carregando...</td>
    </tr>
  `;
}

export function renderKitsError() {
  if (!dom.kitsTableBody) return;
  dom.kitsTableBody.innerHTML = `
    <tr>
      <td colspan="9" class="empty">Erro ao carregar kits.</td>
    </tr>
  `;
}

export function renderKits() {
  if (!dom.kitsTableBody) return;

  if (!state.kits.length) {
    dom.kitsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty">Nenhum kit encontrado.</td>
      </tr>
    `;
    return;
  }

  dom.kitsTableBody.innerHTML = state.kits.map((kit) => `
    <tr>
      <td>${escapeHtml(kit.id)}</td>
      <td><strong>${escapeHtml(kit.kit_sku)}</strong></td>
      <td>${escapeHtml(kit.kit_description)}</td>
      <td>${escapeHtml(kit.price_mode || 'MANUAL')}</td>
      <td>${money(kit.sale_price)}</td>
      <td>${toNumber(kit.total_items)}</td>
      <td>${money(kit.total_cost)}</td>
      <td>
        <span class="badge ${kit.active ? 'badge-active' : 'badge-inactive'}">
          ${kit.active ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="actions-cell">
          <button
            type="button"
            class="btn btn-primary"
            data-kit-action="edit"
            data-kit-id="${escapeHtml(kit.id)}">
            Editar
          </button>
          <button
            type="button"
            class="btn btn-danger"
            data-kit-action="deactivate"
            data-kit-id="${escapeHtml(kit.id)}"
            ${kit.active ? '' : 'disabled'}>
            Inativar
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

export function renderItems() {
  if (!dom.itemsTableBody) return;

  if (!state.kitItems.length) {
    dom.itemsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty">Nenhum item adicionado.</td>
      </tr>
    `;
    updateTotals();
    return;
  }

  dom.itemsTableBody.innerHTML = state.kitItems.map((item, index) => {
    const factor = toNumber(item.unit_factor || 1);
    const totalCost =
      toNumber(item.quantity) * factor * toNumber(item.cost_unit);
    const totalSale =
      toNumber(item.quantity) * factor * toNumber(item.sale_price_unit);

    return `
      <tr>
        <td><strong>${escapeHtml(item.product_sku)}</strong></td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td>${toNumber(item.quantity).toFixed(3)}</td>
        <td>${money(item.cost_unit)}</td>
        <td>${money(item.sale_price_unit)}</td>
        <td>${money(totalCost)}</td>
        <td>${money(totalSale)}</td>
        <td>
          <button
            type="button"
            class="btn btn-danger"
            data-item-action="remove"
            data-item-index="${index}">
            Remover
          </button>
        </td>
      </tr>
    `;
  }).join('');

  updateTotals();
}

export function updateTotals() {
  const totalCost = state.kitItems.reduce((total, item) => {
    const factor = toNumber(item.unit_factor || 1);
    return total +
      toNumber(item.quantity) * factor * toNumber(item.cost_unit);
  }, 0);

  const totalSaleItems = state.kitItems.reduce((total, item) => {
    const factor = toNumber(item.unit_factor || 1);
    return total +
      toNumber(item.quantity) * factor * toNumber(item.sale_price_unit);
  }, 0);

  if (dom.totalCost) dom.totalCost.textContent = money(totalCost);
  if (dom.totalSaleItems) {
    dom.totalSaleItems.textContent = money(totalSaleItems);
  }

  if (dom.priceMode?.value === 'SUM_ITEMS' && dom.salePrice) {
    dom.salePrice.value = totalSaleItems.toFixed(2);
  }
}

export function setSaving(active) {
  state.saving = Boolean(active);
  if (dom.btnSalvarKit) dom.btnSalvarKit.disabled = state.saving;
}
