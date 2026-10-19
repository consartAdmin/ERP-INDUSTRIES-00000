// ╔══════════════════════════════════════════════════════════════╗
// ║ reportsProductsStockQuery.repository.js                     ║
// ║ Relatório Posição de Estoque: getReportData / summary       ║
// ╚══════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function getReportData(filters = {}) {
  const {
    search = '',
    onlyPositive = false,
    limit = 1000,
  } = filters;

  const where = [];
  const values = [];
  let idx = 1;

  if (search) {
    where.push(`(
      p.product_code ILIKE $${idx}
      OR p.description ILIKE $${idx}
      OR pl.localizacao ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx++;
  }

  if (onlyPositive === 'true' || onlyPositive === true) {
    where.push(`COALESCE(ps.stock_qty, 0) > 0`);
  }

  const safeLimit = Math.min(
    Math.max(parseInt(limit, 10) || 1000, 1),
    50000
  );

  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `
    WITH pl AS (
      SELECT
        product_code,
        STRING_AGG(
          NULLIF(TRIM(CONCAT_WS(' - ',
            NULLIF(TRIM(corredor), ''),
            NULLIF(TRIM(prateleira), ''),
            NULLIF(TRIM(bandeja), ''),
            NULLIF(TRIM(box), ''),
            NULLIF(TRIM(observacao), '')
          )), ''),
          ' | '
          ORDER BY id
        ) AS localizacao
      FROM public."productsLocations"
      WHERE is_active = true
      GROUP BY product_code
    )
    SELECT
      p.product_id AS id,
      p.product_code AS codigo,
      p.description AS descricao,
      COALESCE(pl.localizacao, '') AS localizacao,
      COALESCE(ps.stock_qty, 0) AS estoque,
      COALESCE(p.cost_price, 0) AS custo
    FROM public."products" p
    LEFT JOIN public."productsStock" ps
      ON ps.product_stock_id = p.product_stock_id
    LEFT JOIN pl
      ON TRIM(pl.product_code) = TRIM(p.product_code)
    ${whereSQL}
    ORDER BY p.description ASC
    LIMIT ${safeLimit}
    `,
    values
  );

  return rows;
}

export async function getStockPositionSummary() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(ps.stock_qty, 0) > 0) AS total_produtos,
      COALESCE(SUM(CASE
        WHEN COALESCE(ps.stock_qty, 0) > 0
        THEN COALESCE(ps.stock_qty, 0)
        ELSE 0
      END), 0) AS total_estoque,
      COALESCE(SUM(CASE
        WHEN COALESCE(ps.stock_qty, 0) > 0
        THEN COALESCE(ps.stock_qty, 0) * COALESCE(p.cost_price, 0)
        ELSE 0
      END), 0) AS valor_estoque,
      COUNT(*) FILTER (
        WHERE COALESCE(ps.stock_qty, 0) > 0
          AND COALESCE(ps.stock_qty, 0) < COALESCE(ps.stock_min, 0)
      ) AS abaixo_minimo,
      COUNT(*) FILTER (WHERE COALESCE(ps.stock_qty, 0) <= 0) AS sem_estoque
    FROM public."products" p
    LEFT JOIN public."productsStock" ps
      ON ps.product_stock_id = p.product_stock_id
    WHERE COALESCE(ps.stock_qty, 0) > 0
  `);

  return rows[0];
}
