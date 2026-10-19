// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsBoxes.index.js — ponto de entrada do módulo productsBoxes  ║
// ║ Mantém a mesma API pública do antigo productsBoxesApis.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

export { TB_BOX, TB_ITEM, TB_PRODUCT } from './productsBoxes.constants.js';
export {
  listBoxes,
  getBoxById,
  getBoxWithItems,
  listBoxesWithItems,
  listBoxesByProductCode,
  getBoxByProductCode,
} from './productsBoxesQuery.repository.js';
export { createBox } from './productsBoxesCreate.repository.js';
export { updateBox } from './productsBoxesUpdate.repository.js';
export { deleteBox } from './productsBoxesRemove.repository.js';
export { listBoxItems, deleteBoxItem, upsertBoxItem } from './productsBoxesItems.repository.js';
