// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesPerformanceLookups.repository.js — vendedores / status types  ║
// ║ Tabelas: public.sellers, public."customerStatusTypes"              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_SELLERS, TB_STATUS_TYPES } from './salesPerformance.constants.js';

/* ======================================================================
   SELLERS
   ====================================================================== */

export async function listSalesPerformanceSellers() {
  const sql = `
    SELECT
      s.id,
      s.name AS nome
    FROM ${TB_SELLERS} s
    WHERE COALESCE(s.active, true) = true
    ORDER BY s.name ASC
  `;

  const { rows } = await pool.query(sql);
  return rows;
}

/* ======================================================================
   STATUS TYPES
   ====================================================================== */

export async function listSalesPerformanceStatusTypes() {
  const sql = `
    SELECT
      st.id,
      st.name_pt,
      st.internal_code,
      st.description_en,
      st.color_hex,
      st.sort_order,
      st.is_active
    FROM ${TB_STATUS_TYPES} st
    WHERE st.is_active = true
    ORDER BY st.sort_order ASC, st.name_pt ASC
  `;

  const { rows } = await pool.query(sql);
  return rows;
}
