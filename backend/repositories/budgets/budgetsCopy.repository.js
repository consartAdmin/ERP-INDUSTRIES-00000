// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsCopy.repository.js — copyFromBudget                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { getById } from './budgetsGetById.repository.js';
import { create } from './budgetsCreate.repository.js';
import productsStockManager from '../productsStock/productsStock.manager.js';

// ----------------------------------------------------------------------
// Copy
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// Lots: the copy gets fresh lots from current stock (FEFO, same order as
// the lot select in the editor), not the lots of the source budget.
// Prefers the first lot whose free balance covers the quantity, then the
// first lot with any balance; items sharing a lot consume its balance.
// ----------------------------------------------------------------------
async function assignLotsForCopy(items, ctx = {}) {
  let mode = null;

  try {
    mode = await productsStockManager.resolveProductsStockMode(ctx);
  } catch (err) {
    console.warn('[budgetsApi.copyFromBudget] stock mode:', err?.message || err);
    return;
  }

  if (!mode?.isWithLot) return;

  const lotsByCode = new Map();
  const usedByLot = new Map();

  for (const it of items) {
    const code = String(it.product_code || '').trim();
    if (!code) continue;

    if (!lotsByCode.has(code)) {
      try {
        lotsByCode.set(
          code,
          await productsStockManager.getProductsStockLotsByProductCode(code, null, ctx)
        );
      } catch (err) {
        console.warn(`[budgetsApi.copyFromBudget] lots ${code}:`, err?.message || err);
        lotsByCode.set(code, []);
      }
    }

    const gradeId = it.grade_id != null ? Number(it.grade_id) : null;
    const candidates = (lotsByCode.get(code) || [])
      .filter((lot) => gradeId == null || Number(lot.grade_id) === gradeId)
      .map((lot) => ({
        lot_id: Number(lot.lot_id),
        free:
          Number(lot.qty_available || 0) -
          (usedByLot.get(Number(lot.lot_id)) || 0),
      }))
      .filter((lot) => lot.free > 0);

    const qty = Number(it.quantity || 0);
    const chosen =
      candidates.find((lot) => lot.free >= qty) ||
      candidates[0] ||
      null;

    if (!chosen) continue;

    it.lot_id = chosen.lot_id;
    usedByLot.set(
      chosen.lot_id,
      (usedByLot.get(chosen.lot_id) || 0) + Math.min(qty, chosen.free)
    );
  }
}

// options.itemIds: budget_item_id list chosen in the copy modal. When it is
// provided only those items are copied and the header totals are recomputed.
// ----------------------------------------------------------------------
function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeItemIds(raw) {
  if (!Array.isArray(raw)) return null;

  return new Set(
    raw
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0)
  );
}

export async function copyFromBudget(sourceBudgetId, ctx = {}, options = {}) {
  const bid = Number(sourceBudgetId);

  if (!Number.isFinite(bid) || bid <= 0) {
    return {
      ok: false,
      error: 'BAD_REQUEST',
    };
  }

  try {
    const source = await getById(bid);

    if (!source?.ok || !source?.header) {
      return {
        ok: false,
        error: source?.error || 'NOT_FOUND',
      };
    }

    const srcHeader = source.header;
    const allSrcItems = Array.isArray(source.items)
      ? source.items
      : [];

    const selectedIds = normalizeItemIds(options?.itemIds);
    const srcItems = selectedIds
      ? allSrcItems.filter((it) => selectedIds.has(Number(it.budget_item_id)))
      : allSrcItems;

    if (selectedIds && !srcItems.length) {
      return {
        ok: false,
        error: 'BAD_REQUEST',
        message: 'Selecione ao menos um produto para copiar.',
      };
    }

    // ================================================================
    // HEADER
    // ================================================================
    const newHeader = {
      issue_date: new Date().toISOString().slice(0, 10),
      status: 'ABERTO',

      // --------------------------------------------------------------
      // Customer
      // --------------------------------------------------------------
      customer_id:
        srcHeader.customer_id ??
        null,

      customer_name:
        srcHeader.customer_name ?? null,

      customer_tax_id:
        srcHeader.customer_tax_id ?? null,

      customer_email: srcHeader.customer_email ?? srcHeader.email ?? null,
      customer_phone: srcHeader.customer_phone ?? srcHeader.phone ?? null,

      // --------------------------------------------------------------
      // Commercial / fiscal operation
      // --------------------------------------------------------------
      operation_type_id:
        srcHeader.operation_type_id ??
        null,

      payment_form_id:
        srcHeader.payment_form_id ??
        null,

      payment_term_id:
        srcHeader.payment_term_id ??
        null,

      // --------------------------------------------------------------
      // Notes. Shipping is not shared because budgets.budget_shipping_id is unique.
      // --------------------------------------------------------------
      notes:
        srcHeader.notes ??
        null,

      budget_shipping_id: null,

      // --------------------------------------------------------------
      // Totals / discounts
      // --------------------------------------------------------------
      subtotal:
        Number(srcHeader.subtotal || 0),

      items_discount_total:
        Number(srcHeader.items_discount_total || 0),

      total_discount:
        Number(srcHeader.total_discount || 0),

      global_discount_type:
        srcHeader.global_discount_type ||
        'value',

      global_discount_value:
        Number(srcHeader.global_discount_value || 0),

      global_discount_amount:
        Number(srcHeader.global_discount_amount || 0),

      total_amount:
        Number(srcHeader.total_amount || 0),

      // --------------------------------------------------------------
      // A copy should not inherit the original seller automatically
      // --------------------------------------------------------------
      seller_id: null,
    };

    // ================================================================
    // ITEMS
    // ================================================================
    const newItems = srcItems.map((it) => ({
      product_code: it.product_code ?? null,
      barcode_id: it.barcode_id ?? null,

      manufacturer_ref:
        it.manufacturer_ref ??
        null,

      description:
        it.description ??
        '',

      grade_id:
        it.grade_id ??
        null,

      unit_code: it.unit_code ?? it.unit ?? 'UN',
      conversion_factor: Number(it.conversion_factor || 1),

      quantity:
        Number(it.quantity || 0),

      unit_price:
        Number(it.unit_price || 0),

      discount_value:
        Number(it.discount_value || 0),

      price_id:
        it.price_id ??
        null,

      // Do not inherit commission from original budget
      commission_id: null,

      // Lot is not inherited; assignLotsForCopy() picks one from stock
      lot_id: null,

      override_stock: false,
      override_token: null,
    }));

    // ================================================================
    // TOTALS — only part of the items was copied, so recompute from them
    // (same rule as recalcTotals() in public/budgets/js/budgets.items.js;
    // freight is not copied).
    // ================================================================
    if (selectedIds && srcItems.length !== allSrcItems.length) {
      const subtotal = newItems.reduce(
        (sum, it) => sum + Math.max(0, it.quantity) * Math.max(0, it.unit_price),
        0
      );
      const itemsDiscount = newItems.reduce(
        (sum, it) => sum + Math.max(0, it.discount_value),
        0
      );
      const base = Math.max(0, subtotal - itemsDiscount);

      const globalType =
        String(newHeader.global_discount_type || 'value').trim().toLowerCase() === 'percent'
          ? 'percent'
          : 'value';
      const globalValue = Math.max(0, newHeader.global_discount_value);
      const globalAmount = globalType === 'percent'
        ? Math.min(base, base * (globalValue / 100))
        : Math.min(base, globalValue);

      newHeader.global_discount_type = globalType;
      newHeader.subtotal = roundMoney(subtotal);
      newHeader.items_discount_total = roundMoney(itemsDiscount);
      newHeader.global_discount_amount = roundMoney(globalAmount);
      newHeader.total_discount = roundMoney(itemsDiscount + globalAmount);
      newHeader.total_amount = roundMoney(Math.max(0, base - globalAmount));
    }

    await assignLotsForCopy(newItems, ctx);

    // ================================================================
    // VALIDATION
    // ================================================================
    if (!newHeader.operation_type_id) {
      return {
        ok: false,
        error: 'SOURCE_BUDGET_WITHOUT_OPERATION_TYPE',
        message:
          `O orçamento ${bid} não possui operation_type_id definido.`,
      };
    }

    // ================================================================
    // CREATE COPY
    // ================================================================
    return await create(
      {
        header: newHeader,
        items: newItems,
      },
      {
        ...ctx,

        // Copying should not reserve/check the original stock lots.
        skipStockValidation: true,
      }
    );
  } catch (err) {
    console.error(
      `[budgetsApi.copyFromBudget] Erro ao copiar orçamento ${bid}:`,
      err
    );

    return {
      ok: false,
      error: String(err?.message || err),
    };
  }
}
