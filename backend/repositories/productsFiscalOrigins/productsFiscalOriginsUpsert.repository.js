// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOriginsUpsert.repository.js — upsertFromFiscalRule     ║
// ║ Calcula pela regra do produto e grava (upsert) por unidade           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { calculateForProduct } from '../productFiscalCostRules/productFiscalCostRules.index.js';
import { PRODUCTS_FISCAL_ORIGINS_NULL_SCOPE } from './productsFiscalOrigins.catalog.js';
import { TB, SELECT_COLUMNS } from './productsFiscalOrigins.constants.js';
import {
  clean,
  toNullableNumber,
  positiveInteger,
  normalizeCst,
} from './productsFiscalOrigins.sanitizers.js';
import { ensureOnce } from './productsFiscalOriginsSchema.repository.js';

/* ========================================================================== */
/* Gravação                                                                   */
/* ========================================================================== */

/**
 * Calcula a origem fiscal pela regra do produto e grava (upsert) na tabela.
 *
 * Os valores são gravados POR UNIDADE (quantity = 1), independentemente da
 * quantidade do lote: a proporção para a quantidade vendida é aplicada na
 * emissão, por calculateRetainedIcmsSt().
 */
export async function upsertFromFiscalRule(
  {
    productCode,
    lotId = null,
    productGradeId = null,
    productId = null,
    unit = null,
    unitCost = null,
    notes = null,
    userId = null,
  } = {},
  client = pool,
) {
  const code = clean(productCode);
  if (!code) throw new Error('product_code é obrigatório.');

  await ensureOnce(client);

  // quantity = 1 -> calculateForProduct devolve os valores unitários já nos
  // campos totais, que é exatamente a convenção desta tabela.
  const calculation = await calculateForProduct(
    code,
    {
      unitCost,
      quantity: 1,
    },
    client,
  );

  if (!calculation?.ok) {
    throw new Error(
      `SKU ${code}: não foi possível calcular a origem fiscal pela regra do produto.`,
    );
  }

  const perUnit = calculation.fiscal_per_unit || {};

  const payload = {
    source: 'PRODUCT_FISCAL_RULE',
    source_label: calculation.source_label ?? 'Regra fiscal do produto',
    calculated_from: 'productsFiscalV2',
    calculation,
  };

  const values = [
    code,                                                   // $1
    positiveInteger(productId),                             // $2
    positiveInteger(productGradeId),                        // $3
    positiveInteger(lotId),                                 // $4
    clean(unit),                                            // $5
    toNullableNumber(calculation.unit_cost),                // $6
    normalizeCst(calculation.inbound_cst),                  // $7
    toNullableNumber(perUnit.icms_base ?? calculation.icms_base),     // $8
    toNullableNumber(calculation.icms_rate),                // $9
    toNullableNumber(perUnit.icms_value ?? calculation.icms_value),   // $10
    toNullableNumber(calculation.mva_pct),                  // $11
    toNullableNumber(perUnit.icms_st_base ?? calculation.icms_st_base),   // $12
    toNullableNumber(calculation.icms_st_rate),             // $13
    toNullableNumber(perUnit.icms_st_value ?? calculation.icms_st_value), // $14
    toNullableNumber(calculation.ipi_rate),                 // $15
    toNullableNumber(calculation.pis_rate),                 // $16
    toNullableNumber(calculation.cofins_rate),              // $17
    positiveInteger(calculation.rule_id),                   // $18
    clean(calculation.rule_source),                         // $19
    clean(calculation.calculation_mode),                    // $20
    positiveInteger(calculation.products_fiscal_id),        // $21
    positiveInteger(calculation.fiscal_classification_id),  // $22
    positiveInteger(calculation.fiscal_profile_id),         // $23
    JSON.stringify(payload),                                // $24
    clean(notes),                                           // $25
    positiveInteger(userId),                                // $26
  ];

  const { rows } = await client.query(
    `
      INSERT INTO ${TB} AS target (
        product_code,
        product_id,
        product_grade_id,
        lot_id,
        unit,
        quantity,
        conversion_factor,
        unit_cost,
        icms_cst,
        icms_base,
        icms_rate,
        icms_value,
        icms_st_mva_rate,
        icms_st_base,
        icms_st_rate,
        icms_st_value,
        ipi_rate,
        pis_rate,
        cofins_rate,
        source,
        rule_id,
        rule_source,
        calculation_mode,
        products_fiscal_id,
        fiscal_classification_id,
        fiscal_profile_id,
        raw_tax_payload,
        notes,
        is_active,
        calculated_at,
        user_id
      )
      VALUES (
        $1, $2, $3, $4, $5,
        1, 1,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17,
        'PRODUCT_FISCAL_RULE',
        $18, $19, $20, $21, $22, $23,
        $24::jsonb, $25,
        TRUE, NOW(), $26
      )
      ON CONFLICT (
        product_code,
        COALESCE(lot_id, ${PRODUCTS_FISCAL_ORIGINS_NULL_SCOPE}),
        COALESCE(product_grade_id, ${PRODUCTS_FISCAL_ORIGINS_NULL_SCOPE})
      )
      WHERE is_active = TRUE
      DO UPDATE SET
        product_id               = EXCLUDED.product_id,
        unit                     = EXCLUDED.unit,
        quantity                 = EXCLUDED.quantity,
        conversion_factor        = EXCLUDED.conversion_factor,
        unit_cost                = EXCLUDED.unit_cost,
        icms_cst                 = EXCLUDED.icms_cst,
        icms_base                = EXCLUDED.icms_base,
        icms_rate                = EXCLUDED.icms_rate,
        icms_value               = EXCLUDED.icms_value,
        icms_st_mva_rate         = EXCLUDED.icms_st_mva_rate,
        icms_st_base             = EXCLUDED.icms_st_base,
        icms_st_rate             = EXCLUDED.icms_st_rate,
        icms_st_value            = EXCLUDED.icms_st_value,
        ipi_rate                 = EXCLUDED.ipi_rate,
        pis_rate                 = EXCLUDED.pis_rate,
        cofins_rate              = EXCLUDED.cofins_rate,
        source                   = EXCLUDED.source,
        rule_id                  = EXCLUDED.rule_id,
        rule_source              = EXCLUDED.rule_source,
        calculation_mode         = EXCLUDED.calculation_mode,
        products_fiscal_id       = EXCLUDED.products_fiscal_id,
        fiscal_classification_id = EXCLUDED.fiscal_classification_id,
        fiscal_profile_id        = EXCLUDED.fiscal_profile_id,
        raw_tax_payload          = EXCLUDED.raw_tax_payload,
        notes                    = COALESCE(EXCLUDED.notes, target.notes),
        calculated_at            = EXCLUDED.calculated_at,
        updated_at               = NOW(),
        user_id                  = COALESCE(EXCLUDED.user_id, target.user_id)
      RETURNING
        ${SELECT_COLUMNS}
    `,
    values,
  );

  return {
    ok: true,
    row: rows[0] || null,
    calculation,
  };
}
