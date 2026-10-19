// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsMobile.index.js — ponto de entrada do módulo               ║
// ║ Mantém a mesma API pública do antigo productsMobileApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getByBarcodeOrSku } from './productsMobileProduct.repository.js';
import { listLocationOptions, getLocationByBarcode } from './productsMobileLocations.repository.js';
import { updateProductLocation } from './productsMobileLocationUpdate.repository.js';

export default {
  getByBarcodeOrSku,
  listLocationOptions,
  getLocationByBarcode,
  updateProductLocation,
};
