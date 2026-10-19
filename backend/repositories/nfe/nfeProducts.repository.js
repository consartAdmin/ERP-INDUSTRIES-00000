// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeProducts.repository.js — Produtos NF-e                            ║
// ║ ✔ Cache de unidades + coluna SKU                                     ║
// ║ ✔ Fiscal por SKU + rateio de desconto global                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  round2,
} from './nfe.utils.js';

/* =========================================================================
 * 🧠 Unidades NF-e
 * ========================================================================= */
let UNITS_CACHE = null;

export async function loadUnitsMap() {
  if (UNITS_CACHE) {
    return UNITS_CACHE;
  }

  const { rows } = await pool.query(`
    SELECT
      unit,
      description
    FROM public.units
    WHERE is_active = TRUE
  `);

  const map = {};

  const normalizeNfeUnitCode = (value) => {
    return String(value || '')
      .toUpperCase()
      .trim()
      .replace(/\./g, '')
      .replace(/\d+$/g, ''); // CX.25 -> CX / FD5 -> FD / CX25 -> CX
  };

  for (const row of rows) {
    const raw = String(row.unit || '')
      .toUpperCase()
      .trim();

    if (!raw) continue;

    const normalized = normalizeNfeUnitCode(raw);

    map[raw] = normalized;
    map[raw.replace(/\./g, '')] = normalized;

    if (row.description) {
      map[
        String(row.description)
          .toUpperCase()
          .trim()
      ] = normalized;
    }
  }

  UNITS_CACHE = map;

  console.log('[NFE] Units loaded:', Object.keys(map).length);

  return map;
}

/* =========================================================================
 * 🧠 Coluna SKU
 * ========================================================================= */
let PRODUCTS_SKU_COL = null;

export async function resolveProductsSkuColumn() {
  if (PRODUCTS_SKU_COL) return PRODUCTS_SKU_COL;

  const candidates = [
    'codigo',
    'sku',
    'product_code',
    'codigo_produto',
    'codprod',
    'code',
  ];

  const { rows } = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = ANY($1)
      LIMIT 1;
    `,
    [candidates],
  );

  if (!rows.length) {
    throw new Error(
      'Não foi possível detectar a coluna de SKU na tabela products.',
    );
  }

  PRODUCTS_SKU_COL = rows[0].column_name;
  console.log(
    `[NFE] Coluna de SKU detectada em public.products: ${PRODUCTS_SKU_COL}`,
  );
  return PRODUCTS_SKU_COL;
}

/* =========================================================================
 * 🔎 Fiscal por SKU
 * ========================================================================= */
export async function loadFiscalBySku(skus = []) {
  const clean = Array.from(
    new Set((skus || []).map((s) => String(s).trim()).filter(Boolean)),
  );
  if (!clean.length) return {};

  const skuCol = await resolveProductsSkuColumn();
  const { rows } = await pool.query(
    `
      SELECT
        p."${skuCol}"::text AS sku,
        pf.products_fiscal_id,
        pf.product_code,
        pf.fiscal_classification_id,
        fc.classification_name,
        fc.ncm_code AS ncm,
        fc.ncm_code,
        fc.ncm_description,
        fc.ex_tipi,
        fc.cest_code AS cest,
        fc.cest_code,
        fc.cest_description,
        fc.is_cst,
        fc.is_classification,
        fc.is_rate,
        fc.is_specific_rate,
        fc.is_unit,
        fc.ibscbs_cst,
        fc.ibscbs_classification,
        fc.ibs_uf_rate,
        fc.ibs_municipal_rate,
        fc.cbs_rate,
        fc.donation_indicator,
        fc.tax_reform_details,
        fp.fiscal_profile_id,
        fp.profile_name,
        fp.description AS profile_description,
        fp.icms_cst,
        fp.icms_cst AS cst_icms,
        fp.icms_rate,
        fp.icms_rate AS aliquota_icms,
        fp.cfop_entry,
        fp.cfop_exit,
        fp.origin_code,
        fp.origin_code AS origem_mercadoria,
        fp.pis_cst,
        fp.pis_rate,
        fp.pis_rate AS pis_aliquota,
        fp.cofins_cst,
        fp.cofins_rate,
        fp.cofins_rate AS cofins_aliquota,
        fp.benefit_code
      FROM public.products p
      LEFT JOIN public."productsFiscalV2" pf
        ON pf.product_code = p.product_code
       AND pf.is_current = TRUE
       AND pf.is_active = TRUE
      LEFT JOIN public."fiscalClassificationV2" fc
        ON fc.fiscal_classification_id = pf.fiscal_classification_id
       AND fc.is_active = TRUE
      LEFT JOIN public."fiscalProfileV2" fp
        ON fp.fiscal_profile_id = fc.fiscal_profile_id
       AND fp.is_active = TRUE
      WHERE p."${skuCol}"::text = ANY($1::text[]);
    `,
    [clean],
  );

  const map = {};
  for (const row of rows) {
    if (row.products_fiscal_id) {
      map[String(row.sku)] = row;
    } else {
      console.warn(
        '[NFE] Nenhum vínculo fiscal V2 ativo encontrado para SKU:',
        row.sku,
        'product_code:',
        row.product_code,
      );
    }
  }

  return map;
}

export async function loadProductUnitsBySku(skus = []) {
  const clean = Array.from(
    new Set((skus || []).map(s => String(s).trim()).filter(Boolean))
  );

  if (!clean.length) return {};

  const { rows } = await pool.query(`
    SELECT DISTINCT ON (pbc.product_code)
      pbc.product_code AS sku,
      pbc.unit AS unidade
    FROM public."productsBarCode" pbc
    WHERE pbc.product_code = ANY($1)
      AND pbc.is_active = TRUE
      AND NULLIF(TRIM(pbc.unit), '') IS NOT NULL
    ORDER BY
      pbc.product_code,
      COALESCE(pbc.standard, FALSE) DESC,
      COALESCE(pbc.fator, 1) DESC,
      pbc.updated_at DESC
  `, [clean]);

  const map = {};

  for (const row of rows) {
    map[String(row.sku).trim()] = String(row.unidade || '').trim();
  }

  console.log('[NFE][PRODUCT_UNITS_BY_SKU]', map);

  return map;
}

export function distribuirDescontoGlobalNosItens(items = [], descontoGlobal = 0) {
  const itens = Array.isArray(items) ? items : [];
  const descontoTotal = round2(descontoGlobal);

  if (!itens.length || descontoTotal <= 0) {
    return itens.map((it) => ({
      ...it,
      _descontoRateado: round2(Number(it.discount_value ?? it.desconto_valor ?? 0)),
    }));
  }

  const totaisBrutos = itens.map((it) =>
    round2(Number(it.quantity || 0) * Number(it.unit_price || 0))
  );

  const somaBruta = round2(totaisBrutos.reduce((acc, v) => acc + v, 0));
  if (somaBruta <= 0) {
    return itens.map((it) => ({
      ...it,
      _descontoRateado: round2(Number(it.discount_value ?? it.desconto_valor ?? 0)),
    }));
  }

  let descontoAcumulado = 0;

  const rateados = itens.map((it, idx) => {
    const descontoItemOriginal = round2(
      Number(it.discount_value ?? it.desconto_valor ?? 0)
    );

    let descontoRateadoGlobal = 0;

    if (idx < itens.length - 1) {
      descontoRateadoGlobal = round2((totaisBrutos[idx] / somaBruta) * descontoTotal);
      descontoAcumulado += descontoRateadoGlobal;
    } else {
      descontoRateadoGlobal = round2(descontoTotal - descontoAcumulado);
    }

    return {
      ...it,
      _descontoRateado: round2(descontoItemOriginal + descontoRateadoGlobal),
    };
  });

  return rateados;
}
