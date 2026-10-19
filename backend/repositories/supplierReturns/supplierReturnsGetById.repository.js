// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsGetById.repository.js — devolução por ID          ║
// ║ cabeçalho + itens                                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_HEAD, TABLE_ITEMS } from './supplierReturns.constants.js';
import { toNumber, asJson } from './supplierReturns.utils.js';
import { NFE_STATUS_SELECT_SQL, NFE_STATUS_JOIN_SQL } from './supplierReturns.sql.js';
import { ensureTables } from './supplierReturnsSchema.repository.js';

export async function getById(returnId) {
    await ensureTables();

    const id = toNumber(returnId, 0);
    if (!id) return null;

    const head = await pool.query(
        `
      SELECT
        sr.*,
        COALESCE(sr.supplier_name, '') AS supplier_name,
        COALESCE(sr.supplier_document, '') AS supplier_document,
        ${NFE_STATUS_SELECT_SQL}
      FROM ${TABLE_HEAD} sr
      ${NFE_STATUS_JOIN_SQL}
      WHERE sr.return_id = $1
    `,
        [id],
    );

    if (!head.rowCount) return null;

    const items = await pool.query(
        `SELECT * FROM ${TABLE_ITEMS} WHERE return_id = $1 ORDER BY item_id ASC`,
        [id],
    );

    return {
        ...head.rows[0],
        supplier_json: asJson(head.rows[0].supplier_json, {}),
        destination_json: asJson(head.rows[0].destination_json, {}),
        totals_json: asJson(head.rows[0].totals_json, {}),
        transport_json: asJson(head.rows[0].transport_json, {}),
        billing_json: asJson(head.rows[0].billing_json, {}),
        payments_json: asJson(head.rows[0].payments_json, []),
        additional_info_json: asJson(head.rows[0].additional_info_json, {}),
        references_json: asJson(head.rows[0].references_json, []),
        items: items.rows.map((item) => ({
            ...item,
            xml_snapshot: asJson(item.xml_snapshot, {}),
            taxes_json: asJson(item.taxes_json, {}),
        })),
    };
}
