// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsQuery.repository.js — listDeals / getDealById              ║
// ║ Tabela: public."crmDeals" (Kanban mostra só abertos)               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError, normalizeSellerIdsArr, normalizeCrmCompany } from './crmDeals.utils.js';
import { mapDealRow } from './crmDeals.mappers.js';
import { erpTable } from '../../utils/erpCompanyContext.js';

/* =========================================================================
 * DEALS (KANBAN mostra só ABERTOS)
 * ========================================================================= */

export async function listDeals({ company, stageCode, stageId, sellerId, sellerIds, search, state, city, segmentId, limit = 50, offset = 0 } = {}) {
  try {
    const params = [normalizeCrmCompany(company)];
    let where = 'WHERE COALESCE(d.is_closed, FALSE) = FALSE AND d.crm_company = $1';

    if (stageId) {
      params.push(stageId);
      where += ` AND d.stage_id = $${params.length}`;
    } else if (stageCode) {
      params.push(stageCode);
      where += ` AND UPPER(COALESCE(s.code, s.stage_code)) = UPPER($${params.length})`;
    }

    const scopeIds = normalizeSellerIdsArr(sellerIds);
    if (scopeIds?.length) {
      params.push(scopeIds);
      where += ` AND d.seller_id = ANY($${params.length})`;
    } else if (sellerId) {
      params.push(Number(sellerId));
      where += ` AND d.seller_id = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toUpperCase()}%`);
      where += ` AND (
        UPPER(COALESCE(d.customer_name, '')) LIKE $${params.length}
        OR UPPER(COALESCE(d.seller_name, '')) LIKE $${params.length}
        OR UPPER(COALESCE(ls.name, '')) LIKE $${params.length}
      )`;
    }

    // Filtros pelo cadastro do cliente (Estado, Cidade, Segmento)
    const customerCond = [];
    if (state && String(state).trim()) {
      params.push(String(state).trim().toUpperCase());
      customerCond.push(`UPPER(TRIM(c.state)) = $${params.length}`);
    }
    if (city && String(city).trim()) {
      params.push(String(city).trim().toUpperCase());
      customerCond.push(`UPPER(TRIM(c.city)) = $${params.length}`);
    }
    if (Number(segmentId) > 0) {
      params.push(Number(segmentId));
      customerCond.push(`c.segment_id = $${params.length}`);
    }
    if (customerCond.length) {
      where += ` AND EXISTS (
        SELECT 1 FROM ${erpTable('public."customers"')} c
         WHERE c.customer_id = d.customer_id AND ${customerCond.join(' AND ')}
      )`;
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT
        d.id,
        d.stage_id,
        COALESCE(s.code, s.stage_code) AS stage_code,
        s.stage_name AS stage_name,

        d.customer_id,
        d.customer_name,

        d.seller_id,
        d.seller_name,

        d.estimated_value,

        d.lead_source_id,
        ls.name AS lead_source_name,

        d.status_type_id,
        cst.name_pt       AS status_name_pt,
        cst.internal_code AS status_code,
        cst.color_hex     AS status_color_hex,

        d.outcome,
        d.outcome_at,
        d.outcome_id,
        o.name AS outcome_name,
        o.code AS outcome_code,

        d.loss_reason_id,
        lr.reason_name AS loss_reason_name,
        d.loss_notes,

        d.tag,
        d.next_step,
        d.last_activity_date,
        d.notes,

        d.is_closed,
        d.crm_company,

        d.created_at,
        d.updated_at
      FROM public."crmDeals" d
      JOIN public."crmDealsStages" s ON s.id = d.stage_id
      LEFT JOIN ${erpTable('public."customerStatusTypes"')} cst ON cst.id = d.status_type_id
      LEFT JOIN public."crmLeadSources" ls ON ls.id = d.lead_source_id
      LEFT JOIN public."crmDealsOutcomes" o ON o.id = d.outcome_id
      LEFT JOIN public."crmLossReasons" lr ON lr.id = d.loss_reason_id
      ${where}
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const { rows } = await pool.query(sql, params);
    return { ok: true, data: rows.map(mapDealRow) };
  } catch (err) {
    return buildError(err, 'crmDealsApi.listDeals');
  }
}

export async function getDealById(id) {
  try {
    const sql = `
      SELECT
        d.id,
        d.stage_id,
        COALESCE(s.code, s.stage_code) AS stage_code,
        s.stage_name AS stage_name,

        d.customer_id,
        d.customer_name,

        d.seller_id,
        d.seller_name,

        d.estimated_value,

        d.lead_source_id,
        ls.name AS lead_source_name,

        d.status_type_id,
        cst.name_pt       AS status_name_pt,
        cst.internal_code AS status_code,
        cst.color_hex     AS status_color_hex,

        d.outcome,
        d.outcome_at,
        d.outcome_id,
        o.name AS outcome_name,
        o.code AS outcome_code,

        d.loss_reason_id,
        lr.reason_name AS loss_reason_name,
        d.loss_notes,

        d.tag,
        d.next_step,
        d.last_activity_date,
        d.notes,

        d.is_closed,
        d.crm_company,

        d.created_at,
        d.updated_at
      FROM public."crmDeals" d
      JOIN public."crmDealsStages" s ON s.id = d.stage_id
      LEFT JOIN ${erpTable('public."customerStatusTypes"')} cst ON cst.id = d.status_type_id
      LEFT JOIN public."crmLeadSources" ls ON ls.id = d.lead_source_id
      LEFT JOIN public."crmDealsOutcomes" o ON o.id = d.outcome_id
      LEFT JOIN public."crmLossReasons" lr ON lr.id = d.loss_reason_id
      WHERE d.id = $1
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows[0]) return { ok: false, error: 'DEAL_NOT_FOUND' };
    return { ok: true, data: mapDealRow(rows[0]) };
  } catch (err) {
    return buildError(err, 'crmDealsApi.getDealById');
  }
}

/* =========================================================================
 * Estados e cidades dos clientes (opções dos filtros do Kanban)
 * ========================================================================= */

export async function listCustomerLocations() {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT UPPER(TRIM(state)) AS state, TRIM(city) AS city
        FROM ${erpTable('public."customers"')}
       WHERE COALESCE(TRIM(state), '') <> '' AND COALESCE(TRIM(city), '') <> ''
       ORDER BY 1, 2
    `);
    return { ok: true, data: rows };
  } catch (err) {
    return buildError(err, 'CUSTOMER_LOCATIONS_ERROR');
  }
}
