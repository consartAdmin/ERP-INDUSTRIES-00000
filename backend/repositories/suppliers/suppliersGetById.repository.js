// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliersGetById.repository.js — getById                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS } from './suppliers.constants.js';
import { ok, fail } from './suppliers.utils.js';
import { normalizeRow } from './suppliers.mappers.js';

/* ──────────────────────────────────────────────────────────────
   getById — busca fornecedor por ID
────────────────────────────────────────────────────────────── */
export async function getById(id) {
  try {
    const supplierId = Number(id);
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      return fail('ID inválido', 400);
    }

    const { rows } = await pool.query(
      `
      SELECT
        ${ALIAS}.supplier_id,
        ${ALIAS}.name,
        ${ALIAS}.tax_id,
        ${ALIAS}.state_registration,
        ${ALIAS}.phone,
        ${ALIAS}.email,
        ${ALIAS}.website,
        ${ALIAS}.login,
        ${ALIAS}.password,
        ${ALIAS}.observations,
        ${ALIAS}.address,
        ${ALIAS}.address_street_type,
        ${ALIAS}.address_street,
        ${ALIAS}.address_number,
        ${ALIAS}.address_complement,
        ${ALIAS}.address_district,
        ${ALIAS}.city,
        ${ALIAS}.state,
        ${ALIAS}.postal_code,
        ${ALIAS}.sales_rep,
        ${ALIAS}.sales_rep_email,
        ${ALIAS}.finance_email
        ,${ALIAS}.chart_account_id
        ,coa.code AS chart_account_code
        ,coa.description AS chart_account_description
        ,${ALIAS}.cash_category_id
        ,cc.name AS cash_category_name
        ,${ALIAS}.cash_subcategory_id
        ,csc.name AS cash_subcategory_name
      FROM ${TB} ${ALIAS}
      LEFT JOIN public."chartOfAccounts" coa ON coa.id = ${ALIAS}.chart_account_id
      LEFT JOIN public."cashCategories" cc ON cc.id = ${ALIAS}.cash_category_id
      LEFT JOIN public."cashSubcategories" csc ON csc.id = ${ALIAS}.cash_subcategory_id
      WHERE ${ALIAS}.supplier_id = $1;
      `,
      [supplierId]
    );

    if (!rows.length) {
      return fail('Fornecedor não encontrado', 404);
    }

    return ok(normalizeRow(rows[0]));
  } catch (err) {
    console.error('[suppliersApi:getById] Erro:', err);
    return fail(err.message || 'Erro ao buscar fornecedor', 500);
  }
}
