// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsartDealsQuery.repository.js — listDeals / getDealById       ║
// ║ Tabela: public."crmDealsReativation"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmConsart.utils.js';
import { mapDealRow } from './crmConsart.mappers.js';

/* =========================================================================
 * DEALS (cards do Kanban)
 * ========================================================================= */

export async function listDeals({
  stageCode,
  stageId,
  sellerId,
  search,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    const params = [];
    // ⚠️ Só mostra cards "abertos" no Kanban
    let where = 'WHERE COALESCE(d.is_closed, FALSE) = FALSE';

    if (stageId) {
      params.push(stageId);
      where += ` AND d.stage_id = $${params.length}`;
    } else if (stageCode) {
      params.push(stageCode);
      where += ` AND UPPER(s.code) = UPPER($${params.length})`;
    }

    if (sellerId) {
      params.push(sellerId);
      where += ` AND d.seller_id = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toUpperCase()}%`);
      where += ` AND UPPER(d.customer_name) LIKE $${params.length}`;
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT
        d.id,
        d.stage_id,
        s.code        AS stage_code,
        s.name        AS stage_name,
        d.customer_id,
        d.customer_name,
        d.seller_id,
        d.seller_name,
        d.estimated_value,
        d.tag,
        d.next_step,
        d.last_activity_date,
        d.notes,
        d.created_at,
        d.updated_at
      FROM public."crmDealsReativation" d
      JOIN public."crmStagesReativation" s
        ON s.id = d.stage_id
      ${where}
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
   `;

    const { rows } = await pool.query(sql, params);
    return { ok: true, data: rows.map(mapDealRow) };
  } catch (err) {
    return buildError(err, 'crmConsartApi.listDeals');
  }
}

export async function getDealById(id) {
  try {
    const sql = `
      SELECT
        d.id,
        d.stage_id,
        s.code        AS stage_code,
        s.name        AS stage_name,
        d.customer_id,
        d.customer_name,
        d.seller_id,
        d.seller_name,
        d.estimated_value,
        d.tag,
        d.next_step,
        d.last_activity_date,
        d.notes,
        d.created_at,
        d.updated_at
      FROM public."crmDealsReativation" d
      JOIN public."crmStagesReativation" s
        ON s.id = d.stage_id
      WHERE d.id = $1
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows[0]) return { ok: false, error: 'DEAL_NOT_FOUND' };
    return { ok: true, data: mapDealRow(rows[0]) };
  } catch (err) {
    return buildError(err, 'crmConsartApi.getDealById');
  }
}
