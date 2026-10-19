// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.constants.js — tabelas, limites e colunas de ordenação      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { PRODUCTS_SCHEMA } from './products.catalog.js';

export const TABLE_STOCK = 'public."productsStock"';
export const TABLE_PRICES = 'public."productsPrices"';
export const TABLE_IMAGES = 'public."productsImages"';
export const TABLE_BARCODES = 'public."productsBarCode"';
export const TABLE_LOCATIONS = 'public."productsLocations"';
export const TABLE_LOTS = 'public."productsStockLots"';
export const TABLE_INBOUND_ITEMS = 'public."inboundInvoiceItems"';
export const TABLE_FISCAL_V2 = 'public."productsFiscalV2"';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 500;
const configuredRetailPriceId = Number(process.env.PRICE_TABLE_VAREJO_ID || 1);
export const VAREJO_PRICE_ID = Number.isInteger(configuredRetailPriceId) && configuredRetailPriceId > 0
    ? configuredRetailPriceId
    : 1;

export const SORT_COLUMNS = new Set(PRODUCTS_SCHEMA.selectColumns);
