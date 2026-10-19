// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2.index.js — vínculo fiscal do produto (V2)           ║
// ║ Mantém a mesma API pública do antigo productsFiscalV2Api.js          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { list, listBatchProducts, getCurrent } from './productsFiscalV2Query.repository.js';
import { upsertCurrent } from './productsFiscalV2Upsert.repository.js';
import { batchUpsertCurrent } from './productsFiscalV2BatchUpsert.repository.js';
import { closeCurrent } from './productsFiscalV2Close.repository.js';

export {
  list,
  listBatchProducts,
  getCurrent,
  upsertCurrent,
  batchUpsertCurrent,
  closeCurrent,
};
