// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsCreate.repository.js — cria devolução             ║
// ║ cabeçalho + itens (enriquecidos pelos itens importados)          ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_HEAD, TABLE_ITEMS, TABLE_IMPORTED } from './supplierReturns.constants.js';
import { toNumber, asJson } from './supplierReturns.utils.js';
import { toNfeStatusCode, nfeStatusIdSql } from './supplierReturns.sql.js';
import { normalizeItem, normalizeHeader } from './supplierReturns.sanitizers.js';
import { ensureTables } from './supplierReturnsSchema.repository.js';
import { getById } from './supplierReturnsGetById.repository.js';

export async function create(payload = {}) {
    await ensureTables();

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let items = Array.isArray(payload.items)
            ? payload.items.map(normalizeItem).filter((item) => item.quantity > 0)
            : [];

        items = await Promise.all(items.map(async (item) => {
            if (!item.source_import_item_id) return item;

            const r = await pool.query(
                `SELECT * FROM ${TABLE_IMPORTED} WHERE import_item_id = $1 LIMIT 1`,
                [item.source_import_item_id]
            );

            const imported = r.rows[0];
            if (!imported) return item;

            const importedSnapshot = asJson(imported.xml_snapshot, {});
            const importedTaxes = asJson(imported.taxes_json, {});

            return {
                ...item,

                cst_icms:
                    item.cst_icms ||
                    imported.cst_icms ||
                    importedTaxes?.icms?.CST ||
                    importedTaxes?.icms?.CSOSN ||
                    importedSnapshot?.taxes?.icms?.CST ||
                    importedSnapshot?.taxes?.icms?.CSOSN ||
                    '',

                cst_pis:
                    item.cst_pis ||
                    imported.cst_pis ||
                    importedTaxes?.pis?.CST ||
                    importedSnapshot?.taxes?.pis?.CST ||
                    '',

                cst_cofins:
                    item.cst_cofins ||
                    imported.cst_cofins ||
                    importedTaxes?.cofins?.CST ||
                    importedSnapshot?.taxes?.cofins?.CST ||
                    '',

                xml_snapshot:
                    Object.keys(item.xml_snapshot || {}).length
                        ? item.xml_snapshot
                        : importedSnapshot,

                taxes_json:
                    Object.keys(item.taxes_json || {}).length
                        ? item.taxes_json
                        : importedTaxes,
            };
        }));

        let header = normalizeHeader(payload);

        const firstSourceImportId =
            items.find((i) => i.source_import_item_id)?.source_import_item_id || null;

        if (firstSourceImportId) {
            const h = await pool.query(
                `SELECT header_json FROM ${TABLE_IMPORTED} WHERE import_item_id = $1 LIMIT 1`,
                [firstSourceImportId]
            );

            const importedHeader = asJson(h.rows[0]?.header_json, {});

            header = normalizeHeader({
                ...payload,

                supplier_json:
                    payload.supplier_json ||
                    importedHeader.supplier ||
                    {},

                destination_json:
                    payload.destination_json ||
                    importedHeader.destination ||
                    {},

                totals_json:
                    payload.totals_json ||
                    importedHeader.totals ||
                    {},

                transport_json:
                    payload.transport_json ||
                    importedHeader.transport ||
                    {},

                billing_json:
                    payload.billing_json ||
                    importedHeader.billing ||
                    {},

                payments_json:
                    payload.payments_json ||
                    importedHeader.payments ||
                    [],

                additional_info_json:
                    payload.additional_info_json ||
                    importedHeader.additional_info ||
                    {},

                references_json:
                    payload.references_json ||
                    importedHeader.references ||
                    [],

                original_nat_op:
                    payload.original_nat_op ||
                    importedHeader.original_nat_op,

                original_model:
                    payload.original_model ||
                    importedHeader.original_model,

                original_tp_nf:
                    payload.original_tp_nf ||
                    importedHeader.original_tp_nf,

                original_fin_nfe:
                    payload.original_fin_nfe ||
                    importedHeader.original_fin_nfe,
            });
        }

        console.log('[SUPPLIER RETURN][CREATE PAYLOAD ITEMS]', JSON.stringify(payload.items, null, 2));
        console.log('[SUPPLIER RETURN][CREATE NORMALIZED HEADER]', JSON.stringify(header, null, 2));
        console.log('[SUPPLIER RETURN][CREATE NORMALIZED ITEMS]', JSON.stringify(items, null, 2));

        if (!header.supplier_id) {
            throw new Error('Fornecedor é obrigatório. Importe uma NF-e de entrada vinculada a um fornecedor cadastrado.');
        }

        if (header.original_nfe_key.length !== 44) {
            throw new Error('Chave da NF-e original deve conter 44 dígitos.');
        }

        if (!items.length) {
            throw new Error('Selecione ao menos um item para devolução.');
        }

        for (const item of items) {
            if (!item.product_id && !item.product_code) {
                throw new Error(`Item ${item.description || ''} sem produto vinculado.`);
            }

            if (!item.cfop || item.cfop.length !== 4) {
                throw new Error(`Item ${item.description || item.product_code} sem CFOP de devolução.`);
            }
        }

        const totalValue = items.reduce((acc, item) => acc + toNumber(item.total_value, 0), 0);

        const inserted = await client.query(
            `
        INSERT INTO ${TABLE_HEAD} (
          supplier_id,
          supplier_name,
          supplier_document,
          supplier_ie,
          supplier_city,
          supplier_uf,
          original_nfe_key,
          original_document_number,
          original_series,
          original_issue_date,
          original_nat_op,
          original_model,
          original_tp_nf,
          original_fin_nfe,
          return_reason,
          status,
          nfe_id,
          total_value,
          supplier_json,
          destination_json,
          totals_json,
          transport_json,
          billing_json,
          payments_json,
          additional_info_json,
          references_json,
          nfe_status_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,
          $19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb,
          ${nfeStatusIdSql(27)}
        )
        RETURNING *
      `,
            [
                header.supplier_id,
                header.supplier_name || null,
                header.supplier_document || null,
                header.supplier_ie || null,
                header.supplier_city || null,
                header.supplier_uf || null,
                header.original_nfe_key,
                header.original_document_number || null,
                header.original_series || null,
                header.original_issue_date || null,
                header.original_nat_op || null,
                header.original_model || null,
                header.original_tp_nf || null,
                header.original_fin_nfe || null,
                header.return_reason || null,
                header.status,
                header.nfe_id,
                totalValue,
                JSON.stringify(header.supplier_json || {}),
                JSON.stringify(header.destination_json || {}),
                JSON.stringify(header.totals_json || {}),
                JSON.stringify(header.transport_json || {}),
                JSON.stringify(header.billing_json || {}),
                JSON.stringify(header.payments_json || []),
                JSON.stringify(header.additional_info_json || {}),
                JSON.stringify(header.references_json || []),
                toNfeStatusCode(header.status),
            ],
        );

        const returnId = inserted.rows[0].return_id;

        for (const item of items) {
            await client.query(
                `
          INSERT INTO ${TABLE_ITEMS} (
            return_id,
            source_import_item_id,
            xml_item_no,
            product_id,
            product_code,
            description,
            quantity,
            unit,
            unit_value,
            total_value,
            cfop,
            ncm,
            cest,
            cst_icms,
            cst_pis,
            cst_cofins,
            xml_snapshot,
            taxes_json
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb
          )
        `,
                [
                    returnId,
                    item.source_import_item_id,
                    item.xml_item_no,
                    item.product_id || 0,
                    item.product_code || null,
                    item.description || null,
                    item.quantity,
                    item.unit,
                    item.unit_value,
                    item.total_value,
                    item.cfop || null,
                    item.ncm || null,
                    item.cest || null,
                    item.cst_icms || null,
                    item.cst_pis || null,
                    item.cst_cofins || null,
                    JSON.stringify(item.xml_snapshot || {}),
                    JSON.stringify(item.taxes_json || {}),
                ],
            );
        }

        await client.query('COMMIT');

        return getById(returnId);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
