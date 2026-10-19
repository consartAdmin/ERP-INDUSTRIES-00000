// ╔════════════════════════════════════════════════════════════════════╗
// ║ dreGerencialDespesasQuery.repository.js — listDespesas do mês      ║
// ║ Tabela: public."movimentacoesCaixa" (SAÍDAS ativas)                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { monthRange } from './dreGerencial.utils.js';

export async function listDespesas(month) {
  const { start, end } = monthRange(month);

  const { rows } = await pool.query(
    `
      SELECT
        mc.id AS expense_id,

        COALESCE(
          NULLIF(TRIM(mc.fornecedor), ''),
          NULLIF(TRIM(mc.observacao), ''),
          cs.nome,
          'Sem descrição'
        ) AS description,

        COALESCE(
          cc.nome,
          mc.categoria::text
        ) AS category,

        COALESCE(
          cs.nome,
          mc.subcategoria::text
        ) AS subcategoria,

        mc.valor AS amount,

        mc.data_hora::date AS due_date,

        mc.data_hora::date AS paid_date,

        CASE
          WHEN LOWER(COALESCE(mc.tipo_movimentacao, '')) IN
          ('saida', 'saída', 'debito', 'débito')
          THEN 'paid'
          ELSE 'pending'
        END AS status,

        date_trunc('month', mc.data_hora)::date AS reference_month,

        mc.tipo_movimentacao,
        mc.conta_caixa,
        mc.tipo_documento,
        mc.numero_documento,
        mc.fornecedor,
        mc.multa,
        mc.juros,
        mc.encargos,

        mc.is_deductible,

        cs.is_deductible AS subcategoria_is_deductible,

        CASE
          WHEN mc.is_deductible IS NOT NULL
            THEN mc.is_deductible
          WHEN cs.is_deductible IS NOT NULL
            THEN cs.is_deductible
          ELSE FALSE
        END AS is_deductible_final,

        cs.dre_tipo,

        mc.created_at,
        mc.updated_at

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

      ORDER BY mc.data_hora ASC,
               mc.id DESC
    `,
    [start, end]
  );

  return rows;
}
