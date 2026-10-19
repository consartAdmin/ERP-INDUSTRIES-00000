// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliersUpdate.repository.js — update                               ║
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
   update — atualiza fornecedor
────────────────────────────────────────────────────────────── */
export async function update(id, data = {}) {
  const client = await pool.connect();
  try {
    const supplierId = Number(id);
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      return fail('ID inválido', 400);
    }

    const normalized = {
      name: data.name !== undefined ? cleanString(data.name) : undefined,
      tax_id: data.tax_id !== undefined ? cleanString(data.tax_id) : undefined,
      state_registration: data.state_registration !== undefined ? cleanString(data.state_registration) : undefined,
      phone: data.phone !== undefined ? cleanString(data.phone) : undefined,
      email: data.email !== undefined ? cleanString(data.email) : undefined,
      website: data.website !== undefined ? cleanString(data.website) : undefined,
      login: data.login !== undefined ? cleanString(data.login) : undefined,
      password: data.password !== undefined ? cleanString(data.password) : undefined,
      observations: data.observations !== undefined ? cleanString(data.observations) : undefined,

      address_street_type: data.address_street_type !== undefined ? cleanString(data.address_street_type) : undefined,
      address_street: data.address_street !== undefined ? cleanString(data.address_street) : undefined,
      address_number: data.address_number !== undefined ? cleanString(data.address_number) : undefined,
      address_complement: data.address_complement !== undefined ? cleanString(data.address_complement) : undefined,
      address_district: data.address_district !== undefined ? cleanString(data.address_district) : undefined,
      city: data.city !== undefined ? cleanString(data.city) : undefined,
      state: data.state !== undefined ? normalizeState(data.state) : undefined,
      postal_code: data.postal_code !== undefined ? cleanString(data.postal_code) : undefined,

      sales_rep: data.sales_rep !== undefined ? cleanString(data.sales_rep) : undefined,
      sales_rep_email: data.sales_rep_email !== undefined ? cleanString(data.sales_rep_email) : undefined,
      finance_email: data.finance_email !== undefined ? cleanString(data.finance_email) : undefined,
      chart_account_id: data.chart_account_id !== undefined ? cleanPositiveInteger(data.chart_account_id) : undefined,
      cash_category_id: data.cash_category_id !== undefined ? cleanPositiveInteger(data.cash_category_id) : undefined,
      cash_subcategory_id: data.cash_subcategory_id !== undefined ? cleanPositiveInteger(data.cash_subcategory_id) : undefined,
    };

    const currentResult = await client.query(
      `SELECT chart_account_id, cash_category_id, cash_subcategory_id FROM ${TB} WHERE supplier_id = $1`,
      [supplierId]
    );
    if (!currentResult.rowCount) return fail('Fornecedor não encontrado', 404);
    const effective = { ...currentResult.rows[0], ...Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined)) };
    const validation = await validateFinancialClassification(client, effective);
    if (!validation.ok) return validation;

    const composedAddress = buildLegacyAddress({
      address_street_type: normalized.address_street_type,
      address_street: normalized.address_street,
      address_number: normalized.address_number,
      address_complement: normalized.address_complement,
      address_district: normalized.address_district,
    });

    normalized.address =
      data.address !== undefined
        ? cleanString(data.address)
        : composedAddress || undefined;

    const sets = [];
    const params = [];

    function set(col, val) {
      if (val === undefined) return;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    }

    for (const column of SUPPLIERS_INSERT_COLUMNS) {
      set(column, normalized[column]);
    }

    set('updated_at', new Date());

    if (!sets.length) {
      return fail('Nenhum campo para atualizar.', 400);
    }

    params.push(supplierId);

    const sql = `
      UPDATE ${TB}
      SET ${sets.join(', ')}
      WHERE supplier_id = $${params.length}
      RETURNING
${RETURNING_COLUMNS};
    `;

    const { rows } = await client.query(sql, params);

    if (!rows.length) {
      return fail('Fornecedor não encontrado', 404);
    }

    return ok(normalizeRow(rows[0]));
  } catch (err) {
    console.error('[suppliersApi:update] Erro:', err);

    if (err.code === '23505') {
      return fail('Já existe um fornecedor com este documento fiscal (tax_id).', 400);
    }

    if (err.code === '23503') return fail('Classificação financeira inválida.', 400);
    return fail(err.message || 'Erro ao atualizar fornecedor', 500);
  } finally {
    client.release();
  }
}
