// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryLogs.index.js — ponto de entrada do módulo                ║
// ║ Mantém a API pública do antigo inventoryLogsApi.js                 ║
// ╚════════════════════════════════════════════════════════════════════╝

export { registerLog } from './inventoryLogsCreate.repository.js';
export { listByInventory } from './inventoryLogsQuery.repository.js';
