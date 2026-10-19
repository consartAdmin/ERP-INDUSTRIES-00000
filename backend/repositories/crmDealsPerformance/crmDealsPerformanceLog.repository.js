// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsPerformanceLog.repository.js — logAction                   ║
// ║ Tabela: public."crmDealsReativationActions"                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './crmDealsPerformance.constants.js';
import { buildError } from './crmDealsPerformance.utils.js';

/**
 * Registra um evento (ação).
 * Dica: você chama isso dentro do seu crmDealsReativationApi.js (create/update/move/outcome/delete).
 */
export async function logAction(payload = {}) {
  try {
    const sql = `
      INSERT INTO ${TABLE} (
        deal_id, stage_id, stage_code,
        seller_id, seller_name, user_id,
        customer_id, customer_name,
        action_type,
        from_stage_id, to_stage_id,
        estimated_value, value_at_moment,
        details, ip, user_agent
      )
      VALUES (
        $1,$2,$3,
        $4,$5,$6,
        $7,$8,
        $9,
        $10,$11,
        $12,$13,
        $14,$15,$16
      )
      RETURNING id, created_at
    `;

    const values = [
      payload.deal_id ?? payload.dealId ?? null,
      payload.stage_id ?? payload.stageId ?? null,
      payload.stage_code ?? payload.stageCode ?? null,

      payload.seller_id ?? payload.sellerId ?? null,
      payload.seller_name ?? payload.sellerName ?? null,
      payload.user_id ?? payload.userId ?? null,

      payload.customer_id ?? payload.customerId ?? null,
      payload.customer_name ?? payload.customerName ?? null,

      String(payload.action_type || payload.actionType || '').toUpperCase(),

      payload.from_stage_id ?? payload.fromStageId ?? null,
      payload.to_stage_id ?? payload.toStageId ?? null,

      payload.estimated_value ?? payload.estimatedValue ?? null,
      payload.value_at_moment ?? payload.valueAtMoment ?? null,

      payload.details ?? null,
      payload.ip ?? null,
      payload.user_agent ?? payload.userAgent ?? null,
    ];

    if (!values[8]) return { ok: false, error: 'ACTION_TYPE_REQUIRED' };

    const { rows } = await pool.query(sql, values);
    return { ok: true, data: rows[0] };
  } catch (err) {
    return buildError(err, 'crmDealsReativationPerformanceApi.logAction');
  }
}
