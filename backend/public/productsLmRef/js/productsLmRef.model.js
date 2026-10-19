import * as api from './productsLmRef.api.js';
import { normalizeProductLmRef } from './productsLmRef.utils.js';

export async function loadProductsLmRef(filters) {
  const records = await api.fetchProductsLmRef(filters);
  return records.map(normalizeProductLmRef);
}

export async function saveProductLmRef(id, data) {
  const record = id
    ? await api.updateProductLmRef(id, data)
    : await api.createProductLmRef(data);
  return normalizeProductLmRef(record);
}

export const removeProductLmRef = api.deleteProductLmRef;

