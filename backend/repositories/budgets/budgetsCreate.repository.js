// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsCreate.repository.js — create                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { verifyBudgetStockOverrideToken } from '../../services/security/budgetAuthorizationToken.js';
import {
  BUDGETS_PRIMARY_KEY,
  BUDGETS_INSERT_COLUMNS,
} from './budgets.catalog.js';
import {
  TB_BUDGETS,
  TB_BUDGET_ITEMS,
} from './budgets.constants.js';
import { normalizeHeaderIn } from './budgets.sanitizers.js';
import { resolveSellerIdByUserId } from './budgetsLookup.repository.js';
import {
  prepareItemsForPersist,
  resolveBudgetItemGradeId,
} from './budgetsItemsPrepare.repository.js';
import {
  BUDGET_HEADER_PERSIST_COLUMNS,
  buildBudgetInsertData,
} from './budgets.persistence.js';

// ----------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------
export async function create({ header = {}, items = [] } = {}, ctx = {}) {
  const h = normalizeHeaderIn(header);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = ctx?.userId ?? null;
    const autoSellerId = await resolveSellerIdByUserId(client, userId);
    if (autoSellerId) h.seller_id = autoSellerId;

    if (h.operation_type_id) {
      const operation = await client.query(
        `SELECT operation_type_id FROM public."nfeOperationTypes" WHERE operation_type_id = $1 AND active = TRUE LIMIT 1`,
        [h.operation_type_id],
      );
      if (!operation.rowCount) throw new Error('Operação fiscal inexistente ou inativa.');
    }

    const insertData = buildBudgetInsertData(h);

    const cols = BUDGET_HEADER_PERSIST_COLUMNS.filter(
      (column) =>
        BUDGETS_INSERT_COLUMNS.includes(column) &&
        Object.prototype.hasOwnProperty.call(insertData, column)
    );

    const vals = cols.map((_, i) => `$${i + 1}`);
    const args = cols.map((c) => insertData[c]);

    const sql = `
        INSERT INTO ${TB_BUDGETS} (${cols.join(',')})
        VALUES (${vals.join(',')})
        RETURNING ${BUDGETS_PRIMARY_KEY}, seller_id
      `;
    const ins = await client.query(sql, args);
    const budgetId = ins.rows[0][BUDGETS_PRIMARY_KEY];

    const issueDate = h.issue_date || new Date().toISOString().slice(0, 10);
    const preparedItems = await prepareItemsForPersist(client, items, issueDate, {
      ...ctx,
      userId,
      skipStockValidation: !!ctx?.skipStockValidation,
    });

    if (preparedItems.length) {
      const itemSql = `
    INSERT INTO ${TB_BUDGET_ITEMS}
      (
        budget_id,
        product_code,
        barcode_id,
        manufacturer_ref,
        description,
        grade_id,
        unit_code,
        conversion_factor,
        quantity,
        unit_price,
        discount_value,
        price_id,
        commission_id,
        lot_id,
        override_stock,
        override_token,
        override_approved_at,
        override_approved_by,
        override_reason,
        override_qty,
        override_lot_id
      )
  VALUES
    (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21
    )
  `;

      for (const it of preparedItems) {
        const finalGradeId = await resolveBudgetItemGradeId(client, it);

        console.log('[budgetsApi.create][ITEM-INSERT-DEBUG]', {
          product_code: it.product_code,

          lot_id: it.lot_id,
          lot_id_type: typeof it.lot_id,

          override_stock: it.override_stock,

          override_lot_id: it.override_lot_id,
          override_lot_id_type: typeof it.override_lot_id,

          override_reason: it.override_reason,
          override_qty: it.override_qty,

          token_payload: it.override_token
            ? verifyBudgetStockOverrideToken(it.override_token)
            : null,
        });

        await client.query(itemSql, [
          budgetId,
          it.product_code,
          it.barcode_id,
          it.manufacturer_ref ?? null,
          it.description,
          finalGradeId,
          it.unit_code,
          it.conversion_factor,
          it.quantity,
          it.unit_price,
          it.discount_value,
          it.price_id,
          it.commission_id,
          it.lot_id ?? null,
          !!it.override_stock,
          it.override_token ?? null,
          it.override_approved_at ?? null,
          it.override_approved_by ?? null,
          it.override_reason ?? null,
          it.override_qty ?? null,
          it.override_lot_id ?? null,
        ]);
      }
    }

    await client.query('COMMIT');
    return { ok: true, id: budgetId, seller_id: h.seller_id ?? null };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, error: String(err?.message || err) };
  } finally {
    client.release();
  }
}
