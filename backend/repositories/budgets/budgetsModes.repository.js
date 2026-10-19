// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsModes.repository.js — Modos de preço / estoque                ║
// ║ resolveBudgetPriceMode / resolveBudgetStockMode                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { resolveProductsPricesMode } from '../productsPrices/productsPrices.manager.js';
import { resolveProductsStockMode } from '../productsStock/productsStock.manager.js';

export const SINGLE_PRICE_ID = 1;

export async function resolveBudgetPriceMode(ctx = {}) {
  return resolveProductsPricesMode({
    scopeType:
      ctx.featureScopeType ??
      ctx.scopeType ??
      'GLOBAL',

    scopeId:
      ctx.featureScopeId ??
      ctx.scopeId ??
      1,
  });
}

export async function resolveBudgetStockMode(ctx = {}) {
  return resolveProductsStockMode({
    scopeType:
      ctx.featureScopeType ??
      ctx.scopeType ??
      'GLOBAL',

    scopeId:
      ctx.featureScopeId ??
      ctx.scopeId ??
      1,
  });
}
