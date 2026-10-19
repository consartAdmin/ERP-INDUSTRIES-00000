// ╔════════════════════════════════════════════════════════════════════╗
// ║ betterDateToBuy.index.js — ponto de entrada (lembrete de recompra) ║
// ║ Mantém a mesma API pública do antigo betterDateToBuyApi.js         ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  getAllBetterDates,
  getBetterDateById,
  getTodayAlerts,
} from './betterDateToBuyQuery.repository.js';
export { createBetterDate } from './betterDateToBuyCreate.repository.js';
export { updateBetterDate, markAlertSent } from './betterDateToBuyUpdate.repository.js';
export { deleteBetterDate } from './betterDateToBuyRemove.repository.js';
