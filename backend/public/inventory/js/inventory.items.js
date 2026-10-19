// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.items.js — Itens (produto, unidade, localização, lotes)     ║
// ║ PRODNEX ERP | Inventário                                              ║
// ║ ✅ LOTES: para Inventário, usa /by-product-code (preferencial)        ║
// ║ ✅ LOTES: fallback por stock_id usa /options (inclui lotes zerados)   ║
// ║ ✅ SKU: normaliza SKU numérico p/ 10 dígitos (padStart)               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

import { apiGet, apiPost, apiDelete } from './inventory.api.js';
import {
  INVENTORY_API_BASE,
  API_BASE,
  PRODUCTS_UNITS_API_BASE,
  PRODUCTS_LOCATIONS_API_BASE,
  PRODUCTS_STOCK_LOTS_API_BASE,
  PRODUCTS_STOCK_API_BASE,
  log,
  logError,
  DEBUG,
} from './inventory.config.js';

import { state } from './inventory.state.js';
import {
  toNumOrNull,
  isNumericId,
  normalizeUnitText,
  isBarcodeLike,
  focusProductField,
  focusCountedQty,
  fmtQty3,
  fmtDatePt,
} from './inventory.utils.js';

/* ──────────────────────────────────────────────────────────────
   Helpers gerais
────────────────────────────────────────────────────────────── */
function getCurrentInventoryId() {
  const raw =
    state.currentInventory?.inventory_id ??
    state.currentInventory?.id ??
    state.currentInventory?.inventoryId ??
    state.currentInventory?.inventoryID ??
    null;

  return isNumericId(raw) ? parseInt(String(raw), 10) : null;
}

function normalizeSku10(v) {
  // SKU "normal" — não adiciona zeros
  return String(v ?? '').trim();
}

function safeJsonTextToRows(text) {
  if (!text) return [];
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

/* ──────────────────────────────────────────────────────────────
   UI helpers
────────────────────────────────────────────────────────────── */
function getItemProductHiddenEl(els) {
  return els.itemProductCodeValue || document.getElementById('itemProductCodeValue');
}

function setItemProductName(els, text) {
  if (!els.itemProductNameEl) return;
  els.itemProductNameEl.textContent = text || '';
}

export function clearUnitSelect(els) {
  const el = els.itemUnit;
  if (!el) return;
  if (el.tagName === 'SELECT') el.innerHTML = '<option value="">Selecione...</option>';
  else el.value = '';
}

export function clearLocationField(els) {
  if (!els.itemLocation) return;
  if (els.itemLocation.tagName === 'SELECT') els.itemLocation.innerHTML = '<option value="">Selecione...</option>';
  else els.itemLocation.value = '';
  if (els.itemLocationValue) els.itemLocationValue.value = '';
}

/* ──────────────────────────────────────────────────────────────
   ✅ LOTES helpers
────────────────────────────────────────────────────────────── */
export function clearLotSelect(els) {
  if (!els.lotSelect) return;
  els.lotSelect.innerHTML = `<option value="">Selecione o lote...</option>`;
  els.lotSelect.disabled = true;
  if (els.lotHint) els.lotHint.textContent = '';
}

function getLotIdFromUI(els) {
  const v = String(els.lotSelect?.value || '').trim();
  return isNumericId(v) ? parseInt(v, 10) : null;
}

export function updateLotHintFromSelectedOption(els) {
  if (!els.lotHint) return;
  if (!els.lotSelect) { els.lotHint.textContent = ''; return; }

  const v = String(els.lotSelect.value || '').trim();
  if (!v) { els.lotHint.textContent = ''; return; }

  const opt = els.lotSelect.options?.[els.lotSelect.selectedIndex];
  const txt = String(opt?.textContent || '').trim();
  els.lotHint.textContent = txt || '';
}

async function loadLotsByProductCode(productCode) {
  const sku = normalizeSku10(productCode);
  if (!sku) return [];

  if (state.__lotsBySkuCache.has(sku)) return state.__lotsBySkuCache.get(sku) || [];

  try { state.__lotsAbort?.abort(); } catch { }
  state.__lotsAbort = new AbortController();

  // preferencial: /by-product-code (no seu API não filtra disponível)
  const url = `${PRODUCTS_STOCK_LOTS_API_BASE}/by-product-code/${encodeURIComponent(sku)}`;
  log('[lots] GET by-product-code', url);

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    signal: state.__lotsAbort.signal,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${text}`);

  const rows = safeJsonTextToRows(text);

  state.__lotsBySkuCache.set(sku, rows);
  return rows;
}

async function resolveProductStockIdBySku(productCode) {
  const sku = normalizeSku10(productCode);
  if (!sku) return null;

  if (state.__productStockIdBySkuCache.has(sku)) return state.__productStockIdBySkuCache.get(sku);

  const tryGetIdFromRow = (row) => {
    const v = row?.product_stock_id ?? row?.productStockId ?? row?.id ?? row?.product_stock?.product_stock_id ?? null;
    return (v != null && isNumericId(v)) ? Number(v) : (Number.isFinite(Number(v)) ? Number(v) : null);
  };

  const candidates = [
    `${PRODUCTS_STOCK_API_BASE}/by-code?product_code=${encodeURIComponent(sku)}`,
    `${PRODUCTS_STOCK_API_BASE}?product_code=${encodeURIComponent(sku)}&limit=1&offset=0`,
    `${PRODUCTS_STOCK_API_BASE}?search=${encodeURIComponent(sku)}&limit=1&offset=0`,
  ];

  for (const url of candidates) {
    try {
      const data = await apiGet(url);

      let id = tryGetIdFromRow(data);
      if (id) { state.__productStockIdBySkuCache.set(sku, id); return id; }

      const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      if (rows.length) {
        id = tryGetIdFromRow(rows[0]);
        if (id) { state.__productStockIdBySkuCache.set(sku, id); return id; }
      }
    } catch (e) {
      if (DEBUG) log('[lots] resolveProductStockIdBySku failed on', url, e?.message || e);
    }
  }

  state.__productStockIdBySkuCache.set(sku, null);
  return null;
}

async function loadAndPopulateLotsByProductStockId(els, product_stock_id) {
  if (!els.lotSelect) return;

  try { state.__lotsAbort?.abort(); } catch { }
  state.__lotsAbort = new AbortController();

  els.lotSelect.disabled = true;
  els.lotSelect.innerHTML = `<option value="">Carregando lotes...</option>`;
  if (els.lotHint) els.lotHint.textContent = '';

  if (!product_stock_id || !Number.isFinite(Number(product_stock_id))) {
    clearLotSelect(els);
    return;
  }

  if (state.__lotsByStockIdCache.has(product_stock_id)) {
    const cached = state.__lotsByStockIdCache.get(product_stock_id) || [];
    populateLotsSelect(els, cached);
    return;
  }

  // ✅ Inventário precisa listar lotes mesmo zerados → /options (não /available)
  const url = `${PRODUCTS_STOCK_LOTS_API_BASE}/options?product_stock_id=${encodeURIComponent(product_stock_id)}`;
  log('[lots] GET options', url);

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    signal: state.__lotsAbort.signal,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${text}`);

  const rows = safeJsonTextToRows(text);

  state.__lotsByStockIdCache.set(product_stock_id, rows);
  populateLotsSelect(els, rows);
}

function populateLotsSelect(els, lotsRows) {
  if (!els.lotSelect) return;

  const rows = Array.isArray(lotsRows) ? lotsRows : [];

  if (!rows.length) {
    els.lotSelect.innerHTML = `<option value="">Sem lotes</option>`;
    els.lotSelect.disabled = true;
    if (els.lotHint) els.lotHint.textContent = '';
    return;
  }

  els.lotSelect.innerHTML =
    `<option value="">Selecione o lote...</option>` +
    rows.map((l) => {
      const lotId = l.lot_id ?? l.id ?? null;
      if (lotId == null) return '';

      const lotCode = l.lot_code ?? l.code ?? 'SEM LOTE';
      const exp = fmtDatePt(l.expires_at) || '—';

      const avail =
        l.qty_available != null
          ? fmtQty3(l.qty_available)
          : fmtQty3(Number(l.qty_on_hand || 0) - Number(l.qty_reserved || 0));

      return `<option value="${lotId}">${lotCode} • Val: ${exp} • Disp: ${avail}</option>`;
    }).join('');

  els.lotSelect.disabled = false;
  if (els.lotHint) els.lotHint.textContent = '';
}

export async function loadAndPopulateLotsForSku(els, productCode) {
  const sku = normalizeSku10(productCode);
  if (!sku) { clearLotSelect(els); return; }

  // 1) preferencial: /by-product-code
  try {
    els.lotSelect && (els.lotSelect.disabled = true);
    els.lotSelect && (els.lotSelect.innerHTML = `<option value="">Carregando lotes...</option>`);
    if (els.lotHint) els.lotHint.textContent = '';

    const rows = await loadLotsByProductCode(sku);
    populateLotsSelect(els, rows);
    return;
  } catch (e) {
    if (DEBUG) log('[lots] by-product-code failed, fallback to stock_id:', e?.message || e);
  }

  // 2) fallback: resolve stock_id e /options
  const stockId = await resolveProductStockIdBySku(sku);
  if (!stockId) {
    clearLotSelect(els);
    if (els.lotHint) els.lotHint.textContent = 'Não foi possível localizar lotes para este SKU.';
    return;
  }
  await loadAndPopulateLotsByProductStockId(els, stockId);
}

/* ──────────────────────────────────────────────────────────────
   Units
────────────────────────────────────────────────────────────── */
function setUnitSelectByLabel(els, unitLabel) {
  const el = els.itemUnit;
  if (!el) return false;

  const wanted = normalizeUnitText(unitLabel);
  if (!wanted) return false;

  if (el.tagName !== 'SELECT') {
    el.value = unitLabel;
    return true;
  }

  const opt = Array.from(el.options).find((o) => {
    const datasetUnit = normalizeUnitText(o.dataset?.unit);
    const textUnit = normalizeUnitText(o.textContent);
    return datasetUnit === wanted || textUnit.startsWith(wanted);
  });

  if (opt) {
    el.value = opt.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

export async function loadAndPopulateUnitsForProduct(els, productCode) {
  try {
    if (!els.itemUnit) return;

    const el = els.itemUnit;
    const code = normalizeSku10(productCode);

    if (!code) {
      clearUnitSelect(els);
      return;
    }

    const url = `${API_BASE}/api/barcodes/active-units?product_code=${encodeURIComponent(code)}`;

    log('[inventory][units] GET', url);

    const data = await apiGet(url);

    const rows = Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

    log('[inventory][units] product_code:', code, 'rows:', rows);

    if (el.tagName !== 'SELECT') {
      const stdRow = rows.find((u) => u.standard);
      el.value = stdRow?.unit || rows[0]?.unit || '';
      return;
    }

    el.innerHTML = '';

    const optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = 'Selecione...';
    el.appendChild(optEmpty);

    let selectedValue = '';

    rows.forEach((u) => {
      const productUnitId =
        u.product_unit_id ??
        u.productUnitId ??
        u.id ??
        u.productUnitID ??
        u.unit_id ??
        u.unitId ??
        null;

      const unit = u.unit || '';
      const desc = u.unit_description || u.description || '';
      const fator = Number(u.fator ?? u.factor ?? u.unit_factor ?? 1) || 1;
      const std = !!u.standard;

      const fatorText =
        fator !== 1
          ? ` • Fator ${fator.toLocaleString('pt-BR', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          })}`
          : '';

      const descText = desc ? ` — ${desc}` : '';
      const stdText = std ? ' (Padrão)' : '';

      const opt = document.createElement('option');

      opt.value = productUnitId != null ? String(productUnitId) : unit;
      opt.dataset.unit = unit;
      opt.dataset.fator = String(fator);
      opt.dataset.factor = String(fator);
      opt.dataset.barcodeId = u.barcode_id || '';
      opt.dataset.barcode = u.barcode || '';
      opt.dataset.productUnitId = productUnitId != null ? String(productUnitId) : '';
      opt.dataset.unitId = u.unit_id || '';

      opt.textContent = `${unit}${stdText}${descText}${fatorText}`;

      if (std && !selectedValue) {
        selectedValue = opt.value;
      }

      el.appendChild(opt);
    });

    if (selectedValue) {
      el.value = selectedValue;
    } else {
      const firstValid = Array.from(el.options).find((o) => String(o.value || '').trim());
      el.value = firstValid?.value || '';
    }

  } catch (err) {
    logError('Erro em loadAndPopulateUnitsForProduct:', err);
    clearUnitSelect(els);
  }
}

/* ──────────────────────────────────────────────────────────────
   Locations
────────────────────────────────────────────────────────────── */
function formatLocationRow(loc) {
  if (!loc) return '';
  const parts = [loc.corredor, loc.prateleira, loc.bandeja, loc.box]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  if (!parts.length) return (loc.observacao || '').trim();
  return parts.join(' / ');
}

async function getLocationById(locationId) {
  const id = Number(locationId);
  if (!Number.isFinite(id) || id <= 0) return null;

  if (state.__locByIdCache.has(id)) return state.__locByIdCache.get(id);

  try {
    const loc = await apiGet(`${PRODUCTS_LOCATIONS_API_BASE}/${id}`);
    state.__locByIdCache.set(id, loc || null);
    return loc || null;
  } catch {
    state.__locByIdCache.set(id, null);
    return null;
  }
}

async function getLocationsByProductCode(productCode) {
  const sku = normalizeSku10(productCode);
  if (!sku) return [];

  if (state.__locBySkuCache.has(sku)) return state.__locBySkuCache.get(sku);

  try {
    const params = new URLSearchParams();
    params.set('product_code', sku);
    params.set('onlyActive', 'true');
    params.set('limit', '50');
    params.set('offset', '0');

    const data = await apiGet(`${PRODUCTS_LOCATIONS_API_BASE}?${params.toString()}`);
    const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    state.__locBySkuCache.set(sku, rows);
    return rows;
  } catch {
    state.__locBySkuCache.set(sku, []);
    return [];
  }
}

async function getDefaultLocationForProduct(productCode) {
  const rows = await getLocationsByProductCode(productCode);
  return (
    rows.find((r) => r.is_default === true || r.default === true || r.principal === true) ||
    rows[0] ||
    null
  );
}

function setLocationIdHidden(els, id) {
  if (!els.itemLocationValue) return;
  els.itemLocationValue.value = (id != null && id !== '') ? String(id) : '';
}

function getLocationIdFromUI(els) {
  if (els.itemLocationValue && isNumericId(els.itemLocationValue.value)) {
    return parseInt(String(els.itemLocationValue.value).trim(), 10);
  }
  if (els.itemLocation?.tagName === 'SELECT') {
    const v = String(els.itemLocation.value || '').trim();
    return isNumericId(v) ? parseInt(v, 10) : null;
  }
  return null;
}

async function tryResolveLocationTextToIdBySku(els, productCode) {
  const sku = normalizeSku10(productCode);
  if (!sku) return null;
  const inputText = String(els.itemLocation?.value || '').trim();
  if (!inputText) return null;

  const rows = state.__locRowsLastLoaded.get(sku) || (await getLocationsByProductCode(sku));
  if (!rows?.length) return null;

  const wanted = inputText.toLowerCase();
  const found =
    rows.find((r) => formatLocationRow(r).toLowerCase() === wanted) ||
    rows.find((r) => formatLocationRow(r).toLowerCase().includes(wanted)) ||
    null;

  const id = found?.id ?? found?.product_location_id ?? found?.location_id ?? null;
  return (id != null && isNumericId(id)) ? Number(id) : (Number.isFinite(Number(id)) ? Number(id) : null);
}

export async function loadAndPopulateLocationsForProduct(els, productCode) {
  try {
    const el = els.itemLocation;
    if (!el) return;

    const sku = normalizeSku10(productCode);
    if (!sku) {
      clearLocationField(els);
      return;
    }

    const rowsRaw = await getLocationsByProductCode(sku);

    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

    console.log('[INVENTORY][LOCATIONS][RAW]', sku, rows);

    const activeRows = rows.filter((r) => {
      const v = r.is_active ?? r.active ?? r.ativo;
      return v === true || v === 'true' || v === 1 || v === '1' || v == null;
    });

    console.log('[INVENTORY][LOCATIONS][ACTIVE]', activeRows);

    state.__locRowsLastLoaded.set(sku, activeRows);

    const preferred =
      activeRows.find((r) => r.is_default === true || r.default === true || r.principal === true) ||
      activeRows[0] ||
      null;

    const preferredId =
      preferred?.id ??
      preferred?.product_location_id ??
      preferred?.location_id ??
      null;

    el.innerHTML = '';

    const optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = activeRows.length
      ? (activeRows.length === 1 ? 'Localização' : 'Localização (pré-selecionada)')
      : 'Sem localização';
    el.appendChild(optEmpty);

    activeRows.forEach((loc) => {
      const locId = loc.id ?? loc.product_location_id ?? loc.location_id ?? null;
      if (locId == null) return;

      const opt = document.createElement('option');
      opt.value = String(locId);
      opt.textContent = formatLocationRow(loc);
      el.appendChild(opt);
    });

    el.value = preferredId != null ? String(preferredId) : '';
    setLocationIdHidden(els, preferredId != null ? preferredId : '');

    console.log('[INVENTORY][LOCATIONS][SELECTED]', {
      preferredId,
      selectedText: el.options[el.selectedIndex]?.textContent,
      selectedValue: el.value,
    });
  } catch (e) {
    logError('loadAndPopulateLocationsForProduct:', e);
  }
}

/* ──────────────────────────────────────────────────────────────
   Product selected (display + hidden sku)
────────────────────────────────────────────────────────────── */
export async function setItemProductDisplayAndCode(els, code, name) {
  const sku = normalizeSku10(code);

  const display = [sku, name].filter(Boolean).join(' - ');

  if (els.itemProductCode) {
    els.itemProductCode.value = display || '';
  }

  const hidden = getItemProductHiddenEl(els);
  if (hidden) {
    hidden.value = sku || '';
  }

  setItemProductName(els, name || '');

  clearLotSelect(els);

  if (!sku) {
    clearUnitSelect(els);
    clearLocationField(els);
    return;
  }

  state.__lotsBySkuCache.delete(sku);
  state.__productStockIdBySkuCache.delete(sku);

  await loadAndPopulateUnitsForProduct(els, sku);
  await loadAndPopulateLocationsForProduct(els, sku);
  await loadAndPopulateLotsForSku(els, sku);
}

export function clearItemProduct(els) {
  if (els.itemProductCode) {
    els.itemProductCode.value = '';
  }

  const hidden = getItemProductHiddenEl(els);
  if (hidden) {
    hidden.value = '';
  }

  setItemProductName(els, '');

  clearUnitSelect(els);
  clearLocationField(els);
  clearLotSelect(els);
}

/* ──────────────────────────────────────────────────────────────
   Items: load + hydrate + render
────────────────────────────────────────────────────────────── */
export async function loadItems(els) {
  try {
    if (!state.currentInventory?.inventory_id) {
      state.items = [];
      renderItemsTable(els);
      return;
    }

    const data = await apiGet(`${INVENTORY_API_BASE}/${state.currentInventory.inventory_id}/items`);
    state.items = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];

    await hydrateItemsLocations(state.items);
    renderItemsTable(els);
  } catch (err) {
    logError('Erro em loadItems:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao carregar itens', message: String(err.message || err) });
  }
}

async function hydrateItemsLocations(itemsArr) {
  if (!Array.isArray(itemsArr) || !itemsArr.length) return;

  const tasks = itemsArr.map(async (it) => {
    const hasName = String(it.location_name || '').trim();
    if (hasName) return;

    const locId = it.product_location_id ?? it.location_id ?? null;
    if (locId != null) {
      const loc = await getLocationById(locId);
      if (loc) { it.location_name = formatLocationRow(loc); return; }
    }

    const sku = it.product_code ?? it.sku ?? null;
    if (sku) {
      const def = await getDefaultLocationForProduct(sku);
      if (def) it.location_name = formatLocationRow(def);
    }
  });

  await Promise.all(tasks);
}

function renderStatusBadge(status) {
  const s = (status || '').toUpperCase();
  if (s === 'COUNTED') return `<span class="badge badge--counted">Contado</span>`;
  if (s === 'ADJUSTED') return `<span class="badge badge--adjusted">Ajustado</span>`;
  if (s === 'PENDING') return `<span class="badge badge--pending">Pendente</span>`;
  return s || '';
}

function getItemFactor(item = {}) {
  const factor = Number(
    item.fator ??
    item.factor ??
    item.unit_factor ??
    item.product_unit_factor ??
    1
  );

  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function getItemTotalQty(item = {}) {
  const backendTotal = Number(item.total_qty);

  if (Number.isFinite(backendTotal)) {
    return backendTotal;
  }

  const counted = Number(item.counted_qty ?? 0);
  const factor = getItemFactor(item);

  return Number.isFinite(counted) ? counted * factor : 0;
}

export function renderItemsTable(els) {
  const tbody = els.itemsTbody;
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!state.items || !state.items.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="10" style="text-align:center; padding:10px; opacity:.6;">Nenhum item.</td>`;
    tbody.appendChild(tr);
    return;
  }

  state.items.forEach((item) => {
    const productNameShown = item.product_name || item.description || '';

    const systemQty = Number(item.system_stock_qty ?? 0);
    const countedQty = item.counted_qty != null ? Number(item.counted_qty) : null;
    const totalQty = getItemTotalQty(item);
    const differenceQty = totalQty - systemQty;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.product_code ?? ''}</td>
      <td>${productNameShown}</td>
      <td>${item.unit ?? ''}</td>
      <td data-feature="PRODUCT_LOCATIONS">${item.location_name ?? ''}</td>
      <td class="col-number">${fmtQty3(systemQty)}</td>
      <td class="col-number">${countedQty != null ? fmtQty3(countedQty) : ''}</td>
      <td class="col-number"><strong>${fmtQty3(totalQty)}</strong></td>
      <td class="col-number">${fmtQty3(differenceQty)}</td>
      <td>${renderStatusBadge(item.status)}</td>
<td class="col-actions">
  <div class="inventory-actions-icons">

    <span
      class="inventory-edit-icon js-edit-item"
      data-id="${item.inventory_item_id}"
      title="Editar item"
    >
      ✏️
    </span>

    <span
      class="inventory-delete-icon js-delete-item"
      data-id="${item.inventory_item_id}"
      title="Excluir item"
    >
      🗑️
    </span>

  </div>
</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ──────────────────────────────────────────────────────────────
   Items: save (✅ envia unit_id/location_id corretamente + lot_id)
────────────────────────────────────────────────────────────── */
export async function saveItem(els) {
  let productCode = '';

  try {
    if (state.__isSavingItem) return;
    state.__isSavingItem = true;

    if (!state.currentInventory?.inventory_id) {
      showCenterModal({ variant: 'warning', title: 'Selecione um inventário', message: 'Selecione um inventário antes de adicionar itens.' });
      return;
    }

    const hidden = getItemProductHiddenEl(els);
    productCode = normalizeSku10((hidden?.value || '').trim() || (els.itemProductCode?.value || '').trim());

    if (!productCode) {
      showCenterModal({ variant: 'warning', title: 'Produto obrigatório', message: 'Informe ou selecione um produto para o item.' });
      return;
    }

    const counted_qty = toNumOrNull(els.itemCountedQty?.value);
    if (counted_qty == null) {
      showCenterModal({ variant: 'warning', title: 'Quantidade obrigatória', message: 'Informe a quantidade contada para salvar o item.' });
      return;
    }

    const notes = els.itemNotes ? (els.itemNotes.value || null) : null;

    let product_unit_id = null;
    if (els.itemUnit?.tagName === 'SELECT') {
      const v = String(els.itemUnit.value || '').trim();
      product_unit_id = isNumericId(v) ? parseInt(v, 10) : null;
    }

    let product_location_id = getLocationIdFromUI(els);

    if (!product_location_id && els.itemLocation && els.itemLocation.tagName !== 'SELECT') {
      product_location_id = await tryResolveLocationTextToIdBySku(els, productCode);
      if (product_location_id) setLocationIdHidden(els, product_location_id);
    }

    if (!product_location_id) {
      const def = await getDefaultLocationForProduct(productCode);
      const defId = def?.id ?? def?.product_location_id ?? def?.location_id ?? null;

      if (defId != null) {
        product_location_id = Number(defId);
        if (els.itemLocation?.tagName === 'SELECT') els.itemLocation.value = String(defId);
        else {
          els.itemLocation.value = formatLocationRow(def);
          setLocationIdHidden(els, defId);
        }
      }
    }

    const lot_id = getLotIdFromUI(els);

    // ✅ Se o select de lote está habilitado e tem opções -> lote é obrigatório
    const lotSelectEnabled = !!els.lotSelect && !els.lotSelect.disabled;
    const hasLotOptions =
      lotSelectEnabled &&
      Array.from(els.lotSelect.options || []).some((o) => String(o.value || '').trim() !== '');

    if (lotSelectEnabled && hasLotOptions && !lot_id) {
      showCenterModal({
        variant: 'warning',
        title: 'Lote obrigatório',
        message: 'Selecione o lote/validade antes de salvar o item.',
      });
      try { els.lotSelect.focus(); } catch { }
      return;
    }

    if (lot_id && els.lotSelect) {
      const selectedOpt = els.lotSelect.options[els.lotSelect.selectedIndex];

      if (!selectedOpt || String(selectedOpt.value) !== String(lot_id)) {
        showCenterModal({
          variant: 'warning',
          title: 'Lote inválido',
          message: 'O lote selecionado não pertence ao produto atual. Selecione o lote novamente.',
        });
        clearLotSelect(els);
        await loadAndPopulateLotsForSku(els, productCode);
        try { els.lotSelect.focus(); } catch { }
        return;
      }
    }

    const payload = {
      product_code: productCode,
      counted_qty,
      product_unit_id,
      product_location_id,
      lot_id, // pode ser null
      notes,
    };

    log('SAVE ITEM PAYLOAD', payload);

    const url = `${INVENTORY_API_BASE}/${state.currentInventory.inventory_id}/items`;
    await apiPost(url, payload);

    clearItemProduct(els);
    clearUnitSelect(els);
    clearLocationField(els);
    clearLotSelect(els);
    if (els.itemCountedQty) els.itemCountedQty.value = '';
    if (els.itemNotes) els.itemNotes.value = '';

    await loadItems(els);
    focusProductField(els);
  } catch (err) {
    logError('Erro em saveItem:', err);

    // tenta exibir o erro retornado pela API se vier em JSON
    let msg = String(err?.message || err);
    try {
      const s = String(err?.responseText || err?.body || '');
      if (s && s.trim().startsWith('{')) {
        const j = JSON.parse(s);
        msg = j?.error || j?.message || msg;
        if (j?.pg?.detail) msg += `\n\nPG: ${j.pg.detail}`;
      }
    } catch { }

    showCenterModal({ variant: 'error', title: 'Erro ao salvar item', message: msg });
  } finally {
    state.__isSavingItem = false;
  }
}

export async function deleteItem(els, inventoryItemId) {
  try {
    if (!state.currentInventory?.inventory_id) {
      showCenterModal({ variant: 'warning', title: 'Selecione um inventário', message: 'Selecione um inventário antes de excluir itens.' });
      return;
    }

    const invId = state.currentInventory.inventory_id;
    await apiDelete(`${INVENTORY_API_BASE}/${invId}/items/${inventoryItemId}`);
    await loadItems(els);
  } catch (err) {
    logError('Erro em deleteItem:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao excluir item', message: String(err.message || err) });
  }
}

/* ──────────────────────────────────────────────────────────────
   Products Modal Search
────────────────────────────────────────────────────────────── */
export function openProductSearchModal(els) {
  try {
    openProductsModalSearch({
      apiBase: API_BASE,
      async onPick(product) {
        try {
          const code = normalizeSku10(
            product.product_code ??
            product.sku ??
            product.code ??
            product.product_id ??
            ''
          );

          const name =
            product.description ??
            product.product_name ??
            product.nome ??
            product.name ??
            '';

          const unitInicial =
            product.unit ??
            product.unidade ??
            product.product_unit ??
            '';

          const sku = String(code || '').trim();

          await setItemProductDisplayAndCode(els, sku, name || '');

          // ✅ força foco no lote após o modal fechar e após renderizar o select
          setTimeout(() => {
            if (els.lotSelect && !els.lotSelect.disabled) {
              els.lotSelect.focus();
              try { els.lotSelect.click(); } catch { }
            } else {
              focusCountedQty(els);
            }
          }, 150);

        } catch (err) {
          logError('Erro no callback onPick do modal de produtos:', err);
        }
      },
    });
  } catch (err) {
    logError('Erro ao abrir modal de produtos:', err);
  }
}

/* ──────────────────────────────────────────────────────────────
   Barcode -> product-unit
────────────────────────────────────────────────────────────── */
async function findProductUnitByBarcode(barcode) {
  try {
    if (!barcode) return null;
    const params = new URLSearchParams();
    params.set('barcode', barcode);

    const url = `${API_BASE}/api/barcodes/resolve?${params.toString()}`;
    const data = await apiGet(url);

    if (!data) return null;
    if (Array.isArray(data?.rows) && data.rows.length) return data.rows[0];
    return data;
  } catch (err) {
    logError('Erro em findProductUnitByBarcode:', err);
    return null;
  }
}

export async function importProductFromBarcode(els, barcode) {
  const pu = await findProductUnitByBarcode(barcode);

  if (!pu) {
    showCenterModal({
      variant: 'warning',
      title: 'Barcode não encontrado',
      message: `Nenhuma unidade encontrada para o código: ${barcode}`,
    });
    return false;
  }

  const sku = normalizeSku10(String(pu.product_code || '').trim());
  const unitFromBarcode = String(pu.unit || '').trim();
  const unitIdFromBarcode = pu.product_unit_id != null ? String(pu.product_unit_id) : '';

  if (!sku) {
    showCenterModal({ variant: 'error', title: 'Resposta inválida', message: 'A API de barcode não retornou o product_code (SKU).' });
    return false;
  }

  await setItemProductDisplayAndCode(els, sku, '');
  await loadAndPopulateUnitsForProduct(els, sku);
  await loadAndPopulateLocationsForProduct(els, sku);
  await loadAndPopulateLotsForSku(els, sku);

  if (els.itemUnit?.tagName === 'SELECT') {
    if (unitIdFromBarcode && isNumericId(unitIdFromBarcode)) els.itemUnit.value = unitIdFromBarcode;
    else if (unitFromBarcode) setUnitSelectByLabel(els, unitFromBarcode);
  } else if (els.itemUnit) {
    els.itemUnit.value = unitFromBarcode || '';
  }

  focusCountedQty(els);
  return true;
}

/* ──────────────────────────────────────────────────────────────
   Field event helpers
────────────────────────────────────────────────────────────── */
export function bindItemsFieldEvents(els) {
  // ✅ FIX: change no SELECT de localização -> espelha no hidden
  els.itemLocation?.addEventListener?.('change', () => {
    if (!els.itemLocation) return;
    if (els.itemLocation.tagName === 'SELECT') {
      const v = String(els.itemLocation.value || '').trim();
      setLocationIdHidden(els, isNumericId(v) ? v : '');
    }
  });

  // ✅ LOTES: ao escolher lote -> hint
  els.lotSelect?.addEventListener?.('change', () => {
    updateLotHintFromSelectedOption(els);
  });

  // (Opcional) recarregar lotes ao trocar unidade (mantive igual ao seu)
  els.itemUnit?.addEventListener?.('change', async () => {
    try {
      const hidden = getItemProductHiddenEl(els);
      const sku = normalizeSku10((hidden?.value || '').trim());
      if (!sku) { clearLotSelect(els); return; }
      state.__lotsBySkuCache.delete(sku);
      state.__productStockIdBySkuCache.delete(sku);
      await loadAndPopulateLotsForSku(els, sku);
      updateLotHintFromSelectedOption(els);
    } catch (e) {
      if (DEBUG) log('[lots] reload on unit change failed:', e?.message || e);
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   Keyboard enter behaviors for item fields
────────────────────────────────────────────────────────────── */
export function bindItemsKeyboard(els, { onSaveItem }) {
  els.itemCountedQty?.addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); await onSaveItem(); }
  });

  els.itemProductCode?.addEventListener('keydown', async (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();

    const typedRaw = (els.itemProductCode?.value || '').trim();
    const typed = normalizeSku10(typedRaw);

    if (isBarcodeLike(typedRaw)) {
      const ok = await importProductFromBarcode(els, typedRaw);
      if (!ok) {
        showCenterModal({
          variant: 'warning',
          title: 'Barcode não encontrado',
          message: `Nenhum produto encontrado para o código: ${typedRaw}`,
        });
        focusProductField(els);
      }
      return;
    }

    // se digitou SKU, abre modal (padrão do seu fluxo)
    // (o SKU real fica no hidden após escolher no modal)
    openProductSearchModal(els);
  });
}

/* ──────────────────────────────────────────────────────────────
   Actions Icons (✏️ / 🗑️)
────────────────────────────────────────────────────────────── */
export function bindItemsTableActions(els) {
  if (!els.itemsTbody) return;

  els.itemsTbody.addEventListener('click', async (ev) => {
    // ✏️ EDITAR
    const editIcon = ev.target.closest('.js-edit-item');

    if (editIcon) {
      const itemId = Number(editIcon.dataset.id);

      const item = state.items.find(
        (i) => Number(i.inventory_item_id) === itemId
      );

      if (!item) return;

      console.log('[INVENTORY][EDIT ITEM]', item);

      await setItemProductDisplayAndCode(
        els,
        item.product_code,
        item.product_name || item.description || ''
      );

      // Unidade
      if (els.itemUnit?.tagName === 'SELECT') {
        const unitId =
          item.product_unit_id ??
          item.unit_id ??
          null;

        if (unitId) {
          els.itemUnit.value = String(unitId);
        }
      }

      // Localização
      if (els.itemLocation?.tagName === 'SELECT') {
        const locationId =
          item.product_location_id ??
          item.location_id ??
          null;

        if (locationId) {
          els.itemLocation.value = String(locationId);

          if (els.itemLocationValue) {
            els.itemLocationValue.value = String(locationId);
          }

          els.itemLocation.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Lote / Validade
      const lotId =
        item.lot_id ??
        item.product_stock_lot_id ??
        item.stock_lot_id ??
        item.productStockLotId ??
        null;

      if (els.lotSelect && lotId) {
        const lotIdStr = String(lotId);

        const exists = Array.from(els.lotSelect.options || []).some(
          (opt) => String(opt.value) === lotIdStr
        );

        if (exists) {
          els.lotSelect.value = lotIdStr;
          els.lotSelect.dispatchEvent(new Event('change', { bubbles: true }));
          updateLotHintFromSelectedOption(els);
        } else {
          console.warn('[INVENTORY][EDIT ITEM] Lote não encontrado no select:', {
            lotId,
            options: Array.from(els.lotSelect.options || []).map((opt) => ({
              value: opt.value,
              text: opt.textContent,
            })),
          });
        }
      }

      // Quantidade contada
      if (els.itemCountedQty) {
        els.itemCountedQty.value = item.counted_qty ?? '';
      }

      // Foco
      if (els.lotSelect && !els.lotSelect.disabled && !els.lotSelect.value) {
        els.lotSelect.focus();
      } else {
        focusCountedQty(els);
      }

      return;
    }

    // 🗑️ EXCLUIR
    const deleteIcon = ev.target.closest('.js-delete-item');

    if (deleteIcon) {
      const itemId = Number(deleteIcon.dataset.id);

      const ok = confirm(
        'Deseja realmente excluir este item do inventário?'
      );

      if (!ok) return;

      await deleteItem(els, itemId);
    }
  });
}