// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersCreate.repository.js — createFromBudget                        ║
// ║ Cria pedido a partir de orçamento + baixa estoque                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as sellerByOrdersApi from '../sellerByOrders/sellerByOrders.index.js';
import { ORDER_STATUS } from '../../services/shared/constants/orderStatus.js';
import { ORDERS_PRIMARY_KEY, ORDER_INSERT_COLUMNS } from './orders.catalog.js';
import { ORDER_ITEM_INSERT_COLUMNS } from './ordersItems.catalog.js';
import { TB_ORDERS, TB_ORDER_ITEMS, TB_BUDGETS, TB_PRODUCTS_GRADES, TB_SELLER_BY_USER } from './orders.constants.js';
import { buildInsertSql } from './orders.sql.js';
import { ensureTables } from './ordersSchema.repository.js';
import { safeCreateOrderAuditLog } from './ordersAudit.repository.js';
import { reportOrdersError, safeText, coalesceTaxId } from './orders.utils.js';
import { budgetToOrderRecord, budgetItemToOrderItemRecord } from './orders.mappers.js';
import { getById } from './ordersGetById.repository.js';
import { loadBudgetFull, resolveCustomerIdByDoc, upsertCustomersIbgeFromCustomers } from './ordersBudget.repository.js';
import { syncPaymentsFromBudgetToOrder } from './ordersPayments.repository.js';
import { syncShippingFromBudgetToOrder } from './ordersShipping.repository.js';

// ----------------------------------------------------------------------
// Create pedido a partir de orçamento + baixa estoque + converte orçamento
// ✅ + sellerByOrders (auto vincula vendedor)
// ✅ + lot_id: preserva o lote escolhido no orçamento
// ✅ + INSERTs montados a partir de ORDER_INSERT_COLUMNS / ORDER_ITEM_INSERT_COLUMNS
// ----------------------------------------------------------------------
export async function createFromBudget(budgetId, meta = {}) {
  await ensureTables();

  const id = Number(budgetId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'budgetId inválido' };
  }

  const budget = await loadBudgetFull(id);
  if (!budget) return { ok: false, error: 'NOT_FOUND' };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const h = budget.header;

    console.log('[ordersApi.createFromBudget] budget financial debug:', {
      budget_id: id,
      subtotal: h.subtotal,
      items_discount_total: h.items_discount_total,
      global_discount_type: h.global_discount_type,
      global_discount_value: h.global_discount_value,
      global_discount_amount: h.global_discount_amount,
      total_discount: h.total_discount,
      total_amount: h.total_amount,
      budget_shipping_id: h.budget_shipping_id,
    });

    let customerId = h.customer_id ?? null;

    if (!customerId) {
      customerId = await resolveCustomerIdByDoc(client, coalesceTaxId(h) ?? '');
    }

    const sellerId = safeText(meta?.seller_id ?? h.seller_id, null);

    const orderRecord = budgetToOrderRecord(id, h, { customerId, sellerId });

    const orderInsert = buildInsertSql(
      TB_ORDERS,
      ORDER_INSERT_COLUMNS,
      orderRecord,
      ORDERS_PRIMARY_KEY,
    );
    const insOrderRes = await client.query(orderInsert.sql, orderInsert.values);

    const orderId = Number(insOrderRes.rows[0][ORDERS_PRIMARY_KEY]);
    // The new schema no longer stores a duplicate order number.
    // Keep the public API compatible by using order_id as order_number.
    const orderNumber = orderId;

    if (customerId) {
      await upsertCustomersIbgeFromCustomers(client, customerId);
    }

    for (const it of budget.items) {
      const itemRecord = budgetItemToOrderItemRecord(orderId, id, it);

      console.log('[ORDER][LOT]', {
        product_code: itemRecord.product_code,
        lot_id: it.lot_id,
        quantity: itemRecord.quantity,
      });

      const itemInsert = buildInsertSql(
        TB_ORDER_ITEMS,
        ORDER_ITEM_INSERT_COLUMNS,
        itemRecord,
      );
      await client.query(itemInsert.sql, itemInsert.values);

      if (itemRecord.grade_id != null && itemRecord.quantity > 0) {
        await client.query(
          `
          UPDATE ${TB_PRODUCTS_GRADES}
          SET stock = stock - $1
          WHERE product_id = $2
            AND grade_id  = $3
          `,
          [itemRecord.quantity, itemRecord.product_code, itemRecord.grade_id],
        );
      }
    }

    await client.query(
      `
      UPDATE ${TB_BUDGETS}
      SET status = '${ORDER_STATUS.CONVERTED}',
          updated_at = NOW()
      WHERE budget_id = $1
      `,
      [id],
    );

    await syncPaymentsFromBudgetToOrder({
      client,
      budgetId: id,
      orderId,
    });

    await syncShippingFromBudgetToOrder({
      client,
      budgetId: id,
      orderId,
    });

    try {
      await sellerByOrdersApi.ensureTables();

      let relationSellerId = meta?.seller_id != null ? Number(meta.seller_id) : null;

      if (!relationSellerId && meta?.user_id != null) {
        const userId = Number(meta.user_id);

        if (Number.isFinite(userId) && userId > 0) {
          const sbu = await client.query(
            `
            SELECT seller_id
            FROM ${TB_SELLER_BY_USER}
            WHERE user_id = $1
              AND active = TRUE
            ORDER BY is_primary DESC, id ASC
            LIMIT 1
            `,
            [userId],
          );

          relationSellerId = sbu.rows?.[0]?.seller_id
            ? Number(sbu.rows[0].seller_id)
            : null;
        }
      }

      // total_amount já normalizado a partir do orçamento
      const orderTotal = orderRecord.total_amount;

      if (relationSellerId && Number.isFinite(relationSellerId) && relationSellerId > 0) {
        const existing = await client.query(
          `
          SELECT 1
          FROM public."sellerByOrders"
          WHERE order_id = $1
            AND is_primary = TRUE
          LIMIT 1
          `,
          [orderId],
        );

        if (!existing.rowCount) {
          await sellerByOrdersApi.create({
            order_id: orderId,
            seller_id: relationSellerId,
            user_id: meta?.user_id ?? null,
            role: 'PRIMARY',
            is_primary: true,
            order_total: orderTotal,
            active: true,
            locked: false,
          });
        }
      }
    } catch (e) {
      console.warn(
        '[ordersApi.createFromBudget] sellerByOrders WARN:',
        e?.message || e,
      );
    }

    await client.query('COMMIT');

    const createdOrder = await getById(orderId);

    await safeCreateOrderAuditLog({
      register_id: orderId,
      operation: 'CREATE_FROM_BUDGET',
      user_id: meta?.user_id ?? null,
      before: {
        budget_id: id,
        budget_header: h,
        budget_items: budget.items,
      },
      after: createdOrder?.ok
        ? createdOrder
        : {
          order_id: orderId,
          order_number: orderNumber,
          budget_id: id,
        },
    });

    return {
      ok: true,
      order_id: orderId,
      order_number: orderNumber,
      budget_id: id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    reportOrdersError('[ordersApi.createFromBudget] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}
