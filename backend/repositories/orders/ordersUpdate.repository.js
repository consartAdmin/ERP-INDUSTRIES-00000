// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersUpdate.repository.js — update                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDERS_PRIMARY_KEY, ORDER_UPDATE_COLUMNS } from './orders.catalog.js';
import { TB_ORDERS, TB_ORDER_SHIPPING, TB_INVOICES_ISSUED } from './orders.constants.js';
import { qi, buildUpdateSql } from './orders.sql.js';
import { ensureTables } from './ordersSchema.repository.js';
import { safeCreateOrderAuditLog } from './ordersAudit.repository.js';
import { reportOrdersError, toPgDate, toPgTimestamp, isFiniteNum } from './orders.utils.js';
import { patchToOrderUpdateRecord } from './orders.mappers.js';
import { getById } from './ordersGetById.repository.js';

// ----------------------------------------------------------------------
// Update / Delete / Totais
// ----------------------------------------------------------------------
export async function update(orderId, patch = {}) {
  await ensureTables();

  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'ID inválido' };
  }

  const beforeOrder = await getById(id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Somente colunas de ORDER_UPDATE_COLUMNS presentes no patch.
    const orderPatch = patchToOrderUpdateRecord(patch);

    if (Object.keys(orderPatch).length) {
      const { sql, values } = buildUpdateSql(
        TB_ORDERS,
        ORDERS_PRIMARY_KEY,
        ORDER_UPDATE_COLUMNS,
        orderPatch,
        id,
      );

      const r = await client.query(sql, values);
      if (!r.rowCount) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'NOT_FOUND' };
      }
    } else {
      const exists = await client.query(
        `SELECT 1 FROM ${TB_ORDERS} WHERE ${qi(ORDERS_PRIMARY_KEY)} = $1`,
        [id],
      );
      if (!exists.rowCount) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'NOT_FOUND' };
      }
    }

    // freight_value now belongs to ordersShipping.
    if (patch.freight_value != null && isFiniteNum(patch.freight_value)) {
      const freightValue = Number(patch.freight_value);
      const shippingRef = await client.query(
        `SELECT order_shipping_id FROM ${TB_ORDERS} WHERE order_id = $1 FOR UPDATE`,
        [id],
      );
      const shippingId = shippingRef.rows?.[0]?.order_shipping_id ?? null;

      if (shippingId) {
        await client.query(
          `
          UPDATE ${TB_ORDER_SHIPPING}
          SET freight_value = $1,
              updated_at = NOW()
          WHERE order_shipping_id = $2
          `,
          [freightValue, shippingId],
        );
      } else {
        const shippingInsert = await client.query(
          `
          INSERT INTO ${TB_ORDER_SHIPPING} (freight_mode, freight_value)
          VALUES (9, $1)
          RETURNING order_shipping_id
          `,
          [freightValue],
        );

        const link = buildUpdateSql(
          TB_ORDERS,
          ORDERS_PRIMARY_KEY,
          ORDER_UPDATE_COLUMNS,
          { order_shipping_id: shippingInsert.rows[0].order_shipping_id },
          id,
        );
        await client.query(link.sql, link.values);
      }
    }

    // Backward compatibility: old callers may still send NF-e fields through
    // ordersApi.update(). They are persisted in invoicesIssued now.
    const nfePatch = {
      nfe_status: patch.nfe_status,
      nfe_key: patch.nfe_key,
      nfe_number: patch.nfe_number,
      nfe_protocol: patch.nfe_protocol,
      nfe_environment: patch.nfe_environment,
      nfe_provider_id: patch.nfe_provider_id ?? patch.nfe_plugnotas_id,
      xml_url: patch.xml_url ?? patch.nfe_xml_url,
      danfe_url: patch.danfe_url ?? patch.nfe_danfe_url,
      issued_at: patch.issued_at ?? patch.nfe_issue_datetime,
      issued_date: patch.issued_date ?? patch.nfe_issue_date,
    };

    const nfeEntries = Object.entries(nfePatch)
      .filter(([, value]) => value !== undefined && value !== null);

    if (nfeEntries.length) {
      const latest = await client.query(
        `
        SELECT invoice_id
        FROM ${TB_INVOICES_ISSUED}
        WHERE order_id = $1
        ORDER BY issued_at DESC NULLS LAST, invoice_id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [id],
      );

      if (!latest.rowCount) {
        throw new Error(
          'Não existe registro em invoicesIssued para atualizar os campos de NF-e deste pedido.',
        );
      }

      const nfeSets = [];
      const nfeArgs = [];
      let ni = 1;

      for (const [column, rawValue] of nfeEntries) {
        let value = rawValue;

        if (column === 'nfe_number') {
          if (!isFiniteNum(value)) continue;
          value = Number(value);
        } else if (column === 'issued_date') {
          value = toPgDate(value);
          if (!value) throw new Error('issued_date / nfe_issue_date inválido.');
        } else if (column === 'issued_at') {
          value = toPgTimestamp(value);
          if (!value) throw new Error('issued_at / nfe_issue_datetime inválido.');
        }

        nfeSets.push(`${column} = $${ni++}`);
        nfeArgs.push(value);
      }

      if (nfeSets.length) {
        nfeArgs.push(latest.rows[0].invoice_id);
        await client.query(
          `
          UPDATE ${TB_INVOICES_ISSUED}
          SET ${nfeSets.join(', ')},
              updated_at = NOW()
          WHERE invoice_id = $${ni}
          `,
          nfeArgs,
        );
      }
    }

    await client.query('COMMIT');

    const afterOrder = await getById(id);

    await safeCreateOrderAuditLog({
      register_id: id,
      operation: 'UPDATE',
      user_id: patch.user_id ?? patch.updated_by ?? null,
      before: beforeOrder?.ok ? beforeOrder : null,
      after: afterOrder?.ok ? afterOrder : { order_id: id },
    });

    return { ok: true, id, number: id };
  } catch (err) {
    await client.query('ROLLBACK');
    reportOrdersError('[ordersApi.update] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}
