// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissionsLookups.repository.js — listPrices / listSellers   ║
// ║ Auxiliares p/ frontend (dropdowns)                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRICES, TB_SELLERS } from './priceCommissions.constants.js';

// ======================================================================
// Auxiliares p/ frontend
// ======================================================================
export async function listPrices({ activeOnly = true } = {}) {
  const sql = `
    SELECT price_id, name, description, active
    FROM ${TB_PRICES}
    ${activeOnly ? 'WHERE active IS DISTINCT FROM FALSE' : ''}
    ORDER BY name ASC
  `;
  try {
    const r = await pool.query(sql);
    return { ok: true, rows: r.rows };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function listSellers({ activeOnly = true } = {}) {
  const sql = `
    SELECT id, name, nickname, active
    FROM ${TB_SELLERS}
    ${activeOnly ? 'WHERE active IS DISTINCT FROM FALSE' : ''}
    ORDER BY name ASC
  `;
  try {
    const r = await pool.query(sql);
    return { ok: true, rows: r.rows };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
