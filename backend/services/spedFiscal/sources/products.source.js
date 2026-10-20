// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.source.js                                                  ║
// ║ Fonte de produtos/unidades para o SPED Fiscal                       ║
// ║ CONSART ERP · Estrutura fiscal V2                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../../../config/db.js';
import { ensureItemTypeColumn } from '../../../repositories/products/productsItemType.js';

function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function normalizeFiscalProductCode(value) {
  const code = String(value ?? '').trim();
  if (!/^\d+$/.test(code)) return code;

  const significant = code.replace(/^0+/, '') || '0';
  return significant.padStart(6, '0');
}

function normalizeProduct(row) {
  return {
    codigo: normalizeFiscalProductCode(row.codigo),
    descricao: row.descricao || '',
    descricao_complementar: row.descricao_complementar || '',
    unidade: row.unidade || 'UN',
    tipo_item: row.tipo_item || '00',

    ncm: onlyDigits(row.ncm || ''),
    ex_ipi: row.ex_ipi || '',
    genero: onlyDigits(row.genero || ''),
    cod_lsit: onlyDigits(row.cod_lsit || ''),
    aliq_icms: row.aliq_icms ?? '',
    cest: onlyDigits(row.cest || ''),
  };
}

export async function getProductsSource(enterpriseId = null) {
  await ensureItemTypeColumn();

  const sql = `
    SELECT
      p.product_code::text AS codigo,
      p.description AS descricao,
      ''::text AS descricao_complementar,

      COALESCE(u.unit, 'UN') AS unidade,
      COALESCE(p.item_type, '00') AS tipo_item,

      COALESCE(fc.ncm_code, '') AS ncm,
      ''::text AS ex_ipi,
      LEFT(COALESCE(fc.ncm_code, ''), 2) AS genero,
      ''::text AS cod_lsit,

      COALESCE(
        fp.icms_rate,
        p.tax_icms_sale_percent,
        0
      ) AS aliq_icms,

      COALESCE(fc.cest_code, '') AS cest

    FROM public.products p

    LEFT JOIN public.units u
      ON u.unit_id = p.product_unit_id

    /*
     * Seleciona somente o vínculo fiscal V2 vigente do produto.
     * O LATERAL + LIMIT 1 protege o SPED contra duplicidade caso existam
     * registros históricos inconsistentes marcados simultaneamente como atuais.
     */
    LEFT JOIN LATERAL (
      SELECT
        pf.products_fiscal_id,
        pf.fiscal_classification_id,
        pf.version
      FROM public."productsFiscalV2" pf
      WHERE pf.product_code::text = p.product_code::text
        AND pf.is_current = true
        AND pf.is_active = true
      ORDER BY
        pf.version DESC,
        pf.products_fiscal_id DESC
      LIMIT 1
    ) pf ON true

    LEFT JOIN public."fiscalClassificationV2" fc
      ON fc.fiscal_classification_id = pf.fiscal_classification_id

    LEFT JOIN public."fiscalProfileV2" fp
      ON fp.fiscal_profile_id = fc.fiscal_profile_id

    WHERE COALESCE(p.is_active, true) = true

    ORDER BY
      p.description ASC,
      p.product_id ASC
  `;

  try {
    const { rows } = await pool.query(sql);

    console.info('[SPED Fiscal] products source V2 loaded.', {
      enterprise_id: enterpriseId,
      product_count: rows.length,
    });

    return rows.map(normalizeProduct);
  } catch (error) {
    console.error('[SPED Fiscal] getProductsSource V2 error.', {
      enterprise_id: enterpriseId,
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      table: error.table || null,
      column: error.column || null,
      constraint: error.constraint || null,
      stack: error.stack || null,
    });

    return [];
  }
}

export default {
  getProductsSource,
};
