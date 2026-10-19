// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.state.js — State + caches                                  ║
// ║ PRODNEX ERP | Inventário                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const state = {
  currentInventory: null,
  items: [],
  logsData: [],
  inventoryKeyboardIndex: -1,
  inventoryRowsCache: [],
  __isSavingItem: false,

  // Location caches
  __locByIdCache: new Map(),         // key: location_id -> location row
  __locBySkuCache: new Map(),        // key: product_code -> rows[]
  __locRowsLastLoaded: new Map(),    // key: product_code -> rows[]

  // ✅ LOTES cache
  __productStockIdBySkuCache: new Map(), // sku -> product_stock_id (fallback)
  __lotsByStockIdCache: new Map(),       // product_stock_id -> lots[] (fallback)
  __lotsBySkuCache: new Map(),           // sku -> lots[] (✅ primary)
  __lotsAbort: null,
};