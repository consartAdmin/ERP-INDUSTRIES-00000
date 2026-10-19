// ╔══════════════════════════════════════════════════════════════════════╗
// ║ index.js — CONSART ERP | Notas Fiscais Emitidas                      ║
// ║ Agrega os repositories do módulo (um arquivo por função)             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './ensureTable.repository.js';
import { create } from './create.repository.js';
import { update } from './update.repository.js';
import { cancel } from './cancel.repository.js';
import { getById } from './getById.repository.js';
import { getByProviderId } from './getByProviderId.repository.js';
import { getByOrderId } from './getByOrderId.repository.js';
import { getKpis } from './getKpis.repository.js';
import { search } from './search.repository.js';
import { remove } from './remove.repository.js';
import { upsertFromOrder } from './upsertFromOrder.repository.js';
import { upsertFromBudget } from './upsertFromBudget.repository.js';
import { upsertFromBonus } from './upsertFromBonus.repository.js';
import { syncFaturadasFromOrders } from './syncFaturadasFromOrders.repository.js';

export { ensureTable } from './ensureTable.repository.js';
export { create } from './create.repository.js';
export { update } from './update.repository.js';
export { cancel } from './cancel.repository.js';
export { getById } from './getById.repository.js';
export { getByProviderId } from './getByProviderId.repository.js';
export { getByOrderId } from './getByOrderId.repository.js';
export { getKpis } from './getKpis.repository.js';
export { search } from './search.repository.js';
export { remove } from './remove.repository.js';
export { upsertFromOrder } from './upsertFromOrder.repository.js';
export { upsertFromBudget } from './upsertFromBudget.repository.js';
export { upsertFromBonus } from './upsertFromBonus.repository.js';
export { syncFaturadasFromOrders } from './syncFaturadasFromOrders.repository.js';

export default {
  ensureTable,
  create,
  update,
  cancel,
  getById,
  getByProviderId,
  getByOrderId,
  getKpis,
  search,
  remove,
  upsertFromOrder,
  upsertFromBudget,
  upsertFromBonus,
  syncFaturadasFromOrders,
};
