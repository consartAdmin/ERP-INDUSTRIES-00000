// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.state.js                                         ║
// ║ MODULE: Products Kits — State and DOM                               ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const state = {
  kits: [],
  kitItems: [],
  loadingList: false,
  saving: false,
};

export const dom = {};

export function cacheDom() {
  const ids = [
    'btnNovoKit', 'btnAtualizar', 'searchKit', 'btnPesquisar',
    'kitsTableBody', 'kitFormSection', 'formTitle', 'btnFecharForm',
    'kitId', 'kitSku', 'kitDescription', 'priceMode', 'salePrice',
    'kitActive', 'productSearch', 'productSuggestions', 'itemSku',
    'itemDescription', 'itemUnit', 'itemQuantity', 'itemCostUnit',
    'itemSaleUnit', 'btnAdicionarItem', 'itemsTableBody', 'totalCost',
    'totalSaleItems', 'btnSalvarKit', 'btnCancelar',
  ];

  ids.forEach((id) => {
    dom[id] = document.getElementById(id);
  });
}
