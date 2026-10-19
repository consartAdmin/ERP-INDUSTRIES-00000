// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsUpdate.repository.js — atualiza devolução         ║
// ║ cabeçalho + substituição opcional dos itens                      ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_HEAD, TABLE_ITEMS } from './supplierReturns.constants.js';
import { toNumber } from './supplierReturns.utils.js';
import { toNfeStatusCode, nfeStatusIdSql } from './supplierReturns.sql.js';
import { normalizeItem, normalizeHeader } from './supplierReturns.sanitizers.js';
import { ensureTables } from './supplierReturnsSchema.repository.js';
import { getById } from './supplierReturnsGetById.repository.js';

export async function update(returnId, payload = {}) {
    await ensureTables();

    const id = toNumber(returnId, 0);
    if (!id) throw new Error('ID inválido.');

    const current = await getById(id);
    if (!current) return null;

    if (['AUTHORIZED', 'CANCELLED'].includes(current.status)) {
        throw new Error('Devolução autorizada/cancelada não pode ser alterada.');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const header = normalizeHeader({ ...current, ...payload });

        const items = Array.isArray(payload.items)
            ? payload.items.map(normalizeItem).filter((item) => item.quantity > 0)
            : null;

        if (!header.supplier_id) {
            throw new Error('Fornecedor é obrigatório.');
        }

        if (header.original_nfe_key.length !== 44) {
            throw new Error('Chave da NF-e original deve conter 44 dígitos.');
        }

        let totalValue = toNumber(current.total_value, 0);

        if (items) {
            if (!items.length) {
                throw new Error('Informe ao menos um item para devolução.');
            }

            for (const item of items) {
                if (!item.product_id && !item.product_code) {
                    throw new Error(`Item ${item.description || ''} sem produto vinculado.`);
                }

                if (!item.cfop || item.cfop.length !== 4) {
                    throw new Error(`Item ${item.description || item.product_code} sem CFOP de devolução.`);
                }
            }

            totalValue = items.reduce((acc, item) => acc + toNumber(item.total_value, 0), 0);
        }

        await client.query(
            `
        UPDATE ${TABLE_HEAD}
           SET supplier_id = $1,
               supplier_name = $2,
               supplier_document = $3,
               supplier_ie = $4,
               supplier_city = $5,
               supplier_uf = $6,
               original_nfe_key = $7,
               original_document_number = $8,
               original_series = $9,
               original_issue_date = $10,
               original_nat_op = $11,
               original_model = $12,
               original_tp_nf = $13,
               original_fin_nfe = $14,
               return_reason = $15,
               status = $16,
               nfe_id = $17,
               total_value = $18,
               supplier_json = $19::jsonb,
               destination_json = $20::jsonb,
               totals_json = $21::jsonb,
               transport_json = $22::jsonb,
               billing_json = $23::jsonb,
               payments_json = $24::jsonb,
               additional_info_json = $25::jsonb,
               references_json = $26::jsonb,
               nfe_status_id = ${nfeStatusIdSql(28)},
               updated_at = now()
         WHERE return_id = $27
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
                id,
                toNfeStatusCode(header.status),
            ],
        );

        if (items) {
            await client.query(`DELETE FROM ${TABLE_ITEMS} WHERE return_id = $1`, [id]);

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
                        id,
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
        }

        await client.query('COMMIT');

        return getById(id);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
