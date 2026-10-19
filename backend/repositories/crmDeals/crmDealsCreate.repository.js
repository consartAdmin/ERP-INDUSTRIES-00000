// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsCreate.repository.js — createDeal (transação +             ║
// ║ customerStatus + CustomerActivity + logAction)                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import perfApi from '../crmDealsPerformance/crmDealsPerformance.index.js';
import { buildError, normalizeCrmCompany } from './crmDeals.utils.js';
import {
  normalizeStatusTypeId,
  normalizeLeadSourceId,
  normalizeOutcomeId,
  normalizeLossReasonId,
} from './crmDeals.sanitizers.js';
import { fetchCustomerName, fetchSellerName } from './crmDealsLookup.repository.js';
import { upsertCustomerStatus, syncCustomerActivityFromOutcome } from './crmDealsSync.repository.js';
import { getDealById } from './crmDealsQuery.repository.js';

export async function createDeal(payload = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let stageId = payload.stageId || payload.stage_id || null;
    let stageCode = payload.stageCode || payload.stage_code || null;

    if (!stageId && stageCode) {
      const stageRes = await client.query(
        `
          SELECT id, COALESCE(code, stage_code) AS code
          FROM public."crmDealsStages"
          WHERE UPPER(COALESCE(code, stage_code)) = UPPER($1)
          LIMIT 1
        `,
        [stageCode]
      );
      stageId = stageRes.rows[0]?.id || null;
      stageCode = stageRes.rows[0]?.code || stageCode;
    }

    if (!stageId) throw new Error('STAGE_REQUIRED');

    let customerName = payload.customer_name || null;
    if (!customerName && payload.customer_id) customerName = await fetchCustomerName(payload.customer_id);
    if (!customerName) customerName = 'Cliente não informado';

    let sellerName = payload.seller_name || null;
    if (!sellerName && payload.seller_id) sellerName = await fetchSellerName(payload.seller_id);

    const lastActivityDate =
      payload.last_activity_date ??
      payload.lastActivityDate ??
      payload.lastActivity ??
      payload.last_activity ??
      new Date();

    const notesValue = payload.notes ?? payload.note ?? payload.observation ?? payload.obs ?? null;

    const statusTypeId = normalizeStatusTypeId(payload);
    const leadSourceId = normalizeLeadSourceId(payload);
    const outcomeId = normalizeOutcomeId(payload);
    const lossReasonId = normalizeLossReasonId(payload);
    const lossNotes = payload.loss_notes ?? payload.lossNotes ?? null;

    const sql = `
      INSERT INTO public."crmDeals" (
        stage_id,
        customer_id,
        seller_id,
        customer_name,
        seller_name,
        estimated_value,
        lead_source_id,
        status_type_id,
        outcome_id,
        loss_reason_id,
        loss_notes,
        tag,
        next_step,
        last_activity_date,
        notes,
        crm_company
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id, customer_id, status_type_id, stage_id
    `;

    const values = [
      stageId,
      payload.customer_id ?? null,
      payload.seller_id ?? null,
      customerName,
      sellerName,
      payload.estimated_value ?? null,
      leadSourceId,
      statusTypeId,
      outcomeId,
      lossReasonId,
      lossNotes,
      payload.tag ?? null,
      payload.next_step ?? null,
      lastActivityDate,
      notesValue,
      normalizeCrmCompany(payload.crm_company),
    ];

    const { rows } = await client.query(sql, values);
    const newId = rows[0].id;

    await upsertCustomerStatus({
      client,
      customerId: rows[0].customer_id,
      statusTypeId: rows[0].status_type_id,
      note: notesValue,
      updatedBy: payload.updated_by ?? payload.updatedBy ?? null,
    });

    await client.query('COMMIT');

    // ✅ CORREÇÃO AQUI
    await syncCustomerActivityFromOutcome({
      dealId: newId,
      customerId: rows[0].customer_id,
      outcomeId: outcomeId,
    });

    const detail = await getDealById(newId);
    if (!detail.ok) return { ok: true, data: { id: newId } };

    try {
      await perfApi.logAction({
        action_type: 'CREATE_DEAL',
        deal_id: detail.data.id,
        stage_id: detail.data.stage_id,
        stage_code: detail.data.stage_code || stageCode || null,
        seller_id: detail.data.seller_id,
        seller_name: detail.data.seller_name,
        customer_id: detail.data.customer_id,
        customer_name: detail.data.customer_name,
        estimated_value: detail.data.estimated_value ?? null,
        details: {
          source: 'API',
          payloadKeys: Object.keys(payload || {}),
          status_type_id: detail.data.status_type_id ?? null,
          lead_source_id: detail.data.lead_source_id ?? null,
        },
      });
    } catch (e) {
      console.warn('[crmDealsApi] logAction CREATE_DEAL falhou:', e?.message || e);
    }

    return { ok: true, data: detail.data };
  } catch (err) {
    await client.query('ROLLBACK');
    return buildError(err, 'crmDealsApi.createDeal');
  } finally {
    client.release();
  }
}
