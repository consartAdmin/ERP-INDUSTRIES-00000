// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsartDealsCreate.repository.js — createDeal (transação)       ║
// ║ Tabela: public."crmDealsReativation"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmConsart.utils.js';
import { fetchCustomerName, fetchSellerName } from './crmConsartLookup.repository.js';
import { getDealById } from './crmConsartDealsQuery.repository.js';

export async function createDeal(payload = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let stageId = payload.stageId || payload.stage_id || null;
    if (!stageId && payload.stageCode) {
      const stageRes = await client.query(
        `
          SELECT id
          FROM public."crmStagesReativation"
          WHERE UPPER(code) = UPPER($1)
        `,
        [payload.stageCode]
      );
      stageId = stageRes.rows[0]?.id || null;
    }
    if (!stageId) throw new Error('STAGE_REQUIRED');

    let customerName = payload.customer_name || null;
    if (!customerName && payload.customer_id) {
      customerName = await fetchCustomerName(payload.customer_id);
    }
    if (!customerName) customerName = 'Cliente não informado';

    let sellerName = payload.seller_name || null;
    if (!sellerName && payload.seller_id) {
      sellerName = await fetchSellerName(payload.seller_id);
    }

    const sql = `
      INSERT INTO public."crmDealsReativation" (
        stage_id,
        customer_id,
        seller_id,
        customer_name,
        seller_name,
        estimated_value,
        tag,
        next_step,
        last_activity_date,
        notes
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      RETURNING id
    `;

    const values = [
      stageId,
      payload.customer_id || null,
      payload.seller_id || null,
      customerName,
      sellerName,
      payload.estimated_value ?? null,
      payload.tag || null,
      payload.next_step || null,
      payload.last_activity_date || null,
      payload.notes || null,
    ];

    const { rows } = await client.query(sql, values);
    const newId = rows[0].id;

    await client.query('COMMIT');

    const detail = await getDealById(newId);
    if (!detail.ok) return { ok: true, data: { id: newId } };
    return { ok: true, data: detail.data };
  } catch (err) {
    await client.query('ROLLBACK');
    return buildError(err, 'crmConsartApi.createDeal');
  } finally {
    client.release();
  }
}
