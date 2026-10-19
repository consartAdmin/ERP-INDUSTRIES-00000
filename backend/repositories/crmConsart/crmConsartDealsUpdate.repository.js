// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsartDealsUpdate.repository.js — updateDeal /                 ║
// ║ moveDealToStage | Tabela: public."crmDealsReativation"             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmConsart.utils.js';
import { fetchCustomerName, fetchSellerName } from './crmConsartLookup.repository.js';
import { getDealById } from './crmConsartDealsQuery.repository.js';
import { getStageByCode } from './crmConsartStages.repository.js';

export async function updateDeal(id, payload = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query(
      `
        SELECT *
        FROM public."crmDealsReativation"
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );
    const current = currentRes.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'DEAL_NOT_FOUND' };
    }

    let stageId = payload.stageId || payload.stage_id || current.stage_id;
    if (!stageId && payload.stageCode) {
      const stageRes = await client.query(
        `
          SELECT id
          FROM public."crmStagesReativation"
          WHERE UPPER(code) = UPPER($1)
        `,
        [payload.stageCode]
      );
      stageId = stageRes.rows[0]?.id || stageId;
    }

    const customerId =
      payload.customer_id !== undefined ? payload.customer_id : current.customer_id;
    const sellerId =
      payload.seller_id !== undefined ? payload.seller_id : current.seller_id;

    let customerName =
      payload.customer_name !== undefined ? payload.customer_name : current.customer_name;
    let sellerName =
      payload.seller_name !== undefined ? payload.seller_name : current.seller_name;

    if (payload.customer_id !== undefined && !customerName) {
      customerName = await fetchCustomerName(payload.customer_id);
    }
    if (payload.seller_id !== undefined && !sellerName) {
      sellerName = await fetchSellerName(payload.seller_id);
    }

    const sql = `
      UPDATE public."crmDealsReativation"
      SET
        stage_id           = $1,
        customer_id        = $2,
        seller_id          = $3,
        customer_name      = $4,
        seller_name        = $5,
        estimated_value    = $6,
        tag                = $7,
        next_step          = $8,
        last_activity_date = $9,
        notes              = $10
      WHERE id = $11
      RETURNING id
    `;

    const values = [
      stageId,
      customerId,
      sellerId,
      customerName || current.customer_name,
      sellerName || current.seller_name,
      payload.estimated_value ?? current.estimated_value,
      payload.tag !== undefined ? payload.tag : current.tag,
      payload.next_step !== undefined ? payload.next_step : current.next_step,
      payload.last_activity_date !== undefined
        ? payload.last_activity_date
        : current.last_activity_date,
      payload.notes !== undefined ? payload.notes : current.notes,
      id,
    ];

    const { rows } = await client.query(sql, values);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'DEAL_NOT_FOUND_AFTER_UPDATE' };
    }

    await client.query('COMMIT');

    const detail = await getDealById(id);
    if (!detail.ok) return { ok: true, data: { id } };
    return { ok: true, data: detail.data };
  } catch (err) {
    await client.query('ROLLBACK');
    return buildError(err, 'crmConsartApi.updateDeal');
  } finally {
    client.release();
  }
}

export async function moveDealToStage({ id, stageCode, stageId }) {
  try {
    if (!stageId && !stageCode) return { ok: false, error: 'STAGE_REQUIRED' };

    let targetStageId = stageId;

    if (!targetStageId && stageCode) {
      const stageRes = await getStageByCode(stageCode);
      if (!stageRes.ok) return { ok: false, error: stageRes.error || 'STAGE_NOT_FOUND' };
      targetStageId = stageRes.data.id;
    }

    const sql = `
      UPDATE public."crmDealsReativation"
      SET stage_id = $1
      WHERE id = $2
      RETURNING id
    `;
    const { rows } = await pool.query(sql, [targetStageId, id]);
    if (!rows[0]) return { ok: false, error: 'DEAL_NOT_FOUND' };

    const detail = await getDealById(id);
    if (!detail.ok) return { ok: true, data: { id } };
    return { ok: true, data: detail.data };
  } catch (err) {
    return buildError(err, 'crmConsartApi.moveDealToStage');
  }
}
