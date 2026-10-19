// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliersCreate.repository.js — create                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { SUPPLIERS_INSERT_COLUMNS } from './suppliers.catalog.js';
import { TB, RETURNING_COLUMNS } from './suppliers.constants.js';
import { ok, fail } from './suppliers.utils.js';
import {
  cleanString,
  cleanPositiveInteger,
  normalizeState,
  buildLegacyAddress,
} from './suppliers.sanitizers.js';
import { normalizeRow } from './suppliers.mappers.js';
import { validateFinancialClassification } from './suppliersValidate.repository.js';

/* ──────────────────────────────────────────────────────────────
   create — cria novo fornecedor
────────────────────────────────────────────────────────────── */
export async function create(data = {}) {
  const client = await pool.connect();
  try {
    const payload = {
      name: cleanString(data.name),
      tax_id: cleanString(data.tax_id),
      state_registration: cleanString(data.state_registration),
      phone: cleanString(data.phone),
      email: cleanString(data.email),
      website: cleanString(data.website),
      login: cleanString(data.login),
      password: cleanString(data.password),
      observations: cleanString(data.observations),

      address_street_type: cleanString(data.address_street_type),
      address_street: cleanString(data.address_street),
      address_number: cleanString(data.address_number),
      address_complement: cleanString(data.address_complement),
      address_district: cleanString(data.address_district),
      city: cleanString(data.city),
      state: normalizeState(data.state),
      postal_code: cleanString(data.postal_code),

      sales_rep: cleanString(data.sales_rep),
      sales_rep_email: cleanString(data.sales_rep_email),
      finance_email: cleanString(data.finance_email),
      chart_account_id: cleanPositiveInteger(data.chart_account_id),
      cash_category_id: cleanPositiveInteger(data.cash_category_id),
      cash_subcategory_id: cleanPositiveInteger(data.cash_subcategory_id),
    };

    payload.address =
      cleanString(data.address) ||
      buildLegacyAddress(payload);

    if (!payload.name) {
      return fail('Nome do fornecedor é obrigatório.', 400);
    }

    const validation = await validateFinancialClassification(client, payload);
    if (!validation.ok) return validation;

    const cols = [];
    const vals = [];
    const params = [];

    function add(col, val) {
      if (val === undefined) return;
      cols.push(col);
      params.push(val);
      vals.push(`$${params.length}`);
    }

    for (const column of SUPPLIERS_INSERT_COLUMNS) {
      add(column, payload[column]);
    }

    const sql = `
      INSERT INTO ${TB} (${cols.join(', ')})
      VALUES (${vals.join(', ')})
      RETURNING
${RETURNING_COLUMNS};
    `;

    const { rows } = await client.query(sql, params);
    return ok(normalizeRow(rows[0]));
  } catch (err) {
    console.error('[suppliersApi:create] Erro:', err);

    if (err.code === '23505') {
      return fail('Já existe um fornecedor com este documento fiscal (tax_id).', 400);
    }

    if (err.code === '23503') return fail('Classificação financeira inválida.', 400);
    return fail(err.message || 'Erro ao criar fornecedor', 500);
  } finally {
    client.release();
  }
}
