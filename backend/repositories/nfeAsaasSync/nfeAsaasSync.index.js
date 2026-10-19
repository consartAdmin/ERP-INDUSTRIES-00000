// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasSync.index.js — NF-e autorizada → Contas a Receber / Asaas   ║
// ║ Mantém a mesma API pública do antigo nfeAsaasSyncApi.js              ║
// ║ 1. PEDIDO    → NF-e autorizada → CONTAS A RECEBER → ASAAS opcional   ║
// ║ 2. ORÇAMENTO → NF-e autorizada → CONTAS A RECEBER → ASAAS opcional   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { syncAuthorizedNfe } from './nfeAsaasSyncOrder.repository.js';
import { syncAuthorizedBudgetNfe } from './nfeAsaasSyncBudget.repository.js';

export { syncAuthorizedNfe, syncAuthorizedBudgetNfe };

export default {
  syncAuthorizedNfe,
  syncAuthorizedBudgetNfe,
};
