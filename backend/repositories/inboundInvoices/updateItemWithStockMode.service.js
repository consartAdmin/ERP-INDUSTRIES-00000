// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ updateItemWithStockMode.service.js — CONSART ERP                        ║
// ║ Normaliza o item pelo PRODUCT_STOCK_MODE antes de persistir              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { updateItem as updateItemRepository } from './updateItem.repository.js';
import {
  resolveInboundStockMode,
  normalizeInboundItemByStockMode,
} from './inboundStockMode.service.js';

export async function updateItemWithStockMode(id, payload, options = {}) {
  const stockMode =
    options.stockMode ||
    await resolveInboundStockMode(options);

  const normalized = normalizeInboundItemByStockMode(payload, stockMode);
  return updateItemRepository(id, normalized, options);
}

export default updateItemWithStockMode;
