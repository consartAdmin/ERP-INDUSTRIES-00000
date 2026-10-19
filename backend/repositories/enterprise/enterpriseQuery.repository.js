// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseQuery.repository.js — list / count / findActive / findForPdf ║
// ║ Tabela: enterprises                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { catalog_schema } from './enterprise.constants.js';
import { normalizeBoolean } from './enterprise.sanitizers.js';
import { ensureTable } from './enterpriseSchema.repository.js';

export async function list({ q = '', is_active, limit = 50, offset = 0 } = {}) {
  await ensureTable();

  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    where.push(`(
      corporate_name ILIKE $${idx}
      OR trade_name ILIKE $${idx}
      OR cnpj ILIKE $${idx}
      OR email ILIKE $${idx}
      OR city ILIKE $${idx}
    )`);
  }

  if (is_active !== undefined && is_active !== null && is_active !== '') {
    params.push(normalizeBoolean(is_active));
    where.push(`is_active = $${params.length}`);
  }

  params.push(limit);
  const limitIndex = params.length;

  params.push(offset);
  const offsetIndex = params.length;

  const sql = `
    SELECT *
    FROM ${catalog_schema.table}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${catalog_schema.defaultOrder}
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function count({ q = '', is_active } = {}) {
  await ensureTable();

  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    where.push(`(
      corporate_name ILIKE $${idx}
      OR trade_name ILIKE $${idx}
      OR cnpj ILIKE $${idx}
      OR email ILIKE $${idx}
      OR city ILIKE $${idx}
    )`);
  }

  if (is_active !== undefined && is_active !== null && is_active !== '') {
    params.push(normalizeBoolean(is_active));
    where.push(`is_active = $${params.length}`);
  }

  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM ${catalog_schema.table}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `, params);

  return rows[0]?.total || 0;
}

export async function findActive() {
  await ensureTable();

  const { rows } = await pool.query(`
    SELECT *
    FROM ${catalog_schema.table}
    WHERE is_active = TRUE
    ORDER BY id ASC
    LIMIT 1
  `);

  return rows[0] || null;
}

/**
 * Retorna somente os dados públicos necessários para cabeçalhos de documentos.
 * Se enterpriseId não for informado, utiliza a primeira empresa ativa.
 */
export async function findForPdf({ enterpriseId = null } = {}) {
  await ensureTable();

  const params = [];
  let whereSql = 'WHERE is_active = TRUE';

  if (enterpriseId !== undefined && enterpriseId !== null && enterpriseId !== '') {
    const normalizedId = Number(enterpriseId);

    if (!Number.isSafeInteger(normalizedId) || normalizedId <= 0) {
      throw new Error('Invalid enterprise ID.');
    }

    params.push(normalizedId);
    whereSql = 'WHERE id = $1 AND is_active = TRUE';
  }

  const { rows } = await pool.query(`
    SELECT
      id,
      corporate_name,
      trade_name,
      cnpj,
      state_registration,
      zip_code,
      address,
      address_number,
      address_complement,
      district,
      city,
      state,
      phone,
      whatsapp,
      email,
      website,
      logo_url,
      slogan,
      document_notes,
      pdf_footer
    FROM ${catalog_schema.table}
    ${whereSql}
    ORDER BY id ASC
    LIMIT 1
  `, params);

  return rows[0] || null;
}
