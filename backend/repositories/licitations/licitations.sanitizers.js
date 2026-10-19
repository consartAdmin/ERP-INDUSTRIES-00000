// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitations.sanitizers.js — Paginação e payload permitido          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizePagination(value, fallback, max = Number.MAX_SAFE_INTEGER) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

export function sanitizePayload(payload = {}) {
    const allowed = [
        'process_number',
        'licitation_number',
        'portal',
        'portal_url',
        'agency_name',
        'agency_document',
        'modality',
        'state',
        'city',
        'session_date',
        'proposal_deadline',
        'lot_number',
        'item_number',
        'product_description',
        'catmat_code',
        'catser_code',
        'quantity',
        'unit',
        'estimated_unit_price',
        'estimated_total_price',
        'product_id',
        'sku',
        'brand',
        'manufacturer',
        'cost_price',
        'freight_cost',
        'tax_cost',
        'minimum_sale_price',
        'proposed_price',
        'estimated_margin',
        'participation',
        'status',
        'responsible',
        'observations',
    ];

    const result = {};

    for (const field of allowed) {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
            result[field] = payload[field] === '' ? null : payload[field];
        }
    }

    if (result.state) {
        result.state = String(result.state).trim().toUpperCase();
    }

    if (result.status) {
        result.status = String(result.status).trim().toUpperCase();
    }

    if (Object.prototype.hasOwnProperty.call(result, 'participation')) {
        result.participation =
            result.participation === true ||
            result.participation === 'true' ||
            result.participation === 1 ||
            result.participation === '1';
    }

    return result;
}
