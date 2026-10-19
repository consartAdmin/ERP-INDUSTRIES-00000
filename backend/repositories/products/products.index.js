// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.index.js — ponto de entrada do módulo Produtos              ║
// ║ Mantém a mesma API pública do antigo productsApi.js                  ║
// ║ CONSART ERP | PostgreSQL                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ProductsApiError } from './products.utils.js';
import { list, search, getByCode, getCostMap } from './productsQuery.repository.js';
import { create } from './productsCreate.repository.js';
import { updateByCode, updateBarcodeByCode } from './productsUpdate.repository.js';
import { softDeleteByCode, restoreByCode } from './productsRemove.repository.js';

export {
    ProductsApiError,
    list,
    search,
    getByCode,
    create,
    updateByCode,
    softDeleteByCode,
    restoreByCode,
    updateBarcodeByCode,
    getCostMap,
};

export const productsApi = Object.freeze({
    list,
    search,
    getByCode,
    create,
    updateByCode,
    softDeleteByCode,
    restoreByCode,
    updateBarcodeByCode,
    getCostMap,
});

export default productsApi;
