// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcome.repository.js — registerOutcome /                  ║
// ║ getOutcomesSummary / listOutcomes                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import perfApi from '../crmDealsPerformance/crmDealsPerformance.index.js';
import { buildError, toPositiveNumOrNull, normalizeSellerIdsArr, normalizeCrmCompany } from './crmDeals.utils.js';
import { normalizeOutcomeType } from './crmDeals.sanitizers.js';
import { fetchCustomerName, fetchSellerName } from './crmDealsLookup.repository.js';
import { syncCustomerActivityFromOutcome } from './crmDealsSync.repository.js';

/* =========================================================================
 * OUTCOMES
 * ========================================================================= */

export async function registerOutcome({ dealId, outcomeType, outcomeId, note, reason, userId, lossReasonId = null }) {
  const client = await pool.connect();

  try {
    const normalizedType = normalizeOutcomeType(outcomeType, outcomeId);
    if (!normalizedType) return { ok: false, error: 'INVALID_OUTCOME_TYPE' };

    await client.query('BEGIN');

    const dealRes = await client.query(
      `
        SELECT
          d.id,
          d.stage_id,
          d.seller_id,
          d.customer_id,
          d.estimated_value,
          d.customer_name,
          d.seller_name
        FROM public."crmDeals" d
        WHERE d.id = $1
        FOR UPDATE
      `,
      [dealId]
    );

    const deal = dealRes.rows[0];
    if (!deal) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'DEAL_NOT_FOUND' };
    }

    let sellerName = deal.seller_name ?? null;
    let customerName = deal.customer_name ?? null;

    try {
      if (!sellerName && deal.seller_id) sellerName = await fetchSellerName(deal.seller_id);
      if (!customerName && deal.customer_id) customerName = await fetchCustomerName(deal.customer_id);
    } catch (_) { }

    const normalizedOutcomeId = toPositiveNumOrNull(outcomeId);
    const normalizedLossReasonId = toPositiveNumOrNull(lossReasonId);

    await client.query(
      `
    UPDATE public."crmDeals"
    SET
      is_closed          = TRUE,
      outcome            = $2,
      outcome_id         = $3,
      outcome_at         = NOW(),
      loss_reason_id     = $4,
      loss_notes         = $5,
      last_activity_date = NOW(),
      updated_at         = NOW()
    WHERE id = $1
  `,
      [
        dealId,
        normalizedType,
        normalizedOutcomeId,
        normalizedLossReasonId,
        note || null,
      ]
    );

    await client.query('COMMIT');

    await syncCustomerActivityFromOutcome({
      dealId,
      customerId: deal.customer_id,
      outcomeId: normalizedOutcomeId,
    });

    try {
      let stageCode = null;

      try {
        const st = await pool.query(
          `
        SELECT COALESCE(code, stage_code) AS code
        FROM public."crmDealsStages"
        WHERE id = $1
        LIMIT 1
      `,
          [deal.stage_id]
        );
        stageCode = st.rows[0]?.code || null;
      } catch (_) { }

      await perfApi.logAction({
        action_type: normalizedType === 'CONVERSION' ? 'OUTCOME_CONVERSION' : 'OUTCOME_LOSS',
        deal_id: dealId,
        stage_id: deal.stage_id || null,
        stage_code: stageCode || null,
        seller_id: deal.seller_id || null,
        seller_name: sellerName || null,
        customer_id: deal.customer_id || null,
        customer_name: customerName || null,
        estimated_value: deal.estimated_value ?? null,
        value_at_moment: deal.estimated_value ?? null,
        user_id: userId || null,
        details: {
          source: 'KANBAN_DROP',
          outcome_catalog_id: normalizedOutcomeId,
          outcome_type: normalizedType,
          reason: reason || null,
          note: note || null,
          loss_reason_id: normalizedLossReasonId,
        },
      });
    } catch (e) {
      console.warn('[crmDealsApi] logAction OUTCOME falhou:', e?.message || e);
    }

    return {
      ok: true,
      data: {
        deal_id: Number(dealId),
        outcome_id: normalizedOutcomeId,
        loss_reason_id: normalizedLossReasonId,
        outcome_type: normalizedType,
        is_closed: true,
        outcome_at: new Date().toISOString(),
      },
    };

  } catch (err) {
    await client.query('ROLLBACK');
    return buildError(err, 'crmDealsApi.registerOutcome');
  } finally {
    client.release();
  }
}

export async function getOutcomesSummary({ company, sellerId, sellerIds } = {}) {
  try {
    const params = [normalizeCrmCompany(company)];
    let where = `WHERE COALESCE(d.is_closed, FALSE) = TRUE AND d.crm_company = $1`;

    const scopeIds = normalizeSellerIdsArr(sellerIds);
    if (scopeIds?.length) {
      params.push(scopeIds);
      where += ` AND d.seller_id = ANY($${params.length})`;
    } else if (sellerId) {
      params.push(Number(sellerId));
      where += ` AND d.seller_id = $${params.length}`;
    }

    const sql = `
      SELECT
        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(d.outcome, '')) = 'CONVERSION' THEN COALESCE(d.estimated_value, 0)
            ELSE 0
          END
        ), 0) AS total_converted,

        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(d.outcome, '')) IN ('LOSS', 'LOST') THEN COALESCE(d.estimated_value, 0)
            ELSE 0
          END
        ), 0) AS total_lost,

        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(d.outcome, '')) = 'NO_SUCCESS_CONTACT' THEN COALESCE(d.estimated_value, 0)
            ELSE 0
          END
        ), 0) AS total_no_success_contact,

        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(d.outcome, '')) = 'CONVERSION' THEN 1
            ELSE 0
          END
        ), 0) AS count_converted,

        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(d.outcome, '')) IN ('LOSS', 'LOST') THEN 1
            ELSE 0
          END
        ), 0) AS count_lost,

        COALESCE(SUM(
          CASE
            WHEN UPPER(COALESCE(d.outcome, '')) = 'NO_SUCCESS_CONTACT' THEN 1
            ELSE 0
          END
        ), 0) AS count_no_success_contact

      FROM public."crmDeals" d
      ${where}
    `;

    const { rows } = await pool.query(sql, params);
    return { ok: true, data: rows[0] || {} };
  } catch (err) {
    return buildError(err, 'crmDealsApi.getOutcomesSummary');
  }
}

export async function listOutcomes({ company, outcomeType, sellerId, sellerIds, search, limit = 200, offset = 0 } = {}) {
  try {
    const params = [normalizeCrmCompany(company)];
    let where = `WHERE COALESCE(d.crm_company, 'BH3') = $1`;

    if (outcomeType) {
      params.push(String(outcomeType).trim().toUpperCase());
      where += ` AND o.outcome_type = $${params.length}`;
    }

    const scopeIds = normalizeSellerIdsArr(sellerIds);
    if (scopeIds?.length) {
      params.push(scopeIds);
      where += ` AND o.seller_id = ANY($${params.length})`;
    } else if (sellerId) {
      params.push(Number(sellerId));
      where += ` AND o.seller_id = $${params.length}`;
    }

    if (search && String(search).trim()) {
      params.push(`%${String(search).trim().toUpperCase()}%`);
      where += ` AND (
        UPPER(COALESCE(d.customer_name, '')) LIKE $${params.length}
        OR UPPER(COALESCE(d.seller_name, '')) LIKE $${params.length}
        OR UPPER(COALESCE(o.outcome_reason, '')) LIKE $${params.length}
        OR UPPER(COALESCE(o.note, o.notes, '')) LIKE $${params.length}
      )`;
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT
        o.id,
        o.deal_id,
        o.outcome_type,
        o.outcome_reason,
        o.note,
        o.notes,
        o.estimated_value,
        o.seller_id,
        o.customer_id,
        o.stage_id,
        o.created_by,
        o.created_at,
        d.customer_name,
        d.seller_name,
        d.tag,
        d.next_step,
        d.last_activity_date,
        COALESCE(s.code, s.stage_code) AS stage_code,
        s.stage_name AS stage_name
      FROM public."crmDealsOutcomes" o
      LEFT JOIN public."crmDeals" d ON d.id = o.deal_id
      LEFT JOIN public."crmDealsStages" s ON s.id = o.stage_id
      ${where}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const { rows } = await pool.query(sql, params);

    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        deal_id: r.deal_id,
        outcome_type: r.outcome_type,
        outcome_reason: r.outcome_reason,
        note: r.note ?? r.notes ?? null,
        value_at_moment: r.estimated_value ?? null,
        estimated_value: r.estimated_value ?? null,
        created_at: r.created_at,
        seller_id: r.seller_id ?? null,
        seller_name: r.seller_name ?? null,
        customer_id: r.customer_id ?? null,
        customer_name: r.customer_name ?? null,
        stage_id: r.stage_id ?? null,
        stage_code: r.stage_code ?? null,
        stage_name: r.stage_name ?? null,
        tag: r.tag ?? null,
        next_step: r.next_step ?? null,
        last_activity_date: r.last_activity_date ?? null,
      })),
    };
  } catch (err) {
    return buildError(err, 'crmDealsApi.listOutcomes');
  }
}
