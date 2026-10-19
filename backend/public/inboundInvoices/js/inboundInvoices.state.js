/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.state.js — Estado + caches                              ║
   ║ PRODNEX ERP | Frontend (ESM)                                    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

export const state = {
  // Pagination
  page: 1,
  pageSize: 50,
  total: 0,

  // Sorting
  orderBy: 'created_at',
  orderDirection: 'desc',

  // Date range filter (YYYY-MM-DD)
  dateFrom: '',
  dateTo: '',

  // Catalogs
  unitsList: [],

  // PRODUCT_STOCK_MODE
  // Safe default follows productsStock.manager.js: STOCK_WITH_LOT.
  stockMode: 'STOCK_WITH_LOT',
  productStockMode: 'STOCK_WITH_LOT',
  PRODUCT_STOCK_MODE: 'STOCK_WITH_LOT',
  stockModeResolved: false,
  stockModeResolutionError: null,
  stockModeInfo: null,

  // Current form data
  currentItems: [],
  currentInstallments: [],

  // Caches
  lotsByProductCache: new Map(), // product_code -> lots[]
  lotsByStockCache: new Map(), // product_stock_id -> lots[]

  // Action registry (filled by modules)
  actions: {},
};
