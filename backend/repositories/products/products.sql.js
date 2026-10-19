// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.sql.js — fragmentos SQL (localização, SELECT principal)     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { PRODUCTS_TABLE } from './products.catalog.js';
import {
  TABLE_STOCK,
  TABLE_PRICES,
  TABLE_IMAGES,
  TABLE_LOCATIONS,
  TABLE_FISCAL_V2,
  VAREJO_PRICE_ID,
} from './products.constants.js';

export function buildLocationExpression(alias = 'pl') {
    return `
    NULLIF(
      CONCAT_WS(' / ',
        NULLIF(TRIM(${alias}.corredor), ''),
        NULLIF(TRIM(${alias}.prateleira), ''),
        NULLIF(TRIM(${alias}.bandeja), ''),
        NULLIF(TRIM(${alias}.box), '')
      ),
      ''
    )
  `;
}

export function coreSelectSql(whereSql, orderSql, pageSql = '') {
    return `
    SELECT
      p.*,
      pi.image_url,
      pi.image_path,
      COALESCE(ps.stock_qty, 0) AS stock_qty,
      pp.sale_price AS price_varejo,
      loc.location_description,
      EXISTS (
        SELECT 1
        FROM ${TABLE_FISCAL_V2} pf
        WHERE pf.product_code = p.product_code
          AND pf.is_current IS TRUE
          AND pf.is_active IS TRUE
          AND pf.effective_from <= CURRENT_TIMESTAMP
          AND (pf.effective_to IS NULL OR pf.effective_to > CURRENT_TIMESTAMP)
      ) AS has_fiscal_product
    FROM ${PRODUCTS_TABLE} p
    LEFT JOIN ${TABLE_STOCK} ps
      ON ps.product_stock_id = p.product_stock_id
    LEFT JOIN ${TABLE_PRICES} pp
      ON pp.product_code = p.product_code
     AND pp.price_id = ${VAREJO_PRICE_ID}
    LEFT JOIN LATERAL (
      SELECT img.image_url, img.image_path
      FROM ${TABLE_IMAGES} img
      WHERE img.product_code = p.product_code
        AND img.is_active IS TRUE
      ORDER BY
        (img.barcode_id IS NULL) DESC,
        img.is_primary DESC,
        img.position ASC,
        img.product_image_id ASC
      LIMIT 1
    ) pi ON TRUE
    LEFT JOIN LATERAL (
      SELECT STRING_AGG(
        DISTINCT ${buildLocationExpression('pl')},
        ' | ' ORDER BY ${buildLocationExpression('pl')}
      ) AS location_description
      FROM ${TABLE_LOCATIONS} pl
      WHERE pl.product_code = p.product_code
        AND pl.is_active IS TRUE
    ) loc ON TRUE
    ${whereSql}
    ${orderSql}
    ${pageSql}
  `;
}
