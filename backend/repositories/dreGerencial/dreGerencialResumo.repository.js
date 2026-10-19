// ╔════════════════════════════════════════════════════════════════════╗
// ║ dreGerencialResumo.repository.js — getResumo (DRE do mês)          ║
// ║ ✅ Considera qualquer SAÍDA ativa no DRE, independente da categoria ║
// ║ ✅ Checkbox da movimentação sobrescreve regra da subcategoria       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { toNum, monthRange, calcIrpjCsll } from './dreGerencial.utils.js';

export async function getResumo(month) {
  const { start, end } = monthRange(month);

  const vendasSql = `
    SELECT
      COALESCE(SUM(i.total_amount), 0)::numeric AS receita_bruta
    FROM public."invoicesIssued" i
    WHERE i.issued_date >= $1
      AND i.issued_date < $2
      AND i.cancelled_at IS NULL
      AND UPPER(COALESCE(i.nfe_status, '')) IN (
        'AUTORIZADA',
        'AUTORIZADO',
        'CONCLUIDO',
        'CONCLUÍDO'
      )
  `;

  const impostosSql = `
    SELECT
      COALESCE(SUM(
        oi.quantity * oi.unit_price * COALESCE(p.tax_icms_sale_percent, 0) / 100
      ), 0)::numeric AS icms_venda,

      COALESCE(SUM(
        oi.quantity * oi.unit_price * COALESCE(p.tax_pis_sale_percent, 0) / 100
      ), 0)::numeric AS pis_venda,

      COALESCE(SUM(
        oi.quantity * oi.unit_price * COALESCE(p.tax_cofins_sale_percent, 0) / 100
      ), 0)::numeric AS cofins_venda
    FROM public."invoicesIssued" i
    JOIN public."orderItems" oi
      ON oi.order_id = i.order_id
    LEFT JOIN public.products p
      ON p.product_code = oi.sku
    WHERE i.issued_date >= $1
      AND i.issued_date < $2
      AND i.cancelled_at IS NULL
      AND UPPER(COALESCE(i.nfe_status, '')) IN (
        'AUTORIZADA',
        'AUTORIZADO',
        'CONCLUIDO',
        'CONCLUÍDO'
      )
  `;

  const caixaSql = `
    WITH caixa_base AS (
      SELECT
        mc.*,
        COALESCE(cc.nome, mc.categoria::text) AS categoria_nome,
        COALESCE(cs.nome, mc.subcategoria::text) AS subcategoria_nome,
        cs.is_deductible AS subcategoria_is_deductible,

        CASE
          WHEN mc.is_deductible IS NOT NULL
            THEN mc.is_deductible
          WHEN cs.is_deductible IS NOT NULL
            THEN cs.is_deductible
          ELSE FALSE
        END AS is_deductible_final

      FROM public."movimentacoesCaixa" mc

      LEFT JOIN public."caixaCategorias" cc
        ON cc.id::text = mc.categoria::text
        OR UPPER(TRIM(cc.nome)) = UPPER(TRIM(mc.categoria::text))

      LEFT JOIN public."caixaSubCategorias" cs
        ON cs.id::text = mc.subcategoria::text
        OR UPPER(TRIM(cs.nome)) = UPPER(TRIM(mc.subcategoria::text))

      WHERE mc.data_hora >= $1
        AND mc.data_hora < $2
        AND mc.is_active IS TRUE
        AND UPPER(TRIM(COALESCE(mc.tipo_movimentacao, ''))) IN (
          'SAIDA',
          'SAÍDA',
          'DEBITO',
          'DÉBITO'
        )
    )

    SELECT
      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(subcategoria_nome, ''))) IN ('C.M.V', 'CMV')
          THEN valor ELSE 0
        END
      ), 0)::numeric AS cmv,

      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(subcategoria_nome, ''))) NOT IN ('C.M.V', 'CMV')
          THEN valor ELSE 0
        END
      ), 0)::numeric AS despesas_total,

      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(subcategoria_nome, ''))) NOT IN ('C.M.V', 'CMV')
           AND is_deductible_final IS TRUE
          THEN valor ELSE 0
        END
      ), 0)::numeric AS despesas_dedutiveis,

      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(subcategoria_nome, ''))) NOT IN ('C.M.V', 'CMV')
           AND is_deductible_final IS FALSE
          THEN valor ELSE 0
        END
      ), 0)::numeric AS despesas_nao_dedutiveis

    FROM caixa_base
  `;

  const [vendasRes, impostosRes, caixaRes] = await Promise.all([
    pool.query(vendasSql, [start, end]),
    pool.query(impostosSql, [start, end]),
    pool.query(caixaSql, [start, end]),
  ]);

  const receitaBruta = toNum(vendasRes.rows[0]?.receita_bruta);

  const icmsVenda = toNum(impostosRes.rows[0]?.icms_venda);
  const pisVenda = toNum(impostosRes.rows[0]?.pis_venda);
  const cofinsVenda = toNum(impostosRes.rows[0]?.cofins_venda);
  const impostosVenda = icmsVenda + pisVenda + cofinsVenda;

  const cmv = toNum(caixaRes.rows[0]?.cmv);
  const despesasTotal = toNum(caixaRes.rows[0]?.despesas_total);
  const despesasDedutiveis = toNum(caixaRes.rows[0]?.despesas_dedutiveis);
  const despesasNaoDedutiveis = toNum(caixaRes.rows[0]?.despesas_nao_dedutiveis);

  const receitaLiquida = receitaBruta - impostosVenda;
  const lucroBruto = receitaLiquida - cmv;
  const resultadoContabil = lucroBruto - despesasTotal;
  const lucroFiscalBase = resultadoContabil + despesasNaoDedutiveis;

  const impostosLucro = calcIrpjCsll(lucroFiscalBase);
  const lucroLiquidoEstimado = resultadoContabil - impostosLucro.total;

  return {
    periodo: { start, end },

    receita_bruta: Number(receitaBruta.toFixed(2)),

    impostos_venda: {
      icms: Number(icmsVenda.toFixed(2)),
      pis: Number(pisVenda.toFixed(2)),
      cofins: Number(cofinsVenda.toFixed(2)),
      total: Number(impostosVenda.toFixed(2)),
    },

    receita_liquida: Number(receitaLiquida.toFixed(2)),
    cmv: Number(cmv.toFixed(2)),
    lucro_bruto: Number(lucroBruto.toFixed(2)),

    despesas: {
      total: Number(despesasTotal.toFixed(2)),
      dedutiveis: Number(despesasDedutiveis.toFixed(2)),
      nao_dedutiveis: Number(despesasNaoDedutiveis.toFixed(2)),
    },

    resultado_antes_irpj_csll: Number(resultadoContabil.toFixed(2)),
    irpj_csll: impostosLucro,
    lucro_liquido_estimado: Number(lucroLiquidoEstimado.toFixed(2)),

    margens: {
      margem_bruta_percent:
        receitaBruta > 0 ? Number(((lucroBruto / receitaBruta) * 100).toFixed(2)) : 0,
      margem_liquida_percent:
        receitaBruta > 0 ? Number(((lucroLiquidoEstimado / receitaBruta) * 100).toFixed(2)) : 0,
    },
  };
}
