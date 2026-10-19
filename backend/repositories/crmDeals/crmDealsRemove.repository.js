// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsRemove.repository.js — deleteDeal (+ logAction)            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import perfApi from '../crmDealsPerformance/crmDealsPerformance.index.js';
import { buildError } from './crmDeals.utils.js';

export async function deleteDeal(id) {
  try {
    let before = null;
    try {
      const beforeRes = await pool.query(
        `
          SELECT d.id, d.stage_id, COALESCE(s.code, s.stage_code) AS stage_code, d.seller_id, d.seller_name,
                 d.customer_id, d.customer_name, d.estimated_value, d.status_type_id
          FROM public."crmDeals" d
          JOIN public."crmDealsStages" s ON s.id = d.stage_id
          WHERE d.id = $1
        `,
        [id]
      );
      before = beforeRes.rows[0] || null;
    } catch (e) {
      console.warn('[crmDealsApi] snapshot BEFORE delete falhou:', e?.message || e);
    }

    const sql = `DELETE FROM public."crmDeals" WHERE id = $1 RETURNING id`;
    const { rows } = await pool.query(sql, [id]);
    if (!rows[0]) return { ok: false, error: 'DEAL_NOT_FOUND' };

    try {
      await perfApi.logAction({
        action_type: 'DELETE_DEAL',
        deal_id: id,
        stage_id: before?.stage_id ?? null,
        stage_code: before?.stage_code ?? null,
        seller_id: before?.seller_id ?? null,
        seller_name: before?.seller_name ?? null,
        customer_id: before?.customer_id ?? null,
        customer_name: before?.customer_name ?? null,
        estimated_value: before?.estimated_value ?? null,
        details: {
          source: 'API',
          status_type_id: before?.status_type_id ?? null,
        },
      });
    } catch (e) {
      console.warn('[crmDealsApi] logAction DELETE_DEAL falhou:', e?.message || e);
    }

    return { ok: true, data: { id } };
  } catch (err) {
    return buildError(err, 'crmDealsApi.deleteDeal');
  }
}
