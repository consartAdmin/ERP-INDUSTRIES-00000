// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsUpdate.repository.js — updateDeal / moveDealToStage        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import perfApi from '../crmDealsPerformance/crmDealsPerformance.index.js';
import { buildError, safeUpper, diffFields } from './crmDeals.utils.js';
import {
  normalizeStatusTypeId,
  normalizeLeadSourceId,
  normalizeOutcomeId,
  normalizeLossReasonId,
} from './crmDeals.sanitizers.js';
import { fetchCustomerName, fetchSellerName } from './crmDealsLookup.repository.js';
import { upsertCustomerStatus } from './crmDealsSync.repository.js';
import { getDealById } from './crmDealsQuery.repository.js';
import { getStageByCode } from './crmDealsStages.repository.js';

export async function updateDeal(id, payload = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentRes = await client.query(
      `SELECT * FROM public."crmDeals" WHERE id = $1 FOR UPDATE`,
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
          FROM public."crmDealsStages"
          WHERE UPPER(COALESCE(code, stage_code)) = UPPER($1)
          LIMIT 1
        `,
        [payload.stageCode]
      );
      stageId = stageRes.rows[0]?.id || stageId;
    }

    const customerId = payload.customer_id !== undefined ? payload.customer_id : current.customer_id;
    const sellerId = payload.seller_id !== undefined ? payload.seller_id : current.seller_id;

    let customerName = payload.customer_name !== undefined ? payload.customer_name : current.customer_name;
    let sellerName = payload.seller_name !== undefined ? payload.seller_name : current.seller_name;

    if (payload.customer_id !== undefined && !customerName) {
      customerName = await fetchCustomerName(payload.customer_id);
    }
    if (payload.seller_id !== undefined && !sellerName) {
      sellerName = await fetchSellerName(payload.seller_id);
    }

    const statusTypeTouched =
      payload.status_type_id !== undefined ||
      payload.statusTypeId !== undefined ||
      payload.tagStatusTypeId !== undefined ||
      payload.tag_status_type_id !== undefined ||
      payload.tagStatusTypeID !== undefined;

    const statusTypeId = statusTypeTouched
      ? normalizeStatusTypeId(payload)
      : (current.status_type_id ?? null);

    const leadSourceId =
      payload.lead_source_id !== undefined || payload.leadSourceId !== undefined
        ? normalizeLeadSourceId(payload)
        : (current.lead_source_id ?? null);

    const outcomeId =
      payload.outcome_id !== undefined || payload.outcomeId !== undefined
        ? normalizeOutcomeId(payload)
        : (current.outcome_id ?? null);

    const lossReasonId =
      payload.loss_reason_id !== undefined || payload.lossReasonId !== undefined
        ? normalizeLossReasonId(payload)
        : (current.loss_reason_id ?? null);

    const sql = `
      UPDATE public."crmDeals"
      SET
        stage_id           = $1,
        customer_id        = $2,
        seller_id          = $3,
        customer_name      = $4,
        seller_name        = $5,
        estimated_value    = $6,
        lead_source_id     = $7,
        status_type_id     = $8,
        outcome_id         = $9,
        loss_reason_id     = $10,
        loss_notes         = $11,
        tag                = $12,
        next_step          = $13,
        last_activity_date = $14,
        notes              = $15,
        updated_at         = now()
      WHERE id = $16
      RETURNING id, customer_id, status_type_id
    `;

    const values = [
      stageId,
      customerId,
      sellerId,
      customerName || current.customer_name,
      sellerName || current.seller_name,
      payload.estimated_value ?? current.estimated_value,
      leadSourceId,
      statusTypeId,
      outcomeId,
      lossReasonId,
      payload.loss_notes !== undefined ? payload.loss_notes : current.loss_notes,
      payload.tag !== undefined ? payload.tag : current.tag,
      payload.next_step !== undefined ? payload.next_step : current.next_step,
      payload.last_activity_date !== undefined ? payload.last_activity_date : current.last_activity_date,
      payload.notes !== undefined ? payload.notes : current.notes,
      id,
    ];

    const upd = await client.query(sql, values);
    if (!upd.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'DEAL_NOT_FOUND_AFTER_UPDATE' };
    }

    if (statusTypeTouched) {
      await upsertCustomerStatus({
        client,
        customerId: upd.rows[0].customer_id,
        statusTypeId: upd.rows[0].status_type_id,
        note: payload.notes ?? payload.note ?? null,
        updatedBy: payload.updated_by ?? payload.updatedBy ?? null,
      });
    }

    await client.query('COMMIT');

    const detail = await getDealById(id);
    if (!detail.ok) return { ok: true, data: { id } };

    try {
      const after = detail.data || {};
      const changedFields = diffFields(
        {
          stage_id: current.stage_id,
          customer_id: current.customer_id,
          seller_id: current.seller_id,
          customer_name: current.customer_name,
          seller_name: current.seller_name,
          estimated_value: current.estimated_value,
          lead_source_id: current.lead_source_id,
          status_type_id: current.status_type_id,
          outcome_id: current.outcome_id,
          loss_reason_id: current.loss_reason_id,
          loss_notes: current.loss_notes,
          tag: current.tag,
          next_step: current.next_step,
          last_activity_date: current.last_activity_date,
          notes: current.notes,
        },
        {
          stage_id: after.stage_id,
          customer_id: after.customer_id,
          seller_id: after.seller_id,
          customer_name: after.customer_name,
          seller_name: after.seller_name,
          estimated_value: after.estimated_value,
          lead_source_id: after.lead_source_id,
          status_type_id: after.status_type_id,
          outcome_id: after.outcome_id,
          loss_reason_id: after.loss_reason_id,
          loss_notes: after.loss_notes,
          tag: after.tag,
          next_step: after.next_step,
          last_activity_date: after.last_activity_date,
          notes: after.notes,
        },
        [
          'stage_id',
          'customer_id',
          'seller_id',
          'customer_name',
          'seller_name',
          'estimated_value',
          'lead_source_id',
          'status_type_id',
          'outcome_id',
          'loss_reason_id',
          'loss_notes',
          'tag',
          'next_step',
          'last_activity_date',
          'notes',
        ]
      );

      await perfApi.logAction({
        action_type: 'UPDATE_DEAL',
        deal_id: after.id,
        stage_id: after.stage_id,
        stage_code: after.stage_code || null,
        seller_id: after.seller_id,
        seller_name: after.seller_name,
        customer_id: after.customer_id,
        customer_name: after.customer_name,
        estimated_value: after.estimated_value ?? null,
        details: {
          source: 'API',
          changedFields,
          status_type_id: after.status_type_id ?? null,
          synced_customer: !!statusTypeTouched,
        },
      });
    } catch (e) {
      console.warn('[crmDealsApi] logAction UPDATE_DEAL falhou:', e?.message || e);
    }

    return { ok: true, data: detail.data };
  } catch (err) {
    await client.query('ROLLBACK');
    return buildError(err, 'crmDealsApi.updateDeal');
  } finally {
    client.release();
  }
}

export async function moveDealToStage({ id, stageCode, stageId }) {
  try {
    if (!stageId && !stageCode) return { ok: false, error: 'STAGE_REQUIRED' };

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
      console.warn('[crmDealsApi] snapshot BEFORE move falhou:', e?.message || e);
    }

    if (!stageId && stageCode) {
      const { ok, data, error } = await getStageByCode(stageCode);
      if (!ok) return { ok: false, error: error || 'STAGE_NOT_FOUND' };
      stageId = data.id;
      stageCode = data.code || stageCode;
    }

    const sql = `
      UPDATE public."crmDeals"
      SET stage_id = $1, updated_at = now()
      WHERE id = $2
      RETURNING id
    `;
    const { rows } = await pool.query(sql, [stageId, id]);
    if (!rows[0]) return { ok: false, error: 'DEAL_NOT_FOUND' };

    const detail = await getDealById(id);
    if (!detail.ok) return { ok: true, data: { id } };

    try {
      const after = detail.data || {};
      await perfApi.logAction({
        action_type: 'MOVE_STAGE',
        deal_id: after.id,
        stage_id: after.stage_id,
        stage_code: after.stage_code || safeUpper(stageCode) || null,
        seller_id: after.seller_id ?? before?.seller_id ?? null,
        seller_name: after.seller_name ?? before?.seller_name ?? null,
        customer_id: after.customer_id ?? before?.customer_id ?? null,
        customer_name: after.customer_name ?? before?.customer_name ?? null,
        estimated_value: after.estimated_value ?? before?.estimated_value ?? null,
        from_stage_id: before?.stage_id ?? null,
        to_stage_id: after.stage_id ?? stageId ?? null,
        details: {
          from_stage_code: before?.stage_code || null,
          to_stage_code: after.stage_code || stageCode || null,
          source: 'KANBAN_MOVE',
          status_type_id: after.status_type_id ?? before?.status_type_id ?? null,
        },
      });
    } catch (e) {
      console.warn('[crmDealsApi] logAction MOVE_STAGE falhou:', e?.message || e);
    }

    return { ok: true, data: detail.data };
  } catch (err) {
    return buildError(err, 'crmDealsApi.moveDealToStage');
  }
}
