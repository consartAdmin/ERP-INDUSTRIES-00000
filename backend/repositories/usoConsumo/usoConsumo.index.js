// ╔════════════════════════════════════════════════════════════════════╗
// ║ usoConsumo.index.js — ponto de entrada do módulo Uso e Consumo     ║
// ║ Mantém a mesma API pública do antigo usoConsumoApi.js              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { list, getById } from './usoConsumoQuery.repository.js';
export { emitNfe, retryNfe } from './usoConsumoNfeEmission.repository.js';
export { finishBudgetAsUsoConsumo } from './usoConsumoFinishBudget.repository.js';
export { refreshNfeStatus } from './usoConsumoNfeStatus.repository.js';
export { generateDanfeConsart } from './usoConsumoDanfe.repository.js';
