// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesGenerate.repository.js — generateProductRule   ║
// ║ Gera/atualiza a regra a partir do fiscal atual do produto            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, SELECT_COLUMNS } from './productFiscalCostRules.constants.js';
import { clean, toNullableNumber, toBoolean } from './productFiscalCostRules.sanitizers.js';
import { create } from './productFiscalCostRulesCreate.repository.js';

export async function generateProductRule(productCode, options = {}, client = pool) {
  const code = String(productCode ?? '').trim();

  if (!code) {
    throw new Error('product_code é obrigatório.');
  }

  const force = toBoolean(options.force, false);

  /*
   * Fonte ÚNICA da regra automática:
   *   "productsFiscalV2" atual (pf)
   *     -> "fiscalClassificationV2" (fc)
   *       -> "fiscalProfileV2" (fp)
   *
   * Não consulta inboundInvoiceItems e não usa histórico de NF-e.
   *
   * Os campos ST são lidos de forma tolerante via to_jsonb(...), portanto
   * esta API continua funcionando mesmo se algum desses campos ainda não
   * existir em uma das tabelas atuais. Quando não houver configuração ST
   * suficiente para um CST que exige ST, a geração é bloqueada com mensagem
   * explícita, em vez de inventar uma alíquota.
   */
  const { rows } = await client.query(
    `
      SELECT
        p.product_id,
        p.product_code,
        p.description,
        p.cost_price,

        pf.products_fiscal_id,
        pf.fiscal_classification_id,

        fc.classification_name,
        fc.ncm_code,
        fc.cest_code,
        fc.fiscal_profile_id,

        fp.profile_name,
        fp.icms_cst,
        fp.icms_rate,
        fp.pis_cst,
        fp.pis_rate,
        fp.cofins_cst,
        fp.cofins_rate,
        fp.cfop_entry,
        fp.cfop_exit,

        fp.icms_base_pct AS current_icms_base_pct,
        fp.mva_pct AS current_mva_pct,
        fp.icms_st_base_pct AS current_icms_st_base_pct,
        fp.icms_st_rate AS current_icms_st_rate,
        fp.icms_st_ret_base_pct AS current_icms_st_ret_base_pct,
        fp.icms_st_ret_rate AS current_icms_st_ret_rate,
        fp.ipi_rate AS current_ipi_rate

      FROM public.products p

      INNER JOIN public."productsFiscalV2" pf
        ON pf.product_code = p.product_code
       AND pf.is_current = TRUE
       AND pf.is_active = TRUE

      INNER JOIN public."fiscalClassificationV2" fc
        ON fc.fiscal_classification_id = pf.fiscal_classification_id
       AND fc.is_active = TRUE

      INNER JOIN public."fiscalProfileV2" fp
        ON fp.fiscal_profile_id = fc.fiscal_profile_id
       AND fp.is_active = TRUE

      WHERE p.product_code = $1
      LIMIT 1
    `,
    [code],
  );

  const fiscal = rows[0];

  if (!fiscal) {
    throw new Error(
      `SKU ${code}: produto não encontrado ou não possui vínculo fiscal atual completo ` +
      '("productsFiscalV2" -> classificação -> perfil).',
    );
  }

  if (!fiscal.fiscal_classification_id) {
    throw new Error(`Produto ${code} não possui classificação fiscal atual vinculada.`);
  }

  if (!fiscal.fiscal_profile_id) {
    throw new Error(`Produto ${code} não possui perfil fiscal atual vinculado.`);
  }

  const existing = await client.query(
    `
      SELECT
        ${SELECT_COLUMNS}
      FROM ${TB}
      WHERE product_code = $1
        AND is_active = TRUE
      ORDER BY rule_id DESC
      LIMIT 1
    `,
    [code],
  );

  if (existing.rows[0] && !force) {
    return {
      created: false,
      rule: existing.rows[0],
      fiscal,
      rule_source: 'PRODUCT_RULE',
      config_source: 'CURRENT_PRODUCT_FISCAL',
    };
  }

  const inboundCst = clean(options.inbound_cst ?? fiscal.icms_cst);
  const normalizedCst = String(inboundCst ?? '').padStart(2, '0');

  const stCsts = new Set(['10', '30', '60', '70', '90']);
  const requiresSt = stCsts.has(normalizedCst);

  const profileIcmsRate = toNullableNumber(fiscal.icms_rate);
  const explicitIcmsRate = toNullableNumber(options.icms_rate);

  let resolvedIcmsRate =
    explicitIcmsRate != null
      ? explicitIcmsRate
      : profileIcmsRate;

  if (normalizedCst === '60' && resolvedIcmsRate == null) {
    resolvedIcmsRate = 0;
  }

  const configuredStRate = toNullableNumber(fiscal.current_icms_st_rate);
  const explicitStRate = toNullableNumber(options.icms_st_rate);

  const resolvedStRate =
    explicitStRate != null && explicitStRate > 0
      ? explicitStRate
      : configuredStRate != null && configuredStRate > 0
        ? configuredStRate
        : null;

  if (requiresSt && resolvedStRate == null) {
    throw new Error(
      `SKU ${code}: CST ${normalizedCst} exige ICMS-ST, mas a alíquota ST não está ` +
      'configurada no vínculo fiscal atual ("productsFiscalV2" / classificação / perfil). ' +
      'Configure icms_st_rate no perfil fiscal atual ou envie icms_st_rate explicitamente.',
    );
  }

  const configuredIcmsBasePct = toNullableNumber(fiscal.current_icms_base_pct);
  const configuredStBasePct = toNullableNumber(fiscal.current_icms_st_base_pct);

  const icmsBasePct =
    toNullableNumber(options.icms_base_pct) ??
    configuredIcmsBasePct ??
    100;

  const stBasePct = requiresSt
    ? (
      toNullableNumber(options.icms_st_base_pct) ??
      configuredStBasePct ??
      100
    )
    : (
      toNullableNumber(options.icms_st_base_pct) ??
      configuredStBasePct ??
      null
    );

  const payload = {
    product_code: code,
    fiscal_classification_id: Number(fiscal.fiscal_classification_id),
    fiscal_profile_id: Number(fiscal.fiscal_profile_id),
    price_id: toNullableNumber(options.price_id),

    inbound_cst: inboundCst,
    icms_base_pct: icmsBasePct,
    icms_rate: resolvedIcmsRate,

    mva_pct:
      toNullableNumber(options.mva_pct) ??
      toNullableNumber(fiscal.current_mva_pct),

    icms_st_base_pct: stBasePct,
    icms_st_rate: requiresSt
      ? resolvedStRate
      : (
        explicitStRate ??
        configuredStRate
      ),

    icms_st_ret_base_pct:
      toNullableNumber(options.icms_st_ret_base_pct) ??
      toNullableNumber(fiscal.current_icms_st_ret_base_pct),

    icms_st_ret_rate:
      toNullableNumber(options.icms_st_ret_rate) ??
      toNullableNumber(fiscal.current_icms_st_ret_rate),

    ipi_rate:
      toNullableNumber(options.ipi_rate) ??
      toNullableNumber(fiscal.current_ipi_rate),

    pis_rate:
      toNullableNumber(options.pis_rate ?? fiscal.pis_rate),

    cofins_rate:
      toNullableNumber(options.cofins_rate ?? fiscal.cofins_rate),

    calculation_mode:
      clean(options.calculation_mode) ||
      'PERCENTUAL',

    notes:
      clean(options.notes) ||
      `Regra gerada automaticamente para SKU ${code} usando somente o vínculo fiscal atual: ` +
      `"productsFiscalV2" ${fiscal.products_fiscal_id}, classificação fiscal ` +
      `${fiscal.fiscal_classification_id} e perfil fiscal ${fiscal.fiscal_profile_id}. ` +
      `Nenhum histórico de inboundInvoiceItems foi utilizado; os percentuais ICMS/ST vêm do perfil fiscal atual.`,

    is_active: true,
    user_id: toNullableNumber(options.user_id),
  };

  const ownsTransaction = client === pool;
  const db = ownsTransaction ? await pool.connect() : client;

  try {
    if (ownsTransaction) {
      await db.query('BEGIN');
    }

    if (existing.rows[0] && force) {
      await db.query(
        `
          UPDATE ${TB}
          SET is_active = FALSE,
              updated_at = NOW()
          WHERE product_code = $1
            AND is_active = TRUE
        `,
        [code],
      );
    }

    const created = await create(payload, db);

    if (ownsTransaction) {
      await db.query('COMMIT');
    }

    return {
      created: true,
      rule: created,
      fiscal: {
        ...fiscal,
        cost_price:
          fiscal.cost_price == null
            ? null
            : Number(fiscal.cost_price),
      },
      config_source: {
        source: 'CURRENT_PRODUCT_FISCAL',
        products_fiscal_id: Number(fiscal.products_fiscal_id),
        fiscal_classification_id: Number(fiscal.fiscal_classification_id),
        fiscal_profile_id: Number(fiscal.fiscal_profile_id),
        icms_st_rate: resolvedStRate,
      },
      history_source: null,
      rule_source: 'PRODUCT_RULE',
    };
  } catch (error) {
    if (ownsTransaction) {
      try {
        await db.query('ROLLBACK');
      } catch {
        // Preserve original error.
      }
    }

    throw error;
  } finally {
    if (ownsTransaction) {
      db.release();
    }
  }
}
