// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.actions.js                                       ║
// ║ MODULE: Products Kits — Actions                                     ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  createKit,
  deactivateKitById,
  getKit,
  listKits,
  updateKit,
} from './productsKits.api.js';
import { readListFilters } from './productsKits.filters.js';
import {
  clearForm,
  clearItemInputs,
  closeForm,
  fillKitForm,
  openForm,
  readItemForm,
  readKitForm,
} from './productsKits.form.js';
import {
  confirmDeactivateKit,
  showMessage,
} from './productsKits.modal.js';
import {
  renderItems,
  renderKits,
  renderKitsError,
  renderKitsLoading,
  setSaving,
  updateTotals,
} from './productsKits.render.js';
import { state } from './productsKits.state.js';
import {
  validateKit,
  validateKitItem,
} from './productsKits.validation.js';

export async function loadKits() {
  if (state.loadingList) return;

  state.loadingList = true;
  renderKitsLoading();

  try {
    const data = await listKits(readListFilters());
    state.kits = data.rows || [];
    renderKits();
  } catch (error) {
    console.error('[productsKits] loadKits error:', error);
    renderKitsError();
  } finally {
    state.loadingList = false;
  }
}

export function createNewKit() {
  clearForm();
  renderItems();
  openForm();
}

export async function editKit(id) {
  try {
    const data = await getKit(id);
    fillKitForm(data.data);
    renderItems();
    openForm();
  } catch (error) {
    console.error('[productsKits] editKit error:', error);
    showMessage(error.message, 'error');
  }
}

export async function deactivateKit(id) {
  if (!confirmDeactivateKit()) return;

  try {
    await deactivateKitById(id);
    await loadKits();
  } catch (error) {
    console.error('[productsKits] deactivateKit error:', error);
    showMessage(error.message, 'error');
  }
}

export function addItem() {
  const item = readItemForm();
  const validation = validateKitItem(item);

  if (!validation.ok) {
    showMessage(validation.message, 'error');
    return;
  }

  if (item.unit_factor <= 0) item.unit_factor = 1;

  state.kitItems.push(item);
  clearItemInputs();
  renderItems();
}

export function removeItem(index) {
  if (!Number.isInteger(index) || index < 0) return;
  state.kitItems.splice(index, 1);
  renderItems();
}

export async function saveKit() {
  if (state.saving) return;

  updateTotals();

  const { id, payload } = readKitForm();
  const validation = validateKit(payload);

  if (!validation.ok) {
    showMessage(validation.message, 'error');
    return;
  }

  setSaving(true);

  try {
    if (id) {
      await updateKit(id, payload);
    } else {
      await createKit(payload);
    }

    showMessage('Kit salvo com sucesso.');
    closeForm();
    renderItems();
    await loadKits();
  } catch (error) {
    console.error('[productsKits] saveKit error:', error);
    showMessage(error.message, 'error');
  } finally {
    setSaving(false);
  }
}
