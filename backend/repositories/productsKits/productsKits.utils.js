// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKits.utils.js — totais de custo / venda dos itens          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toNum } from './productsKits.sanitizers.js';

export function calculateTotals(items = []) {
  let totalCost = 0;
  let totalSale = 0;

  for (const item of items) {
    const quantity = toNum(item.quantity, 1);
    const factor = toNum(item.unit_factor || item.fator || item.factor, 1);
    const cost = toNum(item.cost_unit, 0);
    const sale = toNum(item.sale_price_unit, 0);

    totalCost += quantity * factor * cost;
    totalSale += quantity * factor * sale;
  }

  return {
    totalCost: Number(totalCost.toFixed(2)),
    totalSale: Number(totalSale.toFixed(2)),
  };
}
