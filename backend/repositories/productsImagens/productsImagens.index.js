// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagens.index.js — ponto de entrada do módulo              ║
// ║ Mantém a mesma API pública do antigo productsImagensApi.js         ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  resolveProductCode,
  listAll,
  listByProductCode,
  listByProductId,
  getPrimaryImageByProductCode,
  getPrimaryImageByProductId,
  getById,
} from './productsImagensQuery.repository.js';
import { addImage } from './productsImagensCreate.repository.js';
import { updateImage, setPrimaryImage } from './productsImagensUpdate.repository.js';
import { softDeleteImage, hardDeleteImage } from './productsImagensRemove.repository.js';
import { reorderImages } from './productsImagensReorder.repository.js';

export {
  resolveProductCode,
  listAll,
  listByProductCode,
  listByProductId,
  getPrimaryImageByProductCode,
  getPrimaryImageByProductId,
  getById,
  addImage,
  updateImage,
  setPrimaryImage,
  softDeleteImage,
  hardDeleteImage,
  reorderImages,
};

const productsImagensApi = {
  resolveProductCode,
  listAll,
  listByProductCode,
  listByProductId,
  getPrimaryImageByProductCode,
  getPrimaryImageByProductId,
  getById,
  addImage,
  updateImage,
  setPrimaryImage,
  softDeleteImage,
  hardDeleteImage,
  reorderImages
};

export default productsImagensApi;
