// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesResolve.repository.js — resolve                ║
// ║ Prioridade: produto > classificação fiscal > perfil fiscal           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productFiscalCostRules.constants.js';
import { clean } from './productFiscalCostRules.sanitizers.js';

/* ========================================================================== */
/* Resolve Product Fiscal Cost Rule                                           */
/*                                                                            */
/* Priority:                                                                  */
/*   1. Product-specific rule                                                 */
/*   2. Fiscal Classification rule                                            */
/*   3. Fiscal Profile rule                                                   */
/* ========================================================================== */

export async function resolve(
  productCode,
  client = pool,
) {
  const code = clean(productCode);

  if (!code) {
    return null;
  }

  const { rows } = await client.query(
    `
      SELECT

        /* ================================================================ */
        /* Product                                                          */
        /* ================================================================ */

        p.product_code AS product_code,
        p.description AS description,
        p.cost_price AS cost_price,

        /* ================================================================ */
        /* Product Fiscal                                                   */
        /* ================================================================ */

        pf.products_fiscal_id
          AS products_fiscal_id,

        pf.fiscal_classification_id
          AS fiscal_classification_id,

        /* ================================================================ */
        /* Fiscal Classification                                            */
        /* ================================================================ */

        fc.fiscal_profile_id
          AS fiscal_profile_id,

        fc.classification_name
          AS classification_name,

        fc.ncm_code
          AS ncm_code,

        fc.cest_code
          AS cest_code,

        /* ================================================================ */
        /* Fiscal Profile                                                   */
        /* ================================================================ */

        fp.profile_name
          AS profile_name,

        fp.icms_cst
          AS profile_icms_cst,

        fp.icms_rate
          AS profile_icms_rate,

        fp.cfop_entry
          AS cfop_entry,

        fp.cfop_exit
          AS cfop_exit,

        fp.pis_cst
          AS pis_cst,

        fp.pis_rate
          AS profile_pis_rate,

        fp.cofins_cst
          AS cofins_cst,

        fp.cofins_rate
          AS profile_cofins_rate,

        /* ================================================================ */
        /* Selected Rule                                                    */
        /* ================================================================ */

        r.rule_id
          AS rule_id,

        r.product_code
          AS rule_product_code,

        r.fiscal_classification_id
          AS rule_fiscal_classification_id,

        r.fiscal_profile_id
          AS rule_fiscal_profile_id,

        r.price_id
          AS price_id,

        r.inbound_cst
          AS inbound_cst,

        r.icms_base_pct
          AS icms_base_pct,

        r.icms_rate
          AS icms_rate,

        r.mva_pct
          AS mva_pct,

        r.icms_st_base_pct
          AS icms_st_base_pct,

        r.icms_st_rate
          AS icms_st_rate,

        r.icms_st_ret_base_pct
          AS icms_st_ret_base_pct,

        r.icms_st_ret_rate
          AS icms_st_ret_rate,

        r.ipi_rate
          AS ipi_rate,

        r.pis_rate
          AS pis_rate,

        r.cofins_rate
          AS cofins_rate,

        r.calculation_mode
          AS calculation_mode,

        r.notes
          AS notes,

        r.is_active
          AS rule_is_active,

        r.created_at
          AS rule_created_at,

        r.updated_at
          AS rule_updated_at,

        r.user_id
          AS rule_user_id,

        /* ================================================================ */
        /* Rule Source                                                      */
        /* ================================================================ */

        CASE
          WHEN r.rule_id IS NULL
            THEN 'NONE'

          WHEN r.product_code = p.product_code
            THEN 'PRODUCT_RULE'

          WHEN
            r.product_code IS NULL
            AND
            r.fiscal_classification_id =
              pf.fiscal_classification_id
            THEN 'CLASSIFICATION_RULE'

          WHEN
            r.product_code IS NULL
            AND
            r.fiscal_classification_id IS NULL
            AND
            r.fiscal_profile_id =
              fc.fiscal_profile_id
            THEN 'PROFILE_RULE'

          ELSE 'NONE'
        END AS rule_source

      FROM public.products p

      /* ================================================================== */
      /* Current product fiscal association                                 */
      /* ================================================================== */

      LEFT JOIN public."productsFiscalV2" pf
        ON pf.product_code = p.product_code
       AND pf.is_current = TRUE
       AND pf.is_active = TRUE

      /* ================================================================== */
      /* Fiscal classification                                              */
      /* ================================================================== */

      LEFT JOIN public."fiscalClassificationV2" fc
        ON fc.fiscal_classification_id =
           pf.fiscal_classification_id
       AND fc.is_active = TRUE

      /* ================================================================== */
      /* Fiscal profile                                                     */
      /* ================================================================== */

      LEFT JOIN public."fiscalProfileV2" fp
        ON fp.fiscal_profile_id =
           fc.fiscal_profile_id
       AND fp.is_active = TRUE

      /* ================================================================== */
      /* Best matching fiscal fallback rule                                 */
      /* ================================================================== */

      LEFT JOIN LATERAL (

        SELECT
          x.*

        FROM ${TB} x

        WHERE
          x.is_active = TRUE

          AND (

            x.product_code =
              p.product_code

            OR

            (
              x.product_code IS NULL

              AND
              x.fiscal_classification_id =
                pf.fiscal_classification_id
            )

            OR

            (
              x.product_code IS NULL

              AND
              x.fiscal_classification_id IS NULL

              AND
              x.fiscal_profile_id =
                fc.fiscal_profile_id
            )
          )

        ORDER BY

          CASE

            WHEN x.product_code =
                 p.product_code
              THEN 1

            WHEN
              x.product_code IS NULL
              AND
              x.fiscal_classification_id =
                pf.fiscal_classification_id
              THEN 2

            WHEN
              x.product_code IS NULL
              AND
              x.fiscal_classification_id IS NULL
              AND
              x.fiscal_profile_id =
                fc.fiscal_profile_id
              THEN 3

            ELSE 99

          END,

          x.rule_id DESC

        LIMIT 1

      ) r ON TRUE

      WHERE p.product_code = $1

      LIMIT 1
    `,
    [code],
  );

  return rows[0] || null;
}
