// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersReturnToBudget.repository.js — returnToBudget                  ║
// ║ Cancela pedido, reabre orçamento, devolve estoque                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDER_STATUS } from '../../services/shared/constants/orderStatus.js';
import { ORDER_COLUMNS } from './orders.catalog.js';
import { TB_ORDERS, TB_ORDER_ITEMS, TB_BUDGETS, TB_INVOICES_ISSUED, TB_PRODUCTS_GRADES } from './orders.constants.js';
import { selectColumns } from './orders.sql.js';
import { ensureTables } from './ordersSchema.repository.js';
import { safeCreateOrderAuditLog } from './ordersAudit.repository.js';
import { reportOrdersError, hasNfeGenerated } from './orders.utils.js';
import { getById } from './ordersGetById.repository.js';

// ----------------------------------------------------------------------
// 🔄 Return Order -> Cancel order + reopen budget + restore stock
// ONLY if NF-e NOT generated
// ----------------------------------------------------------------------
export async function returnToBudget(orderId) {
  await ensureTables();

  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'ID inválido' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ordRes = await client.query(
      `
      SELECT
        ${selectColumns('o', ORDER_COLUMNS)},
        ii.nfe_status,
        ii.nfe_key,
        ii.nfe_number,
        ii.nfe_protocol,
        ii.nfe_environment,
        ii.nfe_provider_id AS nfe_plugnotas_id,
        ii.xml_url AS nfe_xml_url,
        ii.danfe_url AS nfe_danfe_url
      FROM ${TB_ORDERS} o
      LEFT JOIN LATERAL (
        SELECT i.*
        FROM ${TB_INVOICES_ISSUED} i
        WHERE i.order_id = o.order_id
        ORDER BY i.issued_at DESC NULLS LAST, i.invoice_id DESC
        LIMIT 1
      ) ii ON TRUE
      WHERE o.order_id = $1
      FOR UPDATE OF o
      `,
      [id]
    );
    if (!ordRes.rowCount) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'NOT_FOUND' };
    }

    const order = ordRes.rows[0];

    if (hasNfeGenerated(order)) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Ação bloqueada: este pedido já possui NF-e gerada.' };
    }

    const budgetId = Number(order.budget_id || 0);
    if (!Number.isFinite(budgetId) || budgetId <= 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Este pedido não possui budget_id vinculado para retornar.' };
    }

    const st = String(order.status || '').toUpperCase();
    if (st === ORDER_STATUS.CANCELLED || st === 'CANCELLED') {
      await client.query(
        `UPDATE ${TB_BUDGETS} SET status = '${ORDER_STATUS.OPEN}', updated_at = NOW() WHERE budget_id = $1`,
        [budgetId]
      );
      await client.query('COMMIT');
      return { ok: true, order_id: id, budget_id: budgetId, message: 'Pedido já estava cancelado; orçamento reaberto.' };
    }

    const itemsRes = await client.query(
      `SELECT product_code, grade_id, quantity FROM ${TB_ORDER_ITEMS} WHERE order_id = $1`,
      [id]
    );

    for (const it of itemsRes.rows) {
      const qty = Number(it.quantity || 0);
      const gradeId = it.grade_id ?? null;
      if (qty > 0 && gradeId != null) {
        await client.query(
          `
          UPDATE ${TB_PRODUCTS_GRADES}
          SET stock = stock + $1
          WHERE product_id = $2
            AND grade_id  = $3
          `,
          [qty, String(it.product_code), gradeId]
        );
      }
    }

    await client.query(
      `UPDATE ${TB_ORDERS} SET status = '${ORDER_STATUS.RETURNED_TO_BUDGET}', updated_at = NOW() WHERE order_id = $1`,
      [id]
    );

    await client.query(
      `UPDATE ${TB_BUDGETS} SET status = '${ORDER_STATUS.OPEN}', updated_at = NOW() WHERE budget_id = $1`,
      [budgetId]
    );

    await client.query('COMMIT');

    const afterOrder = await getById(id);

    await safeCreateOrderAuditLog({
      register_id: id,
      operation: 'RETURN_TO_BUDGET',
      user_id: null,
      before: {
        order,
        items: itemsRes.rows,
      },
      after: afterOrder?.ok ? afterOrder : {
        order_id: id,
        budget_id: budgetId,
        status: ORDER_STATUS.RETURNED_TO_BUDGET,
      },
    });

    return { ok: true, order_id: id, budget_id: budgetId };
  } catch (err) {
    await client.query('ROLLBACK');
    reportOrdersError('[ordersApi.returnToBudget] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}
