// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsUpdate.repository.js — update                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { verifyBudgetStockOverrideToken } from '../../services/security/budgetAuthorizationToken.js';
import {
  BUDGETS_PRIMARY_KEY,
  BUDGETS_UPDATE_COLUMNS,
} from './budgets.catalog.js';
import {
  TB_BUDGETS,
  TB_BUDGET_ITEMS,
  TB_BUDGETS_SHIPPING,
} from './budgets.constants.js';
import { normalizeHeaderIn } from './budgets.sanitizers.js';
import { resolveSellerIdByUserId } from './budgetsLookup.repository.js';
import {
  prepareItemsForPersist,
  resolveBudgetItemGradeId,
} from './budgetsItemsPrepare.repository.js';
import {
  BUDGET_HEADER_PERSIST_COLUMNS,
  buildBudgetUpdateData,
} from './budgets.persistence.js';

// ----------------------------------------------------------------------
// Update
// ----------------------------------------------------------------------
export async function update(budgetId, { header = {}, items } = {}, ctx = {}) {
  const client = await pool.connect();

  try {
    const bid = Number(budgetId);
    if (!Number.isFinite(bid) || bid <= 0) {
      return { ok: false, error: 'BAD_REQUEST' };
    }

    await client.query('BEGIN');

    // Preserve the current fiscal operation when older frontend payloads
    // do not send operation_type_id on Save. This prevents an existing
    // valid operation from being erased/rejected during an ordinary edit.
    const currentRes = await client.query(
      `
        SELECT
          b.operation_type_id,
          COALESCE(
            b.budget_shipping_id,
            (
              SELECT bs.budget_shipping_id
              FROM ${TB_BUDGETS_SHIPPING} bs
              WHERE bs.budget_id = b.budget_id
              ORDER BY bs.budget_shipping_id DESC
              LIMIT 1
            )
          ) AS budget_shipping_id
        FROM ${TB_BUDGETS} b
        WHERE b.${BUDGETS_PRIMARY_KEY} = $1
        LIMIT 1
      `,
      [bid],
    );

    if (!currentRes.rowCount) {
      throw new Error('NOT_FOUND');
    }

    const mergedHeader = { ...header };
    const incomingOperationTypeId =
      mergedHeader.operation_type_id ??
      mergedHeader.operationTypeId ??
      null;

    if (
      incomingOperationTypeId === null ||
      incomingOperationTypeId === undefined ||
      String(incomingOperationTypeId).trim() === ''
    ) {
      mergedHeader.operation_type_id =
        currentRes.rows[0]?.operation_type_id ?? null;
    }

    const incomingShippingId =
      mergedHeader.budget_shipping_id ??
      mergedHeader.budgetShippingId ??
      null;

    if (
      incomingShippingId === null ||
      incomingShippingId === undefined ||
      String(incomingShippingId).trim() === ''
    ) {
      mergedHeader.budget_shipping_id =
        currentRes.rows[0]?.budget_shipping_id ?? null;
    }

    const h = normalizeHeaderIn(mergedHeader);

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

    const updateData = buildBudgetUpdateData(h);

    const setCols = BUDGET_HEADER_PERSIST_COLUMNS.filter(
      (column) =>
        BUDGETS_UPDATE_COLUMNS.includes(column) &&
        Object.prototype.hasOwnProperty.call(updateData, column)
    );

    const sets = setCols.map((c, i) => `${c} = $${i + 1}`);
    const args = setCols.map((c) => updateData[c]);
    args.push(bid);

    const upSql = `
        UPDATE ${TB_BUDGETS}
        SET ${sets.join(', ')}
        WHERE budget_id = $${args.length}
        RETURNING ${BUDGETS_PRIMARY_KEY}, seller_id
      `;
    const up = await client.query(upSql, args);

    if (!up.rowCount) {
      throw new Error('NOT_FOUND');
    }

    if (Array.isArray(items)) {
      const issueDate = h.issue_date || new Date().toISOString().slice(0, 10);
      const preparedItems = await prepareItemsForPersist(client, items, issueDate, {
        ...ctx,
        userId,
        skipStockValidation: !!ctx?.skipStockValidation,
      });

      await client.query(`DELETE FROM ${TB_BUDGET_ITEMS} WHERE budget_id = $1`, [bid]);

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
            bid,
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
    }

    await client.query('COMMIT');
    return { ok: true, id: bid, seller_id: up.rows[0].seller_id ?? null };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, error: String(err?.message || err) };
  } finally {
    client.release();
  }
}
