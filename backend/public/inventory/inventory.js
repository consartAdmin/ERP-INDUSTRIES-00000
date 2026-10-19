// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.js — Front do módulo de Inventário — PRODNEX ERP           ║
// ║ Path: /public/inventory/inventory.js                                 ║
// ║ Integra com: /api/inventories + productsModalSearch.js +             ║
// ║            /api/products-units + /api/products-locations             ║
// ║ ✅ Finalizar com senha (MODAL -> backend valida)                     ║
// ║ ✅ Estornar estoque (reabrir inventário) com senha (MODAL)           ║
// ║ ✅ Produto no input: "CÓDIGO - NOME" (e salva o código real hidden)  ║
// ║ ✅ LISTA: 2ª coluna exibe OBSERVAÇÕES (notes)                        ║
// ║ ✅ FIX: tudo usando product_code (SKU) — sem product_id              ║
// ║ ✅ FIX CRÍTICO: salva item com product_unit_id / product_location_id ║
// ║      (INTEGER) — nunca mais manda "1.00" em coluna integer          ║
// ║ ✅ FIX: localização pré-carrega por SKU + fallback default no salvar ║
// ║ ✅ FIX CRÍTICO #2: garante envio da localização escolhida (id hidden ║
// ║      quando o campo não é <select>)                                  ║
// ║ ✅ NOVO: LOTES (productsStockLots) -> popula lotSelect + envia lot_id ║
// ║ ✅ FIX LOTES: carrega lotes por product_code (SKU) primeiro,         ║
// ║              sem precisar resolver product_stock_id.                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

/* ──────────────────────────────────────────────────────────────
   Logs
────────────────────────────────────────────────────────────── */
const DEBUG = true;
function log(...args) { if (DEBUG) console.log('[INVENTORY]', ...args); }
function logError(...args) { console.error('[INVENTORY][ERROR]', ...args); }

/* ──────────────────────────────────────────────────────────────
   API base
────────────────────────────────────────────────────────────── */
function getApiBaseSafe() {
  try { if (typeof window.getApiBase === 'function') return window.getApiBase(); } catch { }
  return window.API_BASE || window.apiBase || 'http://localhost:8080';
}
const rawBase = getApiBaseSafe();
const API_BASE = String(rawBase || '').replace(/\/$/, '');

const INVENTORY_API_BASE = `${API_BASE}/api/inventories`;
const PRODUCTS_UNITS_API_BASE = `${API_BASE}/api/products-units`;
const PRODUCTS_LOCATIONS_API_BASE = `${API_BASE}/api/products-locations`;

/** ✅ LOTES */
const PRODUCTS_STOCK_LOTS_API_BASE = `${API_BASE}/api/productsStockLots`;
const PRODUCTS_STOCK_API_BASE = `${API_BASE}/api/productsStock`; // fallback para resolver product_stock_id por SKU

log('Init config');
log('apiBase:', rawBase);
log('INVENTORY_API_BASE:', INVENTORY_API_BASE);
log('PRODUCTS_UNITS_API_BASE:', PRODUCTS_UNITS_API_BASE);
log('PRODUCTS_LOCATIONS_API_BASE:', PRODUCTS_LOCATIONS_API_BASE);
log('PRODUCTS_STOCK_LOTS_API_BASE:', PRODUCTS_STOCK_LOTS_API_BASE);

/* ──────────────────────────────────────────────────────────────
   Auth headers
────────────────────────────────────────────────────────────── */
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isInventoryFinished(status) {
  return ['finalizado', 'finished', 'closed', 'fechado'].includes(
    String(status || '').trim().toLowerCase()
  );
}

function applyInventoryLock(status) {
  const locked = isInventoryFinished(status);

  document.querySelectorAll(`
    .inventory-header input,
    .inventory-header select,
    .inventory-header textarea,
    .inventory-items__form input,
    .inventory-items__form select,
    .inventory-items__form textarea,
    #btnSaveInventory,
    #btnFinishInventory,
    #btnSaveItem
  `).forEach(el => {
    el.disabled = locked;
  });

  document.querySelectorAll('.inventory-edit-icon, .inventory-delete-icon')
    .forEach(icon => {
      icon.style.pointerEvents = locked ? 'none' : '';
      icon.style.opacity = locked ? '0.35' : '';
      icon.title = locked ? 'Inventário finalizado. Edição bloqueada.' : '';
    });
}

/* ──────────────────────────────────────────────────────────────
   Safe parse helpers
────────────────────────────────────────────────────────────── */
function toNumOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function isNumericId(v) {
  const s = String(v ?? '').trim();
  return /^\d+$/.test(s);
}

/* ──────────────────────────────────────────────────────────────
   Fetch helpers (logs + body text)
────────────────────────────────────────────────────────────── */
async function apiGet(url) {
  log('[apiGet] GET', url);
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  });
  const text = await res.text();
  log('[apiGet] status:', res.status);
  if (DEBUG) log('[apiGet] body:', text);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function apiPost(url, body) {
  log('[apiPost] POST', url, 'payload:', body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  log('[apiPost] status:', res.status);
  if (DEBUG) log('[apiPost] body:', text);
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function apiPut(url, body) {
  log('[apiPut] PUT', url, 'payload:', body);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  log('[apiPut] status:', res.status);
  if (DEBUG) log('[apiPut] body:', text);
  if (!res.ok) throw new Error(`PUT ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function apiDelete(url) {
  log('[apiDelete] DELETE', url);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  });
  const text = await res.text();
  log('[apiDelete] status:', res.status);
  if (DEBUG) log('[apiDelete] body:', text);
  if (!res.ok) throw new Error(`DELETE ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

/* ──────────────────────────────────────────────────────────────
   State
────────────────────────────────────────────────────────────── */
let currentInventory = null;
let items = [];
let logsData = [];
let inventoryKeyboardIndex = -1;
let inventoryRowsCache = [];
let __isSavingItem = false;

// Location caches
const __locByIdCache = new Map();   // key: location_id -> location row
const __locBySkuCache = new Map();  // key: product_code -> rows[]
const __locRowsLastLoaded = new Map(); // key: product_code -> rows[] (for text->id resolve)

/** ✅ LOTES cache */
const __productStockIdBySkuCache = new Map(); // sku -> product_stock_id (fallback)
const __lotsByStockIdCache = new Map();       // product_stock_id -> lots[] (fallback)
const __lotsBySkuCache = new Map();           // sku -> lots[] (✅ primary)
let __lotsAbort = null;

/* ──────────────────────────────────────────────────────────────
   DOM refs (NULL SAFE)
────────────────────────────────────────────────────────────── */
const els = {
  // LIST
  inventoryTableBody: document.getElementById('inventoryTableBody'),
  searchInventory: document.getElementById('searchInventory'),
  statusFilter: document.getElementById('statusFilter'),
  btnSearchInventories: document.getElementById('btnSearchInventories'),
  btnRefreshInventories: document.getElementById('btnRefreshInventories'),
  btnNewInventory: document.getElementById('btnNewInventory'),

  // Optional: XLS
  btnImportXls: document.getElementById('btnImportXls') || document.getElementById('btnImportXLS'),

  // EDIT (header)
  inventoryCode: document.getElementById('inventoryCode'),
  inventoryType: document.getElementById('inventoryType'),
  inventoryStatus: document.getElementById('inventoryStatus'),
  referenceDate: document.getElementById('referenceDate'),
  inventoryNotes: document.getElementById('inventoryNotes'),
  btnSaveInventory: document.getElementById('btnSaveInventory') || document.getElementById('btnSaveInventoryInline'),
  btnFinalizeInventory: document.getElementById('btnFinalizeInventory'),

  // ITEMS
  itemsTbody: document.getElementById('inventoryItemsTableBody'),
  itemProductNameEl: document.getElementById('itemProductName'),

  itemProductCode: document.getElementById('itemProductCode'),
  itemProductCodeValue: document.getElementById('itemProductCodeValue'),
  itemUnit: document.getElementById('itemUnit'),
  itemLocation: document.getElementById('itemLocation'),
  itemLocationValue: document.getElementById('itemLocationValue'),
  itemCountedQty: document.getElementById('itemCountedQty'),
  itemNotes: document.getElementById('itemNotes'),
  btnSearchProduct: document.getElementById('btnSearchProduct'),
  btnSaveItem: document.getElementById('btnSaveItem'),

  /** ✅ LOTES (NOVO) */
  lotSelect: document.getElementById('lotSelect'),
  lotHint: document.getElementById('lotHint'),

  // TABS
  tabListBtn: document.getElementById('tabListBtn'),
  tabEditBtn: document.getElementById('tabEditBtn'),
  tabLogsBtn: document.getElementById('tabLogsBtn'),
  tabListPanel: document.getElementById('tab-list'),
  tabEditPanel: document.getElementById('tab-edit'),
  tabLogsPanel: document.getElementById('tab-logs'),

  // LOGS
  logDateFrom: document.getElementById('logDateFrom'),
  logDateTo: document.getElementById('logDateTo'),
  logUserName: document.getElementById('logUserName'),
  logProductCode: document.getElementById('logProductCode'),
  btnSearchLogs: document.getElementById('btnSearchLogs'),
  logsTbody: document.getElementById('inventoryLogsTableBody'),
};

log('DOM refs ok');

/* ──────────────────────────────────────────────────────────────
   Password modal (fallback prompt)
────────────────────────────────────────────────────────────── */
function askPasswordModal({ title, subtitle } = {}) {
  const modal = document.getElementById('passwordModal');
  const titleEl = document.getElementById('passwordModalTitle');
  const subEl = document.getElementById('passwordModalSubtitle');
  const input = document.getElementById('passwordModalInput');
  const errBox = document.getElementById('passwordModalError');

  const btnClose = document.getElementById('passwordModalClose');
  const btnCancel = document.getElementById('passwordModalCancel');
  const btnOk = document.getElementById('passwordModalOk');

  if (!modal || !input || !btnOk || !btnCancel || !btnClose) {
    const senha = window.prompt(subtitle || 'Digite a senha:');
    return Promise.resolve(senha == null ? null : String(senha));
  }

  if (titleEl) titleEl.textContent = title || 'Senha requerida';
  if (subEl) subEl.textContent = subtitle || 'Digite a senha para continuar.';

  const showError = (msg) => {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.style.display = 'block';
  };

  const clearError = () => {
    if (!errBox) return;
    errBox.textContent = '';
    errBox.style.display = 'none';
  };

  const onKeyDown = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      resolveOnce(null);
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      btnOk.click();
    }
  };

  const open = () => {
    clearError();
    input.value = '';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => input.focus(), 0);
    document.addEventListener('keydown', onKeyDown);
  };

  const close = () => {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKeyDown);
  };

  let settled = false;
  let _resolve = null;

  const cleanup = () => {
    btnOk.onclick = null;
    btnCancel.onclick = null;
    btnClose.onclick = null;
    modal.onclick = null;
  };

  const resolveOnce = (value) => {
    if (settled) return;
    settled = true;
    try { cleanup(); close(); } finally { _resolve?.(value); }
  };

  return new Promise((resolve) => {
    _resolve = resolve;

    btnClose.onclick = () => resolveOnce(null);
    btnCancel.onclick = () => resolveOnce(null);

    btnOk.onclick = () => {
      const senha = String(input.value || '').trim();
      if (!senha) return showError('Informe a senha para continuar.');
      resolveOnce(senha);
    };

    modal.onclick = (e) => {
      if (e.target === modal) resolveOnce(null);
    };

    open();
  });
}

/* ──────────────────────────────────────────────────────────────
   Page detection (UX focus)
────────────────────────────────────────────────────────────── */
const IS_INVENTORY_PAGE =
  /\/inventory\//i.test(location.pathname) ||
  /inventory\.html/i.test(location.pathname) ||
  document.documentElement?.dataset?.page === 'inventory';

function focusCountedQty() {
  if (!IS_INVENTORY_PAGE) return;
  const el = els.itemCountedQty;
  if (!el) return;
  requestAnimationFrame(() => { el.focus(); try { el.select?.(); } catch { } });
}
function focusProductField() {
  if (!IS_INVENTORY_PAGE) return;
  const el = els.itemProductCode;
  if (!el) return;
  requestAnimationFrame(() => { el.focus(); try { el.select?.(); } catch { } });
}
function isBarcodeLike(v) {
  const s = String(v || '').trim();
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(s);
}

/* ──────────────────────────────────────────────────────────────
   ✅ LOTES helpers (apenas o necessário)
────────────────────────────────────────────────────────────── */
function clearLotSelect() {
  if (!els.lotSelect) return;
  els.lotSelect.innerHTML = `<option value="">Selecione o lote...</option>`;
  els.lotSelect.disabled = true;
  if (els.lotHint) els.lotHint.textContent = '';
}

function getLotIdFromUI() {
  const v = String(els.lotSelect?.value || '').trim();
  return isNumericId(v) ? parseInt(v, 10) : null;
}

/** ✅ Mostra info do lote selecionado no hint */
function updateLotHintFromSelectedOption() {
  if (!els.lotHint) return;
  if (!els.lotSelect) { els.lotHint.textContent = ''; return; }

  const v = String(els.lotSelect.value || '').trim();
  if (!v) { els.lotHint.textContent = ''; return; }

  const opt = els.lotSelect.options?.[els.lotSelect.selectedIndex];
  const txt = String(opt?.textContent || '').trim();
  els.lotHint.textContent = txt || '';
}

/**
 * ✅ NOVO (PRINCIPAL):
 * Carrega lotes pelo SKU diretamente:
 * GET /api/productsStockLots/by-product-code/:product_code
 *
 * - Evita resolver product_stock_id
 * - Evita "trazer todos os lotes" por engano (cada SKU traz só os dele)
 */
async function loadLotsByProductCode(productCode) {
  const sku = String(productCode || '').trim();
  if (!sku) return [];

  // cache por SKU
  if (__lotsBySkuCache.has(sku)) return __lotsBySkuCache.get(sku) || [];

  try { __lotsAbort?.abort(); } catch { }
  __lotsAbort = new AbortController();

  const url = `${PRODUCTS_STOCK_LOTS_API_BASE}/by-product-code/${encodeURIComponent(sku)}`;

  log('[lots] GET by-product-code', url);

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    signal: __lotsAbort.signal,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${text}`);

  const data = text ? JSON.parse(text) : [];
  const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];

  __lotsBySkuCache.set(sku, rows);
  return rows;
}

/* ──────────────────────────────────────────────────────────────
   ✅ LOTES fallback (só se precisar)
   Resolve product_stock_id a partir do SKU e usa /available?product_stock_id=
────────────────────────────────────────────────────────────── */
async function resolveProductStockIdBySku(productCode) {
  const sku = String(productCode || '').trim();
  if (!sku) return null;

  if (__productStockIdBySkuCache.has(sku)) return __productStockIdBySkuCache.get(sku);

  const tryGetIdFromRow = (row) => {
    const v =
      row?.product_stock_id ??
      row?.productStockId ??
      row?.id ??
      row?.product_stock?.product_stock_id ??
      null;
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
      if (id) { __productStockIdBySkuCache.set(sku, id); return id; }

      const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      if (rows.length) {
        id = tryGetIdFromRow(rows[0]);
        if (id) { __productStockIdBySkuCache.set(sku, id); return id; }
      }
    } catch (e) {
      if (DEBUG) log('[lots] resolveProductStockIdBySku failed on', url, e?.message || e);
    }
  }

  __productStockIdBySkuCache.set(sku, null);
  return null;
}

async function loadAndPopulateLotsByProductStockId(product_stock_id) {
  if (!els.lotSelect) return;

  try { __lotsAbort?.abort(); } catch { }
  __lotsAbort = new AbortController();

  els.lotSelect.disabled = true;
  els.lotSelect.innerHTML = `<option value="">Carregando lotes...</option>`;
  if (els.lotHint) els.lotHint.textContent = '';

  if (!product_stock_id || !Number.isFinite(Number(product_stock_id))) {
    clearLotSelect();
    return;
  }

  if (__lotsByStockIdCache.has(product_stock_id)) {
    const cached = __lotsByStockIdCache.get(product_stock_id) || [];
    populateLotsSelect(cached);
    return;
  }

  const url = `${PRODUCTS_STOCK_LOTS_API_BASE}/available?product_stock_id=${encodeURIComponent(product_stock_id)}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    signal: __lotsAbort.signal,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${text}`);

  const data = text ? JSON.parse(text) : [];
  const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];

  __lotsByStockIdCache.set(product_stock_id, rows);
  populateLotsSelect(rows);
}

function populateLotsSelect(lotsRows) {
  if (!els.lotSelect) return;

  const rows = Array.isArray(lotsRows) ? lotsRows : [];

  if (!rows.length) {
    els.lotSelect.innerHTML = `<option value="">Sem lotes</option>`;
    els.lotSelect.disabled = true;
    if (els.lotHint) els.lotHint.textContent = 'Nenhum lote encontrado para este produto.';
    return;
  }

  const fmtQty = (n) =>
    Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const fmtDate = (d) => {
    if (!d) return '—';
    // Aceita date/string/ts e também YYYY-MM-DD
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('pt-BR');
  };

  els.lotSelect.innerHTML =
    `<option value="">Selecione o lote...</option>` +
    rows
      .map((l) => {
        const lotId = l.lot_id ?? l.id ?? null;
        if (lotId == null) return '';

        const lotCode = l.lot_code ?? l.code ?? 'SEM LOTE';
        const exp = fmtDate(l.expires_at);

        // prioridade: qty_available (já vem do controller)
        const avail =
          l.qty_available != null
            ? fmtQty(l.qty_available)
            : fmtQty(Number(l.qty_on_hand || 0) - Number(l.qty_reserved || 0));

        return `<option value="${lotId}">${lotCode} • Val: ${exp} • Disp: ${avail}</option>`;
      })
      .join('');

  els.lotSelect.disabled = false;

  if (els.lotHint) els.lotHint.textContent = '';
}

/** ✅ Ponto de integração com o fluxo: carregar lotes a partir do SKU */
async function loadAndPopulateLotsForSku(productCode) {
  const sku = String(productCode || '').trim();
  if (!sku) { clearLotSelect(); return; }

  // 1) ✅ Preferencial: por product_code (NÃO precisa product_stock_id)
  try {
    els.lotSelect && (els.lotSelect.disabled = true);
    els.lotSelect && (els.lotSelect.innerHTML = `<option value="">Carregando lotes...</option>`);
    if (els.lotHint) els.lotHint.textContent = '';

    const rows = await loadLotsByProductCode(sku);
    populateLotsSelect(rows);
    return;
  } catch (e) {
    if (DEBUG) log('[lots] by-product-code failed, fallback to stock_id:', e?.message || e);
  }

  // 2) fallback: resolve product_stock_id e usa /available
  const stockId = await resolveProductStockIdBySku(sku);
  if (!stockId) {
    clearLotSelect();
    if (els.lotHint) els.lotHint.textContent = 'Não foi possível localizar lotes para este SKU.';
    return;
  }
  await loadAndPopulateLotsByProductStockId(stockId);
}

/* ──────────────────────────────────────────────────────────────
   Produto selecionado (display + valor real SKU)
────────────────────────────────────────────────────────────── */
function getItemProductHiddenEl() {
  return els.itemProductCodeValue || document.getElementById('itemProductCodeValue');
}
function setItemProductName(text) {
  if (!els.itemProductNameEl) return;
  els.itemProductNameEl.textContent = text || '';
}
function clearUnitSelect() {
  const el = els.itemUnit;
  if (!el) return;
  if (el.tagName === 'SELECT') el.innerHTML = '<option value="">Selecione...</option>';
  else el.value = '';
}
function clearLocationField() {
  if (!els.itemLocation) return;
  if (els.itemLocation.tagName === 'SELECT') els.itemLocation.innerHTML = '<option value="">Selecione...</option>';
  else els.itemLocation.value = '';
  if (els.itemLocationValue) els.itemLocationValue.value = '';
}
async function setItemProductDisplayAndCode(code, name) {
  const display = [code, name].filter(Boolean).join(' - ');
  if (els.itemProductCode) els.itemProductCode.value = display || '';

  const hidden = getItemProductHiddenEl();
  if (hidden) hidden.value = code || '';

  setItemProductName(name || '');

  if (code) {
    await loadAndPopulateUnitsForProduct(String(code).trim());
    await loadAndPopulateLocationsForProduct(String(code).trim());

    /** ✅ LOTES: ao selecionar produto, carrega lotes */
    await loadAndPopulateLotsForSku(String(code).trim());
  } else {
    clearUnitSelect();
    clearLocationField();
    clearLotSelect();
  }
}
function clearItemProduct() {
  if (els.itemProductCode) els.itemProductCode.value = '';
  const hidden = getItemProductHiddenEl();
  if (hidden) hidden.value = '';
  setItemProductName('');

  /** ✅ LOTES */
  clearLotSelect();
}

/* ──────────────────────────────────────────────────────────────
   Tabs
────────────────────────────────────────────────────────────── */
function activateTab(name) {
  const btnMap = { list: els.tabListBtn, edit: els.tabEditBtn, logs: els.tabLogsBtn };
  const panelMap = { list: els.tabListPanel, edit: els.tabEditPanel, logs: els.tabLogsPanel };

  Object.entries(btnMap).forEach(([key, btn]) => btn?.classList.toggle('is-active', key === name));
  Object.entries(panelMap).forEach(([key, panel]) => panel?.classList.toggle('is-active', key === name));

  if (name === 'logs') loadLogs().catch((err) => logError('Erro ao carregar logs na troca de aba:', err));
}

/* ──────────────────────────────────────────────────────────────
   List: notes column (coluna 2)
────────────────────────────────────────────────────────────── */
function getInventoryNotes(inv) {
  return inv?.notes ?? inv?.observacoes ?? inv?.observacao ?? inv?.observation ?? '';
}

/* ──────────────────────────────────────────────────────────────
   Unit select helpers
────────────────────────────────────────────────────────────── */
function normalizeUnitText(v) {
  return String(v || '').toUpperCase().replace(/\s+/g, '').replace(/[.\-]/g, '');
}
function setUnitSelectByLabel(unitLabel) {
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

/* ──────────────────────────────────────────────────────────────
   productsUnits — por product_code (SKU)
   value do <select> = product_unit_id (INTEGER)
────────────────────────────────────────────────────────────── */
async function loadAndPopulateUnitsForProduct(productCode) {
  try {
    if (!els.itemUnit) return;

    const el = els.itemUnit;
    const code = String(productCode || '').trim();
    if (!code) { clearUnitSelect(); return; }

    const params = new URLSearchParams();
    params.set('product_code', code);
    params.set('limit', '50');
    params.set('offset', '0');
    params.set('orderBy', 'unit');
    params.set('dir', 'ASC');

    const url = `${PRODUCTS_UNITS_API_BASE}?${params.toString()}`;
    const data = await apiGet(url);

    const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    log('[units] product_code:', code, 'rows:', rows);

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

    let standardId = '';

    rows.forEach((u) => {
      const id =
        u.product_unit_id ??
        u.productUnitId ??
        u.id ??
        u.productUnitID ??
        u.unit_id ??
        u.unitId;

      const unit = u.unit || '';
      const desc = u.description || '';
      const std = !!u.standard;

      const fatorText =
        u.fator != null && Number(u.fator) !== 1
          ? ` • Fator ${Number(u.fator).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
          : '';

      const descText = desc ? ` — ${desc}` : '';
      const stdText = std ? ' (Padrão)' : '';

      const opt = document.createElement('option');
      opt.value = (id != null && String(id).trim() !== '') ? String(id) : '';
      opt.dataset.unit = unit;
      opt.textContent = `${unit}${stdText}${descText}${fatorText}`;
      if (std && opt.value) standardId = opt.value;
      el.appendChild(opt);
    });

    if (standardId) el.value = standardId;
    else {
      const firstValid = rows.find((r) => r.product_unit_id != null || r.id != null);
      const id = firstValid?.product_unit_id ?? firstValid?.id ?? null;
      el.value = id != null ? String(id) : '';
    }
  } catch (err) {
    logError('Erro em loadAndPopulateUnitsForProduct:', err);
    clearUnitSelect();
  }
}

/* ──────────────────────────────────────────────────────────────
   Locations helpers
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

  if (__locByIdCache.has(id)) return __locByIdCache.get(id);

  try {
    const loc = await apiGet(`${PRODUCTS_LOCATIONS_API_BASE}/${id}`);
    __locByIdCache.set(id, loc || null);
    return loc || null;
  } catch {
    __locByIdCache.set(id, null);
    return null;
  }
}

async function getLocationsByProductCode(productCode) {
  const sku = String(productCode || '').trim();
  if (!sku) return [];

  if (__locBySkuCache.has(sku)) return __locBySkuCache.get(sku);

  try {
    const params = new URLSearchParams();
    params.set('product_code', sku);
    params.set('onlyActive', 'true');
    params.set('limit', '50');
    params.set('offset', '0');

    const data = await apiGet(`${PRODUCTS_LOCATIONS_API_BASE}?${params.toString()}`);
    const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    __locBySkuCache.set(sku, rows);
    return rows;
  } catch {
    __locBySkuCache.set(sku, []);
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

/**
 * ✅ FIX CRÍTICO:
 * - Se itemLocation é SELECT -> value = id
 * - Se itemLocation é INPUT/TEXT -> guarda o id no hidden itemLocationValue
 */
function setLocationIdHidden(id) {
  if (!els.itemLocationValue) return;
  els.itemLocationValue.value = (id != null && id !== '') ? String(id) : '';
}

function getLocationIdFromUI() {
  if (els.itemLocationValue && isNumericId(els.itemLocationValue.value)) {
    return parseInt(String(els.itemLocationValue.value).trim(), 10);
  }
  if (els.itemLocation?.tagName === 'SELECT') {
    const v = String(els.itemLocation.value || '').trim();
    return isNumericId(v) ? parseInt(v, 10) : null;
  }
  return null;
}

async function tryResolveLocationTextToIdBySku(productCode) {
  const sku = String(productCode || '').trim();
  if (!sku) return null;
  const inputText = String(els.itemLocation?.value || '').trim();
  if (!inputText) return null;

  const rows = __locRowsLastLoaded.get(sku) || (await getLocationsByProductCode(sku));
  if (!rows?.length) return null;

  const wanted = inputText.toLowerCase();
  const found =
    rows.find((r) => formatLocationRow(r).toLowerCase() === wanted) ||
    rows.find((r) => formatLocationRow(r).toLowerCase().includes(wanted)) ||
    null;

  const id = found?.id ?? found?.product_location_id ?? found?.location_id ?? null;
  return (id != null && isNumericId(id)) ? Number(id) : (Number.isFinite(Number(id)) ? Number(id) : null);
}

loadAndPopulateLocationsForProduct
/* ──────────────────────────────────────────────────────────────
   Inventories: list / render
────────────────────────────────────────────────────────────── */
async function loadInventories() {
  try {
    const search = (els.searchInventory?.value || '').trim();
    const status = els.statusFilter?.value || '';

    const params = new URLSearchParams();
    params.set('limit', '50');
    params.set('offset', '0');
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    const url = `${INVENTORY_API_BASE}?${params.toString()}`;
    const data = await apiGet(url);

    const inventories = Array.isArray(data?.rows) ? data.rows : [];
    renderInventoryTable(inventories);
  } catch (err) {
    logError('Erro em loadInventories:', err);
    showCenterModal({
      variant: 'error',
      title: 'Erro ao carregar inventários',
      message: String(err.message || err),
    });
  }
}

function renderInventoryTable(inventories) {
  const tbody = els.inventoryTableBody;
  if (!tbody) return;

  tbody.innerHTML = '';
  inventoryRowsCache = [];
  inventoryKeyboardIndex = -1;

  inventories.forEach((inv) => {
    const tr = document.createElement('tr');
    tr.dataset.id = inv.inventory_id;

    const status = String(inv.status || '').toUpperCase();
    const canReopen = status === 'FINALIZED';
    const notesText = getInventoryNotes(inv);

    tr.innerHTML = `
      <td>${inv.code || ''}</td>
      <td>${notesText || ''}</td>
      <td>${inv.type || ''}</td>
      <td>${inv.status || ''}</td>
      <td>${inv.reference_date ? new Date(inv.reference_date).toLocaleDateString('pt-BR') : ''}</td>
      <td class="col-actions">
        ${canReopen
        ? `
          <button
            type="button"
            class="btn btn-toolbar btn-sm js-reopen-inventory"
            data-id="${inv.inventory_id}"
            data-code="${inv.code || ''}"
          >
            Estornar estoque
          </button>
        `
        : `<span style="opacity:.45;">—</span>`
      }
      </td>
    `;

    tr.addEventListener('click', () => onSelectInventory(inv));

    tbody.appendChild(tr);
    inventoryRowsCache.push({ element: tr, data: inv });
  });
}

function updateInventoryKeyboardSelection() {
  inventoryRowsCache.forEach((row, index) => {
    row.element.classList.toggle('is-selected', index === inventoryKeyboardIndex);
  });
  const selected = inventoryRowsCache[inventoryKeyboardIndex];
  if (selected) selected.element.scrollIntoView({ block: 'nearest' });
}

async function onSelectInventory(inv) {
  try {
    currentInventory = inv;

    if (els.inventoryTableBody) {
      [...els.inventoryTableBody.querySelectorAll('tr')].forEach((tr) => {
        tr.classList.toggle('is-selected', tr.dataset.id === String(inv.inventory_id));
      });
    }

    const invFull = await apiGet(`${INVENTORY_API_BASE}/${inv.inventory_id}`);
    fillInventoryForm(invFull);
    await loadItems();
    activateTab('edit');
  } catch (err) {
    logError('Erro em onSelectInventory:', err);
  }
}

function fillInventoryForm(inv) {
  if (!inv) return;

  if (els.inventoryCode) els.inventoryCode.value = inv.code || '';
  if (els.inventoryType) els.inventoryType.value = inv.type || 'GENERAL';
  if (els.inventoryStatus) els.inventoryStatus.value = inv.status || 'OPEN';
  if (els.referenceDate) {
    els.referenceDate.value = inv.reference_date
      ? new Date(inv.reference_date).toISOString().substring(0, 10)
      : '';
  }
  if (els.inventoryNotes) els.inventoryNotes.value = inv.notes || '';
}

function resetInventoryForm() {
  currentInventory = null;
  items = [];
  logsData = [];

  fillInventoryForm({
    code: '',
    type: 'GENERAL',
    status: 'OPEN',
    reference_date: new Date().toISOString().substring(0, 10),
    notes: '',
  });

  renderItemsTable();

  clearItemProduct();
  clearUnitSelect();
  clearLocationField();
  clearLotSelect();
  if (els.itemCountedQty) els.itemCountedQty.value = '';
  if (els.itemNotes) els.itemNotes.value = '';
}

/* ──────────────────────────────────────────────────────────────
   Inventory: save / finalize
────────────────────────────────────────────────────────────── */
async function saveInventory() {
  try {
    const payload = {
      code: (els.inventoryCode?.value || '').trim(),
      type: (els.inventoryType?.value || 'GENERAL').toUpperCase(),
      status: (els.inventoryStatus?.value || 'OPEN').toUpperCase(),
      reference_date: els.referenceDate?.value || null,
      notes: els.inventoryNotes?.value || null,
    };

    if (!payload.code) {
      showCenterModal({ variant: 'warning', title: 'Código obrigatório', message: 'Informe um código para o inventário.' });
      return;
    }

    let data;
    if (currentInventory?.inventory_id) {
      data = await apiPut(`${INVENTORY_API_BASE}/${currentInventory.inventory_id}`, payload);
    } else {
      data = await apiPost(INVENTORY_API_BASE, payload);
    }

    showCenterModal({ variant: 'success', title: 'Inventário salvo', message: 'Inventário salvo com sucesso.' });

    await loadInventories();

    if (!currentInventory?.inventory_id && data?.inventory_id) {
      await onSelectInventory(data);
    }
  } catch (err) {
    logError('Erro em saveInventory:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao salvar inventário', message: String(err.message || err) });
  }
}

async function finalizeInventory() {
  try {
    if (!currentInventory?.inventory_id) {
      showCenterModal({ variant: 'warning', title: 'Selecione um inventário', message: 'Selecione um inventário antes de finalizar.' });
      return;
    }

    const senha = await askPasswordModal({
      title: 'Finalizar e aplicar estoque',
      subtitle: 'Digite a senha para FINALIZAR e APLICAR o estoque:',
    });

    if (senha == null) return;
    if (!String(senha).trim()) {
      showCenterModal({ variant: 'warning', title: 'Senha obrigatória', message: 'Você precisa informar a senha para finalizar.' });
      return;
    }

    const url = `${INVENTORY_API_BASE}/${currentInventory.inventory_id}/finalize`;
    await apiPost(url, { applyAdjust: true, password: String(senha) });

    showCenterModal({ variant: 'success', title: 'Inventário finalizado', message: 'Inventário finalizado com sucesso.' });

    await loadInventories();
    await loadItems();
    activateTab('list');
  } catch (err) {
    logError('Erro em finalizeInventory:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao finalizar inventário', message: String(err.message || err) });
  }
}

/* ──────────────────────────────────────────────────────────────
   Reopen / reverse stock
────────────────────────────────────────────────────────────── */
async function reopenInventory(inventoryId, inventoryCode) {
  try {
    const ok = window.confirm(
      `CONFIRMAR ESTORNO?\n\nInventário: ${inventoryCode || inventoryId}\n\nIsso irá desfazer o ajuste aplicado no estoque e reabrir o inventário.`
    );
    if (!ok) return;

    const senha = await askPasswordModal({
      title: 'Estornar estoque',
      subtitle: 'Digite a senha para ESTORNAR o estoque e reabrir o inventário:',
    });

    if (senha == null) return;
    if (!String(senha).trim()) {
      showCenterModal({ variant: 'warning', title: 'Senha obrigatória', message: 'Você precisa informar a senha para estornar.' });
      return;
    }

    await apiPost(`${INVENTORY_API_BASE}/${inventoryId}/reopen`, { password: String(senha) });

    showCenterModal({ variant: 'success', title: 'Estorno realizado', message: 'O estoque foi estornado e o inventário voltou para ABERTO.' });

    await loadInventories();

    if (currentInventory?.inventory_id && String(currentInventory.inventory_id) === String(inventoryId)) {
      const invFull = await apiGet(`${INVENTORY_API_BASE}/${inventoryId}`);
      fillInventoryForm(invFull);
      await loadItems();
    }
  } catch (err) {
    logError('Erro em reopenInventory:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao estornar', message: String(err.message || err) });
  }
}

/* ──────────────────────────────────────────────────────────────
   Items: load + hydrate location names + render
────────────────────────────────────────────────────────────── */
async function loadItems() {
  try {
    if (!currentInventory?.inventory_id) {
      items = [];
      renderItemsTable();
      return;
    }

    const data = await apiGet(`${INVENTORY_API_BASE}/${currentInventory.inventory_id}/items`);
    items = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];

    await hydrateItemsLocations(items);
    renderItemsTable();
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

function renderItemsTable() {
  const tbody = els.itemsTbody;
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!items || !items.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9" style="text-align:center; padding:10px; opacity:.6;">Nenhum item.</td>`;
    tbody.appendChild(tr);
    return;
  }

  items.forEach((item) => {
    const productNameShown = item.product_name || item.description || '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.product_code ?? ''}</td>
      <td>${productNameShown}</td>
      <td>${item.unit ?? ''}</td>
      <td>${item.location_name ?? ''}</td>
      <td class="col-number">${Number(item.system_stock_qty ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
      <td class="col-number">${item.counted_qty != null ? Number(item.counted_qty).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ''}</td>
      <td class="col-number">${item.difference_qty != null ? Number(item.difference_qty).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ''}</td>
      <td>${renderStatusBadge(item.status)}</td>
      <td class="col-actions">
        <button type="button" class="btn btn-toolbar btn-sm js-delete-item" data-id="${item.inventory_item_id}">
          Excluir
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ──────────────────────────────────────────────────────────────
   Items: save (✅ envia unit_id e location_id corretamente + lot_id)
────────────────────────────────────────────────────────────── */
async function saveItem() {
  let productCode = '';

  try {
    if (__isSavingItem) return;
    __isSavingItem = true;

    if (!currentInventory?.inventory_id) {
      showCenterModal({ variant: 'warning', title: 'Selecione um inventário', message: 'Selecione um inventário antes de adicionar itens.' });
      return;
    }

    const hidden = getItemProductHiddenEl();
    productCode = (hidden?.value || '').trim() || (els.itemProductCode?.value || '').trim();

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

    let product_location_id = getLocationIdFromUI();

    if (!product_location_id && els.itemLocation && els.itemLocation.tagName !== 'SELECT') {
      product_location_id = await tryResolveLocationTextToIdBySku(productCode);
      if (product_location_id) setLocationIdHidden(product_location_id);
    }

    if (!product_location_id) {
      const def = await getDefaultLocationForProduct(productCode);
      const defId = def?.id ?? def?.product_location_id ?? def?.location_id ?? null;

      if (defId != null) {
        product_location_id = Number(defId);
        if (els.itemLocation?.tagName === 'SELECT') els.itemLocation.value = String(defId);
        else {
          els.itemLocation.value = formatLocationRow(def);
          setLocationIdHidden(defId);
        }
      }
    }

    /** ✅ LOTES */
    const lot_id = getLotIdFromUI();

    const payload = {
      product_code: productCode,
      counted_qty,
      product_unit_id,
      product_location_id,
      lot_id,
      notes,
    };

    log('SAVE ITEM PAYLOAD', payload);

    const url = `${INVENTORY_API_BASE}/${currentInventory.inventory_id}/items`;
    await apiPost(url, payload);

    clearItemProduct();
    clearUnitSelect();
    clearLocationField();
    clearLotSelect();
    if (els.itemCountedQty) els.itemCountedQty.value = '';
    if (els.itemNotes) els.itemNotes.value = '';

    await loadItems();
    focusProductField();
  } catch (err) {
    logError('Erro em saveItem:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao salvar item', message: String(err.message || err) });
  } finally {
    __isSavingItem = false;
  }
}

async function deleteItem(inventoryItemId) {
  try {
    if (!currentInventory?.inventory_id) {
      showCenterModal({ variant: 'warning', title: 'Selecione um inventário', message: 'Selecione um inventário antes de excluir itens.' });
      return;
    }

    const invId = currentInventory.inventory_id;
    await apiDelete(`${INVENTORY_API_BASE}/${invId}/items/${inventoryItemId}`);
    await loadItems();
  } catch (err) {
    logError('Erro em deleteItem:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao excluir item', message: String(err.message || err) });
  }
}

/* ──────────────────────────────────────────────────────────────
   Products Modal Search
────────────────────────────────────────────────────────────── */
function openProductSearchModal() {
  try {
    openProductsModalSearch({
      apiBase: API_BASE,
      async onPick(product) {
        try {
          const code =
            product.product_code ??
            product.sku ??
            product.code ??
            product.product_id ??
            '';

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

          await setItemProductDisplayAndCode(String(code || '').trim(), name || '');
          if (unitInicial) setUnitSelectByLabel(unitInicial);

          focusCountedQty();
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

    const url = `${PRODUCTS_UNITS_API_BASE}/by-barcode?${params.toString()}`;
    const data = await apiGet(url);

    if (!data) return null;
    if (Array.isArray(data?.rows) && data.rows.length) return data.rows[0];
    return data;
  } catch (err) {
    logError('Erro em findProductUnitByBarcode:', err);
    return null;
  }
}

async function importProductFromBarcode(barcode) {
  const pu = await findProductUnitByBarcode(barcode);

  if (!pu) {
    showCenterModal({
      variant: 'warning',
      title: 'Barcode não encontrado',
      message: `Nenhuma unidade encontrada para o código: ${barcode}`,
    });
    return false;
  }

  const sku = String(pu.product_code || '').trim();
  const unitFromBarcode = String(pu.unit || '').trim();
  const unitIdFromBarcode = pu.product_unit_id != null ? String(pu.product_unit_id) : '';

  if (!sku) {
    showCenterModal({ variant: 'error', title: 'Resposta inválida', message: 'A API de barcode não retornou o product_code (SKU).' });
    return false;
  }

  await setItemProductDisplayAndCode(sku, '');
  await loadAndPopulateUnitsForProduct(sku);
  await loadAndPopulateLocationsForProduct(sku);

  /** ✅ LOTES */
  await loadAndPopulateLotsForSku(sku);

  if (els.itemUnit?.tagName === 'SELECT') {
    if (unitIdFromBarcode && isNumericId(unitIdFromBarcode)) els.itemUnit.value = unitIdFromBarcode;
    else if (unitFromBarcode) setUnitSelectByLabel(unitFromBarcode);
  } else if (els.itemUnit) {
    els.itemUnit.value = unitFromBarcode || '';
  }

  focusCountedQty();
  return true;
}

/* ──────────────────────────────────────────────────────────────
   LOGS
────────────────────────────────────────────────────────────── */
function renderLogsTable() {
  const tbody = els.logsTbody;
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!logsData || !logsData.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9" style="text-align:center; padding:8px;">Nenhum registro encontrado.</td>`;
    tbody.appendChild(tr);
    return;
  }

  logsData.forEach((logRow) => {
    const tr = document.createElement('tr');
    const dt = logRow.created_at ? new Date(logRow.created_at) : null;
    const dtText = dt ? `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR')}` : '';

    tr.innerHTML = `
      <td>${dtText}</td>
      <td>${logRow.user_name || ''}</td>
      <td>${logRow.action || ''}</td>
      <td>${logRow.product_code || ''}</td>
      <td>${logRow.product_name || ''}</td>
      <td>${logRow.unit || ''}</td>
      <td class="col-number">${logRow.system_qty_before != null ? Number(logRow.system_qty_before).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ''}</td>
      <td class="col-number">${logRow.counted_qty != null ? Number(logRow.counted_qty).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ''}</td>
      <td class="col-number">${logRow.system_qty_after != null ? Number(logRow.system_qty_after).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadLogs() {
  try {
    if (!currentInventory?.inventory_id) {
      logsData = [];
      renderLogsTable();
      return;
    }

    const url = `${INVENTORY_API_BASE}/${currentInventory.inventory_id}/logs`;
    const data = await apiGet(url);

    logsData = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    renderLogsTable();
  } catch (err) {
    logError('Erro em loadLogs:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao carregar auditoria', message: String(err.message || err) });
  }
}

/* ──────────────────────────────────────────────────────────────
   Keyboard shortcuts: SA / Ctrl+S
────────────────────────────────────────────────────────────── */
let __keyBuffer = '';
let __keyBufferTimer = null;

function isTypingContext() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' && el.readOnly) return false;
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

function triggerSaveInventoryShortcut() {
  if (typeof saveInventory === 'function') { saveInventory(); return; }
  els.btnSaveInventory?.click?.();
}

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (ev) => {
    if (ev.isComposing) return;

    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      triggerSaveInventoryShortcut();
      return;
    }

    if (isTypingContext()) return;

    const k = (ev.key || '').toUpperCase();
    if (k.length !== 1 || !/[A-Z0-9]/.test(k)) return;

    __keyBuffer += k;

    clearTimeout(__keyBufferTimer);
    __keyBufferTimer = setTimeout(() => { __keyBuffer = ''; }, 800);

    if (__keyBuffer.endsWith('SA')) {
      __keyBuffer = '';
      triggerSaveInventoryShortcut();
    }
  });
}

function applySaveHotkeyHint() {
  const targets = [els.btnSaveInventory].filter(Boolean);
  targets.forEach((btn) => {
    btn.innerHTML = `
      <span class="btn-label">
        <span class="kbd-hotkey">Sa</span>lvar inventário
      </span>
    `;
    btn.title = 'Atalho: SA (sequencial) / Ctrl+S';
    btn.setAttribute('aria-keyshortcuts', 'S A Ctrl+S');
    btn.style.gap = '0';
  });
}

/* ──────────────────────────────────────────────────────────────
   Events
────────────────────────────────────────────────────────────── */
function bindEvents() {
  els.btnSearchInventories?.addEventListener('click', loadInventories);
  els.btnRefreshInventories?.addEventListener('click', loadInventories);

  els.btnNewInventory?.addEventListener('click', () => {
    resetInventoryForm();
    activateTab('edit');
  });

  els.btnSaveInventory?.addEventListener('click', saveInventory);
  els.btnFinalizeInventory?.addEventListener('click', finalizeInventory);

  els.btnSearchProduct?.addEventListener('click', openProductSearchModal);
  els.btnSaveItem?.addEventListener('click', saveItem);

  els.itemsTbody?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.js-delete-item');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    deleteItem(id);
  });

  els.inventoryTableBody?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.js-reopen-inventory');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = btn.dataset.id;
    const code = btn.dataset.code;
    if (!id) return;
    reopenInventory(id, code);
  });

  els.searchInventory?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      loadInventories();
      return;
    }

    if (!inventoryRowsCache.length) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      inventoryKeyboardIndex =
        inventoryKeyboardIndex < inventoryRowsCache.length - 1
          ? inventoryKeyboardIndex + 1
          : 0;
      updateInventoryKeyboardSelection();
    }

    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      inventoryKeyboardIndex =
        inventoryKeyboardIndex > 0
          ? inventoryKeyboardIndex - 1
          : inventoryRowsCache.length - 1;
      updateInventoryKeyboardSelection();
    }

    if (ev.key === 'Enter' && inventoryKeyboardIndex >= 0) {
      ev.preventDefault();
      const selected = inventoryRowsCache[inventoryKeyboardIndex];
      if (selected) onSelectInventory(selected.data);
    }
  });

  els.statusFilter?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); loadInventories(); }
  });

  els.itemCountedQty?.addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); await saveItem(); }
  });

  // Digitar SKU/barcode no campo -> Enter abre modal ou importa barcode
  els.itemProductCode?.addEventListener('keydown', async (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();

    const typed = (els.itemProductCode?.value || '').trim();

    if (isBarcodeLike(typed)) {
      const ok = await importProductFromBarcode(typed);
      if (!ok) {
        showCenterModal({
          variant: 'warning',
          title: 'Barcode não encontrado',
          message: `Nenhum produto encontrado para o código: ${typed}`,
        });
        focusProductField();
      }
      return;
    }

    openProductSearchModal();
  });

  // ✅ FIX CRÍTICO: quando usuário muda a localização no SELECT,
  // garante limpar/atualizar o hidden
  els.itemLocation?.addEventListener?.('change', () => {
    if (!els.itemLocation) return;
    if (els.itemLocation.tagName === 'SELECT') {
      const v = String(els.itemLocation.value || '').trim();
      setLocationIdHidden(isNumericId(v) ? v : '');
    }
  });

  /** ✅ LOTES: se quiser manter, ok (não muda lotes por unidade, mas garante refresh) */
  els.itemUnit?.addEventListener?.('change', async () => {
    try {
      const hidden = getItemProductHiddenEl();
      const sku = (hidden?.value || '').trim();
      if (!sku) { clearLotSelect(); return; }
      // limpa cache do SKU e recarrega
      __lotsBySkuCache.delete(sku);
      await loadAndPopulateLotsForSku(sku);
      updateLotHintFromSelectedOption();
    } catch (e) {
      if (DEBUG) log('[lots] reload on unit change failed:', e?.message || e);
    }
  });

  /** ✅ LOTES: ao escolher lote, mostra hint */
  els.lotSelect?.addEventListener?.('change', () => {
    updateLotHintFromSelectedOption();
  });

  els.tabListBtn?.addEventListener('click', () => activateTab('list'));
  els.tabEditBtn?.addEventListener('click', () => activateTab('edit'));
  els.tabLogsBtn?.addEventListener('click', () => activateTab('logs'));

  els.btnSearchLogs?.addEventListener('click', (ev) => {
    ev.preventDefault();
    loadLogs();
  });

  // XLS button (se existir)
  els.btnImportXls?.addEventListener('click', () => {
    showCenterModal({
      variant: 'info',
      title: 'Importar XLS',
      message: 'Este botão está preparado. Se você quiser, eu conecto agora o fluxo completo de upload XLS + API.',
    });
  });
}

/* ──────────────────────────────────────────────────────────────
   Init
────────────────────────────────────────────────────────────── */
async function init() {
  try {
    bindEvents();
    bindKeyboardShortcuts();
    applySaveHotkeyHint();

    clearLotSelect();

    resetInventoryForm();
    await loadInventories();
    activateTab('list');
  } catch (err) {
    logError('Erro em init():', err);
  }
}

document.addEventListener('DOMContentLoaded', init);