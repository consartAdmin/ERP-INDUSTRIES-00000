// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettings.index.js — Parâmetros globais dos Orçamentos          ║
// ║ Mantém a mesma API pública do antigo budgetSettingsApi.js            ║
// ║ CONSART ERP | PostgreSQL | ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { normalizeMode } from './budgetSettings.sanitizers.js';
import { getBudgetSettings } from './budgetSettingsGet.repository.js';
import { updateBudgetSettings } from './budgetSettingsUpdate.repository.js';

export { normalizeMode, getBudgetSettings, updateBudgetSettings };

export default {
  normalizeMode,
  getBudgetSettings,
  updateBudgetSettings,
};
