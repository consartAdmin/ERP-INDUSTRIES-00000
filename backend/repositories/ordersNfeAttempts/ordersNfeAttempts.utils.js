// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttempts.utils.js — Helpers                                 ║
// ║ Datas, serialização e leitura da resposta do provedor                ║
// ╚══════════════════════════════════════════════════════════════════════╝


export function saoPauloDate(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const map = Object.fromEntries(
        parts.map(({ type, value: partValue }) => [type, partValue]),
    );

    return `${map.year}-${map.month}-${map.day}`;
}

export function normalizeProviderDateTime(value) {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value).trim();
    const brazilian = raw.match(
        /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    );

    if (brazilian) {
        const [, day, month, year, hour = '00', minute = '00', second = '00'] =
            brazilian;
        const parsed = new Date(
            `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`,
        );
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function serializeValue(column, value, jsonColumns) {
    if (!jsonColumns.has(column) || value === null || value === undefined) {
        return value;
    }
    return typeof value === 'string' ? value : JSON.stringify(value);
}
export function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export function normalizeEnvironment(value) {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === '1' || normalized.includes('PRODU')) return 'PRODUCAO';
    return 'HOMOLOGACAO';
}

export function normalizeAccessKey(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length === 44 ? digits : null;
}

export function providerDocument(response) {
    const data = response?.data;

    if (Array.isArray(data)) return data[0] ?? null;

    const documents = data?.documents ?? data?.documentos;
    if (Array.isArray(documents)) return documents[0] ?? null;
    if (documents && typeof documents === 'object') return documents;

    if (data?.id || data?.idIntegracao) return data;

    const nested = data?.data;
    if (Array.isArray(nested)) return nested[0] ?? null;
    if (nested?.id || nested?.idIntegracao) return nested;

    return null;
}

export function errorPayload(value) {
    if (value == null) return {};
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            code: value.code ?? null,
            response: value.response?.data ?? null,
        };
    }
    return typeof value === 'object' ? value : { message: String(value) };
}

export function providerItems(payload) {
    const root = Array.isArray(payload) ? payload[0] : payload;
    const items = root?.itens ?? root?.items ?? root?.produtos ?? [];
    return Array.isArray(items) ? items : [];
}

export function snapshotItems(order, payload = null) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const sentItems = providerItems(payload);

    return items.map((item, index) => {
        const quantity = numberOrZero(item.quantity);
        const unitPrice = numberOrZero(item.unit_price);
        const discount = numberOrZero(item.discount_value);
        const gross = numberOrZero(item.gross_total ?? quantity * unitPrice);

        return {
            ...item,
            order_item_id: item.order_item_id ?? null,
            item_number: index + 1,
            product_code: item.product_code ?? item.sku,
            description: item.description ?? `Produto ${item.product_code ?? item.sku}`,
            commercial_unit: item.commercial_unit ?? item.unit ?? 'UN',
            taxable_unit: item.taxable_unit ?? item.unit ?? 'UN',
            is_unit: item.is_unit ?? item.unit ?? 'UN',
            quantity,
            taxable_quantity: numberOrZero(item.taxable_quantity ?? quantity),
            unit_price: unitPrice,
            taxable_unit_price: numberOrZero(item.taxable_unit_price ?? unitPrice),
            gross_total: gross,
            discount_amount: discount,
            freight_amount: numberOrZero(item.freight_amount),
            insurance_amount: numberOrZero(item.insurance_amount),
            other_expenses_amount: numberOrZero(item.other_expenses_amount),
            net_total: numberOrZero(item.net_total ?? Math.max(0, gross - discount)),
            included_in_invoice_total: item.included_in_invoice_total !== false,
            cfop_used: item.cfop_used ?? item.cfop_exit ?? item.cfop ?? null,
            ncm_code: item.ncm_code ?? item.ncm ?? null,
            cest_code: item.cest_code ?? item.cest ?? null,
            fiscal_profile_name: item.fiscal_profile_name ?? item.fiscal_profile ?? null,
            classification_name:
                item.classification_name ?? item.fiscal_classification ?? null,
            product_fiscal_snapshot: item.product_fiscal_snapshot ?? {},
            classification_snapshot: item.classification_snapshot ?? {},
            fiscal_profile_snapshot: item.fiscal_profile_snapshot ?? {},
            tax_reform_details: item.tax_reform_details ?? {},
            tax_calculation: item.tax_calculation ?? {},
            order_item_snapshot: item,
            provider_item_payload: sentItems[index] ?? {},
        };
    });
}

export function remoteStatus(data = {}) {
    return String(
        data.situacao ?? data.situacaoNfe ?? data.statusNfe ?? data.status ?? 'PROCESSANDO',
    ).trim().toUpperCase();
}

export function isAuthorized(status) {
    return ['AUTORIZADA',
        'AUTORIZADO',
        'CONCLUIDA',
        'CONCLUÍDA',
        'CONCLUIDO',
        'CONCLUÍDO']
        .includes(status);
}

export function isRejected(status) {
    return ['REJEITADA',
        'REJEITADO',
        'DENEGADA',
        'DENEGADO']
        .includes(status);
}

export function isCancelled(status) {
    return [
        'CANCELADA',
        'CANCELADO',
        'CANCELLED',
        'CANCELED',
    ].includes(status);
}
