// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ createItemWithStockMode.service.js — CONSART ERP                        ║
// ║ Normaliza o item pelo PRODUCT_STOCK_MODE antes de persistir              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { createItem as createItemRepository } from './createItem.repository.js';
import {
  resolveInboundStockMode,
  normalizeInboundItemByStockMode,
} from './inboundStockMode.service.js';

export async function createItemWithStockMode(payload, options = {}) {
  const stockMode =
    options.stockMode ||
    await resolveInboundStockMode(options);

  const normalized = normalizeInboundItemByStockMode(payload, stockMode);
  return createItemRepository(normalized);
}

export default createItemWithStockMode;
