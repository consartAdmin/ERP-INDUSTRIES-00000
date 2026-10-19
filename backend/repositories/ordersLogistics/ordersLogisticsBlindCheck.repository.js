// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersLogisticsBlindCheck.repository.js — Conferência Cega         ║
// ║ Helpers de status (início / finalização)                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { updateLogisticsStatus } from './ordersLogisticsHeader.repository.js';

/**
 * Marca conferência cega como iniciada.
 */
export async function markBlindCheckStarted(logistics_id, checker_user_id = null) {
  return updateLogisticsStatus(logistics_id, 'CONFERENCIA_INICIADA', {
    checker_user_id: checker_user_id ?? undefined,
    checking_started_at: new Date(),
    blind_check_status: 'EM_ANDAMENTO'
  });
}

/**
 * Finaliza conferência cega e atualiza status com base em divergências.
 * (Aqui só marca flags; a lógica de "se tem divergência ou não" pode ser
 * calculada no controller, passando has_discrepancy / discrepancy_note).
 */
export async function finalizeBlindCheck(logistics_id, { has_discrepancy = false, discrepancy_note = null } = {}) {
  const blind_check_status = has_discrepancy ? 'DIVERGENCIA' : 'OK';

  return updateLogisticsStatus(logistics_id, 'CONFERENCIA_CONCLUIDA', {
    checking_finished_at: new Date(),
    blind_check_status,
    has_discrepancy,
    discrepancy_note
  });
}
