import { fetchLabelParameters, fetchPriceTables } from './labels.api.js';
import { addProduct, addProductSelectedInModal, generateLabels } from './labels.actions.js';
import { applyPreset, loadSavedConfig, readLabelsForm } from './labels.form.js';
import { bindProductSearch } from './labels.modal.js';
import { renderItems } from './labels.render.js';
import { state } from './labels.state.js';
import { $ } from './labels.utils.js';

function populateSelect(select, list, value, label) {
  if (!select) return;
  const placeholder = select.querySelector('option[value=""]')?.cloneNode(true);
  select.innerHTML = '';
  if (placeholder) select.appendChild(placeholder);
  list.forEach((item) => {
    const option = document.createElement('option');
    option.value = String(value(item));
    option.textContent = label(item);
    select.appendChild(option);
  });
}

async function loadLookups() {
  const [presets, prices] = await Promise.all([
    fetchLabelParameters().catch((error) => (console.warn(error), [])),
    fetchPriceTables().catch((error) => (console.warn(error), [])),
  ]);
  state.labelParametersPresets = presets;
  state.priceTables = prices;
  populateSelect($('#labelParametersPreset'), presets, (item) => item.id, (item) => `${item.name || `Modelo #${item.id}`} — ${item.label_width_mm || 0}×${item.label_height_mm || 0} mm`);
  populateSelect($('#labelsPriceTable'), prices, (item) => item.price_id || item.id, (item) => item.name || `Tabela #${item.price_id || item.id}`);
}

function bindEvents() {
  $('#btnAddProductToList')?.addEventListener('click', addProduct);
  $('#manualProductCode')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addProduct();
    }
  });
  $('#btnGenerateLabels')?.addEventListener('click', (event) => {
    event.preventDefault();
    generateLabels();
  });
  $('#labelsForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    generateLabels();
  });
  $('#labelParametersPreset')?.addEventListener('change', (event) => {
    applyPreset(state.labelParametersPresets.find((item) => String(item.id) === event.target.value));
  });
  $('#labelsPriceTable')?.addEventListener('change', (event) => {
    state.currentPriceId = Number(event.target.value) || null;
  });
  bindProductSearch(addProductSelectedInModal);
}

async function init() {
  loadSavedConfig();
  await loadLookups();
  bindEvents();
  renderItems(readLabelsForm({ strict: false }));
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init, { once: true })
  : init();

