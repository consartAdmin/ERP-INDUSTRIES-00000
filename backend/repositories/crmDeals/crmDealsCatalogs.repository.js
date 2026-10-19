// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsCatalogs.repository.js — listStatusTypes /                 ║
// ║ listLeadSources / listDealOutcomes                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmDeals.utils.js';
import { getCustomerStatusTypesCols } from './crmDealsMeta.repository.js';
import { erpTable } from '../../utils/erpCompanyContext.js';

/* =========================================================================
 * STATUS TYPES
 * ========================================================================= */
export async function listStatusTypes({ active = true } = {}) {
  try {
    const cols = await getCustomerStatusTypesCols();
    const has = (c) => cols.has(c);

    const codeExpr =
      has('code') ? 't.code' :
        has('internal_code') ? 't.internal_code' :
          has('status_code') ? 't.status_code' :
            has('codigo') ? 't.codigo' :
              'NULL';

    const namePtExpr =
      has('name_pt') ? 't.name_pt' :
        has('nome_pt') ? 't.nome_pt' :
          'NULL';

    const nameExpr =
      has('name') ? 't.name' :
        has('nome') ? 't.nome' :
          'NULL';

    const labelExpr =
      has('label') ? 't.label' :
        has('descricao') ? 't.descricao' :
          has('description') ? 't.description' :
            'NULL';

    const colorExpr =
      has('color_hex') ? 't.color_hex' :
        has('status_color_hex') ? 't.status_color_hex' :
          has('color') ? 't.color' :
            has('cor_hex') ? 't.cor_hex' :
              has('cor') ? 't.cor' :
                `'#64748b'`;

    const sortExpr =
      has('sort_order') ? 't.sort_order' :
        has('ordem') ? 't.ordem' :
          has('order') ? 't."order"' :
            '0';

    const activeExpr =
      has('is_active') ? 'COALESCE(t.is_active, TRUE)' :
        has('active') ? 'COALESCE(t.active, TRUE)' :
          'TRUE';

    const sql = `
      SELECT
        t.id,
        ${codeExpr} AS code,
        ${namePtExpr} AS name_pt,
        COALESCE(${namePtExpr}, ${nameExpr}, ${labelExpr}, ${codeExpr}, ('Status #' || t.id::text)) AS name,
        ${colorExpr} AS color_hex,
        COALESCE(${sortExpr}, 0) AS sort_order,
        ${activeExpr} AS is_active
      FROM ${erpTable('public."customerStatusTypes"')} t
      WHERE ${activeExpr} = $1
      ORDER BY COALESCE(${sortExpr}, 0) ASC,
               COALESCE(${namePtExpr}, ${nameExpr}, ${labelExpr}, ${codeExpr}, ('Status #' || t.id::text)) ASC,
               t.id ASC
    `;

    const r = await pool.query(sql, [!!active]);
    return { ok: true, data: r.rows || [] };
  } catch (err) {
    console.error('[crmDealsApi.listStatusTypes] error:', err?.message || err);
    return { ok: false, error: err?.message || 'STATUS_TYPES_LIST_ERROR' };
  }
}

/* =========================================================================
 * LEAD SOURCES
 * ========================================================================= */
export async function listLeadSources({ active = true } = {}) {
  try {
    const sql = `
      SELECT
        id,
        name,
        icon,
        color,
        sort_order,
        is_active,
        created_at
      FROM public."crmLeadSources"
      WHERE COALESCE(is_active, TRUE) = $1
      ORDER BY COALESCE(sort_order, 0) ASC, id ASC
    `;
    const { rows } = await pool.query(sql, [!!active]);
    return { ok: true, data: rows || [] };
  } catch (err) {
    return buildError(err, 'crmDealsApi.listLeadSources');
  }
}

/* =========================================================================
 * DEAL OUTCOMES CATALOG
 * ========================================================================= */
export async function listDealOutcomes({ active = true } = {}) {
  try {
    const sql = `
      SELECT
        id,
        name,
        code,
        icon,
        color,
        sort_order,
        is_active,
        created_at
      FROM public."crmDealsOutcomes"
      WHERE COALESCE(is_active, TRUE) = $1
      ORDER BY COALESCE(sort_order, 0) ASC, id ASC
    `;
    const { rows } = await pool.query(sql, [!!active]);
    return { ok: true, data: rows || [] };
  } catch (err) {
    return buildError(err, 'crmDealsApi.listDealOutcomes');
  }
}
