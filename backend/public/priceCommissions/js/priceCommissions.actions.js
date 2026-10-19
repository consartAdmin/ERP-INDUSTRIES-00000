// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.actions.js — Ações do módulo | PRODNEX ERP         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './priceCommissions.config.js';
import { state } from './priceCommissions.state.js';
import {
  createPriceCommission,
  deletePriceCommission,
  listPriceCommissions,
  listPrices,
  listSellers,
  updatePriceCommission
} from './priceCommissions.api.js';
import { buildFilterParams, clearFilters } from './priceCommissions.filters.js';
import { getCurrentCommissionId, getFormPayload } from './priceCommissions.form.js';
import {
  closePriceCommissionModal,
  openPriceCommissionModal
} from './priceCommissions.modal.js';
import { renderPriceCommissions } from './priceCommissions.render.js';
import { validatePriceCommission } from './priceCommissions.validation.js';
import { fillSelect, showToast, todayYmd } from './priceCommissions.utils.js';

export function findCommissionById(id) {
  return state.rows.find(
    (row) => Number(row.commission_id) === Number(id)
  ) || null;
}

export async function loadPriceCommissionCombos() {
  const [pricesData, sellersData] = await Promise.all([
    listPrices(),
    listSellers()
  ]);

  state.prices = pricesData.rows || [];
  state.sellers = sellersData.rows || [];

  fillSelect(dom.fPrice, state.prices, {
    valueKey: 'price_id',
    labelKey: 'name'
  });

  fillSelect(dom.fSeller, state.sellers, {
    valueKey: 'id',
    labelKey: 'name'
  });
}

export async function searchPriceCommissions() {
  const data = await listPriceCommissions(buildFilterParams());
  state.rows = data.rows || [];
  renderPriceCommissions();
}

export async function clearAndSearchPriceCommissions() {
  clearFilters();
  await searchPriceCommissions();
}

export async function savePriceCommission(event) {
  event?.preventDefault?.();

  const id = getCurrentCommissionId();
  const payload = getFormPayload();

  validatePriceCommission(payload);

  if (id) {
    await updatePriceCommission(id, payload);
    showToast('Regra de comissão atualizada com sucesso.');
  } else {
    await createPriceCommission(payload);
    showToast('Regra de comissão criada com sucesso.');
  }

  closePriceCommissionModal();
  await searchPriceCommissions();
}

export async function removeCurrentPriceCommission() {
  const id = getCurrentCommissionId();
  if (!id) return;

  const confirmed = window.confirm('Confirma excluir esta regra?');
  if (!confirmed) return;

  await deletePriceCommission(id);
  closePriceCommissionModal();
  await searchPriceCommissions();
  showToast('Regra de comissão excluída com sucesso.');
}

export function editPriceCommission(id) {
  const row = findCommissionById(id);

  if (!row) {
    showToast('Regra de comissão não encontrada.');
    return;
  }

  openPriceCommissionModal(row);
}

export function duplicatePriceCommission(id) {
  const row = findCommissionById(id);

  if (!row) {
    showToast('Regra de comissão não encontrada.');
    return;
  }

  openPriceCommissionModal({
    ...row,
    commission_id: null,
    valid_from: todayYmd(),
    valid_to: null
  });
}

