// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.core.js — Base (state, routes, helpers)              ║
// ║ PRODNEX ERP                                                  ║
// ║ ✅ Suporte a desconto geral do orçamento                     ║
// ╚══════════════════════════════════════════════════════════════╝

export const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');
export const $ = (s, r = document) => r.querySelector(s);

/* ──────────────────────────────────────────────────────────────
   FORMATADORES
────────────────────────────────────────────────────────────── */
export const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ──────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────── */
export function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function safeUpper(s) {
  return String(s || '').toUpperCase();
}

export function getIdAny(row) {
  return (
    row?.id ??
    row?.paymentMethods_id ??
    row?.payment_method_id ??
    row?.code ??
    row?.price_id ??
    null
  );
}

/* ──────────────────────────────────────────────────────────────
   ROTAS
────────────────────────────────────────────────────────────── */
export const ROUTES = Object.freeze({
  productPriceMode: `${API_BASE}/api/app-features/PRODUCT_PRICE_MODE/resolve`,
  productStockMode: `${API_BASE}/api/app-features/PRODUCT_STOCK_MODE/resolve`,
  budgets: `${API_BASE}/api/budgets`,
  budgetById: (id) => `${API_BASE}/api/budgets/${encodeURIComponent(id)}`,

  budgetsSearch: (
    q,
    limit,
    offset,
    dateFrom,
    dateTo,
    status,
    orderBy,
    orderDirection
  ) => {
    const params = new URLSearchParams();

    if (q) params.set('q', q);
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (status) params.set('status', status);

    if (orderBy) {
      params.set('orderBy', orderBy);
    }

    if (orderDirection) {
      params.set('orderDirection', orderDirection);
    }

    return `${API_BASE}/api/budgets/search?${params.toString()}`;
  },

  customerById: (id) => `${API_BASE}/api/customers/${encodeURIComponent(id)}`,

  customerPriceTable: (id) =>
    `${API_BASE}/api/customer-price-tables/customers/${encodeURIComponent(id)}/price-table`,

  customerCredit: (id) =>
    `${API_BASE}/api/customers-credit/customer/${encodeURIComponent(id)}`,

  budgetSettings: `${API_BASE}/api/budget-settings`,

  printPdf: (id) => `${API_BASE}/api/budgets/${encodeURIComponent(id)}/pdf`,
  toOrder: (id) => `${API_BASE}/api/budgets/${encodeURIComponent(id)}/to-order`,
  copyBudget: (id) => `${API_BASE}/api/budgets/${encodeURIComponent(id)}/copy`,

  customersSearch: (q) =>
    `${API_BASE}/api/customers/search?q=${encodeURIComponent(q || '')}&limit=10`,

  productsSearch: (q) =>
    `${API_BASE}/api/products/search?q=${encodeURIComponent(q || '')}&limit=10`,

  productByManufacturerRef: (manufacturerRef) =>
    `${API_BASE}/api/products/by-manufacturer-ref/${encodeURIComponent(manufacturerRef || '')}`,

  pricesTables: `${API_BASE}/api/prices`,

  productPricesById: (id) =>
    `${API_BASE}/api/products/${encodeURIComponent(id)}/prices`,

  productPricesBySku: (sku) =>
    `${API_BASE}/api/products/${encodeURIComponent(sku)}/prices`,

  productPricesLegacyId: (id) =>
    `${API_BASE}/api/productsPrices/${encodeURIComponent(id)}`,

  productUnitsById: (id) =>
    `${API_BASE}/api/products-units?product_id=${encodeURIComponent(id)}`,

  productUnitsBySku: (sku) =>
    `${API_BASE}/api/products-units?product_code=${encodeURIComponent(sku)}`,

  productGradesById: (pid) =>
    `${API_BASE}/api/products-grades?product_id=${encodeURIComponent(pid)}`,

  productGradesBySku: (sku) =>
    `${API_BASE}/api/products-grades?product_code=${encodeURIComponent(sku)}`,

  paymentMethods: `${API_BASE}/api/paymentMethods`,
  paymentForms: `${API_BASE}/api/paymentForms`,
  paymentTerms: `${API_BASE}/api/paymentTerms`,

  // LOTES
  productsStockLotsGetByProductCode: (product_code) =>
    `${API_BASE}/api/productsStockLots?product_code=${encodeURIComponent(product_code)}`,

  budgetShippingByBudgetId: (id) =>
    `${API_BASE}/api/budgets-shipping/${encodeURIComponent(id)}`,

  nfeIssuanceSource:
    `${API_BASE}/api/app-features/NFE_ISSUANCE_SOURCE/resolve`,
});


/* ──────────────────────────────────────────────────────────────
   STATE GLOBAL
────────────────────────────────────────────────────────────── */
export const state = {
  list: [],
  total: 0,
  page: 1,
  limit: 50,
  q: '',
  selectedId: null,

  filterDateFrom: '',
  filterDateTo: '',
  filterStatus: '',

  // Ordenação padrão da listagem
  orderBy: 'budget_id',
  orderDirection: 'desc',

  editing: null,

  priceMode: {
    mode: 'MULTIPLE',
    singlePriceId: 1,
    allowMultiplePrices: true,
    loaded: false,
  },

  // PRODUCT_STOCK_MODE (appFeatures)
  // Safe default: lote, até a feature ser resolvida.
  stockMode: {
    mode: 'STOCK_WITH_LOT',
    isSimple: false,
    requireLot: true,
    allowLots: true,
    source: 'SAFE_DEFAULT',
    loaded: false,
  },

  currentProduct: {
    sku: '',
    pid: '',
    desc: '',
    units: [],
    basePriceByTable: {},
  },
};

/* ──────────────────────────────────────────────────────────────
   CATALOGOS
────────────────────────────────────────────────────────────── */
export const catalogs = {
  priceTables: [],
  priceTablesById: {},
  paymentMethods: [],
  paymentMethodsById: {},
};

export const budgetSettings = {
  out_of_stock_mode: 'BLOCK',
  require_stock_lot: false,
  allow_manual_unit_price: true,
  max_discount_percent: 100,
  can_manage: false,
};

/* ──────────────────────────────────────────────────────────────
   CACHE
────────────────────────────────────────────────────────────── */
export const productPricesCache = Object.create(null);
export const gradeNameCache = Object.create(null);

/* ──────────────────────────────────────────────────────────────
   🆕 DESCONTO GERAL (HELPERS)
────────────────────────────────────────────────────────────── */

/**
 * Garante que o header tenha os campos de desconto geral
 */
export function ensureBudgetDiscountFields(header = {}) {
  if (!header || typeof header !== 'object') return;

  if (!header.global_discount_type) header.global_discount_type = 'value';

  if (!Number.isFinite(Number(header.global_discount_value))) {
    header.global_discount_value = 0;
  }

  if (!Number.isFinite(Number(header.global_discount_amount))) {
    header.global_discount_amount = 0;
  }
}

/**
 * Inicializa desconto no state.editing
 */
export function initGlobalDiscountInState() {
  if (!state.editing) state.editing = { header: {}, items: [] };
  if (!state.editing.header) state.editing.header = {};

  ensureBudgetDiscountFields(state.editing.header);
}

/**
 * Calcula desconto geral
 */
export function calculateGlobalDiscount(base = 0) {
  initGlobalDiscountInState();

  const type = state.editing.header.global_discount_type || 'value';
  const value = Number(state.editing.header.global_discount_value || 0);

  if (type === 'percent') {
    return Math.max(0, base * (value / 100));
  }

  return Math.max(0, value);
}

/**
 * Retorna dados do desconto geral
 */
export function getGlobalDiscount() {
  initGlobalDiscountInState();

  return {
    type: state.editing.header.global_discount_type,
    value: Number(state.editing.header.global_discount_value || 0),
    amount: Number(state.editing.header.global_discount_amount || 0),
  };
}

/**
 * Atualiza desconto no state
 */
export function setGlobalDiscount({ type, value }) {
  initGlobalDiscountInState();

  state.editing.header.global_discount_type =
    type === 'percent' ? 'percent' : 'value';

  state.editing.header.global_discount_value = Math.max(0, Number(value || 0));
}
