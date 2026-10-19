// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableLookups.repository.js — Opções dos selects       ║
// ║ Categorias, subcategorias, tipos de doc., plano, bancos            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_BANK_ACCOUNTS,
  TB_CASH_CATEGORIES,
  TB_CASH_SUBCATEGORIES,
  TB_CASH_DOCUMENT_TYPES,
  TB_CHART_OF_ACCOUNTS,
} from './accountsReceivable.constants.js';

/* ===================================================================
   CATEGORIAS DO CAIXA — opções dos selects
   =================================================================== */
export async function listCashCategories() {
  const sql = `
    SELECT id, name
    FROM ${TB_CASH_CATEGORIES}
    WHERE is_active = TRUE
    ORDER BY name ASC, id ASC;
  `;

  const { rows } = await pool.query(sql);
  return rows;
}

export async function listCashSubcategories({ categoryId } = {}) {
  const params = [];
  let categoryFilter = '';

  if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
    const normalizedCategoryId = Number(categoryId);

    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
      throw new Error('category_id inválido.');
    }

    params.push(normalizedCategoryId);
    categoryFilter = 'AND sc.category_id = $1';
  }

  const sql = `
    SELECT sc.id, sc.category_id, sc.name, sc.is_deductible, sc.dre_type
    FROM ${TB_CASH_SUBCATEGORIES} sc
    INNER JOIN ${TB_CASH_CATEGORIES} c
      ON c.id = sc.category_id
    WHERE sc.is_active = TRUE
      AND c.is_active = TRUE
      ${categoryFilter}
    ORDER BY sc.name ASC, sc.id ASC;
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function listCashDocumentTypes() {
  const sql = `
    SELECT id, name
    FROM ${TB_CASH_DOCUMENT_TYPES}
    WHERE is_active = TRUE
    ORDER BY name ASC, id ASC;
  `;

  const { rows } = await pool.query(sql);
  return rows;
}

export async function listChartOfAccounts() {
  const sql = `
    SELECT id, code, description, account_type, nature, level
    FROM ${TB_CHART_OF_ACCOUNTS}
    WHERE is_active = TRUE
      AND allows_posting = TRUE
    ORDER BY code ASC, description ASC, id ASC;
  `;

  const { rows } = await pool.query(sql);
  return rows;
}

/* ===================================================================
   CONTAS BANCÁRIAS — opções do filtro "Conta Bancária"
   Inclui inativas (títulos antigos podem apontar para elas),
   listando as ativas primeiro.
   =================================================================== */
export async function listBankAccounts() {
  const sql = `
    SELECT
      id,
      name,
      agency,
      account_number,
      account_digit,
      integration_provider,
      is_default,
      is_active
    FROM ${TB_BANK_ACCOUNTS}
    ORDER BY is_active DESC, name ASC, id ASC;
  `;

  const { rows } = await pool.query(sql);
  return rows;
}
