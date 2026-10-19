// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtInstallmentPlans.index.js — ponto de entrada do módulo         ║
// ║ Mantém a mesma API pública do antigo debtInstallmentPlansApi.js    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listByDebtId } from './debtInstallmentPlansQuery.repository.js';
import { replaceByDebtId } from './debtInstallmentPlansReplace.repository.js';
import { removePlan } from './debtInstallmentPlansRemove.repository.js';

export default {
  listByDebtId,
  replaceByDebtId,
  removePlan
};
