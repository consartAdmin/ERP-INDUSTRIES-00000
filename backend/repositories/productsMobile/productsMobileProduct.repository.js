// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsMobileProduct.repository.js — busca por código de barras / SKU ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeSku10, toNumber, normalizeText } from './productsMobile.sanitizers.js';
import { buildLocation } from './productsMobile.mappers.js';
import { SINGLE_PRICE_ID } from '../productsPrices/productsPrices.single.js';

// productsPrices é chaveado por product_code (ver repositories/productsPrices);
// o preço de venda único fica na tabela de preço SINGLE_PRICE_ID.
export async function findProductBaseByBarcodeOrSku(searchValue) {
  const raw = normalizeText(searchValue);
  const sku10 = normalizeSku10(raw);

  if (!raw) return null;

  /*
   * Os vínculos (código de barras, localização, imagem) usam LATERAL ... LIMIT 1
   * para não multiplicar linhas quando o produto tem vários registros, e para
   * escolher sempre o mais relevante: o código de barras lido (ou o padrão),
   * a localização mais recente e a imagem principal.
   */
  const sql = `
  SELECT
    p.product_id,
    p.product_code,
    p.description,

    p.product_imagem_id,

    p.cost_price,

    pp.sale_price,

    pb.barcode,
    pb.unit AS barcode_unit,
    pb.fator AS barcode_factor,

    ps.product_stock_id,
    ps.stock_qty,
    ps.stock_min,
    ps.stock_max,

    pl.id AS location_id,
    pl.store_id,
    pl.corredor,
    pl.prateleira,
    pl.bandeja,
    pl.box,
    pl.observacao AS location_observacao,

    img.image_url

  FROM public.products p

  LEFT JOIN LATERAL (
    SELECT b.barcode, b.unit, b.fator
    FROM public."productsBarCode" b
    WHERE b.product_code = p.product_code
      AND COALESCE(b.is_active, true) = true
    ORDER BY
      (b.barcode = $1) DESC,
      b.standard DESC NULLS LAST,
      b.barcode_id ASC
    LIMIT 1
  ) pb ON true

  LEFT JOIN public."productsStock" ps
    ON ps.product_stock_id = p.product_stock_id

  LEFT JOIN public."productsPrices" pp
    ON pp.product_code = p.product_code
   AND pp.price_id = $3

  LEFT JOIN LATERAL (
    SELECT l.id, l.store_id, l.corredor, l.prateleira, l.bandeja, l.box, l.observacao
    FROM public."productsLocations" l
    WHERE l.product_code = p.product_code
      AND COALESCE(l.is_active, true) = true
    ORDER BY
      l.updated_at DESC NULLS LAST,
      l.created_at DESC NULLS LAST,
      l.id DESC
    LIMIT 1
  ) pl ON true

  LEFT JOIN LATERAL (
    SELECT i.image_url
    FROM public."productsImages" i
    WHERE i.product_code = p.product_code
      AND COALESCE(i.is_active, true) = true
      AND COALESCE(i.image_url, '') <> ''
    ORDER BY
      i.is_primary DESC NULLS LAST,
      i.barcode_id ASC NULLS FIRST,
      i.position ASC NULLS LAST,
      i.product_image_id ASC
    LIMIT 1
  ) img ON true

  WHERE
      p.product_code = $1
      OR p.product_code = $2
      OR EXISTS (
        SELECT 1
        FROM public."productsBarCode" bx
        WHERE bx.product_code = p.product_code
          AND bx.barcode = $1
          AND COALESCE(bx.is_active, true) = true
      )

  ORDER BY
      CASE
          WHEN pb.barcode = $1 THEN 1
          WHEN p.product_code = $1 THEN 2
          WHEN p.product_code = $2 THEN 3
          ELSE 4
      END,
      p.product_id ASC

  LIMIT 1;
`;

  const { rows } = await pool.query(sql, [raw, sku10, SINGLE_PRICE_ID]);

  return rows[0] || null;
}

export async function listProductUnits(productCode) {
  const sql = `
    SELECT
      barcode_id,
      product_code,
      barcode,
      unit,
      fator,
      description,
      standard,
      is_active
    FROM public."productsBarCode"
    WHERE product_code = $1
      AND COALESCE(is_active, true) = true
    ORDER BY
      standard DESC NULLS LAST,
      fator ASC NULLS LAST,
      unit ASC;
  `;

  const { rows } = await pool.query(sql, [productCode]);

  return rows.map((row) => ({
    barcode_id: row.barcode_id,
    barcode: row.barcode,
    unit: row.unit || 'UN',
    factor: toNumber(row.fator, 1),
    description: row.description || '',
    standard: Boolean(row.standard),
  }));
}

export async function listProductLots(productStockId) {
  if (!productStockId) return [];

  const sql = `
    SELECT
      lot_id,
      lot_code,
      expires_at,
      qty_on_hand
    FROM public."productsStockLots"
    WHERE product_stock_id = $1
      AND COALESCE(is_active, true) = true
    ORDER BY
      expires_at NULLS LAST,
      lot_id ASC;
  `;

  const { rows } = await pool.query(sql, [productStockId]);

  return rows.map((row) => ({
    lot_id: row.lot_id,
    lot_code: row.lot_code,
    expires_at: row.expires_at,
    qty_on_hand: toNumber(row.qty_on_hand),
  }));
}

export async function getByBarcodeOrSku(searchValue) {
  const base = await findProductBaseByBarcodeOrSku(searchValue);

  if (!base) {
    return {
      found: false,
      product: null,
    };
  }

  const units = await listProductUnits(base.product_code);

  const lots = await listProductLots(base.product_stock_id);

  const stockQty = toNumber(base.stock_qty);
  const stockMin = toNumber(base.stock_min);
  const stockMax = toNumber(base.stock_max);

  let stock_status = 'NORMAL';

  if (stockQty <= 0) {
    stock_status = 'SEM_ESTOQUE';
  } else if (stockMin > 0 && stockQty <= stockMin) {
    stock_status = 'ABAIXO_MINIMO';
  }

  return {
    found: true,
    product: {
      product_id: base.product_id,
      product_code: base.product_code,
      description: base.description,

      barcode: base.barcode || null,

      stock: {
        product_stock_id: base.product_stock_id,
        quantity: stockQty,
        min: stockMin,
        max: stockMax,
        status: stock_status,
      },

      units,
      lots,
      location: {
        location_id: base.location_id || null,
        label: buildLocation(base),
        store_id: base.store_id || null,
        corredor: base.corredor || '',
        prateleira: base.prateleira || '',
        bandeja: base.bandeja || '',
        box: base.box || '',
        observacao: base.location_observacao || '',
      },

      prices: {
        cost_price: toNumber(base.cost_price),
        sale_price: toNumber(base.sale_price),
      },

      product_imagem_id: base.product_imagem_id || null,
      image_url: base.image_url || null,
    },
  };
}
