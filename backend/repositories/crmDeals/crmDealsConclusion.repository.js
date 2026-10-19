// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsConclusion.repository.js — concludeLeadStatusType /        ║
// ║ getLeadConclusionSummary (dropzone + topo)                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import perfApi from '../crmDealsPerformance/crmDealsPerformance.index.js';
import { buildError, toNumOrNull, normalizeSellerIdsArr, normalizeCrmCompany } from './crmDeals.utils.js';
import { getCustomerStatusTypesCols } from './crmDealsMeta.repository.js';
import { upsertCustomerStatus, syncCustomerActivityFromOutcome } from './crmDealsSync.repository.js';
import { erpTable } from '../../utils/erpCompanyContext.js';

/* =========================================================================
 * CONCLUSÃO DO LEAD (DROPZONE)
 * ========================================================================= */
export async function concludeLeadStatusType({ dealId, statusTypeId, note = null, userId = null }) {
  const client = await pool.connect();

  try {
    const dId = Number(dealId);
    const stId = toNumOrNull(statusTypeId);

    if (!Number.isFinite(dId)) return { ok: false, error: 'INVALID_DEAL_ID' };
    if (!Number.isFinite(stId)) return { ok: false, error: 'INVALID_STATUS_TYPE_ID' };

    await client.query('BEGIN');

    const curRes = await client.query(
      `
        SELECT id,
               stage_id,
               seller_id,
               seller_name,
               customer_id,
               customer_name,
               estimated_value,
               status_type_id,
               is_closed
        FROM public."crmDeals"
        WHERE id = $1
        FOR UPDATE
      `,
      [dId]
    );

    const cur = curRes.rows[0];
    if (!cur) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'DEAL_NOT_FOUND' };
    }

    const cols = await getCustomerStatusTypesCols();
    const activeExpr = cols.has('is_active')
      ? 'COALESCE(t.is_active, TRUE)'
      : cols.has('active')
        ? 'COALESCE(t.active, TRUE)'
        : 'TRUE';

    const chk = await client.query(
      `
        SELECT t.id
        FROM ${erpTable('public."customerStatusTypes"')} t
        WHERE t.id = $1
          AND ${activeExpr} = TRUE
        LIMIT 1
      `,
      [stId]
    );

    if (!chk.rowCount) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'STATUS_TYPE_NOT_FOUND' };
    }

    await client.query(
      `
        UPDATE public."crmDeals"
        SET
          status_type_id     = $2,
          is_closed          = TRUE,
          last_activity_date = now(),
          updated_at         = now()
        WHERE id = $1
      `,
      [dId, stId]
    );

    await upsertCustomerStatus({
      client,
      customerId: cur.customer_id,
      statusTypeId: stId,
      note: note || null,
      updatedBy: userId || null,
    });

    await client.query('COMMIT');

    // 🔥 TENTA MAPEAR STATUS → OUTCOME (fallback inteligente)
    try {
      let outcomeId = null;

      // tentativa simples de inferência (você pode sofisticar depois)
      if (stId === 1) outcomeId = 3; // ex: ativo → conversão
      if (stId === 2) outcomeId = 2; // ex: risco → perda
      if (stId === 3) outcomeId = 1; // ex: sem contato

      if (cur.customer_id && outcomeId) {
        await syncCustomerActivityFromOutcome({
          dealId: dId,
          customerId: cur.customer_id,
          outcomeId,
        });
      }

    } catch (e) {
      console.warn('[crmDealsApi] sync via concludeLead falhou:', e?.message || e);
    }

    try {
      await perfApi.logAction({
        action_type: 'CONCLUDE_LEAD_STATUS',
        deal_id: dId,
        stage_id: cur.stage_id ?? null,
        stage_code: null,
        seller_id: cur.seller_id ?? null,
        seller_name: cur.seller_name ?? null,
        customer_id: cur.customer_id ?? null,
        customer_name: cur.customer_name ?? null,
        estimated_value: cur.estimated_value ?? null,
        user_id: userId || null,
        details: {
          status_type_id: stId,
          note: note || null,
          source: 'KANBAN_DROPZONE',
        },
      });
    } catch (e) {
      console.warn('[crmDealsApi] logAction CONCLUDE falhou:', e?.message || e);
    }

    return {
      ok: true,
      data: { id: dId, status_type_id: stId, is_closed: true },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    return buildError(err, 'crmDealsApi.concludeLeadStatusType');
  } finally {
    client.release();
  }
}

/* =========================================================================
 * SUMMARY — Conclusão do Lead (topo)
 * ========================================================================= */
export async function getLeadConclusionSummary({ company, sellerId, sellerIds } = {}) {
  try {
    const params = [normalizeCrmCompany(company)];
    let where = `WHERE COALESCE(d.is_closed, FALSE) = TRUE AND d.status_type_id IS NOT NULL AND d.crm_company = $1`;

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
        d.status_type_id,
        COUNT(*)::int AS count_cards,
        COALESCE(SUM(COALESCE(d.estimated_value, 0)), 0) AS total_value
      FROM public."crmDeals" d
      ${where}
      GROUP BY d.status_type_id
      ORDER BY d.status_type_id ASC
    `;

    const { rows } = await pool.query(sql, params);
    return { ok: true, data: rows || [] };
  } catch (err) {
    return buildError(err, 'crmDealsApi.getLeadConclusionSummary');
  }
}
