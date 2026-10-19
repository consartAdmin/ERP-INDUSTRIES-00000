// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsDraft.repository.js — draft de NF-e de devolução  ║
// ║ buildNfeDraft — pronto para o motor de NF-e                      ║
// ╚══════════════════════════════════════════════════════════════════╝

import { asJson } from './supplierReturns.utils.js';
import { getById } from './supplierReturnsGetById.repository.js';

export async function buildNfeDraft(returnId) {
    const data = await getById(returnId);
    if (!data) return null;

    const normalizeTaxItem = (item = {}) => {
        const taxesJson = asJson(item.taxes_json, {});
        const xmlSnapshot = asJson(item.xml_snapshot, {});

        const cstIcms =
            item.cst_icms ||
            taxesJson?.icms?.CST ||
            taxesJson?.icms?.CSOSN ||
            xmlSnapshot?.taxes?.icms?.CST ||
            xmlSnapshot?.taxes?.icms?.CSOSN ||
            '';

        const cstPis =
            item.cst_pis ||
            taxesJson?.pis?.CST ||
            xmlSnapshot?.taxes?.pis?.CST ||
            '';

        const cstCofins =
            item.cst_cofins ||
            taxesJson?.cofins?.CST ||
            xmlSnapshot?.taxes?.cofins?.CST ||
            '';

        return {
            nItem: item.xml_item_no || item.item_id || null,
            item_id: item.item_id,
            source_import_item_id: item.source_import_item_id,
            xml_item_no: item.xml_item_no,

            product_id: item.product_id,
            product_code: item.product_code,
            description: item.description,

            quantity: Number(item.quantity || 0),
            unit: item.unit,
            unit_value: Number(item.unit_value || 0),
            total_value: Number(item.total_value || 0),

            cfop: item.cfop,
            ncm: item.ncm,
            cest: item.cest,

            cst_icms: cstIcms,
            cst_pis: cstPis,
            cst_cofins: cstCofins,

            xml_snapshot: xmlSnapshot,
            taxes: taxesJson,
        };
    };

    const draft = {
        operation_type: 'SUPPLIER_RETURN',

        nfe: {
            tpNF: '1',
            finNFe: '4',
            natOp: 'DEVOLUCAO DE COMPRA',
            NFref: [{ refNFe: data.original_nfe_key }],
        },

        supplier_return: {
            return_id: data.return_id,
            supplier_id: data.supplier_id,
            supplier_name: data.supplier_name,
            supplier_document: data.supplier_document,
            supplier_ie: data.supplier_ie,
            supplier_city: data.supplier_city,
            supplier_uf: data.supplier_uf,
            original_nfe_key: data.original_nfe_key,
            original_document_number: data.original_document_number,
            original_series: data.original_series,
            original_issue_date: data.original_issue_date,
            original_nat_op: data.original_nat_op,
            original_model: data.original_model,
            original_tp_nf: data.original_tp_nf,
            original_fin_nfe: data.original_fin_nfe,
            total_value: data.total_value,
            return_reason: data.return_reason,
            status: data.status,

            supplier_json: data.supplier_json || {},
            destination_json: data.destination_json || {},
            totals_json: data.totals_json || {},
            transport_json: data.transport_json || {},
            billing_json: data.billing_json || {},
            payments_json: data.payments_json || [],
            additional_info_json: data.additional_info_json || {},
            references_json: data.references_json || [],
        },

        destinatario: {
            supplier_id: data.supplier_id,
            name: data.supplier_name,
            document: data.supplier_document,
            ie: data.supplier_ie,
            city: data.supplier_city,
            uf: data.supplier_uf,
            address: data.supplier_json?.address || {},
        },

        transport: data.transport_json || {},
        billing: data.billing_json || {},
        payments: data.payments_json || [],
        additional_info: data.additional_info_json || {},
        references: data.references_json || [],

        items: (data.items || []).map(normalizeTaxItem),
    };

    console.log('[SUPPLIER RETURN][DRAFT]', JSON.stringify(draft, null, 2));

    return draft;
}
