// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanban.index.js — ponto de entrada do Kanban de Pedidos      ║
// ║ Mantém a mesma API pública do antigo ordersKanbanApi.js            ║
// ║ (somente named exports — sem default)                              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { pingDb } from './ordersKanbanHealth.repository.js';

// Cards
export {
  listCards,
  countOpenPendingsByCard,
  countFinished,
} from './ordersKanbanCardsQuery.repository.js';
export { createCard, createCardFromBudget } from './ordersKanbanCardsCreate.repository.js';
export {
  updateCard,
  moveCardToColumn,
  setCardUrgent,
  finishCard,
} from './ordersKanbanCardsUpdate.repository.js';
export { deleteCard, deletePending } from './ordersKanbanRemove.repository.js';

// Colunas
export { listColumns, listColumnsWithCounts } from './ordersKanbanColumnsQuery.repository.js';

// Pendências
export {
  getPendingsByCard,
  listPendingsWithContext,
  countPendings,
} from './ordersKanbanPendingsQuery.repository.js';
export {
  completePending,
  reopenPending,
  updatePending,
  addPending,
} from './ordersKanbanPendingsUpsert.repository.js';
