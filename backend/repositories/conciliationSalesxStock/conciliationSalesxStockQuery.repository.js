// ╔════════════════════════════════════════════════════════════════════╗
// ║ conciliationSalesxStockQuery.repository.js                         ║
// ║ listSalesStockReconciliation / getSalesStockSummary                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import productsStockManager from '../productsStock/productsStock.manager.js';
import { resolveSort, buildFilters } from './conciliationSalesxStock.utils.js';
import { reportCte } from './conciliationSalesxStock.sql.js';

async function resolveMode() {
  return productsStockManager.resolveProductsStockMode({
    scopeType: 'GLOBAL',
    scopeId: 1,
  });
}

export async function listSalesStockReconciliation(filters = {}) {
  const stockMode = await resolveMode();
  const base = buildFilters(filters);
  const values = [...base.values];
  const where = [];
  let index = base.nextIndex;

  if (filters.search) {
    where.push(`(r.sku ILIKE $${index} OR r.description ILIKE $${index})`);
    values.push(`%${filters.search}%`);
    index += 1;
  }

  if (filters.onlyNeedBuy) where.push('r.quantity_to_buy > 0');

  if (filters.viewMode !== 'total') {
    const type = String(filters.movementType || '').trim().toUpperCase();
    if (['INBOUND', 'ENTRADA'].includes(type)) {
      where.push("mr.movement_type = 'ENTRADA'");
    }
    if (['OUTBOUND', 'SAIDA', 'SAÍDA'].includes(type)) {
      where.push("mr.movement_type = 'SAIDA'");
    }
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sort = resolveSort(filters);

  values.push(limit, offset);
  const limitParam = `$${index++}`;
  const offsetParam = `$${index}`;

  const detailSql = filters.viewMode === 'total'
    ? `
      SELECT
        'TOTAL'::text AS movement_type,
        NULL::bigint AS invoice_id,
        NULL::text AS invoice_number,
        NULL::date AS movement_date,
        r.sku,
        r.description,
        NULL::numeric AS movement_quantity,
        r.invoices_count,
        r.inbound_invoices_count,
        r.quantity_sold,
        r.quantity_inbound,
        r.qty_on_hand,
        r.qty_reserved,
        r.available_stock AS current_available_stock,
        NULL::numeric AS stock_before,
        NULL::numeric AS stock_after,
        r.historical_final_stock,
        r.stock_need,
        r.reference_difference AS divergence,
        r.quantity_to_buy,
        COUNT(*) OVER()::int AS total_rows
      FROM reconciliation r
      ${whereSql}
      ORDER BY
        ${sort.expression} ${sort.direction} NULLS LAST,
        r.sku ASC
    `
    : `
      SELECT
        mr.movement_type,
        mr.invoice_id,
        mr.invoice_number,
        mr.movement_date,
        mr.sku,
        COALESCE(r.description, mr.movement_description, '') AS description,
        mr.movement_quantity,
        r.invoices_count,
        r.inbound_invoices_count,
        r.quantity_sold,
        r.quantity_inbound,
        r.qty_on_hand,
        r.qty_reserved,
        mr.stock_before,
        mr.stock_after,
        r.available_stock AS current_available_stock,
        r.historical_final_stock,
        r.stock_need,
        r.reference_difference AS divergence,
        CASE
          WHEN mr.stock_after IS NULL THEN r.quantity_to_buy
          ELSE GREATEST(-mr.stock_after, 0)
        END AS quantity_to_buy,
        COUNT(*) OVER()::int AS total_rows
      FROM movement_rows mr
      JOIN reconciliation r
        ON r.sku = mr.sku
      ${whereSql}
      ORDER BY
        ${sort.expression} ${sort.direction} NULLS LAST,
        mr.sku,
        mr.movement_created_at,
        mr.movement_sort_id,
        mr.invoice_id
    `;

  const { rows } = await pool.query(
    `${reportCte(stockMode)} ${detailSql} LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values
  );

  return {
    rows,
    total: rows[0]?.total_rows || 0,
    limit,
    offset,
  };
}

export async function getSalesStockSummary(filters = {}) {
  const stockMode = await resolveMode();
  const base = buildFilters(filters);
  const values = [...base.values];
  const where = [];
  let index = base.nextIndex;

  if (filters.search) {
    where.push(`(r.sku ILIKE $${index} OR r.description ILIKE $${index})`);
    values.push(`%${filters.search}%`);
  }

  if (filters.onlyNeedBuy) where.push('r.quantity_to_buy > 0');

  const { rows } = await pool.query(
    `
      ${reportCte(stockMode)}
      SELECT
        COUNT(*) FILTER (WHERE r.quantity_sold > 0)::int AS products_count,
        COUNT(*) FILTER (WHERE r.quantity_to_buy > 0)::int AS products_to_buy,
        COALESCE(SUM(r.quantity_sold), 0) AS quantity_sold,
        COALESCE(SUM(r.quantity_inbound), 0) AS quantity_inbound,
        COALESCE(SUM(r.available_stock), 0) AS available_stock,
        COALESCE(SUM(r.net_movement), 0) AS net_movement,
        COALESCE(SUM(r.reference_difference), 0) AS reference_difference,
        COALESCE(SUM(r.quantity_to_buy), 0) AS quantity_to_buy
      FROM reconciliation r
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    `,
    values
  );

  return rows[0];
}
