// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancel.repository.js — CONSART ERP | Notas Fiscais Emitidas          ║
// ║ Marca a NF-e como CANCELADO, registrando data e motivo               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { resolveNfeStatus } from './_shared.js';
import { update } from './update.repository.js';

export async function cancel(
  invoiceId,
  reason = null,
  { userId = null } = {}
) {
  const statusMap = await resolveNfeStatus('CANCELADO');

  if (!statusMap) {
    return {
      ok: false,
      error: 'Status CANCELADO não cadastrado em nfeStatusMap',
    };
  }

  return update(
    invoiceId,
    {
      nfe_status_id: statusMap.nfe_status_id,

      // Temporário durante a migração
      nfe_status: statusMap.code,

      cancelled_at: new Date(),
      cancellation_reason: reason || 'NF-e cancelada',
    },
    { userId, operation: 'CANCEL' }
  );
}

export default cancel;
