// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersGetById.repository.js — getById                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDERS_PRIMARY_KEY } from './orders.catalog.js';
import { ORDERS_ITEMS_PRIMARY_KEY } from './ordersItems.catalog.js';
import { TB_ORDERS, TB_ORDER_ITEMS, TB_ORDER_SHIPPING, TB_ORDERS_PAYMENTS, TB_GRADES, TB_PRODUCTS, TB_PRODUCTS_FISCAL, TB_FISCAL_CLASSIFICATION, TB_FISCAL_PROFILE, TB_ORDERS_PAYMENT_INSTALLMENTS } from './orders.constants.js';
import { qi, AGG_FIELDS, ORDER_SELECT, ORDER_ITEM_SELECT, buildBaseFromWhere } from './orders.sql.js';
import { ensureTables } from './ordersSchema.repository.js';
import { reportOrdersError } from './orders.utils.js';
import { rowToOrder, rowToItem, buildPaymentLines, buildDuplicatasLines, buildPaymentObservationText } from './orders.mappers.js';

// ----------------------------------------------------------------------
// Read
// ----------------------------------------------------------------------
export async function getById(orderId) {
  await ensureTables();

  const client = await pool.connect();

  try {
    const headSql = `
      SELECT ${ORDER_SELECT}, ${AGG_FIELDS}
      ${buildBaseFromWhere(`WHERE o.${qi(ORDERS_PRIMARY_KEY)} = $1`)}
    `;

    const head = await client.query(headSql, [orderId]);

    if (!head.rowCount) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    const itemSql = `
      SELECT
        ${ORDER_ITEM_SELECT},
        g.grade AS grade,

        pf.products_fiscal_id,
        pf.fiscal_classification_id,

        fc.classification_name,
        fc.ncm_code             AS ncm,
        fc.ncm_description,
        fc.ex_tipi,
        fc.cest_code            AS cest,
        fc.cest_description,

        fp.fiscal_profile_id,
        fp.profile_name,
        fp.description          AS profile_description,
        fp.icms_cst,
        fp.icms_rate,
        fp.cfop_entry,
        fp.cfop_exit,
        fp.origin_code,
        fp.pis_cst,
        fp.pis_rate,
        fp.cofins_cst,
        fp.cofins_rate,
        fp.benefit_code,

        fc.is_cst,
        fc.is_classification,
        fc.is_rate,
        fc.is_specific_rate,
        fc.is_unit,
        fc.ibscbs_cst,
        fc.ibscbs_classification,
        fc.ibs_uf_rate,
        fc.ibs_municipal_rate,
        fc.cbs_rate,
        fc.donation_indicator,
        fc.tax_reform_details

      FROM ${TB_ORDER_ITEMS} oi

      LEFT JOIN ${TB_GRADES} g
        ON g.grade_id = oi.grade_id

      LEFT JOIN ${TB_PRODUCTS} p
        ON p.product_code = oi.product_code

      LEFT JOIN ${TB_PRODUCTS_FISCAL} pf
        ON pf.product_code = oi.product_code
       AND pf.is_current = TRUE
       AND pf.is_active  = TRUE

      LEFT JOIN ${TB_FISCAL_CLASSIFICATION} fc
        ON fc.fiscal_classification_id = pf.fiscal_classification_id
       AND fc.is_active = TRUE

      LEFT JOIN ${TB_FISCAL_PROFILE} fp
        ON fp.fiscal_profile_id = fc.fiscal_profile_id
       AND fp.is_active = TRUE

      WHERE oi.order_id = $1
      ORDER BY oi.${qi(ORDERS_ITEMS_PRIMARY_KEY)} ASC
    `;

    const items = await client.query(itemSql, [orderId]);

    const paymentsRes = await client.query(
      `
      SELECT *
      FROM ${TB_ORDERS_PAYMENTS}
      WHERE order_id = $1
      ORDER BY order_payment_id
      `,
      [orderId]
    );

    const installmentsRes = await client.query(
      `
      SELECT opi.*
      FROM ${TB_ORDERS_PAYMENT_INSTALLMENTS} opi
      JOIN ${TB_ORDERS_PAYMENTS} op
        ON op.order_payment_id = opi.order_payment_id
      WHERE op.order_id = $1
      ORDER BY opi.installment_number
      `,
      [orderId]
    );

    // ------------------------------------------------------------------
    // Shipping
    // ------------------------------------------------------------------

    const shippingRes = await client.query(
      `
      SELECT os.*
      FROM ${TB_ORDERS} o
      LEFT JOIN ${TB_ORDER_SHIPPING} os
        ON os.order_shipping_id = o.order_shipping_id
      WHERE o.order_id = $1
      LIMIT 1
      `,
      [orderId]
    );

    const shipping = shippingRes.rows?.[0] || null;

    console.log('[ordersApi.getById] shipping:', shipping);

    // ------------------------------------------------------------------

    const payments = paymentsRes.rows || [];
    const installments = installmentsRes.rows || [];

    const payment_lines = buildPaymentLines(payments);
    const duplicatas = buildDuplicatasLines(payments, installments);
    const payment_observation = buildPaymentObservationText(
      payments,
      installments
    );

    const header = rowToOrder(head.rows[0]);

    return {
      ok: true,

      header: {
        ...header,
        shipping,
      },

      shipping,

      items: items.rows.map(rowToItem),

      payments,
      installments,

      payment_lines,
      duplicatas,
      payment_observation,
    };
  } catch (err) {
    reportOrdersError('[ordersApi.getById] ERR:', err);

    return {
      ok: false,
      error: String(err.message || err),
    };
  } finally {
    client.release();
  }
}
