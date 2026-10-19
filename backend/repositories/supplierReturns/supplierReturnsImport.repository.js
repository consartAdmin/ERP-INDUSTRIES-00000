// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsImport.repository.js — importa XML de entrada     ║
// ║ parse + match fornecedor/produto + grava itens importados        ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_IMPORTED } from './supplierReturns.constants.js';
import { parseInboundNfeXml } from './supplierReturns.xmlParser.js';
import { findSupplierByDocument, findProductByCodeOrBarcode } from './supplierReturnsLookup.repository.js';
import { ensureTables } from './supplierReturnsSchema.repository.js';

export async function importInboundXml({ buffer, xmlText, emitUf = 'MG' } = {}) {
    await ensureTables();

    const xml = xmlText || buffer?.toString('utf8') || '';
    if (!xml.trim()) throw new Error('Arquivo XML vazio ou inválido.');

    const parsed = parseInboundNfeXml(xml, { emitUf });
    const supplierMatch = await findSupplierByDocument(parsed.header.supplier.tax_id);

    parsed.header.supplier_id = supplierMatch?.supplier_id || null;

    parsed.header.supplier_name =
        supplierMatch?.trade_name ||
        supplierMatch?.legal_name ||
        parsed.header.supplier.trade_name ||
        parsed.header.supplier.legal_name ||
        '';

    parsed.header.supplier_document =
        supplierMatch?.tax_id ||
        parsed.header.supplier.tax_id ||
        '';

    parsed.header.supplier_ie =
        parsed.header.supplier.ie ||
        supplierMatch?.ie ||
        '';

    parsed.header.supplier_city =
        parsed.header.supplier.address?.city ||
        supplierMatch?.city ||
        '';

    parsed.header.supplier_uf =
        parsed.header.supplier.address?.uf ||
        supplierMatch?.uf ||
        '';

    parsed.header.supplier_found = Boolean(supplierMatch?.supplier_id);

    if (supplierMatch) {
        parsed.header.supplier.erp_match = supplierMatch;
    }

    const enrichedItems = [];

    for (const item of parsed.items) {
        const product = await findProductByCodeOrBarcode({
            cProd: item.xml_product_code,
            cEAN: item.barcode,
        });

        enrichedItems.push({
            ...item,

            product_id: product?.product_id || null,
            product_code: product?.product_code || item.xml_product_code,
            description: product?.description || item.description,

            ncm: product?.ncm || item.ncm,
            cest: product?.cest || item.cest,

            cst_icms: item.cst_icms || product?.cst_icms || item.taxes?.icms?.CST || item.taxes?.icms?.CSOSN || '',
            cst_pis: item.cst_pis || product?.cst_pis || item.taxes?.pis?.CST || '',
            cst_cofins: item.cst_cofins || product?.cst_cofins || item.taxes?.cofins?.CST || '',

            product_found: Boolean(product?.product_id),

            xml_snapshot: item,
            taxes_json: item.taxes || {},
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `DELETE FROM ${TABLE_IMPORTED} WHERE original_nfe_key = $1`,
            [parsed.header.original_nfe_key],
        );

        const savedItems = [];

        for (const item of enrichedItems) {
            const inserted = await client.query(
                `
          INSERT INTO ${TABLE_IMPORTED} (
            original_nfe_key,
            xml_item_no,
            product_id,
            product_code,
            xml_product_code,
            barcode,
            description,
            quantity_original,
            quantity_return,
            unit,
            unit_value,
            total_value_original,
            total_value_return,
            cfop_inbound,
            cfop,
            ncm,
            cest,
            cst_icms,
            cst_pis,
            cst_cofins,
            product_found,
            barcode_trib,
            unit_trib,
            quantity_trib,
            unit_value_trib,
            discount_value,
            freight_value,
            insurance_value,
            other_value,
            extipi,
            cbenef,
            xped,
            nitemped,
            xml_snapshot,
            taxes_json,
            header_json
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
            $31,$32,$33,$34::jsonb,$35::jsonb,$36::jsonb
          )
          RETURNING *
        `,
                [
                    parsed.header.original_nfe_key,
                    item.xml_item_no,
                    item.product_id,
                    item.product_code || null,
                    item.xml_product_code || null,
                    item.barcode || null,
                    item.description || null,
                    item.quantity_original,
                    item.quantity_return,
                    item.unit,
                    item.unit_value,
                    item.total_value_original,
                    item.total_value_return,
                    item.cfop_inbound || null,
                    item.cfop || null,
                    item.ncm || null,
                    item.cest || null,
                    item.cst_icms || null,
                    item.cst_pis || null,
                    item.cst_cofins || null,
                    item.product_found,
                    item.barcode_trib || null,
                    item.unit_trib || null,
                    item.quantity_trib || null,
                    item.unit_value_trib || null,
                    item.discount_value || 0,
                    item.freight_value || 0,
                    item.insurance_value || 0,
                    item.other_value || 0,
                    item.extipi || null,
                    item.cbenef || null,
                    item.xped || null,
                    item.nitemped || null,
                    JSON.stringify(item.xml_snapshot || item),
                    JSON.stringify(item.taxes_json || item.taxes || {}),
                    JSON.stringify(parsed.header || {}),
                ],
            );

            savedItems.push(inserted.rows[0]);
        }

        await client.query('COMMIT');

        return {
            header: parsed.header,
            items: savedItems,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
