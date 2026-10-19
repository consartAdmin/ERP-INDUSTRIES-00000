/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.config.js — Configuração de endpoints do frontend        ║
   ║ PRODNEX ERP | Frontend (ESM)                                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { core } from './inboundInvoices.utils.js';

const base = () => core.getBase();

export const ROUTES = {
  inboundBase: () => `${base()}/api/inbound-invoices`,

  // App Features
  appFeatureResolve: (featureCode) =>
    `${base()}/api/app-features/${encodeURIComponent(String(featureCode || '').trim())}/resolve`,

// Lots
lotsByProductCode: (product_code) =>
  `${base()}/api/productsStockLots/by-product-code/${encodeURIComponent(
    String(product_code || '').trim()
  )}`,

// ✅ Inbound precisa listar opções de lotes por stock_id (inclusive zerados)
// padrão: /options?product_stock_id=123
lotsOptionsByStockId: (product_stock_id) =>
  `${base()}/api/productsStockLots/options?product_stock_id=${encodeURIComponent(
    String(product_stock_id || '').trim()
  )}`,

  // Units
  units: () => `${base()}/api/units?onlyActive=1&limit=1000`,

  // Suppliers
  suppliers: () => `${base()}/api/suppliers`,
  suppliersSearch: (q) =>
    `${base()}/api/suppliers/search?q=${encodeURIComponent(String(q || '').trim())}`,

  // DF-e (caixa de entrada NF-e)
  nfeInboxList: () => `${base()}/api/nfe-inbox`,
  nfeInboxXmlById: (id) =>
    `${base()}/api/nfe-inbox/${encodeURIComponent(String(id))}/xml`,
  nfeInboxManifestById: (id) =>
    `${base()}/api/nfe-inbox/${encodeURIComponent(String(id))}/manifest`,

  // Products: the canonical route argument is product_code, not product_id.
  productByCode: (productCode) =>
    `${base()}/api/products/${encodeURIComponent(String(productCode ?? '').trim())}`,

  // Legacy alias retained for compatibility with external imports.
  productById: (id) => `${base()}/api/products/${encodeURIComponent(String(id))}`,
};
