// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.products.js                                      ║
// ║ MODULE: Products Kits — Product Selection                           ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { PRODUCTS_MODAL_OPTIONS } from './productsKits.config.js';
import { dom } from './productsKits.state.js';

export function openProductSearch() {
  openProductsModalSearch({
    ...PRODUCTS_MODAL_OPTIONS,
    onPick: fillSelectedProduct,
  });
}

function fillSelectedProduct(product) {
  const sku =
    product.product_code || product.sku || product.codigo || '';
  const description =
    product.description || product.descricao || product.nome || '';
  const unit =
    product.matched_unit || product.unit || product.unidade || '';
  const unitFactor =
    product.unit_factor || product.fator || product.factor || 1;
  const cost =
    product.cost_price || product.cost_unit || product.custo || 0;
  const sale =
    product.price ||
    product.sale_price ||
    product.preco_venda ||
    product.preco ||
    0;

  if (dom.productSearch) {
    dom.productSearch.value = `${sku} - ${description}`;
  }
  if (dom.itemSku) dom.itemSku.value = sku;
  if (dom.itemDescription) dom.itemDescription.value = description;

  if (dom.itemUnit) {
    dom.itemUnit.value = unit;
    dom.itemUnit.dataset.factor = Number(unitFactor || 1);
  }

  if (dom.itemCostUnit) dom.itemCostUnit.value = Number(cost || 0);
  if (dom.itemSaleUnit) dom.itemSaleUnit.value = Number(sale || 0);
  dom.itemQuantity?.focus();
}
