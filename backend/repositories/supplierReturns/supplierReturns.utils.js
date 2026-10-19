// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.utils.js — helpers puros                         ║
// ║ números, texto, tags XML, JSON, UF, datas, CFOP de devolução     ║
// ╚══════════════════════════════════════════════════════════════════╝

export function toNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;

    const text = String(value).trim();
    if (!text) return fallback;

    const normalized = text.includes(',')
        ? text.replace(/\./g, '').replace(',', '.')
        : text;

    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
}

export function onlyDigits(value = '') {
    return String(value || '').replace(/\D+/g, '');
}

export function cleanText(value = '') {
    return String(value || '')
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

export function normalizeStatus(value) {
    const s = String(value || 'DRAFT').trim().toUpperCase();

    const allowed = new Set([
        'DRAFT',
        'READY',
        'PROCESSING',
        'TRANSMITTED',
        'AUTHORIZED',
        'CANCELLED',
        'REJECTED',
    ]);

    return allowed.has(s) ? s : 'DRAFT';
}

export function tagContent(xml = '', tag = '') {
    const re = new RegExp(
        `<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`,
        'i',
    );

    const m = String(xml || '').match(re);
    return cleanText(m?.[1] || '');
}

export function allTagBlocks(xml = '', tag = '') {
    const re = new RegExp(
        `<(?:\\w+:)?${tag}\\b[^>]*>[\\s\\S]*?<\\/(?:\\w+:)?${tag}>`,
        'gi',
    );

    return String(xml || '').match(re) || [];
}

export function firstTagBlock(xml = '', tag = '') {
    return allTagBlocks(xml, tag)[0] || '';
}

export function getNfeKey(xml = '') {
    const infNfeOpen = String(xml || '').match(
        /<(?:\w+:)?infNFe\b[^>]*\bId=["']NFe(\d{44})["'][^>]*>/i,
    );

    if (infNfeOpen?.[1]) return infNfeOpen[1];

    const chNFe = onlyDigits(tagContent(xml, 'chNFe'));
    if (chNFe.length === 44) return chNFe;

    return '';
}

export function getAttr(xml = '', attr = '') {
    const re = new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i');
    const m = String(xml || '').match(re);
    return cleanText(m?.[1] || '');
}

export function asJson(value, fallback = {}) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;

    try {
        return JSON.parse(String(value));
    } catch {
        return fallback;
    }
}

export function normalizeUf(value = '') {
    return String(value || '').trim().toUpperCase().slice(0, 2);
}

export function normalizeDate(value = null) {
    const s = String(value || '').trim();
    return s || null;
}

export function pickExistingColumn(columns, candidates) {
    for (const candidate of candidates) {
        if (columns.has(candidate)) return candidate;
    }

    return null;
}

export function normalizeCfopForReturn(cfopEntrada = '', supplierUf = '', emitUf = 'MG') {
    const cfop = onlyDigits(cfopEntrada).slice(0, 4);
    const ufSupplier = normalizeUf(supplierUf);
    const ufEmit = normalizeUf(emitUf || 'MG');
    const interstate = ufSupplier && ufEmit && ufSupplier !== ufEmit;

    if (cfop === '1102' || cfop === '2102') return interstate ? '6202' : '5202';
    if (cfop === '1403' || cfop === '2403') return interstate ? '6411' : '5411';
    if (cfop === '1556' || cfop === '2556') return interstate ? '6556' : '5556';
    if (cfop === '1551' || cfop === '2551') return interstate ? '6553' : '5553';

    if (cfop.startsWith('1')) return `5${cfop.slice(1)}`;
    if (cfop.startsWith('2')) return `6${cfop.slice(1)}`;

    return interstate ? '6202' : '5202';
}
