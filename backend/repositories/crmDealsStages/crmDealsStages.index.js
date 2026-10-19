// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStages.index.js — ponto de entrada das Etapas do CRM       ║
// ║ Mantém a mesma API pública do antigo crmDealsStagesApi.js          ║
// ║ (apenas named exports; o original não tinha default)              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { listStages, countStages, getStageById } from './crmDealsStagesQuery.repository.js';
export { createStage } from './crmDealsStagesCreate.repository.js';
export { updateStage } from './crmDealsStagesUpdate.repository.js';
export { removeStage } from './crmDealsStagesRemove.repository.js';
