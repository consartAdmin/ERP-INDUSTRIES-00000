// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsItemsPrepare.repository.js — Pipeline de itens                ║
// ║ prepareItemsForPersist / resolveBudgetItemGradeId                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { getBudgetSettings } from '../budgetSettings/budgetSettings.index.js';
import { verifyBudgetStockOverrideToken } from '../../services/security/budgetAuthorizationToken.js';
import {
  normalizeItemIn,
  validateItemBarcode,
} from './budgets.sanitizers.js';
import { validateStockOrOverride } from './budgetsStock.repository.js';
import { resolveCommissionId } from './budgetsLookup.repository.js';
import {
  SINGLE_PRICE_ID,
  resolveBudgetPriceMode,
  resolveBudgetStockMode,
} from './budgetsModes.repository.js';

// ----------------------------------------------------------------------
// Item preparation pipeline
// ----------------------------------------------------------------------
export async function prepareItemsForPersist(
  client,
  items = [],
  issueDate,
  ctx = {}
) {
  const out = [];
  const skipStockValidation = !!ctx?.skipStockValidation;
  const budgetSettings = skipStockValidation
    ? null
    : await getBudgetSettings(client);

  /*
   * Resolve uma única vez por operação.
   * Evita consultar appFeatures para cada item do orçamento.
   */
  const [
    priceMode,
    stockMode,
  ] = await Promise.all([
    resolveBudgetPriceMode(ctx),
    resolveBudgetStockMode(ctx),
  ]);

  for (const raw of Array.isArray(items) ? items : []) {
    const it = normalizeItemIn(raw);

    await validateItemBarcode(client, it);

    /*
     * PRODUCT_STOCK_MODE
     * STOCK_SIMPLE remove lote residual.
     * STOCK_WITH_LOT exige lote nas gravações normais.
     * A cópia mantém skipStockValidation para permitir nova seleção posterior.
     */
    if (stockMode?.isSimple || stockMode?.requireLot === false) {
      it.lot_id = null;
      it.override_lot_id = null;
    } else if (!skipStockValidation && !it.lot_id) {
      const e = new Error(
        `Selecione um lote para o SKU ${it.product_code || ''}.`
      );
      e.status = 400;
      e.code = 'BUDGET_STOCK_LOT_REQUIRED';
      throw e;
    }

    /*
     * PRODUCT_PRICE_MODE
     *
     * SINGLE:
     *   força a tabela canônica price_id = 1.
     *
     * MULTIPLE:
     *   mantém a tabela selecionada no frontend.
     *
     * O unit_price nunca é recalculado aqui, preservando:
     *   - preço negociado;
     *   - preço manual autorizado;
     *   - preços históricos.
     */
    if (priceMode.isSingle) {
      it.price_id = SINGLE_PRICE_ID;
    }

    /*
     * A comissão deve ser resolvida somente depois da aplicação
     * da regra SINGLE/MULTIPLE.
     */
    if (
      (it.commission_id == null || it.commission_id === '') &&
      it.price_id
    ) {
      it.commission_id = await resolveCommissionId(client, {
        price_id: it.price_id,
        issue_date: issueDate,
      });
    }

    let overridePayload = null;

    if (!skipStockValidation) {
      const result = await validateStockOrOverride(
        client,
        it,
        {
          ...ctx,
          budgetSettings,
          stockMode,
        }
      );

      if (result?.override && result?.payload) {
        overridePayload = result.payload;
      }
    } else if (it.override_stock && it.override_token) {
      const check = verifyBudgetStockOverrideToken(
        it.override_token
      );

      if (check.ok) {
        overridePayload = check.payload || null;
      }
    }

    if (it.override_stock) {
      const approvedAt =
        it.override_approved_at ||
        new Date().toISOString();

      const approvedBy =
        it.override_approved_by ??
        (
          overridePayload?.user_id != null
            ? String(overridePayload.user_id)
            : null
        ) ??
        (
          ctx?.userId != null
            ? String(ctx.userId)
            : null
        );

      const approvedReason =
        it.override_reason ??
        overridePayload?.reason ??
        'Liberação manual de estoque';

      // ------------------------------------------------------------
      // Quantidade autorizada
      // IMPORTANTE:
      // Number(null) === 0, portanto precisamos testar null antes.
      // ------------------------------------------------------------
      let approvedQty = null;

      if (
        it.override_qty !== null &&
        it.override_qty !== undefined &&
        it.override_qty !== '' &&
        Number.isFinite(Number(it.override_qty))
      ) {
        approvedQty = Number(it.override_qty);
      } else if (
        overridePayload?.requested_qty !== null &&
        overridePayload?.requested_qty !== undefined &&
        overridePayload?.requested_qty !== '' &&
        Number.isFinite(Number(overridePayload.requested_qty))
      ) {
        approvedQty = Number(overridePayload.requested_qty);
      } else {
        approvedQty = Number(it.quantity || 0);
      }

      // ------------------------------------------------------------
      // Lote autorizado
      // NULL deve continuar sendo NULL.
      // Nunca converter null -> Number(null) -> 0.
      // ------------------------------------------------------------
      let approvedLotId = null;

      const rawApprovedLotId =
        it.override_lot_id != null && it.override_lot_id !== ''
          ? it.override_lot_id
          : overridePayload?.lot_id != null && overridePayload.lot_id !== ''
            ? overridePayload.lot_id
            : it.lot_id != null && it.lot_id !== ''
              ? it.lot_id
              : null;

      if (rawApprovedLotId !== null) {
        const parsedLotId = Number(rawApprovedLotId);

        approvedLotId =
          Number.isSafeInteger(parsedLotId) && parsedLotId > 0
            ? parsedLotId
            : null;
      }

      it.override_approved_at = approvedAt;
      it.override_approved_by = approvedBy;
      it.override_reason = approvedReason;
      it.override_qty = approvedQty;
      it.override_lot_id = approvedLotId;
    } else {
      it.override_approved_at = null;
      it.override_approved_by = null;
      it.override_reason = null;
      it.override_qty = null;
      it.override_lot_id = null;
    }

    out.push(it);
  }

  return out;
}

export async function resolveBudgetItemGradeId(client, it = {}) {
  const rawProductGradeId = Number(
    it.product_grade_id ||
    it.produto_grade_id ||
    it.productGradeId ||
    0
  );

  const rawGradeId = Number(it.grade_id || 0);

  if (rawProductGradeId > 0) {
    const q = await client.query(
      `
        SELECT grade_id
        FROM public."productsGrades"
        WHERE product_grade_id = $1
        LIMIT 1
        `,
      [rawProductGradeId]
    );

    return q.rows?.[0]?.grade_id || null;
  }

  if (rawGradeId > 0) {
    const q = await client.query(
      `
        SELECT grade_id
        FROM public.grades
        WHERE grade_id = $1
        LIMIT 1
        `,
      [rawGradeId]
    );

    return q.rows?.[0]?.grade_id || null;
  }

  return null;
}
