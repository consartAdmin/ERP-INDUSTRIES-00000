// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationBudgetsPdf.filename.js — Nome do arquivo PDF do orçamento  ║
// ║ "<número> - <cliente>.pdf" (ex.: "1234 - SPORT SOUL.pdf")            ║
// ╚══════════════════════════════════════════════════════════════════════╝

function firstFilled(...values) {
    return values
        .map((value) => String(value ?? '').trim())
        .find(Boolean) || '';
}

function cleanPart(value) {
    return String(value || '')
        .replace(/[\/\\:*?"<>|\u0000-\u001f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function budgetPdfFilename(budget = {}) {
    const number = cleanPart(firstFilled(
        budget?.number,
        budget?.budget_number,
        budget?.budget_num,
        budget?.budget_id,
        budget?.id
    )) || 'ORCAMENTO';

    const customer = cleanPart(firstFilled(
        budget?.customer_name,
        budget?.nome_razao_social,
        budget?.trade_name,
        budget?.legal_name
    )).slice(0, 80).trim();

    return customer ? `${number} - ${customer}.pdf` : `${number}.pdf`;
}

// Content-Disposition com fallback ASCII + filename* (RFC 5987) para acentos
export function contentDisposition(filename, type = 'inline') {
    const name = String(filename || 'ORCAMENTO.pdf');
    const ascii = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7e]/g, '_')
        .replace(/["\\]/g, '_');

    return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
