// ╔════════════════════════════════════════════════════════════════════╗
// ║ promoImages.index.js — ponto de entrada do módulo Promo Images     ║
// ║ Mantém a mesma API pública do antigo promoImagesApi.js             ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listPriceTables, searchProducts } from './promoImagesQuery.repository.js';
import { generatePromoImage, previewPromoImage } from './promoImagesGenerate.repository.js';

export { listPriceTables, searchProducts, generatePromoImage, previewPromoImage };

export default {
  listPriceTables,
  searchProducts,
  previewPromoImage,
  generatePromoImage,
};
