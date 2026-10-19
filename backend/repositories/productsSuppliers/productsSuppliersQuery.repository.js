// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSuppliersQuery.repository.js — list / listByProduct /      ║
// ║ listBySupplier  —  Tabela: public."productsSuppliers"              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS } from './productsSuppliers.constants.js';
import { ok, fail } from './productsSuppliers.utils.js';
import { normalizeRow } from './productsSuppliers.mappers.js';

/* ──────────────────────────────────────────────────────────────
   list — compatível com controller antigo
   - Se passar product_id  → delega p/ listByProduct
   - Se passar supplier_id → delega p/ listBySupplier
   - Senão, lista tudo com paginação
────────────────────────────────────────────────────────────── */
export async function list({
  page = 1,
  limit = 50,
  product_id,
  supplier_id,
} = {}) {
  // Atalhos: se vierem filtros específicos, usa funções dedicadas
  if (product_id) {
    return listByProduct(product_id);
  }
  if (supplier_id) {
    return listBySupplier(supplier_id);
  }

  try {
    const pg = Number(page) > 0 ? Number(page) : 1;
    const lim =
      Number(limit) > 0 && Number(limit) <= 1000 ? Number(limit) : 50;
    const offset = (pg - 1) * lim;

    const params = [lim, offset];

    const sql = `
      SELECT
        ${ALIAS}.product_supplier_id,
        ${ALIAS}.product_id,
        ${ALIAS}.supplier_id,
        ${ALIAS}.is_primary,
        ${ALIAS}.created_at,
        COUNT(*) OVER() AS total_count
      FROM ${TB} ${ALIAS}
      ORDER BY ${ALIAS}.product_id ASC, ${ALIAS}.supplier_id ASC
      LIMIT $1
      OFFSET $2
    `;

    const { rows } = await pool.query(sql, params);
    const total = rows.length ? Number(rows[0].total_count) : 0;
    const dataRows = rows.map(normalizeRow);

    return ok({
      rows: dataRows,
      total,
      page: pg,
      limit: lim,
    });
  } catch (err) {
    console.error('[productsSuppliersApi:list] error:', err);
    return fail('Erro ao listar vínculos produto x fornecedor.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   listByProduct — lista fornecedores de um produto
────────────────────────────────────────────────────────────── */
export async function listByProduct(productId) {
  const pid = String(productId ?? '').trim();
  if (!pid) return fail('productId é obrigatório.', 400);

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${ALIAS}.product_supplier_id,
        ${ALIAS}.product_id,
        ${ALIAS}.supplier_id,
        ${ALIAS}.is_primary,
        ${ALIAS}.created_at
      FROM ${TB} ${ALIAS}
      WHERE ${ALIAS}.product_id = $1
      ORDER BY ${ALIAS}.is_primary DESC, ${ALIAS}.supplier_id ASC
      `,
      [pid]
    );

    const data = rows.map(normalizeRow);
    return ok(data);
  } catch (err) {
    console.error('[productsSuppliersApi:listByProduct] error:', err);
    return fail('Erro ao listar fornecedores do produto.', 500);
  }
}

/* ──────────────────────────────────────────────────────────────
   listBySupplier — lista produtos de um fornecedor
────────────────────────────────────────────────────────────── */
export async function listBySupplier(supplierId) {
  const sid = Number(supplierId);
  if (!Number.isInteger(sid) || sid <= 0) {
    return fail('supplierId inválido.', 400);
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${ALIAS}.product_supplier_id,
        ${ALIAS}.product_id,
        ${ALIAS}.supplier_id,
        ${ALIAS}.is_primary,
        ${ALIAS}.created_at
      FROM ${TB} ${ALIAS}
      WHERE ${ALIAS}.supplier_id = $1
      ORDER BY ${ALIAS}.product_id ASC
      `,
      [sid]
    );

    const data = rows.map(normalizeRow);
    return ok(data);
  } catch (err) {
    console.error('[productsSuppliersApi:listBySupplier] error:', err);
    return fail('Erro ao listar produtos do fornecedor.', 500);
  }
}
