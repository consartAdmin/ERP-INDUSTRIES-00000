// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsSync.repository.js — sync customerStatus e                 ║
// ║ CustomerActivity a partir do CRM                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { applyCrmOutcomeToCustomerActivity } from '../customerActivity/customerActivity.index.js';
import { toPositiveNumOrNull } from './crmDeals.utils.js';
import { erpTable } from '../../utils/erpCompanyContext.js';

export async function syncCustomerActivityFromOutcome({
  dealId,
  customerId,
  outcomeId,
}) {
  try {
    const dId = Number(dealId);
    const cId = Number(customerId);
    const oId = toPositiveNumOrNull(outcomeId);

    if (!Number.isFinite(dId) || !Number.isFinite(cId) || !oId) {
      console.warn('[crmDealsApi] syncCustomerActivityFromOutcome - dados inválidos', {
        dealId,
        customerId,
        outcomeId,
      });
      return;
    }

    await applyCrmOutcomeToCustomerActivity({
      customerId: cId,
      outcomeId: oId,
      dealId: dId,
    });

    console.log('[crmDealsApi] CustomerActivity atualizado via CRM', {
      dealId: dId,
      customerId: cId,
      outcomeId: oId,
    });

  } catch (e) {
    console.warn('[crmDealsApi] Falha ao sincronizar CustomerActivity:', e?.message || e);
  }
}

/* =========================================================================
 * SYNC: customerStatus (NOT NULL status_type_id)
 * ========================================================================= */
export async function resolveCustomersCustomerId({ client, crmCustomerId }) {
  const id = Number(crmCustomerId);
  if (!Number.isFinite(id) || id <= 0) return null;

  let r = await client.query(
    `SELECT customer_id FROM ${erpTable('public."customers"')} WHERE customer_id = $1 LIMIT 1`,
    [id]
  );
  if (r.rowCount) return r.rows[0].customer_id;

  r = await client.query(
    `SELECT customer_id FROM ${erpTable('public."customers"')} WHERE cliente_id = $1 LIMIT 1`,
    [id]
  );
  if (r.rowCount) return r.rows[0].customer_id;

  return null;
}

export async function upsertCustomerStatus({ client, customerId, statusTypeId, note = null, updatedBy = null }) {
  const st = Number(statusTypeId);
  if (!Number.isFinite(st)) return;
  if (!customerId) return;

  const customersCustomerId = await resolveCustomersCustomerId({
    client,
    crmCustomerId: customerId,
  });

  if (!customersCustomerId) {
    console.warn('[customerStatus] customer_id não encontrado em public.customers. crmCustomerId=', customerId);
    return;
  }

  await client.query(
    `
      INSERT INTO ${erpTable('public."customerStatus"')} (customer_id, status_type_id, note, updated_at, updated_by)
      VALUES ($1, $2, $3, now(), $4)
      ON CONFLICT (customer_id)
      DO UPDATE SET
        status_type_id = EXCLUDED.status_type_id,
        note = COALESCE(EXCLUDED.note, ${erpTable('public."customerStatus"')}.note),
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
    `,
    [Number(customersCustomerId), st, note, updatedBy]
  );
}
