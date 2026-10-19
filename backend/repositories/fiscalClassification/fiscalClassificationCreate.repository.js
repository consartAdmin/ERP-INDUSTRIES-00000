// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationCreate.repository.js — create                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './fiscalClassification.constants.js';
import { toNumOrNull } from './fiscalClassification.sanitizers.js';
import { normalizeRow } from './fiscalClassification.mappers.js';

/* ──────────────────────────────────────────────────────────────
   CRUD
────────────────────────────────────────────────────────────── */
export async function create(payload = {}) {
  const {
    classification_name,
    description,
    ncm_code,
    cest_code,
    ncm_description,
    cest_description,
    fiscal_profile_id,
    is_active
  } = payload;

  const sql = `
    INSERT INTO ${TB} (
      classification_name, description,
      ncm_code, cest_code,
      ncm_description, cest_description,
      fiscal_profile_id, is_active
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *;
  `;

  const values = [
    classification_name,
    description ?? null,
    ncm_code ?? null,
    cest_code ?? null,
    ncm_description ?? null,
    cest_description ?? null,
    toNumOrNull(fiscal_profile_id),
    is_active ?? true
  ];

  const { rows } = await pool.query(sql, values);
  return normalizeRow(rows[0]);
}
