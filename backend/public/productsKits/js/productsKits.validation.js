// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.validation.js                                    ║
// ║ MODULE: Products Kits — Validation                                  ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateKitItem(item) {
  if (!item.product_sku) {
    return {
      ok: false,
      message: 'Selecione um produto para adicionar ao kit.',
    };
  }

  if (item.quantity <= 0) {
    return {
      ok: false,
      message: 'A quantidade precisa ser maior que zero.',
    };
  }

  return { ok: true };
}

export function validateKit(payload) {
  if (!payload.kit_description) {
    return { ok: false, message: 'Informe a descrição do kit.' };
  }

  if (!payload.items.length) {
    return {
      ok: false,
      message: 'Adicione pelo menos um item ao kit.',
    };
  }

  return { ok: true };
}
