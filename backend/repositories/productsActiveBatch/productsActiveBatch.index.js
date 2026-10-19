// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatch.index.js — ponto de entrada do módulo          ║
// ║ Mantém a mesma API pública do antigo productsActiveBatchApi.js     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { batchSetActive, batchActivate, batchDeactivate } from './productsActiveBatchSet.repository.js';
import { batchListProducts } from './productsActiveBatchQuery.repository.js';

export { batchSetActive, batchActivate, batchDeactivate, batchListProducts };

export default {
  batchListProducts,
  batchSetActive,
  batchActivate,
  batchDeactivate,
};
