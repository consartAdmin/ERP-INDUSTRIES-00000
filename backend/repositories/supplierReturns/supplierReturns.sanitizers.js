// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.sanitizers.js — normalização de entrada          ║
// ║ normalizeItem, normalizeHeader                                   ║
// ╚══════════════════════════════════════════════════════════════════╝

import { toNumber, onlyDigits, normalizeStatus, asJson, normalizeUf } from './supplierReturns.utils.js';

export function normalizeItem(item = {}) {
    const quantity = toNumber(item.quantity ?? item.quantity_return ?? item.quantityReturn, 0);
    const unitValue = toNumber(item.unit_value ?? item.unitValue, 0);

    const totalValue = toNumber(
        item.total_value ?? item.totalValue ?? item.total_value_return ?? item.totalValueReturn,
        quantity * unitValue,
    );

    const sourceImportRaw = item.source_import_item_id ?? item.sourceImportItemId;
    const xmlItemRaw = item.xml_item_no ?? item.xmlItemNo;

    return {
        source_import_item_id:
            sourceImportRaw === null || sourceImportRaw === undefined || sourceImportRaw === ''
                ? null
                : toNumber(sourceImportRaw, null),

        xml_item_no:
            xmlItemRaw === null || xmlItemRaw === undefined || xmlItemRaw === ''
                ? null
                : toNumber(xmlItemRaw, null),

        product_id: toNumber(item.product_id ?? item.productId, 0),
        product_code: String(item.product_code ?? item.productCode ?? '').trim(),
        description: String(item.description ?? '').trim(),

        quantity,
        unit: String(item.unit ?? 'UN').trim().toUpperCase().slice(0, 10),
        unit_value: unitValue,
        total_value: totalValue,

        cfop: onlyDigits(item.cfop).slice(0, 4),
        ncm: onlyDigits(item.ncm).slice(0, 8),
        cest: onlyDigits(item.cest).slice(0, 10),

        cst_icms: String(
            item.cst_icms ??
            item.cstIcms ??
            item.taxes_json?.icms?.CST ??
            item.taxes_json?.icms?.CSOSN ??
            item.taxes?.icms?.CST ??
            item.taxes?.icms?.CSOSN ??
            item.xml_snapshot?.taxes?.icms?.CST ??
            item.xml_snapshot?.taxes?.icms?.CSOSN ??
            ''
        ).trim().slice(0, 3),

        cst_pis: String(
            item.cst_pis ??
            item.cstPis ??
            item.taxes_json?.pis?.CST ??
            item.taxes?.pis?.CST ??
            item.xml_snapshot?.taxes?.pis?.CST ??
            ''
        ).trim().slice(0, 2),

        cst_cofins: String(
            item.cst_cofins ??
            item.cstCofins ??
            item.taxes_json?.cofins?.CST ??
            item.taxes?.cofins?.CST ??
            item.xml_snapshot?.taxes?.cofins?.CST ??
            ''
        ).trim().slice(0, 2),

        xml_snapshot: asJson(item.xml_snapshot ?? item.xmlSnapshot, {}),
        taxes_json: asJson(
            item.taxes_json ??
            item.taxesJson ??
            item.taxes ??
            item.xml_snapshot?.taxes,
            {}
        ),
    };
}

export function normalizeHeader(payload = {}) {
    const originalKey = onlyDigits(payload.original_nfe_key ?? payload.originalNfeKey);
    const nfeIdRaw = payload.nfe_id ?? payload.nfeId;

    const supplierObj = asJson(payload.supplier_json ?? payload.supplier, {});
    const destinationObj = asJson(payload.destination_json ?? payload.destination ?? payload.customer_from_xml, {});
    const totalsObj = asJson(payload.totals_json ?? payload.totals, {});
    const transportObj = asJson(payload.transport_json ?? payload.transport, {});
    const billingObj = asJson(payload.billing_json ?? payload.billing, {});
    const paymentsObj = Array.isArray(payload.payments)
        ? payload.payments
        : asJson(payload.payments_json ?? payload.payments, []);
    const additionalInfoObj = asJson(payload.additional_info_json ?? payload.additional_info, {});
    const referencesObj = Array.isArray(payload.references)
        ? payload.references
        : asJson(payload.references_json ?? payload.references, []);

    return {
        supplier_id: toNumber(payload.supplier_id ?? payload.supplierId, 0),
        supplier_name: String(payload.supplier_name ?? payload.supplierName ?? supplierObj.trade_name ?? supplierObj.legal_name ?? '').trim(),
        supplier_document: onlyDigits(payload.supplier_document ?? payload.supplierDocument ?? supplierObj.tax_id),

        supplier_ie: onlyDigits(payload.supplier_ie ?? payload.supplierIe ?? payload.ie ?? supplierObj.ie),
        supplier_city: String(payload.supplier_city ?? payload.supplierCity ?? supplierObj.address?.city ?? '').trim(),
        supplier_uf: normalizeUf(payload.supplier_uf ?? payload.supplierUf ?? supplierObj.address?.uf),

        original_nfe_key: originalKey,
        original_document_number: String(payload.original_document_number ?? payload.originalDocumentNumber ?? '').trim(),
        original_series: String(payload.original_series ?? payload.originalSeries ?? '').trim(),
        original_issue_date: payload.original_issue_date ?? payload.originalIssueDate ?? null,

        original_nat_op: String(payload.original_nat_op ?? payload.originalNatOp ?? '').trim(),
        original_model: String(payload.original_model ?? payload.originalModel ?? '').trim(),
        original_tp_nf: String(payload.original_tp_nf ?? payload.originalTpNf ?? '').trim(),
        original_fin_nfe: String(payload.original_fin_nfe ?? payload.originalFinNfe ?? '').trim(),

        return_reason: String(payload.return_reason ?? payload.returnReason ?? '').trim(),
        status: normalizeStatus(payload.status),

        nfe_id:
            nfeIdRaw === null || nfeIdRaw === undefined || nfeIdRaw === ''
                ? null
                : toNumber(nfeIdRaw, null),

        supplier_json: supplierObj,
        destination_json: destinationObj,
        totals_json: totalsObj,
        transport_json: transportObj,
        billing_json: billingObj,
        payments_json: paymentsObj,
        additional_info_json: additionalInfoObj,
        references_json: referencesObj,
    };
}
