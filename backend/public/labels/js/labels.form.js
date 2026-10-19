import { DEFAULT_TEMPLATE, STORAGE_KEY } from './labels.config.js';
import { state } from './labels.state.js';
import { $, showModal } from './labels.utils.js';

export function loadSavedConfig() {
  try {
    const config = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!config) return;
    const values = {
      labelsTemplate: config.templateSlug,
      labelsQty: config.labelsPerProduct,
      labelsMode: config.scope,
      labelFontPreset: config.fontPreset,
      labelParametersPreset: config.labelParametersId,
      labelsPriceTable: config.priceId,
      labelWidth: config.labelConfig?.widthMm,
      labelHeight: config.labelConfig?.heightMm,
      labelCols: config.labelConfig?.columns,
      labelRows: config.labelConfig?.rows,
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $(`#${id}`);
      if (element && value != null) element.value = String(value);
    });
    state.currentPriceId = Number(config.priceId) || null;
  } catch (error) {
    console.warn('[Labels] Configuração local inválida:', error);
  }
}

export function saveConfig(payload) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      templateSlug: payload.templateSlug,
      labelsPerProduct: payload.labelsPerProduct,
      scope: payload.scope,
      fontPreset: payload.fontPreset,
      labelParametersId: payload.labelParametersId,
      priceId: payload.priceId,
      labelConfig: payload.labelConfig || null,
    }),
  );
}

export function readLabelsForm({ strict = true } = {}) {
  const labelsPerProduct = Number($('#labelsQty')?.value || 1);
  if (!Number.isFinite(labelsPerProduct) || labelsPerProduct <= 0) {
    if (strict) showModal({ variant: 'warning', title: 'Quantidade inválida', message: 'Informe uma quantidade maior que zero.' });
    return null;
  }

  const scope = String($('#labelsMode')?.value || 'ALL').toUpperCase();
  const payload = {
    templateSlug: $('#labelsTemplate')?.value || DEFAULT_TEMPLATE,
    labelsPerProduct,
    scope,
    fontPreset: $('#labelFontPreset')?.value || 'M',
    labelParametersId: Number($('#labelParametersPreset')?.value) || null,
    priceId: Number($('#labelsPriceTable')?.value) || null,
  };
  state.currentPriceId = payload.priceId;

  if (scope === 'SEARCH') {
    payload.search = ($('#labelsQuery')?.value || '').trim();
    if (strict && !state.manualItems.length) {
      showModal({ variant: 'warning', title: 'Produto obrigatório', message: 'Selecione ao menos um produto pelo modal de busca.' });
      return null;
    }
  }

  if (!payload.labelParametersId) {
    const config = {
      widthMm: Number($('#labelWidth')?.value) || null,
      heightMm: Number($('#labelHeight')?.value) || null,
      columns: Number($('#labelCols')?.value) || null,
      rows: Number($('#labelRows')?.value) || null,
    };
    if (Object.values(config).some(Boolean)) payload.labelConfig = config;
  }
  return payload;
}

export function applyPreset(preset) {
  const values = {
    labelWidth: preset?.label_width_mm,
    labelHeight: preset?.label_height_mm,
    labelCols: preset?.cols_per_page,
    labelRows: preset?.rows_per_page,
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = $(`#${id}`);
    if (element) element.value = value ?? '';
  });
}

