// ╔════════════════════════════════════════════════════════════════════╗
// ║ usoConsumoFinishBudget.repository.js — Orçamento → Uso e Consumo   ║
// ║ Cria cabeçalho/itens, baixa estoque e registra movimentos          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_USO, TB_USO_ITEMS } from './usoConsumo.constants.js';
import { safeText, safeNumber } from './usoConsumo.sanitizers.js';
import { getById } from './usoConsumoQuery.repository.js';

export async function finishBudgetAsUsoConsumo(budgetId, payload = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const id = Number(budgetId);
    if (!id) throw new Error('budgetId inválido.');

    const department = safeText(payload.department);
    const responsible = safeText(payload.responsible);
    const reason = safeText(payload.reason);
    const cfop = safeText(payload.cfop || '5.949');

    if (!department) throw new Error('Departamento é obrigatório.');
    if (!responsible) throw new Error('Responsável é obrigatório.');
    if (!reason) throw new Error('Motivo é obrigatório.');
    if (!cfop) throw new Error('CFOP é obrigatório.');

    const budgetSql = `
  SELECT *
  FROM public.budgets
  WHERE budget_id = $1
  LIMIT 1
`;

    const budgetResult = await client.query(budgetSql, [id]);
    const budget = budgetResult.rows[0];

    if (!budget) {
      throw new Error(`Orçamento ${id} não encontrado.`);
    }

    const budgetRealId = Number(budget.budget_id);

    /*
     * Itens vindos de budgetsItems (tabela ATUAL). Antes lia a legada
     * "budgetItens", congelada no orçamento 160 — qualquer orçamento novo
     * caía em "Este orçamento não possui itens". Verificado no schema
     * em 16/09/2026.
     *
     * Dois cuidados na migração:
     *  - a coluna de SKU passou a ser product_code (era sku);
     *  - a unidade passou a ser unit_code (era unit), então vai aliasada
     *    para não quebrar o `item.unit` lido mais abaixo;
     *  - p.product_code foi removido do SELECT: com bi.* ele colidiria pelo
     *    mesmo nome e um produto ausente em products sobrescreveria o código
     *    do item com NULL.
     */
    const itemsSql = `
  SELECT
    bi.*,
    bi.unit_code AS unit,
    p.description AS product_description,
    p.cost_price,
    fc.ncm_code AS ncm,
    fp.icms_cst AS cst_icms
  FROM public."budgetsItems" bi
  LEFT JOIN public.products p
    ON p.product_code::text = bi.product_code::text
  LEFT JOIN public."productsFiscalV2" pf
    ON pf.product_code::text = bi.product_code::text
   AND pf.is_current = TRUE
   AND pf.is_active = TRUE
  LEFT JOIN public."fiscalClassificationV2" fc
    ON fc.fiscal_classification_id = pf.fiscal_classification_id
   AND fc.is_active = TRUE
  LEFT JOIN public."fiscalProfileV2" fp
    ON fp.fiscal_profile_id = fc.fiscal_profile_id
   AND fp.is_active = TRUE
  WHERE bi.budget_id = $1
  ORDER BY bi.budget_item_id ASC
`;

    const itemsResult = await client.query(itemsSql, [budgetRealId]);
    const items = itemsResult.rows;

    if (!items.length) {
      throw new Error('Este orçamento não possui itens.');
    }

    const totalAmount = items.reduce((acc, item) => {
      const qty = safeNumber(item.quantity || item.qty);
      const cost = safeNumber(item.cost_price || item.unit_price || item.price);
      return acc + qty * cost;
    }, 0);

    const number = `UC-${String(Date.now()).slice(-8)}`;

    const insertUsoSql = `
      INSERT INTO ${TB_USO} (
        budget_id,
        number,
        department,
        responsible,
        reason,
        cfop,
        status,
        total_amount
      )
      VALUES ($1,$2,$3,$4,$5,$6,'FINALIZADO',$7)
      RETURNING *
    `;

    const usoResult = await client.query(insertUsoSql, [
      budgetRealId,
      number,
      department,
      responsible,
      reason,
      cfop,
      totalAmount,
    ]);

    const uso = usoResult.rows[0];

    for (const item of items) {
      const productCode = safeText(item.product_code || item.sku);
      const description = safeText(item.description || item.product_description);
      const quantity = safeNumber(item.quantity || item.qty);
      const costPrice = safeNumber(item.cost_price || item.unit_price || item.price);
      const totalCost = quantity * costPrice;
      const unit = safeText(item.unit || item.unidade || item.unit_sale);
      const lotCode = safeText(item.lot_code || item.lote);
      const productGradeId = item.product_grade_id || item.grade_id || null;
      const gradeLabel = safeText(item.grade_label || item.grade || item.grade_name);

      if (!productCode || quantity <= 0) continue;

      await client.query(
        `
        INSERT INTO ${TB_USO_ITEMS} (
          uso_consumo_id,
          budget_item_id,
          product_code,
          description,
          product_grade_id,
          grade_label,
          lot_code,
          unit,
          quantity,
          cost_price,
          total_cost,
          cfop,
          ncm,
          cst_icms
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `,
        [
          uso.uso_consumo_id,
          item.budget_item_id || item.id || null,
          productCode,
          description,
          productGradeId,
          gradeLabel,
          lotCode,
          unit,
          quantity,
          costPrice,
          totalCost,
          cfop,
          item.ncm || null,
          item.cst_icms || null,
        ]
      );

      const stockSql = `
        UPDATE public."productsStock" ps
        SET stock_qty = COALESCE(stock_qty, 0) - $1
        FROM public.products p
        WHERE p.product_stock_id = ps.product_stock_id
          AND p.product_code::text = $2
        RETURNING ps.stock_qty
      `;

      const stockResult = await client.query(stockSql, [quantity, productCode]);
      const newStock = stockResult.rows[0]?.stock_qty ?? null;

      await client.query(
        `
        INSERT INTO public."productMovements" (
          product_code,
          movement_type,
          origin_module,
          origin_table,
          origin_id,
          quantity,
          previous_stock,
          new_stock,
          unit,
          lot_code,
          notes,
          metadata,
          created_at
        )
        VALUES (
          $1,
          'USO_CONSUMO',
          'usoConsumo',
          'usoConsumo',
          $2,
          $3,
          NULL,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          NOW()
        )
        `,
        [
          productCode,
          uso.uso_consumo_id,
          quantity * -1,
          newStock,
          unit,
          lotCode,
          `Uso e consumo finalizado a partir do orçamento ${budgetRealId}. CFOP ${cfop}.`,
          JSON.stringify({
            budget_id: budgetRealId,
            uso_consumo_id: uso.uso_consumo_id,
            department,
            responsible,
            reason,
            cfop,
            product_grade_id: productGradeId,
            grade_label: gradeLabel,
          }),
        ]
      );
    }

    await client.query(
      `
  UPDATE public.budgets
  SET status = 'USO_CONSUMO',
      updated_at = NOW()
  WHERE budget_id = $1
  `,
      [budgetRealId]
    );

    await client.query('COMMIT');

    return await getById(uso.uso_consumo_id);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[usoConsumoApi][finishBudgetAsUsoConsumo][ERROR]', error);
    throw error;
  } finally {
    client.release();
  }
}
