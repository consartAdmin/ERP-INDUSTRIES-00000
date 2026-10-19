// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsartOutcomes.repository.js — registerOutcome /               ║
// ║ getOutcomesSummary | Tabela: "crmDealsReativationOutcomes"         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmConsart.utils.js';

/* =========================================================================
 * OUTCOMES (Conversão / Queda de venda)
 * ========================================================================= */

export async function registerOutcome({ dealId, outcomeType, note, reason, userId }) {
  const client = await pool.connect();
  try {
    const type = String(outcomeType || '').toUpperCase();
    if (!type || !['CONVERSION', 'LOSS'].includes(type)) {
      return { ok: false, error: 'INVALID_OUTCOME_TYPE' };
    }

    await client.query('BEGIN');

    const dealRes = await client.query(
      `
        SELECT
          id,
          stage_id,
          seller_id,
          customer_id,
          estimated_value
        FROM public."crmDealsReativation"
        WHERE id = $1
        FOR UPDATE
      `,
      [dealId]
    );

    const deal = dealRes.rows[0];
    if (!deal) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'DEAL_NOT_FOUND' };
    }

    await client.query(
      `
        UPDATE public."crmDealsReativation"
        SET
          is_closed = TRUE,
          last_activity_date = COALESCE(last_activity_date, now())
        WHERE id = $1
      `,
      [dealId]
    );

    const estimatedValue = deal.estimated_value ?? null;
    const valueAtMoment = estimatedValue;

    const insRes = await client.query(
      `
        INSERT INTO public."crmDealsReativationOutcomes" (
          deal_id,
          outcome_type,
          outcome_source,
          stage_id,
          seller_id,
          customer_id,
          estimated_value,
          note,
          outcome_reason,
          notes,
          value_at_moment,
          created_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        RETURNING id, created_at
      `,
      [
        dealId,
        type,
        'KANBAN_DROP',
        deal.stage_id || null,
        deal.seller_id || null,
        deal.customer_id || null,
        estimatedValue,
        note || null,
        reason || null,
        note || null,
        valueAtMoment,
        userId || null,
      ]
    );

    await client.query('COMMIT');

    return {
      ok: true,
      data: {
        id: insRes.rows[0].id,
        deal_id: dealId,
        outcome_type: type,
        created_at: insRes.rows[0].created_at,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    return buildError(err, 'crmConsartApi.registerOutcome');
  } finally {
    client.release();
  }
}

export async function getOutcomesSummary({ sellerId } = {}) {
  try {
    const params = [];
    let where = 'WHERE 1=1';

    if (sellerId) {
      params.push(sellerId);
      where += ` AND o.seller_id = $${params.length}`;
    }

    const sql = `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN o.outcome_type = 'CONVERSION'
              THEN COALESCE(o.value_at_moment, o.estimated_value, 0)
              ELSE 0
            END
          ),
          0
        ) AS total_converted,
        COALESCE(
          SUM(
            CASE
              WHEN o.outcome_type IN ('LOSS', 'LOST')
              THEN COALESCE(o.value_at_moment, o.estimated_value, 0)
              ELSE 0
            END
          ),
          0
        ) AS total_lost,
        COALESCE(
          SUM(
            CASE
              WHEN o.outcome_type = 'CONVERSION' THEN 1
              ELSE 0
            END
          ),
          0
        ) AS count_converted,
        COALESCE(
          SUM(
            CASE
              WHEN o.outcome_type IN ('LOSS', 'LOST') THEN 1
              ELSE 0
            END
          ),
          0
        ) AS count_lost
      FROM public."crmDealsReativationOutcomes" o
      ${where}
    `;

    const { rows } = await pool.query(sql, params);
    const row = rows[0] || {
      total_converted: 0,
      total_lost: 0,
      count_converted: 0,
      count_lost: 0,
    };

    return { ok: true, data: row };
  } catch (err) {
    return buildError(err, 'crmConsartApi.getOutcomesSummary');
  }
}
