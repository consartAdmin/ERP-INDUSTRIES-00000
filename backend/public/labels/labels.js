// /public/labels/labels.js
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labels.js — Tela de Impressão de Etiquetas (Frontend, ESM)          ║
// ║ PRODNEX ERP — Consome /api/labels/products via fetch                ║
// ║ UPDATE: seleção de unidade por item + barcode por unidade           ║
// ║ UPDATE: download direto do PDF sem salvar no servidor               ║
// ║ UPDATE: integra modal de busca de produtos no modo SEARCH           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  window.location.origin;

const STORAGE_KEY = 'consart_labels_ui_config';

let manualItems = [];
let labelParametersPresets = [];
let priceTables = [];
let currentPriceId = null;

const showCenterModal =
  (typeof window !== 'undefined' && window.showCenterModal) ||
  ((options) => {
    console.log('[Labels] Modal (fallback):', options);
    if (options?.message) {
      alert(
        `${options.title || 'Informação'}\n\n${options.message.replace(
          /<[^>]+>/g,
          '',
        )}`,
      );
    }
  });

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

document.addEventListener('DOMContentLoaded', async () => {
  loadSavedUiConfig();
  await Promise.all([loadLabelParametersPresets(), loadPriceTables()]);
  setupModeVisibility();
  bindFormEvents();
  bindPreviewEvents();
  bindManualAddEvents();
  bindSearchModalEvents();

  const initial = buildLabelsPayload({ strict: false });
  if (initial) updateItemsPreview(initial);
});

/* --------------------------------------------------------------------- */
/* localStorage                                                          */
/* --------------------------------------------------------------------- */

function loadSavedUiConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);

    if (cfg.templateSlug && $('#labelsTemplate')) {
      $('#labelsTemplate').value = cfg.templateSlug;
    }
    if (cfg.labelsPerProduct && $('#labelsQty')) {
      $('#labelsQty').value = cfg.labelsPerProduct;
    }
    if (cfg.scope && $('#labelsMode')) {
      $('#labelsMode').value = cfg.scope;
    }
    if (cfg.fontPreset && $('#labelFontPreset')) {
      $('#labelFontPreset').value = cfg.fontPreset;
    }

    if (cfg.labelConfig) {
      const { widthMm, heightMm, columns, rows } = cfg.labelConfig;
      if (widthMm != null && $('#labelWidth')) $('#labelWidth').value = widthMm;
      if (heightMm != null && $('#labelHeight')) $('#labelHeight').value = heightMm;
      if (columns != null && $('#labelCols')) $('#labelCols').value = columns;
      if (rows != null && $('#labelRows')) $('#labelRows').value = rows;
    }

    if (cfg.labelParametersId && $('#labelParametersPreset')) {
      $('#labelParametersPreset').value = String(cfg.labelParametersId);
    }

    if (cfg.priceId && $('#labelsPriceTable')) {
      $('#labelsPriceTable').value = String(cfg.priceId);
      currentPriceId = Number(cfg.priceId) || null;
    }
  } catch (err) {
    console.warn('[Labels] Erro ao carregar config salva:', err);
  }
}

function saveUiConfig(uiPayload) {
  try {
    const cfg = {
      templateSlug: uiPayload.templateSlug,
      labelsPerProduct: uiPayload.labelsPerProduct,
      scope: uiPayload.scope,
      fontPreset: uiPayload.fontPreset || 'M',
      labelConfig: uiPayload.labelConfig || null,
      labelParametersId: uiPayload.labelParametersId || null,
      priceId: uiPayload.priceId || null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.warn('[Labels] Erro ao salvar config no localStorage:', err);
  }
}

/* --------------------------------------------------------------------- */
/* Carregar presets da tabela labelParameters                            */
/* --------------------------------------------------------------------- */

async function loadLabelParametersPresets() {
  const select = $('#labelParametersPreset');
  if (!select) return;

  try {
    const url = `${API_BASE}/api/label-parameters?active=true`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(
        '[Labels] Falha ao carregar modelos de etiqueta:',
        resp.status,
        resp.statusText,
      );
      return;
    }

    const data = await resp.json();
    const list = Array.isArray(data) ? data : data.rows || data.items || [];
    labelParametersPresets = list;

    const placeholder = select.querySelector('option[value=""]') || null;
    select.innerHTML = '';

    if (placeholder) {
      select.appendChild(placeholder);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Selecione um modelo salvo…';
      select.appendChild(opt);
    }

    list.forEach((preset) => {
      const opt = document.createElement('option');
      opt.value = String(preset.id);
      const name = preset.name || `Modelo #${preset.id}`;
      const w = preset.label_width_mm;
      const h = preset.label_height_mm;
      const cols = preset.cols_per_page;
      const rows = preset.rows_per_page;

      let extra = '';
      if (w && h) extra += ` — ${w}×${h} mm`;
      if (cols && rows) extra += ` · ${cols}×${rows}`;

      opt.textContent = `${name}${extra}`;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      const id = Number(select.value || '0');
      if (!Number.isInteger(id) || id <= 0) return;

      const preset = labelParametersPresets.find(
        (p) => Number(p.id) === Number(id),
      );

      if (preset) {
        applyLabelParametersToForm(preset);
        const uiPayload = buildLabelsPayload({ strict: false });
        if (uiPayload) updateItemsPreview(uiPayload);
      }
    });

    const currentId = Number(select.value || '0');
    if (Number.isInteger(currentId) && currentId > 0) {
      const preset = labelParametersPresets.find(
        (p) => Number(p.id) === Number(currentId),
      );
      if (preset) applyLabelParametersToForm(preset);
    }
  } catch (err) {
    console.warn('[Labels] Erro ao buscar labelParameters:', err);
  }
}

function applyLabelParametersToForm(preset) {
  if (!preset) return;

  const widthEl = $('#labelWidth');
  const heightEl = $('#labelHeight');
  const colsEl = $('#labelCols');
  const rowsEl = $('#labelRows');

  if (widthEl) widthEl.value = preset.label_width_mm ?? '';
  if (heightEl) heightEl.value = preset.label_height_mm ?? '';
  if (colsEl) colsEl.value = preset.cols_per_page ?? '';
  if (rowsEl) rowsEl.value = preset.rows_per_page ?? '';
}

/* --------------------------------------------------------------------- */
/* Carregar tabelas de preço                                             */
/* --------------------------------------------------------------------- */

async function loadPriceTables() {
  const select = $('#labelsPriceTable');
  if (!select) return;

  try {
    const url = `${API_BASE}/api/prices?active=true`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(
        '[Labels] Falha ao carregar tabelas de preço:',
        resp.status,
        resp.statusText,
      );
      return;
    }

    const json = await resp.json();

    const list = Array.isArray(json)
      ? json
      : Array.isArray(json.data?.rows)
        ? json.data.rows
        : Array.isArray(json.rows)
          ? json.rows
          : Array.isArray(json.items)
            ? json.items
            : [];

    priceTables = list;

    const firstOption = select.querySelector('option[value=""]');
    select.innerHTML = '';

    if (firstOption) {
      select.appendChild(firstOption);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Padrão (sem tabela)';
      select.appendChild(opt);
    }

    list.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = String(p.price_id || p.id);
      opt.textContent = p.name || `Tabela #${p.price_id || p.id}`;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      currentPriceId = select.value ? Number(select.value) || null : null;
      syncSearchDisplay();
      const uiPayload = buildLabelsPayload({ strict: false });
      if (uiPayload) updateItemsPreview(uiPayload);
    });

    if (currentPriceId && select.value !== String(currentPriceId)) {
      select.value = String(currentPriceId);
    } else if (select.value) {
      currentPriceId = Number(select.value) || null;
    }
  } catch (err) {
    console.warn('[Labels] Erro ao carregar prices:', err);
  }
}

/* --------------------------------------------------------------------- */
/* Visibilidade dos campos                                               */
/* --------------------------------------------------------------------- */

function setupModeVisibility() {
  const modeSelect = $('#labelsMode');
  const form = $('#labelsForm');
  if (!modeSelect || !form) return;

  const applyClass = () => {
    const currentRaw = modeSelect.value || 'ALL';
    const current = String(currentRaw).toUpperCase();

    form.classList.remove(
      'labels-mode-ALL',
      'labels-mode-SEARCH',
      'labels-mode-SKU',
    );
    form.classList.add(`labels-mode-${current}`);

    if (current === 'SKU') {
      const skuInput = $('#manualProductCode') || $('#labelsSku');
      if (skuInput) {
        skuInput.focus();
        if (typeof skuInput.select === 'function') skuInput.select();
      }
    }

    if (current === 'SEARCH') {
      const searchInput = $('#labelsQuery');
      if (searchInput) searchInput.focus();
    }

    syncSearchDisplay();
  };

  modeSelect.addEventListener('change', () => {
    applyClass();
    const uiPayload = buildLabelsPayload({ strict: false });
    if (uiPayload) updateItemsPreview(uiPayload);
  });

  applyClass();
}

/* --------------------------------------------------------------------- */
/* Eventos do formulário                                                 */
/* --------------------------------------------------------------------- */

function bindFormEvents() {
  const form = $('#labelsForm');
  const btn = $('#btnGenerateLabels');
  if (!form || !btn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleGenerateLabels();
  });

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleGenerateLabels();
  });
}

function bindPreviewEvents() {
  const fields = [
    '#labelsQty',
    '#labelsMode',
    '#labelsQuery',
    '#labelsSku',
    '#labelWidth',
    '#labelHeight',
    '#labelCols',
    '#labelRows',
    '#labelFontPreset',
    '#labelParametersPreset',
    '#labelsPriceTable',
  ];

  fields.forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const uiPayload = buildLabelsPayload({ strict: false });
      if (uiPayload) updateItemsPreview(uiPayload);
    });
  });
}

function bindManualAddEvents() {
  const inputCode = $('#manualProductCode');
  const inputQty = $('#manualLabelsQty');
  const btnAdd = $('#btnAddProductToList');

  if (!inputCode || !inputQty || !btnAdd) return;

  const triggerAdd = async () => {
    await handleAddProductToList();
  };

  btnAdd.addEventListener('click', async (e) => {
    e.preventDefault();
    await triggerAdd();
  });

  inputCode.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await triggerAdd();
    }
  });
}

/* --------------------------------------------------------------------- */
/* Modal de busca de produtos                                            */
/* --------------------------------------------------------------------- */

function bindSearchModalEvents() {
  const input = $('#labelsQuery');
  const btn = $('#btnOpenSearchProductModal');
  if (!input && !btn) return;

  const openModal = () => {
    const mode = String($('#labelsMode')?.value || 'ALL').toUpperCase();
    if (mode !== 'SEARCH') return;

    openProductsModalSearch({
      apiBase: API_BASE,
      priceId: currentPriceId,
      onPick: (product) => {
        addProductFromModal(product);
      },
    });
  };

  if (input) {
    input.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  }

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  }
}

function addProductFromModal(product) {
  if (!product || typeof product !== 'object') return;

  const labelsQtyBase = Number($('#labelsQty')?.value || 1);
  const defaultQty =
    Number.isFinite(labelsQtyBase) && labelsQtyBase > 0 ? labelsQtyBase : 1;

  const normalized = normalizeProductForLabel(product, defaultQty);
  if (!normalized) {
    showCenterModal({
      variant: 'warning',
      title: 'Produto inválido',
      message: 'O produto selecionado no modal não possui código identificador.',
    });
    return;
  }

  mergeManualItem(normalized);
  syncSearchDisplay();

  const uiPayload = buildLabelsPayload({ strict: false }) || {
    templateSlug: 'default-product-label',
    labelsPerProduct: defaultQty,
    scope: 'SEARCH',
  };
  updateItemsPreview(uiPayload);
}

/* --------------------------------------------------------------------- */
/* Geração                                                               */
/* --------------------------------------------------------------------- */

async function handleGenerateLabels() {
  try {
    const uiPayload = buildLabelsPayload({ strict: true });
    if (!uiPayload) return;

    saveUiConfig(uiPayload);
    updateItemsPreview(uiPayload);

    setLoading(true);

    const result = await generateProductLabels(uiPayload);

    setLoading(false);

    renderJobResult(result);
    notifyJobResult(result);
    openPdfFromJob(result);
  } catch (err) {
    console.error('[Labels] Erro ao gerar etiquetas:', err);
    setLoading(false);

    showCenterModal({
      variant: 'error',
      title: 'Erro ao gerar etiquetas',
      message:
        err.message || 'Ocorreu um erro inesperado ao gerar as etiquetas.',
    });
  }
}

/* --------------------------------------------------------------------- */
/* Montar payload da UI                                                  */
/* --------------------------------------------------------------------- */

function buildLabelsPayload(options = { strict: true }) {
  const strict = options.strict !== false;

  const templateEl = $('#labelsTemplate');
  const qtyEl = $('#labelsQty');
  const modeEl = $('#labelsMode');
  const queryEl = $('#labelsQuery');
  const skuEl = $('#labelsSku');
  const presetEl = $('#labelParametersPreset');
  const fontPresetEl = $('#labelFontPreset');
  const priceTableEl = $('#labelsPriceTable');

  const template = templateEl?.value || 'default-product-label';
  const labelsPerProduct = Number(qtyEl?.value || 1);
  const scope = modeEl?.value || 'ALL';
  const fontPreset = fontPresetEl?.value || 'M';

  const labelParametersId =
    presetEl && presetEl.value ? Number(presetEl.value) || null : null;

  const priceId =
    priceTableEl && priceTableEl.value ? Number(priceTableEl.value) || null : null;
  currentPriceId = priceId;

  if (!Number.isFinite(labelsPerProduct) || labelsPerProduct <= 0) {
    if (strict) {
      showCenterModal({
        variant: 'warning',
        title: 'Quantidade inválida',
        message:
          'Informe uma quantidade de etiquetas por produto maior que zero.',
      });
    }
    return null;
  }

  const uiPayload = {
    templateSlug: template,
    labelsPerProduct,
    scope,
    fontPreset,
    labelParametersId,
    priceId,
  };

  if (scope === 'SEARCH') {
    const search = (queryEl?.value || '').trim();

    if (!manualItems.length && !search) {
      if (strict) {
        showCenterModal({
          variant: 'warning',
          title: 'Produto obrigatório',
          message:
            'Quando o alcance for "Filtrar por pesquisa", selecione ao menos um produto pelo modal de busca.',
        });
      }
      return strict ? null : uiPayload;
    }

    uiPayload.search = search;
  }

  if (scope === 'SKU') {
    const sku = (skuEl?.value || '').trim();
    if (sku) {
      uiPayload.productSku = sku;
    }
  }

  if (!labelParametersId) {
    const widthEl = $('#labelWidth');
    const heightEl = $('#labelHeight');
    const colsEl = $('#labelCols');
    const rowsEl = $('#labelRows');

    const cfg = {
      widthMm: widthEl && widthEl.value ? Number(widthEl.value) : null,
      heightMm: heightEl && heightEl.value ? Number(heightEl.value) : null,
      columns: colsEl && colsEl.value ? Number(colsEl.value) : null,
      rows: rowsEl && rowsEl.value ? Number(rowsEl.value) : null,
    };

    const hasAnySize =
      (cfg.widthMm && cfg.widthMm > 0) ||
      (cfg.heightMm && cfg.heightMm > 0) ||
      (cfg.columns && cfg.columns > 0) ||
      (cfg.rows && cfg.rows > 0);

    if (hasAnySize) uiPayload.labelConfig = cfg;
  }

  return uiPayload;
}

/* --------------------------------------------------------------------- */
/* Adicionar produto na lista manual                                     */
/* --------------------------------------------------------------------- */

async function handleAddProductToList() {
  const codeInput = $('#manualProductCode');
  const qtyInput = $('#manualLabelsQty');
  const qtyDefaultInput = $('#labelsQty');

  const rawCode = (codeInput?.value || '').trim();
  if (!rawCode) {
    showCenterModal({
      variant: 'warning',
      title: 'Código obrigatório',
      message:
        'Digite o código interno ou leia o código de barras do produto.',
    });
    return;
  }

  const qtyBase = Number(qtyInput?.value || qtyDefaultInput?.value || 1);
  if (!Number.isFinite(qtyBase) || qtyBase <= 0) {
    showCenterModal({
      variant: 'warning',
      title: 'Quantidade inválida',
      message:
        'Informe a quantidade de etiquetas para este produto (maior que zero).',
    });
    return;
  }

  try {
    setLoading(true);
    const product = await searchProductByCodeOrBarcode(rawCode);
    setLoading(false);

    if (!product) {
      showCenterModal({
        variant: 'warning',
        title: 'Produto não encontrado',
        message:
          'Nenhum produto foi localizado com o código informado. Verifique o código interno ou código de barras.',
      });
      return;
    }

    const normalized = normalizeProductForLabel(product, qtyBase, rawCode);
    if (!normalized) {
      showCenterModal({
        variant: 'warning',
        title: 'Produto inválido',
        message: 'O produto localizado não possui dados suficientes para impressão.',
      });
      return;
    }

    mergeManualItem(normalized);

    if (codeInput) codeInput.value = '';
    if (qtyInput) qtyInput.value = '1';

    syncSearchDisplay();

    const uiPayload = buildLabelsPayload({ strict: false }) || {
      templateSlug: 'default-product-label',
      labelsPerProduct: qtyBase,
      scope: 'SKU',
    };
    updateItemsPreview(uiPayload);
  } catch (err) {
    setLoading(false);
    console.error('[Labels] Erro ao buscar produto:', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao buscar produto',
      message:
        err.message || 'Falha ao localizar produto pelo código informado.',
    });
  }
}

async function searchProductByCodeOrBarcode(codeOrBarcode) {
  const trimmed = (codeOrBarcode || '').trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({ q: trimmed });

  if (currentPriceId) {
    params.set('price_id', String(currentPriceId));
  }

  const url = `${API_BASE}/api/products/search?${params.toString()}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(
      `Erro ao consultar produtos (${resp.status}): ${txt || resp.statusText || 'erro desconhecido'
      }`,
    );
  }

  const data = await resp.json();
  const list = Array.isArray(data) ? data : data.rows || data.items || [];

  if (!Array.isArray(list) || !list.length) return null;

  const lower = trimmed.toLowerCase();

  const exact = list.find((p) => {
    const code1 = String(
      p.product_code || p.codigo_interno || p.sku || '',
    ).toLowerCase();

    const bar1 = String(
      p.bar_code || p.barcode || p.ean || p.codigo_barras || '',
    ).toLowerCase();

    return code1 === lower || bar1 === lower;
  });

  return exact || list[0];
}

/* --------------------------------------------------------------------- */
/* Preview                                                               */
/* --------------------------------------------------------------------- */

function updateItemsPreview(uiPayload) {
  const tbody = $('#tableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const { scope, labelsPerProduct } = uiPayload;

  if ((scope === 'SKU' || scope === 'SEARCH') && manualItems.length > 0) {
    manualItems.forEach((item, idx) => {
      const selectedUnit = getSelectedUnit(item);
      const hasManyUnits = Array.isArray(item.units) && item.units.length > 1;

      const unitOptionsHtml = (item.units || [])
        .map((u, unitIndex) => {
          const value = escapeHtml(buildUnitKey(u, unitIndex));
          const label = escapeHtml(u.unitLabel || u.unitCode || u.unitName || 'UN');
          const selected =
            String(buildUnitKey(u, unitIndex)) === String(item.selectedUnitKey)
              ? 'selected'
              : '';
          return `<option value="${value}" ${selected}>${label}</option>`;
        })
        .join('');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.productCode ?? '')}</td>
        <td>
          ${hasManyUnits
          ? `
            <select class="c-input labels-table__unit-select" data-index="${idx}">
              ${unitOptionsHtml}
            </select>
          `
          : `
            <span>${escapeHtml(selectedUnit?.unitLabel || selectedUnit?.unitCode || '-')}</span>
          `
        }
        </td>
        <td>${escapeHtml(selectedUnit?.barCode || item.barCode || '')}</td>
        <td>${escapeHtml(item.description ?? '')}</td>
        <td>
          <input
            type="number"
            min="1"
            step="1"
            class="labels-table__qty-input"
            data-index="${idx}"
            value="${Number(item.labelsPerProduct || 1)}"
          />
        </td>
        <td>
          <button
            type="button"
            class="labels-row-remove"
            data-index="${idx}"
          >
            Remover
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    bindManualTableEvents();
    return;
  }

  let tipo = '';
  let detalhe = '';

  if (scope === 'ALL') {
    tipo = 'Todos os produtos';
    detalhe = 'Modo "Todos os produtos" ainda não implementado nesta versão.';
  } else if (scope === 'SEARCH') {
    tipo = 'Filtro de pesquisa';
    const s = (uiPayload.search || '').trim();
    detalhe = s
      ? `Produtos selecionados por pesquisa/modal: "${escapeHtml(s)}".`
      : 'Clique em “Buscar produto” para selecionar um ou mais itens.';
  } else if (scope === 'SKU') {
    tipo = 'Produto único (SKU padrão)';
    const sku = (uiPayload.productSku || '').trim();
    detalhe = sku
      ? `Produto com código interno (SKU): ${escapeHtml(sku)}.`
      : 'Informe o código interno (SKU) ou utilize a lista manual acima.';
  } else {
    tipo = 'Configuração inválida';
    detalhe = 'Revise os parâmetros de alcance.';
  }

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td colspan="4">${tipo} — ${detalhe}</td>
    <td>${Number.isFinite(labelsPerProduct) ? labelsPerProduct : '-'}</td>
    <td>-</td>
  `;
  tbody.appendChild(tr);
}

function bindManualTableEvents() {
  const tbody = $('#tableBody');
  if (!tbody) return;

  tbody.querySelectorAll('.labels-row-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = Number(btn.dataset.index);
      if (Number.isInteger(idx)) {
        manualItems.splice(idx, 1);
        syncSearchDisplay();

        const uiPayload = buildLabelsPayload({ strict: false }) || {
          templateSlug: 'default-product-label',
          labelsPerProduct: 1,
          scope: String($('#labelsMode')?.value || 'SKU').toUpperCase(),
        };

        updateItemsPreview(uiPayload);
      }
    });
  });

  tbody.querySelectorAll('.labels-table__qty-input').forEach((input) => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.index);
      const value = Number(input.value || 1);
      if (!Number.isInteger(idx) || !manualItems[idx]) return;
      manualItems[idx].labelsPerProduct = value > 0 ? value : 1;
      syncSearchDisplay();
    });
  });

  tbody.querySelectorAll('.labels-table__unit-select').forEach((select) => {
    select.addEventListener('change', () => {
      const idx = Number(select.dataset.index);
      if (!Number.isInteger(idx) || !manualItems[idx]) return;

      manualItems[idx].selectedUnitKey = String(select.value || '');
      const selectedUnit = getSelectedUnit(manualItems[idx]);

      manualItems[idx].barCode = selectedUnit?.barCode || manualItems[idx].barCode || '';

      const uiPayload = buildLabelsPayload({ strict: false }) || {
        templateSlug: 'default-product-label',
        labelsPerProduct: 1,
        scope: String($('#labelsMode')?.value || 'SKU').toUpperCase(),
      };

      updateItemsPreview(uiPayload);
    });
  });
}

/* --------------------------------------------------------------------- */
/* API payload                                                           */
/* --------------------------------------------------------------------- */

function buildApiPayloadFromUi(uiPayload) {
  const {
    templateSlug,
    labelsPerProduct,
    scope,
    fontPreset,
    labelParametersId,
    priceId,
  } = uiPayload;

  const items = [];

  if ((scope === 'SKU' || scope === 'SEARCH') && manualItems.length > 0) {
    manualItems.forEach((item) => {
      const selectedUnit = getSelectedUnit(item);

      items.push({
        productCode: item.productCode || null,
        barCode: selectedUnit?.barCode || item.barCode || null,
        description: item.description || null,
        salePrice: item.salePrice || null,
        unit: item.unit || null,
        labelsPerProduct: Number(item.labelsPerProduct) || 1,

        unit: selectedUnit?.unitCode || null,
        unitCode: selectedUnit?.unitCode || null,
        unitName: selectedUnit?.unitName || selectedUnit?.unitLabel || null,
        unitLabel: selectedUnit?.unitLabel || selectedUnit?.unitName || null,
        unitFactor: selectedUnit?.factor ?? null,
      });
    });
  } else if (scope === 'SKU' && uiPayload.productSku) {
    items.push({
      productCode: uiPayload.productSku,
      labelsPerProduct,
    });
  } else if (scope === 'SEARCH') {
    items.push({
      search: uiPayload.search,
      labelsPerProduct,
    });
  } else if (scope === 'ALL') {
    items.push({
      mode: 'ALL',
      labelsPerProduct,
    });
  }

  const apiPayload = {
    templateId: templateSlug,
    templateSlug,
    labelsPerProduct,
    scope,
    fontPreset: fontPreset || 'M',
    items,
  };

  if (labelParametersId) {
    apiPayload.labelParametersId = labelParametersId;
  }

  if (priceId) {
    apiPayload.priceId = priceId;
    apiPayload.priceTableId = priceId;
  }

  if (!labelParametersId && uiPayload.labelConfig) {
    apiPayload.labelConfig = uiPayload.labelConfig;
  }

  return apiPayload;
}

/* --------------------------------------------------------------------- */
/* HTTP                                                                  */
/* --------------------------------------------------------------------- */

async function generateProductLabels(uiPayload) {
  const url = `${API_BASE}/api/labels/products`;
  const apiPayload = buildApiPayloadFromUi(uiPayload);

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiPayload),
  });

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => '');
    throw new Error(
      `[Labels] Erro ${resp.status} ao gerar etiquetas: ${errorText || resp.statusText || 'Erro desconhecido'
      }`,
    );
  }

  const blob = await resp.blob();
  const contentDisposition = resp.headers.get('Content-Disposition') || '';
  const fileName =
    extractFilenameFromContentDisposition(contentDisposition) ||
    buildDefaultLabelsFileName(uiPayload);

  const objectUrl = URL.createObjectURL(blob);

  triggerBrowserDownload(objectUrl, fileName);

  return {
    ok: true,
    data: {
      fileName,
      format: 'pdf',
      templateSlug: uiPayload.templateSlug || 'default-product-label',
      totalLabels: countTotalLabelsFromManualItems(uiPayload),
      objectUrl,
      downloaded: true,
    },
  };
}

/* --------------------------------------------------------------------- */
/* Feedback UI                                                           */
/* --------------------------------------------------------------------- */

function setLoading(isLoading) {
  const btn = $('#btnGenerateLabels');
  if (!btn) return;

  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = 'Gerando...';
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
  }
}

function renderJobResult(job) {
  const panel = $('#labelsResultPanel');
  if (!panel) return;

  panel.innerHTML = '';

  if (!job) {
    panel.innerHTML =
      '<p class="labels-result__placeholder">Nenhum resultado retornado pela API.</p>';
    return;
  }

  const d = job.data || job;
  const fileName = d.fileName || 'labels.pdf';
  const format = d.format || 'pdf';
  const template =
    d.templateId ||
    d.templateSlug ||
    d.template ||
    'default-product-label';
  const totalLabels = d.totalLabels || null;

  const wrapper = document.createElement('div');
  wrapper.className = 'labels-result__content';

  wrapper.innerHTML = `
    <div class="labels-result__row">
      <span class="labels-result__label">Template:</span>
      <span class="labels-result__value">${escapeHtml(template)}</span>
    </div>
    <div class="labels-result__row">
      <span class="labels-result__label">Nome do arquivo:</span>
      <span class="labels-result__value">${escapeHtml(fileName)}</span>
    </div>
    <div class="labels-result__row">
      <span class="labels-result__label">Formato:</span>
      <span class="labels-result__value">${escapeHtml(format)}</span>
    </div>
    ${totalLabels != null
      ? `
      <div class="labels-result__row">
        <span class="labels-result__label">Total de etiquetas:</span>
        <span class="labels-result__value">${totalLabels}</span>
      </div>
    `
      : ''
    }
    <div class="labels-result__row">
      <span class="labels-result__label">Status:</span>
      <span class="labels-result__value">Download iniciado com sucesso</span>
    </div>
  `;

  panel.appendChild(wrapper);
}

function notifyJobResult(job) {
  if (!job) return;
  const d = job.data || job;

  const fileName = d.fileName || 'labels.pdf';
  const template =
    d.templateId ||
    d.templateSlug ||
    d.template ||
    'default-product-label';
  const totalLabels = d.totalLabels || null;

  let message = `Template: <strong>${escapeHtml(template)}</strong><br/>`;
  message += `Arquivo: <strong>${escapeHtml(fileName)}</strong><br/>`;
  if (totalLabels != null) {
    message += `Total de etiquetas: <strong>${totalLabels}</strong><br/>`;
  }
  message += '<br/>O download do PDF foi iniciado.';

  showCenterModal({
    variant: 'success',
    title: 'Etiquetas geradas com sucesso!',
    message,
    timeoutMs: 7000,
  });
}

function openPdfFromJob(job) {
  try {
    if (!job) return;
    const d = job.data || job;
    const objectUrl = d.objectUrl || null;
    if (!objectUrl) return;

    window.open(objectUrl, '_blank', 'noopener');

    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        console.warn('[Labels] Falha ao liberar object URL:', err);
      }
    }, 60000);
  } catch (err) {
    console.warn('[Labels] Não foi possível abrir o PDF automaticamente:', err);
  }
}

/* --------------------------------------------------------------------- */
/* Normalização de unidades                                              */
/* --------------------------------------------------------------------- */

function normalizeProductForLabel(product, labelsQty = 1, rawCode = '') {
  const productCode =
    product.product_code ||
    product.codigo_interno ||
    product.sku ||
    product.product_id ||
    product.codigo ||
    product.code ||
    product.id ||
    rawCode ||
    '';

  const description =
    product.description ||
    product.nome ||
    product.nome_fantasia ||
    product.name ||
    product.product_name ||
    'Produto sem descrição';

  const salePrice =
    product.sale_price ??
    product.preco_venda ??
    product.price ??
    product.preco ??
    product.valor ??
    null;

  if (!productCode) return null;

  const units = extractUnitsFromProduct(product);
  const selectedUnitKey = units.length ? buildUnitKey(units[0], 0) : '';

  return {
    productCode,
    description,
    salePrice,
    labelsPerProduct: Number(labelsQty) > 0 ? Number(labelsQty) : 1,
    units,
    selectedUnitKey,
    barCode: units[0]?.barCode || '',
  };
}

function extractUnitsFromProduct(product) {
  const rawCollections = [
    product.units,
    product.unit_options,
    product.sale_units,
    product.unidades,
    product.unidades_produto,
    product.units_product,
    product.product_units,
    product.multiples_units,
    product.barcode_units,
  ].filter(Array.isArray);

  const result = [];

  rawCollections.forEach((collection) => {
    collection.forEach((u, index) => {
      const unitCode =
        u.unit_code ||
        u.unit ||
        u.unidade ||
        u.sigla ||
        u.abbreviation ||
        u.code ||
        u.nome ||
        '';

      const unitName =
        u.unit_name ||
        u.name ||
        u.nome ||
        u.description ||
        u.descricao ||
        unitCode ||
        'UN';

      const factor =
        u.factor ??
        u.fator ??
        u.multiplier ??
        u.qty ??
        u.quantidade ??
        null;

      const barCode =
        u.bar_code ||
        u.barcode ||
        u.ean ||
        u.codigo_barras ||
        u.gtin ||
        '';

      if (!unitCode && !unitName && !barCode) return;

      result.push({
        unitCode: String(unitCode || unitName || `UN-${index + 1}`),
        unitName: String(unitName || unitCode || 'UN'),
        unitLabel: formatUnitLabel({
          unitCode: String(unitCode || ''),
          unitName: String(unitName || ''),
          factor,
        }),
        factor: factor != null && factor !== '' ? Number(factor) || factor : null,
        barCode: String(barCode || ''),
      });
    });
  });

  if (result.length) {
    return dedupeUnits(result);
  }

  const fallbackUnitCode =
    product.sale_unit ||
    product.unidade_venda ||
    product.unit ||
    product.unidade ||
    product.um ||
    'UN';

  const fallbackUnitName =
    product.sale_unit_name ||
    product.unit_name ||
    product.nome_unidade ||
    fallbackUnitCode ||
    'UN';

  const fallbackBarCode =
    product.bar_code ||
    product.barcode ||
    product.ean ||
    product.codigo_barras ||
    product.gtin ||
    '';

  return [
    {
      unitCode: String(fallbackUnitCode || 'UN'),
      unitName: String(fallbackUnitName || fallbackUnitCode || 'UN'),
      unitLabel: formatUnitLabel({
        unitCode: String(fallbackUnitCode || 'UN'),
        unitName: String(fallbackUnitName || fallbackUnitCode || 'UN'),
        factor: null,
      }),
      factor: null,
      barCode: String(fallbackBarCode || ''),
    },
  ];
}

function dedupeUnits(list) {
  const map = new Map();

  list.forEach((u, index) => {
    const key = [
      String(u.unitCode || '').trim().toUpperCase(),
      String(u.unitName || '').trim().toUpperCase(),
      String(u.barCode || '').trim(),
    ].join('|');

    if (!map.has(key)) {
      map.set(key, {
        unitCode: u.unitCode || `UN-${index + 1}`,
        unitName: u.unitName || u.unitCode || `UN-${index + 1}`,
        unitLabel:
          u.unitLabel ||
          formatUnitLabel({
            unitCode: u.unitCode,
            unitName: u.unitName,
            factor: u.factor,
          }),
        factor: u.factor ?? null,
        barCode: u.barCode || '',
      });
    }
  });

  return Array.from(map.values());
}

function formatUnitLabel({ unitCode, unitName, factor }) {
  const code = String(unitCode || '').trim();
  const name = String(unitName || '').trim();

  let label = code || name || 'UN';

  if (name && name.toUpperCase() !== label.toUpperCase()) {
    label += ` - ${name}`;
  }

  if (factor != null && factor !== '' && Number(factor) > 0) {
    label += ` (${factor})`;
  }

  return label;
}

function buildUnitKey(unit, index = 0) {
  return `${String(unit?.unitCode || 'UN')}__${String(unit?.barCode || '')}__${index}`;
}

function getSelectedUnit(item) {
  if (!item || !Array.isArray(item.units) || !item.units.length) return null;

  const found = item.units.find(
    (u, index) => String(buildUnitKey(u, index)) === String(item.selectedUnitKey),
  );

  return found || item.units[0];
}

function mergeManualItem(normalized) {
  const existing = manualItems.find((item) => {
    const a = getSelectedUnit(item);
    const b = getSelectedUnit(normalized);

    return (
      String(item.productCode || '') === String(normalized.productCode || '') &&
      String(a?.unitCode || '') === String(b?.unitCode || '') &&
      String(a?.barCode || '') === String(b?.barCode || '')
    );
  });

  if (existing) {
    existing.labelsPerProduct += Number(normalized.labelsPerProduct || 1);
    existing.salePrice = normalized.salePrice ?? existing.salePrice;
    existing.description = normalized.description || existing.description;

    if ((!existing.units || !existing.units.length) && normalized.units?.length) {
      existing.units = normalized.units;
      existing.selectedUnitKey = normalized.selectedUnitKey;
      existing.barCode = normalized.barCode;
    }

    return;
  }

  manualItems.push(normalized);
}

function syncSearchDisplay() {
  const input = $('#labelsQuery');
  const mode = String($('#labelsMode')?.value || 'ALL').toUpperCase();
  if (!input) return;
  if (mode !== 'SEARCH') return;

  if (!manualItems.length) {
    input.value = '';
    input.placeholder = 'Clique em “Buscar produto” para selecionar…';
    return;
  }

  if (manualItems.length === 1) {
    const item = manualItems[0];
    const unit = getSelectedUnit(item);
    input.value = `${item.productCode || ''} — ${item.description || ''}${unit?.unitCode ? ` — ${unit.unitCode}` : ''}`.trim();
    return;
  }

  input.value = `${manualItems.length} produto(s) selecionado(s)`;
}

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function triggerBrowserDownload(objectUrl, fileName) {
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName || 'labels.pdf';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function extractFilenameFromContentDisposition(contentDisposition = '') {
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/["']/g, '').trim();
  }

  const asciiMatch =
    contentDisposition.match(/filename\s*=\s*"([^"]+)"/i) ||
    contentDisposition.match(/filename\s*=\s*([^;]+)/i);

  if (asciiMatch?.[1]) {
    return asciiMatch[1].replace(/["']/g, '').trim();
  }

  return null;
}

function buildDefaultLabelsFileName(uiPayload) {
  const template = String(uiPayload?.templateSlug || 'labels')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .toLowerCase();

  const dt = new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');

  return `labels_${template}_${yyyy}${mm}${dd}_${hh}${mi}${ss}.pdf`;
}

function countTotalLabelsFromManualItems(uiPayload) {
  if (manualItems.length) {
    return manualItems.reduce((sum, item) => {
      const qty = Number(item.labelsPerProduct || 1);
      return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
    }, 0);
  }

  return Number(uiPayload?.labelsPerProduct || 1);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}