// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersBillingUpdate.repository.js — updateStatusByProviderId       ║
// ║ Tabela: public."ordersBilling"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ordersBilling.constants.js';
import { normalizeDateToYMD } from './ordersBilling.utils.js';

// ---------------------------------------------------------------------
// updateStatusByProviderId — usado pelo webhook do Asaas
// ---------------------------------------------------------------------
export async function updateStatusByProviderId(providerPaymentId, patch = {}) {
  if (!providerPaymentId) return null;

  const fields = [];
  const values = [];
  let idx = 1;

  if (patch.status) {
    fields.push(`status = $${idx++}`);
    values.push(patch.status);
  }
  if (patch.paid_date) {
    fields.push(`paid_date = $${idx++}`);
    values.push(normalizeDateToYMD(patch.paid_date));
  }
  if (patch.status_details) {
    fields.push(`status_details = $${idx++}`);
    values.push(patch.status_details);
  }
  if (patch.metadata) {
    fields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
    values.push(JSON.stringify(patch.metadata));
  }

  if (!fields.length) return null;

  fields.push(`updated_at = NOW()`);

  values.push(providerPaymentId);

  const { rows } = await pool.query(
    `
    UPDATE ${TB}
       SET ${fields.join(', ')}
     WHERE provider_payment_id = $${idx}
    RETURNING *;
    `,
    values,
  );

  return rows[0] || null;
}
